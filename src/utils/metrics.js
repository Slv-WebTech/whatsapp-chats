/**
 * metrics.js — lightweight client-side usage tracking.
 * Stores anonymous session stats in localStorage only (privacy-safe).
 * No data leaves the device unless you add a backend endpoint.
 *
 * Usage:
 *   import { trackEvent, getMetrics } from './metrics';
 *   trackEvent('ai_summarize');
 *   trackEvent('message_sent', { chatType: 'group' });
 *   const stats = getMetrics();
 */

const STORAGE_KEY = 'beyondstrings_metrics_v1';
const SESSION_KEY = 'beyondstrings_session_v1';

function loadStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveStore(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Storage may be full or unavailable — fail silently
    }
}

function getOrCreateSessionId() {
    try {
        let sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    } catch {
        return 'unknown';
    }
}

/**
 * Track a named event with optional metadata.
 * @param {string} eventName
 * @param {Record<string,unknown>} [meta]
 */
export function trackEvent(eventName, meta = {}) {
    if (!eventName || typeof window === 'undefined') return;

    const store = loadStore();
    const safeEvent = String(eventName).slice(0, 64);

    if (!store.events) store.events = {};
    const current = store.events[safeEvent] || { count: 0, lastAt: null };
    current.count += 1;
    current.lastAt = new Date().toISOString();
    store.events[safeEvent] = current;

    if (!store.sessionId) store.sessionId = getOrCreateSessionId();
    if (!store.firstSeen) store.firstSeen = new Date().toISOString();
    store.lastSeen = new Date().toISOString();

    saveStore(store);
}

/**
 * Increment active session time (call periodically, e.g. every 30s while tab is active).
 * @param {number} deltaSeconds
 */
export function trackSessionTime(deltaSeconds = 30) {
    const store = loadStore();
    store.totalActiveSeconds = (store.totalActiveSeconds || 0) + deltaSeconds;
    saveStore(store);
}

/**
 * Get all stored metrics.
 * @returns {{ events: Record<string,{count:number,lastAt:string}>, totalActiveSeconds: number, firstSeen: string, lastSeen: string }}
 */
export function getMetrics() {
    return loadStore();
}

/**
 * Clear all stored metrics.
 */
export function clearMetrics() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore
    }
}
