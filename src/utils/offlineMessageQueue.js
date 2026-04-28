const DB_NAME = 'beyondstrings-offline-queue';
const STORE_NAME = 'messages';

let openDbPromise = null;

function hasIndexedDb() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb() {
    if (!hasIndexedDb()) {
        return Promise.resolve(null);
    }

    if (!openDbPromise) {
        openDbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('roomId', 'roomId', { unique: false });
                store.createIndex('createdAtMs', 'createdAtMs', { unique: false });
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Failed to open offline queue database.'));
        }).catch(() => null);
    }

    return openDbPromise;
}

function withStore(mode, executor) {
    return openDb().then((db) => {
        if (!db) {
            return executor(null);
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            executor(store, resolve, reject);
            transaction.onerror = () => reject(transaction.error || new Error('Offline queue transaction failed.'));
        });
    });
}

function sortEntries(entries) {
    return [...entries].sort((left, right) => {
        const leftTime = Number(left?.createdAtMs || 0);
        const rightTime = Number(right?.createdAtMs || 0);
        return leftTime - rightTime;
    });
}

export async function enqueueOfflineMessage(entry) {
    const safeEntry = {
        ...entry,
        id: String(entry?.id || '').trim(),
        clientId: String(entry?.clientId || entry?.id || '').trim(),
        roomId: String(entry?.roomId || '').trim(),
        uid: String(entry?.uid || '').trim(),
        previewText: String(entry?.previewText || '').trim(),
        sender: String(entry?.sender || '').trim(),
        createdAtMs: Number(entry?.createdAtMs || Date.now())
    };

    if (!safeEntry.id || !safeEntry.roomId || !safeEntry.uid) {
        throw new Error('Offline message requires id, roomId, and uid.');
    }

    return withStore('readwrite', (store, resolve) => {
        if (!store) {
            // If IndexedDB is unavailable, keep runtime flow alive without local persistence.
            resolve(safeEntry);
            return;
        }

        const request = store.put(safeEntry);
        request.onsuccess = () => resolve(safeEntry);
    });
}

export async function getOfflineMessagesByRoom(roomId) {
    const safeRoomId = String(roomId || '').trim();
    if (!safeRoomId) {
        return [];
    }

    return withStore('readonly', (store, resolve) => {
        if (!store) {
            resolve([]);
            return;
        }

        const index = store.index('roomId');
        const request = index.getAll(safeRoomId);
        request.onsuccess = () => resolve(sortEntries(request.result || []));
    });
}

export async function removeOfflineMessage(id) {
    const safeId = String(id || '').trim();
    if (!safeId) {
        return;
    }

    return withStore('readwrite', (store, resolve) => {
        if (!store) {
            resolve();
            return;
        }

        const request = store.delete(safeId);
        request.onsuccess = () => resolve();
    });
}

export async function clearOfflineMessagesByRoom(roomId) {
    const safeRoomId = String(roomId || '').trim();
    if (!safeRoomId) {
        return;
    }

    return withStore('readwrite', (store, resolve) => {
        if (!store) {
            resolve();
            return;
        }

        const index = store.index('roomId');
        const request = index.getAll(safeRoomId);
        request.onsuccess = () => {
            const entries = request.result || [];
            if (!entries.length) {
                resolve();
                return;
            }

            let remaining = entries.length;
            entries.forEach((entry) => {
                const deleteRequest = store.delete(entry.id);
                deleteRequest.onsuccess = () => {
                    remaining -= 1;
                    if (remaining <= 0) {
                        resolve();
                    }
                };
            });
        };
    });
}

export async function clearOfflineMessages() {
    return withStore('readwrite', (store, resolve) => {
        if (!store) {
            resolve();
            return;
        }

        const request = store.clear();
        request.onsuccess = () => resolve();
    });
}
