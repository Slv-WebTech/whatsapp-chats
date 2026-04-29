import { PRESET_CHAT_BACKGROUNDS } from '../../utils/chatBackgrounds';
import { decryptMessage } from '../../utils/encryption';

export const DEFAULT_CHAT_BACKGROUND = {
    professional: {
        light: 'https://images.unsplash.com/photo-1487611459768-bd414656ea10?fm=jpg&q=80&w=2400&auto=format&fit=crop',
        dark: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?fm=jpg&q=80&w=2400&auto=format&fit=crop'
    },
    casual: {
        light: 'https://wallpapercave.com/wp/wp2746574.jpg',
        dark: 'https://4kwallpapers.com/images/wallpapers/romantic-love-5120x2880-24698.jpg'
    },
    // Legacy aliases for backward compatibility with old persisted state.
    formal: {
        light: 'https://images.unsplash.com/photo-1487611459768-bd414656ea10?fm=jpg&q=80&w=2400&auto=format&fit=crop',
        dark: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?fm=jpg&q=80&w=2400&auto=format&fit=crop'
    },
    romantic: {
        light: 'https://wallpapercave.com/wp/wp2746574.jpg',
        dark: 'https://4kwallpapers.com/images/wallpapers/romantic-love-5120x2880-24698.jpg'
    }
};

export const DEFAULT_USER_PROFILE_IMAGES = [
    'https://i.pinimg.com/236x/34/bf/c0/34bfc0b27135efaf3b1fcf41d1b4688a.jpg',
    'https://i.pinimg.com/236x/c1/a5/e0/c1a5e0ab2a69e644a456ba401ade9e6e.jpg',
    'https://i.pinimg.com/474x/fc/cf/c2/fccfc2da1666f953e74e52141cd04776.jpg'
];

export const DEFAULT_HEADER_CONTACT_IMAGE = 'https://wallpapercave.com/wp/wp2746574.jpg';
export const ACTIVE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const TYPING_STALE_WINDOW_MS = 8000;

export function timestampToMillis(value) {
    if (!value) {
        return 0;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value?.toMillis === 'function') {
        return value.toMillis();
    }

    if (typeof value?.toDate === 'function') {
        return value.toDate().getTime();
    }

    return 0;
}

export function getReplayDelay(message, speed) {
    const messageLength = String(message?.message || '').length;
    const dynamicDelay = Math.min(2000, 300 + messageLength * 20);
    const speedFactor = speed / 500;
    return Math.max(180, Math.round(dynamicDelay * speedFactor));
}

export function isTypingTarget(target) {
    if (!target) {
        return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

export function parseChatDateTime(dateText, timeText) {
    if (!dateText || !timeText) {
        return null;
    }

    const normalizedDate = String(dateText).replace(/[.-]/g, '/').split('/');
    if (normalizedDate.length !== 3) {
        return null;
    }

    const [day, month, rawYear] = normalizedDate.map((part) => Number(part));
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, Math.max(0, month - 1), day);

    const timeMatch = String(timeText).trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?/i);
    if (!timeMatch) {
        return date;
    }

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = Number(timeMatch[3] || 0);
    const meridiem = timeMatch[4]?.toLowerCase();

    if (meridiem === 'pm' && hour !== 12) {
        hour += 12;
    }
    if (meridiem === 'am' && hour === 12) {
        hour = 0;
    }

    date.setHours(hour, minute, second, 0);
    return date;
}

export function pickBackgroundTone({ chatMode, resolvedTheme, selectedBackground, presetOption }) {
    const normalizedChatMode = String(chatMode || '').trim().toLowerCase();
    const normalized = `${presetOption?.label || ''} ${selectedBackground || ''}`.toLowerCase();
    const isDarkBackground =
        resolvedTheme === 'dark' ||
        presetOption?.mode === 'dark' ||
        /night|midnight|dark|moon|silhouette/.test(normalized);
    const isRomanticBackground =
        normalizedChatMode === 'casual' ||
        /romantic|love|heart|pink|valentine|rose|couple/.test(normalized);

    if (isRomanticBackground && isDarkBackground) {
        return 'romantic-night';
    }
    if (isRomanticBackground) {
        return 'romantic-soft';
    }
    if (isDarkBackground) {
        return 'formal-night';
    }
    return 'formal-soft';
}

export function getBackgroundThemeTokens(tone) {
    const tokens = {
        'formal-soft': {
            accent: '#2f6f8d',
            overlayTop: 'rgba(255,255,255,0.7)',
            overlayMid: 'rgba(244,250,255,0.62)',
            overlayBottom: 'rgba(236,246,252,0.74)',
            sentStart: 'rgba(77, 131, 164, 0.95)',
            sentEnd: 'rgba(116, 162, 190, 0.92)',
            sentBorder: 'rgba(77, 131, 164, 0.34)',
            sentShadow: '0 9px 18px rgba(43, 94, 126, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
            tailSent: '#8bb8d0',
            receivedStart: 'rgba(255,255,255,0.98)',
            receivedEnd: 'rgba(240,248,253,0.93)',
            receivedBorder: 'rgba(178,206,223,0.85)',
            receivedShadow: '0 8px 14px rgba(21, 72, 101, 0.1), inset 0 0 0 1px rgba(255,255,255,0.42)'
        },
        'formal-night': {
            accent: '#75b8d7',
            overlayTop: 'rgba(7,15,23,0.62)',
            overlayMid: 'rgba(9,19,29,0.54)',
            overlayBottom: 'rgba(8,16,25,0.7)',
            sentStart: 'rgba(52, 95, 122, 0.94)',
            sentEnd: 'rgba(72, 120, 151, 0.92)',
            sentBorder: 'rgba(119, 180, 212, 0.33)',
            sentShadow: '0 10px 18px rgba(8, 29, 43, 0.36), inset 0 1px 0 rgba(255,255,255,0.14)',
            tailSent: '#406f89',
            receivedStart: 'rgba(18,34,45,0.95)',
            receivedEnd: 'rgba(15,28,37,0.92)',
            receivedBorder: 'rgba(90,141,170,0.4)',
            receivedShadow: '0 8px 14px rgba(0, 0, 0, 0.24)'
        },
        'romantic-soft': {
            accent: '#b7588a',
            overlayTop: 'rgba(255,245,250,0.74)',
            overlayMid: 'rgba(255,234,244,0.66)',
            overlayBottom: 'rgba(253,226,238,0.78)',
            sentStart: 'rgba(196, 100, 146, 0.94)',
            sentEnd: 'rgba(223, 135, 176, 0.92)',
            sentBorder: 'rgba(196, 100, 146, 0.34)',
            sentShadow: '0 9px 16px rgba(146, 59, 102, 0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
            tailSent: '#d185ad',
            receivedStart: 'rgba(255,247,251,0.98)',
            receivedEnd: 'rgba(255,234,245,0.94)',
            receivedBorder: 'rgba(236,188,211,0.84)',
            receivedShadow: '0 8px 14px rgba(102, 41, 70, 0.1), inset 0 0 0 1px rgba(255,255,255,0.35)'
        },
        'romantic-night': {
            accent: '#e2a0c7',
            overlayTop: 'rgba(36,16,27,0.64)',
            overlayMid: 'rgba(42,18,31,0.56)',
            overlayBottom: 'rgba(34,14,24,0.72)',
            sentStart: 'rgba(144, 66, 108, 0.93)',
            sentEnd: 'rgba(179, 86, 132, 0.92)',
            sentBorder: 'rgba(226,160,199,0.34)',
            sentShadow: '0 10px 18px rgba(56, 12, 35, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            tailSent: '#9d4d79',
            receivedStart: 'rgba(60,26,44,0.95)',
            receivedEnd: 'rgba(49,21,37,0.92)',
            receivedBorder: 'rgba(194,122,164,0.35)',
            receivedShadow: '0 8px 14px rgba(0, 0, 0, 0.27)'
        }
    };

    return tokens[tone] || tokens['formal-soft'];
}

export function getEligiblePresetBackgrounds(chatMode, resolvedTheme) {
    const normalizedChatMode = String(chatMode || '').trim().toLowerCase();
    const aliases = normalizedChatMode === 'casual'
        ? ['casual', 'romantic']
        : normalizedChatMode === 'professional'
            ? ['professional', 'formal']
            : [normalizedChatMode];

    const exactMatches = PRESET_CHAT_BACKGROUNDS.filter(
        (item) => aliases.includes(String(item.chatMode || '').toLowerCase()) && item.mode === resolvedTheme
    );

    if (exactMatches.length) {
        return exactMatches;
    }

    return PRESET_CHAT_BACKGROUNDS.filter((item) => aliases.includes(String(item.chatMode || '').toLowerCase()));
}

export function pickRandomPresetBackgroundId(options) {
    if (!options.length) {
        return '';
    }

    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex]?.id || '';
}

export function formatLastSeenLabel(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return '';
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfValue = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const diffDays = Math.round((startOfToday.getTime() - startOfValue.getTime()) / (24 * 60 * 60 * 1000));
    const timeLabel = value.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (diffDays === 0) {
        return `today at ${timeLabel}`;
    }

    if (diffDays === 1) {
        return 'yesterday';
    }

    return value.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function deriveSharedRoomId(secret) {
    const input = String(secret || '').trim();
    if (!input) {
        return 'shared-room';
    }

    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(index);
        hash |= 0;
    }

    return `shared-${Math.abs(hash).toString(36)}`;
}

export function getRouteChatId(pathname) {
    const match = String(pathname || '').match(/(?:^|\/)chat\/([^/]+)/);
    return match ? decodeURIComponent(match[1] || '').trim() : '';
}

export function formatFirebaseDebugError(context, error) {
    const code = String(error?.code || 'unknown').trim();
    const message = String(error?.message || '').trim();

    if (!message) {
        return `${context}\ncode: ${code}`;
    }

    return `${context}\ncode: ${code}\nmessage: ${message}`;
}

export function createOfflineClientId() {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isRecoverableSendError(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();

    return (
        (typeof window !== 'undefined' && window.navigator?.onLine === false) ||
        ['unavailable', 'failed-precondition', 'deadline-exceeded', 'resource-exhausted', 'cancelled'].some((fragment) => code.includes(fragment)) ||
        /offline|network|client is offline|transport|timed out|unreachable/.test(message)
    );
}

export function toChatDate(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function toChatTime(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    }).toLowerCase();
}

export function pseudonymFromUid(uidValue) {
    const safeUid = String(uidValue || '').trim();
    if (!safeUid) {
        return 'Member';
    }

    const compact = safeUid.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();

    return `Member ${compact || 'USER'}`;
}

export function decryptDisplayNameSafely(encryptedValue, secret) {
    const cipher = String(encryptedValue || '').trim();
    if (!cipher || !secret) {
        return '';
    }

    try {
        const decrypted = decryptMessage(cipher, secret);
        return String(decrypted || '').trim();
    } catch {
        return '';
    }
}

/**
 * Normalizes a reaction count value that may be stored as an array (array-union style)
 * or as a numeric increment. Returns a safe non-negative integer.
 */
export function normalizeReactionCount(count) {
    if (Array.isArray(count)) {
        return count.length;
    }

    const n = Number(count);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Derives a human-readable sync health label from connection state flags.
 * @param {{ isOnline: boolean, isLoading: boolean, hasError: boolean }} params
 * @returns {'Live' | 'Syncing' | 'Degraded' | 'Offline'}
 */
export function getSyncHealthLabel({ isOnline, isLoading, hasError }) {
    if (!isOnline) {
        return 'Offline';
    }

    if (hasError) {
        return 'Degraded';
    }

    if (isLoading) {
        return 'Syncing';
    }

    return 'Live';
}

/**
 * Returns a display label for a group member role.
 * @param {'owner' | 'admin' | 'member' | string} role
 * @returns {string}
 */
export function getGroupRoleLabel(role) {
    const normalized = String(role || '').toLowerCase();

    if (normalized === 'owner') {
        return 'Owner';
    }

    if (normalized === 'admin') {
        return 'Admin';
    }

    return 'Member';
}

/**
 * Sorts group members array by role priority: owner first, then admin, then member.
 * @param {Array<{ role?: string }>} members
 * @returns {Array}
 */
export function sortMembersByRole(members) {
    const priority = { owner: 0, admin: 1, member: 2 };

    return [...(members || [])].sort((a, b) => {
        const pa = priority[String(a?.role || 'member').toLowerCase()] ?? 2;
        const pb = priority[String(b?.role || 'member').toLowerCase()] ?? 2;
        return pa - pb;
    });
}

export function mapQueuedMessageToUiMessage(entry, secret) {
    const createdAtMs = Number(entry?.createdAtMs || Date.now());
    const senderUid = String(entry?.uid || 'unknown').trim();
    let previewText = String(entry?.previewText || '').trim();
    let senderLabel = String(entry?.sender || '').trim();

    if (!previewText && secret) {
        try {
            previewText = decryptMessage(String(entry?.payload?.text || ''), secret);
        } catch {
            previewText = '[Queued encrypted message]';
        }
    }

    if (!senderLabel && secret) {
        senderLabel = decryptDisplayNameSafely(entry?.payload?.senderEnc, secret);
    }

    return {
        id: `queued-${String(entry?.clientId || entry?.id || createdAtMs)}`,
        clientId: String(entry?.clientId || entry?.id || '').trim() || null,
        sender: senderLabel || pseudonymFromUid(senderUid),
        uid: senderUid,
        message: previewText || '[Queued message]',
        date: toChatDate(createdAtMs),
        time: toChatTime(createdAtMs),
        type: entry?.payload?.type || 'text',
        replyToText: entry?.payload?.replyTo?.text || '',
        replyToSender: entry?.payload?.replyTo?.sender || '',
        isSystem: false,
        reactions: {},
        createdAtMs,
        encrypted: true,
        decryptionError: false,
        deliveredTo: {
            [senderUid]: true
        },
        readBy: {
            [senderUid]: true
        },
        deliveryStatus: 'queued',
        offlineQueued: true
    };
}

export function shouldHideConversationMessage(message) {
    const senderUid = String(message?.uid || '').trim().toLowerCase();
    const messageText = String(message?.message || '').trim().toLowerCase();
    const isSystem = Boolean(message?.isSystem) || String(message?.type || '').trim().toLowerCase() === 'system';

    if (!isSystem || senderUid !== 'ai-assistant') {
        return false;
    }

    return /(messages analyzed:|participants:|key points:|important decisions:|recent context:)/i.test(messageText);
}

export function mapLiveMessageToUiMessage(entry, secret, viewerUserId, resolveSenderLabel) {
    const createdAtMs = entry?.createdAt?.toMillis?.() || Date.now();
    const createdAtDate = new Date(createdAtMs);
    const isEncrypted = Boolean(entry?.encrypted);
    let text = String(entry?.text || '');
    let decryptionError = false;

    if (isEncrypted) {
        try {
            text = decryptMessage(text, secret);
        } catch {
            text = '[Unable to decrypt message]';
            decryptionError = true;
        }
    }

    const senderUid = String(entry?.uid || entry?.sender || 'unknown');
    const sender = resolveSenderLabel?.(senderUid, entry?.sender, entry?.senderEnc) || pseudonymFromUid(senderUid);
    const deliveredTo = entry?.deliveredTo || {};
    const readBy = entry?.readBy || {};
    const otherDelivered = Object.entries(deliveredTo).some(([user, value]) => user !== senderUid && Boolean(value));
    const otherRead = Object.entries(readBy).some(([user, value]) => user !== senderUid && Boolean(value));

    let deliveryStatus = null;
    if (senderUid === viewerUserId) {
        deliveryStatus = otherRead ? 'read' : otherDelivered ? 'delivered' : 'sent';
    }

    const hiddenForCurrentUser = Boolean(viewerUserId && entry?.deletedFor && entry.deletedFor[viewerUserId]);

    return {
        id: `live-${entry.id}`,
        firestoreId: entry.id,
        clientId: String(entry?.clientId || '').trim() || null,
        sender,
        uid: senderUid,
        message: text,
        date: toChatDate(createdAtDate),
        time: toChatTime(createdAtDate),
        type: entry?.type || 'text',
        replyToText: String(entry?.replyTo?.text || '').trim(),
        replyToSender: String(entry?.replyTo?.sender || '').trim(),
        isSystem: entry?.type === 'system',
        reactions: entry?.reactions || {},
        createdAtMs,
        encrypted: isEncrypted,
        decryptionError,
        deliveredTo,
        readBy,
        deliveryStatus,
        hiddenForCurrentUser
    };
}
