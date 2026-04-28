/**
 * db.js — Neon serverless PostgreSQL client
 * -----------------------------------------
 * Uses the Neon HTTP driver (@neondatabase/serverless) which works in both
 * Vercel Serverless and Edge runtimes without a persistent TCP connection.
 *
 * Usage:
 *   import { getSql } from './_lib/db.js';
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM users WHERE firebase_uid = ${uid}`;
 *
 * The tagged-template call is fully parameterized — values are never
 * interpolated as raw strings, preventing SQL injection.
 */

import { neon, neonConfig } from '@neondatabase/serverless';

// Cache HTTP connections across invocations in the same runtime instance
neonConfig.fetchConnectionCache = true;

let _sql = null;

/**
 * Returns the Neon tagged-template SQL executor.
 * Throws if DATABASE_URL is not configured.
 * @returns {import('@neondatabase/serverless').NeonQueryFunction}
 */
export function getSql() {
    if (_sql) return _sql;

    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('[db] DATABASE_URL environment variable is not configured.');
    }

    _sql = neon(url);
    return _sql;
}

/**
 * Convenience wrapper that logs slow queries (>500 ms) to console.warn.
 * Returns the raw row array from Neon.
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {Promise<object[]>}
 */
export async function query(strings, ...values) {
    const sql = getSql();
    const start = Date.now();
    try {
        const result = await sql(strings, ...values);
        const elapsed = Date.now() - start;
        if (elapsed > 500) {
            console.warn(`[db] slow query ${elapsed}ms`);
        }
        return result;
    } catch (err) {
        console.error('[db] query error:', err.message);
        throw err;
    }
}
