/**
 * worker/processors/cleanup.js — Scheduled database maintenance
 * -------------------------------------------------------------
 * Triggered by: POST /api/jobs/enqueue  { job: 'cleanup', payload: {} }
 * Can also be triggered by a cron (e.g. Railway cron, GitHub Actions schedule).
 *
 * Operations:
 *   1. Delete expired AI insights (expires_at < NOW())
 *   2. Purge old job_audit rows (> 90 days, status done|failed)
 *   3. Log a summary of rows removed
 *
 * All deletes use RETURNING id so we can count affected rows without a
 * separate COUNT query. Idempotent — safe to run multiple times per day.
 */

import { neon } from '@neondatabase/serverless';

const AUDIT_RETENTION_DAYS   = 90;
const INSIGHT_GRACE_DAYS     = 0; // delete as soon as expires_at passes

function getSql() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set.');
    return neon(url);
}

/**
 * @param {import('bullmq').Job} job
 */
export async function cleanupProcessor(job) {
    const sql = getSql();
    const results = {};

    // 1. Expired AI insights
    const expiredInsights = await sql`
        DELETE FROM ai_insights
        WHERE expires_at IS NOT NULL
          AND expires_at < NOW() - (${INSIGHT_GRACE_DAYS} || ' days')::INTERVAL
        RETURNING id
    `;
    results.expiredInsights = expiredInsights.length;

    // 2. Old completed/failed job audit records
    const auditRows = await sql`
        DELETE FROM job_audit
        WHERE status     IN ('done', 'failed')
          AND created_at < NOW() - (${AUDIT_RETENTION_DAYS} || ' days')::INTERVAL
        RETURNING id
    `;
    results.purgedAuditRows = auditRows.length;

    console.log('[cleanup] completed:', results);
    return results;
}
