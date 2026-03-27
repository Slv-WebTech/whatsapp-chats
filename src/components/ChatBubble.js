import { getHighlightParts } from '../utils/highlight';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FileText, Info, Mic, Phone, Play, Video } from 'lucide-react';
import { clsx } from 'clsx';
import { classifyMessage, getCallDetails, getMediaLabel, getResolvableMediaSource, getVoiceDuration } from '../utils/messageTypes';

function MessageHighlight({ message, query, reduceMotion }) {
    return (
        <p className="overflow-hidden whitespace-pre-line break-words text-[13px] leading-[1.35rem]">
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
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/45">
                    <img
                        src={mediaSource}
                        alt="Media preview"
                        loading="lazy"
                        className="h-32 w-full object-cover"
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
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/45">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[var(--text-main)] dark:bg-slate-800/80">
                        <FileText size={18} />
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-[var(--text-main)]">{getMediaLabel(message)}</p>
                        <p className="text-xs text-[var(--text-muted)]">Tap to preview attachment style</p>
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

function ChatBubble({ message, isCurrentUser, avatar, query, isMatch, messageRef, onReplayFrom, animateEntry }) {
    const reduceMotion = useReducedMotion();
    const messageType = classifyMessage(message);

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
    const spacingClass = message.isGrouped ? 'my-0.5' : 'my-1.5 md:my-2';

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
                    className="mr-1.5 h-6 w-6 self-end rounded-full border border-white/80 object-cover shadow-sm ring-2 ring-white/70 dark:border-slate-700/70 dark:ring-slate-800/80 md:mr-2 md:h-8 md:w-8"
                />
            ) : (
                !isCurrentUser && <div className="mr-1.5 w-6 md:mr-2 md:w-8" />
            )}

            <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.02, y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985, y: 0 }}
                type="button"
                onClick={onReplayFrom}
                className={clsx(
                    `premium-message-bubble relative max-w-[89%] border px-2.5 py-1.5 text-left shadow-sm transition-all duration-200 hover:shadow-md sm:max-w-[85%] md:max-w-[70%] md:px-3 md:py-2 ${bubbleColor} ${baseRadius} ${radiusClass} ${tailClass}`,
                    isCurrentUser ? 'text-white' : 'text-[var(--text-main)]',
                    isMatch && 'ring-2 ring-yellow-300/80'
                )}
            >
                {!isCurrentUser && !message.isGrouped ? (
                    <p className="mb-1 text-[11px] font-semibold text-[var(--accent)]">{message.sender}</p>
                ) : null}

                <AnimatePresence mode="wait">
                    {messageType === 'voice' ? <VoiceBubble key="voice" message={message} reduceMotion={reduceMotion} /> : null}
                    {messageType === 'media' ? <MediaBubble key="media" message={message} reduceMotion={reduceMotion} /> : null}
                    {messageType === 'text' ? <MessageHighlight key="text" message={message.message} query={query} reduceMotion={reduceMotion} /> : null}
                </AnimatePresence>

                <span
                    className={clsx(
                        'message-time-label mt-1 block text-right text-[11px] leading-none',
                        isCurrentUser ? 'message-time-label--sent' : 'message-time-label--received'
                    )}
                >
                    {message.time}
                </span>
            </motion.button>
        </motion.div>
    );
}

export default ChatBubble;
