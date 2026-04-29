/**
 * normalize-group-approval.cjs
 * ---------------------------------------------------------------------------
 * One-time Firestore migration to enforce approval-only joins for legacy groups.
 *
 * What it normalizes on chats/{chatId} where type == 'group':
 * - approvalRequired: true
 * - requireJoinApproval: true
 * - joinApproval: 'admin'
 * - joinPolicy: 'group-id' (if missing)
 * - ownerId fallback from createdBy (if ownerId missing)
 * - memberRoles.{ownerId}: 'owner' (ensures owner rights in UI/rules)
 *
 * Usage:
 *   node scripts/normalize-group-approval.cjs --dry-run
 *   node scripts/normalize-group-approval.cjs
 *
 * Credentials:
 * - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   OR
 * - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

'use strict';

// Load .env / .env.local so credentials are available when running locally
// Use override:true on .env so the real Admin SDK credentials always win over
// empty Vercel env-pull artifacts in .env.local
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true }); } catch (_) {}

const admin = require('firebase-admin');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PAGE_SIZE = 300;
const BATCH_LIMIT = 450;

function initFirebase() {
    if (admin.apps.length) {
        return admin.firestore();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const credsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credsFile) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey })
        });
    } else {
        throw new Error(
            'Missing Firebase credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
        );
    }

    return admin.firestore();
}

function needsNormalization(data) {
    const approvalRequired = data?.approvalRequired === true;
    const requireJoinApproval = data?.requireJoinApproval === true;
    const joinApproval = String(data?.joinApproval || '').toLowerCase() === 'admin';
    const joinPolicy = String(data?.joinPolicy || '').trim();
    const ownerId = String(data?.ownerId || '').trim();
    const createdBy = String(data?.createdBy || '').trim();
    const resolvedOwnerId = ownerId || createdBy;
    const memberRoles = data?.memberRoles && typeof data.memberRoles === 'object' ? data.memberRoles : {};
    const ownerRole = resolvedOwnerId ? String(memberRoles[resolvedOwnerId] || '').toLowerCase() : '';

    if (!approvalRequired || !requireJoinApproval || !joinApproval) {
        return true;
    }

    if (!joinPolicy || joinPolicy !== 'group-id') {
        return true;
    }

    if (!ownerId && createdBy) {
        return true;
    }

    if (resolvedOwnerId && ownerRole !== 'owner') {
        return true;
    }

    return false;
}

function buildPatch(data) {
    const createdBy = String(data?.createdBy || '').trim();
    const ownerId = String(data?.ownerId || '').trim();
    const resolvedOwnerId = ownerId || createdBy;

    const patch = {
        approvalRequired: true,
        requireJoinApproval: true,
        joinApproval: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!String(data?.joinPolicy || '').trim()) {
        patch.joinPolicy = 'group-id';
    }

    if (!ownerId && createdBy) {
        patch.ownerId = createdBy;
    }

    if (resolvedOwnerId) {
        patch[`memberRoles.${resolvedOwnerId}`] = 'owner';
    }

    return patch;
}

async function flushBatch(batch, pendingWrites) {
    if (!pendingWrites) {
        return { batch: null, pendingWrites: 0 };
    }

    if (!DRY_RUN) {
        await batch.commit();
    }

    return { batch: null, pendingWrites: 0 };
}

async function run() {
    const db = initFirebase();

    let totalGroups = 0;
    let scanned = 0;
    let normalized = 0;
    let cursor = null;

    let batch = db.batch();
    let pendingWrites = 0;

    console.log(`[normalize-group-approval] mode=${DRY_RUN ? 'dry-run' : 'apply'}`);

    while (true) {
        let q = db
            .collection('chats')
            .where('type', '==', 'group')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);

        if (cursor) {
            q = q.startAfter(cursor);
        }

        const snap = await q.get();
        if (snap.empty) {
            break;
        }

        totalGroups += snap.size;

        for (const doc of snap.docs) {
            scanned += 1;
            const data = doc.data() || {};
            if (!needsNormalization(data)) {
                continue;
            }

            const patch = buildPatch(data);
            normalized += 1;

            if (!DRY_RUN) {
                batch.set(doc.ref, patch, { merge: true });
                pendingWrites += 1;
                if (pendingWrites >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    pendingWrites = 0;
                }
            }
        }

        cursor = snap.docs[snap.docs.length - 1];
    }

    if (!DRY_RUN && pendingWrites > 0) {
        await batch.commit();
    }

    console.log('[normalize-group-approval] complete');
    console.log(`  scanned groups: ${scanned}`);
    console.log(`  groups requiring normalization: ${normalized}`);
    if (DRY_RUN) {
        console.log('  dry-run: no writes committed');
    }
}

run().catch((error) => {
    console.error('[normalize-group-approval] failed:', error?.message || error);
    process.exitCode = 1;
});
