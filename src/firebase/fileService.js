import { getStorage, ref, uploadBytes, getBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firebaseApp } from './config';

let storageInstance = null;

function getStorageInstance() {
    if (!storageInstance && firebaseApp) {
        storageInstance = getStorage(firebaseApp);
    }
    return storageInstance;
}

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID
 * @returns {Promise<{url: string, name: string, size: number, type: string}>}
 */
export async function uploadFileToChat(file, chatId, userId) {
    const storage = getStorageInstance();
    if (!storage || !file) {
        throw new Error('Storage not available or file missing');
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `chats/${chatId}/${userId}/${fileName}`;
    const storageRef = ref(storage, filePath);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        return {
            url,
            name: file.name,
            size: file.size,
            type: file.type,
            path: filePath
        };
    } catch (error) {
        console.error('File upload failed:', error);
        throw new Error(`Failed to upload ${file.name}`);
    }
}

/**
 * Delete a file from Firebase Storage
 * @param {string} filePath - The file path in storage
 * @returns {Promise<void>}
 */
export async function deleteFileFromChat(filePath) {
    const storage = getStorageInstance();
    if (!storage) {
        throw new Error('Storage not available');
    }

    try {
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
    } catch (error) {
        console.error('File deletion failed:', error);
        throw error;
    }
}

/**
 * Get download URL for a file
 * @param {string} filePath - The file path in storage
 * @returns {Promise<string>}
 */
export async function getFileDownloadURL(filePath) {
    const storage = getStorageInstance();
    if (!storage) {
        throw new Error('Storage not available');
    }

    try {
        const storageRef = ref(storage, filePath);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error('Failed to get download URL:', error);
        throw error;
    }
}

export { getStorage, ref, uploadBytes, getBytes, deleteObject };
