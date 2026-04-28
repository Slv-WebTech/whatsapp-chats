import { ArrowLeft, LogOut, Palette, Settings, Sparkles, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from './Layout';
import { Button } from '../components/ui/button';
import { FilePicker } from '../components/ui/file-picker';
import SettingsPanel from '../components/SettingsPanel';
import PremiumUsernameTag from '../components/PremiumUsernameTag';
import {
    resetUserPreferences,
    selectAvatarPreferences,
    selectChatMode,
    selectCustomBackgroundUrl,
    selectSelectedBackgroundId,
    selectThemePreference,
    setBackgroundPreference,
    setChatMode,
    setThemePreference,
    setUserAvatar
} from '../store/appSessionSlice';
import { selectAuthProfile, selectIsAdmin, updateUserProfile } from '../store/authSlice';
import { PRESET_CHAT_BACKGROUNDS } from '../utils/chatBackgrounds';
import { fetchNotificationPreferences, saveNotificationPreferences } from '../services/api/notificationPreferences';
import { cacheNotificationPreferences } from '../services/firebase/pushNotifications';

export default function ProfilePage({ navigate, onLogout }) {
    const dispatch = useDispatch();
    const profile = useSelector(selectAuthProfile);
    const isAdmin = useSelector(selectIsAdmin);
    const themePreference = useSelector(selectThemePreference);
    const chatMode = useSelector(selectChatMode);
    const selectedBackgroundId = useSelector(selectSelectedBackgroundId);
    const customBackgroundUrl = useSelector(selectCustomBackgroundUrl);
    const avatars = useSelector(selectAvatarPreferences);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState('account');
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [preferencesSaving, setPreferencesSaving] = useState(false);
    const [preferencesError, setPreferencesError] = useState('');
    const [notificationPrefs, setNotificationPrefs] = useState({
        messageAlerts: true,
        mentionAlerts: true,
        insightAlerts: true,
        pushEnabled: true
    });

    const resolvedTheme = useMemo(() => {
        if (themePreference !== 'system') {
            return themePreference;
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }, [themePreference]);

    const username = profile?.username || 'user';
    const profileAvatar = avatars[username] || 'https://i.pravatar.cc/100?img=12';

    const handleThemeChange = (nextTheme) => {
        if (['light', 'dark', 'system'].includes(nextTheme)) {
            dispatch(setThemePreference(nextTheme));
        }
    };

    const handleChatModeChange = (nextMode) => {
        dispatch(setChatMode(nextMode));
    };

    const handleBackgroundUpload = (file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            dispatch(setBackgroundPreference({ presetId: '', customUrl: String(reader.result || '') }));
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundPresetSelect = (presetId) => {
        dispatch(setBackgroundPreference({ presetId: String(presetId || '').trim(), customUrl: '' }));
    };

    const handleAvatarUpload = (targetUser, file) => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            dispatch(setUserAvatar({ user: targetUser, avatarUrl: String(reader.result || '') }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveUsername = async (nextUsername) => {
        setIsUpdatingUsername(true);

        try {
            await dispatch(updateUserProfile({ username: nextUsername }));
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleResetPreferences = () => {
        if (window.confirm('Reset all profile preferences to defaults?')) {
            dispatch(resetUserPreferences());
        }
    };

    useEffect(() => {
        let cancelled = false;

        if (tab !== 'preferences') {
            return () => { cancelled = true; };
        }

        setPreferencesLoading(true);
        setPreferencesError('');

        fetchNotificationPreferences()
            .then((prefs) => {
                if (cancelled || !prefs) return;
                const normalized = {
                    messageAlerts: Boolean(prefs.messageAlerts),
                    mentionAlerts: Boolean(prefs.mentionAlerts),
                    insightAlerts: Boolean(prefs.insightAlerts),
                    pushEnabled: Boolean(prefs.pushEnabled)
                };
                setNotificationPrefs(normalized);
                cacheNotificationPreferences(normalized);
            })
            .catch(() => {
                if (cancelled) return;
                setPreferencesError('Could not load notification preferences.');
            })
            .finally(() => {
                if (!cancelled) {
                    setPreferencesLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [tab]);

    const updateNotificationPreference = async (key, value) => {
        const next = { ...notificationPrefs, [key]: value };
        setNotificationPrefs(next);
        setPreferencesSaving(true);
        setPreferencesError('');

        try {
            await saveNotificationPreferences(next);
            cacheNotificationPreferences(next);
        } catch {
            setPreferencesError('Failed to save preferences. Please try again.');
        } finally {
            setPreferencesSaving(false);
        }
    };

    const sidebar = (
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-start">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/home')}
                    className="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
                    aria-label="Back to home"
                    title="Back to home"
                >
                    <ArrowLeft size={15} />
                </Button>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3 md:p-4">
                <div className="flex items-center gap-3">
                    <img src={profileAvatar} alt={username} className="h-14 w-14 rounded-full border border-[var(--border-soft)] object-cover" />
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80">Profile</p>
                        <PremiumUsernameTag username={username} className="mt-1" />
                    </div>
                </div>

                <FilePicker
                    className="mt-3"
                    accept="image/*"
                    placeholder="Update profile picture"
                    buttonLabel="Upload"
                    onFileSelect={(file) => handleAvatarUpload(username, file)}
                />
            </div>

            <div className="space-y-1.5 rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-2">
                <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${tab === 'account' ? 'bg-emerald-500/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                    onClick={() => setTab('account')}
                >
                    <span className="inline-flex items-center gap-2"><UserCircle2 size={15} /> Account</span>
                </button>
                <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${tab === 'theme' ? 'bg-emerald-500/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                    onClick={() => setTab('theme')}
                >
                    <span className="inline-flex items-center gap-2"><Sparkles size={15} /> Theme</span>
                </button>
                <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${tab === 'appearance' ? 'bg-emerald-500/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                    onClick={() => setTab('appearance')}
                >
                    <span className="inline-flex items-center gap-2"><Palette size={15} /> Appearance</span>
                </button>
                <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${tab === 'preferences' ? 'bg-emerald-500/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                    onClick={() => setTab('preferences')}
                >
                    <span className="inline-flex items-center gap-2"><Settings size={15} /> Preferences</span>
                </button>
            </div>

            <Button type="button" variant="ghost" onClick={onLogout} className="justify-start gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] py-2.5">
                <LogOut size={15} />
                Logout
            </Button>
        </div>
    );

    return (
        <Layout
            sidebar={sidebar}
            sidebarOpen={sidebarOpen}
            onSidebarOpenChange={setSidebarOpen}
            title="Profile"
            showAdmin={isAdmin}
            rightAction={null}
        >
            <div className="scroll-thin min-h-0 h-full overflow-y-auto overscroll-contain p-2.5 md:p-6">
                {tab === 'theme' ? (
                    <SettingsPanel
                        section="theme"
                        theme={resolvedTheme}
                        themePreference={themePreference}
                        onThemeChange={handleThemeChange}
                        onResetPreferences={handleResetPreferences}
                    />
                ) : null}

                {tab === 'appearance' ? (
                    <SettingsPanel
                        section="appearance"
                        theme={resolvedTheme}
                        chatMode={chatMode}
                        onChatModeChange={handleChatModeChange}
                        selectedBackgroundId={selectedBackgroundId}
                        hasCustomBackground={Boolean(customBackgroundUrl)}
                        backgroundOptions={PRESET_CHAT_BACKGROUNDS}
                        onBackgroundUpload={handleBackgroundUpload}
                        onBackgroundPresetSelect={handleBackgroundPresetSelect}
                    />
                ) : null}

                {tab === 'account' ? (
                    <SettingsPanel
                        section="participants"
                        theme={resolvedTheme}
                        username={username}
                        onUsernameUpdate={handleSaveUsername}
                        isUpdatingUsername={isUpdatingUsername}
                        users={[username]}
                        currentUser={username}
                        onCurrentUserChange={() => { }}
                        onAvatarUpload={handleAvatarUpload}
                        onResetPreferences={handleResetPreferences}
                    />
                ) : null}

                {tab === 'preferences' ? (
                    <div className="space-y-3">
                        <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                            <h3 className="text-base font-semibold text-[var(--text-main)]">Quick Preferences</h3>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">All profile and workspace personalization options are available in this screen. Changes sync securely through Redux + IndexedDB.</p>
                            <Button type="button" variant="outline" className="mt-4" onClick={handleResetPreferences}>Reset Preferences</Button>
                        </div>

                        <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                            <h3 className="text-base font-semibold text-[var(--text-main)]">Notification Preferences</h3>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Control message, mention, and insight alerts for web notifications.</p>

                            {preferencesError ? (
                                <p className="mt-3 text-xs text-rose-300">{preferencesError}</p>
                            ) : null}

                            <div className="mt-4 space-y-2">
                                {[
                                    { key: 'pushEnabled', label: 'Push notifications enabled' },
                                    { key: 'messageAlerts', label: 'New message alerts' },
                                    { key: 'mentionAlerts', label: 'Mention alerts' },
                                    { key: 'insightAlerts', label: 'AI insight alerts' }
                                ].map((item) => (
                                    <label key={item.key} className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-main)]">
                                        <span>{item.label}</span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(notificationPrefs[item.key])}
                                            disabled={preferencesLoading || preferencesSaving}
                                            onChange={(event) => updateNotificationPreference(item.key, event.target.checked)}
                                        />
                                    </label>
                                ))}
                            </div>

                            {(preferencesLoading || preferencesSaving) ? (
                                <p className="mt-3 text-xs text-[var(--text-muted)]">Syncing preferences...</p>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </Layout>
    );
}
