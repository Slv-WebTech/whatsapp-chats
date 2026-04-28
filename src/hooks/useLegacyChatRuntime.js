import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Virtuoso } from 'react-virtuoso';
import { MessageCircleMore, X } from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import ChatHeader from '../components/ChatHeader';
import JoinRequestsPanel from '../components/JoinRequestsPanel';
import GroupSettingsPanel from '../components/GroupSettingsPanel';
import LiveComposer from '../components/LiveComposer';
import ReplayControls from '../components/ReplayControls';
import SecretLogin from '../components/SecretLogin';
import AISidePanel from '../components/AISidePanel';
import { Button } from '../components/ui/button';
import { exportChatAsText, exportChatAsPDF } from '../utils/exportChat';
import { trackEvent } from '../utils/metrics';
import { Card, CardContent } from '../components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import {
    addMessageReaction,
    bookmarkRoomMessage,
    clearRoomMessages,
    deleteRoomMessage,
    ensureChatDocument,
    fetchOlderRoomMessages,
    hardDeleteRoomData,
    hideRoomMessageForUser,
    markMessageDelivered,
    markMessageRead,
    pinRoomMessage,
    scrubLegacyRoomMetadata,
    sanitizeRoomId,
    sendRoomMessage,
    setRoomUserPresence,
    setTypingStatus,
    subscribeRoomUsers,
    subscribeToRoomMessages,
    subscribeTypingStatus
} from '../firebase/chatService';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { getConfiguredAiProviders, summarizeMessagesWithAI } from '../utils/aiSummary';
import {
    autoTagMessage,
    buildMoodTimeline,
    fetchWebContext,
    moderateMessage,
    runAssistantCommand,
    semanticSearch,
    suggestReplies,
    summarizeConversation
} from '../services/ai';
import { groupMessages } from '../utils/groupMessages';
import { includesQuery } from '../utils/highlight';
import { parseWhatsAppChat } from '../utils/parser';
import { encryptMessage } from '../utils/encryption';
import { PRESET_CHAT_BACKGROUNDS } from '../utils/chatBackgrounds';
import { BRAND } from '../config/branding';
import sampleChatText from '../components/Assets/sample chat.txt?raw';
import {
    clearAuthSession,
    resetUserPreferences,
    selectAvatarPreferences,
    selectAuthSession,
    selectChatMode,
    selectCustomBackgroundUrl,
    selectCurrentUser,
    selectLastRoomId,
    selectSelectedBackgroundId,
    selectThemePreference,
    setBackgroundPreference,
    setAuthSession,
    setChatMode,
    setCurrentUser,
    setLastRoomId,
    setThemePreference,
    setUserAvatar
} from '../store/appSessionSlice';
import { selectAuthProfile, selectIsAdmin, updateUserProfile } from '../store/authSlice';
import {
    approveJoinRequest,
    deleteGroupForAll,
    leaveGroupChat,
    loadUserProfile,
    rejectJoinRequest,
    removeGroupMember,
    subscribeChat,
    subscribeGroupJoinRequests,
    updateGroupSettings
} from '../firebase/socialService';
import { persistor } from '../store/store';
import {
    clearOfflineMessages,
    clearOfflineMessagesByRoom,
    enqueueOfflineMessage,
    getOfflineMessagesByRoom,
    removeOfflineMessage
} from '../utils/offlineMessageQueue';
import {
    ACTIVE_ONLINE_WINDOW_MS,
    createOfflineClientId,
    DEFAULT_CHAT_BACKGROUND,
    DEFAULT_HEADER_CONTACT_IMAGE,
    DEFAULT_USER_PROFILE_IMAGES,
    deriveSharedRoomId,
    formatFirebaseDebugError,
    formatLastSeenLabel,
    getBackgroundThemeTokens,
    getEligiblePresetBackgrounds,
    getReplayDelay,
    getRouteChatId,
    isRecoverableSendError,
    isTypingTarget,
    mapLiveMessageToUiMessage,
    mapQueuedMessageToUiMessage,
    parseChatDateTime,
    pickBackgroundTone,
    pickRandomPresetBackgroundId,
    pseudonymFromUid,
    decryptDisplayNameSafely,
    shouldHideConversationMessage,
    timestampToMillis,
    TYPING_STALE_WINDOW_MS
} from '../features/chat/appRuntimeHelpers';

const ChatInsights = lazy(() => import('../components/ChatInsights'));
const SettingsPanel = lazy(() => import('../components/SettingsPanel'));
const MESSAGE_TONE_URL = import.meta.env.VITE_MESSAGE_TONE_URL || `${import.meta.env.BASE_URL}notification.mp3`;

export function useLegacyChatRuntime({ onBackHome, onOpenSidebar, initialChatTitle = '', initialChatId = '', initialChatType = '' }) {
    const VIRTUALIZE_THRESHOLD = 350;
    const firebaseReady = isFirebaseConfigured();
    const dispatch = useDispatch();
    const authSession = useSelector(selectAuthSession);
    const chatMode = useSelector(selectChatMode);
    const themePreference = useSelector(selectThemePreference);
    const currentUser = useSelector(selectCurrentUser);
    const persistedRoomId = useSelector(selectLastRoomId);
    const selectedBackgroundId = useSelector(selectSelectedBackgroundId);
    const customBackgroundUrl = useSelector(selectCustomBackgroundUrl);
    const avatars = useSelector(selectAvatarPreferences);
    const authProfile = useSelector(selectAuthProfile);
    const isAdminUser = useSelector(selectIsAdmin);
    const [authUid, setAuthUid] = useState('');
    const [authReady, setAuthReady] = useState(() => !firebaseReady);
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [authError, setAuthError] = useState('');
    const [firebaseError, setFirebaseError] = useState('');
    const [search, setSearch] = useState('');
    const [roomId, setRoomId] = useState(() => {
        const safeInitialChatId = String(initialChatId || '').trim();
        if (safeInitialChatId) {
            return safeInitialChatId;
        }
        const fromUrl = new URLSearchParams(window.location.search).get('room');
        // Managed mode: derive roomId from /chat/:chatId pathname
        const fromPath = getRouteChatId(window.location.pathname);
        return String(fromPath || fromUrl || persistedRoomId || 'room1').trim();
    });
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator?.onLine !== false));
    const [liveLoading, setLiveLoading] = useState(false);
    const [pendingOutgoingMessages, setPendingOutgoingMessages] = useState([]);
    const [isFlushingOfflineQueue, setIsFlushingOfflineQueue] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    const [presenceUsers, setPresenceUsers] = useState({});
    const [oldestCursor, setOldestCursor] = useState(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [summary, setSummary] = useState('');
    const [summaryProvider, setSummaryProvider] = useState('');
    const [summaryLatencyMs, setSummaryLatencyMs] = useState(0);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryBreakdown, setSummaryBreakdown] = useState(null);
    const [semanticQuery, setSemanticQuery] = useState('');
    const [semanticResults, setSemanticResults] = useState([]);
    const [semanticLoading, setSemanticLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [assistantOutput, setAssistantOutput] = useState('');
    const [lastModerationFlag, setLastModerationFlag] = useState('');
    const [urgencyNotice, setUrgencyNotice] = useState('');
    const [webContext, setWebContext] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [isClearingChat, setIsClearingChat] = useState(false);
    const [isDeletingChatData, setIsDeletingChatData] = useState(false);
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [usernameToast, setUsernameToast] = useState(null);
    const [aiPopup, setAiPopup] = useState(null);
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
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [headerCompact, setHeaderCompact] = useState(false);
    const [searchFilter, setSearchFilter] = useState('all');
    const [deletedForMeIds, setDeletedForMeIds] = useState([]);
    const [rotatingBackgroundId, setRotatingBackgroundId] = useState('');
    const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
    const [prefersReducedData, setPrefersReducedData] = useState(() => Boolean(window.navigator?.connection?.saveData));
    const shouldReduceMotion = useReducedMotion();
    const aiProviders = useMemo(() => getConfiguredAiProviders(), []);
    const hasCloudAiProvider = aiProviders.hasCloudProvider;

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
    const headerCompactRafRef = useRef(null);
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
    const lastNotifiedMessageIdRef = useRef('');
    const hasExplicitRoomRef = useRef(Boolean(new URLSearchParams(window.location.search).get('room') || persistedRoomId || initialChatId));
    const deliveredMarkedRef = useRef(new Set());
    const readMarkedRef = useRef(new Set());
    const roomDataClearedRef = useRef(false);
    const usernameToastTimerRef = useRef(null);
    const aiPopupTimerRef = useRef(null);
    const aiPopupRef = useRef(null);
    const flushingOfflineQueueRef = useRef(false);

    const authSecret = authSession?.secret || '';
    const isLoggedIn = Boolean(authSession?.displayName && authSession?.secret);
    const [joinRequests, setJoinRequests] = useState([]);
    const [showJoinRequests, setShowJoinRequests] = useState(false);
    const [groupOwnerId, setGroupOwnerId] = useState('');
    const [groupChatData, setGroupChatData] = useState(null);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [memberProfilesMap, setMemberProfilesMap] = useState({});

    const isGroupChat = useMemo(() => {
        const normalizedType = String(initialChatType || '').trim().toLowerCase();
        if (normalizedType === 'group') {
            return true;
        }

        const normalizedRoomId = String(roomId || initialChatId || '').trim().toLowerCase();
        if (normalizedRoomId.startsWith('grp-')) {
            return true;
        }

        return /^[a-f0-9]{64}$/i.test(normalizedRoomId);
    }, [initialChatId, initialChatType, roomId]);
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
                tone.volume = 0.85;
                tone.muted = false;
                tone.crossOrigin = 'anonymous';
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
                // Ensure audio element is unmuted and has proper volume for mobile
                try {
                    tone.muted = false;
                    tone.volume = Math.max(tone.volume, 0.8);
                } catch {
                    // Ignore muted property errors on restricted contexts
                }

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
                    try {
                        tone.muted = false;
                        tone.volume = Math.max(tone.volume, 0.8);
                    } catch {
                        // Ignore muted property errors
                    }
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
                try {
                    tone.muted = false;
                    tone.volume = Math.max(tone.volume, 0.8);
                } catch {
                    // Ignore muted property errors on restricted contexts
                }
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

    const requestNotificationPermission = useCallback(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return;
        }

        if (window.Notification.permission === 'default') {
            window.Notification.requestPermission().catch(() => {
                // Ignore permission prompt failures.
            });
        }
    }, []);

    const showIncomingSystemNotification = useCallback(async (message) => {
        if (typeof window === 'undefined' || !message) {
            return;
        }

        if (window.document?.visibilityState === 'visible' && window.document?.hasFocus?.()) {
            return;
        }

        if (!('Notification' in window) || window.Notification.permission !== 'granted') {
            return;
        }

        const messageId = String(message.id || '').trim();
        if (messageId && lastNotifiedMessageIdRef.current === messageId) {
            return;
        }

        lastNotifiedMessageIdRef.current = messageId;

        const senderName = String(message.sender || 'New message').trim();
        const previewText = String(message.message || 'You have a new message').trim() || 'You have a new message';
        const notificationTitle = senderName ? `${senderName}` : BRAND.name;

        const payload = {
            title: notificationTitle,
            body: previewText.slice(0, 160),
            data: {
                roomId,
                url: `${window.location.origin}${import.meta.env.BASE_URL}chat/${encodeURIComponent(String(roomId || '').trim())}`
            },
            tag: `room-${String(roomId || '').trim()}`,
            renotify: true,
            icon: `${import.meta.env.BASE_URL}android-chrome-192x192.png`,
            badge: `${import.meta.env.BASE_URL}favicon-32x32.png`
        };

        try {
            if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    payload
                });
                return;
            }

            const registration = await navigator.serviceWorker?.getRegistration?.();
            if (registration?.showNotification) {
                await registration.showNotification(payload.title, payload);
                return;
            }
        } catch {
            // Fallback to window Notification below.
        }

        try {
            // Browser fallback when a service worker registration is unavailable.
            new window.Notification(payload.title, {
                body: payload.body,
                icon: payload.icon,
                badge: payload.badge,
                tag: payload.tag,
                renotify: payload.renotify,
                data: payload.data
            });
        } catch {
            // Ignore notification display failures.
        }
    }, [roomId]);

    const refreshOfflineQueue = useCallback(async (nextRoomId = roomId, nextAuthUid = authUid) => {
        const safeRoomId = String(nextRoomId || '').trim();
        const safeAuthUid = String(nextAuthUid || '').trim();

        if (!safeRoomId) {
            setPendingOutgoingMessages([]);
            return [];
        }

        const entries = await getOfflineMessagesByRoom(safeRoomId);
        const filteredEntries = entries.filter((item) => !safeAuthUid || String(item?.uid || '').trim() === safeAuthUid);
        setPendingOutgoingMessages(filteredEntries);
        return filteredEntries;
    }, [roomId, authUid]);

    const mergedMessages = useMemo(() => {
        const liveClientIds = new Set(messages.map((message) => String(message?.clientId || '').trim()).filter(Boolean));
        const pendingMessages = pendingOutgoingMessages
            .filter((entry) => !liveClientIds.has(String(entry?.clientId || '').trim()))
            .map((entry) => mapQueuedMessageToUiMessage(entry, authSecret));

        const merged = [...messages, ...pendingMessages]
            .filter((item) => !shouldHideConversationMessage(item))
            .filter((item) => !item?.hiddenForCurrentUser)
            .sort((left, right) => (left.createdAtMs || 0) - (right.createdAtMs || 0));
        if (!deletedForMeIds.length) {
            return merged;
        }

        const hidden = new Set(deletedForMeIds);
        return merged.filter((item) => !hidden.has(item.id));
    }, [messages, pendingOutgoingMessages, authSecret, deletedForMeIds]);
    const groupedMessages = useMemo(() => groupMessages(mergedMessages), [mergedMessages]);
    const replaySourceMessages = useMemo(
        () => groupedMessages.slice(replayStartIndex),
        [groupedMessages, replayStartIndex]
    );
    const displayedMessages = replayMode ? visibleMessages : groupedMessages;
    const shouldVirtualize = !replayMode && groupedMessages.length > VIRTUALIZE_THRESHOLD;
    const virtuosoOverscan = useMemo(() => {
        if (prefersReducedData) {
            return 140;
        }

        return isMobileViewport ? 220 : 500;
    }, [isMobileViewport, prefersReducedData]);
    const virtuosoViewportBy = useMemo(() => {
        if (prefersReducedData) {
            return { top: 200, bottom: 260 };
        }

        return isMobileViewport ? { top: 280, bottom: 460 } : { top: 800, bottom: 1200 };
    }, [isMobileViewport, prefersReducedData]);
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
    const eligiblePresetBackgrounds = useMemo(
        () => getEligiblePresetBackgrounds(chatMode, resolvedTheme),
        [chatMode, resolvedTheme]
    );
    const selectedBackgroundPreset = useMemo(
        () => PRESET_CHAT_BACKGROUNDS.find((item) => item.id === selectedBackgroundId) || null,
        [selectedBackgroundId]
    );
    const rotatingBackgroundPreset = useMemo(
        () => PRESET_CHAT_BACKGROUNDS.find((item) => item.id === rotatingBackgroundId) || null,
        [rotatingBackgroundId]
    );
    const hasSavedBackgroundPreference = Boolean(selectedBackgroundId || customBackgroundUrl);
    const wallpaperPreference = customBackgroundUrl || selectedBackgroundPreset?.url || rotatingBackgroundPreset?.url || '';
    const backgroundTone = useMemo(
        () =>
            pickBackgroundTone({
                chatMode,
                resolvedTheme,
                selectedBackground: wallpaperPreference,
                presetOption: selectedBackgroundPreset || rotatingBackgroundPreset
            }),
        [chatMode, resolvedTheme, wallpaperPreference, selectedBackgroundPreset, rotatingBackgroundPreset]
    );
    const backgroundTheme = useMemo(() => getBackgroundThemeTokens(backgroundTone), [backgroundTone]);
    const activeChatBackground =
        wallpaperPreference ||
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
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const handleViewportResize = () => {
            setIsMobileViewport(window.innerWidth < 768);
            setPrefersReducedData(Boolean(window.navigator?.connection?.saveData));
        };

        handleViewportResize();
        window.addEventListener('resize', handleViewportResize);

        const connection = window.navigator?.connection;
        if (connection?.addEventListener) {
            connection.addEventListener('change', handleViewportResize);
        }

        return () => {
            window.removeEventListener('resize', handleViewportResize);
            if (connection?.removeEventListener) {
                connection.removeEventListener('change', handleViewportResize);
            }
        };
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-chat-mode', chatMode);
    }, [chatMode]);

    useEffect(() => {
        if (hasSavedBackgroundPreference) {
            setRotatingBackgroundId('');
            return;
        }

        setRotatingBackgroundId(pickRandomPresetBackgroundId(eligiblePresetBackgrounds));
    }, [eligiblePresetBackgrounds, hasSavedBackgroundPreference]);

    useEffect(() => {
        if (!firebaseReady) {
            setAuthReady(true);
            return;
        }

        if (!auth) return; // IMPORTANT safety check

        let cancelled = false;

        // If a user is already authenticated (e.g. via Email/Password), skip anonymous sign-in.
        if (auth.currentUser) {
            setAuthUid(auth.currentUser.uid || '');
            setAuthReady(true);
            return;
        }

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
        const routeChatId = getRouteChatId(window.location.pathname);
        if (!routeChatId) {
            return;
        }

        if (!routeChatId || routeChatId === roomId) {
            return;
        }

        setRoomId(routeChatId);
        dispatch(setLastRoomId(routeChatId));
    }, [dispatch, roomId]);

    useEffect(() => {
        knownLiveMessageIdsRef.current.clear();
        initialLiveSnapshotLoadedRef.current = false;
        setHeaderCompact(false);
    }, [roomId, authUid, isLoggedIn]);

    useEffect(() => {
        refreshOfflineQueue(roomId, authUid).catch(() => {
            setPendingOutgoingMessages([]);
        });
    }, [refreshOfflineQueue, roomId, authUid]);

    useEffect(() => {
        const handleUnlock = () => {
            unlockNotificationAudio();
            requestNotificationPermission();
        };

        window.addEventListener('pointerdown', handleUnlock, { passive: true });
        window.addEventListener('keydown', handleUnlock, { passive: true });
        window.addEventListener('touchstart', handleUnlock, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', handleUnlock);
            window.removeEventListener('keydown', handleUnlock);
            window.removeEventListener('touchstart', handleUnlock);
        };
    }, [requestNotificationPermission, unlockNotificationAudio]);

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

        if (hasExplicitRoomRef.current) {
            return;
        }

        // In managed mode (/chat/:chatId), keep roomId bound to route chatId.
        if (Boolean(getRouteChatId(window.location.pathname))) {
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

        const scopedRoomId = String(roomId || '').trim();
        if (!scopedRoomId || migratedRoomsRef.current.has(scopedRoomId)) {
            return;
        }

        migratedRoomsRef.current.add(scopedRoomId);
        scrubLegacyRoomMetadata(scopedRoomId).catch(() => {
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
                const syncedClientIds = Array.from(new Set(mappedMessages.map((item) => String(item?.clientId || '').trim()).filter(Boolean)));

                if (syncedClientIds.length) {
                    const syncedClientIdSet = new Set(syncedClientIds);
                    setPendingOutgoingMessages((prev) => prev.filter((item) => !syncedClientIdSet.has(String(item?.clientId || '').trim())));
                    Promise.allSettled(syncedClientIds.map((clientId) => removeOfflineMessage(clientId))).catch(() => {
                        // Ignore cleanup failures; queue will retry cleanup on next refresh.
                    });
                }

                if (!initialLiveSnapshotLoadedRef.current) {
                    mappedMessages.forEach((item) => knownIds.add(item.id));
                    initialLiveSnapshotLoadedRef.current = true;
                } else {
                    const newIncomingMessages = mappedMessages.filter(
                        (item) => !knownIds.has(item.id) && item.uid !== authUid && !item.isSystem
                    );
                    const hasNewIncoming = newIncomingMessages.length > 0;

                    mappedMessages.forEach((item) => knownIds.add(item.id));

                    if (hasNewIncoming) {
                        playIncomingMessageTone();
                        const latestIncoming = newIncomingMessages[newIncomingMessages.length - 1];
                        showIncomingSystemNotification(latestIncoming);
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
            (snapshotError) => {
                setFirebaseError(formatFirebaseDebugError('Unable to sync messages. Check Firebase rules/config.', snapshotError));
                setLiveLoading(false);
            }
        );

        const unsubTyping = subscribeTypingStatus(
            roomId,
            (nextTypingMap) => {
                setTypingUsers(nextTypingMap);
            },
            (typingSyncError) => {
                setFirebaseError(formatFirebaseDebugError('Typing status sync failed.', typingSyncError));
            }
        );

        const unsubUsers = subscribeRoomUsers(
            roomId,
            (nextPresenceMap) => {
                setPresenceUsers(nextPresenceMap);
            },
            (presenceSyncError) => {
                setFirebaseError(formatFirebaseDebugError('Presence sync failed.', presenceSyncError));
            }
        );

        return () => {
            unsubMessages?.();
            unsubTyping?.();
            unsubUsers?.();
        };
    }, [firebaseReady, roomId, authSecret, authUid, isLoggedIn, resolveLiveSenderLabel, playIncomingMessageTone, showIncomingSystemNotification]);

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

    const flushOfflineQueue = useCallback(async () => {
        if (flushingOfflineQueueRef.current || !firebaseReady || !authUid || !authSecret || !roomId || !isOnline) {
            return;
        }

        const queuedMessages = await getOfflineMessagesByRoom(roomId);
        const scopedMessages = queuedMessages.filter((item) => String(item?.uid || '').trim() === String(authUid || '').trim());

        if (!scopedMessages.length) {
            setPendingOutgoingMessages([]);
            return;
        }

        flushingOfflineQueueRef.current = true;
        setIsFlushingOfflineQueue(true);

        let sentCount = 0;
        let blockedError = null;

        try {
            for (const entry of scopedMessages) {
                try {
                    await sendRoomMessage(roomId, entry.payload);
                    await removeOfflineMessage(entry.id);
                    sentCount += 1;
                } catch (error) {
                    blockedError = error;
                    break;
                }
            }
        } finally {
            await refreshOfflineQueue(roomId, authUid).catch(() => {
                // Ignore queue refresh failures during flush finalization.
            });
            flushingOfflineQueueRef.current = false;
            setIsFlushingOfflineQueue(false);
        }

        if (sentCount > 0) {
            setStatusMessage(`Sent ${sentCount} queued message${sentCount === 1 ? '' : 's'}.`);
        }

        if (blockedError) {
            if (isRecoverableSendError(blockedError)) {
                const remaining = await getOfflineMessagesByRoom(roomId).catch(() => []);
                const remainingCount = remaining.filter((item) => String(item?.uid || '').trim() === String(authUid || '').trim()).length;
                if (remainingCount > 0) {
                    setStatusMessage(`${remainingCount} queued message${remainingCount === 1 ? '' : 's'} still waiting for a stable connection.`);
                }
                return;
            }

            setFirebaseError(formatFirebaseDebugError('Unable to sync queued messages.', blockedError));
        }
    }, [authSecret, authUid, firebaseReady, isOnline, refreshOfflineQueue, roomId]);

    useEffect(() => {
        if (!isLoggedIn || !pendingOutgoingMessages.length || !isOnline) {
            return;
        }

        flushOfflineQueue().catch((error) => {
            setFirebaseError(formatFirebaseDebugError('Offline queue sync failed.', error));
        });
    }, [flushOfflineQueue, isLoggedIn, isOnline, pendingOutgoingMessages.length]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !authUid) {
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
                await setRoomUserPresence(roomId, authUid, online, encryptedCurrentUserName);
                presenceOnlineRef.current = online;
                lastPresenceWriteRef.current = nowMs;
            } catch (presenceError) {
                const errorCode = String(presenceError?.code || '').toLowerCase();
                const isExpectedTransientError =
                    !window.navigator?.onLine ||
                    errorCode.includes('permission-denied') ||
                    errorCode.includes('unauthenticated') ||
                    errorCode.includes('cancelled');

                if (!isExpectedTransientError) {
                    setFirebaseError(formatFirebaseDebugError('Unable to update online status.', presenceError));
                }
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
    }, [firebaseReady, roomId, authUid, currentUser, authSession?.displayName, isLoggedIn, encryptedCurrentUserName]);

    useEffect(() => {
        if (!isLoggedIn) {
            return;
        }

        if (!firebaseReady || !authUid) {
            return;
        }

        return () => {
            if (roomDataClearedRef.current) {
                return;
            }

            setTypingStatus(roomId, authUid, false, encryptedCurrentUserName).catch(() => {
                // Avoid surfacing cleanup errors to users.
            });
        };
    }, [firebaseReady, roomId, authUid, currentUser, isLoggedIn, encryptedCurrentUserName]);

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

        return groupedMessages
            .filter((msg) => {
                const text = String(msg.message || '');
                const isMedia = msg.type === 'media' || /\.(jpg|jpeg|png|gif|webp|mp4|mov|pdf|docx?)$/i.test(text);
                const hasLink = /(https?:\/\/|www\.)/i.test(text);
                const userMatch = includesQuery(String(msg.sender || ''), search);

                if (searchFilter === 'media') {
                    return isMedia && includesQuery(text, search);
                }
                if (searchFilter === 'links') {
                    return hasLink && includesQuery(text, search);
                }
                if (searchFilter === 'users') {
                    return userMatch || includesQuery(text, search);
                }

                return includesQuery(text, search) || userMatch;
            })
            .map((msg) => msg.id);
    }, [groupedMessages, replayMode, search, searchFilter]);
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
            setSearchFilter('all');
        }
    }, [showSearch]);

    useEffect(() => {
        if (!messages.length) {
            setAiSuggestions([]);
            return;
        }

        const timerId = window.setTimeout(() => {
            suggestReplies(messages, currentUser)
                .then((items) => {
                    setAiSuggestions(Array.isArray(items) ? items.slice(0, 3) : []);
                })
                .catch(() => {
                    setAiSuggestions([]);
                });
        }, 280);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [messages, currentUser]);

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
    const preferredChatTitle = String(initialChatTitle || '').trim();
    const hasUsableInitialTitle = Boolean(preferredChatTitle) && !['chat', 'direct chat', 'untitled chat'].includes(preferredChatTitle.toLowerCase());
    const otherUser = otherParticipantNames[0] || (hasUsableInitialTitle ? preferredChatTitle : '') || 'Waiting for others';
    const groupTitle = isGroupChat
        ? (String(groupChatData?.name || '').trim() || (hasUsableInitialTitle ? preferredChatTitle : '') || 'Group chat')
        : '';
    const contactName = isGroupChat ? groupTitle : otherUser;
    const groupParticipantNames = useMemo(() => {
        if (!isGroupChat) {
            return [];
        }

        const names = [];
        const seen = new Set();
        const addName = (value) => {
            const safeName = String(value || '').trim();
            const normalizedName = safeName.toLowerCase();
            if (!safeName || seen.has(normalizedName)) {
                return;
            }
            seen.add(normalizedName);
            names.push(safeName);
        };

        addName(currentUser || authSession?.displayName || 'You');

        const memberUsernames = groupChatData?.memberUsernames || {};
        Object.values(memberUsernames).forEach((name) => addName(name));

        otherParticipantNames.forEach((name) => addName(name));
        users.forEach((name) => addName(name));

        Object.entries(presenceUsers).forEach(([uid, entry]) => {
            const decodedName = decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid);
            addName(decodedName);
        });

        return names;
    }, [isGroupChat, currentUser, authSession?.displayName, groupChatData?.memberUsernames, otherParticipantNames, users, presenceUsers, authSecret]);
    const contactMessages = useMemo(
        () => groupedMessages.filter((message) => message.sender === contactName),
        [groupedMessages, contactName]
    );
    const contactMeta = useMemo(() => {
        const selfUid = String(authUid || '').trim();
        const selfNames = new Set(
            [currentUser, authSession?.displayName]
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        );

        const livePresenceEntries = Object.entries(presenceUsers).filter(([uid, entry]) => {
            const safeUid = String(uid || '').trim();
            if (selfUid && safeUid === selfUid) {
                return false;
            }

            const decodedName = (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)).trim().toLowerCase();
            if (decodedName && selfNames.has(decodedName)) {
                return false;
            }

            return true;
        });

        const livePresence =
            livePresenceEntries.find(([uid, entry]) => (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)) === contactName)?.[1] ||
            livePresenceEntries.find(([uid, entry]) => (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)) === otherUser)?.[1] ||
            livePresenceEntries[0]?.[1] ||
            null;
        const liveOnlineEntries = livePresenceEntries.filter(([, entry]) => Boolean(entry?.online));
        const onlineNames = Array.from(
            new Set(
                liveOnlineEntries
                    .map(([uid, entry]) => (decryptDisplayNameSafely(entry?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)).trim())
                    .filter(Boolean)
            )
        );

        if (isGroupChat) {
            const displayNames = groupParticipantNames.filter(Boolean);
            const onlineDisplayNames = onlineNames.filter(Boolean);
            const previewLimit = 6;
            const visibleNames = onlineDisplayNames.slice(0, previewLimit);
            const remainingCount = Math.max(0, onlineDisplayNames.length - visibleNames.length);
            const statusLine = visibleNames.length
                ? `${visibleNames.join(', ')}${remainingCount > 0 ? `, +${remainingCount}` : ''}`
                : 'No members online';

            return {
                isOnline: onlineDisplayNames.length > 0,
                lastSeenLabel: '',
                statusLine,
                messageCount: displayNames.length,
                activeDayCount: displayNames.length
            };
        }

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

        if (onlineNames.length >= 3) {
            statusLine = `${onlineNames[0]}, ${onlineNames[1]} and ${onlineNames.length - 2} other${onlineNames.length - 2 > 1 ? 's' : ''} are online`;
        } else if (onlineNames.length === 2) {
            statusLine = `${onlineNames[0]}, ${onlineNames[1]} are online`;
        } else if (onlineNames.length === 1) {
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
    }, [contactMessages, presenceUsers, contactName, otherUser, authUid, authSecret, currentUser, authSession?.displayName, isGroupChat, groupParticipantNames]);

    const typingIndicatorText = useMemo(() => {
        const selfNames = new Set(
            [currentUser, authSession?.displayName]
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        );
        const now = Date.now();

        const liveTypingUsers = Object.entries(typingUsers)
            .filter(([uid, value]) => {
                if (!Boolean(value?.isTyping)) {
                    return false;
                }

                if (uid === authUid) {
                    return false;
                }

                const typingUpdatedAt = timestampToMillis(value?.updatedAt || value?.createdAt);
                if (typingUpdatedAt && now - typingUpdatedAt > TYPING_STALE_WINDOW_MS) {
                    return false;
                }

                const livePresence = presenceUsers?.[uid] || null;
                const isPresenceOnline = Boolean(livePresence?.online);
                const lastSeenAt = timestampToMillis(livePresence?.lastSeen);
                const seenRecently = lastSeenAt > 0 && now - lastSeenAt <= ACTIVE_ONLINE_WINDOW_MS;
                if (!isPresenceOnline && !seenRecently) {
                    return false;
                }

                const decodedName = (decryptDisplayNameSafely(value?.encryptedDisplayName, authSecret) || pseudonymFromUid(uid)).trim().toLowerCase();
                return !selfNames.has(decodedName);
            })
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
    }, [typingUsers, presenceUsers, authUid, authSecret, currentUser, authSession?.displayName]);

    const shouldRenderDateChip = (list, index) => {
        if (index === 0) {
            return true;
        }
        return list[index - 1]?.date !== list[index]?.date;
    };

    const appendLocalSystemMessage = useCallback((text) => {
        const safeText = String(text || '').trim();
        if (!safeText) {
            return;
        }

        const timestamp = Date.now();
        setMessages((prev) => [
            ...prev,
            {
                id: `system-${timestamp}`,
                sender: 'AI Assistant',
                uid: 'ai-assistant',
                message: safeText,
                date: toChatDate(timestamp),
                time: toChatTime(timestamp),
                isSystem: true,
                type: 'system',
                createdAtMs: timestamp
            }
        ]);
    }, []);

    const handleSemanticSearch = useCallback(async () => {
        const query = String(semanticQuery || '').trim();
        if (!query || !messages.length) {
            setSemanticResults([]);
            return;
        }

        setSemanticLoading(true);
        try {
            const results = await semanticSearch(messages, query, 6);
            setSemanticResults(results);
        } catch {
            setSemanticResults([]);
        } finally {
            setSemanticLoading(false);
        }
    }, [messages, semanticQuery]);

    useEffect(() => {
        if (!semanticQuery.trim()) {
            setSemanticResults([]);
            return;
        }

        const timerId = window.setTimeout(() => {
            handleSemanticSearch();
        }, 260);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [semanticQuery, handleSemanticSearch]);

    const handleQuickReply = useCallback((value) => {
        const next = String(value || '').trim();
        if (!next) {
            return;
        }

        setDraftMessage(next);
    }, []);

    const handleVoiceInput = useCallback(() => {
        const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!RecognitionClass) {
            setStatusMessage('Voice recognition is not available in this browser.');
            return;
        }

        const recognition = new RecognitionClass();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event?.results?.[0]?.[0]?.transcript || '';
            const safeTranscript = String(transcript).trim();
            if (!safeTranscript) {
                return;
            }

            const summary = safeTranscript.split(/\.|\?|!/).slice(0, 1).join('').trim();
            setDraftMessage((prev) => [prev, safeTranscript].filter(Boolean).join(' ').trim());
            setStatusMessage(summary ? `Voice captured: ${summary.slice(0, 72)}${summary.length > 72 ? '...' : ''}` : 'Voice captured.');
        };

        recognition.onerror = () => {
            setStatusMessage('Voice capture failed. Please try again.');
        };

        recognition.start();
    }, []);

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
        setSummaryProvider('');
        setSummaryLatencyMs(0);
        setSummaryBreakdown(null);
        setSemanticResults([]);
        setAssistantOutput('');
        setWebContext('');
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
        setSummaryProvider('');
        setSummaryLatencyMs(0);
        setSummaryBreakdown(null);
        setSemanticResults([]);
        setAssistantOutput('');
        setWebContext('');
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
                setTypingStatus(roomId, authUid, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, authUid, false, encryptedCurrentUserName)
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
            await clearOfflineMessages();
            await persistor.purge();
        } catch {
            // Continue logout flow even if persist purge fails.
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

        if (!firebaseReady || !authUid) {
            return;
        }

        const typing = Boolean(nextValue.trim());

        if (typing && roomDataClearedRef.current) {
            roomDataClearedRef.current = false;
        }

        // If cleared to empty — immediately mark not typing
        if (!typing) {
            if (isTypingFirestoreRef.current) {
                isTypingFirestoreRef.current = false;
                if (typingTimeoutRef.current) {
                    window.clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                }
                setTypingStatus(roomId, authUid, false, encryptedCurrentUserName).catch((typingError) => {
                    setFirebaseError(formatFirebaseDebugError('Unable to update typing indicator.', typingError));
                });
            }
            return;
        }

        // Only write to Firestore on transition: not typing → typing
        if (!isTypingFirestoreRef.current) {
            isTypingFirestoreRef.current = true;
            setTypingStatus(roomId, authUid, true, encryptedCurrentUserName).catch((typingError) => {
                setFirebaseError(formatFirebaseDebugError('Unable to update typing indicator.', typingError));
            });
        }

        // Reset stop-typing debounce on every keystroke
        if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = window.setTimeout(() => {
            isTypingFirestoreRef.current = false;
            setTypingStatus(roomId, authUid, false, encryptedCurrentUserName).catch((typingError) => {
                setFirebaseError(formatFirebaseDebugError('Unable to update typing indicator.', typingError));
            });
        }, 1500);
    };

    const buildQueuedMessage = useCallback((safeText, { moderation, tags, replyTo }) => {
        const clientId = createOfflineClientId();
        return {
            id: clientId,
            clientId,
            roomId,
            uid: authUid,
            sender: '',
            previewText: '',
            createdAtMs: Date.now(),
            payload: {
                text: encryptMessage(safeText, authSecret),
                senderEnc: encryptedCurrentUserName,
                uid: authUid,
                type: 'text',
                encrypted: true,
                cipherVersion: 'aes-v1',
                tags,
                moderation,
                replyTo: replyTo || null,
                clientId
            }
        };
    }, [authSecret, authSession?.displayName, authUid, currentUser, encryptedCurrentUserName, roomId]);

    const queueMessageForLater = useCallback(async (queuedMessage, notice) => {
        await enqueueOfflineMessage(queuedMessage);
        await refreshOfflineQueue(queuedMessage.roomId, queuedMessage.uid);

        setDraftMessage('');
        setReplyToMessage(null);
        setFirebaseError('');
        setStatusMessage(notice || 'Message queued and will send automatically when you reconnect.');

        isTypingFirestoreRef.current = false;
        if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        await setTypingStatus(roomId, authUid, false, encryptedCurrentUserName).catch(() => {
            // Ignore typing cleanup failures while queueing offline messages.
        });
    }, [authUid, encryptedCurrentUserName, refreshOfflineQueue, roomId]);

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
        setLastModerationFlag('');
        setUrgencyNotice('');
        setWebContext('');

        try {
            if (/^@ai\b/i.test(safeText)) {
                if (!isOnline) {
                    setFirebaseError('AI commands require an online connection.');
                    return;
                }

                const assistantText = await runAssistantCommand(safeText, messages);
                setAssistantOutput(assistantText);
                showAiPopup('assistant', assistantText);

                setDraftMessage('');
                return;
            }

            const composedText = safeText;
            const moderation = moderateMessage(safeText || '');
            const tags = autoTagMessage(safeText || '');
            const replyToPayload = replyToMessage ? { sender: replyToMessage.sender, text: replyToMessage.message } : null;
            const queuedMessage = buildQueuedMessage(composedText, { moderation, tags, replyTo: replyToPayload });

            if (moderation.shouldFlag) {
                setLastModerationFlag(`Flagged (${moderation.reason || 'policy'}): message sent with moderation marker.`);
            }

            if (moderation.urgency) {
                setUrgencyNotice('Urgent message detected. Smart notifications will prioritize this update.');
            }

            if (!isOnline) {
                await queueMessageForLater(queuedMessage, 'You are offline. Message queued and will send automatically when you reconnect.');
                return;
            }

            let context = '';
            if (safeText) {
                try {
                    context = await fetchWebContext(safeText);
                    if (context) {
                        setWebContext(context);
                        showAiPopup('context', `Web context: ${context}`);
                    }
                } catch {
                    // Do not block message delivery if enrichment is unavailable.
                }
            }

            await ensureChatDocument(roomId, authUid);
            await sendRoomMessage(roomId, queuedMessage.payload);
            trackEvent('message_sent', { chatType: isGroupChat ? 'group' : 'direct' });

            setDraftMessage('');
            setReplyToMessage(null);
            await Promise.allSettled([
                setTypingStatus(roomId, authUid, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, authUid, true, encryptedCurrentUserName)
            ]);

            if (window.navigator?.vibrate) {
                window.navigator.vibrate(12);
            }
        } catch (sendError) {
            if (isRecoverableSendError(sendError) && !/^@ai\b/i.test(safeText)) {
                try {
                    const queuedFallbackText = safeText;
                    const queuedMessage = buildQueuedMessage(queuedFallbackText, {
                        moderation: moderateMessage(queuedFallbackText),
                        tags: autoTagMessage(queuedFallbackText),
                        replyTo: replyToMessage ? { sender: replyToMessage.sender, text: replyToMessage.message } : null
                    });
                    await queueMessageForLater(queuedMessage, 'Connection dropped. Message queued and will send automatically when connectivity returns.');
                    return;
                } catch {
                    // Fall through to the send error surface if queue creation also fails.
                }
            }

            setStatusMessage('');
            setFirebaseError(formatFirebaseDebugError('Unable to send message.', sendError));
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

            await setTypingStatus(roomId, authUid, false, encryptedCurrentUserName).catch(() => {
                // Continue clearing messages even if typing cleanup fails.
            });

            await clearRoomMessages(roomId);
            await clearOfflineMessagesByRoom(roomId).catch(() => {
                // Ignore queue cleanup failures when clearing visible chat history.
            });

            deliveredMarkedRef.current.clear();
            readMarkedRef.current.clear();
            knownLiveMessageIdsRef.current.clear();
            initialLiveSnapshotLoadedRef.current = false;
            setPendingOutgoingMessages([]);
            setMessages([]);
            setDraftMessage('');
            setSearch('');
            setSummary('');
            setSummaryProvider('');
            setSummaryLatencyMs(0);
            setSummaryBreakdown(null);
            setSemanticResults([]);
            setAssistantOutput('');
            setWebContext('');
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
                setTypingStatus(roomId, authUid, false, encryptedCurrentUserName),
                setRoomUserPresence(roomId, authUid, false, encryptedCurrentUserName)
            ]);

            await hardDeleteRoomData(roomId);
            await clearOfflineMessagesByRoom(roomId).catch(() => {
                // Ignore offline queue cleanup failures during hard delete.
            });

            deliveredMarkedRef.current.clear();
            readMarkedRef.current.clear();
            knownLiveMessageIdsRef.current.clear();
            initialLiveSnapshotLoadedRef.current = false;
            setPendingOutgoingMessages([]);
            setMessages([]);
            setUsers([]);
            setTypingUsers({});
            setPresenceUsers({});
            setPendingOutgoingMessages([]);
            setDraftMessage('');
            setSearch('');
            setSummary('');
            setSummaryProvider('');
            setSummaryLatencyMs(0);
            setSummaryBreakdown(null);
            setSemanticResults([]);
            setAssistantOutput('');
            setWebContext('');
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
            await addMessageReaction(roomId, message.firestoreId, emoji, { userId: authUid });
            if (window.navigator?.vibrate) {
                window.navigator.vibrate(8);
            }
        } catch {
            setFirebaseError('Unable to add reaction.');
        }
    };

    const handleReplyToMessage = useCallback((message) => {
        if (!message) {
            return;
        }

        setReplyToMessage({
            id: message.id,
            sender: message.sender,
            message: String(message.message || '').slice(0, 120)
        });
    }, []);

    const handleCopyMessage = useCallback(async (message) => {
        const safeText = String(message?.message || '').trim();
        if (!safeText) {
            return;
        }

        try {
            await window.navigator?.clipboard?.writeText(safeText);
            setStatusMessage('Message copied to clipboard.');
        } catch {
            setStatusMessage('Unable to copy this message.');
        }
    }, []);

    const handleCopyGroupInviteCode = useCallback(async () => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !isGroupChat) {
            return;
        }

        try {
            await window.navigator?.clipboard?.writeText(safeRoomId);
            setStatusMessage('Group ID copied to clipboard. Share it so others can request access.');
        } catch {
            setStatusMessage('Unable to copy the group ID right now.');
        }
    }, [isGroupChat, roomId]);

    const groupMembersForSettings = useMemo(() => {
        if (!isGroupChat) {
            return [];
        }

        const members = Array.isArray(groupChatData?.members) ? groupChatData.members : [];
        const usernames = groupChatData?.memberUsernames || {};
        const roles = groupChatData?.memberRoles || {};
        const ownerId = String(groupChatData?.ownerId || '').trim();

        return members.map((uid) => {
            const safeUid = String(uid || '').trim();
            // Priority: live Firestore user profile → memberUsernames map → pseudonym
            const username = memberProfilesMap[safeUid]
                || String(usernames?.[safeUid] || '').trim()
                || pseudonymFromUid(safeUid);
            const role = safeUid === ownerId ? 'owner' : (String(roles?.[safeUid] || 'member').trim().toLowerCase() || 'member');
            return {
                uid: safeUid,
                username,
                role,
                avatar: avatars[username] || defaultAvatarMap[username] || `https://i.pravatar.cc/48?u=${safeUid}`
            };
        });
    }, [isGroupChat, groupChatData?.members, groupChatData?.memberUsernames, groupChatData?.memberRoles, groupChatData?.ownerId, avatars, defaultAvatarMap, memberProfilesMap]);

    const handleOpenGroupSettings = useCallback(() => {
        if (!isGroupChat) {
            return;
        }
        setShowGroupSettings(true);
    }, [isGroupChat]);

    const handleSaveGroupSettings = useCallback(async (updates) => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !isGroupChat) {
            return;
        }

        try {
            await updateGroupSettings({
                uid: authUid,
                role: isAdminUser ? 'admin' : 'user'
            }, safeRoomId, updates);
            setStatusMessage('Group settings updated.');
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to update group settings.');
        }
    }, [authUid, isAdminUser, isGroupChat, roomId]);

    const handleRemoveGroupMember = useCallback(async (member) => {
        const safeRoomId = String(roomId || '').trim();
        const safeMemberUid = String(member?.uid || '').trim();
        if (!safeRoomId || !safeMemberUid || !isGroupChat) {
            return;
        }

        const confirmed = window.confirm(`Remove ${member?.username || 'this user'} from the group?`);
        if (!confirmed) {
            return;
        }

        try {
            await removeGroupMember({
                uid: authUid,
                role: isAdminUser ? 'admin' : 'user'
            }, safeRoomId, safeMemberUid);
            setStatusMessage(`${member?.username || 'Member'} removed from the group.`);
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to remove member.');
        }
    }, [authUid, isAdminUser, isGroupChat, roomId]);

    const handleDeleteGroup = useCallback(async () => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !isGroupChat) {
            return;
        }

        try {
            await deleteGroupForAll({
                uid: authUid,
                role: isAdminUser ? 'admin' : 'user'
            }, safeRoomId);
            setShowGroupSettings(false);
            setStatusMessage('Group deleted successfully.');
            onBackHome?.();
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to delete group.');
        }
    }, [authUid, isAdminUser, isGroupChat, onBackHome, roomId]);

    const canLeaveGroup = useMemo(() => {
        if (!isGroupChat || !authUid) {
            return false;
        }

        const ownerId = String(groupChatData?.ownerId || '').trim();
        return Boolean(ownerId) && ownerId !== String(authUid).trim();
    }, [isGroupChat, authUid, groupChatData?.ownerId]);

    const handleLeaveGroup = useCallback(async () => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !isGroupChat || !authUid) {
            return;
        }

        try {
            await leaveGroupChat(
                {
                    uid: authUid,
                    username: String(currentUser || authProfile?.username || 'Member').trim(),
                    role: isAdminUser ? 'admin' : 'user'
                },
                safeRoomId
            );
            setShowGroupSettings(false);
            setStatusMessage('You left the group.');
            onBackHome?.();
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to leave group.');
        }
    }, [authUid, authProfile?.username, currentUser, isAdminUser, isGroupChat, onBackHome, roomId]);

    const handleCopyInviteLink = useCallback((chatId) => {
        const link = `${window.location.origin}/?join=${String(chatId || '').trim()}`;
        navigator.clipboard.writeText(link).then(() => {
            setStatusMessage('Invite link copied to clipboard!');
        }).catch(() => {
            setStatusMessage('Unable to copy link. Please copy manually: ' + link);
        });
    }, []);

    const syncHealth = useMemo(() => {
        if (!isOnline) {
            return { label: 'Offline', tone: 'warn' };
        }

        if (liveLoading) {
            return { label: 'Syncing', tone: 'info' };
        }

        if (firebaseError) {
            return { label: 'Degraded', tone: 'bad' };
        }

        return { label: 'Live', tone: 'good' };
    }, [isOnline, liveLoading, firebaseError]);

    // Fetch live user profiles for all group members so we always show correct usernames
    useEffect(() => {
        if (!isGroupChat) {
            setMemberProfilesMap({});
            return;
        }
        const memberUids = Array.isArray(groupChatData?.members)
            ? groupChatData.members.map((uid) => String(uid || '').trim()).filter(Boolean)
            : [];
        if (!memberUids.length) return;

        let cancelled = false;
        Promise.all(memberUids.map((uid) => loadUserProfile(uid).catch(() => null)))
            .then((profiles) => {
                if (cancelled) return;
                const map = {};
                profiles.forEach((profile) => {
                    if (profile?.uid && profile?.username) {
                        map[profile.uid] = String(profile.username).trim();
                    }
                });
                setMemberProfilesMap(map);
            });
        return () => { cancelled = true; };
    }, [isGroupChat, groupChatData?.members]);

    // Determine if the current user can moderate this group (owner or platform admin)
    const isGroupOwnerOrAdmin = useMemo(() => {
        if (!isGroupChat || !authUid) return false;
        if (isAdminUser) return true;
        return Boolean(groupOwnerId && groupOwnerId === authUid);
    }, [isGroupChat, authUid, isAdminUser, groupOwnerId]);

    // Subscribe to the group chat document to get real-time ownerId
    useEffect(() => {
        const safeRoomId = String(roomId || '').trim();
        if (!isGroupChat || !safeRoomId) {
            setGroupChatData(null);
            setGroupOwnerId('');
            return;
        }

        const unsub = subscribeChat(safeRoomId, (chatData) => {
            setGroupChatData(chatData || null);
            setGroupOwnerId(String(chatData?.ownerId || '').trim());
        }, () => { });
        return () => unsub?.();
    }, [isGroupChat, roomId]);

    // Subscribe to pending join requests for group owners/admins
    useEffect(() => {
        const safeRoomId = String(roomId || '').trim();
        if (!isGroupChat || !safeRoomId || !authUid) return;

        const unsub = subscribeGroupJoinRequests(
            safeRoomId,
            (requests) => setJoinRequests(requests),
            () => setJoinRequests([])
        );
        return () => unsub?.();
    }, [isGroupChat, roomId, authUid]);

    const handleApproveJoinRequest = useCallback(async (req) => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !req?.id) return;
        try {
            await approveJoinRequest(
                { uid: authUid, username: String(currentUser || '').trim() },
                safeRoomId,
                req.id,
                req.username
            );
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to approve request.');
        }
    }, [authUid, currentUser, roomId]);

    const handleRejectJoinRequest = useCallback(async (req) => {
        const safeRoomId = String(roomId || '').trim();
        if (!safeRoomId || !req?.id) return;
        try {
            await rejectJoinRequest(
                { uid: authUid, username: String(currentUser || '').trim() },
                safeRoomId,
                req.id
            );
        } catch (err) {
            setStatusMessage(err?.message || 'Unable to reject request.');
        }
    }, [authUid, currentUser, roomId]);

    const handleForwardMessage = useCallback((message) => {
        const safeText = String(message?.message || '').trim();
        if (!safeText) {
            return;
        }

        setDraftMessage((prev) => [prev, `FWD: ${safeText}`].filter(Boolean).join('\n').trim());
    }, []);

    const handleDeleteMessage = useCallback(async (message, scope = 'me') => {
        if (!message) {
            return;
        }

        if (scope === 'everyone') {
            if (!message.firestoreId || !firebaseReady) {
                setFirebaseError('Unable to delete message for everyone.');
                return;
            }

            if (String(message.uid || '').trim() !== String(authUid || '').trim()) {
                setFirebaseError('You can only delete your own messages for everyone.');
                return;
            }

            try {
                await deleteRoomMessage(roomId, message.firestoreId);
                setStatusMessage('Message deleted for everyone.');
                return;
            } catch {
                setFirebaseError('Unable to delete message for everyone.');
                return;
            }
        }

        try {
            if (firebaseReady && authUid && message.firestoreId) {
                await hideRoomMessageForUser(roomId, message.firestoreId, authUid);
            }
        } catch {
            // Keep local hide as fallback even if persistence fails.
        }

        setDeletedForMeIds((prev) => Array.from(new Set([...prev, message.id])));
        setStatusMessage('Message deleted for you.');
    }, [authUid, firebaseReady, roomId]);

    const handlePinMessage = useCallback(async (message, pinned) => {
        if (!message?.firestoreId || !firebaseReady) return;
        try {
            await pinRoomMessage(roomId, message.firestoreId, pinned);
        } catch {
            setFirebaseError('Could not pin message.');
        }
    }, [firebaseReady, roomId]);

    const handleBookmarkMessage = useCallback(async (message, bookmarked) => {
        if (!message?.firestoreId || !firebaseReady || !authUid) return;
        try {
            await bookmarkRoomMessage(roomId, message.firestoreId, authUid, bookmarked);
        } catch {
            setFirebaseError('Could not bookmark message.');
        }
    }, [authUid, firebaseReady, roomId]);

    const handleAvatarUpload = (user, file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            dispatch(
                setUserAvatar({
                    user,
                    avatarUrl: String(reader.result || '')
                })
            );
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundUpload = (file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            dispatch(
                setBackgroundPreference({
                    presetId: '',
                    customUrl: String(reader.result || '')
                })
            );
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundPresetSelect = (presetId) => {
        dispatch(
            setBackgroundPreference({
                presetId: String(presetId || '').trim(),
                customUrl: ''
            })
        );
    };

    const showUsernameToast = useCallback((kind, text) => {
        setUsernameToast({ kind, text });

        if (usernameToastTimerRef.current) {
            window.clearTimeout(usernameToastTimerRef.current);
        }

        usernameToastTimerRef.current = window.setTimeout(() => {
            setUsernameToast(null);
            usernameToastTimerRef.current = null;
        }, 2200);
    }, []);

    const showAiPopup = useCallback((kind, text) => {
        const safeText = String(text || '').trim();
        if (!safeText) {
            return;
        }

        setAiPopup({ id: Date.now(), kind, text: safeText });

        if (aiPopupTimerRef.current) {
            window.clearTimeout(aiPopupTimerRef.current);
        }

        aiPopupTimerRef.current = window.setTimeout(() => {
            setAiPopup(null);
            aiPopupTimerRef.current = null;
        }, 7000);
    }, []);

    useEffect(() => {
        if (!aiPopup) {
            return;
        }

        const onPointerDown = (event) => {
            const popupNode = aiPopupRef.current;
            if (!popupNode) {
                return;
            }

            if (!popupNode.contains(event.target)) {
                setAiPopup(null);
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [aiPopup]);

    const handleUsernameUpdate = async (nextUsername) => {
        const safeValue = String(nextUsername || '').trim().replace(/[^A-Za-z0-9_]/g, '');
        const normalized = safeValue ? `${safeValue.charAt(0).toUpperCase()}${safeValue.slice(1)}` : '';
        if (!/^[A-Z][A-Za-z0-9_]{2,19}$/.test(normalized)) {
            showUsernameToast('error', 'Username must be 3-20 chars, start with a capital letter, and use letters/numbers/underscore.');
            return;
        }

        setIsUpdatingUsername(true);
        try {
            const result = await dispatch(updateUserProfile({ username: normalized }));
            if (updateUserProfile.fulfilled.match(result)) {
                const savedUsername = result.payload?.username || normalized;
                dispatch(setCurrentUser(savedUsername));
                if (authSession?.secret) {
                    dispatch(setAuthSession({ displayName: savedUsername, secret: authSession.secret }));
                }
                showUsernameToast('success', 'Username updated successfully.');
            } else {
                showUsernameToast('error', result.payload || 'Unable to update username.');
            }
        } catch {
            showUsernameToast('error', 'Unable to update username right now.');
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    useEffect(() => {
        return () => {
            if (usernameToastTimerRef.current) {
                window.clearTimeout(usernameToastTimerRef.current);
            }

            if (aiPopupTimerRef.current) {
                window.clearTimeout(aiPopupTimerRef.current);
            }
        };
    }, []);

    const handleResetPreferences = () => {
        const shouldReset = window.confirm(
            'Reset all saved preferences (theme, mode, wallpaper, avatars, and selected user) to defaults?'
        );

        if (!shouldReset) {
            return;
        }

        dispatch(resetUserPreferences());
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
        const target = event.currentTarget;
        if (!target) {
            return;
        }

        // Throttle header compact state update via RAF to avoid re-renders mid-scroll
        const scrollTop = target.scrollTop;
        if (headerCompactRafRef.current) {
            cancelAnimationFrame(headerCompactRafRef.current);
        }
        headerCompactRafRef.current = requestAnimationFrame(() => {
            setHeaderCompact(scrollTop > 36);
            headerCompactRafRef.current = null;
        });

        if (!firebaseReady || replayMode || showInsights) {
            return;
        }

        if (scrollTop <= 120) {
            handleLoadOlderMessages();
        }
    };

    const handleExport = async () => {
        if (!chatCaptureRef.current) {
            return;
        }

        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(chatCaptureRef.current, {
                cacheBust: true,
                pixelRatio: 2
            });
            const link = document.createElement('a');
            link.download = `${String(BRAND.name || 'lensiq').toLowerCase()}-chat-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (exportError) {
            setError('Unable to export image. Please try again.');
        }
    };

    const handleExportText = useCallback(() => {
        trackEvent('export_text');
        exportChatAsText(messages, initialChatTitle || roomId || 'chat');
    }, [messages, initialChatTitle, roomId]);

    const handleExportPDF = useCallback(() => {
        trackEvent('export_pdf');
        exportChatAsPDF(messages, initialChatTitle || roomId || 'chat');
    }, [messages, initialChatTitle, roomId]);

    const handleSummarize = useCallback(async () => {
        trackEvent('ai_summarize');
        setSummaryLoading(true);
        setError('');
        setSummaryProvider('');
        setSummaryLatencyMs(0);
        setSummaryBreakdown(null);

        const startTime = performance.now();
        try {
            const [result, expanded] = await Promise.all([
                summarizeMessagesWithAI(messages, { includeMeta: true }),
                summarizeConversation(messages, 'all')
            ]);

            setSummary(result?.summary || 'No summary generated.');
            setSummaryProvider(result?.provider || expanded?.provider || 'local');
            setSummaryBreakdown(expanded?.breakdown || result?.breakdown || null);
            setSummaryLatencyMs(Math.round(performance.now() - startTime));
            showAiPopup('summary', result?.summary || 'No summary generated.');
        } catch (summaryError) {
            setError('Unable to generate summary right now.');
        } finally {
            setSummaryLoading(false);
        }
    }, [messages, showAiPopup]);

    const handleQuickAiCommand = useCallback(async (commandValue) => {
        const safeCommand = String(commandValue || '').trim();
        if (!safeCommand) {
            return;
        }

        const normalizedCommand = /^@ai\b/i.test(safeCommand) ? safeCommand : `@AI ${safeCommand}`;

        if (/\bsummarize\b/i.test(normalizedCommand)) {
            await handleSummarize();
            return;
        }

        try {
            setError('');
            const assistantText = await runAssistantCommand(normalizedCommand, messages);
            setAssistantOutput(assistantText);
            showAiPopup('assistant', assistantText);
        } catch {
            setError('Unable to run AI action right now.');
        }
    }, [handleSummarize, messages, showAiPopup]);

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
            <div className="relative flex min-h-[100svh] h-[100svh] w-full items-center justify-center overflow-hidden px-4 md:min-h-screen md:h-[100dvh]">
                <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
                <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />
                <div className="glass-panel rounded-[1.2rem] px-6 py-4 text-sm text-[var(--text-main)]">Signing in anonymously...</div>
            </div>
        );
    }

    return (
        <div className="chat-special-edition relative flex min-h-[100svh] h-[100svh] w-full flex-col overflow-hidden md:min-h-screen md:h-[100dvh]">
            <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
            <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />

            <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col p-1 md:p-3">
                <main className="chat-special-shell glass-panel-strong relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.1rem] ambient-ring premium-panel-strong md:rounded-[2rem] md:border md:border-white/20">
                    <div className="chat-special-overlay pointer-events-none absolute inset-0 z-[1]" />
                    <div ref={chatCaptureRef} className="chat-shell-stage flex h-full min-h-0 flex-col bg-[var(--chat-shell)]">
                        <ChatHeader
                            title={isGroupChat ? groupTitle : contactName}
                            avatar={isGroupChat ? (groupChatData?.photoUrl || DEFAULT_HEADER_CONTACT_IMAGE) : (avatars[contactName] || avatars[otherUser] || defaultAvatarMap[contactName] || defaultAvatarMap[otherUser] || DEFAULT_HEADER_CONTACT_IMAGE)}
                            isGroupChat={isGroupChat}
                            onTitleClick={isGroupChat ? handleOpenGroupSettings : undefined}
                            syncHealthLabel={syncHealth.label}
                            syncHealthTone={syncHealth.tone}
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
                            onOpenSummary={() => {
                                setSettingsSection('summary');
                                setSettingsOpen(true);
                            }}
                            onExport={handleExport}
                            onExportText={handleExportText}
                            onExportPDF={handleExportPDF}
                            canCopyInviteCode={isGroupChat}
                            onCopyInviteCode={handleCopyGroupInviteCode}
                            canManageJoinRequests={isGroupChat && isGroupOwnerOrAdmin}
                            pendingJoinRequestCount={joinRequests.length}
                            onOpenJoinRequests={() => setShowJoinRequests(true)}
                            showSearch={showSearch}
                            onToggleSearch={() => setShowSearch((prev) => !prev)}
                            showTimeline={showTimeline}
                            onToggleTimeline={handleToggleTimeline}
                            showInsights={aiPanelOpen}
                            onToggleInsights={() => setAiPanelOpen((prev) => !prev)}
                            aiPanelOpen={aiPanelOpen}
                            onToggleAiPanel={() => setAiPanelOpen((prev) => !prev)}
                            compact={headerCompact}
                            onOpenSidebar={onOpenSidebar}
                            onBackToHome={onBackHome}
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

                        <div
                            className="chat-wallpaper relative flex min-h-0 flex-1 flex-col overflow-hidden"
                            style={{
                                backgroundImage: `url(${activeChatBackground}), var(--wallpaper-pattern), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
                                '--chat-photo-size': 'cover',
                                '--chat-photo-position': 'center center',
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
                            <section
                                ref={chatScrollRef}
                                className="scroll-thin relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-3 sm:px-4 md:px-6 md:pb-6 md:pt-6"
                                style={{ WebkitOverflowScrolling: 'touch', willChange: 'scroll-position', overflowAnchor: 'auto' }}
                                onScroll={handleChatScroll}
                                onClick={handleChatSurfaceToggleReplay}
                                onTouchStart={handleThemeSwipeStart}
                                onTouchEnd={handleThemeSwipeEnd}
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

                                    {showSearch ? (
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            {[
                                                { id: 'all', label: 'All' },
                                                { id: 'media', label: 'Media' },
                                                { id: 'links', label: 'Links' },
                                                { id: 'users', label: 'Users' }
                                            ].map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSearchFilter(item.id)}
                                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${searchFilter === item.id
                                                        ? 'border-cyan-200/60 bg-cyan-300/20 text-cyan-50'
                                                        : 'border-white/20 bg-black/20 text-slate-200'
                                                        }`}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
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
                                            <Suspense
                                                fallback={(
                                                    <div className="glass-panel rounded-[1.2rem] p-6 text-sm text-[var(--text-muted)]">
                                                        Loading analysis...
                                                    </div>
                                                )}
                                            >
                                                <ChatInsights messages={messages} />
                                            </Suspense>
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
                                                className="chat-empty-card glass-panel max-w-xl rounded-[1.4rem] p-6"
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
                                                    overscan={virtuosoOverscan}
                                                    increaseViewportBy={virtuosoViewportBy}
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
                                                                    onReply={handleReplyToMessage}
                                                                    onCopy={handleCopyMessage}
                                                                    onForward={handleForwardMessage}
                                                                    onDelete={handleDeleteMessage}
                                                                    onPin={handlePinMessage}
                                                                    onBookmark={handleBookmarkMessage}
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

                                                        return (
                                                            <motion.div
                                                                layout={false}
                                                                key={`${message.id}-wrapper`}
                                                                initial={replayMode && !shouldReduceMotion ? { opacity: 0, y: 10 } : false}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                                                            >
                                                                {showDateChip ? (
                                                                    <motion.div layout={false} className="my-2.5 flex justify-center">
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
                                                                    onReply={handleReplyToMessage}
                                                                    onCopy={handleCopyMessage}
                                                                    onForward={handleForwardMessage}
                                                                    onDelete={handleDeleteMessage}
                                                                    onPin={handlePinMessage}
                                                                    onBookmark={handleBookmarkMessage}
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

                            <LiveComposer
                                messageValue={draftMessage}
                                onMessageChange={handleLiveDraftChange}
                                onSendMessage={handleSendLiveMessage}
                                typingText={typingIndicatorText}
                                disabled={!draftMessage.trim() || !firebaseReady}
                                isSending={isSending}
                                isOnline={isOnline}
                                isFirebaseReady={firebaseReady}
                                isLoading={liveLoading}
                                encryptedLabel="🔒 Encrypted chat"
                                quickReplies={aiSuggestions}
                                onQuickReply={handleQuickReply}
                                onQuickCommand={handleQuickAiCommand}
                                onVoiceInput={handleVoiceInput}
                                replyTo={replyToMessage}
                                onCancelReply={() => setReplyToMessage(null)}
                            />
                        </div>
                    </div>

                    <AISidePanel
                        open={aiPanelOpen}
                        onOpenChange={setAiPanelOpen}
                        isMobile={isMobileViewport}
                        summary={summary}
                        summaryLoading={summaryLoading}
                        summaryProvider={summaryProvider}
                        summaryLatencyMs={summaryLatencyMs}
                        summaryBreakdown={summaryBreakdown}
                        aiSuggestions={aiSuggestions}
                        onSummarize={handleSummarize}
                    />
                </main>

                {error ? (
                    <p className="mt-1.5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-[var(--error-text)] shadow-sm">
                        {error}
                    </p>
                ) : null}

                {firebaseError ? (
                    <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100 shadow-sm">
                        {firebaseError}
                    </p>
                ) : null}

                {lastModerationFlag ? (
                    <p className="mt-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100 shadow-sm">
                        {lastModerationFlag}
                    </p>
                ) : null}

                {urgencyNotice ? (
                    <p className="mt-1.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-100 shadow-sm">
                        {urgencyNotice}
                    </p>
                ) : null}

                {aiPopup ? (
                    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/28 backdrop-blur-[1px]" />
                        <div className="relative">
                            <div
                                ref={aiPopupRef}
                                className={`pointer-events-auto w-full max-w-[min(520px,92vw)] rounded-xl border px-3 py-2.5 text-sm shadow-2xl backdrop-blur ${aiPopup.kind === 'summary'
                                    ? 'border-indigo-400/40 bg-indigo-500/16 text-indigo-50'
                                    : aiPopup.kind === 'context'
                                        ? 'border-sky-400/40 bg-sky-500/16 text-sky-50'
                                        : 'border-cyan-400/40 bg-cyan-500/16 text-cyan-50'
                                    }`}
                            >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-90">
                                        {aiPopup.kind === 'summary' ? 'AI Summary' : aiPopup.kind === 'context' ? 'Web Context' : 'AI Assistant'}
                                    </span>
                                    <button
                                        type="button"
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xs"
                                        onClick={() => setAiPopup(null)}
                                        aria-label="Close AI popup"
                                    >
                                        ×
                                    </button>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{aiPopup.text}</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {usernameToast ? (
                    <div className="pointer-events-none fixed bottom-5 right-5 z-50">
                        <div
                            className={`rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur ${usernameToast.kind === 'success'
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                                : 'border-red-400/40 bg-red-500/15 text-red-100'
                                }`}
                        >
                            {usernameToast.text}
                        </div>
                    </div>
                ) : null}

                <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <SheetContent side="right" className="w-full max-w-[420px] p-2.5 md:p-4">
                        <div className="scroll-thin min-h-0 h-[calc(100dvh-108px)] md:h-[calc(100dvh-118px)] space-y-3 overflow-y-auto overscroll-contain pr-1">
                            <div className="sticky top-0 z-30 -mx-1 space-y-2 bg-[var(--panel-strong)]/95 px-1 pb-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--panel-strong)]/80">
                                <SheetHeader className="mb-0">
                                    <SheetTitle>Workspace Settings</SheetTitle>
                                    <SheetDescription>Control theme, participants, visuals, and export options.</SheetDescription>
                                </SheetHeader>
                                <div className="segmented-control inline-flex w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-1" role="tablist" aria-label="Settings sections">
                                    {[
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
                            </div>

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

                                        {!hasCloudAiProvider ? (
                                            <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200/90">
                                                AI gateway is not configured. The app uses Ollama/local fallbacks when cloud providers are unavailable.
                                            </p>
                                        ) : null}

                                        {summary ? (
                                            <>
                                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                                    {summaryProvider ? (
                                                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                                                            Provider: {summaryProvider}
                                                        </span>
                                                    ) : null}
                                                    {summaryLatencyMs > 0 ? (
                                                        <span className="rounded-full border border-slate-300/30 bg-white/10 px-2 py-0.5 text-[var(--text-muted)]">
                                                            Generated in {summaryLatencyMs}ms
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]/85">{summary}</pre>

                                                {summaryBreakdown?.keyPoints?.length ? (
                                                    <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Key Points</p>
                                                        <ul className="mt-2 space-y-1 text-sm text-[var(--text-main)]/85">
                                                            {summaryBreakdown.keyPoints.slice(0, 6).map((item) => (
                                                                <li key={item}>• {item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ) : null}

                                                {summaryBreakdown?.decisions?.length ? (
                                                    <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Decisions</p>
                                                        <ul className="mt-2 space-y-1 text-sm text-[var(--text-main)]/85">
                                                            {summaryBreakdown.decisions.slice(0, 6).map((item) => (
                                                                <li key={item}>• {item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : (
                                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                                                Generate a concise overview of participants, trends, and key moments.
                                            </p>
                                        )}

                                        <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Semantic Search</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    value={semanticQuery}
                                                    onChange={(event) => setSemanticQuery(event.target.value)}
                                                    placeholder="Search by meaning, not just keywords"
                                                    className="input-surface h-9 text-sm"
                                                />
                                                <Button type="button" variant="secondary" onClick={handleSemanticSearch} disabled={semanticLoading || !semanticQuery.trim()}>
                                                    {semanticLoading ? 'Searching...' : 'Search'}
                                                </Button>
                                            </div>

                                            {semanticResults.length ? (
                                                <div className="mt-3 space-y-2">
                                                    {semanticResults.slice(0, 5).map((item) => (
                                                        <div key={item.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2">
                                                            <p className="text-xs text-[var(--text-muted)]">{item.sender} • {item.date} {item.time}</p>
                                                            <p className="text-sm text-[var(--text-main)]/85">{item.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>

                                        {summaryBreakdown?.daily?.length ? (
                                            <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Daily Summaries</p>
                                                <div className="mt-2 space-y-2">
                                                    {summaryBreakdown.daily.slice(-3).map((item) => (
                                                        <details key={item.date} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2">
                                                            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-main)]">{item.date}</summary>
                                                            <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-main)]/80">{item.summary}</pre>
                                                        </details>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {summaryBreakdown?.perUser?.length ? (
                                            <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Per User Summaries</p>
                                                <div className="mt-2 space-y-2">
                                                    {summaryBreakdown.perUser.slice(0, 4).map((item) => (
                                                        <details key={item.sender} className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2">
                                                            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-main)]">{item.sender}</summary>
                                                            <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-main)]/80">{item.summary}</pre>
                                                        </details>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {['appearance', 'participants', 'export'].includes(settingsSection) ? (
                                <Suspense
                                    fallback={(
                                        <div className="glass-panel rounded-[1.2rem] p-6 text-sm text-[var(--text-muted)]">
                                            Loading settings...
                                        </div>
                                    )}
                                >
                                    <SettingsPanel
                                        section={settingsSection}
                                        theme={resolvedTheme}
                                        themePreference={themePreference}
                                        onThemeChange={handleThemeChange}
                                        chatMode={chatMode}
                                        onChatModeChange={(nextMode) => dispatch(setChatMode(nextMode))}
                                        users={users}
                                        currentUser={currentUser}
                                        onCurrentUserChange={(nextUser) => dispatch(setCurrentUser(nextUser))}
                                        username={authProfile?.username || currentUser}
                                        onUsernameUpdate={handleUsernameUpdate}
                                        isUpdatingUsername={isUpdatingUsername}
                                        onAvatarUpload={handleAvatarUpload}
                                        onBackgroundUpload={handleBackgroundUpload}
                                        selectedBackgroundId={selectedBackgroundId}
                                        hasCustomBackground={Boolean(customBackgroundUrl)}
                                        backgroundOptions={PRESET_CHAT_BACKGROUNDS}
                                        onBackgroundPresetSelect={handleBackgroundPresetSelect}
                                        onResetPreferences={handleResetPreferences}
                                        onExport={handleExport}
                                        onClearChat={handleClearChat}
                                        isClearingChat={isClearingChat}
                                        onDeleteChatData={handleDeleteChatData}
                                        isDeletingChatData={isDeletingChatData}
                                    />
                                </Suspense>
                            ) : null}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
            {showJoinRequests ? (
                <JoinRequestsPanel
                    requests={joinRequests}
                    onApprove={handleApproveJoinRequest}
                    onReject={handleRejectJoinRequest}
                    onClose={() => setShowJoinRequests(false)}
                />
            ) : null}
            {showGroupSettings ? (
                <GroupSettingsPanel
                    open={showGroupSettings}
                    group={{
                        name: groupTitle,
                        description: groupChatData?.description || '',
                        photoUrl: groupChatData?.photoUrl || ''
                    }}
                    groupId={roomId}
                    members={groupMembersForSettings}
                    canManage={isGroupOwnerOrAdmin}
                    canLeave={canLeaveGroup}
                    currentUserId={authUid}
                    onClose={() => setShowGroupSettings(false)}
                    onSave={handleSaveGroupSettings}
                    onRemoveMember={handleRemoveGroupMember}
                    onDeleteGroup={handleDeleteGroup}
                    onLeaveGroup={handleLeaveGroup}
                    onCopyInviteLink={handleCopyInviteLink}
                />
            ) : null}
        </div>
    );
}

export default useLegacyChatRuntime;
