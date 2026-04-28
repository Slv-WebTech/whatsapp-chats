/**
 * worker/processors/analyticsRollup.js — Daily analytics aggregation
 * -------------------------------------------------------------------
 * Triggered by: POST /api/jobs/enqueue
 *   { job: 'analytics-rollup', payload: { roomId, date?: 'YYYY-MM-DD' } }
 *
 * Computes and upserts a daily analytics record for a room:
 *   - Total message count
 *   - Unique participant count
 *   - Average message length
 *   - Top sender UID
 *
 * Uses ON CONFLICT DO UPDATE so the job is safely idempotent — re-running for
 * the same room+date just overwrites the previous rollup with fresh data.
 */

import { neon } from '@neondatabase/serverless';

function getSql() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set.');
    return neon(url);
}

/**
 * @param {import('bullmq').Job} job
 */
export async function analyticsRollupProcessor(job) {
    const { roomId, date: dateStr } = job.data;
    if (!roomId) throw new Error('roomId is required in job payload.');

    // Default to today if no date provided; normalize to YYYY-MM-DD
    const targetDate = dateStr && !isNaN(Date.parse(dateStr)) ? dateStr : new Date().toISOString().slice(0, 10);

    const sql = getSql();

    // Aggregate stats for the target day
    const [stats] = await sql`
        SELECT
            COUNT(*)                   AS message_count,
            COUNT(DISTINCT sender_uid) AS participant_count,
            AVG(message_length)        AS avg_length
        FROM messages
        WHERE room_id  = ${roomId}
          AND deleted  = false
          AND sent_at::date = ${targetDate}::date
    `;

    // Find top sender by volume
    const topSenders = await sql`
        SELECT sender_uid, COUNT(*) AS cnt
        FROM   messages
        WHERE  room_id  = ${roomId}
          AND  deleted  = false
          AND  sent_at::date = ${targetDate}::date
        GROUP  BY sender_uid
        ORDER  BY cnt DESC
        LIMIT  1
    `;

    const topSenderUid = topSenders[0]?.sender_uid ?? null;

    await sql`
        INSERT INTO analytics_daily (room_id, date, message_count, participant_count, avg_length, top_sender_uid)
        VALUES (
            ${roomId},
            ${targetDate}::date,
            ${Number(stats?.message_count)     || 0},
            ${Number(stats?.participant_count) || 0},
            ${stats?.avg_length != null ? Number(stats.avg_length) : null},
            ${topSenderUid}
        )
        ON CONFLICT (room_id, date) DO UPDATE SET
            message_count     = EXCLUDED.message_count,
            participant_count = EXCLUDED.participant_count,
            avg_length        = EXCLUDED.avg_length,
            top_sender_uid    = EXCLUDED.top_sender_uid
    `;

    return {
        roomId,
        date:             targetDate,
        messageCount:     Number(stats?.message_count)     || 0,
        participantCount: Number(stats?.participant_count) || 0,
    };
}
