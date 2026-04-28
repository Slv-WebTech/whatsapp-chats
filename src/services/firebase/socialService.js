import {
    arrayRemove,
    arrayUnion,
    deleteDoc,
    deleteField,
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
import { clearProfileCache } from '../../utils/profileCache';
import { BRAND_EMAIL_DOMAIN } from '../../config/brandTokens';

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

function joinRequestsRef(chatId) {
    return collection(db, 'chats', String(chatId || ''), 'join_requests');
}

function joinRequestDoc(chatId, requestId) {
    return doc(db, 'chats', String(chatId || ''), 'join_requests', String(requestId || ''));
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

export function getGroupChatSecret(chatId) {
    return `group:${String(chatId || '').trim()}`;
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
    // Clear the in-memory profile cache so stale data doesn't persist
    // if another user signs in on the same tab.
    clearProfileCache();
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

export async function syncUserChatMembership(userId) {
    ensureFirebase();
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
        return;
    }

    const membershipSnapshot = await getDocs(
        query(chatsRef(), where('members', 'array-contains', safeUserId), limit(500))
    );
    const chatIds = membershipSnapshot.docs.map((entry) => entry.id);
    await setDoc(
        userChatsDoc(safeUserId),
        {
            chatIds,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
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

            // Cost optimization: never fan-out query messages per chat row.
            // Chat previews must come from denormalized chat metadata fields.

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

export async function createGroupChat(currentProfile, options = {}) {
    ensureFirebase();
    const ownerId = String(currentProfile?.uid || '').trim();
    const ownerUsername = String(currentProfile?.username || 'Owner').trim() || 'Owner';
    if (!ownerId) {
        throw new Error('Missing current user profile.');
    }

    const requestedName = String(options?.name || '').trim();
    const secret = `grp:${ownerId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const chatId = await getGroupChatId(secret);
    const resolvedName = requestedName || `Group ${chatId.slice(0, 8).toUpperCase()}`;

    const batch = writeBatch(db);
    batch.set(
        chatDoc(chatId),
        {
            type: 'group',
            name: resolvedName,
            description: String(options?.description || '').trim(),
            photoUrl: String(options?.photoUrl || '').trim(),
            ownerId,
            createdBy: ownerId,
            members: [ownerId],
            memberUsernames: {
                [ownerId]: ownerUsername
            },
            memberRoles: {
                [ownerId]: 'owner'
            },
            joinPolicy: 'group-id',
            approvalRequired: false,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageText: '',
            lastMessageAt: null,
            lastSenderId: '',
            lastSenderName: ''
        },
        { merge: true }
    );
    batch.set(userChatsDoc(ownerId), { chatIds: arrayUnion(chatId), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    await touchAdminStats({ uid: ownerId, chatId, chatType: 'group' });

    return {
        chatId,
        secret
    };
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
            joinPolicy: 'group-id',
            approvalRequired: false,
            status: 'active',
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

export async function joinGroupChatById(currentProfile, groupId) {
    ensureFirebase();
    const chatId = String(groupId || '').trim();
    const uid = String(currentProfile?.uid || '').trim();
    const username = String(currentProfile?.username || 'Member').trim() || 'Member';
    if (!chatId) {
        throw new Error('Group id is required.');
    }
    if (!uid) {
        throw new Error('Missing current user profile.');
    }

    const snapshot = await getDoc(chatDoc(chatId));
    if (!snapshot.exists()) {
        throw new Error('Group not found.');
    }

    const data = snapshot.data() || {};
    const members = Array.isArray(data.members) ? data.members.map((entry) => String(entry || '').trim()) : [];
    if (members.includes(uid)) {
        return { chatId };
    }

    const requiresApproval = Boolean(data.requireJoinApproval || data.joinApproval === 'admin');
    const ownerId = String(data.ownerId || data.createdBy || '').trim();
    const canBypassApproval = uid === ownerId || String(currentProfile?.role || '').toLowerCase() === 'admin';

    if (requiresApproval && !canBypassApproval) {
        await setDoc(
            joinRequestDoc(chatId, uid),
            {
                uid,
                username,
                requestedAt: serverTimestamp(),
                status: 'pending'
            },
            { merge: true }
        );
        return { status: 'pending', chatId };
    }

    const batch = writeBatch(db);
    batch.set(
        chatDoc(chatId),
        {
            members: arrayUnion(uid),
            [`memberUsernames.${uid}`]: username,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
    batch.set(userChatsDoc(uid), { chatIds: arrayUnion(chatId), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    return { chatId };
}

export function subscribeGroupJoinRequests(chatId, callback, onError) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
        callback?.([]);
        return () => { };
    }

    return onSnapshot(
        query(joinRequestsRef(safeChatId), orderBy('requestedAt', 'asc')),
        (snapshot) => {
            const requests = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
            callback?.(requests);
        },
        onError
    );
}

export async function approveJoinRequest(actor, chatId, requestId, fallbackUsername = '') {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    const safeRequestId = String(requestId || '').trim();
    if (!safeChatId || !safeRequestId) {
        return;
    }

    const requestRef = joinRequestDoc(safeChatId, safeRequestId);
    const requestSnapshot = await getDoc(requestRef);
    if (!requestSnapshot.exists()) {
        return;
    }

    const requestData = requestSnapshot.data() || {};
    const uid = String(requestData.uid || safeRequestId).trim();
    const username = String(requestData.username || fallbackUsername || 'Member').trim() || 'Member';

    const batch = writeBatch(db);
    batch.set(
        chatDoc(safeChatId),
        {
            members: arrayUnion(uid),
            [`memberUsernames.${uid}`]: username,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
    batch.set(userChatsDoc(uid), { chatIds: arrayUnion(safeChatId), updatedAt: serverTimestamp() }, { merge: true });
    batch.delete(requestRef);
    await batch.commit();
}

export async function rejectJoinRequest(actor, chatId, requestId) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    const safeRequestId = String(requestId || '').trim();
    if (!safeChatId || !safeRequestId) {
        return;
    }

    await deleteDoc(joinRequestDoc(safeChatId, safeRequestId));
}

export async function updateGroupSettings(actor, chatId, updates = {}) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
        return;
    }

    const allowed = {
        name: String(updates?.name || '').trim(),
        description: String(updates?.description || '').trim(),
        photoUrl: String(updates?.photoUrl || '').trim()
    };

    await updateDoc(chatDoc(safeChatId), {
        ...allowed,
        updatedAt: serverTimestamp()
    });
}

export async function removeGroupMember(actor, chatId, memberUid) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    const safeMemberUid = String(memberUid || '').trim();
    if (!safeChatId || !safeMemberUid) {
        return;
    }

    const batch = writeBatch(db);
    batch.update(chatDoc(safeChatId), {
        members: arrayRemove(safeMemberUid),
        [`memberUsernames.${safeMemberUid}`]: deleteField(),
        [`memberRoles.${safeMemberUid}`]: deleteField(),
        updatedAt: serverTimestamp()
    });
    batch.set(userChatsDoc(safeMemberUid), { chatIds: arrayRemove(safeChatId), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
}

export async function leaveGroupChat(actor, chatId) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    const safeUid = String(actor?.uid || '').trim();
    if (!safeChatId || !safeUid) {
        return;
    }

    await removeGroupMember(actor, safeChatId, safeUid);
}

export async function deleteGroupForAll(actor, chatId) {
    ensureFirebase();
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
        return;
    }

    const snapshot = await getDoc(chatDoc(safeChatId));
    if (!snapshot.exists()) {
        return;
    }

    const data = snapshot.data() || {};
    const members = Array.isArray(data.members) ? data.members : [];
    const batch = writeBatch(db);
    members.forEach((uid) => {
        const safeUid = String(uid || '').trim();
        if (safeUid) {
            batch.set(userChatsDoc(safeUid), { chatIds: arrayRemove(safeChatId), updatedAt: serverTimestamp() }, { merge: true });
        }
    });
    batch.delete(chatDoc(safeChatId));
    await batch.commit();
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