/**
 * redis.js — Upstash Redis client
 * --------------------------------
 * Upstash Redis is HTTP-based so it works in Vercel Edge, Serverless,
 * and standard Node.js without native TCP sockets.
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL   — from Upstash console
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash console
 */

import { Redis } from '@upstash/redis';

let _client = null;

/**
 * Returns a lazily initialised Upstash Redis client.
 * Throws if credentials are not configured.
 * @returns {Redis}
 */
export function getRedis() {
    if (_client) return _client;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error(
            '[redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.'
        );
    }

    _client = new Redis({ url, token });
    return _client;
}
