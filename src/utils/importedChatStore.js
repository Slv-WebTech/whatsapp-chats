import CryptoJS from 'crypto-js';

const DB_NAME = 'beyondstrings-imported-chats';
const STORE_NAME = 'importedChats';
const SECRET = import.meta.env.PUBLIC_IMPORTED_CHAT_SECRET || import.meta.env.PUBLIC_REDUX_PERSIST_SECRET || 'beyondstrings-imported-chat-v1';

let openDbPromise = null;

function openDb() {
    if (openDbPromise) {
        return openDbPromise;
    }

    openDbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            resolve(null);
            return;
        }

        const request = window.indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('ownerUid', 'ownerUid', { unique: false });
            store.createIndex('updatedAtMs', 'updatedAtMs', { unique: false });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open imported chat database.'));
    }).catch(() => null);

    return openDbPromise;
}

function withStore(mode, callback) {
    return openDb().then((db) => {
        if (!db) {
            return callback(null);
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            callback(store, resolve, reject);
            transaction.onerror = () => reject(transaction.error || new Error('Imported chat database transaction failed.'));
        });
    });
}

function encryptJson(value) {
    return CryptoJS.AES.encrypt(JSON.stringify(value), SECRET).toString();
}

function decryptJson(cipherText) {
    const decrypted = CryptoJS.AES.decrypt(String(cipherText || ''), SECRET).toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
        throw new Error('Unable to decrypt imported chat payload.');
    }

    return JSON.parse(decrypted);
}

function toMillis(value) {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

function inferDisplayTitle(fileName, participants) {
    const safeParticipants = Array.from(new Set((participants || []).map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 2);
    if (safeParticipants.length === 2) {
        return `${safeParticipants[0]} & ${safeParticipants[1]}`;
    }

    if (safeParticipants.length === 1) {
        return safeParticipants[0];
    }

    const safeFileName = String(fileName || '').trim();
    if (!safeFileName) {
        return 'Imported chat';
    }

    return safeFileName.replace(/\.[^/.]+$/, '').slice(0, 42);
}

function normalizeMessages(rawMessages) {
    return (rawMessages || []).map((entry, index) => ({
        id: String(entry?.id || `imported-${index}`),
        sender: String(entry?.sender || 'System').trim(),
        message: String(entry?.message || '').trim(),
        date: String(entry?.date || '').trim(),
        time: String(entry?.time || '').trim(),
        isSystem: Boolean(entry?.isSystem),
        createdAtMs: toMillis(entry?.createdAtMs || `${entry?.date || ''} ${entry?.time || ''}`) || Date.now() + index
    }));
}

function buildPreview(messages) {
    const candidate = [...(messages || [])].reverse().find((entry) => !entry?.isSystem && String(entry?.message || '').trim());
    return String(candidate?.message || 'Imported conversation').trim().slice(0, 140);
}

export async function saveImportedChat({ ownerUid, fileName, parsed }) {
    const safeOwnerUid = String(ownerUid || '').trim();
    if (!safeOwnerUid) {
        throw new Error('Owner uid is required for imported chats.');
    }

    const messages = normalizeMessages(parsed?.messages || []);
    const participants = Array.from(new Set((parsed?.users || []).map((item) => String(item || '').trim()).filter(Boolean)));
    const now = Date.now();
    const id = `imp-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
        fileName: String(fileName || '').trim(),
        participants,
        messages,
        importedAtMs: now
    };

    const metadata = {
        id,
        ownerUid: safeOwnerUid,
        type: 'imported',
        fileName: payload.fileName,
        displayTitle: inferDisplayTitle(payload.fileName, participants),
        memberUsernames: participants.reduce((acc, value, idx) => {
            acc[`import-${idx}`] = value;
            return acc;
        }, {}),
        members: participants,
        messageCount: messages.length,
        lastMessageText: buildPreview(messages),
        lastMessageAt: messages[messages.length - 1]?.createdAtMs || now,
        createdAtMs: now,
        updatedAtMs: now,
        encryptedPayload: encryptJson(payload)
    };

    return withStore('readwrite', (store, resolve) => {
        if (!store) {
            throw new Error('IndexedDB is unavailable. Imported chats require IndexedDB.');
        }

        const request = store.put(metadata);
        request.onsuccess = () => resolve({ id, ...metadata, encryptedPayload: undefined });
    });
}

export async function listImportedChats(ownerUid) {
    const safeOwnerUid = String(ownerUid || '').trim();
    if (!safeOwnerUid) {
        return [];
    }

    return withStore('readonly', (store, resolve) => {
        if (!store) {
            resolve([]);
            return;
        }

        const index = store.index('ownerUid');
        const request = index.getAll(safeOwnerUid);
        request.onsuccess = () => {
            const rows = Array.isArray(request.result) ? request.result : [];
            const chats = rows
                .map((row) => ({ ...row, encryptedPayload: undefined, isImported: true }))
                .sort((left, right) => Number(right.updatedAtMs || 0) - Number(left.updatedAtMs || 0));
            resolve(chats);
        };
    });
}

export async function getImportedChatById(id, ownerUid) {
    const safeId = String(id || '').trim();
    const safeOwnerUid = String(ownerUid || '').trim();
    if (!safeId || !safeOwnerUid) {
        return null;
    }

    return withStore('readonly', (store, resolve) => {
        if (!store) {
            resolve(null);
            return;
        }

        const request = store.get(safeId);
        request.onsuccess = () => {
            const row = request.result;
            if (!row || String(row.ownerUid || '') !== safeOwnerUid) {
                resolve(null);
                return;
            }

            try {
                const payload = decryptJson(row.encryptedPayload);
                resolve({
                    id: row.id,
                    metadata: {
                        ...row,
                        encryptedPayload: undefined,
                        isImported: true
                    },
                    payload
                });
            } catch {
                resolve(null);
            }
        };
    });
}
