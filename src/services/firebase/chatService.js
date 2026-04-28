import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    serverTimestamp,
    startAfter,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from './config';

const MESSAGE_LIMIT = 500;
const MESSAGE_PAGE_SIZE = 50;

function ensureDb() {
    if (!db) {
        throw new Error('Firebase is not configured. Add VITE_FIREBASE_* variables.');
    }
}

function resolveChatOptions(roomId, options = {}) {
    const collectionName = 'chats';
    const presenceCollectionName = options.presenceCollectionName || 'presence';
    const sanitizeChatId = options.sanitizeChatId === true;
    const safeChatId = sanitizeChatId ? sanitizeRoomId(roomId) : String(roomId || '').trim();

    return {
        collectionName,
        presenceCollectionName,
        safeChatId
    };
}

export function sanitizeRoomId(rawRoomId) {
    const safe = String(rawRoomId || 'room1')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-');

    return safe || 'room1';
}

/**
 * Ensures the /chats/{chatId} document exists with the current user as a member.
 * Called on chat load to recover from cases where the user deleted Firestore data
 * for a fresh start. The Firestore rules allow create when the user is authenticated
 * and includes themselves in the members list.
 */
export async function ensureChatDocument(chatId, authUid, extraMembers = []) {
    ensureDb();
    const safeChatId = String(chatId || '').trim();
    const safeUid = String(authUid || '').trim();
    if (!safeChatId || !safeUid) {
        return;
    }

    const inferredMembers = safeChatId.includes('_')
        ? safeChatId
            .split('_')
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        : [];
    const members = Array.from(new Set([safeUid, ...inferredMembers, ...extraMembers.map((u) => String(u).trim()).filter(Boolean)]));
    const inferredType = safeChatId.includes('_') ? '1:1' : safeChatId.startsWith('shared-') ? 'shared' : 'group';

    const chatRef = doc(db, 'chats', safeChatId);
    const snap = await getDoc(chatRef);

    if (!snap.exists()) {
        await setDoc(
            chatRef,
            {
                members,
                type: inferredType,
                name: inferredType === 'group' ? `Group ${safeChatId.slice(0, 8).toUpperCase()}` : null,
                memberUsernames: {},
                memberMeta: {
                    [safeUid]: { lastReadAt: serverTimestamp() }
                },
                lastMessageText: '',
                lastMessageAt: null,
                lastSenderId: '',
                lastSenderName: '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
        return;
    }

    const existing = Array.isArray(snap.data()?.members) ? snap.data().members : [];
    if (!existing.includes(safeUid)) {
        await updateDoc(chatRef, {
            members: arrayUnion(safeUid),
            updatedAt: serverTimestamp(),
            [`memberMeta.${safeUid}.lastReadAt`]: serverTimestamp()
        });
    }
}

function roomMessagesRef(roomId, options) {
    const { collectionName, safeChatId } = resolveChatOptions(roomId, options);
    return collection(db, collectionName, safeChatId, 'messages');
}

function roomTypingRef(roomId, options) {
    const { collectionName, safeChatId } = resolveChatOptions(roomId, options);
    return collection(db, collectionName, safeChatId, 'typing');
}

function roomUsersRef(roomId, options) {
    const { collectionName, presenceCollectionName, safeChatId } = resolveChatOptions(roomId, options);
    return collection(db, collectionName, safeChatId, presenceCollectionName);
}

async function deleteSnapshotDocs(snapshot) {
    if (!snapshot?.docs?.length) {
        return 0;
    }

    let batch = writeBatch(db);
    let pendingWrites = 0;
    let deletedCount = 0;

    for (const entry of snapshot.docs) {
        batch.delete(entry.ref);
        pendingWrites += 1;
        deletedCount += 1;

        if (pendingWrites >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            pendingWrites = 0;
        }
    }

    if (pendingWrites > 0) {
        await batch.commit();
    }

    return deletedCount;
}

async function deleteRefsInParallel(docRefs, chunkSize = 200) {
    let deletedCount = 0;

    for (let startIndex = 0; startIndex < docRefs.length; startIndex += chunkSize) {
        const currentChunk = docRefs.slice(startIndex, startIndex + chunkSize);
        await Promise.all(currentChunk.map((ref) => deleteDoc(ref)));
        deletedCount += currentChunk.length;
    }

    return deletedCount;
}

export function subscribeToRoomMessages(roomId, onNext, onError, options) {
    ensureDb();
    const q = query(roomMessagesRef(roomId, options), orderBy('createdAt', 'desc'), limit(MESSAGE_LIMIT));

    return onSnapshot(
        q,
        (snapshot) => {
            const messages = snapshot.docs
                .map((entry) => ({ id: entry.id, ...entry.data() }))
                .sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return aTime - bTime;
                });

            const oldestCursor = snapshot.docs[snapshot.docs.length - 1] || null;
            onNext(messages, {
                oldestCursor,
                hasMore: snapshot.size >= MESSAGE_LIMIT
            });
        },
        onError
    );
}

export async function fetchOlderRoomMessages(roomId, cursor, pageSize = MESSAGE_PAGE_SIZE, options) {
    ensureDb();

    if (!cursor) {
        return {
            messages: [],
            oldestCursor: null,
            hasMore: false
        };
    }

    const q = query(
        roomMessagesRef(roomId, options),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize)
    );

    const snapshot = await getDocs(q);
    const messages = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return aTime - bTime;
        });

    return {
        messages,
        oldestCursor: snapshot.docs[snapshot.docs.length - 1] || cursor,
        hasMore: snapshot.size >= pageSize
    };
}

export async function clearRoomMessages(roomId, options) {
    ensureDb();

    const messagesSnapshot = await getDocs(roomMessagesRef(roomId, options));
    const messageRefs = messagesSnapshot.docs.map((entry) => entry.ref);

    if (!messageRefs.length) {
        return 0;
    }

    return deleteRefsInParallel(messageRefs);
}

export async function sendRoomMessage(roomId, payload, options) {
    ensureDb();
    const { collectionName, safeChatId } = resolveChatOptions(roomId, options);

    const safeText = String(payload?.text || '').trim();
    const safeUid = String(payload?.uid || '').trim();
    const safeSenderEncrypted = String(payload?.senderEnc || '').trim();
    const safeClientId = String(payload?.clientId || '').trim();
    const safeType = payload?.type || 'text';
    const isEncrypted = Boolean(payload?.encrypted);

    if (!safeUid) {
        throw new Error('Authenticated uid is required.');
    }

    if (!safeText) {
        throw new Error('Message cannot be empty.');
    }

    if (safeText.length > 1200) {
        throw new Error('Message is too long (max 1200 chars).');
    }

    if (!isEncrypted) {
        throw new Error('Plain text messages are blocked. Encrypt before sending.');
    }

    const messageRef = doc(roomMessagesRef(roomId, options));
    const batch = writeBatch(db);
    batch.set(messageRef, {
        text: safeText,
        sender: String(payload?.sender || '').trim() || null,
        senderEnc: safeSenderEncrypted || null,
        uid: safeUid,
        type: safeType,
        clientId: safeClientId || null,
        tags: Array.isArray(payload?.tags) ? payload.tags.slice(0, 8) : [],
        moderation: payload?.moderation && typeof payload.moderation === 'object' ? payload.moderation : null,
        reactions: {},
        encrypted: true,
        cipherVersion: payload?.cipherVersion || null,
        deliveredTo: {
            [safeUid]: true
        },
        readBy: {
            [safeUid]: true
        },
        createdAt: serverTimestamp()
    });

    if (collectionName === 'chats') {
        batch.set(
            doc(db, collectionName, safeChatId),
            {
                updatedAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                lastMessageText: safeType === 'text' ? safeText.slice(0, 140) : `[${safeType}]`,
                lastSenderId: safeUid,
                lastSenderName: String(payload?.sender || '').trim() || ''
            },
            { merge: true }
        );
    }

    await batch.commit();
}

export function subscribeTypingStatus(roomId, onNext, onError, options) {
    ensureDb();
    return onSnapshot(
        roomTypingRef(roomId, options),
        (snapshot) => {
            const typingMap = {};
            snapshot.forEach((entry) => {
                const data = entry.data() || {};
                typingMap[entry.id] = {
                    isTyping: Boolean(data.isTyping),
                    encryptedDisplayName: String(data.encryptedDisplayName || ''),
                    updatedAt: data.updatedAt || null
                };
            });
            onNext(typingMap);
        },
        onError
    );
}

export async function setTypingStatus(roomId, userId, isTyping, encryptedDisplayName = '', options) {
    ensureDb();
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
        return;
    }

    await setDoc(
        doc(roomTypingRef(roomId, options), safeUserId),
        {
            isTyping: Boolean(isTyping),
            encryptedDisplayName: String(encryptedDisplayName || ''),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
}

export function subscribeRoomUsers(roomId, onNext, onError, options) {
    ensureDb();
    return onSnapshot(
        roomUsersRef(roomId, options),
        (snapshot) => {
            const usersMap = {};
            snapshot.forEach((entry) => {
                const data = entry.data() || {};
                usersMap[entry.id] = {
                    online: Boolean(data.online),
                    encryptedDisplayName: String(data.encryptedDisplayName || ''),
                    lastSeen: data.lastSeen || null
                };
            });
            onNext(usersMap);
        },
        onError
    );
}

export async function setRoomUserPresence(roomId, userId, online, encryptedDisplayName = '', options) {
    ensureDb();
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
        return;
    }

    await setDoc(
        doc(roomUsersRef(roomId, options), safeUserId),
        {
            online: Boolean(online),
            encryptedDisplayName: String(encryptedDisplayName || ''),
            lastSeen: serverTimestamp()
        },
        { merge: true }
    );
}

export async function scrubLegacyRoomMetadata(roomId) {
    ensureDb();

    const { collectionName, presenceCollectionName, safeChatId } = resolveChatOptions(roomId);
    const scopedOptions = { collectionName, presenceCollectionName, sanitizeChatId: false };
    const messagesSnapshot = await getDocs(roomMessagesRef(safeChatId, scopedOptions));
    const usersSnapshot = await getDocs(roomUsersRef(safeChatId, scopedOptions));
    const typingSnapshot = await getDocs(roomTypingRef(safeChatId, scopedOptions));
    let batch = writeBatch(db);
    let pendingWrites = 0;
    let mutationCount = 0;

    const commitIfNeeded = async (force = false) => {
        if (!pendingWrites) {
            return;
        }

        if (pendingWrites >= 450 || force) {
            await batch.commit();
            batch = writeBatch(db);
            pendingWrites = 0;
        }
    };

    for (const entry of messagesSnapshot.docs) {
        const data = entry.data() || {};
        if ('sender' in data) {
            batch.update(doc(db, collectionName, safeChatId, 'messages', entry.id), {
                sender: deleteField()
            });
            mutationCount += 1;
            pendingWrites += 1;
            await commitIfNeeded();
        }
    }

    usersSnapshot.forEach((entry) => {
        const data = entry.data() || {};
        if ('name' in data || 'displayName' in data) {
            batch.update(doc(db, collectionName, safeChatId, presenceCollectionName, entry.id), {
                name: deleteField(),
                displayName: deleteField()
            });
            mutationCount += 1;
            pendingWrites += 1;
        }
    });

    typingSnapshot.forEach((entry) => {
        const data = entry.data() || {};
        if ('displayName' in data) {
            batch.update(doc(db, collectionName, safeChatId, 'typing', entry.id), {
                displayName: deleteField()
            });
            mutationCount += 1;
            pendingWrites += 1;
        }
    });

    if (!mutationCount) {
        return 0;
    }

    await commitIfNeeded(true);
    return mutationCount;
}

export async function hardDeleteRoomData(roomId, options) {
    ensureDb();

    const { collectionName, safeChatId } = resolveChatOptions(roomId, options);
    const [messagesSnapshot, typingSnapshot, usersSnapshot] = await Promise.all([
        getDocs(roomMessagesRef(safeChatId, { ...options, sanitizeChatId: false, collectionName })),
        getDocs(roomTypingRef(safeChatId, { ...options, sanitizeChatId: false, collectionName })),
        getDocs(roomUsersRef(safeChatId, { ...options, sanitizeChatId: false, collectionName }))
    ]);

    let deletedCount = 0;
    deletedCount += await deleteSnapshotDocs(messagesSnapshot);
    deletedCount += await deleteSnapshotDocs(typingSnapshot);
    deletedCount += await deleteSnapshotDocs(usersSnapshot);

    await deleteDoc(doc(db, collectionName, safeChatId)).catch(() => {
        // Parent room doc may not exist; data removal still succeeds.
    });

    return deletedCount;
}

export async function addMessageReaction(roomId, messageId, emoji, options) {
    ensureDb();
    const safeMessageId = String(messageId || '').trim();
    const safeEmoji = String(emoji || '').trim();
    const safeUserId = String(options?.userId || '').trim();

    if (!safeMessageId || !safeEmoji) {
        return;
    }

    const messageRef = doc(roomMessagesRef(roomId, options), safeMessageId);
    const reactionKey = `reactions.${safeEmoji}`;

    if (safeUserId) {
        const snapshot = await getDoc(messageRef);
        const existing = snapshot.data()?.reactions?.[safeEmoji];

        if (Array.isArray(existing)) {
            const hasReacted = existing.includes(safeUserId);
            await updateDoc(messageRef, {
                [reactionKey]: hasReacted ? arrayRemove(safeUserId) : arrayUnion(safeUserId)
            });
            return;
        }

        await updateDoc(messageRef, {
            [reactionKey]: arrayUnion(safeUserId)
        });
        return;
    }

    await updateDoc(messageRef, {
        [reactionKey]: increment(1)
    });
}

export async function pinRoomMessage(roomId, messageId, options = {}) {
    ensureDb();
    const safeMessageId = String(messageId || '').trim();
    const safeUserId = String(options?.userId || options?.uid || '').trim();
    if (!safeMessageId || !safeUserId) {
        return;
    }

    const messageRef = doc(roomMessagesRef(roomId, options), safeMessageId);
    const snapshot = await getDoc(messageRef);
    const existing = snapshot.data()?.pinnedBy;
    const hasPinned = Array.isArray(existing) && existing.includes(safeUserId);

    await updateDoc(messageRef, {
        pinnedBy: hasPinned ? arrayRemove(safeUserId) : arrayUnion(safeUserId),
        pinnedAt: serverTimestamp()
    });
}

export async function bookmarkRoomMessage(roomId, messageId, options = {}) {
    ensureDb();
    const safeMessageId = String(messageId || '').trim();
    const safeUserId = String(options?.userId || options?.uid || '').trim();
    if (!safeMessageId || !safeUserId) {
        return;
    }

    const messageRef = doc(roomMessagesRef(roomId, options), safeMessageId);
    const snapshot = await getDoc(messageRef);
    const existing = snapshot.data()?.bookmarkedBy;
    const hasBookmarked = Array.isArray(existing) && existing.includes(safeUserId);

    await updateDoc(messageRef, {
        bookmarkedBy: hasBookmarked ? arrayRemove(safeUserId) : arrayUnion(safeUserId),
        bookmarkedAt: serverTimestamp()
    });
}

export async function deleteRoomMessage(roomId, messageId, options) {
    ensureDb();

    const safeMessageId = String(messageId || '').trim();
    if (!safeMessageId) {
        return;
    }

    const messageRef = doc(roomMessagesRef(roomId, options), safeMessageId);
    await updateDoc(messageRef, {
        text: 'This message was deleted',
        encrypted: false,
        type: 'system',
        deletedForEveryone: true,
        deletedAt: serverTimestamp()
    });
}

export async function hideRoomMessageForUser(roomId, messageId, userId, options) {
    ensureDb();

    const safeMessageId = String(messageId || '').trim();
    const safeUserId = String(userId || '').trim();
    if (!safeMessageId || !safeUserId) {
        return;
    }

    await updateDoc(doc(roomMessagesRef(roomId, options), safeMessageId), {
        [`deletedFor.${safeUserId}`]: true,
        updatedAt: serverTimestamp()
    });
}

export async function markMessageDelivered(roomId, messageId, userId, options) {
    ensureDb();

    const safeMessageId = String(messageId || '').trim();
    const safeUserId = String(userId || '').trim();
    if (!safeMessageId || !safeUserId) {
        return;
    }

    await updateDoc(doc(roomMessagesRef(roomId, options), safeMessageId), {
        [`deliveredTo.${safeUserId}`]: true,
        deliveredAt: serverTimestamp()
    });
}

export async function markMessageRead(roomId, messageId, userId, options) {
    ensureDb();

    const safeMessageId = String(messageId || '').trim();
    const safeUserId = String(userId || '').trim();
    if (!safeMessageId || !safeUserId) {
        return;
    }

    await updateDoc(doc(roomMessagesRef(roomId, options), safeMessageId), {
        [`readBy.${safeUserId}`]: true,
        readAt: serverTimestamp()
    });
}
