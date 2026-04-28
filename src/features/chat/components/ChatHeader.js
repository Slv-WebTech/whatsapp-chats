import { ArrowLeft, BarChart3, CalendarClock, ChevronDown, ChevronUp, Download, Lock, LogOut, Menu, MoonStar, MoreVertical, Search, Settings, Settings2, Sparkles, SunMedium, Upload, Users, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/UI/button';
import { Input } from '../../../shared/components/UI/input';
import { clsx } from 'clsx';

function ChatHeader({
    title,
    avatar,
    theme,
    onThemeChange,
    onTitleClick,
    isGroupChat,
    contactMeta,
    search,
    onSearchChange,
    resultCount,
    activeMatchIndex,
    onSearchPrev,
    onSearchNext,
    onSearchKeyDown,
    onOpenSettings,
    onOpenImport,
    onOpenSummary,
    onExport,
    showSearch,
    onToggleSearch,
    showTimeline,
    onToggleTimeline,
    showInsights,
    onToggleInsights,
    aiPanelOpen,
    onToggleAiPanel,
    compact,
    onOpenSidebar,
    onBackToHome,
    onLogout
}) {
    const shouldReduceMotion = useReducedMotion();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuContainerRef = useRef(null);
    const statusLine =
        contactMeta?.statusLine ||
        (contactMeta?.isOnline
            ? 'Online'
            : contactMeta?.lastSeenLabel
                ? `Last seen ${contactMeta.lastSeenLabel}`
                : 'Last seen recently');

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handlePointerDown = (event) => {
            if (!menuContainerRef.current?.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
            }
        };

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('touchstart', handlePointerDown, { passive: true });
        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('touchstart', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [menuOpen]);

    return (
        <motion.header
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            className={clsx(
                'chat-header special-edition-header sticky top-0 z-20 border-b border-white/35 bg-[linear-gradient(120deg,rgba(15,23,42,0.72),rgba(8,47,73,0.56),rgba(15,23,42,0.72))] px-2.5 py-1.5 text-slate-100 shadow-[0_8px_24px_rgba(2,6,23,0.24)] backdrop-blur-xl dark:border-slate-600/40 dark:bg-[linear-gradient(120deg,rgba(2,6,23,0.88),rgba(15,23,42,0.82),rgba(2,6,23,0.88))] md:px-5',
                compact ? 'min-h-[2.9rem] md:min-h-[3.2rem]' : 'min-h-[3.2rem] md:min-h-16'
            )}
        >
            <div className="chat-header__content mx-auto flex w-full max-w-4xl flex-col gap-1.5 md:gap-2">
                <div className="chat-header__row flex items-center justify-between gap-1.5 md:gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                        {onOpenSidebar ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="header-icon-button h-9 w-9 md:hidden"
                                aria-label="Open chat sidebar"
                                title="Open chat sidebar"
                                onClick={() => onOpenSidebar?.()}
                            >
                                <Menu size={16} />
                            </Button>
                        ) : null}

                        {/* Avatar — group gets gradient icon badge, DM gets normal avatar */}
                        <div className="relative flex-shrink-0">
                            {isGroupChat ? (
                                <div className="relative h-9 w-9 md:h-10 md:w-10">
                                    {avatar && !avatar.includes('pravatar') ? (
                                        <img
                                            src={avatar}
                                            alt={title}
                                            className="h-full w-full rounded-full border border-white/20 object-cover shadow"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-full border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 via-sky-500/20 to-violet-500/25 shadow-inner">
                                            <Users size={16} className="text-emerald-300" />
                                        </div>
                                    )}
                                    {/* Members-online pulse dot */}
                                    {contactMeta?.isOnline ? (
                                        <>
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/60" />
                                        </>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <img
                                        src={avatar || 'https://i.pravatar.cc/100?img=12'}
                                        alt={title}
                                        className="h-8 w-8 rounded-full border border-white/70 object-cover shadow-sm sm:h-9 sm:w-9 md:h-10 md:w-10"
                                    />
                                    {contactMeta?.isOnline ? (
                                        <>
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/70" />
                                        </>
                                    ) : (
                                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 dark:border-slate-900" />
                                    )}
                                </>
                            )}
                        </div>

                        <div className="min-w-0">
                            {isGroupChat ? (
                                /* ── Group title row ── */
                                <button
                                    type="button"
                                    onClick={onTitleClick}
                                    className="group flex items-center gap-1.5 text-left"
                                    title="Open group settings"
                                >
                                    <h3 className="truncate text-[0.9rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[0.95rem] md:text-[1rem]">
                                        {title || 'Group'}
                                    </h3>
                                    <Settings2
                                        size={13}
                                        className="flex-shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
                                    />
                                </button>
                            ) : (
                                <h3 className="truncate text-[0.9rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[0.95rem] md:text-[1rem]">
                                    {title || 'Chat'}
                                </h3>
                            )}

                            <p className="chat-header__status inline-flex max-w-full items-center gap-1 truncate text-[11px] text-slate-500 dark:text-slate-300 md:text-xs">
                                {isGroupChat ? (
                                    <Users size={10} className="flex-shrink-0 text-emerald-400/80" />
                                ) : (
                                    <Lock size={11} className="flex-shrink-0" />
                                )}
                                {statusLine}
                            </p>
                        </div>
                    </div>

                    <div className="chat-header__actions flex items-center gap-0.5 md:gap-1 lg:gap-1.5">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="header-icon-button h-10 w-10 md:h-[2.2rem] md:w-[2.2rem]"
                            aria-label={showSearch ? 'Hide search' : 'Show search'}
                            onClick={() => onToggleSearch?.()}
                            title={showSearch ? 'Hide search' : 'Show search'}
                        >
                            <Search size={16} />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="header-icon-button hidden h-10 w-10 sm:inline-flex md:h-[2.35rem] md:w-[2.35rem]"
                            aria-label="Toggle AI panel"
                            onClick={() => onToggleAiPanel?.()}
                            title="AI assistant"
                        >
                            <Sparkles size={16} className={aiPanelOpen ? 'text-cyan-300' : ''} />
                        </Button>
                        <div ref={menuContainerRef} className="relative">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="header-icon-button h-10 w-10 md:h-[2.2rem] md:w-[2.2rem]"
                                aria-label="More actions"
                                onClick={() => setMenuOpen((prev) => !prev)}
                            >
                                <MoreVertical size={16} />
                            </Button>

                            {menuOpen ? (
                                <div className="header-menu-panel absolute right-0 top-10 z-30 w-48 rounded-xl border p-1 shadow-xl">
                                    {isGroupChat && onTitleClick ? (
                                        <button
                                            type="button"
                                            className="header-menu-item"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onTitleClick?.();
                                            }}
                                        >
                                            <Settings size={14} />
                                            Group Settings
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onThemeChange(theme === 'light' ? 'dark' : 'light');
                                        }}
                                    >
                                        {theme === 'light' ? <MoonStar size={14} /> : <SunMedium size={14} />}
                                        {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                                    </button>
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onToggleSearch?.();
                                        }}
                                    >
                                        <Search size={14} />
                                        {showSearch ? 'Hide search' : 'Show search'}
                                    </button>
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onToggleTimeline?.();
                                        }}
                                    >
                                        <CalendarClock size={14} />
                                        {showTimeline ? 'Hide timeline' : 'Show timeline'}
                                    </button>
                                    {onOpenImport ? (
                                        <button
                                            type="button"
                                            className="header-menu-item"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onOpenImport?.();
                                            }}
                                        >
                                            <Upload size={14} />
                                            Import chat
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onOpenSummary?.();
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        Summary
                                    </button>
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onOpenSettings?.();
                                        }}
                                    >
                                        <Settings2 size={14} />
                                        Settings
                                    </button>
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onToggleAiPanel?.();
                                        }}
                                    >
                                        <BarChart3 size={14} />
                                        {aiPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}
                                    </button>
                                    <button
                                        type="button"
                                        className="header-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onExport?.();
                                        }}
                                    >
                                        <Download size={14} />
                                        Export PNG
                                    </button>
                                    {onBackToHome ? (
                                        <button
                                            type="button"
                                            className="header-menu-item"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onBackToHome?.();
                                            }}
                                        >
                                            <ArrowLeft size={14} />
                                            Back to Home
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="header-menu-item text-rose-500 dark:text-rose-300"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onLogout?.();
                                        }}
                                    >
                                        <LogOut size={14} />
                                        Logout
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {showSearch ? (
                    <div className="chat-header__search flex items-center gap-1 rounded-xl border border-cyan-100/35 bg-slate-950/72 px-1.5 py-1 shadow-sm backdrop-blur lg:gap-1.5">
                        <Search size={15} className="text-slate-100/80" />
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onKeyDown={onSearchKeyDown}
                            placeholder="Search in conversation"
                            className="h-7 w-full min-w-0 flex-1 border-cyan-100/20 bg-black/20 text-sm text-slate-100 placeholder:text-slate-300/70 focus:ring-cyan-200/40 lg:h-8"
                        />
                        <span className="hidden rounded-full border border-cyan-100/25 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-100 lg:inline-flex">
                            {search.trim() ? `${Math.min(activeMatchIndex + 1, resultCount || 0)}/${resultCount}` : 'Search'}
                        </span>
                        <div className="hidden items-center gap-1.5 md:inline-flex">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="header-icon-button h-7 w-7"
                                aria-label="Previous search match"
                                onClick={onSearchPrev}
                                disabled={!resultCount}
                            >
                                <ChevronUp size={14} />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="header-icon-button h-7 w-7"
                                aria-label="Next search match"
                                onClick={onSearchNext}
                                disabled={!resultCount}
                            >
                                <ChevronDown size={14} />
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </motion.header>
    );
}

export default ChatHeader;