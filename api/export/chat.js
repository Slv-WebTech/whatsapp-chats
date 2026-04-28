/**
 * api/export/chat.js — Chat export endpoint
 * ------------------------------------------
 * POST /api/export/chat
 * Body: { roomId, format: 'json'|'csv'|'txt', startDate?, endDate? }
 *
 * Validates room membership in PostgreSQL before exporting. Enforces a
 * per-user rate limit of 5 exports per hour to prevent bulk data extraction.
 *
 * Supported formats:
 *   json — Array of { sender_name, sent_at, content, type }
 *   csv  — RFC 4180 with header row; attachment download
 *   txt  — [timestamp] sender: message; attachment download
 *
 * Row cap: 10 000 messages per export. For larger exports trigger the
 * async job queue endpoint (/api/jobs/enqueue) instead.
 */

import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';
import { checkRateLimit } from '../_lib/rateLimiter.js';

const EXPORT_RATE_MAX    = 5;
const EXPORT_RATE_WINDOW = 3600; // 1 hour
const ROW_CAP            = 10_000;
const VALID_FORMATS      = new Set(['json', 'csv', 'txt']);

/**
 * Minimal CSV value escaping per RFC 4180.
 * @param {string} value
 */
function csvEscape(value) {
    const str = String(value ?? '').replace(/\r/g, '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    // Per-user export rate limit
    const rl = await checkRateLimit(`export:${user.uid}`, {
        max: EXPORT_RATE_MAX,
        windowSecs: EXPORT_RATE_WINDOW,
    });
    if (!rl.allowed) {
        return res.status(429).json({ error: 'Export rate limit exceeded. Try again later.' });
    }

    const body     = req.body || {};
    const roomId   = String(body.roomId   || '').trim().slice(0, 128);
    const format   = VALID_FORMATS.has(body.format) ? body.format : 'json';
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate   = body.endDate   ? new Date(body.endDate)   : null;

    if (!roomId) return res.status(400).json({ error: 'roomId is required.' });

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate.' });
    }
    if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate.' });
    }

    try {
        const sql = getSql();

        // Authorise: user must be a member of the room
        const membership = await sql`
            SELECT 1
            FROM room_members
            WHERE room_id = ${roomId}
              AND user_uid = ${user.uid}
            LIMIT 1
        `;
        if (!membership.length) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Fetch messages — dynamic date filters without raw interpolation
        let messages;
        if (startDate && endDate) {
            messages = await sql`
                SELECT sender_name, sent_at, content, type
                FROM messages
                WHERE room_id = ${roomId}
                  AND deleted  = false
                  AND sent_at >= ${startDate}
                  AND sent_at <= ${endDate}
                ORDER BY sent_at ASC
                LIMIT ${ROW_CAP}
            `;
        } else if (startDate) {
            messages = await sql`
                SELECT sender_name, sent_at, content, type
                FROM messages
                WHERE room_id = ${roomId}
                  AND deleted  = false
                  AND sent_at >= ${startDate}
                ORDER BY sent_at ASC
                LIMIT ${ROW_CAP}
            `;
        } else if (endDate) {
            messages = await sql`
                SELECT sender_name, sent_at, content, type
                FROM messages
                WHERE room_id = ${roomId}
                  AND deleted  = false
                  AND sent_at <= ${endDate}
                ORDER BY sent_at ASC
                LIMIT ${ROW_CAP}
            `;
        } else {
            messages = await sql`
                SELECT sender_name, sent_at, content, type
                FROM messages
                WHERE room_id = ${roomId}
                  AND deleted  = false
                ORDER BY sent_at ASC
                LIMIT ${ROW_CAP}
            `;
        }

        const filename = `chat-${roomId}`;

        if (format === 'csv') {
            const rows = ['sender,timestamp,type,message'];
            for (const m of messages) {
                rows.push(
                    [
                        csvEscape(m.sender_name),
                        csvEscape(m.sent_at?.toISOString?.() ?? m.sent_at),
                        csvEscape(m.type),
                        csvEscape(m.content),
                    ].join(',')
                );
            }
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            return res.status(200).send(rows.join('\r\n'));
        }

        if (format === 'txt') {
            const lines = messages.map(
                (m) =>
                    `[${m.sent_at?.toISOString?.() ?? m.sent_at}] ${m.sender_name}: ${m.content ?? ''}`
            );
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
            return res.status(200).send(lines.join('\n'));
        }

        // Default: JSON
        return res.status(200).json({ messages, count: messages.length, roomId });
    } catch (err) {
        console.error('[export/chat]', err.message);
        return res.status(500).json({ error: 'Export failed.' });
    }
}
