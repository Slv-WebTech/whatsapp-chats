/**
 * userService.js
 * Firestore operations for user profiles, chat lists, and chat documents.
 * All reads/writes require firebase auth (enforced in Firestore rules).
 */
import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from './config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDb() {
    if (!db) throw new Error('Firestore is not configured.');
}

/**
 * Deterministic 1:1 chat ID from two UIDs.
 * Sorting guarantees uidA_uidB === uidB_uidA.
 */
export function buildDirectChatId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

// ---------------------------------------------------------------------------
// User profiles   (collection: users/{uid})
// ---------------------------------------------------------------------------
export async function createUserProfile(uid, username) {
    ensureDb();
    await setDoc(doc(db, 'users', uid), {
        username,
        usernameLower: username.toLowerCase(),
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    });
}

export async function getUserProfile(uid) {
    ensureDb();
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function updateLastSeen(uid) {
    ensureDb();
    try {
        await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() });
    } catch {
        // Non-critical ΓÇö do not block UI
    }
}

/** Search users by username prefix (case-insensitive via lower-case index field). */
export async function searchUsers(queryText, limitCount = 10) {
    ensureDb();
    const lower = queryText.trim().toLowerCase();
    if (!lower) return [];

    const q = query(
        collection(db, 'users'),
        where('usernameLower', '>=', lower),
        where('usernameLower', '<=', lower + '\uf8ff'),
        orderBy('usernameLower'),
        limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------------
// User chat list   (collection: user_chats/{uid})
// ---------------------------------------------------------------------------
export async function initUserChats(uid) {
    ensureDb();
    await setDoc(doc(db, 'user_chats', uid), { chatIds: [] }, { merge: true });
}

export async function getUserChatIds(uid) {
    ensureDb();
    const snap = await getDoc(doc(db, 'user_chats', uid));
    return snap.exists() ? (snap.data().chatIds || []) : [];
}

/** Subscribe to live updates of a user's chat-id list. */
export function subscribeUserChatIds(uid, onChange) {
    ensureDb();
    return onSnapshot(doc(db, 'user_chats', uid), (snap) => {
        onChange(snap.exists() ? (snap.data().chatIds || []) : []);
    });
}

// ---------------------------------------------------------------------------
// Chats   (collection: chats/{chatId})
// ---------------------------------------------------------------------------

/**
 * Create OR join a 1:1 chat between two users.
 * Idempotent ΓÇö safe to call even if chat already exists.
 */
export async function getOrCreateDirectChat(uidA, usernameA, uidB, usernameB) {
    ensureDb();
    const chatId = buildDirectChatId(uidA, uidB);
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);

    if (!snap.exists()) {
        const batch = writeBatch(db);
        batch.set(chatRef, {
            type: '1:1',
            members: [uidA, uidB],
            memberNames: { [uidA]: usernameA, [uidB]: usernameB },
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
            lastMessagePreview: ''
        });
        // Add chatId to both users' lists
        batch.set(
            doc(db, 'user_chats', uidA),
            { chatIds: arrayUnion(chatId) },
            { merge: true }
        );
        batch.set(
            doc(db, 'user_chats', uidB),
            { chatIds: arrayUnion(chatId) },
            { merge: true }
        );
        await batch.commit();
    } else {
        // Ensure both members have it in their sidebar lists (idempotent)
        const batch = writeBatch(db);
        batch.set(
            doc(db, 'user_chats', uidA),
            { chatIds: arrayUnion(chatId) },
            { merge: true }
        );
        batch.set(
            doc(db, 'user_chats', uidB),
            { chatIds: arrayUnion(chatId) },
            { merge: true }
        );
        await batch.commit();
    }

    return chatId;
}

/**
 * Join a group chat by its hashed chatId (hash = SHA-256(secret)).
 * If the chat document doesn't exist yet, creates it as a new group.
 */
export async function joinGroupChat(uid, username, chatId, groupName) {
    ensureDb();
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);

    const batch = writeBatch(db);

    if (!snap.exists()) {
        // Create the group chat document
        batch.set(chatRef, {
            type: 'group',
            name: groupName || 'Group Chat',
            members: [uid],
            memberNames: { [uid]: username },
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
            lastMessagePreview: ''
        });
    } else {
        // Join existing group
        const data = snap.data();
        if (!(data.members || []).includes(uid)) {
            batch.update(chatRef, {
                members: arrayUnion(uid),
                [`memberNames.${uid}`]: username
            });
        }
    }

    // Add to user's sidebar
    batch.set(
        doc(db, 'user_chats', uid),
        { chatIds: arrayUnion(chatId) },
        { merge: true }
    );

    await batch.commit();
    return chatId;
}

/** Load full chat documents for a list of chatIds. */
export async function getChatsByIds(chatIds) {
    ensureDb();
    if (!chatIds.length) return [];
    // Firestore 'in' supports max 30 items; batch if needed
    const chunks = [];
    for (let i = 0; i < chatIds.length; i += 30) {
        chunks.push(chatIds.slice(i, i + 30));
    }
    const results = [];
    for (const chunk of chunks) {
        const q = query(
            collection(db, 'chats'),
            where('__name__', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) => results.push({ chatId: d.id, ...d.data() }));
    }
    return results;
}

/** Update the last-message preview on a chat document (called after send). */
export async function updateChatLastMessage(chatId, preview) {
    ensureDb();
    try {
        await updateDoc(doc(db, 'chats', chatId), {
            lastMessagePreview: preview,
            lastMessageAt: serverTimestamp()
        });
    } catch {
        // Non-critical
    }
}

// ---------------------------------------------------------------------------
// Admin stats   (collection: admin_stats/global)
// ---------------------------------------------------------------------------

/** Subscribe to the admin stats doc (admin-only reads enforced in rules). */
export function subscribeAdminStats(onChange) {
    ensureDb();
    return onSnapshot(doc(db, 'admin_stats', 'global'), (snap) => {
        onChange(snap.exists() ? snap.data() : null);
    });
}

/** Subscribe to all users (admin only). */
export function subscribeAllUsers(onChange) {
    ensureDb();
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
        onChange(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    });
}

/** Subscribe to all group chats (admin only). */
export function subscribeGroupChats(onChange) {
    ensureDb();
    const q = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        orderBy('createdAt', 'desc'),
        limit(100)
    );
    return onSnapshot(q, (snap) => {
        onChange(snap.docs.map((d) => ({ chatId: d.id, ...d.data() })));
    });
}

/**
 * Increment admin stats counters.
 * Called client-side on user registration and chat creation.
 * Uses merge so it never overwrites existing fields.
 */
export async function bumpAdminStat(field) {
    ensureDb();
    try {
        const ref = doc(db, 'admin_stats', 'global');
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, {
                totalUsers: 0,
                totalChats: 0,
                activeGroups: [],
                activeUsers24h: [],
                updatedAt: serverTimestamp(),
                [field]: 1
            });
        } else {
            const current = snap.data()[field] || 0;
            await updateDoc(ref, {
                [field]: current + 1,
                updatedAt: serverTimestamp()
            });
        }
    } catch {
        // Non-critical counter update
    }
}