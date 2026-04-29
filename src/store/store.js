import CryptoJS from 'crypto-js';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { createTransform, FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist';
import authReducer from './authSlice';
import appSessionReducer from './appSessionSlice';
import { BRAND_PERSIST_FALLBACK } from '../config/brandTokens';
import indexedDbStorage from './indexedDbStorage';

const persistSecret = import.meta.env.PUBLIC_REDUX_PERSIST_SECRET || BRAND_PERSIST_FALLBACK;
let shouldPurgePersistedState = false;

const isValidSessionState = (session) => {
    if (!session || typeof session !== 'object' || Array.isArray(session)) {
        return false;
    }

    const hasValidString = (value) => typeof value === 'string';
    const hasValidAuthSession =
        session.authSession === null ||
        (typeof session.authSession === 'object' &&
            session.authSession !== null &&
            !Array.isArray(session.authSession) &&
            hasValidString(session.authSession.displayName) &&
            hasValidString(session.authSession.secret));
    const hasValidAvatars = session.avatars && typeof session.avatars === 'object' && !Array.isArray(session.avatars);

    return (
        hasValidAuthSession &&
        ['casual', 'professional', 'romantic', 'formal'].includes(session.chatMode) &&
        ['light', 'dark', 'system'].includes(session.themePreference) &&
        hasValidString(session.currentUser) &&
        hasValidString(session.lastRoomId) &&
        hasValidString(session.selectedBackgroundId) &&
        hasValidString(session.customBackgroundUrl) &&
        hasValidAvatars
    );
};

const encryptedSessionTransform = createTransform(
    (inboundState) => {
        try {
            return CryptoJS.AES.encrypt(JSON.stringify(inboundState), persistSecret).toString();
        } catch {
            return inboundState;
        }
    },
    (outboundState) => {
        if (typeof outboundState !== 'string') {
            if (outboundState == null) {
                return outboundState;
            }

            shouldPurgePersistedState = true;
            return outboundState;
        }

        try {
            const decrypted = CryptoJS.AES.decrypt(outboundState, persistSecret).toString(CryptoJS.enc.Utf8);
            if (!decrypted) {
                shouldPurgePersistedState = true;
                return undefined;
            }

            const parsedState = JSON.parse(decrypted);
            if (!isValidSessionState(parsedState)) {
                shouldPurgePersistedState = true;
                return undefined;
            }

            return parsedState;
        } catch {
            shouldPurgePersistedState = true;
            return undefined;
        }
    },
    { whitelist: ['session'] }
);

const persistConfig = {
    key: 'root',
    version: 1,
    storage: indexedDbStorage,
    whitelist: ['session', 'auth'],
    transforms: [encryptedSessionTransform]
};

const rootReducer = combineReducers({
    auth: authReducer,
    session: appSessionReducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
            }
        })
});

export const persistor = persistStore(store, null, () => {
    if (!shouldPurgePersistedState) {
        return;
    }

    shouldPurgePersistedState = false;
    persistor.purge().catch(() => {
        // Ignore purge errors and continue with reducer defaults.
    });
});
