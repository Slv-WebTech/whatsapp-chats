import { useEffect, useRef, useState } from 'react';
import { getHighlightParts } from '../../../utils/highlight';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CheckCheck, ChevronDown, FileText, Info, Mic, Phone, Play, SmilePlus, Video } from 'lucide-react';
import { clsx } from 'clsx';
import EmojiPicker from 'emoji-picker-react';
import { classifyMessage, getCallDetails, getMediaLabel, getResolvableMediaSource, getVoiceDuration } from '../../../utils/messageTypes';

function MessageHighlight({ message, query, reduceMotion }) {
    return (
        <p className="overflow-hidden whitespace-pre-line break-words text-sm leading-relaxed tracking-[-0.01em]">
            {getHighlightParts(message, query).map((part, index) => (
                <motion.span
                    key={`${message}-${index}`}
                    layout={!reduceMotion}
                    className={part.match ? 'rounded-md bg-yellow-200 px-1 py-0.5 text-slate-900' : undefined}
                >
                    {part.text}
                </motion.span>
            ))}
        </p>
    );
}

function VoiceBubble({ message, reduceMotion }) {
    return (
        <div>
            <div className="voice-player-card flex items-center gap-2 rounded-2xl px-2.5 py-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-700 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-700/60">
                    <Play size={14} />
                </span>
                <div className="flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-300/70 dark:bg-slate-700/80">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                            initial={{ width: '10%' }}
                            animate={reduceMotion ? { width: '38%' } : { width: ['10%', '65%', '30%'] }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">Voice message</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    <Mic size={12} />
                    {getVoiceDuration(message)}
                </div>
            </div>
        </div>
    );
}

function MediaBubble({ message, reduceMotion }) {
    const mediaSource = getResolvableMediaSource(message);

    if (mediaSource) {
        return (
            <motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
                <div className="w-[70vw] max-w-[280px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/45 sm:max-w-[320px]">
                    <img
                        src={mediaSource}
                        alt="Media preview"
                        loading="lazy"
                        className="h-auto max-h-72 w-full object-cover"
                        onError={(event) => {
                            event.currentTarget.style.display = 'none';
                        }}
                    />
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                        <p className="text-xs font-medium text-[var(--text-muted)]">Image preview</p>
                        <a
                            href={mediaSource}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[var(--accent)]"
                        >
                            Open
                        </a>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
            <div className="w-[70vw] max-w-[280px] rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/45 sm:max-w-[320px]">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[var(--text-main)] dark:bg-slate-800/80">
                        <FileText size={18} />
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-[var(--text-main)]">{getMediaLabel(message)}</p>
                        <p className="text-xs text-[var(--text-muted)]">Tap to preview media</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function CallBubble({ message, reduceMotion }) {
    const details = getCallDetails(message);
    const Icon = details.icon === 'video' ? Video : Phone;
    const missedCall = /missed/i.test(details.label);

    return (
        <motion.div
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-1.5 flex justify-center px-2"
        >
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/75 px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50">
                <span className={clsx('inline-flex h-7 w-7 items-center justify-center rounded-full', missedCall ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20 dark:text-rose-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-100')}>
                    <Icon size={14} />
                </span>
                <span>{details.label}</span>
            </div>
        </motion.div>
    );
}

function ChatBubble({ message, isCurrentUser, avatar, query, isMatch, messageRef, onAddReaction, onReply, onCopy, onForward, onDelete, animateEntry }) {
    const reduceMotion = useReducedMotion();
    const longPressTimerRef = useRef(null);
    const bubbleContainerRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const messageType = classifyMessage(message);
    const reactionEntries = Object.entries(message.reactions || {}).filter(([, count]) => Number(count) > 0);
    const normalizedText = String(message?.message || '').trim();
    const shouldRenderText = messageType === 'text' && normalizedText.length > 0;
    const canDeleteForEveryone = Boolean(isCurrentUser && message?.firestoreId);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handleOutside = (event) => {
            if (!bubbleContainerRef.current?.contains(event.target)) {
                setMenuOpen(false);
                setReactionPickerOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                setReactionPickerOpen(false);
            }
        };

        window.addEventListener('mousedown', handleOutside);
        window.addEventListener('touchstart', handleOutside, { passive: true });
        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('mousedown', handleOutside);
            window.removeEventListener('touchstart', handleOutside);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [menuOpen]);

    if (message.isSystem) {
        return (
            <motion.div
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="my-2 flex justify-center px-1.5 text-center text-[10.5px] text-[var(--text-muted)] sm:px-2 md:px-4 md:text-[11px]"
            >
                <span className="system-message-chip inline-flex w-fit max-w-[98%] items-center gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--system-chip)] px-2.5 py-1 leading-[1.2rem] shadow sm:max-w-[94%] sm:gap-1.5 sm:px-3 sm:leading-5 md:max-w-[86%] md:px-3.5">
                    <Info size={12} className="system-message-chip__icon" />
                    <span className="system-message-chip__text">{message.message}</span>
                </span>
            </motion.div>
        );
    }

    if (messageType === 'call') {
        return <CallBubble message={message} reduceMotion={reduceMotion} />;
    }

    const bubbleColor = isCurrentUser ? 'premium-bubble-sent' : 'premium-bubble-received';
    const alignClass = isCurrentUser ? 'justify-end' : 'justify-start';
    const baseRadius = 'rounded-2xl';
    const radiusClass = message.isGrouped
        ? isCurrentUser
            ? 'rounded-tr-md'
            : 'rounded-tl-md'
        : isCurrentUser
            ? 'rounded-tr-sm'
            : 'rounded-tl-sm';
    const tailClass = !message.isGrouped
        ? isCurrentUser
            ? "before:content-[''] before:absolute before:top-0 before:-right-[6px] before:h-3.5 before:w-3.5 before:bg-[var(--bubble-tail-sent)] before:-skew-y-[35deg] before:rounded-bl-sm"
            : "before:content-[''] before:absolute before:top-0 before:-left-[6px] before:h-3.5 before:w-3.5 before:bg-[var(--bubble-tail-received)] before:skew-y-[35deg] before:rounded-br-sm"
        : '';
    const spacingClass = message.isGrouped ? 'my-0.5' : 'my-2.5 md:my-3';
    const statusIcon =
        message.deliveryStatus === 'read' ? (
            <CheckCheck size={12} className="text-emerald-700/70" />
        ) : message.deliveryStatus === 'delivered' ? (
            <CheckCheck size={12} className="text-emerald-900/45" />
        ) : (
            <Check size={12} className="text-emerald-900/45" />
        );

    return (
        <motion.div
            layout={!reduceMotion}
            ref={messageRef}
            className={`${spacingClass} flex ${alignClass}`}
            initial={animateEntry && !reduceMotion ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
        >
            {!isCurrentUser && message.showAvatar ? (
                <img
                    src={avatar || 'https://i.pravatar.cc/100?img=6'}
                    alt={message.sender}
                    className="mr-2 h-7 w-7 self-end rounded-full border border-white/80 object-cover shadow-sm ring-2 ring-white/70 dark:border-slate-700/70 dark:ring-slate-800/80 md:h-8 md:w-8"
                />
            ) : (
                !isCurrentUser && <div className="mr-2 w-7 md:w-8" />
            )}

            {/* Outer wrapper owns relative positioning for dropdown menu */}
            <div ref={bubbleContainerRef} className="relative">

                {/* Dropdown menu ΓÇö rendered as sibling to the bubble, above it, never clipped by bubble */}
                <AnimatePresence>
                    {menuOpen ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.93, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 4 }}
                            transition={{ duration: 0.13 }}
                            className={clsx(
                                'absolute bottom-full z-50 mb-1.5 min-w-[140px] rounded-xl border border-white/15 bg-[#111827]/97 p-1 text-xs text-slate-100 shadow-2xl backdrop-blur-md',
                                isCurrentUser ? 'right-0' : 'left-0'
                            )}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button type="button" className="flex w-full rounded-lg px-3 py-1.5 text-left hover:bg-white/10" onClick={() => { onReply?.(message); setMenuOpen(false); }}>
                                Reply
                            </button>
                            <button type="button" className="flex w-full rounded-lg px-3 py-1.5 text-left hover:bg-white/10" onClick={() => { onCopy?.(message); setMenuOpen(false); }}>
                                Copy
                            </button>
                            <button type="button" className="flex w-full rounded-lg px-3 py-1.5 text-left hover:bg-white/10" onClick={() => { onForward?.(message); setMenuOpen(false); }}>
                                Forward
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left hover:bg-white/10"
                                onClick={() => setReactionPickerOpen((prev) => !prev)}
                            >
                                <SmilePlus size={12} />
                                React
                            </button>
                            <div className="my-0.5 h-px bg-white/10" />
                            <button type="button" className="flex w-full rounded-lg px-3 py-1.5 text-left text-amber-200 hover:bg-white/10" onClick={() => { onDelete?.(message, 'me'); setMenuOpen(false); }}>
                                Delete for me
                            </button>
                            {canDeleteForEveryone ? (
                                <button type="button" className="flex w-full rounded-lg px-3 py-1.5 text-left text-rose-300 hover:bg-white/10" onClick={() => { onDelete?.(message, 'everyone'); setMenuOpen(false); }}>
                                    Delete for everyone
                                </button>
                            ) : null}
                        </motion.div>
                    ) : null}
                </AnimatePresence>

                <AnimatePresence>
                    {reactionPickerOpen ? (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className={clsx(
                                'absolute bottom-full z-50 mb-1.5 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/98 p-1 shadow-2xl',
                                isCurrentUser ? 'right-0' : 'left-0'
                            )}
                        >
                            <EmojiPicker
                                autoFocusSearch={false}
                                lazyLoadEmojis
                                skinTonesDisabled
                                previewConfig={{ showPreview: false }}
                                width={300}
                                height={360}
                                onEmojiClick={(emojiData) => {
                                    const emoji = String(emojiData?.emoji || '').trim();
                                    if (!emoji) return;
                                    onAddReaction?.(message, emoji);
                                    setReactionPickerOpen(false);
                                    setMenuOpen(false);
                                }}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>

                <motion.div
                    whileHover={reduceMotion ? undefined : { scale: 1.02, y: -1 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.985, y: 0 }}
                    onDoubleClick={() => onAddReaction?.(message, '👍')}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuOpen(true);
                        setReactionPickerOpen(false);
                    }}
                    onTouchStart={() => {
                        longPressTimerRef.current = window.setTimeout(() => {
                            setMenuOpen(true);
                        }, 550);
                    }}
                    onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                            window.clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                        }
                    }}
                    onTouchCancel={() => {
                        if (longPressTimerRef.current) {
                            window.clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                        }
                    }}
                    className={clsx(
                        `premium-message-bubble relative min-w-[80px] max-w-[95%] border px-3 pb-2 pt-3 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md sm:max-w-[88%] md:max-w-[82%] lg:max-w-[75%] md:px-3.5 md:pb-2.5 md:pt-3.5 ${bubbleColor} ${baseRadius} ${radiusClass} ${tailClass}`,
                        isCurrentUser ? 'text-slate-900' : 'text-[var(--text-main)]',
                        isMatch && 'ring-2 ring-yellow-300/80'
                    )}
                    style={{ paddingRight: '1.85rem' }}
                >
                    {/* Chevron trigger ΓÇö always top-right corner of the bubble */}
                    <button
                        type="button"
                        aria-label="Message actions"
                        title="Message actions"
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen((p) => {
                                const next = !p;
                                if (!next) {
                                    setReactionPickerOpen(false);
                                }
                                return next;
                            });
                        }}
                        className="chat-bubble-action-trigger absolute top-1.5 right-1.5 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white/90 shadow-md transition hover:bg-black/65"
                    >
                        <ChevronDown size={12} />
                    </button>
                    {!isCurrentUser && !message.isGrouped ? (
                        <p className="chat-bubble-sender mb-1 block max-w-[calc(100%-1.5rem)] truncate pr-6 text-[11px] font-semibold tracking-[0.01em] text-[var(--accent)]">{message.sender}</p>
                    ) : null}

                    {message.replyToText ? (
                        <div className="mb-1.5 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 text-xs">
                            <p className="truncate font-semibold text-[var(--accent)]">{message.replyToSender || 'Reply'}</p>
                            <p className="truncate opacity-85">{message.replyToText}</p>
                        </div>
                    ) : null}

                    <AnimatePresence mode="wait">
                        {messageType === 'voice' ? <VoiceBubble key="voice" message={message} reduceMotion={reduceMotion} /> : null}
                        {messageType === 'media' ? <MediaBubble key="media" message={message} reduceMotion={reduceMotion} /> : null}
                        {shouldRenderText ? <MessageHighlight key="text" message={message.message} query={query} reduceMotion={reduceMotion} /> : null}
                    </AnimatePresence>

                    <span
                        className={clsx(
                            'message-time-label mt-1.5 inline-flex w-full items-center justify-end gap-1 text-right text-[11px] leading-none',
                            isCurrentUser ? 'message-time-label--sent' : 'message-time-label--received'
                        )}
                    >
                        {message.time}
                        {isCurrentUser ? statusIcon : null}
                    </span>

                    {reactionEntries.length ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {reactionEntries.map(([emoji, count]) => (
                                <span key={`${message.id}-${emoji}`} className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                                    <span>{emoji}</span>
                                    <span>{count}</span>
                                </span>
                            ))}
                        </div>
                    ) : null}
                </motion.div>
            </div>
        </motion.div>
    );
}

export default ChatBubble;