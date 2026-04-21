import { createSlice } from '@reduxjs/toolkit';
import { createInitialAppSessionState, DEFAULT_PREFERENCES, normalizeThemePreference, normalizeChatMode } from '../utils/defaultPreferences';

const initialState = createInitialAppSessionState();

const appSessionSlice = createSlice({
    name: 'session',
    initialState,
    reducers: {
        setAuthSession(state, action) {
            const displayName = String(action.payload?.displayName || action.payload?.username || '').trim();
            const secret = String(action.payload?.secret || '').trim();

            if (!displayName || !secret) {
                state.authSession = null;
                return;
            }

            state.authSession = { displayName, secret };
            state.currentUser = displayName;
        },
        clearAuthSession(state) {
            state.authSession = null;
            state.currentUser = 'You';
            state.lastRoomId = 'room1';
        },
        setChatMode(state, action) {
            state.chatMode = normalizeChatMode(action.payload);
        },
        setThemePreference(state, action) {
            state.themePreference = normalizeThemePreference(action.payload);
        },
        setCurrentUser(state, action) {
            const nextUser = String(action.payload || '').trim();
            state.currentUser = nextUser || 'You';
        },
        setLastRoomId(state, action) {
            const nextRoomId = String(action.payload || '').trim();
            state.lastRoomId = nextRoomId || 'room1';
        },
        setBackgroundPreference(state, action) {
            const presetId = String(action.payload?.presetId || '').trim();
            const customUrl = String(action.payload?.customUrl || '').trim();

            state.selectedBackgroundId = presetId;
            state.customBackgroundUrl = presetId ? '' : customUrl;
        },
        setUserAvatar(state, action) {
            const user = String(action.payload?.user || '').trim();
            const avatarUrl = String(action.payload?.avatarUrl || '').trim();

            if (!user) {
                return;
            }

            if (!avatarUrl) {
                delete state.avatars[user];
                return;
            }

            state.avatars[user] = avatarUrl;
        },
        resetUserPreferences(state) {
            state.chatMode = initialState.chatMode;
            state.themePreference = initialState.themePreference;
            state.currentUser = initialState.currentUser;
            state.selectedBackgroundId = initialState.selectedBackgroundId;
            state.customBackgroundUrl = initialState.customBackgroundUrl;
            state.avatars = {};
        }
    }
});

export const { clearAuthSession, resetUserPreferences, setAuthSession, setBackgroundPreference, setChatMode, setCurrentUser, setLastRoomId, setThemePreference, setUserAvatar } = appSessionSlice.actions;

export const selectAuthSession = (state) => state.session?.authSession ?? null;
export const selectChatMode = (state) => state.session?.chatMode ?? initialState.chatMode;
export const selectThemePreference = (state) => state.session?.themePreference ?? initialState.themePreference;
export const selectCurrentUser = (state) => state.session?.currentUser ?? initialState.currentUser;
export const selectLastRoomId = (state) => state.session?.lastRoomId ?? initialState.lastRoomId;
export const selectSelectedBackgroundId = (state) => state.session?.selectedBackgroundId ?? initialState.selectedBackgroundId;
export const selectCustomBackgroundUrl = (state) => state.session?.customBackgroundUrl ?? initialState.customBackgroundUrl;
export const selectAvatarPreferences = (state) => state.session?.avatars ?? {};

export default appSessionSlice.reducer;