/**
 * api/jobs/enqueue.js — Async job queue endpoint
 * ------------------------------------------------
 * POST /api/jobs/enqueue
 * Body: { job: 'ai-summary'|'analytics-rollup'|'cleanup', payload: { roomId, ... } }
 *
 * Pushes a job entry to a Redis list. The background worker (worker/index.js)
 * polls this list with BullMQ and processes jobs asynchronously.
 *
 * Rate-limited to 20 enqueue calls per minute per user to prevent flooding.
 *
 * Also writes an audit record to the `job_audit` PostgreSQL table for
 * observability. The audit write is best-effort and does not block the
 * response.
 */

import { authenticate } from '../_lib/rbac.js';
import { getRedis } from '../_lib/redis.js';
import { getSql } from '../_lib/db.js';
import { checkRateLimit } from '../_lib/rateLimiter.js';
import { getQueue } from '../_lib/queue.js';

const ALLOWED_JOBS = new Set(['ai-summary', 'analytics-rollup', 'cleanup']);
const JOB_QUEUE_PREFIX = 'beyondstrings:jobs';
const MAX_PAYLOAD_KEYS = 10;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    // Rate limit per user
    const rl = await checkRateLimit(`jobs:${user.uid}`, { max: 20, windowSecs: 60 });
    if (!rl.allowed) {
        return res.status(429).json({ error: 'Job enqueue rate limit exceeded.' });
    }

    const body    = req.body || {};
    const jobName = String(body.job || '').trim();
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!ALLOWED_JOBS.has(jobName)) {
        return res.status(400).json({
            error: `Unknown job type. Allowed: ${[...ALLOWED_JOBS].join(', ')}.`,
        });
    }

    // Sanitise payload — limit keys to prevent bloated queue entries
    const safePayload = Object.fromEntries(
        Object.entries(payload)
            .slice(0, MAX_PAYLOAD_KEYS)
            .map(([k, v]) => [String(k).slice(0, 64), typeof v === 'string' ? v.slice(0, 512) : v])
    );

    const jobEntry = {
        job: jobName,
        payload: safePayload,
        triggeredBy: user.uid,
        createdAt: Date.now(),
    };

    let queueBackend = 'bullmq';
    try {
        const queue = getQueue(jobName);
        await queue.add(jobName, jobEntry);
    } catch (err) {
        // Fallback for temporary queue publisher issues.
        queueBackend = 'redis-list-fallback';
        try {
            const redis = getRedis();
            await redis.rpush(`${JOB_QUEUE_PREFIX}:${jobName}`, JSON.stringify(jobEntry));
        } catch {
            console.error('[jobs/enqueue] queue publish failed:', err.message);
            return res.status(503).json({ error: 'Job queue unavailable. Try again shortly.' });
        }
    }

    // Audit log — best-effort, non-blocking
    try {
        const sql = getSql();
        await sql`
            INSERT INTO job_audit (job, payload, triggered_by, status)
            VALUES (${jobName}, ${safePayload}, ${user.uid}, 'pending')
        `;
    } catch { /* non-fatal */ }

    return res.status(202).json({
        queued: true,
        job: jobName,
        queueBackend,
        message: 'Job accepted and queued for processing.',
    });
}
