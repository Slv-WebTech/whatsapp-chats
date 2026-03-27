import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Virtuoso } from 'react-virtuoso';
import { toPng } from 'html-to-image';
import { Download, MessageCircleMore } from 'lucide-react';
import ChatBubble from './components/ChatBubble';
import ChatHeader from './components/ChatHeader';
import FileUpload from './components/FileUpload';
import ReplayControls from './components/ReplayControls';
import SettingsPanel from './components/SettingsPanel';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './components/ui/sheet';
import { summarizeMessagesWithAI } from './utils/aiSummary';
import { groupMessages } from './utils/groupMessages';
import { includesQuery } from './utils/highlight';
import { parseWhatsAppChat } from './utils/parser';
import sampleChatText from './components/Assets/sample chat.txt?raw';

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

const DEFAULT_HEADER_CONTACT_IMAGE = 'https://img.freepik.com/free-photo/silhouetted-couple-sit-bench-autumn-tree-generative-ai_188544-12574.jpg';

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

    return value.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function App() {
    const VIRTUALIZE_THRESHOLD = 350;
    const [chatMode, setChatMode] = useState(() => {
        const saved = localStorage.getItem('whatsapp-chat-mode');
        return saved === 'romantic' ? 'romantic' : 'formal';
    });
    const [themePreference, setThemePreference] = useState(() => {
        const saved = localStorage.getItem('whatsapp-theme');
        return ['light', 'dark', 'system'].includes(saved || '') ? saved : 'system';
    });
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState('');
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [avatars, setAvatars] = useState({});
    const [chatBackground, setChatBackground] = useState('');
    const [search, setSearch] = useState('');
    const [summary, setSummary] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
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
    const touchStartRef = useRef(null);

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
        localStorage.setItem('whatsapp-chat-mode', chatMode);
    }, [chatMode]);

    useEffect(() => {
        localStorage.setItem('whatsapp-theme', themePreference);
    }, [themePreference]);

    useEffect(() => {
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
        return () => {
            if (parseFlushTimerRef.current) {
                window.clearTimeout(parseFlushTimerRef.current);
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
        if (!currentUser || !users.includes(currentUser)) {
            setCurrentUser(users[0]);
        }
    }, [users, currentUser]);

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

    const otherUser = users.find((user) => user !== currentUser) || users[0] || 'Contact';
    const contactMessages = useMemo(
        () => groupedMessages.filter((message) => message.sender === otherUser),
        [groupedMessages, otherUser]
    );
    const contactMeta = useMemo(() => {
        if (!contactMessages.length) {
            return {
                isOnline: false,
                lastSeenLabel: '',
                messageCount: 0,
                activeDayCount: 0
            };
        }

        const lastMessage = contactMessages[contactMessages.length - 1];
        const lastSeenDate = parseChatDateTime(lastMessage.date, lastMessage.time);
        const activeDays = new Set(contactMessages.map((message) => message.date));
        const now = new Date();
        const diffMs = lastSeenDate ? Math.abs(now.getTime() - lastSeenDate.getTime()) : Number.POSITIVE_INFINITY;

        return {
            isOnline: diffMs <= 5 * 60 * 1000,
            lastSeenLabel: formatLastSeenLabel(lastSeenDate),
            messageCount: contactMessages.length,
            activeDayCount: activeDays.size
        };
    }, [contactMessages]);

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
            setThemePreference(nextTheme);
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

        setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
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

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden">
            <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
            <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />

            <div className="mx-auto flex h-full w-full flex-col">
                <main className="glass-panel-strong relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none ambient-ring premium-panel-strong">
                    <div ref={chatCaptureRef} className="chat-shell-stage flex h-full min-h-0 flex-col bg-[var(--chat-shell)]">
                        <ChatHeader
                            title={otherUser}
                            avatar={avatars[otherUser] || defaultAvatarMap[otherUser] || DEFAULT_HEADER_CONTACT_IMAGE}
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
                            onToggleTimeline={() => setShowTimeline((prev) => !prev)}
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
                            className="chat-wallpaper scroll-thin relative flex-1 overflow-x-hidden overflow-y-auto px-2.5 pb-14 pt-4 md:px-6 md:py-6"
                            onTouchStart={handleThemeSwipeStart}
                            onTouchEnd={handleThemeSwipeEnd}
                            style={{
                                backgroundImage: `url(${activeChatBackground})`,
                                backgroundSize: 'cover',
                                '--accent': backgroundTheme.accent,
                                '--bubble-sent-start': backgroundTheme.sentStart,
                                '--bubble-sent-end': backgroundTheme.sentEnd,
                                '--bubble-sent-border': backgroundTheme.sentBorder,
                                '--bubble-sent-shadow': backgroundTheme.sentShadow,
                                '--bubble-tail-sent': backgroundTheme.tailSent,
                                '--bubble-received-start': backgroundTheme.receivedStart,
                                '--bubble-received-end': backgroundTheme.receivedEnd,
                                '--bubble-received-border': backgroundTheme.receivedBorder,
                                '--bubble-received-shadow': backgroundTheme.receivedShadow,
                                '--chat-overlay-top': backgroundTheme.overlayTop,
                                '--chat-overlay-mid': backgroundTheme.overlayMid,
                                '--chat-overlay-bottom': backgroundTheme.overlayBottom
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0"
                                style={{
                                    background:
                                        'linear-gradient(180deg, var(--chat-overlay-top), var(--chat-overlay-mid), var(--chat-overlay-bottom))'
                                }}
                            />
                            <div className="relative z-10 mx-auto w-full md:max-w-4xl">
                                {groupedMessages.length === 0 && isParsing ? (
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
                                                Start Here
                                            </p>
                                            <h2 className="mt-2 text-xl font-bold text-[var(--text-main)]">
                                                Bring your WhatsApp export into a refined full-screen chat workspace.
                                            </h2>
                                            <p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">
                                                Use the settings or more menu in the header to import files, customize visuals, and generate summaries.
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
                                                    const isCurrentUser = currentUser && message.sender === currentUser;
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
                                                                avatar={avatars[message.sender] || defaultAvatarMap[message.sender]}
                                                                query={search}
                                                                isMatch={highlightedIdSet.has(message.id) || activeSearchId === message.id}
                                                                animateEntry={false}
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
                                                    const isCurrentUser = currentUser && message.sender === currentUser;
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
                                                                avatar={avatars[message.sender] || defaultAvatarMap[message.sender]}
                                                                query={search}
                                                                isMatch={isMatch || activeSearchId === message.id}
                                                                animateEntry={replayMode}
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

                {error ? (
                    <p className="mt-1.5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-[var(--error-text)] shadow-sm">
                        {error}
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
                                    onChatModeChange={setChatMode}
                                    users={users}
                                    currentUser={currentUser}
                                    onCurrentUserChange={setCurrentUser}
                                    onAvatarUpload={handleAvatarUpload}
                                    onBackgroundUpload={handleBackgroundUpload}
                                    selectedBackground={chatBackground}
                                    backgroundOptions={PRESET_CHAT_BACKGROUNDS}
                                    onBackgroundPresetSelect={handleBackgroundPresetSelect}
                                    onExport={handleExport}
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
