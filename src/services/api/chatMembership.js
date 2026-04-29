import { auth } from '../firebase/config';

const API_BASE = String(import.meta.env.PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');

async function getAuthHeader() {
    const token = await auth?.currentUser?.getIdToken?.();
    if (!token) {
        throw new Error('Missing auth token.');
    }

    return { Authorization: `Bearer ${token}` };
}

export async function resyncMembershipServer() {
    const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
    };

    const response = await fetch(`${API_BASE}/chats/resync-membership`, {
        method: 'POST',
        headers
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(String(data?.details || data?.error || 'Failed to resync membership.'));
    }

    return data;
}
