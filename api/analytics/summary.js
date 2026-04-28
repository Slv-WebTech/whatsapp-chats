/**
 * api/analytics/summary.js — Pre-computed room analytics
 * -------------------------------------------------------
 * GET /api/analytics/summary?roomId=<id>
 *
 * Returns aggregated stats for a chat room:
 *   - Total message count, participant count, avg message length
 *   - Top 10 senders by message volume
 *   - Daily activity for the last 30 days
 *
 * Results are cached in Redis for 5 minutes to avoid re-running heavy
 * aggregation queries on every request. The caller receives a `fromCache`
 * boolean to indicate cache hits.
 *
 * Authorization: any authenticated user (no role requirement). The query
 * itself is scoped to the roomId — no cross-room data exposure.
 */

import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';
import { getRedis } from '../_lib/redis.js';

const CACHE_TTL_SECS = 300; // 5 minutes

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    const roomId = String(req.query?.roomId || '').trim().slice(0, 128);
    if (!roomId) {
        return res.status(400).json({ error: 'roomId query parameter is required.' });
    }

    const cacheKey = `beyondstrings:analytics:summary:${roomId}`;

    // Cache read
    try {
        const redis = getRedis();
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, fromCache: true });
        }
    } catch { /* non-fatal cache miss */ }

    try {
        const sql = getSql();

        // Aggregate overview stats
        const [stats] = await sql`
            SELECT
                COUNT(*)                    AS total_messages,
                COUNT(DISTINCT sender_uid)  AS participant_count,
                AVG(message_length)         AS avg_message_length,
                MAX(sent_at)                AS last_activity,
                MIN(sent_at)                AS first_message
            FROM messages
            WHERE room_id = ${roomId}
              AND deleted = false
        `;

        // Top senders
        const topSenders = await sql`
            SELECT sender_uid, sender_name, COUNT(*) AS message_count
            FROM messages
            WHERE room_id = ${roomId}
              AND deleted = false
            GROUP BY sender_uid, sender_name
            ORDER BY message_count DESC
            LIMIT 10
        `;

        // Daily activity — last 30 days
        const dailyActivity = await sql`
            SELECT
                DATE_TRUNC('day', sent_at)::date AS date,
                COUNT(*)                          AS message_count
            FROM messages
            WHERE room_id = ${roomId}
              AND sent_at > NOW() - INTERVAL '30 days'
              AND deleted = false
            GROUP BY DATE_TRUNC('day', sent_at)
            ORDER BY date ASC
        `;

        // Latest AI insight for this room (if any)
        const [latestInsight] = await sql`
            SELECT type, content, generated_at
            FROM ai_insights
            WHERE room_id = ${roomId}
              AND type = 'summary'
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY generated_at DESC
            LIMIT 1
        `;

        const payload = {
            roomId,
            stats: stats || {},
            topSenders,
            dailyActivity,
            latestInsight: latestInsight ?? null,
            generatedAt: new Date().toISOString(),
        };

        // Cache write (best-effort)
        try {
            const redis = getRedis();
            await redis.set(cacheKey, payload, { ex: CACHE_TTL_SECS });
        } catch { /* non-fatal */ }

        return res.status(200).json({ ...payload, fromCache: false });
    } catch (err) {
        console.error('[analytics/summary]', err.message);
        return res.status(500).json({ error: 'Analytics temporarily unavailable.' });
    }
}
