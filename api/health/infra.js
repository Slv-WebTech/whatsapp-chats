import { getSql } from '../_lib/db.js';
import { getRedis } from '../_lib/redis.js';
import IORedis from 'ioredis';

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

function clean(value) {
  return String(value || '').trim().replace(/^"|"$/g, '');
}

async function checkNeon() {
  const sql = getSql();
  const [row] = await withTimeout(sql`SELECT 1 AS ok`, 4000, 'neon');
  return row?.ok === 1;
}

async function checkUpstashRest() {
  const redis = getRedis();
  const key = `health:infra:${Date.now()}`;
  await withTimeout(redis.set(key, 'ok', { ex: 30 }), 4000, 'upstash-rest-set');
  const val = await withTimeout(redis.get(key), 4000, 'upstash-rest-get');
  return val === 'ok';
}

async function checkBullMqRedis() {
  const redisUrl = clean(process.env.REDIS_URL);
  if (!redisUrl) throw new Error('REDIS_URL missing');

  const conn = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    const pong = await withTimeout(conn.ping(), 5000, 'bullmq-redis-ping');
    return String(pong).toUpperCase() === 'PONG';
  } finally {
    try {
      await conn.quit();
    } catch {
      // no-op
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const requiredToken = clean(process.env.HEALTHCHECK_TOKEN);
  if (requiredToken) {
    const provided = clean(req.headers['x-health-token'] || req.query?.token);
    if (!provided || provided !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized healthcheck.' });
    }
  }

  const startedAt = Date.now();
  const checks = {
    neon: { ok: false, detail: '' },
    upstashRest: { ok: false, detail: '' },
    bullmqRedis: { ok: false, detail: '' },
  };

  try {
    checks.neon.ok = await checkNeon();
    checks.neon.detail = checks.neon.ok ? 'query ok' : 'query failed';
  } catch (err) {
    checks.neon.detail = err?.message || 'failed';
  }

  try {
    checks.upstashRest.ok = await checkUpstashRest();
    checks.upstashRest.detail = checks.upstashRest.ok ? 'set/get ok' : 'set/get failed';
  } catch (err) {
    checks.upstashRest.detail = err?.message || 'failed';
  }

  try {
    checks.bullmqRedis.ok = await checkBullMqRedis();
    checks.bullmqRedis.detail = checks.bullmqRedis.ok ? 'ping ok' : 'ping failed';
  } catch (err) {
    checks.bullmqRedis.detail = err?.message || 'failed';
  }

  const ok = checks.neon.ok && checks.upstashRest.ok && checks.bullmqRedis.ok;
  const status = ok ? 200 : 503;
  return res.status(status).json({
    ok,
    checks,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  });
}
