/**
 * profileCache.js
 * ----------------------------------------------------------------------------
 * In-memory TTL cache for Firestore user-profile reads.
 *
 * Problem solved:
 *   GroupSettingsPanel and the chat runtime both call loadUserProfile() per
 *   member on every render cycle. With 20+ members and multiple re-renders
 *   that creates dozens of redundant Firestore reads per session.
 *
 * Design:
 *   - Module-level Map survives across component mounts/unmounts in the same
 *     browser session — profiles are rarely mutated so a 10-minute TTL is safe.
 *   - Pending promise deduplication prevents simultaneous in-flight fetches for
 *     the same uid from issuing two Firestore reads.
 *   - `invalidate(uid)` and `clear()` allow callers to purge stale entries
 *     when a profile is known to have changed.
 */

const PROFILE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Map<uid, { profile: object, expiresAt: number }>
const _cache = new Map();
// Map<uid, Promise<object|null>> — deduplicates in-flight fetches
const _pending = new Map();

/**
 * Returns a cached profile or fetches a fresh one using the provided fetch function.
 *
 * @param {string} uid - Firebase user ID
 * @param {(uid: string) => Promise<object|null>} fetchFn - function to load profile from Firestore
 * @returns {Promise<object|null>}
 */
export async function getCachedProfile(uid, fetchFn) {
    const safeUid = String(uid || '').trim();
    if (!safeUid) return null;

    // Cache hit within TTL
    const cached = _cache.get(safeUid);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.profile;
    }

    // Deduplicate in-flight fetches for the same uid
    if (_pending.has(safeUid)) {
        return _pending.get(safeUid);
    }

    const promise = fetchFn(safeUid)
        .then((profile) => {
            _cache.set(safeUid, { profile, expiresAt: Date.now() + PROFILE_TTL_MS });
            return profile;
        })
        .catch(() => {
            // Don't cache errors — allow retry on next call
            return null;
        })
        .finally(() => {
            _pending.delete(safeUid);
        });

    _pending.set(safeUid, promise);
    return promise;
}

/**
 * Fetch multiple profiles in parallel, respecting the cache and deduplicating.
 *
 * @param {string[]} uids
 * @param {(uid: string) => Promise<object|null>} fetchFn
 * @returns {Promise<Map<string, object>>} uid → profile map (null profiles omitted)
 */
export async function getCachedProfiles(uids, fetchFn) {
    const uniqueUids = [...new Set((uids || []).map((u) => String(u || '').trim()).filter(Boolean))];
    const results = await Promise.all(uniqueUids.map((uid) => getCachedProfile(uid, fetchFn)));
    const map = new Map();
    uniqueUids.forEach((uid, i) => {
        if (results[i]) map.set(uid, results[i]);
    });
    return map;
}

/**
 * Invalidate a single profile (e.g. after the user updates their username).
 * @param {string} uid
 */
export function invalidateProfile(uid) {
    const safeUid = String(uid || '').trim();
    _cache.delete(safeUid);
}

/**
 * Clear the entire profile cache (e.g. on logout).
 */
export function clearProfileCache() {
    _cache.clear();
    _pending.clear();
}

/**
 * Peek at current cache stats (useful for debugging / telemetry).
 * @returns {{ size: number, pendingFetches: number }}
 */
export function profileCacheStats() {
    return { size: _cache.size, pendingFetches: _pending.size };
}
