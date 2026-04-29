import { firebaseApp, isFirebaseConfigured } from './config';
import { auth } from './config';
import { isSupported, getMessaging, getToken, onMessage } from 'firebase/messaging';
import { BRAND } from '../../config/branding';
import { BRAND_PUSH_MESSAGE_TAG } from '../../config/brandTokens';

const TOKEN_CACHE_KEY = 'beyondstrings:fcm-token:v1';
const PREFS_CACHE_KEY = 'beyondstrings:notification-prefs:v1';
const API_BASE = String(import.meta.env.PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');

function canUseNotifications() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

async function ensurePermission() {
    if (!canUseNotifications()) {
        return 'unsupported';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        return 'denied';
    }

    return Notification.requestPermission();
}

function showForegroundNotification(payload = {}) {
    const cachedPrefs = JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || '{}');
    if (cachedPrefs?.pushEnabled === false) {
        return;
    }

    const title = String(payload?.notification?.title || payload?.data?.title || BRAND.name);
    const body = String(payload?.notification?.body || payload?.data?.body || 'You have a new update.');

    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: {
                title,
                body,
                tag: String(payload?.data?.tag || BRAND_PUSH_MESSAGE_TAG),
                data: { url: String(payload?.data?.url || '/') }
            }
        });
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

async function getAuthHeader() {
    const token = await auth?.currentUser?.getIdToken?.();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

async function persistPushToken(token) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...(await getAuthHeader())
        };

        const response = await fetch(`${API_BASE}/notifications/register-token`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                deviceToken: token,
                platform: 'web',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
            })
        });

        return response.ok;
    } catch {
        return false;
    }
}

export function cacheNotificationPreferences(preferences = {}) {
    try {
        localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(preferences));
    } catch {
        // Ignore cache write errors.
    }
}

export async function initializePushNotifications(serviceWorkerRegistration) {
    if (!isFirebaseConfigured() || !firebaseApp || !canUseNotifications()) {
        return { enabled: false, reason: 'firebase-or-notification-unsupported' };
    }

    if (!serviceWorkerRegistration) {
        return { enabled: false, reason: 'missing-service-worker-registration' };
    }

    const permission = await ensurePermission();
    if (permission !== 'granted') {
        return { enabled: false, reason: `permission-${permission}` };
    }

    if (!(await isSupported())) {
        return { enabled: false, reason: 'messaging-not-supported' };
    }

    const vapidKey = String(import.meta.env.PUBLIC_FIREBASE_VAPID_KEY || '').trim();
    if (!vapidKey) {
        return { enabled: false, reason: 'missing-vapid-key' };
    }

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration
    });

    if (!token) {
        return { enabled: false, reason: 'token-unavailable' };
    }

    const previousToken = localStorage.getItem(TOKEN_CACHE_KEY);
    if (previousToken !== token) {
        localStorage.setItem(TOKEN_CACHE_KEY, token);
        await persistPushToken(token);
    } else {
        // Refresh server-side last_seen timestamp periodically.
        await persistPushToken(token);
    }

    onMessage(messaging, (payload) => {
        // Display foreground push notifications while app is open.
        showForegroundNotification(payload);
    });

    return { enabled: true, token };
}
