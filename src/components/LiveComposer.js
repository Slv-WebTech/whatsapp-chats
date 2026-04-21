import { useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Lock, Mic, Paperclip, Send, Smile, Sparkles, Wifi, WifiOff, WandSparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import BottomSheet from './BottomSheet';

function LiveComposer({
    messageValue,
    onMessageChange,
    onSendMessage,
    typingText,
    disabled,
    isSending,
    isOnline = true,
    queuedCount = 0,
    isQueueSyncing = false,
    isFirebaseReady,
    isLoading,
    encryptedLabel,
    quickReplies = [],
    onQuickReply,
    onVoiceInput,
    replyTo,
    onCancelReply,
    attachmentPreview,
    onAttachmentChange
}) {
    const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
    const attachmentInputRef = useRef(null);
    const QUICK_COMMANDS = [
        { value: '@AI summarize', icon: Sparkles, label: 'Summarize' },
        { value: '@AI explain', icon: WandSparkles, label: 'Explain' },
        { value: '@AI extract tasks', icon: FileText, label: 'Extract tasks' }
    ];
    const textAreaRef = useRef(null);

    const syncTextareaHeight = () => {
        const node = textAreaRef.current;
        if (!node) {
            return;
        }

        node.style.height = 'auto';
        node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
    };

    const connectionText = !isFirebaseReady
        ? 'Firebase not configured'
        : !isOnline
            ? `${queuedCount || 0} queued message${queuedCount === 1 ? '' : 's'} waiting for reconnection`
            : queuedCount > 0
                ? `${queuedCount} queued message${queuedCount === 1 ? '' : 's'} ready to sync`
                : 'Secure chat connected';
    const encryptionText = encryptedLabel || 'Encrypted chat';

    useEffect(() => {
        syncTextareaHeight();
    }, [messageValue]);

    return (
        <div
            className="relative bg-gradient-to-t from-black/18 via-black/12 to-transparent px-2.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-[2px] md:px-5 md:py-2"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/12 to-transparent dark:from-white/8" />

            <div className="relative z-10 mx-auto w-full max-w-4xl">
                {replyTo ? (
                    <div className="mb-1.5 rounded-2xl border border-cyan-100/30 bg-black/26 px-3 py-2 text-slate-100 md:mb-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/85">Replying to {replyTo.sender || 'message'}</p>
                                <p className="truncate text-xs text-slate-200/90">{replyTo.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onCancelReply}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10"
                                aria-label="Cancel reply"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                ) : null}

                {attachmentPreview ? (
                    <div className="mb-1.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/12 px-3 py-2 text-slate-100 md:mb-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100/85">📎 Attachment</p>
                                <p className="truncate text-xs text-slate-200/90">{attachmentPreview.name}</p>
                                {attachmentPreview.size ? (
                                    <p className="text-[10px] text-slate-300/70">{(attachmentPreview.size / 1024).toFixed(1)} KB</p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={() => onAttachmentChange?.(null)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10"
                                aria-label="Remove attachment"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="composer-action-rail scroll-thin mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-1 whitespace-nowrap md:mb-2">
                    {QUICK_COMMANDS.map((command) => (
                        <button
                            key={command.value}
                            type="button"
                            onClick={() => onMessageChange(command.value)}
                            className="composer-action-rail__item inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/26 bg-black/22 text-white/90 backdrop-blur transition-colors hover:bg-black/32 dark:border-slate-300/22 dark:bg-white/12"
                            title={command.label}
                            aria-label={command.label}
                        >
                            <command.icon size={13} />
                        </button>
                    ))}

                    <button
                        type="button"
                        onClick={onVoiceInput}
                        className="composer-action-rail__item inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-500/20 text-emerald-50 transition-colors hover:bg-emerald-500/28"
                        title="Voice input"
                        aria-label="Voice input"
                    >
                        <Mic size={13} />
                    </button>

                    <span
                        className="composer-action-rail__item inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/18 text-slate-100/90"
                        title={connectionText}
                        aria-label={connectionText}
                    >
                        {isFirebaseReady && isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    </span>

                    <span
                        className="composer-action-rail__item inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/18 text-slate-100/90"
                        title={encryptionText}
                        aria-label={encryptionText}
                    >
                        {isLoading ? <LoaderCircle size={11} className="animate-spin" /> : <Lock size={11} />}
                    </span>
                </div>

                {Array.isArray(quickReplies) && quickReplies.length ? (
                    <div className="mb-1.5 hidden flex-wrap items-center gap-1.5 md:mb-2 md:flex">
                        {quickReplies.slice(0, 2).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => onQuickReply?.(item)}
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-500/18 px-2.5 py-1 text-[11px] font-medium text-cyan-50 shadow-[0_10px_18px_rgba(34,211,238,0.14)] transition-transform hover:-translate-y-[1px]"
                            >
                                <WandSparkles size={11} />
                                <span className="truncate">{item}</span>
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="mb-0.5 min-h-4 pl-1 md:mb-1">
                    {typingText ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/30 px-2 py-0.5 text-[11px] text-slate-100 shadow-sm backdrop-blur dark:border-slate-300/25 dark:bg-white/12 dark:text-slate-100">
                            <span className="inline-flex items-center gap-[3px]">
                                <span className="typing-bubble-dot" style={{ backgroundColor: 'currentColor' }} />
                                <span className="typing-bubble-dot" style={{ backgroundColor: 'currentColor' }} />
                                <span className="typing-bubble-dot" style={{ backgroundColor: 'currentColor' }} />
                            </span>
                            <span>{typingText}</span>
                        </span>
                    ) : null}

                    {queuedCount > 0 || isQueueSyncing ? (
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-500/14 px-2 py-0.5 text-[11px] text-amber-50 shadow-sm backdrop-blur">
                            {isQueueSyncing ? <LoaderCircle size={11} className="animate-spin" /> : <WifiOff size={11} />}
                            <span>
                                {isQueueSyncing
                                    ? `Syncing ${queuedCount} queued message${queuedCount === 1 ? '' : 's'}`
                                    : `${queuedCount} queued message${queuedCount === 1 ? '' : 's'} will send when online`}
                            </span>
                        </span>
                    ) : null}
                </div>

                <div className="special-composer-shell rounded-[1.4rem] border border-cyan-100/25 bg-[linear-gradient(180deg,rgba(7,20,39,0.54),rgba(7,20,39,0.28))] p-1.5 shadow-[0_14px_32px_rgba(2,6,23,0.32)] backdrop-blur-xl dark:border-slate-300/15 md:p-2">
                    <div className="flex items-end gap-1 md:gap-2">
                        <div className="mb-1 flex items-center gap-1 md:mb-1.5">
                            <button
                                type="button"
                                onClick={() => setEmojiSheetOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/24 bg-white/10 text-slate-100"
                                aria-label="Open emoji picker"
                            >
                                <Smile size={15} />
                            </button>
                            <input
                                ref={attachmentInputRef}
                                type="file"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] || null;
                                    if (file) {
                                        onAttachmentChange?.({
                                            file,
                                            name: file.name,
                                            type: file.type || 'application/octet-stream',
                                            size: file.size
                                        });
                                    } else {
                                        onAttachmentChange?.(null);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => attachmentInputRef.current?.click()}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/24 bg-white/10 text-slate-100"
                                aria-label="Attach file"
                            >
                                <Paperclip size={15} />
                            </button>
                        </div>

                        <textarea
                            ref={textAreaRef}
                            value={messageValue}
                            onChange={(event) => onMessageChange(event.target.value)}
                            onInput={syncTextareaHeight}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    onSendMessage();
                                }
                            }}
                            enterKeyHint="send"
                            autoCapitalize="sentences"
                            autoCorrect="on"
                            spellCheck
                            inputMode="text"
                            placeholder="Type a message"
                            rows={1}
                            className="max-h-[140px] min-h-10 w-full resize-none overflow-y-auto rounded-[1.2rem] border border-cyan-100/28 bg-black/26 px-3 py-2 text-[16px] leading-normal text-slate-100 shadow-[0_12px_30px_rgba(2,6,23,0.24)] backdrop-blur-xl outline-none ring-0 transition-all duration-200 focus:border-emerald-300/75 focus:bg-black/38 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12),0_12px_30px_rgba(2,6,23,0.28)] dark:border-slate-300/20 dark:bg-slate-900/36 dark:focus:bg-slate-900/46 md:min-h-11 md:rounded-[1.35rem] md:px-3.5 md:py-2.5 md:text-sm"
                        />
                        <Button
                            type="button"
                            className="h-11 w-11 flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 p-0 text-slate-900 shadow-[0_10px_22px_rgba(34,211,238,0.3)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_14px_30px_rgba(34,211,238,0.34)] disabled:opacity-60 disabled:scale-100 active:scale-95 md:h-12 md:w-12"
                            onClick={() => {
                                onSendMessage();
                                if (navigator.vibrate) {
                                    navigator.vibrate(12);
                                }
                            }}
                            disabled={disabled || isSending}
                            aria-label="Send message"
                        >
                            {isSending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                        </Button>
                    </div>
                </div>
            </div>

            <BottomSheet open={emojiSheetOpen} onOpenChange={setEmojiSheetOpen} title="Emoji picker">
                <div className="grid grid-cols-8 gap-2">
                    {['😀', '😁', '😂', '😍', '🤔', '🔥', '👏', '👍', '❤️', '🎉', '🙏', '🚀', '😎', '🥳', '😮', '😅'].map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                                onMessageChange(`${messageValue || ''}${emoji}`);
                                setEmojiSheetOpen(false);
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xl"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </BottomSheet>
        </div>
    );
}

export default LiveComposer;
