const ACTIVE_CHAT_ID_SESSION_KEY = 'active_chat_id_v1';

export function setActiveChatRouteId(chatId) {
    if (typeof window === 'undefined') {
        return;
    }

    const safeId = String(chatId || '').trim();
    if (!safeId) {
        window.sessionStorage.removeItem(ACTIVE_CHAT_ID_SESSION_KEY);
        return;
    }

    window.sessionStorage.setItem(ACTIVE_CHAT_ID_SESSION_KEY, safeId);
}

export function getActiveChatRouteId() {
    if (typeof window === 'undefined') {
        return '';
    }

    return String(window.sessionStorage.getItem(ACTIVE_CHAT_ID_SESSION_KEY) || '').trim();
}