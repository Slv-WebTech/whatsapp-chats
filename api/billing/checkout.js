import { authenticate } from '../_lib/rbac.js';

/**
 * Billing is intentionally disabled for now.
 * Premium visuals are available to all users until monetization is enabled.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;

    return res.status(200).json({
        enabled: false,
        status: 'free-for-all',
        message: 'Billing is currently disabled. Premium UI is available to all users.',
    });
}
