import { BriefcaseBusiness, Heart, Lock, LogIn, MoonStar, ShieldCheck, Sparkles, SunMedium } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { BRAND, BRAND_ASSETS } from '../config/branding';

const PROFESSIONAL_WALLPAPER = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?fm=jpg&q=80&w=2000&auto=format&fit=crop';
const PERSONAL_WALLPAPER = 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?fm=jpg&q=80&w=2000&auto=format&fit=crop';

function SecretLogin({ onLogin, errorMessage, theme = 'dark', onThemeChange, chatMode = 'casual', onChatModeChange, onBackToHome }) {
    const [displayName, setDisplayName] = useState('');
    const [roomSecret, setRoomSecret] = useState('');
    const [localError, setLocalError] = useState('');

    const canSubmit = useMemo(() => displayName.trim().length >= 2 && roomSecret.length >= 6, [displayName, roomSecret]);
    const isCasual = chatMode === 'casual';
    const isDark = theme === 'dark';

    const submit = (event) => {
        event.preventDefault();

        if (!canSubmit) {
            setLocalError('Use a username (2+ chars) and common password (6+ chars).');
            return;
        }

        setLocalError('');
        onLogin?.({ displayName: displayName.trim(), secret: roomSecret });
    };

    return (
        <div className="relative flex min-h-[100svh] h-[100svh] w-full items-center justify-center overflow-hidden px-4 md:min-h-screen md:h-[100dvh]">
            <motion.div
                aria-hidden="true"
                initial={{ opacity: 0.42, scale: 1.02 }}
                animate={{ opacity: isCasual ? [0.3, 0.42, 0.3] : [0.58, 0.72, 0.58], scale: [1.02, 1.06, 1.02] }}
                transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                className="absolute inset-0"
                style={{
                    clipPath: 'polygon(0 0, 62% 0, 42% 100%, 0 100%)',
                    backgroundImage: isDark
                        ? `linear-gradient(180deg, rgba(8,15,28,0.38), rgba(8,15,28,0.68)), url(${PROFESSIONAL_WALLPAPER})`
                        : `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(226,232,240,0.18)), url(${PROFESSIONAL_WALLPAPER})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    filter: isDark ? 'saturate(0.9)' : 'saturate(1.06) contrast(1.06) brightness(1.02)'
                }}
            />
            <motion.div
                aria-hidden="true"
                initial={{ opacity: 0.4, scale: 1.04 }}
                animate={{ opacity: isCasual ? [0.58, 0.74, 0.58] : [0.32, 0.46, 0.32], scale: [1.04, 1.08, 1.04] }}
                transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 1.2 }}
                className="absolute inset-0"
                style={{
                    clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 38% 100%)',
                    backgroundImage: isDark
                        ? `linear-gradient(180deg, rgba(54,18,34,0.26), rgba(54,18,34,0.64)), url(${PERSONAL_WALLPAPER})`
                        : `linear-gradient(180deg, rgba(255,244,247,0.1), rgba(255,228,236,0.22)), url(${PERSONAL_WALLPAPER})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    filter: isDark ? 'saturate(0.98)' : 'saturate(1.08) contrast(1.04) brightness(1.03)'
                }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rotate-[18deg] bg-white/18 shadow-[0_0_30px_rgba(255,255,255,0.18)]" />
            <div className={`absolute inset-0 opacity-80 ${isCasual ? 'bg-[radial-gradient(circle_at_18%_16%,rgba(236,72,153,0.20),transparent_45%),radial-gradient(circle_at_82%_82%,rgba(251,113,133,0.18),transparent_40%)]' : 'bg-[radial-gradient(circle_at_20%_18%,rgba(14,165,233,0.18),transparent_45%),radial-gradient(circle_at_80%_84%,rgba(34,197,94,0.14),transparent_42%)]'}`} />
            <div className={`absolute inset-0 ${isDark ? 'bg-[linear-gradient(120deg,rgba(2,6,23,0.68),rgba(15,23,42,0.35),rgba(2,6,23,0.64))]' : 'bg-[linear-gradient(120deg,rgba(255,255,255,0.28),rgba(255,255,255,0.08),rgba(248,250,252,0.22))]'}`} />
            <div className="pointer-events-none absolute inset-x-4 top-5 flex items-start justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70 sm:inset-x-8 sm:text-xs">
                <div className="rounded-full border border-white/14 bg-slate-950/22 px-3 py-1 backdrop-blur-sm">Professional</div>
                <div className="rounded-full border border-white/14 bg-slate-950/22 px-3 py-1 backdrop-blur-sm">Personal</div>
            </div>
            <div className="hero-orb left-[-90px] top-[8%] h-56 w-56 bg-slate-300/30" />
            <div className="hero-orb right-[-70px] top-[18%] h-72 w-72 bg-slate-400/25" />

            <motion.form
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={submit}
                className="w-full max-w-sm"
            >
                <Card className={`${isDark ? 'ambient-ring premium-panel border border-white/20 bg-slate-950/68 backdrop-blur-xl shadow-[0_28px_80px_rgba(0,0,0,0.34)]' : 'premium-panel border border-slate-200/85 bg-white/95 shadow-[0_14px_36px_rgba(148,163,184,0.14)] backdrop-blur-[1px]'} overflow-hidden rounded-[1.6rem]`}>
                    <CardContent className="p-5 sm:p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 shadow-[0_8px_22px_rgba(16,185,129,0.22)]">
                                    <ShieldCheck size={18} />
                                </span>
                                <img
                                    src={isDark ? BRAND_ASSETS.logoDark : BRAND_ASSETS.logoLight}
                                    alt={BRAND.name}
                                    className="h-10 w-10 rounded-xl object-contain"
                                />
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{BRAND.name}</p>
                                    <h1 className="text-lg font-semibold text-[var(--text-main)]">{BRAND.tagline}</h1>
                                </div>
                            </div>

                            <div className={`flex items-center gap-1.5 rounded-full p-1 shadow-sm ${isDark ? 'border border-[var(--border-soft)] bg-[var(--panel-soft)]/80' : 'border border-slate-200/90 bg-white/96 shadow-[0_10px_24px_rgba(148,163,184,0.12)]'}`}>
                                <button
                                    type="button"
                                    onClick={() => onThemeChange?.('dark')}
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-all ${theme === 'dark' ? 'bg-emerald-500 text-white shadow-[0_10px_18px_rgba(16,185,129,0.25)]' : 'text-[var(--text-muted)] hover:bg-white/10'}`}
                                    aria-label="Dark theme"
                                >
                                    <MoonStar size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onThemeChange?.('light')}
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-all ${theme === 'light' ? 'bg-emerald-500 text-white shadow-[0_10px_18px_rgba(16,185,129,0.25)]' : 'text-[var(--text-muted)] hover:bg-white/10'}`}
                                    aria-label="Light theme"
                                >
                                    <SunMedium size={15} />
                                </button>
                            </div>
                        </div>

                        <div className={`mb-4 flex items-center justify-between rounded-2xl p-2 shadow-sm ${isDark ? 'border border-[var(--border-soft)] bg-[var(--panel-soft)]/78' : 'border border-slate-200/90 bg-white/96 shadow-[0_12px_26px_rgba(148,163,184,0.12)]'}`}>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Mode</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Pick the tone</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => onChatModeChange?.('casual')}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all ${chatMode === 'casual' ? 'border-pink-400/40 bg-pink-500/18 text-pink-200 shadow-[0_10px_20px_rgba(244,114,182,0.22)]' : 'border-[var(--border-soft)] text-[var(--text-muted)] hover:bg-white/10'}`}
                                    aria-label="Personal mode"
                                >
                                    <motion.span
                                        animate={chatMode === 'casual' ? { y: [0, -2, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
                                        transition={chatMode === 'casual' ? { duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' } : { duration: 0.2 }}
                                        className="inline-flex"
                                    >
                                        <Heart size={15} />
                                    </motion.span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onChatModeChange?.('professional')}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all ${chatMode === 'professional' ? 'border-sky-400/40 bg-sky-500/18 text-sky-200 shadow-[0_10px_20px_rgba(56,189,248,0.2)]' : 'border-[var(--border-soft)] text-[var(--text-muted)] hover:bg-white/10'}`}
                                    aria-label="Professional mode"
                                >
                                    <motion.span
                                        animate={chatMode === 'professional' ? { y: [0, -2, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
                                        transition={chatMode === 'professional' ? { duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' } : { duration: 0.2 }}
                                        className="inline-flex"
                                    >
                                        <BriefcaseBusiness size={15} />
                                    </motion.span>
                                </button>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${chatMode === 'casual' ? 'bg-pink-500/12 text-pink-200' : 'bg-sky-500/12 text-sky-200'}`}>
                                    {chatMode === 'casual' ? 'Casual' : 'Professional'}
                                </span>
                            </div>
                        </div>

                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Display Name</label>
                        <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            className="mb-3 h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 text-sm text-[var(--text-main)] outline-none focus:border-emerald-400/60"
                            placeholder="Rahul"
                            autoFocus
                        />

                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Common Password</label>
                        <input
                            value={roomSecret}
                            onChange={(event) => setRoomSecret(event.target.value)}
                            type="password"
                            className="mb-2 h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 text-sm text-[var(--text-main)] outline-none focus:border-emerald-400/60"
                            placeholder="••••••••"
                        />

                        {localError ? <p className="mb-2 text-xs text-rose-300">{localError}</p> : null}
                        {errorMessage ? <p className="mb-2 text-xs text-rose-300">{errorMessage}</p> : null}

                        <Button type="submit" className="mt-2 h-11 w-full rounded-xl" disabled={!canSubmit}>
                            <Lock size={15} />
                            Unlock Chat
                        </Button>

                        {onBackToHome ? (
                            <Button type="button" variant="ghost" className="mt-2 h-10 w-full rounded-xl" onClick={onBackToHome}>
                                Back to Home
                            </Button>
                        ) : null}
                    </CardContent>
                </Card>
            </motion.form>
        </div>
    );
}

export default SecretLogin;
