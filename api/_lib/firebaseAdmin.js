import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getFirebaseAdminConfig() {
    const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey
    };
}

export function getFirebaseAdminApp() {
    if (getApps().length) {
        return getApps()[0];
    }

    const config = getFirebaseAdminConfig();
    if (!config) {
        throw new Error('Firebase Admin credentials are not configured.');
    }

    return initializeApp({
        credential: cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey
        })
    });
}

export async function verifyFirebaseToken(idToken) {
    const safeToken = String(idToken || '').trim();
    if (!safeToken) {
        throw new Error('Missing auth token.');
    }

    const app = getFirebaseAdminApp();
    const auth = getAuth(app);
    return auth.verifyIdToken(safeToken, true);
}
