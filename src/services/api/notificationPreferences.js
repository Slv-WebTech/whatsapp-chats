import { auth } from '../firebase/config';

const API_BASE = String(import.meta.env.PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');

async function getAuthHeader() {
    const token = await auth?.currentUser?.getIdToken?.();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

export async function fetchNotificationPreferences() {
    const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
    };

    const response = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'GET',
        headers
    });

    if (!response.ok) {
        throw new Error('Failed to load notification preferences.');
    }

    return response.json();
}

export async function saveNotificationPreferences(payload) {
    const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
    };

    const response = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {})
    });

    if (!response.ok) {
        throw new Error('Failed to save notification preferences.');
    }

    return response.json();
}
