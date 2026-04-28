/**
 * Default preference values for theme, appearance, and account settings.
 * Shared across Redux store, components, and UI configuration.
 */

export const DEFAULT_PREFERENCES = {
    // Theme preference: light, dark, or system (follows OS)
    THEME_PREFERENCE: 'dark',

    // Chat mode: professional or casual
    CHAT_MODE: 'casual',

    // Current user display name
    CURRENT_USER: 'You',

    // Default room/chat ID
    LAST_ROOM_ID: 'room1',

    // Background preferences
    SELECTED_BACKGROUND_ID: '',
    CUSTOM_BACKGROUND_URL: '',

    // Theme values for validation/filtering
    VALID_THEMES: ['light', 'dark', 'system'],
    VALID_CHAT_MODES: ['professional', 'casual'],
};

/**
 * Resolve system theme preference to actual light/dark value
 * Used when themePreference is 'system' to determine actual theme
 */
export function resolveSystemTheme() {
    if (typeof window === 'undefined') {
        return 'light'; // Default for SSR
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the effective theme (light or dark) based on preference
 * If preference is 'system', resolves to OS theme
 */
export function getEffectiveTheme(themePreference = DEFAULT_PREFERENCES.THEME_PREFERENCE) {
    if (themePreference === 'system') {
        return resolveSystemTheme();
    }
    return DEFAULT_PREFERENCES.VALID_THEMES.includes(themePreference)
        ? themePreference
        : DEFAULT_PREFERENCES.THEME_PREFERENCE;
}

/**
 * Validate and normalize a theme preference value
 */
export function normalizeThemePreference(theme) {
    return DEFAULT_PREFERENCES.VALID_THEMES.includes(theme)
        ? theme
        : DEFAULT_PREFERENCES.THEME_PREFERENCE;
}

/**
 * Validate and normalize a chat mode value
 */
export function normalizeChatMode(mode) {
    const safeMode = String(mode || '').trim().toLowerCase();

    // Backward compatibility with persisted legacy values.
    if (safeMode === 'romantic') {
        return 'casual';
    }

    if (safeMode === 'formal') {
        return 'professional';
    }

    return DEFAULT_PREFERENCES.VALID_CHAT_MODES.includes(safeMode)
        ? safeMode
        : DEFAULT_PREFERENCES.CHAT_MODE;
}

/**
 * Create initial Redux state with default preferences
 */
export function createInitialAppSessionState() {
    return {
        authSession: null,
        chatMode: DEFAULT_PREFERENCES.CHAT_MODE,
        themePreference: DEFAULT_PREFERENCES.THEME_PREFERENCE,
        currentUser: DEFAULT_PREFERENCES.CURRENT_USER,
        lastRoomId: DEFAULT_PREFERENCES.LAST_ROOM_ID,
        selectedBackgroundId: DEFAULT_PREFERENCES.SELECTED_BACKGROUND_ID,
        customBackgroundUrl: DEFAULT_PREFERENCES.CUSTOM_BACKGROUND_URL,
        avatars: {}
    };
}
