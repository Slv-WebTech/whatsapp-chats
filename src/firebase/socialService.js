import {
    arrayRemove,
    arrayUnion,
    doc,
    documentId,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    collection
} from 'firebase/firestore';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { auth, db } from './config';
import { BRAND_EMAIL_DOMAIN } from '../config/brandTokens';

const USERNAME_PATTERN = /^[A-Z][A-Za-z0-9_]{2,19}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_UID_ALLOWLIST = new Set(['djK91MD4FiTQIqxD392Tz8WZqnB2']);
const ADMIN_EMAIL_ALLOWLIST = new Set(['admin@slv-webtech.com']);
const READ_STATE_WRITE_THROTTLE_MS = 60000;
const lastReadStateWriteAt = new Map();

function isFirestoreTimestamp(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.toMillis === 'function';
}

function toSerializable(value) {
    if (isFirestoreTimestamp(value)) {
        return value.toMillis();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((entry) => toSerializable(entry));
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, entry]) => {
            acc[key] = toSerializable(entry);
            return acc;
        }, {});
    }

    return value;
}

function ensureFirebase() {
    if (!auth || !db) {
        throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values.');
    }
}

export function normalizeUsername(value) {
    const safeValue = String(value || '')
        .trim()
        .replace(/[^A-Za-z0-9_]/g, '');

    if (!safeValue) {
        return '';
    }

    return `${safeValue.charAt(0).toUpperCase()}${safeValue.slice(1)}`;
}

export function normalizeUsernameKey(value) {
    return normalizeUsername(value).toLowerCase();
}

export function usernameToEmail(username) {
    return `${normalizeUsernameKey(username)}@${BRAND_EMAIL_DOMAIN}`;
}

function validateCredentials(email, password) {
    const safeEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '');

    if (!EMAIL_PATTERN.test(safeEmail)) {
        throw new Error('Please enter a valid email address.');
    }

    if (safePassword.length < 6) {
        throw new Error('Password must be at least 6 characters.');
    }

    return { safeEmail, safePassword };
}

function usersRef() {
    return collection(db, 'users');
}

function chatsRef() {
    return collection(db, 'chats');
}

function userChatsDoc(userId) {
    return doc(db, 'user_chats', String(userId || ''));
}

function userDoc(userId) {
    return doc(db, 'users', String(userId || ''));
}

function chatDoc(chatId) {
    return doc(db, 'chats', String(chatId || ''));
}

function adminStatsDoc() {
    return doc(db, 'admin_stats', 'global');
}

function getResolvedChatType(chatId) {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
        return 'room';
    }

    if (safeChatId.includes('_')) {
        return '1:1';
    }

    if (safeChatId.startsWith('shared-')) {
        return 'shared';
    }

    return 'room';
}

export function getDirectChatId(uidA, uidB) {
    return [String(uidA || '').trim(), String(uidB || '').trim()].filter(Boolean).sort().join('_');
}

export function getDirectChatSecret(chatId) {
    return `dm:${String(chatId || '').trim()}`;
}

async function sha256Hex(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((entry) => entry.toString(16).padStart(2, '0')).join('');
}

export async function getGroupChatId(secret) {
    const safeSecret = String(secret || '').trim();
    if (!safeSecret) {
        return '';
    }

    return sha256Hex(safeSecret);
}

export async function loadUserProfile(uid) {
    ensureFirebase();
    if (!uid) {
        return null;
    }

    const snapshot = await getDoc(userDoc(uid));
    if (!snapshot.exists()) {
        return null;
    }

    return toSerializable({ uid: snapshot.id, ...snapshot.data() });
}

export function subscribeAuthUser(callback) {
    ensureFirebase();
    return onAuthStateChanged(auth, callback);
}

async function ensureUserRecords(user) {
    const profileRef = userDoc(user.uid);
    const profileSnapshot = await getDoc(profileRef);
    const batch = writeBatch(db);
    const safeEmail = String(user.email || '').trim().toLowerCase();
    const existingUsername = profileSnapshot.data()?.username;
    // Auto-capitalize existing usernames that were saved before the uppercase-first rule
    const rawUsername = existingUsername
        ? normalizeUsername(existingUsername)
        : normalizeUsername(safeEmail.split('@')[0] || 'user');
    const safeUsername = USERNAME_PATTERN.test(rawUsername) ? rawUsername : 'User';
    const usernameKey = normalizeUsernameKey(safeUsername);
    const previousRole = profileSnapshot.data()?.role;
    const isConfiguredAdmin = ADMIN_UID_ALLOWLIST.has(String(user.uid || '').trim()) || ADMIN_EMAIL_ALLOWLIST.has(safeEmail);
    const resolvedRole = previousRole === 'admin' || isConfiguredAdmin ? 'admin' : 'user';

    batch.set(
        profileRef,
        {
            username: safeUsername,
            usernameKey,
            email: safeEmail,
            role: resolvedRole,
            createdAt: profileSnapshot.data()?.createdAt || serverTimestamp(),
            lastSeenAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    batch.set(
        userChatsDoc(user.uid),
        {
            chatIds: [],
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    await batch.commit();
    await touchAdminStats({ uid: user.uid });
    return loadUserProfile(user.uid);
}

export async function registerWithUsernamePassword({ email, password }) {
    ensureFirebase();
    const { safeEmail, safePassword } = validateCredentials(email, password);

    const credential = await createUserWithEmailAndPassword(auth, safeEmail, safePassword);
    const profile = await ensureUserRecords(credential.user);

    return {
        user: { uid: credential.user.uid, email: credential.user.email || '' },
        profile
    };
}

export async function loginWithUsernamePassword({ email, password }) {
    ensureFirebase();
    const { safeEmail, safePassword } = validateCredentials(email, password);
    const credential = await signInWithEmailAndPassword(auth, safeEmail, safePassword);
    const profile = await ensureUserRecords(credential.user);

    return {
        user: { uid: credential.user.uid, email: credential.user.email || '' },
        profile
    };
}

export async function updateUserProfile(updates) {
    ensureFirebase();
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No user is currently logged in.');
    }

    const updates_data = {};
    if (updates.username) {
        const safeUsername = normalizeUsername(updates.username);
        if (!USERNAME_PATTERN.test(safeUsername)) {
            throw new Error('Username must be 3-20 chars, start with a capital letter, and use letters, numbers, or underscore.');
        }
        updates_data.username = safeUsername;
        updates_data.usernameKey = normalizeUsernameKey(safeUsername);
    }

    if (Object.keys(updates_data).length === 0) {
        throw new Error('No valid updates provided.');
    }

    updates_data.updatedAt = serverTimestamp();
    await updateDoc(userDoc(user.uid), updates_data);
    return loadUserProfile(user.uid);
}

export async function signOutCurrentUser() {
    ensureFirebase();
    await signOut(auth);
}

export function subscribeUserChats(userId, callback, onError) {
    ensureFirebase();
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
        callback([]);
        return () => { };
    }

    let fallbackUnsubscribe = null;

    const startMembershipFallback = () => {
        if (fallbackUnsubscribe) {
            return;
        }

        fallbackUnsubscribe = onSnapshot(
            query(chatsRef(), where('members', 'array-contains', safeUserId), limit(400)),
            (snapshot) => {
                callback(snapshot.docs.map((entry) => entry.id));
            },
            (fallbackError) => {
                onError?.(fallbackError);
            }
        );
    };

    const primaryUnsubscribe = onSnapshot(
        userChatsDoc(safeUserId),
        (snapshot) => {
            const data = snapshot.data() || {};
            callback(Array.isArray(data.chatIds) ? data.chatIds : []);
        },
        (error) => {
            const code = String(error?.code || '').toLowerCase();
            if (code.includes('permission-denied')) {
                startMembershipFallback();
                return;
            }

            onError?.(error);
        }
    );

    return () => {
        primaryUnsubscribe?.();
        fallbackUnsubscribe?.();
    };
}

export async function fetchChatsByIds(chatIds) {
    ensureFirebase();
    const safeIds = Array.from(new Set((chatIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (!safeIds.length) {
        return [];
    }

    // Fetch each chat doc individually so one unauthorized/stale chat id does not fail the entire list.
    const settled = await Promise.allSettled(safeIds.map((id) => getDoc(chatDoc(id))));

    const chats = await Promise.all(
        settled.map(async (result, index) => {
            if (result.status !== 'fulfilled') {
                const code = String(result.reason?.code || '').toLowerCase();
                if (code.includes('permission-denied') || code.includes('not-found')) {
                    return null;
                }

                throw result.reason;
            }

            const snapshot = result.value;
            if (!snapshot.exists()) {
                return null;
            }

            const chatId = safeIds[index];
            const data = snapshot.data() || {};
            let resolvedPreview =
                String(data.previewText || '').trim() ||
                String(data.lastMessageText || '').trim() ||
                String(data.lastMessagePreview || '').trim() ||
                String(data.latestMessageText || '').trim() ||
                String(data.lastMessage?.text || '').trim();
            let resolvedLastMessageAt = data.lastMessageAt || null;

            if (!resolvedPreview) {
                try {
                    const latestMessageSnapshot = await getDocs(
                        query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(1))
                    );
                    const latestMessage = latestMessageSnapshot.docs[0]?.data() || null;
                    resolvedPreview = String(latestMessage?.text || '').trim();
                    if (!resolvedLastMessageAt && latestMessage?.createdAt) {
                        resolvedLastMessageAt = latestMessage.createdAt;
                    }
                } catch {
                    // Ignore preview fallback failures so chat list remains usable.
                }
            }

            return toSerializable({
                id: chatId,
                ...data,
                lastMessageText: resolvedPreview || String(data.lastMessageText || '').trim(),
                lastMessageAt: resolvedLastMessageAt || data.lastMessageAt || null
            });
        })
    );

    return chats
        .filter(Boolean)
        .sort((a, b) => {
            const aTime = Number(a.lastMessageAt || a.updatedAt || a.createdAt || 0);
            const bTime = Number(b.lastMessageAt || b.updatedAt || b.createdAt || 0);
            return bTime - aTime;
        });
}

export function subscribeChat(chatId, callback, onError) {
    ensureFirebase();
    return onSnapshot(chatDoc(chatId), (snapshot) => {
        callback(snapshot.exists() ? toSerializable({ id: snapshot.id, ...snapshot.data() }) : null);
    }, onError);
}

export async function searchUsersByUsername(prefix, excludeUid) {
    ensureFirebase();
    const safePrefix = normalizeUsernameKey(prefix);
    if (safePrefix.length < 2) {
        return [];
    }

    const end = `${safePrefix}\uf8ff`;
    const snapshot = await getDocs(
        query(usersRef(), orderBy('usernameKey', 'asc'), where('usernameKey', '>=', safePrefix), where('usernameKey', '<=', end), limit(8))
    );

    return snapshot.docs
        .map((entry) => ({ uid: entry.id, ...entry.data() }))
        .filter((entry) => entry.uid !== excludeUid);
}

export async function createOrGetDirectChat(currentProfile, targetProfile) {
    ensureFirebase();
    const chatId = getDirectChatId(currentProfile?.uid, targetProfile?.uid);
    if (!chatId) {
        throw new Error('Unable to create direct chat.');
    }

    const batch = writeBatch(db);
    batch.set(
        chatDoc(chatId),
        {
            type: '1:1',
            members: [currentProfile.uid, targetProfile.uid],
            memberUsernames: {
                [currentProfile.uid]: currentProfile.username,
                [targetProfile.uid]: targetProfile.username
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageText: '',
            lastMessageAt: null,
            lastSenderId: '',
            lastSenderName: '',
            memberMeta: {
                [currentProfile.uid]: { lastReadAt: serverTimestamp() },
                [targetProfile.uid]: { lastReadAt: serverTimestamp() }
            }
        },
        { merge: true }
    );
    batch.set(userChatsDoc(currentProfile.uid), { chatIds: arrayUnion(chatId), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    await touchAdminStats({ uid: currentProfile.uid, chatId, chatType: '1:1' });
    return chatId;
}

export async function joinGroupChatBySecret(currentProfile, secret) {
    ensureFirebase();
    const safeSecret = String(secret || '').trim();
    if (safeSecret.length < 6) {
        throw new Error('Group secret must be at least 6 characters.');
    }

    const chatId = await getGroupChatId(safeSecret);
    const batch = writeBatch(db);
    batch.set(
        chatDoc(chatId),
        {
            type: 'group',
            name: `Group ${chatId.slice(0, 8).toUpperCase()}`,
            createdBy: currentProfile.uid,
            members: arrayUnion(currentProfile.uid),
            memberUsernames: {
                [currentProfile.uid]: currentProfile.username
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageText: '',
            lastMessageAt: null,
            lastSenderId: '',
            lastSenderName: '',
            memberMeta: {
                [currentProfile.uid]: { lastReadAt: serverTimestamp() }
            }
        },
        { merge: true }
    );
    batch.set(userChatsDoc(currentProfile.uid), { chatIds: arrayUnion(chatId), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    await touchAdminStats({ uid: currentProfile.uid, chatId, chatType: 'group' });

    return {
        chatId,
        secret: safeSecret
    };
}

export async function updateChatReadState(chatId, userId) {
    ensureFirebase();
    if (!chatId || !userId) {
        return;
    }

    const key = `${String(chatId).trim()}:${String(userId).trim()}`;
    const now = Date.now();
    const lastWrittenAt = lastReadStateWriteAt.get(key) || 0;
    if (now - lastWrittenAt < READ_STATE_WRITE_THROTTLE_MS) {
        return;
    }

    lastReadStateWriteAt.set(key, now);

    await updateDoc(chatDoc(chatId), {
        [`memberMeta.${userId}.lastReadAt`]: serverTimestamp()
    }).catch(() => {
        // Ignore read-state update failures so chat UX continues.
    });
}

export function subscribeAdminStats(callback, onError) {
    ensureFirebase();
    return onSnapshot(adminStatsDoc(), (snapshot) => {
        callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }, onError);
}

export function subscribeAllUsers(callback, onError) {
    ensureFirebase();
    return onSnapshot(usersRef(), (snapshot) => {
        const sortedUsers = snapshot.docs
            .map((entry) => ({ uid: entry.id, ...entry.data() }))
            .sort((left, right) => {
                const leftKey = String(left?.usernameKey || left?.username || left?.email || '').toLowerCase();
                const rightKey = String(right?.usernameKey || right?.username || right?.email || '').toLowerCase();
                return leftKey.localeCompare(rightKey);
            });

        callback(sortedUsers);
    }, onError);
}

export function subscribeGroupChats(callback, onError) {
    ensureFirebase();
    return onSnapshot(query(chatsRef(), where('type', '==', 'group')), (snapshot) => {
        const mappedGroups = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const staleGroups = [];
        const actualGroups = mappedGroups.filter((entry) => {
            const safeId = String(entry?.id || '').trim();
            const hasCreator = Boolean(String(entry?.createdBy || '').trim());
            const looksLikeHashedGroupId = /^[a-f0-9]{64}$/i.test(safeId);
            const isActualGroup = hasCreator || looksLikeHashedGroupId;

            if (!isActualGroup) {
                staleGroups.push(safeId);
            }

            return isActualGroup;
        });

        callback(actualGroups);

        if (staleGroups.length) {
            Promise.allSettled(
                staleGroups.map((chatId) =>
                    updateDoc(chatDoc(chatId), {
                        type: getResolvedChatType(chatId),
                        updatedAt: serverTimestamp()
                    })
                )
            ).catch(() => {
                // Ignore stale chat cleanup failures; admin view already hides them.
            });

            updateDoc(adminStatsDoc(), {
                activeGroups: arrayRemove(...staleGroups),
                updatedAt: serverTimestamp()
            }).catch(() => {
                // Ignore stale stats cleanup failures.
            });
        }
    }, onError);
}

export async function touchAdminStats({ uid, chatId, chatType } = {}) {
    ensureFirebase();

    await runTransaction(db, async (transaction) => {
        const statsRef = adminStatsDoc();
        const statsSnapshot = await transaction.get(statsRef);
        const stats = statsSnapshot.exists() ? statsSnapshot.data() : {};
        const activeUsers24h = Array.isArray(stats.activeUsers24h) ? stats.activeUsers24h : [];
        const activeGroups = Array.isArray(stats.activeGroups) ? stats.activeGroups : [];
        const nextUsers = uid ? Array.from(new Set([...activeUsers24h, uid])).slice(-500) : activeUsers24h;
        const nextGroups = chatId && chatType === 'group' ? Array.from(new Set([...activeGroups, chatId])).slice(-500) : activeGroups;
        const totalUsersSnapshot = await getDocs(query(usersRef(), limit(1000)));
        const totalChatsSnapshot = await getDocs(query(chatsRef(), limit(1000)));

        transaction.set(
            statsRef,
            {
                totalUsers: totalUsersSnapshot.size,
                activeUsers24h: nextUsers,
                activeGroups: nextGroups,
                totalChats: totalChatsSnapshot.size,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
    }).catch(() => {
        // Stats should not block the main product flow.
    });
}