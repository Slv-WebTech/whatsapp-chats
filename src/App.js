import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Virtuoso } from 'react-virtuoso';
import { toPng } from 'html-to-image';
import { MessageCircleMore, X } from 'lucide-react';
import ChatBubble from './components/ChatBubble';
import ChatHeader from './components/ChatHeader';
import ChatInsights from './components/ChatInsights';
import FileUpload from './components/FileUpload';
import LiveComposer from './components/LiveComposer';
import ReplayControls from './components/ReplayControls';
import SecretLogin from './components/SecretLogin';
import SettingsPanel from './components/SettingsPanel';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './components/ui/sheet';
import {
    addMessageReaction,
    clearRoomMessages,
    fetchOlderRoomMessages,
    hardDeleteRoomData,
    markMessageDelivered,
    markMessageRead,
    scrubLegacyRoomMetadata,
    sanitizeRoomId,
    sendRoomMessage,
    setRoomUserPresence,
    setTypingStatus,
    subscribeRoomUsers,
    subscribeToRoomMessages,
    subscribeTypingStatus
} from './firebase/chatService';
import { auth, isFirebaseConfigured } from './firebase/config';
import { summarizeMessagesWithAI } from './utils/aiSummary';
import { groupMessages } from './utils/groupMessages';
import { includesQuery } from './utils/highlight';
import { parseWhatsAppChat } from './utils/parser';
import { decryptMessage, encryptMessage } from './utils/encryption';
import sampleChatText from './components/Assets/sample chat.txt?raw';
import {
    clearAuthSession,
    selectAuthSession,
    selectChatMode,
    selectCurrentUser,
    selectLastRoomId,
    selectThemePreference,
    setAuthSession,
    setChatMode,
    setCurrentUser,
    setLastRoomId,
    setThemePreference
} from './store/appSessionSlice';
import { persistor } from './store/store';

const DEFAULT_CHAT_BACKGROUND = {
    formal: {
        light: 'https://images.unsplash.com/photo-1487611459768-bd414656ea10?fm=jpg&q=80&w=2400&auto=format&fit=crop',
        dark: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?fm=jpg&q=80&w=2400&auto=format&fit=crop'
    },
    romantic: {
        light: 'https://wallpapercave.com/wp/wp2746574.jpg',
        dark: 'https://4kwallpapers.com/images/wallpapers/romantic-love-5120x2880-24698.jpg'
    }
};

const DEFAULT_USER_PROFILE_IMAGES = [
    'https://i.pinimg.com/236x/34/bf/c0/34bfc0b27135efaf3b1fcf41d1b4688a.jpg',
    'https://i.pinimg.com/236x/c1/a5/e0/c1a5e0ab2a69e644a456ba401ade9e6e.jpg',
    'https://i.pinimg.com/474x/fc/cf/c2/fccfc2da1666f953e74e52141cd04776.jpg'
];

const DEFAULT_HEADER_CONTACT_IMAGE = 'https://wallpapercave.com/wp/wp2746574.jpg';
const MESSAGE_TONE_URL = import.meta.env.VITE_MESSAGE_TONE_URL || `${import.meta.env.BASE_URL}notification.mp3`;

const PRESET_CHAT_BACKGROUNDS = [
    {
        id: 'romantic-skyline',
        label: 'Romantic Skyline',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://wallpapercave.com/wp/wp2746574.jpg'
    },
    {
        id: 'soft-love-bokeh',
        label: 'Soft Love Bokeh',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://images.unsplash.com/photo-1632060203408-851cf27a6c48?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGxvdmUlMjB3YWxscGFwZXJ8ZW58MHx8MHx8fDA%3D'
    },
    {
        id: 'pink-hearts-glow',
        label: 'Pink Hearts Glow',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://images7.alphacoders.com/939/thumb-1920-939845.jpg'
    },
    {
        id: 'romantic-couple-hd',
        label: 'Romantic Couple HD',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://img.freepik.com/premium-photo/romantic-couple-hd-8k-wallpaper-stock-photographic-image_915071-59200.jpg'
    },
    {
        id: 'valentine-soft-light',
        label: 'Valentine Soft Light',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://img.freepik.com/premium-photo/valentines-day-th-february_762785-88819.jpg'
    },
    {
        id: 'romantic-desktop-art',
        label: 'Romantic Desktop Art',
        mode: 'light',
        chatMode: 'romantic',
        url: 'https://www.wallsnapy.com/img_gallery/romantic-love-4k-desktop-background-853.jpg'
    },
    {
        id: 'deep-love-night',
        label: 'Deep Love Night',
        mode: 'dark',
        chatMode: 'romantic',
        url: 'https://wallpapercave.com/wp/wp6445768.jpg'
    },
    {
        id: 'dark-rose-neon',
        label: 'Dark Rose Neon',
        mode: 'dark',
        chatMode: 'romantic',
        url: 'https://images.hdqwalls.com/wallpapers/bthumb/only-you-6c.jpg'
    },
    {
        id: 'romantic-night-4k',
        label: 'Romantic Night 4K',
        mode: 'dark',
        chatMode: 'romantic',
        url: 'https://4kwallpapers.com/images/wallpapers/romantic-love-5120x2880-24698.jpg'
    },
    {
        id: 'dark-couple-silhouette',
        label: 'Dark Couple Silhouette',
        mode: 'dark',
        chatMode: 'romantic',
        url: 'https://img.freepik.com/free-photo/silhouetted-couple-sit-bench-autumn-tree-generative-ai_188544-12574.jpg'
    },
    {
        id: 'midnight-valentine',
        label: 'Midnight Valentine',
        mode: 'dark',
        chatMode: 'romantic',
        url: 'https://www.pixelstalk.net/wp-content/uploads/images6/Love-Wallpaper-Phone-HD-Free-download.jpg'
    },
    // Formal Mode Light Backgrounds
    {
        id: 'forest-nature',
        label: 'Forest Nature',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://wallpapercave.com/wp/wp2238948.jpg'
    },
    {
        id: 'serene-nature',
        label: 'Serene Nature',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://static.vecteezy.com/system/resources/thumbnails/049/855/471/small/nature-background-high-resolution-wallpaper-for-a-serene-and-stunning-view-free-photo.jpg'
    },
    {
        id: 'brand-flowers',
        label: 'Brand Flowers',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://microsoft.design/wp-content/uploads/2025/07/Brand-Flowers-Static-1.png'
    },
    {
        id: 'beautiful-wallpaper',
        label: 'Beautiful Wallpaper',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgKHtxBW4TSDJKRcQhlsRi_6vzxAC74O30Lce0xnTbh41XRiSH5lGl398oXrm3Y0_V0-YuiU6j7QJgAZyjitB7gcYmVCfJ7IyC_H7J_HPHRO207A_ddK8njJQPHIrwzsQoKRDEh8l0Wp_M_xvN_Nh55e7qcyAzbMdiTJd3TOXTqRanU4iasli3-f_7O6Q/s3840/BEAUTIFUL-WALLPAPER-5032023.png'
    },
    {
        id: 'cute-cat',
        label: 'Cute Cat Peek',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://wallpapers-clan.com/wp-content/uploads/2024/06/cute-cat-peeking-over-edge-desktop-wallpaper-cover.jpg'
    },
    {
        id: 'desktop-classic',
        label: 'Desktop Classic',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://www.pixelstalk.net/wp-content/uploads/images6/PC-Wallpaper-Desktop.jpg'
    },
    {
        id: 'aesthetic-wallpaper',
        label: 'Aesthetic HD',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://www.pixelstalk.net/wp-content/uploads/images6/PC-Wallpaper-HD-Aesthetic-Free-download.jpg'
    },
    {
        id: 'abstract-tech',
        label: 'Abstract Tech',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcST0n19ibRPjih9eE0m38eh20Jlc1FvjWpsDA&s'
    },
    {
        id: '4k-wallpaper',
        label: '4K Master',
        mode: 'light',
        chatMode: 'formal',
        url: 'https://4kwallpapers.com/images/walls/thumbs_2t/24536.jpg'
    },
    // Formal Mode Dark Backgrounds
    {
        id: 'anime-moon',
        label: 'Anime Moon Landscape',
        mode: 'dark',
        chatMode: 'formal',
        url: 'https://img.freepik.com/free-photo/anime-moon-landscape_23-2151645871.jpg?semt=ais_incoming&w=740&q=80'
    },
    {
        id: 'minimalist-dark',
        label: 'Minimalist Design',
        mode: 'dark',
        chatMode: 'formal',
        url: 'https://i.pinimg.com/originals/ec/b9/2d/ecb92d18c7855c986a5571c1b6f7cad2.jpg'
    },
    {
        id: 'minimalism-4k',
        label: 'Minimalism 4K',
        mode: 'dark',
        chatMode: 'formal',
        url: 'https://c4.wallpaperflare.com/wallpaper/586/603/742/minimalism-4k-for-mac-desktop-wallpaper-preview.jpg'
    },
    {
        id: 'night-ocean',
        label: 'Night Ocean',
        mode: 'dark',
        chatMode: 'formal',
        url: 'https://img.freepik.com/free-vector/night-ocean-landscape-full-moon-stars-shine_107791-7397.jpg?semt=ais_incoming&w=740&q=80'
    }
];

function getReplayDelay(message, speed) {
    const messageLength = String(message?.message || '').length;
    const dynamicDelay = Math.min(2000, 300 + messageLength * 20);
    const speedFactor = speed / 500;
    return Math.max(180, Math.round(dynamicDelay * speedFactor));
}

function isTypingTarget(target) {
    if (!target) {
        return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

function parseChatDateTime(dateText, timeText) {
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

function pickBackgroundTone({ chatMode, resolvedTheme, selectedBackground, presetOption }) {
    const normalized = `${presetOption?.label || ''} ${selectedBackground || ''}`.toLowerCase();
    const isDarkBackground =
        resolvedTheme === 'dark' ||
        presetOption?.mode === 'dark' ||
        /night|midnight|dark|moon|silhouette/.test(normalized);
    const isRomanticBackground =
        chatMode === 'romantic' ||
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

function getBackgroundThemeTokens(tone) {
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

function formatLastSeenLabel(value) {
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

function deriveSharedRoomId(secret) {
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

function toChatDate(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function toChatTime(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    }).toLowerCase();
}

function pseudonymFromUid(uidValue) {
    const safeUid = String(uidValue || '').trim();
    if (!safeUid) {
        return 'Member';
    }

    const compact = safeUid.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
    return `Member ${compact || 'USER'}`;
}

function decryptDisplayNameSafely(encryptedValue, secret) {
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

function mapLiveMessageToUiMessage(entry, secret, viewerUserId, resolveSenderLabel) {
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

    return {
        id: `live-${entry.id}`,
        firestoreId: entry.id,
        sender,
        uid: senderUid,
        message: text,
        date: toChatDate(createdAtDate),
        time: toChatTime(createdAtDate),
        type: entry?.type || 'text',
        isSystem: entry?.type === 'system',
        reactions: entry?.reactions || {},
        createdAtMs,
        encrypted: isEncrypted,
        decryptionError,
        deliveredTo,
        readBy,
        deliveryStatus
    };
}

function App() {
    const VIRTUALIZE_THRESHOLD = 350;
    const firebaseReady = isFirebaseConfigured();
    const dispatch = useDispatch();
    const authSession = useSelector(selectAuthSession);
    const chatMode = useSelector(selectChatMode);
    const themePreference = useSelector(selectThemePreference);
    const currentUser = useSelector(selectCurrentUser);
    const persistedRoomId = useSelector(selectLastRoomId);
    const [authUid, setAuthUid] = useState('');
    const [authReady, setAuthReady] = useState(() => !firebaseReady);
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [authError, setAuthError] = useState('');
    const [firebaseError, setFirebaseError] = useState('');
    const [avatars, setAvatars] = useState({});
    const [chatBackground, setChatBackground] = useState('');
    const [search, setSearch] = useState('');
    const [roomId, setRoomId] = useState(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('room');
        return sanitizeRoomId(fromUrl || persistedRoomId || 'room1');
    });
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [liveLoading, setLiveLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    const [presenceUsers, setPresenceUsers] = useState({});
    const [oldestCursor, setOldestCursor] = useState(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [summary, setSummary] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [isClearingChat, setIsClearingChat] = useState(false);
    const [isDeletingChatData, setIsDeletingChatData] = useState(false);
    const [visibleMessages, setVisibleMessages] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(500);
    const [isTyping, setIsTyping] = useState(false);
    const [replayMode, setReplayMode] = useState(false);
    const [replayIndex, setReplayIndex] = useState(0);
    const [replayStartIndex, setReplayStartIndex] = useState(0);
    const [replaySegment, setReplaySegment] = useState('all');
    const [scrubValue, setScrubValue] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState('appearance');
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const [showSearch, setShowSearch] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const shouldReduceMotion = useReducedMotion();
    const hasOpenAIKey = Boolean(import.meta.env.VITE_OPENAI_API_KEY?.trim());

    const chatCaptureRef = useRef(null);
    const messageRefs = useRef({});
    const replayTimerRef = useRef(null);
    const parseFlushTimerRef = useRef(null);
    const pendingChunkMessagesRef = useRef([]);
    const pendingChunkUsersRef = useRef(new Set());
    const chatScrollRef = useRef(null);
    const virtuosoRef = useRef(null);
    const bottomAnchorRef = useRef(null);
    const defaultLoadedRef = useRef(false);
    const migratedRoomsRef = useRef(new Set());
    const touchStartRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingFirestoreRef = useRef(false);
    const presenceOnlineRef = useRef(null);
    const lastPresenceWriteRef = useRef(0);
    const knownLiveMessageIdsRef = useRef(new Set());
    const initialLiveSnapshotLoadedRef = useRef(false);
    const notificationAudioContextRef = useRef(null);
    const notificationSoundRef = useRef(null);
    const audioUnlockedRef = useRef(false);
    const pendingIncomingToneRef = useRef(false);
    const hasExplicitRoomRef = useRef(Boolean(new URLSearchParams(window.location.search).get('room') || persistedRoomId));
    const deliveredMarkedRef = useRef(new Set());
    const readMarkedRef = useRef(new Set());
    const roomDataClearedRef = useRef(false);

    const authSecret = authSession?.secret || '';
    const isLoggedIn = Boolean(authSession?.displayName && authSession?.secret);
    const userId = authUid || currentUser;
    const encryptedCurrentUserName = useMemo(() => {
        const safeCurrentUser = String(currentUser || '').trim();
        if (!safeCurrentUser || !authSecret) {
            return '';
        }

        try {
            return encryptMessage(safeCurrentUser, authSecret);
        } catch {
            return '';
        }
    }, [currentUser, authSecret]);

    const resolveLiveSenderLabel = useCallback(
        (uidValue, legacySender, encryptedSender) => {
            const safeUid = String(uidValue || '').trim();
            if (safeUid && safeUid === authUid) {
                return currentUser || authSession?.displayName || 'You';
            }

            const decryptedSender = decryptDisplayNameSafely(encryptedSender, authSecret);
            if (decryptedSender) {
                return decryptedSender;
            }

            const legacyLabel = String(legacySender || '').trim();
            if (legacyLabel && safeUid && legacyLabel !== safeUid) {
                return legacyLabel;
            }

            return pseudonymFromUid(safeUid || legacyLabel);
        },
        [authUid, currentUser, authSession?.displayName, authSecret]
    );

    const playSynthPing = useCallback((ctx) => {
        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        masterGain.connect(ctx.destination);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(840, now);
        osc1.frequency.exponentialRampToValueAtTime(1040, now + 0.18);
        osc1.connect(masterGain);

        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(680, now + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(900, now + 0.26);
        osc2.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + 0.24);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.38);
    }, []);

    const ensureNotificationAudioElement = useCallback(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        if (!notificationSoundRef.current) {
            try {
                const tone = new Audio(MESSAGE_TONE_URL);
                tone.preload = 'auto';
                tone.volume = 0.65;
                notificationSoundRef.current = tone;
            } catch {
                notificationSoundRef.current = null;
            }
        }

        return notificationSoundRef.current;
    }, []);

    const unlockNotificationAudio = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const tone = ensureNotificationAudioElement();
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;

            if (AudioContextClass) {
                if (!notificationAudioContextRef.current) {
                    notificationAudioContextRef.current = new AudioContextClass();
                }

                const ctx = notificationAudioContextRef.current;
                if (ctx.state !== 'running') {
                    ctx.resume().catch(() => {
                        // Ignore resume failures due to browser gesture policies.
                    });
                }
            }

            if (tone) {
                // Prime the element on user gesture so later plays are less likely to be blocked.
                const previousTime = tone.currentTime;
                const unlockPromise = tone.play();
                if (unlockPromise?.then) {
                    unlockPromise
                        .then(() => {
                            tone.pause();
                            tone.currentTime = previousTime || 0;
                        })
                        .catch(() => {
                            // Ignore element unlock failures; synth fallback may still work.
                        });
                }
            }

            audioUnlockedRef.current = true;

            if (pendingIncomingToneRef.current) {
                pendingIncomingToneRef.current = false;
                if (tone) {
                    tone.currentTime = 0;
                    tone.play().catch(() => {
                        const ctx = notificationAudioContextRef.current;
                        if (ctx?.state === 'running') {
                            playSynthPing(ctx);
                        }
                    });
                    return;
                }

                const ctx = notificationAudioContextRef.current;
                if (ctx?.state === 'running') {
                    playSynthPing(ctx);
                }
            }
        } catch {
            // Do not block chat flow if audio unlock fails.
        }
    }, [ensureNotificationAudioElement, playSynthPing]);

    const playIncomingMessageTone = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const tone = ensureNotificationAudioElement();

            if (tone) {
                tone.currentTime = 0;
                tone.play().catch(() => {
                    const ctx = notificationAudioContextRef.current;
                    if (ctx?.state === 'running') {
                        playSynthPing(ctx);
                        return;
                    }

                    pendingIncomingToneRef.current = true;
                });
                return;
            }

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass && !notificationAudioContextRef.current) {
                notificationAudioContextRef.current = new AudioContextClass();
            }

            const ctx = notificationAudioContextRef.current;
            if (ctx?.state === 'running' && audioUnlockedRef.current) {
                playSynthPing(ctx);
                return;
            }

            pendingIncomingToneRef.current = true;
        } catch {
            // Do not block chat flow if audio playback fails.
        }
    }, [ensureNotificationAudioElement, playSynthPing]);

    const groupedMessages = useMemo(() => groupMessages(messages), [messages]);
    const replaySourceMessages = useMemo(
        () => groupedMessages.slice(replayStartIndex),
        [groupedMessages, replayStartIndex]
    );
    const displayedMessages = replayMode ? visibleMessages : groupedMessages;
    const shouldVirtualize = !replayMode && groupedMessages.length > VIRTUALIZE_THRESHOLD;
    const replayDateMarkers = useMemo(
        () =>
            groupedMessages
                .map((message, index) => ({
                    index,
                    date: message.date,
                    isMarker: index === 0 || groupedMessages[index - 1]?.date !== message.date
                }))
                .filter((item) => item.isMarker),
        [groupedMessages]
    );
    const replayProgress = useMemo(() => {
        if (!groupedMessages.length) {
            return 0;
        }

        if (!replayMode) {
            return groupedMessages.length - 1;
        }

        const offset = visibleMessages.length > 0 ? visibleMessages.length - 1 : 0;
        return Math.min(replayStartIndex + offset, groupedMessages.length - 1);
    }, [groupedMessages, replayMode, replayStartIndex, visibleMessages.length]);
    const scrubPreviewMessage = groupedMessages[scrubValue] || null;
    const defaultAvatarMap = useMemo(() => {
        const nextMap = {};

        users.forEach((user, index) => {
            if (DEFAULT_USER_PROFILE_IMAGES[index]) {
                nextMap[user] = DEFAULT_USER_PROFILE_IMAGES[index];
            }
        });

        return nextMap;
    }, [users]);
    const resolvedTheme = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference;
    const selectedBackgroundPreset = useMemo(
        () => PRESET_CHAT_BACKGROUNDS.find((item) => item.url === chatBackground) || null,
        [chatBackground]
    );
    const backgroundTone = useMemo(
        () =>
            pickBackgroundTone({
                chatMode,
                resolvedTheme,
                selectedBackground: chatBackground,
                presetOption: selectedBackgroundPreset
            }),
        [chatMode, resolvedTheme, chatBackground, selectedBackgroundPreset]
    );
    const backgroundTheme = useMemo(() => getBackgroundThemeTokens(backgroundTone), [backgroundTone]);
    const activeChatBackground =
        chatBackground ||
        DEFAULT_CHAT_BACKGROUND[chatMode]?.[resolvedTheme] ||
        DEFAULT_CHAT_BACKGROUND.formal.light;

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const onMediaChange = (event) => {
            setPrefersDark(event.matches);
        };

        mediaQuery.addEventListener('change', onMediaChange);
        return () => mediaQuery.removeEventListener('change', onMediaChange);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-chat-mode', chatMode);
    }, [chatMode]);

    useEffect(() => {
        if (!firebaseReady) {
            setAuthReady(true);
            return;
        }

        if (!auth) return; // IMPORTANT safety check

        let cancelled = false;

        signInAnonymously(auth)
            .then((credential) => {
                if (cancelled) {
                    return;
                }

                setAuthUid(credential.user?.uid || '');
                setAuthReady(true);
                console.log('✅ Anonymous login successful');
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }

                setFirebaseError('Anonymous login failed. Enable Anonymous Auth in Firebase Console.');
                setAuthReady(true);
                console.error('❌ Auth error:', err);
            });

        return () => {
            cancelled = true;
        };
    }, [firebaseReady]);

    useEffect(() => {
        if (firebaseReady) {
            return;
        }

        setFirebaseError(
            'Firebase is not configured in this deployed build. .env files are not accessible at runtime on GitHub Pages; VITE_FIREBASE_* must be provided at build/deploy time.'
        );
    }, [firebaseReady]);

    useEffect(() => {
        if (!roomId) {
            return;
        }

        dispatch(setLastRoomId(roomId));
    }, [dispatch, roomId]);

    useEffect(() => {
        knownLiveMessageIdsRef.current.clear();
        initialLiveSnapshotLoadedRef.current = false;
    }, [roomId, authUid, isLoggedIn]);

    useEffect(() => {
        const handleUnlock = () => {
            unlockNotificationAudio();
        };

        window.addEventListener('pointerdown', handleUnlock, { passive: true });
        window.addEventListener('keydown', handleUnlock, { passive: true });
        window.addEventListener('touchstart', handleUnlock, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', handleUnlock);
            window.removeEventListener('keydown', handleUnlock);
            window.removeEventListener('touchstart', handleUnlock);
        };
    }, [unlockNotificationAudio]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        dispatch(setCurrentUser(authSession.displayName));
    }, [dispatch, isLoggedIn, authSession?.displayName]);

    useEffect(() => {
        if (!authSession?.secret) {
            return;
        }

        const sharedRoomId = deriveSharedRoomId(authSession.secret);
        hasExplicitRoomRef.current = true;
        setRoomId(sharedRoomId);
        dispatch(setLastRoomId(sharedRoomId));
    }, [dispatch, authSession?.secret]);

    useEffect(() => {
        if (firebaseReady) {
            return;
        }

        if (defaultLoadedRef.current) {
            return;
        }

        defaultLoadedRef.current = true;
        try {
            const parsed = parseWhatsAppChat(sampleChatText);
            setMessages(parsed.messages);
            setUsers(parsed.users);
            setFileName('sample chat.txt');
            setError('');
        } catch (sampleError) {
            setError('Could not load sample chat file.');
        }
    }, []);

    useEffect(() => {
        if (!firebaseReady || !isLoggedIn || !roomId) {
            return;
        }

        const safeRoomId = sanitizeRoomId(roomId);
        if (!safeRoomId || migratedRoomsRef.current.has(safeRoomId)) {
            return;
        }

        migratedRoomsRef.current.add(safeRoomId);
        scrubLegacyRoomMetadata(safeRoomId).catch(() => {
            // Migration is best-effort; leave chat usable if cleanup fails.
        });
    }, [firebaseReady, isLoggedIn, roomId]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !authUid) {
            return;
        }

        setLiveLoading(true);
        setFirebaseError('');
        setAuthError('');
        deliveredMarkedRef.current.clear();
        readMarkedRef.current.clear();

        const unsubMessages = subscribeToRoomMessages(
            roomId,
            (entries, meta) => {
                const mappedMessages = entries.map((entry) => mapLiveMessageToUiMessage(entry, authSecret, authUid, resolveLiveSenderLabel));
                const liveUsers = Array.from(new Set(mappedMessages.map((item) => item.sender).filter(Boolean)));
                const hasDecryptErrors = mappedMessages.some((item) => item.decryptionError);
                const knownIds = knownLiveMessageIdsRef.current;

                if (!initialLiveSnapshotLoadedRef.current) {
                    mappedMessages.forEach((item) => knownIds.add(item.id));
                    initialLiveSnapshotLoadedRef.current = true;
                } else {
                    const hasNewIncoming = mappedMessages.some(
                        (item) => !knownIds.has(item.id) && item.uid !== authUid && !item.isSystem
                    );

                    mappedMessages.forEach((item) => knownIds.add(item.id));

                    if (hasNewIncoming) {
                        playIncomingMessageTone();
                    }
                }

                setMessages((prev) => {
                    const latestIds = new Set(mappedMessages.map((item) => item.id));
                    const firstLatestTime = mappedMessages[0]?.createdAtMs || Number.POSITIVE_INFINITY;
                    const carryOlder = prev.filter((item) => !latestIds.has(item.id) && (item.createdAtMs || 0) < firstLatestTime);
                    return [...carryOlder, ...mappedMessages].sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
                });

                setUsers(liveUsers);
                setOldestCursor(meta?.oldestCursor || null);
                setHasMoreHistory(Boolean(meta?.hasMore));
                setError('');
                setLiveLoading(false);

                if (hasDecryptErrors) {
                    setAuthError('Wrong common password for some encrypted messages.');
                    setFirebaseError('Wrong password: unable to decrypt one or more messages.');
                }
            },
            () => {
                setFirebaseError('Unable to sync messages. Check Firebase rules/config.');
                setLiveLoading(false);
            }
        );

        const unsubTyping = subscribeTypingStatus(
            roomId,
            (nextTypingMap) => {
                setTypingUsers(nextTypingMap);
            },
            () => {
                setFirebaseError('Typing status sync failed.');
            }
        );

        const unsubUsers = subscribeRoomUsers(
            roomId,
            (nextPresenceMap) => {
                setPresenceUsers(nextPresenceMap);
            },
            () => {
                setFirebaseError('Presence sync failed.');
            }
        );

        return () => {
            unsubMessages?.();
            unsubTyping?.();
            unsubUsers?.();
        };
    }, [firebaseReady, roomId, authSecret, authUid, isLoggedIn, resolveLiveSenderLabel, playIncomingMessageTone]);

    useEffect(() => {
        return () => {
            if (notificationSoundRef.current) {
                notificationSoundRef.current.pause();
                notificationSoundRef.current.src = '';
            }
            notificationAudioContextRef.current?.close?.().catch(() => {
                // Ignore audio context close failures.
            });
        };
    }, []);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !userId) {
            return;
        }

        const markPresence = async (online, { force = false } = {}) => {
            if (roomDataClearedRef.current) {
                return;
            }

            const nowMs = Date.now();
            const sameState = presenceOnlineRef.current === online;

            if (!force && sameState && nowMs - lastPresenceWriteRef.current < 25000) {
                return;
            }

            try {
                await setRoomUserPresence(roomId, userId, online, encryptedCurrentUserName);
                presenceOnlineRef.current = online;
                lastPresenceWriteRef.current = nowMs;
            } catch {
                setFirebaseError('Unable to update online status.');
            }
        };

        presenceOnlineRef.current = null;
        markPresence(true, { force: true });
        const heartbeat = window.setInterval(() => {
            if (!document.hidden) {
                markPresence(true);
            }
        }, 45000);

        const handleVisibility = () => {
            if (document.hidden) {
                markPresence(false, { force: true });
            } else {
                markPresence(true, { force: true });
            }
        };

        const handleOnline = () => {
            markPresence(true, { force: true });
        };

        const handleOffline = () => {
            markPresence(false, { force: true });
        };

        const handleBeforeUnload = () => {
            markPresence(false, { force: true });
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.clearInterval(heartbeat);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (!roomDataClearedRef.current) {
                markPresence(false, { force: true });
            }
        };
    }, [firebaseReady, roomId, userId, currentUser, authSession?.displayName, isLoggedIn, encryptedCurrentUserName]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !userId) {
            return;
        }

        return () => {
            if (roomDataClearedRef.current) {
                return;
            }

            setTypingStatus(roomId, userId, false, encryptedCurrentUserName).catch(() => {
                // Avoid surfacing cleanup errors to users.
            });
        };
    }, [firebaseReady, roomId, userId, currentUser, isLoggedIn, encryptedCurrentUserName]);

    useEffect(() => {
        messageRefs.current = {};
    }, [messages]);

    useEffect(() => {
        setVisibleMessages([]);
        setReplayMode(false);
        setReplayIndex(0);
        setReplayStartIndex(0);
        setReplaySegment('all');
        setIsPlaying(false);
        setIsTyping(false);
        setScrubValue(0);
    }, [groupedMessages]);

    useEffect(() => {
        if (!groupedMessages.length) {
            return;
        }

        setScrubValue(replayProgress);
    }, [groupedMessages.length, replayProgress]);

    useEffect(() => {
        if (!replayMode || (!visibleMessages.length && !isTyping)) {
            return;
        }

        bottomAnchorRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'end' });
    }, [visibleMessages, isTyping, replayMode, shouldReduceMotion]);

    useEffect(() => {
        if (replayMode || showInsights) {
            return;
        }

        bottomAnchorRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'end' });
    }, [messages.length, replayMode, showInsights, shouldReduceMotion]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !authUid || !messages.length) {
            return;
        }

        const markDeliveryPromises = [];
        const markReadPromises = [];

        messages.forEach((message) => {
            if (!message.firestoreId || message.uid === authUid) {
                return;
            }

            const deliveredKey = `${message.firestoreId}:${authUid}:delivered`;
            const readKey = `${message.firestoreId}:${authUid}:read`;

            if (!message.deliveredTo?.[authUid] && !deliveredMarkedRef.current.has(deliveredKey)) {
                deliveredMarkedRef.current.add(deliveredKey);
                markDeliveryPromises.push(markMessageDelivered(roomId, message.firestoreId, authUid));
            }

            if (!document.hidden && !message.readBy?.[authUid] && !readMarkedRef.current.has(readKey)) {
                readMarkedRef.current.add(readKey);
                markReadPromises.push(markMessageRead(roomId, message.firestoreId, authUid));
            }
        });

        if (markDeliveryPromises.length) {
            Promise.allSettled(markDeliveryPromises).catch(() => {
                setFirebaseError('Unable to update delivered status.');
            });
        }

        if (markReadPromises.length) {
            Promise.allSettled(markReadPromises).catch(() => {
                setFirebaseError('Unable to update read status.');
            });
        }
    }, [firebaseReady, authUid, messages, roomId, isLoggedIn]);

    useEffect(() => {
        return () => {
            if (parseFlushTimerRef.current) {
                window.clearTimeout(parseFlushTimerRef.current);
            }

            if (typingTimeoutRef.current) {
                window.clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isPlaying || !replayMode) {
            setIsTyping(false);
            return;
        }

        if (replayIndex >= replaySourceMessages.length) {
            setIsPlaying(false);
            setIsTyping(false);
            return;
        }

        const nextMessage = replaySourceMessages[replayIndex];
        const delay = getReplayDelay(nextMessage, speed);
        setIsTyping(true);

        replayTimerRef.current = window.setTimeout(() => {
            setVisibleMessages((prev) => [...prev, nextMessage]);
            setReplayIndex((prev) => prev + 1);
            setIsTyping(false);
        }, delay);

        return () => {
            if (replayTimerRef.current) {
                window.clearTimeout(replayTimerRef.current);
            }
        };
    }, [isPlaying, replayMode, replayIndex, replaySourceMessages, speed]);

    const highlightedIds = useMemo(() => {
        if (!search.trim() || replayMode) {
            return [];
        }

        return groupedMessages.filter((msg) => includesQuery(msg.message, search)).map((msg) => msg.id);
    }, [groupedMessages, replayMode, search]);
    const highlightedIdSet = useMemo(() => new Set(highlightedIds), [highlightedIds]);
    const messageIndexById = useMemo(() => {
        const indexMap = new Map();
        groupedMessages.forEach((message, index) => {
            indexMap.set(message.id, index);
        });
        return indexMap;
    }, [groupedMessages]);
    const activeSearchId = highlightedIds[activeSearchIndex] || null;

    useEffect(() => {
        if (!users.length) {
            return;
        }

        if (!currentUser) {
            dispatch(setCurrentUser(users[0]));
            return;
        }

        if (!firebaseReady && !users.includes(currentUser)) {
            dispatch(setCurrentUser(users[0]));
        }
    }, [dispatch, users, currentUser, firebaseReady]);

    const scrollToSearchMatch = useCallback((nextIndex) => {
        if (!highlightedIds.length) {
            return;
        }

        const safeIndex = ((nextIndex % highlightedIds.length) + highlightedIds.length) % highlightedIds.length;
        const messageId = highlightedIds[safeIndex];
        const rowIndex = messageIndexById.get(messageId);

        if (shouldVirtualize && Number.isInteger(rowIndex)) {
            virtuosoRef.current?.scrollToIndex({
                index: rowIndex,
                align: 'center',
                behavior: shouldReduceMotion ? 'auto' : 'smooth'
            });
        } else {
            const node = messageRefs.current[messageId];
            if (node) {
                node.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'center' });
            }
        }

        setActiveSearchIndex(safeIndex);
    }, [highlightedIds, messageIndexById, shouldReduceMotion, shouldVirtualize]);

    useEffect(() => {
        setActiveSearchIndex(0);
    }, [search, replayMode]);

    useEffect(() => {
        if (!showSearch) {
            return;
        }

        if (!highlightedIds.length) {
            return;
        }

        scrollToSearchMatch(0);
    }, [highlightedIds, scrollToSearchMatch, showSearch]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isTypingTarget(event.target) || !groupedMessages.length) {
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                if (isPlaying) {
                    handlePauseReplay();
                } else {
                    handlePlayReplay();
                }
                return;
            }

            if (event.key === 'r' || event.key === 'R') {
                event.preventDefault();
                handleResetReplay();
                return;
            }

            if (event.key === '1') {
                setSpeed(1000);
                return;
            }

            if (event.key === '2') {
                setSpeed(500);
                return;
            }

            if (event.key === '3') {
                setSpeed(200);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [groupedMessages.length, isPlaying, replayMode]);

    const otherParticipantNames = useMemo(() => {
        const selfUid = String(authUid || '').trim();
        const selfNames = new Set(
            [currentUser, authSession?.displayName, resolveLiveSenderLabel(selfUid)]
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        );
        const seen = new Set();
        const orderedNames = [];

        for (let index = groupedMessages.length - 1; index >= 0; index -= 1) {
            const messageUid = String(groupedMessages[index]?.uid || '').trim();
            if (selfUid && messageUid === selfUid) {
                continue;
            }

            const sender = String(groupedMessages[index]?.sender || '').trim();
            const normalizedSender = sender.toLowerCase();

            if (!sender || groupedMessages[index]?.isSystem || selfNames.has(normalizedSender) || seen.has(normalizedSender)) {
                continue;
            }

            seen.add(normalizedSender);
            orderedNames.push(sender);
        }

        Object.entries(presenceUsers).forEach(([uid, entry]) => {
            if (selfUid && String(uid || '').trim() === selfUid) {
                return;
            }

            const name = decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid);
            const normalizedName = name.toLowerCase();

            if (!name || selfNames.has(normalizedName) || seen.has(normalizedName)) {
                return;
            }

            seen.add(normalizedName);
            orderedNames.push(name);
        });

        users.forEach((user) => {
            const name = String(user || '').trim();
            const normalizedName = name.toLowerCase();

            if (!name || selfNames.has(normalizedName) || seen.has(normalizedName)) {
                return;
            }

            seen.add(normalizedName);
            orderedNames.push(name);
        });

        return orderedNames;
    }, [groupedMessages, presenceUsers, users, currentUser, authSession?.displayName, authUid, resolveLiveSenderLabel, authSecret]);
    const otherUser = otherParticipantNames[0] || 'Waiting for others';
    const contactName = otherUser;
    const contactMessages = useMemo(
        () => groupedMessages.filter((message) => message.sender === contactName),
        [groupedMessages, contactName]
    );
    const contactMeta = useMemo(() => {
        const livePresenceEntries = Object.entries(presenceUsers).filter(([uid]) => uid !== authUid);
        const livePresence =
            livePresenceEntries.find(([uid, entry]) => (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)) === contactName)?.[1] ||
            livePresenceEntries.find(([uid, entry]) => (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)) === otherUser)?.[1] ||
            livePresenceEntries[0]?.[1] ||
            null;
        const liveOnlineEntries = livePresenceEntries.filter(([, entry]) => Boolean(entry?.online));
        const onlineNames = liveOnlineEntries
            .map(([uid, entry]) => decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid))
            .filter(Boolean);

        if (!contactMessages.length && !livePresence) {
            return {
                isOnline: false,
                lastSeenLabel: '',
                statusLine: 'Last seen recently',
                messageCount: 0,
                activeDayCount: 0
            };
        }

        const lastMessage = contactMessages[contactMessages.length - 1] || null;
        const lastSeenDate = lastMessage ? parseChatDateTime(lastMessage.date, lastMessage.time) : null;
        const activeDays = new Set(contactMessages.map((message) => message.date));
        const liveLastSeenRaw = livePresence?.lastSeen?.toDate?.() || null;
        const effectiveLastSeen = liveLastSeenRaw || lastSeenDate;
        const now = new Date();
        const diffMs = effectiveLastSeen ? Math.abs(now.getTime() - effectiveLastSeen.getTime()) : Number.POSITIVE_INFINITY;
        const liveOnline = typeof livePresence?.online === 'boolean' ? livePresence.online : null;
        const isOnline = liveOnlineEntries.length > 0 || (liveOnline ?? diffMs <= 5 * 60 * 1000);
        let statusLine = 'Last seen recently';

        if (liveOnlineEntries.length > 1) {
            statusLine = `${liveOnlineEntries.length} users online`;
        } else if (liveOnlineEntries.length === 1) {
            statusLine = `${onlineNames[0] || 'Someone'} is online`;
        } else {
            const formattedLastSeen = formatLastSeenLabel(effectiveLastSeen);
            statusLine = formattedLastSeen ? `Last seen ${formattedLastSeen}` : 'Last seen recently';
        }

        return {
            isOnline,
            lastSeenLabel: formatLastSeenLabel(effectiveLastSeen),
            statusLine,
            messageCount: contactMessages.length,
            activeDayCount: activeDays.size
        };
    }, [contactMessages, presenceUsers, contactName, otherUser, authUid, authSecret]);

    const typingIndicatorText = useMemo(() => {
        const liveTypingUsers = Object.entries(typingUsers)
            .filter(([uid, value]) => uid !== authUid && Boolean(value?.isTyping))
            .map(([uid, value]) => decryptDisplayNameSafely(value?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid));

        if (!liveTypingUsers.length) {
            return '';
        }

        if (liveTypingUsers.length === 1) {
            return `${liveTypingUsers[0]} is typing...`;
        }

        if (liveTypingUsers.length === 2) {
            return `${liveTypingUsers[0]}, ${liveTypingUsers[1]} are typing...`;
        }

        return `${liveTypingUsers[0]}, ${liveTypingUsers[1]} and ${liveTypingUsers.length - 2} other${liveTypingUsers.length - 2 > 1 ? 's' : ''} are typing...`;
    }, [typingUsers, authUid, authSecret]);

    const shouldRenderDateChip = (list, index) => {
        if (index === 0) {
            return true;
        }
        return list[index - 1]?.date !== list[index]?.date;
    };

    const handleParsed = (parsed, loadedFileName) => {
        if (parseFlushTimerRef.current) {
            window.clearTimeout(parseFlushTimerRef.current);
            parseFlushTimerRef.current = null;
        }
        pendingChunkMessagesRef.current = [];
        pendingChunkUsersRef.current = new Set();
        setMessages(parsed.messages);
        setUsers(parsed.users);
        setFileName(loadedFileName);
        setSummary('');
        setParseProgress(100);
        setError('');
    };

    const handleParseStart = useCallback((loadedFileName) => {
        if (parseFlushTimerRef.current) {
            window.clearTimeout(parseFlushTimerRef.current);
            parseFlushTimerRef.current = null;
        }
        pendingChunkMessagesRef.current = [];
        pendingChunkUsersRef.current = new Set();
        setMessages([]);
        setUsers([]);
        setReplayMode(false);
        setIsPlaying(false);
        setIsTyping(false);
        setReplayIndex(0);
        setReplayStartIndex(0);
        setVisibleMessages([]);
        setFileName(loadedFileName || '');
        setParseProgress(0);
        setSummary('');
        setError('');
    }, []);

    const flushPendingParseChunks = useCallback(() => {
        parseFlushTimerRef.current = null;

        const nextMessages = pendingChunkMessagesRef.current;
        const nextUsers = Array.from(pendingChunkUsersRef.current);

        pendingChunkMessagesRef.current = [];
        pendingChunkUsersRef.current = new Set();

        if (nextMessages.length) {
            setMessages((prev) => [...prev, ...nextMessages]);
        }

        if (nextUsers.length) {
            setUsers((prev) => Array.from(new Set([...prev, ...nextUsers])).sort());
        }
    }, []);

    const handleParseChunk = useCallback((chunk) => {
        if (!chunk?.messages?.length) {
            return;
        }

        pendingChunkMessagesRef.current.push(...chunk.messages);
        if (chunk.users?.length) {
            chunk.users.forEach((user) => pendingChunkUsersRef.current.add(user));
        }

        if (!parseFlushTimerRef.current) {
            parseFlushTimerRef.current = window.setTimeout(flushPendingParseChunks, 110);
        }
    }, [flushPendingParseChunks]);

    const startReplay = (startIndex = 0) => {
        if (!groupedMessages.length) {
            return;
        }

        if (replayTimerRef.current) {
            window.clearTimeout(replayTimerRef.current);
        }

        setScrubValue(startIndex);
        setReplayStartIndex(startIndex);
        setReplayIndex(0);
        setVisibleMessages([]);
        setReplayMode(true);
        setIsTyping(false);
        setIsPlaying(true);
        setError('');
    };

    const handlePauseReplay = () => {
        if (replayTimerRef.current) {
            window.clearTimeout(replayTimerRef.current);
        }
        setIsPlaying(false);
        setIsTyping(false);
    };

    const handleResetReplay = () => {
        if (replayTimerRef.current) {
            window.clearTimeout(replayTimerRef.current);
        }
        setVisibleMessages([]);
        setReplayIndex(0);
        setReplayStartIndex(0);
        setScrubValue(groupedMessages.length ? groupedMessages.length - 1 : 0);
        setReplayMode(false);
        setIsPlaying(false);
        setIsTyping(false);
    };

    const handlePlayReplay = () => {
        if (!groupedMessages.length) {
            return;
        }

        if (replaySegment === 'live') {
            handleResetReplay();
            return;
        }

        if (!replayMode) {
            startReplay(replaySegment === 'from-here' ? scrubValue : 0);
            return;
        }

        setIsPlaying(true);
    };

    const handleScrubPreview = (nextIndex) => {
        if (!groupedMessages.length) {
            return;
        }

        const safeIndex = Math.max(0, Math.min(nextIndex, groupedMessages.length - 1));
        setScrubValue(safeIndex);
    };

    const handleScrubReplay = (nextIndex) => {
        if (!groupedMessages.length) {
            return;
        }

        const safeIndex = Math.max(0, Math.min(nextIndex, groupedMessages.length - 1));
        setReplaySegment('from-here');
        startReplay(safeIndex);
    };

    const handleReplaySegmentChange = (nextSegment) => {
        setReplaySegment(nextSegment);

        if (nextSegment === 'live') {
            handleResetReplay();
            return;
        }

        if (nextSegment === 'all') {
            setScrubValue(0);
        }
    };

    const handleToggleTimeline = () => {
        setShowTimeline((prev) => {
            const next = !prev;

            // Closing timeline should also stop/reset replay so chat returns to normal.
            if (!next) {
                handleResetReplay();
            }

            return next;
        });
    };

    const handleSecretLogin = ({ displayName, secret }) => {
        const safeDisplayName = String(displayName || '').trim();
        const safeSecret = String(secret || '');

        if (safeDisplayName.length < 2 || safeSecret.length < 6) {
            setAuthError('Use a valid display name and common password.');
            return;
        }

        const nextSession = {
            displayName: safeDisplayName,
            secret: safeSecret
        };

        setAuthError('');
        dispatch(setAuthSession(nextSession));
        dispatch(setCurrentUser(safeDisplayName));

        const sharedRoomId = deriveSharedRoomId(safeSecret);
        hasExplicitRoomRef.current = true;
        setRoomId(sharedRoomId);
        dispatch(setLastRoomId(sharedRoomId));
        resetRoomTimelineState();
    };

    const handleLogout = async () => {
        roomDataClearedRef.current = false;

        if (firebaseReady && isLoggedIn) {
            await Promise.allSettled([
                setTypingStatus(roomId, userId, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, userId, false, encryptedCurrentUserName)
            ]);
        }

        deliveredMarkedRef.current.clear();
        readMarkedRef.current.clear();
        setMessages([]);
        setUsers([]);
        setTypingUsers({});
        setPresenceUsers({});
        setDraftMessage('');
        setSearch('');
        setError('');
        setAuthError('');
        setFirebaseError('');
        setStatusMessage('');
        resetRoomTimelineState();
        dispatch(clearAuthSession());

        try {
            await persistor.purge();
        } catch {
            // Continue logout flow even if persist purge fails.
        }

        if (typeof window !== 'undefined') {
            try {
                window.localStorage.clear();
            } catch {
                // Ignore localStorage clear failures.
            }

            try {
                window.sessionStorage.clear();
            } catch {
                // Ignore sessionStorage clear failures.
            }
        }

        setRoomId('room1');
    };

    const resetRoomTimelineState = () => {
        setReplayMode(false);
        setIsPlaying(false);
        setVisibleMessages([]);
        setMessages([]);
        setOldestCursor(null);
        setHasMoreHistory(false);
    };

    const handleLoadOlderMessages = useCallback(async () => {
        if (!firebaseReady || !authUid || !oldestCursor || loadingOlder || !hasMoreHistory) {
            return;
        }

        setLoadingOlder(true);
        try {
            const page = await fetchOlderRoomMessages(roomId, oldestCursor);
            const mappedOlder = page.messages.map((entry) => mapLiveMessageToUiMessage(entry, authSecret, authUid, resolveLiveSenderLabel));

            setMessages((prev) => {
                const existing = new Map(prev.map((item) => [item.id, item]));
                mappedOlder.forEach((item) => {
                    if (!existing.has(item.id)) {
                        existing.set(item.id, item);
                    }
                });
                return Array.from(existing.values()).sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
            });

            setOldestCursor(page.oldestCursor);
            setHasMoreHistory(Boolean(page.hasMore));
        } catch {
            setFirebaseError('Unable to load older messages.');
        } finally {
            setLoadingOlder(false);
        }
    }, [firebaseReady, authUid, oldestCursor, loadingOlder, hasMoreHistory, roomId, authSecret, resolveLiveSenderLabel]);

    const handleLiveDraftChange = (nextValue) => {
        setDraftMessage(nextValue);

        if (!firebaseReady || !userId || roomDataClearedRef.current) {
            return;
        }

        const typing = Boolean(nextValue.trim());

        // If cleared to empty — immediately mark not typing
        if (!typing) {
            if (isTypingFirestoreRef.current) {
                isTypingFirestoreRef.current = false;
                if (typingTimeoutRef.current) {
                    window.clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                }
                setTypingStatus(roomId, userId, false, encryptedCurrentUserName).catch(() => {
                    setFirebaseError('Unable to update typing indicator.');
                });
            }
            return;
        }

        // Only write to Firestore on transition: not typing → typing
        if (!isTypingFirestoreRef.current) {
            isTypingFirestoreRef.current = true;
            setTypingStatus(roomId, userId, true, encryptedCurrentUserName).catch(() => {
                setFirebaseError('Unable to update typing indicator.');
            });
        }

        // Reset stop-typing debounce on every keystroke
        if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = window.setTimeout(() => {
            isTypingFirestoreRef.current = false;
            setTypingStatus(roomId, userId, false, encryptedCurrentUserName).catch(() => {
                setFirebaseError('Unable to update typing indicator.');
            });
        }, 1500);
    };

    const handleSendLiveMessage = async () => {
        if (!firebaseReady) {
            setFirebaseError('Firebase config is missing. Add VITE_FIREBASE_* values.');
            return;
        }

        if (!authSecret) {
            setFirebaseError('Common password missing. Please log in again.');
            return;
        }

        if (!authUid) {
            setFirebaseError('Anonymous auth not ready yet. Please wait.');
            return;
        }

        const safeText = String(draftMessage || '').trim();
        if (!safeText) {
            return;
        }

        if (safeText.length > 1200) {
            setFirebaseError('Message is too long (max 1200 chars).');
            return;
        }

        if (!currentUser.trim()) {
            setFirebaseError('Select current user in settings before sending.');
            return;
        }

        roomDataClearedRef.current = false;
        setIsSending(true);
        setFirebaseError('');
        setStatusMessage('');
        try {
            const encryptedText = encryptMessage(safeText, authSecret);
            await sendRoomMessage(roomId, {
                text: encryptedText,
                senderEnc: encryptedCurrentUserName,
                uid: authUid,
                type: 'text',
                encrypted: true,
                cipherVersion: 'aes-v1'
            });
            setDraftMessage('');
            await Promise.allSettled([
                setTypingStatus(roomId, userId, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, userId, true, encryptedCurrentUserName)
            ]);
        } catch (sendError) {
            setFirebaseError(sendError?.message || 'Unable to send message.');
        } finally {
            setIsSending(false);
        }
    };

    const handleClearChat = async () => {
        if (!firebaseReady) {
            setFirebaseError('Firebase config is missing. Add VITE_FIREBASE_* values.');
            return;
        }

        if (!authUid) {
            setFirebaseError('Anonymous auth not ready yet. Please wait.');
            return;
        }

        if (isClearingChat || isDeletingChatData) {
            return;
        }

        const confirmed = window.confirm('Are you sure you want to clear all messages?');
        if (!confirmed) {
            return;
        }

        setIsClearingChat(true);
        setFirebaseError('');
        setStatusMessage('');

        try {
            isTypingFirestoreRef.current = false;

            if (typingTimeoutRef.current) {
                window.clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            await setTypingStatus(roomId, userId, false, encryptedCurrentUserName).catch(() => {
                // Continue clearing messages even if typing cleanup fails.
            });

            await clearRoomMessages(roomId);

            deliveredMarkedRef.current.clear();
            readMarkedRef.current.clear();
            knownLiveMessageIdsRef.current.clear();
            initialLiveSnapshotLoadedRef.current = false;
            setMessages([]);
            setDraftMessage('');
            setSearch('');
            setSummary('');
            setError('');
            setShowInsights(false);
            resetRoomTimelineState();
            setStatusMessage('Chat cleared successfully. No messages yet.');
        } catch (clearError) {
            setFirebaseError(clearError?.message || 'Unable to clear chat messages.');
        } finally {
            setIsClearingChat(false);
        }
    };

    const handleDeleteChatData = async () => {
        if (!firebaseReady) {
            setFirebaseError('Firebase config is missing. Add VITE_FIREBASE_* values.');
            return;
        }

        if (isDeletingChatData) {
            return;
        }

        const confirmed = window.confirm(
            'Delete all current room chat data from Firebase permanently? This removes messages, typing, and presence data and cannot be undone.'
        );

        if (!confirmed) {
            return;
        }

        setIsDeletingChatData(true);
        setFirebaseError('');
        setStatusMessage('');

        try {
            roomDataClearedRef.current = true;
            isTypingFirestoreRef.current = false;

            if (typingTimeoutRef.current) {
                window.clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }

            await Promise.allSettled([
                setTypingStatus(roomId, userId, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, userId, false, encryptedCurrentUserName)
            ]);

            await hardDeleteRoomData(roomId);

            deliveredMarkedRef.current.clear();
            readMarkedRef.current.clear();
            knownLiveMessageIdsRef.current.clear();
            initialLiveSnapshotLoadedRef.current = false;
            setMessages([]);
            setUsers([]);
            setTypingUsers({});
            setPresenceUsers({});
            setDraftMessage('');
            setSearch('');
            setSummary('');
            setError('');
            setShowInsights(false);
            resetRoomTimelineState();
            setStatusMessage('Chat room data deleted permanently from Firebase.');
            window.alert('Chat data deleted permanently from Firebase for this room.');
        } catch (deleteError) {
            roomDataClearedRef.current = false;
            setFirebaseError(deleteError?.message || 'Unable to delete chat data from Firebase.');
        } finally {
            setIsDeletingChatData(false);
        }
    };

    const handleAddReaction = async (message, emoji) => {
        if (!firebaseReady || !message?.firestoreId) {
            return;
        }

        try {
            await addMessageReaction(roomId, message.firestoreId, emoji);
        } catch {
            setFirebaseError('Unable to add reaction.');
        }
    };

    const handleAvatarUpload = (user, file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setAvatars((prev) => ({ ...prev, [user]: String(reader.result || '') }));
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundUpload = (file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setChatBackground(String(reader.result || ''));
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundPresetSelect = (url) => {
        setChatBackground(url || '');
    };

    const handleThemeChange = (nextTheme) => {
        if (!nextTheme) {
            return;
        }

        if (['light', 'dark', 'system'].includes(nextTheme)) {
            dispatch(setThemePreference(nextTheme));
        }
    };

    const handleThemeSwipeStart = (event) => {
        if (window.innerWidth >= 768 || event.touches.length !== 1) {
            touchStartRef.current = null;
            return;
        }

        const touch = event.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            at: Date.now()
        };
    };

    const handleThemeSwipeEnd = (event) => {
        if (window.innerWidth >= 768 || !touchStartRef.current || event.changedTouches.length !== 1) {
            touchStartRef.current = null;
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const elapsed = Date.now() - touchStartRef.current.at;

        touchStartRef.current = null;

        const isHorizontalSwipe = Math.abs(deltaX) >= 72 && Math.abs(deltaY) <= 42 && elapsed <= 700;
        if (!isHorizontalSwipe) {
            return;
        }

        dispatch(setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark'));
    };

    const handleChatSurfaceToggleReplay = (event) => {
        if (!showTimeline || !replayMode || showInsights) {
            return;
        }

        const interactiveTarget = event.target?.closest?.(
            'button, a, input, textarea, select, label, [role="button"], [data-no-replay-toggle="true"]'
        );

        if (interactiveTarget) {
            return;
        }

        if (isPlaying) {
            handlePauseReplay();
            return;
        }

        setIsPlaying(true);
    };

    const handleChatScroll = (event) => {
        if (!firebaseReady || replayMode || showInsights) {
            return;
        }

        const target = event.currentTarget;
        if (!target) {
            return;
        }

        if (target.scrollTop <= 120) {
            handleLoadOlderMessages();
        }
    };

    const handleExport = async () => {
        if (!chatCaptureRef.current) {
            return;
        }

        try {
            const dataUrl = await toPng(chatCaptureRef.current, {
                cacheBust: true,
                pixelRatio: 2
            });
            const link = document.createElement('a');
            link.download = `whatsapp-chat-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (exportError) {
            setError('Unable to export image. Please try again.');
        }
    };

    const handleSummarize = async () => {
        setSummaryLoading(true);
        setError('');
        try {
            const result = await summarizeMessagesWithAI(messages);
            setSummary(result);
        } catch (summaryError) {
            setError('Unable to generate summary right now.');
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleSearchNext = () => {
        scrollToSearchMatch(activeSearchIndex + 1);
    };

    const handleSearchPrev = () => {
        scrollToSearchMatch(activeSearchIndex - 1);
    };

    const handleSearchKeyDown = (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        if (event.shiftKey) {
            handleSearchPrev();
            return;
        }

        handleSearchNext();
    };

    if (!isLoggedIn) {
        return (
            <SecretLogin
                onLogin={handleSecretLogin}
                errorMessage={authError}
                theme={resolvedTheme}
                onThemeChange={handleThemeChange}
                chatMode={chatMode}
                onChatModeChange={(nextMode) => dispatch(setChatMode(nextMode))}
            />
        );
    }

    if (firebaseReady && !authReady) {
        return (
            <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-4">
                <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
                <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />
                <div className="glass-panel rounded-[1.2rem] px-6 py-4 text-sm text-[var(--text-main)]">Signing in anonymously...</div>
            </div>
        );
    }

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden">
            <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
            <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />

            <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col">
                <main className="glass-panel-strong relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none ambient-ring premium-panel-strong">
                    <div ref={chatCaptureRef} className="chat-shell-stage flex h-full min-h-0 flex-col bg-[var(--chat-shell)]">
                        <ChatHeader
                            title={contactName}
                            avatar={avatars[contactName] || avatars[otherUser] || defaultAvatarMap[contactName] || defaultAvatarMap[otherUser] || DEFAULT_HEADER_CONTACT_IMAGE}
                            theme={resolvedTheme}
                            onThemeChange={(nextTheme) => handleThemeChange(nextTheme)}
                            contactMeta={contactMeta}
                            search={search}
                            onSearchChange={setSearch}
                            resultCount={highlightedIds.length}
                            activeMatchIndex={activeSearchIndex}
                            onSearchNext={handleSearchNext}
                            onSearchPrev={handleSearchPrev}
                            onSearchKeyDown={handleSearchKeyDown}
                            onOpenSettings={() => {
                                setSettingsSection('appearance');
                                setSettingsOpen(true);
                            }}
                            onOpenImport={() => {
                                setSettingsSection('import');
                                setSettingsOpen(true);
                            }}
                            onOpenSummary={() => {
                                setSettingsSection('summary');
                                setSettingsOpen(true);
                            }}
                            onExport={handleExport}
                            showSearch={showSearch}
                            onToggleSearch={() => setShowSearch((prev) => !prev)}
                            showTimeline={showTimeline}
                            onToggleTimeline={handleToggleTimeline}
                            showInsights={showInsights}
                            onToggleInsights={() => setShowInsights((prev) => !prev)}
                            onLogout={handleLogout}
                        />
                        <ReplayControls
                            hasMessages={groupedMessages.length > 0}
                            isPlaying={isPlaying}
                            isTyping={isTyping}
                            speed={speed}
                            replayMode={replayMode}
                            replaySegment={replaySegment}
                            progress={replayProgress}
                            scrubValue={scrubValue}
                            scrubPreviewMessage={scrubPreviewMessage}
                            dateMarkers={replayDateMarkers}
                            totalMessages={groupedMessages.length}
                            visibleCount={visibleMessages.length}
                            totalCount={replaySourceMessages.length || groupedMessages.length}
                            showTimeline={showTimeline}
                            onPlay={handlePlayReplay}
                            onPause={handlePauseReplay}
                            onReset={handleResetReplay}
                            onSegmentChange={handleReplaySegmentChange}
                            onScrubPreview={handleScrubPreview}
                            onScrub={handleScrubReplay}
                            onSpeedChange={setSpeed}
                        />

                        <section
                            ref={chatScrollRef}
                            className="chat-wallpaper scroll-thin relative flex-1 overflow-x-hidden overflow-y-auto px-4 pb-16 pt-4 md:px-6 md:pb-20 md:pt-6"
                            onScroll={handleChatScroll}
                            onClick={handleChatSurfaceToggleReplay}
                            onTouchStart={handleThemeSwipeStart}
                            onTouchEnd={handleThemeSwipeEnd}
                            style={{
                                backgroundImage: `url(${activeChatBackground}), var(--wallpaper-pattern), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
                                backgroundSize: 'cover, 140px 140px, cover',
                                backgroundPosition: 'center center, center center, center center',
                                '--accent': backgroundTheme.accent,
                                '--bubble-sent-start': backgroundTheme.sentStart,
                                '--bubble-sent-end': backgroundTheme.sentEnd,
                                '--bubble-sent-border': backgroundTheme.sentBorder,
                                '--bubble-sent-shadow': backgroundTheme.sentShadow,
                                '--bubble-tail-sent': backgroundTheme.tailSent,
                                '--bubble-received-start': backgroundTheme.receivedStart,
                                '--bubble-received-end': backgroundTheme.receivedEnd,
                                '--bubble-received-border': backgroundTheme.receivedBorder,
                                '--bubble-received-shadow': backgroundTheme.receivedShadow
                            }}
                        >
                            <div className="relative z-10 mx-auto w-full md:max-w-4xl">
                                {firebaseReady && hasMoreHistory ? (
                                    <div className="mb-2 flex justify-center">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleLoadOlderMessages}
                                            disabled={loadingOlder}
                                            className="h-8 px-3 text-xs"
                                        >
                                            {loadingOlder ? 'Loading older...' : 'Load older messages'}
                                        </Button>
                                    </div>
                                ) : null}

                                {showInsights ? (
                                    <div className="relative">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowInsights(false)}
                                            className="header-icon-button absolute right-2 top-2 z-20 h-9 w-9 bg-white/78 dark:bg-slate-950/72"
                                            aria-label="Close analysis and return to chat"
                                            title="Close analysis"
                                        >
                                            <X size={16} />
                                        </Button>
                                        <ChatInsights messages={messages} />
                                    </div>
                                ) : groupedMessages.length === 0 && isParsing ? (
                                    <div className="flex h-full min-h-[42vh] items-center justify-center px-4 text-center">
                                        <motion.div
                                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="glass-panel max-w-xl rounded-[1.4rem] p-6"
                                        >
                                            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 text-[var(--accent)]">
                                                <MessageCircleMore size={30} />
                                            </span>
                                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                                                Parsing In Background
                                            </p>
                                            <h2 className="mt-2 text-xl font-bold text-[var(--text-main)]">
                                                Import running smoothly. You can keep using settings while messages load.
                                            </h2>
                                            <p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">
                                                Progress: {parseProgress}%
                                            </p>
                                            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--panel-soft)]">
                                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-cyan-400/80" style={{ width: `${parseProgress}%` }} />
                                            </div>
                                        </motion.div>
                                    </div>
                                ) : groupedMessages.length === 0 ? (
                                    <div className="flex h-full min-h-[42vh] items-center justify-center px-4 text-center">
                                        <motion.div
                                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="glass-panel max-w-xl rounded-[1.4rem] p-6"
                                        >
                                            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 text-[var(--accent)]">
                                                <MessageCircleMore size={30} />
                                            </span>
                                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                                                {firebaseReady && isLoggedIn ? 'No Messages Yet' : 'Start Here'}
                                            </p>
                                            <h2 className="mt-2 text-xl font-bold text-[var(--text-main)]">
                                                {firebaseReady && isLoggedIn
                                                    ? 'No messages yet'
                                                    : 'Bring your WhatsApp export into a refined full-screen chat workspace.'}
                                            </h2>
                                            <p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">
                                                {firebaseReady && isLoggedIn
                                                    ? 'Send a new message to start the room again, or import a conversation from settings.'
                                                    : 'Use the settings or more menu in the header to import files, customize visuals, and generate summaries.'}
                                            </p>
                                        </motion.div>
                                    </div>
                                ) : (
                                    <>
                                        {isParsing ? (
                                            <motion.div
                                                layout={!shouldReduceMotion}
                                                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="sticky top-2 z-20 mx-auto mb-3 w-fit rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 backdrop-blur"
                                            >
                                                Parsing {parseProgress}% • {groupedMessages.length} messages loaded
                                            </motion.div>
                                        ) : null}

                                        {shouldVirtualize ? (
                                            <Virtuoso
                                                ref={virtuosoRef}
                                                data={displayedMessages}
                                                customScrollParent={chatScrollRef.current || undefined}
                                                overscan={500}
                                                increaseViewportBy={{ top: 800, bottom: 1200 }}
                                                itemContent={(index, message) => {
                                                    const isCurrentUser = (Boolean(authUid) && message.uid === authUid) || (currentUser && message.sender === currentUser);
                                                    const showDateChip = shouldRenderDateChip(displayedMessages, index);

                                                    return (
                                                        <div className="px-1">
                                                            {showDateChip ? (
                                                                <div className="my-2.5 flex justify-center">
                                                                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--date-chip)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] shadow-sm">
                                                                        {message.date}
                                                                    </span>
                                                                </div>
                                                            ) : null}

                                                            <ChatBubble
                                                                message={message}
                                                                isCurrentUser={isCurrentUser}
                                                                currentUser={currentUser}
                                                                avatar={avatars[message.sender] || defaultAvatarMap[message.sender]}
                                                                query={search}
                                                                isMatch={highlightedIdSet.has(message.id) || activeSearchId === message.id}
                                                                animateEntry={false}
                                                                onAddReaction={handleAddReaction}
                                                                onReplayFrom={() => {
                                                                    const nextIndex = Math.max(index, 0);
                                                                    setReplaySegment('from-here');
                                                                    setScrubValue(nextIndex);
                                                                    startReplay(nextIndex);
                                                                }}
                                                                messageRef={(node) => {
                                                                    if (node) {
                                                                        messageRefs.current[message.id] = node;
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <AnimatePresence initial={false} mode="popLayout">
                                                {displayedMessages.map((message, index) => {
                                                    const isCurrentUser = (Boolean(authUid) && message.uid === authUid) || (currentUser && message.sender === currentUser);
                                                    const isMatch = highlightedIds.includes(message.id);
                                                    const showDateChip = shouldRenderDateChip(displayedMessages, index);

                                                    const sourceIndex = groupedMessages.findIndex((item) => item.id === message.id);

                                                    return (
                                                        <motion.div
                                                            layout={!shouldReduceMotion}
                                                            key={`${message.id}-wrapper`}
                                                            initial={replayMode && !shouldReduceMotion ? { opacity: 0, y: 10 } : false}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
                                                        >
                                                            {showDateChip ? (
                                                                <motion.div layout={!shouldReduceMotion} className="my-2.5 flex justify-center">
                                                                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--date-chip)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] shadow-sm">
                                                                        {message.date}
                                                                    </span>
                                                                </motion.div>
                                                            ) : null}

                                                            <ChatBubble
                                                                message={message}
                                                                isCurrentUser={isCurrentUser}
                                                                currentUser={currentUser}
                                                                avatar={avatars[message.sender] || defaultAvatarMap[message.sender]}
                                                                query={search}
                                                                isMatch={isMatch || activeSearchId === message.id}
                                                                animateEntry={replayMode}
                                                                onAddReaction={handleAddReaction}
                                                                onReplayFrom={() => {
                                                                    const nextIndex = Math.max(sourceIndex, 0);
                                                                    setReplaySegment('from-here');
                                                                    setScrubValue(nextIndex);
                                                                    startReplay(nextIndex);
                                                                }}
                                                                messageRef={(node) => {
                                                                    if (node) {
                                                                        messageRefs.current[message.id] = node;
                                                                    }
                                                                }}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        )}
                                    </>
                                )}
                            </div>

                            {isTyping && replayMode ? (
                                <div className="my-1.5 flex justify-start fade-slide-in">
                                    <div className="ml-8 flex items-center gap-1.5 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--system-chip)] px-3 py-2 shadow-sm">
                                        <span className="typing-bubble-dot" />
                                        <span className="typing-bubble-dot" />
                                        <span className="typing-bubble-dot" />
                                    </div>
                                </div>
                            ) : null}

                            <div ref={bottomAnchorRef} />
                        </section>
                    </div>
                </main>

                <LiveComposer
                    messageValue={draftMessage}
                    onMessageChange={handleLiveDraftChange}
                    onSendMessage={handleSendLiveMessage}
                    typingText={typingIndicatorText}
                    disabled={!draftMessage.trim() || !firebaseReady}
                    isSending={isSending}
                    isFirebaseReady={firebaseReady}
                    isLoading={liveLoading}
                    encryptedLabel="🔒 Encrypted chat"
                    chatBackground={activeChatBackground}
                />

                {error ? (
                    <p className="mt-1.5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-[var(--error-text)] shadow-sm">
                        {error}
                    </p>
                ) : null}

                {firebaseError ? (
                    <p className="mt-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100 shadow-sm">
                        {firebaseError}
                    </p>
                ) : null}

                {statusMessage ? (
                    <p className="mt-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100 shadow-sm">
                        {statusMessage}
                    </p>
                ) : null}

                <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <SheetContent side="right" className="w-full max-w-[420px] p-3 md:p-4">
                        <SheetHeader>
                            <SheetTitle>Workspace Settings</SheetTitle>
                            <SheetDescription>Control theme, participants, visuals, and export options.</SheetDescription>
                        </SheetHeader>

                        <div className="scroll-thin max-h-[calc(100vh-100px)] space-y-3 overflow-y-auto pr-1">
                            <div className="segmented-control inline-flex w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-1" role="tablist" aria-label="Settings sections">
                                {[
                                    { value: 'import', label: 'Import' },
                                    { value: 'summary', label: 'Summary' },
                                    { value: 'appearance', label: 'Appearance' },
                                    { value: 'participants', label: 'Participants' },
                                    { value: 'export', label: 'Export' }
                                ].map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={settingsSection === item.value}
                                        onClick={() => setSettingsSection(item.value)}
                                        className={`segmented-control__item ${settingsSection === item.value ? 'segmented-control__item--active' : ''}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            {settingsSection === 'import' ? (
                                <FileUpload
                                    onParsed={handleParsed}
                                    onParseChunk={handleParseChunk}
                                    onParseProgress={setParseProgress}
                                    onParseStart={handleParseStart}
                                    onError={setError}
                                    fileName={fileName}
                                    isParsing={isParsing}
                                    onParsingChange={setIsParsing}
                                />
                            ) : null}

                            {settingsSection === 'summary' ? (
                                <Card className="ambient-ring premium-panel rounded-[1.7rem]">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-base font-semibold text-[var(--text-main)]">Conversation Summary</h3>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleSummarize}
                                                disabled={!messages.length || summaryLoading}
                                            >
                                                {summaryLoading ? 'Summarizing…' : 'Generate'}
                                            </Button>
                                        </div>

                                        {!hasOpenAIKey ? (
                                            <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200/90">
                                                OpenAI API key is not configured. Summary will try local Ollama first, then built-in local analysis.
                                            </p>
                                        ) : null}

                                        {summary ? (
                                            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]/85">{summary}</pre>
                                        ) : (
                                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                                                Generate a concise overview of participants, trends, and key moments.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {['appearance', 'participants', 'export'].includes(settingsSection) ? (
                                <SettingsPanel
                                    section={settingsSection}
                                    theme={resolvedTheme}
                                    themePreference={themePreference}
                                    onThemeChange={handleThemeChange}
                                    chatMode={chatMode}
                                    onChatModeChange={(nextMode) => dispatch(setChatMode(nextMode))}
                                    users={users}
                                    currentUser={currentUser}
                                    onCurrentUserChange={setCurrentUser}
                                    onAvatarUpload={handleAvatarUpload}
                                    onBackgroundUpload={handleBackgroundUpload}
                                    selectedBackground={chatBackground}
                                    backgroundOptions={PRESET_CHAT_BACKGROUNDS}
                                    onBackgroundPresetSelect={handleBackgroundPresetSelect}
                                    onExport={handleExport}
                                    onClearChat={handleClearChat}
                                    isClearingChat={isClearingChat}
                                    onDeleteChatData={handleDeleteChatData}
                                    isDeletingChatData={isDeletingChatData}
                                />
                            ) : null}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}

export default App;
