import { Heart, ImagePlus, Laptop, MoonStar, Sparkles, SunMedium, Trash2, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { FilePicker } from './ui/file-picker';
import { Input } from './ui/input';
import PremiumUsernameTag from './PremiumUsernameTag';

function SettingsPanel({
    section = 'appearance',
    theme,
    themePreference,
    onThemeChange,
    chatMode,
    onChatModeChange,
    users,
    currentUser,
    onCurrentUserChange,
    username,
    onUsernameUpdate,
    isUpdatingUsername = false,
    onAvatarUpload,
    onBackgroundUpload,
    selectedBackgroundId,
    hasCustomBackground = false,
    backgroundOptions = [],
    onBackgroundPresetSelect,
    onResetPreferences,
    onExport,
    onClearChat,
    isClearingChat = false,
    onDeleteChatData,
    isDeletingChatData = false
}) {
    const [usernameDraft, setUsernameDraft] = useState('');
    const formatUsername = (value) => {
        const safeValue = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '');
        if (!safeValue) {
            return '';
        }
        return `${safeValue.charAt(0).toUpperCase()}${safeValue.slice(1)}`;
    };
    const isTheme = section === 'theme';
    const isAppearance = section === 'appearance';
    const isParticipants = section === 'participants';
    const isExport = section === 'export';
    const USERNAME_PATTERN = /^[A-Z][A-Za-z0-9_]{2,19}$/;
    const normalizedUsername = formatUsername(username);
    const normalizedDraft = formatUsername(usernameDraft);
    const isUsernameValid = USERNAME_PATTERN.test(normalizedDraft);
    const canSaveUsername = useMemo(() => {
        if (!onUsernameUpdate || isUpdatingUsername) {
            return false;
        }

        return isUsernameValid && normalizedDraft !== normalizedUsername;
    }, [isUsernameValid, isUpdatingUsername, normalizedDraft, normalizedUsername, onUsernameUpdate]);

    useEffect(() => {
        setUsernameDraft(normalizedUsername);
    }, [normalizedUsername]);
    // Filter by both chatMode and theme mode (light/dark)
    const modeFilteredBackgrounds = backgroundOptions.filter(
        (item) => !item.chatMode || item.chatMode === chatMode
    );
    const lightBackgroundOptions = modeFilteredBackgrounds.filter((item) => item.mode === 'light');
    const darkBackgroundOptions = modeFilteredBackgrounds.filter((item) => item.mode === 'dark');

    const renderBackgroundPresetGroup = (title, options) => {
        if (!options.length) {
            return null;
        }

        return (
            <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{title}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onBackgroundPresetSelect?.(option.id)}
                            className={`overflow-hidden rounded-lg border text-left transition ${selectedBackgroundId === option.id
                                ? 'border-emerald-400/60 ring-1 ring-emerald-400/40'
                                : 'border-[var(--border-soft)] hover:border-emerald-400/40'
                                }`}
                            title={option.label}
                        >
                            <div
                                className="h-10 w-full bg-cover bg-center"
                                style={{ backgroundImage: `url(${option.url})` }}
                            />
                            <div className="truncate px-1.5 py-1 text-[10px] font-medium text-[var(--text-main)]">{option.label}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-3">
            {isTheme ? (
                <Card className="ambient-ring premium-panel overflow-hidden">
                    <CardContent className="p-4">
                        <h2 className="inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--text-main)]">
                            <SunMedium size={18} />
                            Theme Preference
                        </h2>

                        <div className="mt-3 flex rounded-full p-1 surface-soft">
                            <button
                                type="button"
                                onClick={() => onThemeChange('light')}
                                className={`theme-pill ${themePreference === 'light' ? 'theme-pill-active' : ''}`}
                            >
                                <SunMedium size={14} />
                                Light
                            </button>
                            <button
                                type="button"
                                onClick={() => onThemeChange('dark')}
                                className={`theme-pill ${themePreference === 'dark' ? 'theme-pill-active' : ''}`}
                            >
                                <MoonStar size={14} />
                                Dark
                            </button>
                            <button
                                type="button"
                                onClick={() => onThemeChange('system')}
                                className={`theme-pill ${themePreference === 'system' ? 'theme-pill-active' : ''}`}
                            >
                                <Laptop size={14} />
                                Auto
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                            Auto follows your device color scheme.
                        </p>
                    </CardContent>
                </Card>
            ) : null}

            {isAppearance ? (
                <Card className="ambient-ring premium-panel overflow-hidden">
                    <CardContent className="p-4">
                        <h2 className="inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--text-main)]">
                            <Sparkles size={18} />
                            Appearance
                        </h2>

                        <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Chat Mode</p>
                            <div className="mt-2 flex rounded-full p-1 surface-soft">
                                <button
                                    type="button"
                                    onClick={() => onChatModeChange?.('formal')}
                                    className={`theme-pill ${chatMode === 'formal' ? 'theme-pill-active' : ''}`}
                                >
                                    <Sparkles size={14} />
                                    Formal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onChatModeChange?.('romantic')}
                                    className={`theme-pill ${chatMode === 'romantic' ? 'theme-pill-active' : ''}`}
                                >
                                    <Heart size={14} />
                                    Romantic
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-[var(--text-muted)]">
                                Formal uses neutral tones. Romantic applies softer love-focused styling.
                            </p>
                        </div>

                        <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
                            <ImagePlus size={15} />
                            Chat Background Image
                        </label>
                        <FilePicker
                            className="mt-1"
                            accept="image/*"
                            buttonLabel="Upload"
                            placeholder="Choose background image"
                            onFileSelect={onBackgroundUpload}
                        />

                        <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Background Presets</p>
                            <div className="mt-1 max-h-[300px] overflow-y-auto scroll-thin pr-1">
                                <button
                                    type="button"
                                    onClick={() => onBackgroundPresetSelect?.('')}
                                    className={`mt-2 w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${!selectedBackgroundId && !hasCustomBackground
                                        ? 'border-emerald-400/60 bg-emerald-500/10 text-[var(--text-main)]'
                                        : 'border-[var(--border-soft)] bg-[var(--panel-soft)] text-[var(--text-muted)] hover:border-emerald-400/40'
                                        }`}
                                >
                                    Theme Default
                                </button>

                                {hasCustomBackground ? (
                                    <p className="mt-2 text-[11px] font-medium text-emerald-300">Custom wallpaper selected</p>
                                ) : null}

                                {theme === 'light' ? renderBackgroundPresetGroup('Light Presets', lightBackgroundOptions) : renderBackgroundPresetGroup('Dark Presets', darkBackgroundOptions)}
                                {theme === 'light' ? renderBackgroundPresetGroup('Dark Presets', darkBackgroundOptions) : renderBackgroundPresetGroup('Light Presets', lightBackgroundOptions)}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {isParticipants ? (
                <Card className="ambient-ring premium-panel overflow-hidden">
                    <CardContent className="p-4">
                        <h3 className="inline-flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-main)]">
                            <UserCircle2 size={17} />
                            Participants
                        </h3>

                        {onUsernameUpdate ? (
                            <div className="mt-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    Account Username
                                </label>
                                <Input
                                    value={usernameDraft}
                                    onChange={(event) => setUsernameDraft(formatUsername(event.target.value))}
                                    placeholder="Viveks05"
                                    className="mt-2"
                                />
                                <div className="mt-2">
                                    <PremiumUsernameTag username={normalizedDraft || normalizedUsername || 'user'} compact />
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="mt-2 w-full"
                                    disabled={!canSaveUsername}
                                    onClick={() => onUsernameUpdate(normalizedDraft)}
                                >
                                    {isUpdatingUsername ? 'Saving username…' : 'Save Username'}
                                </Button>
                            </div>
                        ) : null}

                        <p className="mt-3 text-xs text-[var(--text-muted)]">Upload a profile image per sender.</p>
                        <div className="mt-2.5 max-h-64 overflow-y-auto scroll-thin space-y-2.5 pr-1">
                            {users.map((user) => (
                                <label key={user} className="block rounded-[1rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-2.5 text-sm">
                                    <span className="mb-2 block font-medium text-[var(--text-main)]">{user}</span>
                                    <FilePicker
                                        accept="image/*"
                                        buttonLabel="Avatar"
                                        placeholder={`Upload avatar for ${user}`}
                                        onFileSelect={(file) => onAvatarUpload(user, file)}
                                        className="mt-1"
                                    />
                                </label>
                            ))}
                        </div>

                        <Button type="button" variant="outline" onClick={onResetPreferences} className="mt-3 w-full">
                            Reset all preferences
                        </Button>
                    </CardContent>
                </Card>
            ) : null}

            {isExport ? (
                <Card className="ambient-ring premium-panel overflow-hidden">
                    <CardContent className="p-4">
                        <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--text-main)]">Export</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                            Capture the full rendered chat as a PNG image, including current theme, wallpaper, and message styling.
                        </p>

                        <Button type="button" variant="secondary" onClick={onExport} className="mt-3 w-full">
                            Export Chat as PNG
                        </Button>

                        <div className="mt-4 rounded-[1.2rem] border border-amber-400/25 bg-amber-500/8 p-3">
                            <h4 className="text-sm font-semibold text-[var(--text-main)]">Clear Chat Room</h4>
                            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                Delete all messages in the current room while keeping the room itself available for fresh conversation.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClearChat}
                                disabled={isClearingChat || isDeletingChatData}
                                className="mt-3 w-full border-amber-400/35 bg-amber-500/10 text-[var(--text-main)] hover:bg-amber-500/18"
                            >
                                <Trash2 size={15} />
                                {isClearingChat ? 'Clearing messages...' : 'Clear Chat'}
                            </Button>
                        </div>

                        <div className="mt-5 rounded-[1.2rem] border border-red-400/25 bg-red-500/8 p-3">
                            <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-red-200 dark:text-red-200">
                                <Trash2 size={15} />
                                Danger Zone
                            </h4>
                            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                Permanently delete all messages, typing, and presence data for the current room from Firebase. This is a real delete and cannot be undone.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onDeleteChatData}
                                disabled={isDeletingChatData}
                                className="mt-3 w-full border-red-400/35 bg-red-500/10 text-red-100 hover:bg-red-500/18"
                            >
                                <Trash2 size={15} />
                                {isDeletingChatData ? 'Deleting chat permanently...' : 'Delete Chat Data from Firebase'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

export default SettingsPanel;
