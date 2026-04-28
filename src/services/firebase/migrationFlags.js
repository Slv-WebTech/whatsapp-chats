/**
 * switch-read-path.js
 * ============================================================================
 * Phase 5 — Switch the app's read path from chats/ to rooms/.
 *
 * This module exports a single feature-flag constant READ_FROM_ROOMS.
 * Flip it to `true` once validate-migration.js passes with 0 failures.
 *
 * The flag is consumed by chatService.js to determine which collection
 * to read from. The write path (dual-write) remains active until Phase 6
 * (cleanup) is run, keeping the old schema fresh for instant rollback.
 *
 * Usage:
 *   1.  Run: node scripts/validate-migration.js
 *   2.  When all checks pass, set READ_FROM_ROOMS = true below.
 *   3.  Deploy the app.
 *   4.  Monitor for 24-48 hours.
 *   5.  If stable, run: node scripts/migrate-to-rooms.js --cleanup
 * ============================================================================
 */

/**
 * PHASE 5 SWITCH
 * Set to `true` only after validate-migration.js reports 0 failures.
 *
 * @type {boolean}
 */
export const READ_FROM_ROOMS = false;

/**
 * Returns the Firestore collection name to READ from.
 * Write path is always dual (chats + rooms) during the migration window.
 */
export function getReadCollection() {
    return READ_FROM_ROOMS ? 'rooms' : 'chats';
}
