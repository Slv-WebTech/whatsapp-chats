/**
 * migrate-to-rooms.js
 * ============================================================================
 * Firestore schema migration  — "chats" collection  →  "rooms" collection
 * Strategy: DUAL WRITE + BACKFILL  (zero-downtime, zero-data-loss)
 *
 * Phases covered by this script:
 *   Phase 1  — Verify / create new schema skeleton (rooms, insights, analytics)
 *   Phase 3  — Backfill old messages into rooms/{roomId}/messages
 *   Phase 4  — Validate message counts + ordering
 *   Phase 6  — (optional, behind --cleanup flag) Remove old chats collection
 *
 * Usage:
 *   node scripts/migrate-to-rooms.js                  # backfill only
 *   node scripts/migrate-to-rooms.js --validate       # validation report
 *   node scripts/migrate-to-rooms.js --cleanup        # ⚠️  destructive — removes chats
 *   node scripts/migrate-to-rooms.js --rollback       # delete rooms docs only (safe)
 *
 * Prerequisites:
 *   npm install firebase-admin   (or:  npm install --save-dev firebase-admin)
 *   Set env var:  GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   Or inline:    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Safety rules enforced:
 *   - Batch writes capped at 450 ops (Firestore limit is 500)
 *   - Skip rooms/{id} if it already exists + has messages  (idempotent)
 *   - Preserves: timestamps, senderId, encrypted text, clientId, reactions
 *   - Never touches imported chats (no-op for docs outside chats/ collection)
 *   - Full error log written to  ./migration-errors.jsonl
 *   - Full success log written to ./migration-log.jsonl
 * ============================================================================
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 0. Init
// ---------------------------------------------------------------------------

const ARGS = new Set(process.argv.slice(2));
const MODE_VALIDATE = ARGS.has('--validate');
const MODE_CLEANUP = ARGS.has('--cleanup');
const MODE_ROLLBACK = ARGS.has('--rollback');
const DRY_RUN = ARGS.has('--dry-run');

const BATCH_SIZE = 450;  // stay under Firestore 500-op limit
const CHUNK_SIZE = 50;   // rooms processed in parallel per round
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const LOG_FILE = path.resolve(__dirname, 'migration-log.jsonl');
const ERROR_FILE = path.resolve(__dirname, 'migration-errors.jsonl');

// Initialise Firebase Admin
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
        throw new Error(
            'Firebase credentials not found.\n' +
            'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
        );
    }

    return admin.firestore();
}

// ---------------------------------------------------------------------------
// 1. Logging helpers
// ---------------------------------------------------------------------------

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const errorStream = fs.createWriteStream(ERROR_FILE, { flags: 'a' });

function log(level, data) {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level, ...data });
    console.log(entry);
    logStream.write(entry + '\n');
}

function logError(data) {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', ...data });
    console.error(entry);
    errorStream.write(entry + '\n');
}

// ---------------------------------------------------------------------------
// 2. Retry wrapper
// ---------------------------------------------------------------------------

async function withRetry(label, fn) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            logError({ label, attempt, error: err.message });
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
    }
    throw lastError;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 3. Data mapping  (legacy chats schema → new rooms schema)
// ---------------------------------------------------------------------------

/**
 * Map a chats/{chatId} document to rooms/{roomId} format.
 * The structure is intentionally kept identical so the frontend can
 * switch read path with a one-line collection-name change.
 */
function mapRoomDoc(chatId, chatData) {
    return {
        // Identity
        id: chatId,
        type: chatData.type || 'room',
        name: chatData.name || null,
        description: chatData.description || '',
        photoUrl: chatData.photoUrl || '',

        // Membership  (flat copy — members subcollection written separately)
        ownerId: chatData.ownerId || chatData.createdBy || null,
        createdBy: chatData.createdBy || chatData.ownerId || null,
        members: chatData.members || [],
        memberUsernames: chatData.memberUsernames || {},
        memberRoles: chatData.memberRoles || {},
        memberMeta: chatData.memberMeta || {},

        // Join policy
        joinPolicy: chatData.joinPolicy || 'group-id',
        approvalRequired: chatData.approvalRequired != null ? chatData.approvalRequired : false,
        status: chatData.status || 'active',

        // Activity
        lastMessageText: chatData.lastMessageText || '',
        lastMessageAt: chatData.lastMessageAt || null,
        lastSenderId: chatData.lastSenderId || '',
        lastSenderName: chatData.lastSenderName || '',

        // Timestamps — preserve originals
        createdAt: chatData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

        // Migration metadata
        _migratedFromChats: true,
        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

/**
 * Map a chats/{chatId}/messages/{msgId} document to rooms/{roomId}/messages/{msgId}.
 * ALL encrypted fields are preserved verbatim — we never decrypt or re-encrypt.
 */
function mapMessageDoc(msgId, msgData) {
    return {
        // Content — encrypted, never touched
        text: msgData.text || '',
        senderEnc: msgData.senderEnc || null,
        encrypted: msgData.encrypted === true,
        cipherVersion: msgData.cipherVersion || null,

        // Identity
        uid: msgData.uid || '',
        clientId: msgData.clientId || null,   // dedupe key preserved

        // Metadata
        type: msgData.type || 'text',
        tags: Array.isArray(msgData.tags) ? msgData.tags : [],
        moderation: msgData.moderation || null,

        // Social
        reactions: msgData.reactions || {},
        deliveredTo: msgData.deliveredTo || {},
        readBy: msgData.readBy || {},

        // Timestamps — CRITICAL: preserve originals for ordering
        createdAt: msgData.createdAt || null,

        // Migration metadata
        _migratedFromChats: true,

        // Legacy field — strip plain-text sender name (privacy scrub)
        // 'sender' is intentionally omitted here
    };
}

/**
 * Build the members subcollection docs from a chats room document.
 * rooms/{roomId}/members/{uid}  →  { uid, username, role, joinedAt }
 */
function buildMemberDocs(chatData) {
    const members = chatData.members || [];
    const memberUsernames = chatData.memberUsernames || {};
    const memberRoles = chatData.memberRoles || {};
    const memberMeta = chatData.memberMeta || {};
    const ownerId = String(chatData.ownerId || chatData.createdBy || '').trim();

    return members.map((uid) => {
        const safeUid = String(uid || '').trim();
        const role = safeUid === ownerId
            ? 'owner'
            : (memberRoles[safeUid] || 'member');
        return {
            uid: safeUid,
            username: memberUsernames[safeUid] || '',
            role,
            joinedAt: memberMeta[safeUid]?.joinedAt || memberMeta[safeUid]?.lastReadAt || null,
            lastReadAt: memberMeta[safeUid]?.lastReadAt || null
        };
    }).filter((m) => m.uid);
}

// ---------------------------------------------------------------------------
// 4. Batch commit helper  (auto-flushes at BATCH_SIZE)
// ---------------------------------------------------------------------------

class BatchWriter {
    constructor(db) {
        this._db = db;
        this._batch = db.batch();
        this._pending = 0;
        this._totalWrites = 0;
    }

    set(ref, data, opts = {}) {
        if (DRY_RUN) { this._totalWrites++; return; }
        this._batch.set(ref, data, opts);
        this._pending++;
        this._totalWrites++;
    }

    async flushIfNeeded() {
        if (this._pending >= BATCH_SIZE) {
            await withRetry('batch.commit', () => this._batch.commit());
            this._batch = this._db.batch();
            this._pending = 0;
        }
    }

    async flush() {
        if (this._pending > 0) {
            await withRetry('batch.commit-final', () => this._batch.commit());
            this._batch = this._db.batch();
            this._pending = 0;
        }
    }

    get totalWrites() { return this._totalWrites; }
}

// ---------------------------------------------------------------------------
// 5. Core migration logic
// ---------------------------------------------------------------------------

/**
 * Migrate a single chat room: copy doc + members subcollection + all messages.
 * Returns { chatId, messagesCount, skipped }
 */
async function migrateSingleRoom(db, chatId, chatData) {
    const roomRef = db.collection('rooms').doc(chatId);

    // Idempotency check: if room already exists AND has messages, skip.
    const existingRoom = await roomRef.get();
    if (existingRoom.exists && existingRoom.data()?._migratedFromChats) {
        const existingMsgCount = (await roomRef.collection('messages').limit(1).get()).size;
        if (existingMsgCount > 0) {
            log('SKIP', { chatId, reason: 'already-migrated' });
            return { chatId, messagesCount: 0, skipped: true };
        }
    }

    const writer = new BatchWriter(db);

    // 5a. Write the room document
    const roomDoc = mapRoomDoc(chatId, chatData);
    writer.set(roomRef, roomDoc, { merge: true });
    await writer.flushIfNeeded();

    // 5b. Write members subcollection
    const memberDocs = buildMemberDocs(chatData);
    for (const member of memberDocs) {
        const memberRef = roomRef.collection('members').doc(member.uid);
        writer.set(memberRef, member, { merge: true });
        await writer.flushIfNeeded();
    }

    // 5c. Read all messages from old schema
    const messagesSnap = await db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .get();

    let messagesCount = 0;
    for (const msgDoc of messagesSnap.docs) {
        const newMsgRef = roomRef.collection('messages').doc(msgDoc.id);

        // Idempotency: skip if message already exists in new schema
        const existingMsg = await newMsgRef.get();
        if (existingMsg.exists) continue;

        const newMsgData = mapMessageDoc(msgDoc.id, msgDoc.data());
        writer.set(newMsgRef, newMsgData);
        messagesCount++;
        await writer.flushIfNeeded();
    }

    await writer.flush();

    log('MIGRATED', { chatId, messagesCount, memberCount: memberDocs.length });
    return { chatId, messagesCount, skipped: false };
}

/**
 * Main backfill runner — reads all chats/ docs in chunks and migrates them.
 */
async function runBackfill(db) {
    log('START', { phase: 'BACKFILL', dryRun: DRY_RUN });

    const chatsSnap = await db.collection('chats').get();
    const allChatDocs = chatsSnap.docs;

    log('INFO', { message: `Found ${allChatDocs.length} chat documents to migrate` });

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalMessages = 0;
    let failedRooms = [];

    // Process in chunks of CHUNK_SIZE to limit parallel Firestore calls
    for (let i = 0; i < allChatDocs.length; i += CHUNK_SIZE) {
        const chunk = allChatDocs.slice(i, i + CHUNK_SIZE);

        const results = await Promise.allSettled(
            chunk.map((snap) =>
                migrateSingleRoom(db, snap.id, snap.data()).catch((err) => {
                    logError({ chatId: snap.id, error: err.message, stack: err.stack });
                    failedRooms.push(snap.id);
                    return { chatId: snap.id, messagesCount: 0, skipped: false, failed: true };
                })
            )
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                const r = result.value;
                if (r.failed) failedRooms.push(r.chatId);
                else if (r.skipped) totalSkipped++;
                else {
                    totalMigrated++;
                    totalMessages += r.messagesCount;
                }
            }
        }

        log('PROGRESS', {
            processed: Math.min(i + CHUNK_SIZE, allChatDocs.length),
            total: allChatDocs.length,
            migrated: totalMigrated,
            skipped: totalSkipped,
            failed: failedRooms.length
        });
    }

    log('COMPLETE', {
        phase: 'BACKFILL',
        totalMigrated,
        totalSkipped,
        totalMessages,
        failedCount: failedRooms.length,
        failedRooms
    });

    if (failedRooms.length) {
        console.warn(`\n⚠️  ${failedRooms.length} rooms failed migration. Check ${ERROR_FILE}`);
    }

    return { totalMigrated, totalMessages, failedRooms };
}

// ---------------------------------------------------------------------------
// 6. Validation
// ---------------------------------------------------------------------------

async function runValidation(db) {
    log('START', { phase: 'VALIDATION' });

    const [chatsSnap, roomsSnap] = await Promise.all([
        db.collection('chats').get(),
        db.collection('rooms').get()
    ]);

    const oldIds = new Set(chatsSnap.docs.map((d) => d.id));
    const newIds = new Set(roomsSnap.docs.map((d) => d.id));

    const missingInNew = [...oldIds].filter((id) => !newIds.has(id));
    const extraInNew = [...newIds].filter((id) => !oldIds.has(id));

    log('ROOM_COUNT', {
        old: oldIds.size,
        new: newIds.size,
        missingInNew,
        extraInNew
    });

    let totalOldMessages = 0;
    let totalNewMessages = 0;
    const messageMismatches = [];

    // Check message counts per room (sample: first 200 rooms)
    const sampleIds = [...oldIds].slice(0, 200);
    for (const chatId of sampleIds) {
        const [oldMsgSnap, newMsgSnap] = await Promise.all([
            db.collection('chats').doc(chatId).collection('messages').get(),
            db.collection('rooms').doc(chatId).collection('messages').get()
        ]);

        const oldCount = oldMsgSnap.size;
        const newCount = newMsgSnap.size;
        totalOldMessages += oldCount;
        totalNewMessages += newCount;

        if (oldCount !== newCount) {
            messageMismatches.push({ chatId, oldCount, newCount, delta: newCount - oldCount });
        }

        // Ordering check: compare first + last message createdAt
        if (oldMsgSnap.size > 1) {
            const oldOrdered = oldMsgSnap.docs
                .map((d) => d.data().createdAt?.toMillis?.() || 0)
                .sort((a, b) => a - b);
            const newOrdered = newMsgSnap.docs
                .map((d) => d.data().createdAt?.toMillis?.() || 0)
                .sort((a, b) => a - b);

            if (oldOrdered[0] !== newOrdered[0] || oldOrdered[oldOrdered.length - 1] !== newOrdered[newOrdered.length - 1]) {
                logError({ chatId, issue: 'ordering-mismatch', oldFirst: oldOrdered[0], newFirst: newOrdered[0] });
            }
        }
    }

    // Encryption check: verify encrypted flag is preserved
    let encryptionViolations = 0;
    for (const chatId of sampleIds.slice(0, 20)) {
        const newMsgSnap = await db.collection('rooms').doc(chatId).collection('messages').limit(10).get();
        for (const msgDoc of newMsgSnap.docs) {
            const data = msgDoc.data();
            if (data.encrypted !== true) {
                encryptionViolations++;
                logError({ chatId, msgId: msgDoc.id, issue: 'encrypted-flag-missing' });
            }
        }
    }

    // clientId preservation check
    let clientIdLosses = 0;
    for (const chatId of sampleIds.slice(0, 20)) {
        const [oldMsgs, newMsgs] = await Promise.all([
            db.collection('chats').doc(chatId).collection('messages').where('clientId', '!=', null).limit(5).get(),
            db.collection('rooms').doc(chatId).collection('messages').where('clientId', '!=', null).limit(5).get()
        ]);
        if (oldMsgs.size > 0 && newMsgs.size === 0) {
            clientIdLosses++;
            logError({ chatId, issue: 'clientId-loss' });
        }
    }

    const report = {
        rooms: { old: oldIds.size, new: newIds.size, missingInNew, extraInNew },
        messages: { oldSample: totalOldMessages, newSample: totalNewMessages, mismatches: messageMismatches },
        encryption: { violations: encryptionViolations },
        clientIdPreserved: { losses: clientIdLosses },
        passed: missingInNew.length === 0 && messageMismatches.length === 0 && encryptionViolations === 0 && clientIdLosses === 0
    };

    log('VALIDATION_REPORT', report);
    console.log('\n--- VALIDATION REPORT ---');
    console.log(JSON.stringify(report, null, 2));
    return report;
}

// ---------------------------------------------------------------------------
// 7. Cleanup  (Phase 6 — only after full validation passes)
// ---------------------------------------------------------------------------

async function runCleanup(db) {
    if (!MODE_CLEANUP) return;

    console.warn('\n⚠️  CLEANUP MODE: This will DELETE the chats/ collection permanently.');
    console.warn('    Run validation first and ensure it fully passes before proceeding.');
    console.warn('    You have 10 seconds to abort (Ctrl+C)...\n');
    await sleep(10000);

    log('START', { phase: 'CLEANUP' });

    const chatsSnap = await db.collection('chats').get();
    let deletedRooms = 0;
    let deletedMessages = 0;

    for (let i = 0; i < chatsSnap.docs.length; i += CHUNK_SIZE) {
        const chunk = chatsSnap.docs.slice(i, i + CHUNK_SIZE);

        await Promise.all(chunk.map(async (chatDoc) => {
            const chatId = chatDoc.id;

            // Delete messages subcollection
            const messagesSnap = await db.collection('chats').doc(chatId).collection('messages').get();
            let batch = db.batch();
            let pending = 0;

            for (const msgDoc of messagesSnap.docs) {
                batch.delete(msgDoc.ref);
                pending++;
                deletedMessages++;
                if (pending >= BATCH_SIZE) {
                    await withRetry(`delete-messages-${chatId}`, () => batch.commit());
                    batch = db.batch();
                    pending = 0;
                }
            }
            if (pending > 0) {
                await withRetry(`delete-messages-final-${chatId}`, () => batch.commit());
            }

            // Delete the room doc itself
            await withRetry(`delete-room-${chatId}`, () => chatDoc.ref.delete());
            deletedRooms++;
        }));
    }

    log('COMPLETE', { phase: 'CLEANUP', deletedRooms, deletedMessages });
}

// ---------------------------------------------------------------------------
// 8. Rollback  (remove rooms/ docs only — chats/ untouched)
// ---------------------------------------------------------------------------

async function runRollback(db) {
    log('START', { phase: 'ROLLBACK' });

    const roomsSnap = await db.collection('rooms').get();
    let deletedRooms = 0;
    let deletedMessages = 0;

    for (const roomDoc of roomsSnap.docs) {
        // Only roll back docs we created during migration
        if (!roomDoc.data()?._migratedFromChats) {
            log('SKIP', { roomId: roomDoc.id, reason: 'not-migrated-by-script' });
            continue;
        }

        const msgsSnap = await db.collection('rooms').doc(roomDoc.id).collection('messages').get();
        let batch = db.batch();
        let pending = 0;

        for (const msgDoc of msgsSnap.docs) {
            batch.delete(msgDoc.ref);
            pending++;
            deletedMessages++;
            if (pending >= BATCH_SIZE) {
                await withRetry('rollback-batch', () => batch.commit());
                batch = db.batch();
                pending = 0;
            }
        }
        if (pending > 0) {
            await withRetry('rollback-batch-final', () => batch.commit());
        }

        await withRetry(`rollback-room-${roomDoc.id}`, () => roomDoc.ref.delete());
        deletedRooms++;
    }

    log('COMPLETE', { phase: 'ROLLBACK', deletedRooms, deletedMessages });
}

// ---------------------------------------------------------------------------
// 9. Entry point
// ---------------------------------------------------------------------------

async function main() {
    const db = initFirebase();

    try {
        if (MODE_ROLLBACK) {
            await runRollback(db);
        } else if (MODE_VALIDATE) {
            await runValidation(db);
        } else if (MODE_CLEANUP) {
            // Require validation to pass first
            const report = await runValidation(db);
            if (!report.passed) {
                console.error('\n❌ Validation failed. Aborting cleanup. Fix errors and re-run.');
                process.exit(1);
            }
            await runCleanup(db);
        } else {
            // Default: backfill
            await runBackfill(db);
        }
    } catch (err) {
        logError({ fatal: true, error: err.message, stack: err.stack });
        process.exit(1);
    } finally {
        logStream.end();
        errorStream.end();
        process.exit(0);
    }
}

main();
