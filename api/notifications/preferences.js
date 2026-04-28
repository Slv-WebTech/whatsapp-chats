import { authenticate } from '../_lib/rbac.js';
import { getSql } from '../_lib/db.js';

function asBool(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

export default async function handler(req, res) {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const sql = getSql();

        if (req.method === 'GET') {
            const rows = await sql`
                SELECT message_alerts, mention_alerts, insight_alerts, push_enabled
                FROM notification_preferences
                WHERE firebase_uid = ${user.uid}
                LIMIT 1
            `;

            const data = rows[0] || {
                message_alerts: true,
                mention_alerts: true,
                insight_alerts: true,
                push_enabled: true
            };

            return res.status(200).json({
                messageAlerts: Boolean(data.message_alerts),
                mentionAlerts: Boolean(data.mention_alerts),
                insightAlerts: Boolean(data.insight_alerts),
                pushEnabled: Boolean(data.push_enabled)
            });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const messageAlerts = asBool(body.messageAlerts, true);
            const mentionAlerts = asBool(body.mentionAlerts, true);
            const insightAlerts = asBool(body.insightAlerts, true);
            const pushEnabled = asBool(body.pushEnabled, true);

            await sql`
                INSERT INTO notification_preferences (
                    firebase_uid,
                    message_alerts,
                    mention_alerts,
                    insight_alerts,
                    push_enabled
                ) VALUES (
                    ${user.uid},
                    ${messageAlerts},
                    ${mentionAlerts},
                    ${insightAlerts},
                    ${pushEnabled}
                )
                ON CONFLICT (firebase_uid)
                DO UPDATE SET
                    message_alerts = EXCLUDED.message_alerts,
                    mention_alerts = EXCLUDED.mention_alerts,
                    insight_alerts = EXCLUDED.insight_alerts,
                    push_enabled = EXCLUDED.push_enabled,
                    updated_at = NOW()
            `;

            // Keep devices in sync when push is globally disabled.
            if (!pushEnabled) {
                await sql`
                    UPDATE notification_devices
                    SET is_active = false, updated_at = NOW()
                    WHERE firebase_uid = ${user.uid}
                `;
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
        console.error('[notifications/preferences]', error.message);
        return res.status(500).json({ error: 'Could not process notification preferences.' });
    }
}
