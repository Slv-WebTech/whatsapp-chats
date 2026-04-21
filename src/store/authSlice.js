import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    loadUserProfile,
    loginWithUsernamePassword,
    registerWithUsernamePassword,
    signOutCurrentUser,
    updateUserProfile as updateUserProfileInFirebase
} from '../firebase/socialService';

function isFirestoreTimestamp(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.toMillis === 'function';
}

function toSerializable(value) {
    if (isFirestoreTimestamp(value)) {
        return value.toMillis();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((entry) => toSerializable(entry));
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, entry]) => {
            acc[key] = toSerializable(entry);
            return acc;
        }, {});
    }

    return value;
}

function toFriendlyAuthError(error, fallbackMessage) {
    const rawCode = String(error?.code || '').trim();
    const rawMessage = String(error?.message || '').trim();
    const combined = `${rawCode} ${rawMessage}`.toLowerCase();

    if (combined.includes('auth/invalid-credential') || combined.includes('auth/wrong-password') || combined.includes('auth/user-not-found')) {
        return 'Invalid email or password. Please try again.';
    }

    if (combined.includes('auth/email-already-in-use')) {
        return 'This email is already registered. Please sign in instead.';
    }

    if (combined.includes('auth/invalid-email')) {
        return 'Please enter a valid email address.';
    }

    if (combined.includes('auth/weak-password')) {
        return 'Password is too weak. Use at least 6 characters.';
    }

    if (combined.includes('auth/too-many-requests')) {
        return 'Too many attempts. Please wait a moment and try again.';
    }

    if (combined.includes('permission') || combined.includes('insufficient-permission')) {
        return 'You do not have permission for this action.';
    }

    return fallbackMessage;
}

const initialState = {
    user: null,
    profile: null,
    status: 'idle',
    error: '',
    initialized: false
};

export const registerUser = createAsyncThunk('auth/registerUser', async ({ email, password }, thunkApi) => {
    try {
        const result = await registerWithUsernamePassword({ email, password });
        return result;
    } catch (error) {
        return thunkApi.rejectWithValue(toFriendlyAuthError(error, 'Unable to create your account right now.'));
    }
});

export const loginUser = createAsyncThunk('auth/loginUser', async ({ email, password }, thunkApi) => {
    try {
        const result = await loginWithUsernamePassword({ email, password });
        return result;
    } catch (error) {
        return thunkApi.rejectWithValue(toFriendlyAuthError(error, 'Unable to sign in right now.'));
    }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, thunkApi) => {
    try {
        await signOutCurrentUser();
        return true;
    } catch (error) {
        return thunkApi.rejectWithValue(toFriendlyAuthError(error, 'Unable to sign out right now.'));
    }
});

export const updateUserProfile = createAsyncThunk('auth/updateUserProfile', async (updates, thunkApi) => {
    try {
        const result = await updateUserProfileInFirebase(updates);
        return result;
    } catch (error) {
        return thunkApi.rejectWithValue(toFriendlyAuthError(error, 'Unable to update profile right now.'));
    }
});

export const refreshUserProfile = createAsyncThunk('auth/refreshUserProfile', async (uid, thunkApi) => {
    try {
        return await loadUserProfile(uid);
    } catch (error) {
        return thunkApi.rejectWithValue(error?.message || 'Unable to load profile.');
    }
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setResolvedAuthState(state, action) {
            state.user = action.payload?.user || null;
            state.profile = toSerializable(action.payload?.profile || null);
            state.initialized = true;
            state.status = 'idle';
            state.error = '';
        },
        setAuthPending(state) {
            state.status = 'loading';
            state.error = '';
        },
        clearAuthError(state) {
            state.error = '';
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(registerUser.pending, (state) => {
                state.status = 'loading';
                state.error = '';
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.status = 'idle';
                state.user = action.payload?.user || null;
                state.profile = toSerializable(action.payload?.profile || null);
                state.initialized = true;
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.payload || 'Unable to create account.';
                state.initialized = true;
            })
            .addCase(loginUser.pending, (state) => {
                state.status = 'loading';
                state.error = '';
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.status = 'idle';
                state.user = action.payload?.user || null;
                state.profile = toSerializable(action.payload?.profile || null);
                state.initialized = true;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.payload || 'Unable to sign in.';
                state.initialized = true;
            })
            .addCase(updateUserProfile.pending, (state) => {
                state.status = 'loading';
                state.error = '';
            })
            .addCase(updateUserProfile.fulfilled, (state, action) => {
                state.status = 'idle';
                state.profile = toSerializable(action.payload || null);
            })
            .addCase(updateUserProfile.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.payload || 'Unable to update profile.';
            })
            .addCase(refreshUserProfile.fulfilled, (state, action) => {
                state.profile = toSerializable(action.payload || null);
                state.initialized = true;
            })
            .addCase(refreshUserProfile.rejected, (state, action) => {
                state.initialized = true;
                state.error = action.payload || state.error;
            })
            .addCase(logoutUser.pending, (state) => {
                state.status = 'loading';
                state.error = '';
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.status = 'idle';
                state.user = null;
                state.profile = null;
                state.initialized = true;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.payload || 'Unable to sign out.';
            });
    }
});

export const { clearAuthError, setAuthPending, setResolvedAuthState } = authSlice.actions;

export const selectAuthUser = (state) => state.auth?.user ?? null;
export const selectAuthProfile = (state) => state.auth?.profile ?? null;
export const selectAuthStatus = (state) => state.auth?.status ?? initialState.status;
export const selectAuthError = (state) => state.auth?.error ?? '';
export const selectAuthInitialized = (state) => Boolean(state.auth?.initialized);
export const selectIsAuthenticated = (state) => Boolean(state.auth?.user?.uid);
export const selectIsAdmin = (state) => state.auth?.profile?.role === 'admin';

export default authSlice.reducer;