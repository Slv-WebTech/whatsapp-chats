/**
 * worker/index.js — BeyondStrings background job worker
 * ------------------------------------------------
 * Processes jobs from BullMQ queues using Redis (ioredis) as the broker.
 *
 * Deployment:
 *   Railway / Render free tier — set env vars and run `npm start`.
 *   Vercel does NOT support long-running workers; deploy this separately.
 *
 * Required env vars:
 *   REDIS_URL       — Redis connection string (e.g. rediss://...:password@host:6380)
 *   DATABASE_URL    — Neon PostgreSQL connection string
 *   OPENAI_API_KEY  — For ai-summary processor
 *   GEMINI_API_KEY  — Fallback for ai-summary processor
 *
 * Queue names match the job types accepted by /api/jobs/enqueue.
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import { aiSummaryProcessor }     from './processors/aiSummary.js';
import { analyticsRollupProcessor } from './processors/analyticsRollup.js';
import { cleanupProcessor }        from './processors/cleanup.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
    console.error('[worker] REDIS_URL environment variable is required.');
    process.exit(1);
}

// ioredis connection object required by BullMQ
// maxRetriesPerRequest: null is mandatory for BullMQ blocking commands
function parseRedisUrl(url) {
    const parsed = new URL(url);
    return {
        host:     parsed.hostname,
        port:     Number(parsed.port) || 6379,
        password: parsed.password || undefined,
        tls:      parsed.protocol === 'rediss:' ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
}

const connection = parseRedisUrl(REDIS_URL);

const PROCESSORS = {
    'ai-summary':       aiSummaryProcessor,
    'analytics-rollup': analyticsRollupProcessor,
    'cleanup':          cleanupProcessor,
};

const workers = Object.entries(PROCESSORS).map(([queueName, processor]) => {
    const worker = new Worker(queueName, processor, {
        connection,
        concurrency:      2,
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 500 },
    });

    worker.on('completed', (job) => {
        console.log(`[${queueName}] ✓ job ${job.id} completed in ${Date.now() - job.timestamp}ms`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[${queueName}] ✗ job ${job?.id} failed: ${err.message}`);
    });

    worker.on('error', (err) => {
        console.error(`[${queueName}] worker error:`, err.message);
    });

    return worker;
});

console.log(`[worker] started — queues: ${Object.keys(PROCESSORS).join(', ')}`);

// Graceful shutdown on SIGTERM (Railway/Render send this before killing the process)
async function shutdown(signal) {
    console.log(`[worker] received ${signal}, shutting down gracefully...`);
    await Promise.all(workers.map((w) => w.close()));
    console.log('[worker] all workers closed.');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
