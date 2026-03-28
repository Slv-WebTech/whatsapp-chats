import { BarChart3, CalendarClock, ChevronDown, ChevronUp, Download, Lock, MoonStar, MoreVertical, Search, Settings2, Sparkles, SunMedium, Upload, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

function ChatHeader({
    title,
    avatar,
    theme,
    onThemeChange,
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
    onToggleInsights
}) {
    const shouldReduceMotion = useReducedMotion();
    const [menuOpen, setMenuOpen] = useState(false);
    const statusLine = contactMeta?.isOnline
        ? 'online'
        : contactMeta?.lastSeenLabel
            ? `last seen ${contactMeta.lastSeenLabel}`
            : 'last seen recently';

    return (
        <motion.header
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            className="chat-header sticky top-0 z-20 min-h-[3.2rem] border-b border-white/45 bg-white/52 px-2.5 py-1.5 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] dark:border-slate-700/50 dark:bg-slate-950/42 dark:text-slate-100 md:min-h-14 md:px-3.5 xl:px-4"
        >
            <div className="chat-header__content flex flex-col gap-1.5">
                <div className="chat-header__row flex items-center justify-between gap-1.5">
                    <div className="min-w-0 flex items-center gap-1.5">
                        <img
                            src={avatar || 'https://i.pravatar.cc/100?img=12'}
                            alt={title}
                            className="h-7 w-7 rounded-full border-2 border-white/35 object-cover shadow-lg sm:h-8 sm:w-8 lg:h-9 lg:w-9 xl:h-10 xl:w-10"
                        />
                        <div className="min-w-0">
                            <h3 className="truncate text-[0.86rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[0.92rem] lg:text-[0.96rem]">{title || 'Chat'}</h3>
                            <p className="chat-header__status inline-flex max-w-full items-center gap-1 truncate text-[10px] text-slate-500 dark:text-slate-300 lg:gap-1.5 lg:text-[11px]">
                                <Lock size={12} />
                                {statusLine}
                            </p>
                        </div>
                    </div>

                    <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/55 dark:text-slate-300 xl:inline-flex">
                        <CalendarClock size={13} />
                        <span>{contactMeta?.messageCount || 0} msgs</span>
                        <span>•</span>
                        <span>{contactMeta?.activeDayCount || 0} active days</span>
                    </div>

                    <div className="chat-header__actions flex items-center gap-1 lg:gap-1.5">
                        <Button type="button" variant="ghost" size="icon" className="header-icon-button hidden h-10 w-10 md:inline-flex md:h-[2.35rem] md:w-[2.35rem]" aria-label="Video call preview">
                            <Video size={16} />
                        </Button>
                        <Button
                            type="button"
                            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
                            variant="ghost"
                            size="icon"
                            className="header-icon-button h-9 w-9 md:h-[2.2rem] md:w-[2.2rem]"
                            aria-label="Toggle light and dark theme"
                        >
                            {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="header-icon-button hidden h-10 w-10 md:inline-flex md:h-[2.35rem] md:w-[2.35rem]" aria-label="Open settings" onClick={onOpenSettings}>
                            <Settings2 size={16} />
                        </Button>
                        <div className="relative">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="header-icon-button h-9 w-9 md:h-[2.2rem] md:w-[2.2rem]"
                                aria-label="More actions"
                                onClick={() => setMenuOpen((prev) => !prev)}
                            >
                                <MoreVertical size={16} />
                            </Button>

                            {menuOpen ? (
                                <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-xl dark:border-slate-700/60 dark:bg-slate-950/90">
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
                                            onToggleInsights?.();
                                        }}
                                    >
                                        <BarChart3 size={14} />
                                        {showInsights ? 'Close Insights' : 'View Insights'}
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
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {showSearch ? (
                    <div className="chat-header__search flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/70 px-1.5 py-1 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/55 lg:gap-1.5">
                        <Search size={15} className="text-slate-500 dark:text-slate-300" />
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onKeyDown={onSearchKeyDown}
                            placeholder="Search in conversation"
                            className="h-7 w-full min-w-0 flex-1 border-slate-200/70 bg-white/70 text-sm text-slate-800 placeholder:text-slate-500 focus:ring-blue-200 dark:border-slate-700/70 dark:bg-slate-900/65 dark:text-slate-100 dark:placeholder:text-slate-400 lg:h-8"
                        />
                        <span className="hidden rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 lg:inline-flex">
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
