/**
 * rbac.js — Firebase JWT verification + Role-Based Access Control
 * ---------------------------------------------------------------
 * Wraps verifyFirebaseToken with:
 *   1. Role extraction from Firebase custom claims
 *   2. Role hierarchy comparison
 *   3. authenticate() helper that verifies + authorises in one call
 *
 * Role hierarchy (highest → lowest):
 *   admin > moderator > premium > user
 *
 * Custom claims format expected on the Firebase ID token:
 *   { role: 'admin' | 'moderator' | 'premium' | 'user' }
 *
 * Set custom claims via Firebase Admin SDK (server-side only):
 *   await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
 */

import { verifyFirebaseToken } from './firebaseAdmin.js';

const ROLE_RANK = {
    admin: 100,
    moderator: 50,
    premium: 20,
    user: 10,
};

const VALID_ROLES = new Set(Object.keys(ROLE_RANK));

/**
 * Returns true if userRole meets or exceeds requiredRole.
 * @param {string} userRole
 * @param {string} requiredRole
 */
export function hasRole(userRole, requiredRole) {
    return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[requiredRole] || 0);
}

/**
 * Verify the Bearer token on the request and return an enriched user object.
 * Writes the appropriate 401/403 response and returns null on failure so the
 * caller can immediately return after a null check.
 *
 * @param {object} req
 * @param {object} res
 * @param {{ requiredRole?: string }} options
 * @returns {Promise<{ uid: string, email: string, role: string, emailVerified: boolean } | null>}
 *
 * @example
 *   const user = await authenticate(req, res, { requiredRole: 'premium' });
 *   if (!user) return;  // response already sent
 */
export async function authenticate(req, res, { requiredRole = 'user' } = {}) {
    const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim();

    if (!/^Bearer\s+/i.test(authHeader)) {
        res.status(401).json({ error: 'Missing or malformed Authorization header.' });
        return null;
    }

    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) {
        res.status(401).json({ error: 'Empty bearer token.' });
        return null;
    }

    let claims;
    try {
        claims = await verifyFirebaseToken(idToken);
    } catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
        return null;
    }

    // Extract role from custom claims; default to 'user'
    const rawRole = String(claims?.role || claims?.customClaims?.role || 'user').toLowerCase();
    const role = VALID_ROLES.has(rawRole) ? rawRole : 'user';

    if (!hasRole(role, requiredRole)) {
        res.status(403).json({ error: `Requires '${requiredRole}' role.` });
        return null;
    }

    return {
        uid: String(claims.uid),
        email: String(claims.email || ''),
        role,
        emailVerified: Boolean(claims.email_verified),
    };
}
