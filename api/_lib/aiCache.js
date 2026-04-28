/**
 * aiCache.js — Redis response cache for the AI gateway
 * -----------------------------------------------------
 * Caches AI-generated responses keyed by (task + message fingerprint).
 * Prevents redundant provider calls for identical or near-identical inputs.
 *
 * TTLs by task:
 *   summary  — 30 min  (stable output for same content)
 *   insights — 60 min  (slower-changing)
 *   search   — 5  min  (query-specific but somewhat reusable)
 *   reply    — 0       (no cache — personalised per-user output)
 *
 * The fingerprint is a lightweight djb2 hash over the message content. This
 * avoids storing or transmitting raw message text in cache keys.
 */

import { getRedis } from './redis.js';

/** TTL in seconds, 0 = do not cache */
const CACHE_TTL_SECS = {
    summary: 1800,
    insights: 3600,
    search: 300,
    reply: 0,
};

/**
 * djb2 hash — fast, good distribution for cache-key use.
 * @param {string} str
 * @returns {string} base-36 string
 */
function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

function makeCacheKey(task, fingerprint) {
    return `beyondstrings:ai:${task}:${djb2(`${task}:${fingerprint}`)}`;
}

/**
 * Retrieve a cached AI response.
 * @param {string} task        - 'summary' | 'insights' | 'search' | 'reply'
 * @param {string} fingerprint - Caller-supplied content fingerprint
 * @returns {Promise<string|null>}
 */
export async function getCachedAiResponse(task, fingerprint) {
    const ttl = CACHE_TTL_SECS[task];
    if (!ttl) return null;

    try {
        const redis = getRedis();
        const value = await redis.get(makeCacheKey(task, fingerprint));
        return typeof value === 'string' ? value : null;
    } catch {
        return null; // cache miss on Redis error — caller falls through to AI provider
    }
}

/**
 * Store an AI response in cache.
 * @param {string} task
 * @param {string} fingerprint
 * @param {string} value
 */
export async function setCachedAiResponse(task, fingerprint, value) {
    const ttl = CACHE_TTL_SECS[task];
    if (!ttl || !value) return;

    try {
        const redis = getRedis();
        await redis.set(makeCacheKey(task, fingerprint), value, { ex: ttl });
    } catch {
        // Non-fatal — log only in development
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[aiCache] set failed');
        }
    }
}

/**
 * Build a fingerprint from a messages array + query string.
 * Uses only text content and length — no PII stored in the key.
 * @param {Array<{text: string}>} messages
 * @param {string} query
 * @returns {string}
 */
export function buildFingerprint(messages, query) {
    const content = (messages || [])
        .slice(-50)
        .map((m) => String(m?.text || '').slice(0, 120))
        .join('|') + '|' + String(query || '');
    return djb2(content) + ':' + messages.length;
}
