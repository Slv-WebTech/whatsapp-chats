/**
 * api/auth/session.js — Session validation endpoint
 * --------------------------------------------------
 * GET /api/auth/session
 *
 * Verifies the Firebase ID token, extracts the user's role, and optionally
 * enriches the response with the PostgreSQL user profile row.
 *
 * Response shape:
 *   { uid, email, role, emailVerified, profile: { id, username, plan, ... } | null }
 *
 * The PostgreSQL lookup is best-effort — if the DB is unreachable the
 * endpoint still returns the Firebase claims so auth is never blocked.
 */

import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return; // 401/403 already sent

    // Enrich with PostgreSQL profile (best-effort)
    let profile = null;
    try {
        const sql = getSql();

        // Keep SQL user table in sync with Firebase auth identities.
        await sql`
            INSERT INTO users (firebase_uid, email, role)
            VALUES (${user.uid}, ${user.email || ''}, ${user.role || 'user'})
            ON CONFLICT (firebase_uid)
            DO UPDATE SET
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                updated_at = NOW()
        `;

        const rows = await sql`
            SELECT id, username, role, plan, created_at
            FROM users
            WHERE firebase_uid = ${user.uid}
            LIMIT 1
        `;
        profile = rows[0] ?? null;
    } catch {
        // DB unavailable — return base claims only
    }

    return res.status(200).json({
        uid: user.uid,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        profile,
    });
}
