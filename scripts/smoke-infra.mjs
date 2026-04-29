import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

function clean(value) {
  return String(value || '').trim().replace(/^"|"$/g, '');
}

async function testNeon() {
  const url = clean(process.env.DATABASE_URL);
  if (!url) return { ok: false, detail: 'DATABASE_URL missing' };
  try {
    const sql = neon(url);
    const rows = await sql`SELECT NOW() AS now`;
    return { ok: Boolean(rows?.[0]?.now), detail: 'query ok' };
  } catch (err) {
    return { ok: false, detail: err?.message || 'unknown Neon error' };
  }
}

async function testUpstashRest() {
  const url = clean(process.env.UPSTASH_REDIS_REST_URL);
  const token = clean(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) {
    return { ok: false, detail: 'UPSTASH_REDIS_REST_URL/TOKEN missing' };
  }
  try {
    const redis = new Redis({ url, token });
    const key = `smoke:infra:rest:${Date.now()}`;
    await redis.set(key, 'ok', { ex: 60 });
    const value = await redis.get(key);
    return { ok: value === 'ok', detail: 'set/get ok' };
  } catch (err) {
    return { ok: false, detail: err?.message || 'unknown Upstash REST error' };
  }
}

async function testBullMq() {
  const redisUrl = clean(process.env.REDIS_URL);
  if (!redisUrl) return { ok: false, detail: 'REDIS_URL missing' };

  let conn;
  let queue;
  try {
    conn = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    queue = new Queue('analytics-rollup', { connection: conn });
    const job = await queue.add(
      'analytics-rollup',
      { roomId: 'smoke-room', date: new Date().toISOString().slice(0, 10) },
      { removeOnComplete: true, removeOnFail: true }
    );
    return { ok: Boolean(job?.id), detail: `job queued (${job?.id || 'no-id'})` };
  } catch (err) {
    return { ok: false, detail: err?.message || 'unknown BullMQ error' };
  } finally {
    try { await queue?.close(); } catch {}
    try { await conn?.quit(); } catch {}
  }
}

async function main() {
  const result = {
    neon: await testNeon(),
    upstashRest: await testUpstashRest(),
    bullmq: await testBullMq(),
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));

  const allOk = result.neon.ok && result.upstashRest.ok && result.bullmq.ok;
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        neon: { ok: false, detail: 'not run' },
        upstashRest: { ok: false, detail: 'not run' },
        bullmq: { ok: false, detail: 'not run' },
        fatal: err?.message || String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
});
