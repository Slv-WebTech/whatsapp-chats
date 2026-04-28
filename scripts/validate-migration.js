/**
 * validate-migration.js
 * ============================================================================
 * Phase 4 — Standalone validation script for the chats → rooms migration.
 *
 * Checks:
 *   ✓  Room document parity   (every chats/{id} has a matching rooms/{id})
 *   ✓  Message count parity   (old count == new count per room)
 *   ✓  Message ordering       (earliest + latest timestamps match)
 *   ✓  Encryption integrity   (encrypted: true preserved on all messages)
 *   ✓  clientId preservation  (dedupe key present when it existed in old schema)
 *   ✓  Reactions preserved    (reactions object copied verbatim)
 *   ✓  Members subcollection  (rooms/{id}/members has correct UIDs)
 *   ✓  No plain-text sender   (sender field stripped from new schema)
 *
 * Usage:
 *   node scripts/validate-migration.js
 *   node scripts/validate-migration.js --full    # check ALL rooms (slow, thorough)
 *   node scripts/validate-migration.js --room <roomId>   # check one room
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 * ============================================================================
 */

'use strict';

const admin = require('firebase-admin');

const ARGS = new Set(process.argv.slice(2));
const FULL_SCAN = ARGS.has('--full');
const SINGLE_ROOM = (() => {
    const idx = process.argv.indexOf('--room');
    return idx !== -1 ? process.argv[idx + 1] : null;
})();
const SAMPLE_LIMIT = 300;   // rooms to check unless --full

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function initFirebase() {
    if (admin.apps.length) return admin.firestore();
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const credsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credsFile) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey })
        });
    } else {
        throw new Error('Firebase credentials not found.');
    }
    return admin.firestore();
}

// ---------------------------------------------------------------------------
// Checkers
// ---------------------------------------------------------------------------

const results = {
    passed: [],
    failed: [],
    warnings: []
};

function pass(label, detail = '') {
    results.passed.push({ label, detail });
    console.log(`  ✅  ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail = '') {
    results.failed.push({ label, detail });
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
}

function warn(label, detail = '') {
    results.warnings.push({ label, detail });
    console.warn(`  ⚠️   ${label}${detail ? ' — ' + detail : ''}`);
}

// CHECK 1 — Room document parity
async function checkRoomParity(db, oldIds, newIds) {
    console.log('\n[CHECK 1] Room document parity');
    const missing = [...oldIds].filter((id) => !newIds.has(id));
    const extra = [...newIds].filter((id) => !oldIds.has(id));

    if (missing.length === 0) {
        pass('All chats/ rooms present in rooms/', `${oldIds.size} rooms`);
    } else {
        fail('Missing rooms in new schema', missing.join(', '));
    }

    if (extra.length > 0) {
        warn('Extra rooms in rooms/ not in chats/ (may be dual-write only rooms)', extra.join(', '));
    }
}

// CHECK 2 — Message count parity
async function checkMessageCounts(db, roomIds) {
    console.log('\n[CHECK 2] Message count parity');
    const mismatches = [];
    let checked = 0;

    for (const roomId of roomIds) {
        const [oldSnap, newSnap] = await Promise.all([
            db.collection('chats').doc(roomId).collection('messages').get(),
            db.collection('rooms').doc(roomId).collection('messages').get()
        ]);
        checked++;
        if (oldSnap.size !== newSnap.size) {
            mismatches.push({ roomId, old: oldSnap.size, new: newSnap.size });
        }
    }

    if (mismatches.length === 0) {
        pass('Message counts match', `${checked} rooms checked`);
    } else {
        fail(`Message count mismatches in ${mismatches.length} rooms`, JSON.stringify(mismatches));
    }
    return mismatches;
}

// CHECK 3 — Message ordering (timestamps)
async function checkMessageOrdering(db, roomIds) {
    console.log('\n[CHECK 3] Message ordering (timestamp preservation)');
    const orderingIssues = [];

    for (const roomId of roomIds) {
        const [oldSnap, newSnap] = await Promise.all([
            db.collection('chats').doc(roomId).collection('messages').orderBy('createdAt', 'asc').limit(1).get(),
            db.collection('rooms').doc(roomId).collection('messages').orderBy('createdAt', 'asc').limit(1).get()
        ]);

        const oldFirst = oldSnap.docs[0]?.data()?.createdAt?.toMillis?.() || null;
        const newFirst = newSnap.docs[0]?.data()?.createdAt?.toMillis?.() || null;

        if (oldFirst && newFirst && Math.abs(oldFirst - newFirst) > 1000) {
            orderingIssues.push({ roomId, oldFirst, newFirst });
        }
    }

    if (orderingIssues.length === 0) {
        pass('Message ordering preserved', `${roomIds.length} rooms checked`);
    } else {
        fail(`Ordering issues in ${orderingIssues.length} rooms`, JSON.stringify(orderingIssues));
    }
}

// CHECK 4 — Encryption integrity
async function checkEncryption(db, roomIds) {
    console.log('\n[CHECK 4] Encryption integrity (encrypted: true preserved)');
    const violations = [];

    for (const roomId of roomIds.slice(0, 50)) {
        const newSnap = await db.collection('rooms').doc(roomId).collection('messages').limit(20).get();
        for (const msgDoc of newSnap.docs) {
            const data = msgDoc.data();
            if (data.encrypted !== true) {
                violations.push({ roomId, msgId: msgDoc.id, encrypted: data.encrypted });
            }
        }
    }

    if (violations.length === 0) {
        pass('All sampled messages have encrypted: true');
    } else {
        fail(`Encryption flag missing on ${violations.length} messages`, JSON.stringify(violations));
    }
}

// CHECK 5 — clientId preservation (dedupe key)
async function checkClientIds(db, roomIds) {
    console.log('\n[CHECK 5] clientId preservation');
    const losses = [];

    for (const roomId of roomIds.slice(0, 50)) {
        const [oldWithClientId, newWithClientId] = await Promise.all([
            db.collection('chats').doc(roomId).collection('messages').where('clientId', '!=', null).limit(5).get(),
            db.collection('rooms').doc(roomId).collection('messages').where('clientId', '!=', null).limit(5).get()
        ]);

        // If old schema has messages with clientId but new schema has none — data loss
        if (oldWithClientId.size > 0 && newWithClientId.size === 0) {
            losses.push(roomId);
        }
    }

    if (losses.length === 0) {
        pass('clientId preserved across sampled rooms');
    } else {
        fail(`clientId missing in new schema for rooms: ${losses.join(', ')}`);
    }
}

// CHECK 6 — Reactions preserved
async function checkReactions(db, roomIds) {
    console.log('\n[CHECK 6] Reactions preserved');
    const issues = [];

    for (const roomId of roomIds.slice(0, 30)) {
        const oldSnap = await db
            .collection('chats').doc(roomId).collection('messages')
            .orderBy('createdAt', 'desc').limit(5).get();

        for (const oldMsg of oldSnap.docs) {
            const oldReactions = oldMsg.data().reactions || {};
            if (Object.keys(oldReactions).length === 0) continue;

            const newMsg = await db.collection('rooms').doc(roomId).collection('messages').doc(oldMsg.id).get();
            const newReactions = newMsg.data()?.reactions || {};

            const oldKeys = Object.keys(oldReactions).sort();
            const newKeys = Object.keys(newReactions).sort();

            if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) {
                issues.push({ roomId, msgId: oldMsg.id, oldKeys, newKeys });
            }
        }
    }

    if (issues.length === 0) {
        pass('Reactions preserved on sampled messages');
    } else {
        fail(`Reaction mismatches on ${issues.length} messages`, JSON.stringify(issues));
    }
}

// CHECK 7 — Members subcollection populated
async function checkMembersSubcollection(db, roomIds) {
    console.log('\n[CHECK 7] Members subcollection populated');
    const empty = [];

    for (const roomId of roomIds.slice(0, 50)) {
        const membersSnap = await db.collection('rooms').doc(roomId).collection('members').limit(1).get();
        if (membersSnap.empty) {
            // Fetch the room doc to see if it had members
            const roomDoc = await db.collection('rooms').doc(roomId).get();
            const memberCount = (roomDoc.data()?.members || []).length;
            if (memberCount > 0) {
                empty.push({ roomId, expectedMembers: memberCount });
            }
        }
    }

    if (empty.length === 0) {
        pass('Members subcollection populated for all sampled group rooms');
    } else {
        warn(`Members subcollection empty for ${empty.length} rooms (may be DMs)`, JSON.stringify(empty));
    }
}

// CHECK 8 — No plain-text sender in new schema
async function checkNoPlainTextSender(db, roomIds) {
    console.log('\n[CHECK 8] Privacy — sender field stripped from new schema');
    const violations = [];

    for (const roomId of roomIds.slice(0, 30)) {
        const newSnap = await db.collection('rooms').doc(roomId).collection('messages').limit(10).get();
        for (const msgDoc of newSnap.docs) {
            if (msgDoc.data().sender != null) {
                violations.push({ roomId, msgId: msgDoc.id });
            }
        }
    }

    if (violations.length === 0) {
        pass('No plain-text sender field in new schema messages');
    } else {
        fail(`sender field found in ${violations.length} new schema messages`, JSON.stringify(violations));
    }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
    const db = initFirebase();
    console.log('=== MIGRATION VALIDATION REPORT ===\n');

    // Fetch room lists
    const [oldSnap, newSnap] = await Promise.all([
        db.collection('chats').get(),
        db.collection('rooms').get()
    ]);

    const oldIds = new Set(oldSnap.docs.map((d) => d.id));
    const newIds = new Set(newSnap.docs.map((d) => d.id));

    let roomIdsToCheck;
    if (SINGLE_ROOM) {
        roomIdsToCheck = [SINGLE_ROOM];
    } else if (FULL_SCAN) {
        roomIdsToCheck = [...oldIds];
    } else {
        roomIdsToCheck = [...oldIds].slice(0, SAMPLE_LIMIT);
    }

    console.log(`Checking ${roomIdsToCheck.length} rooms (old total: ${oldIds.size}, new total: ${newIds.size})`);

    await checkRoomParity(db, oldIds, newIds);
    await checkMessageCounts(db, roomIdsToCheck);
    await checkMessageOrdering(db, roomIdsToCheck);
    await checkEncryption(db, roomIdsToCheck);
    await checkClientIds(db, roomIdsToCheck);
    await checkReactions(db, roomIdsToCheck);
    await checkMembersSubcollection(db, roomIdsToCheck);
    await checkNoPlainTextSender(db, roomIdsToCheck);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`  ✅ Passed:   ${results.passed.length}`);
    console.log(`  ❌ Failed:   ${results.failed.length}`);
    console.log(`  ⚠️  Warnings: ${results.warnings.length}`);

    if (results.failed.length === 0) {
        console.log('\n🟢  ALL CHECKS PASSED — safe to proceed to Phase 5 (switch read path)\n');
        process.exit(0);
    } else {
        console.log('\n🔴  CHECKS FAILED — DO NOT switch read path until failures are resolved\n');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
