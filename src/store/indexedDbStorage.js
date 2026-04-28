const DB_NAME = 'beyondstrings-state-db';
const STORE_NAME = 'kv';

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
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB storage.'));
    }).catch(() => null);

    return openDbPromise;
}

function withStore(mode, operation) {
    return openDb().then((db) => {
        if (!db) {
            return operation(null);
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            operation(store, resolve, reject);
            transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
        });
    });
}

const indexedDbStorage = {
    async getItem(key) {
        const safeKey = String(key || '').trim();
        if (!safeKey) {
            return null;
        }

        return withStore('readonly', (store, resolve) => {
            if (!store) {
                resolve(null);
                return;
            }

            const request = store.get(safeKey);
            request.onsuccess = () => {
                const entry = request.result;
                resolve(entry ? String(entry.value || '') : null);
            };
            request.onerror = () => resolve(null);
        });
    },

    async setItem(key, value) {
        const safeKey = String(key || '').trim();
        if (!safeKey) {
            return;
        }

        return withStore('readwrite', (store, resolve) => {
            if (!store) {
                resolve();
                return;
            }

            const request = store.put({ key: safeKey, value: String(value || '') });
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    },

    async removeItem(key) {
        const safeKey = String(key || '').trim();
        if (!safeKey) {
            return;
        }

        return withStore('readwrite', (store, resolve) => {
            if (!store) {
                resolve();
                return;
            }

            const request = store.delete(safeKey);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }
};

export default indexedDbStorage;
