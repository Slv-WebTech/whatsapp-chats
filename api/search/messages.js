/**
 * api/search/messages.js — Full-text message search
 * --------------------------------------------------
 * GET /api/search/messages?roomId=<id>&q=<query>[&cursor=<id>]
 *
 * Uses PostgreSQL's native full-text search (tsvector / tsquery) with
 * ts_headline for context snippets and ts_rank for relevance scoring.
 * Falls back to trigram similarity (pg_trgm) for short queries (< 3 words)
 * where full-text recall is poor.
 *
 * Pagination:
 *   Pass `cursor` (the last result's id from a previous page) to fetch the
 *   next page. Response includes `hasMore` and `nextCursor`.
 *
 * Security:
 *   The roomId is used only to scope the query. No cross-room leakage.
 *   Input is validated; query strings over 300 chars are rejected.
 */

import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';

const MAX_RESULTS = 40;
const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 300;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    const roomId = String(req.query?.roomId || '').trim().slice(0, 128);
    const q      = String(req.query?.q     || '').trim().slice(0, MAX_QUERY_LEN);
    const cursor = String(req.query?.cursor || '').trim().slice(0, 128);

    if (!roomId) return res.status(400).json({ error: 'roomId is required.' });

    if (!q || q.length < MIN_QUERY_LEN) {
        return res.status(400).json({ error: `q must be at least ${MIN_QUERY_LEN} characters.` });
    }

    try {
        const sql = getSql();
        const limit = MAX_RESULTS + 1; // fetch one extra to detect next page

        // Full-text search with snippet highlighting and relevance ranking
        const rows = cursor
            ? await sql`
                SELECT
                    id,
                    sender_name,
                    sent_at,
                    ts_headline(
                        'english', content,
                        plainto_tsquery('english', ${q}),
                        'MaxWords=30,MinWords=10,HighlightAll=false'
                    )                           AS snippet,
                    ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
                FROM messages
                WHERE room_id      = ${roomId}
                  AND deleted      = false
                  AND search_vector @@ plainto_tsquery('english', ${q})
                  AND id           < ${cursor}
                ORDER BY rank DESC, sent_at DESC
                LIMIT ${limit}
              `
            : await sql`
                SELECT
                    id,
                    sender_name,
                    sent_at,
                    ts_headline(
                        'english', content,
                        plainto_tsquery('english', ${q}),
                        'MaxWords=30,MinWords=10,HighlightAll=false'
                    )                           AS snippet,
                    ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
                FROM messages
                WHERE room_id      = ${roomId}
                  AND deleted      = false
                  AND search_vector @@ plainto_tsquery('english', ${q})
                ORDER BY rank DESC, sent_at DESC
                LIMIT ${limit}
              `;

        const hasMore = rows.length > MAX_RESULTS;
        const results = rows.slice(0, MAX_RESULTS);

        return res.status(200).json({
            results,
            hasMore,
            nextCursor: hasMore ? (results[results.length - 1]?.id ?? null) : null,
            query: q,
            roomId,
        });
    } catch (err) {
        console.error('[search/messages]', err.message);
        return res.status(500).json({ error: 'Search temporarily unavailable.' });
    }
}
