import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';

function normalizeToken(value) {
    return String(value || '').trim().slice(0, 4096);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    const body = req.body || {};
    const deviceToken = normalizeToken(body.deviceToken || body.token);
    const platform = String(body.platform || 'web').trim().slice(0, 40) || 'web';
    const userAgent = String(body.userAgent || req.headers['user-agent'] || '').slice(0, 512);
    const enabled = body.enabled !== false;

    if (!deviceToken) {
        return res.status(400).json({ error: 'deviceToken is required.' });
    }

    try {
        const sql = getSql();

        // Ensure user exists in SQL before inserting device rows.
        await sql`
            INSERT INTO users (firebase_uid, email, role)
            VALUES (${user.uid}, ${user.email || ''}, ${user.role || 'user'})
            ON CONFLICT (firebase_uid)
            DO UPDATE SET updated_at = NOW()
        `;

        await sql`
            INSERT INTO notification_devices (firebase_uid, device_token, platform, user_agent, is_active, last_seen_at)
            VALUES (${user.uid}, ${deviceToken}, ${platform}, ${userAgent}, ${enabled}, NOW())
            ON CONFLICT (device_token)
            DO UPDATE SET
                firebase_uid = EXCLUDED.firebase_uid,
                platform = EXCLUDED.platform,
                user_agent = EXCLUDED.user_agent,
                is_active = EXCLUDED.is_active,
                last_seen_at = NOW(),
                updated_at = NOW()
        `;

        await sql`
            INSERT INTO notification_preferences (firebase_uid, push_enabled)
            VALUES (${user.uid}, ${enabled})
            ON CONFLICT (firebase_uid)
            DO UPDATE SET
                push_enabled = EXCLUDED.push_enabled,
                updated_at = NOW()
        `;

        return res.status(200).json({ ok: true, registered: true });
    } catch (error) {
        console.error('[notifications/register-token]', error.message);
        return res.status(500).json({ error: 'Could not persist notification token.' });
    }
}
