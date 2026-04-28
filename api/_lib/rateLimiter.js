/**
 * rateLimiter.js — Redis-backed fixed-window rate limiter
 * --------------------------------------------------------
 * Uses Upstash Redis INCR + EXPIRE. Simple and effective for most API
 * endpoints. Fails open (allows the request) if Redis is unavailable so a
 * Redis outage never blocks legitimate traffic.
 *
 * Usage:
 *   const result = await checkRateLimit(`ai:${uid}`, { max: 30, windowSecs: 60 });
 *   if (!result.allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });
 */

import { getRedis } from './redis.js';

/**
 * @param {string} identifier  - Unique key, e.g. `ai:${uid}` or `export:${ip}`
 * @param {{ max?: number, windowSecs?: number }} options
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
export async function checkRateLimit(identifier, { max = 30, windowSecs = 60 } = {}) {
    const key = `beyondstrings:rl:${identifier}`;

    try {
        const redis = getRedis();

        const count = await redis.incr(key);

        // Set expiry only on first request in the window
        if (count === 1) {
            await redis.expire(key, windowSecs);
        }

        const allowed = count <= max;
        return {
            allowed,
            remaining: Math.max(0, max - count),
            resetAt: Date.now() + windowSecs * 1000,
        };
    } catch {
        // Fail open — never block traffic due to a Redis outage
        return { allowed: true, remaining: -1, resetAt: 0 };
    }
}

/**
 * Express/Vercel middleware factory.
 *
 * @param {string} name       - Rate limiter bucket name (e.g. 'export')
 * @param {{ max?: number, windowSecs?: number, keyFn?: (req) => string }} opts
 * @returns {(req, res, next?) => Promise<void>}
 *
 * @example
 *   export default withRateLimit('export', { max: 5, windowSecs: 3600 })(handler);
 */
export function withRateLimit(name, { max = 30, windowSecs = 60, keyFn } = {}) {
    return (handlerFn) => async (req, res) => {
        const key = keyFn ? keyFn(req) : `${name}:${req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'}`;
        const result = await checkRateLimit(key, { max, windowSecs });

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetAt);

        if (!result.allowed) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
        }

        return handlerFn(req, res);
    };
}
