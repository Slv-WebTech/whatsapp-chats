import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AuthForms from './components/AuthForms';
import { useSimpleRouter } from './hooks/useSimpleRouter';
import AdminPage from './pages/Admin';
import ChatPage from './pages/Chat';
import Home from './pages/Home';
import ImportedChatPage from './pages/ImportedChat';
import ProfilePage from './pages/Profile';
import { getActiveChatRouteId, setActiveChatRouteId } from './utils/chatRouteState';
import {
    logoutUser,
    refreshUserProfile,
    selectAuthInitialized,
    selectIsAdmin,
    selectIsAuthenticated,
    setResolvedAuthState
} from './store/authSlice';
import { selectThemePreference } from './store/appSessionSlice';
import { loadUserProfile, subscribeAuthUser } from './firebase/socialService';

export default function RootApp() {
    const dispatch = useDispatch();
    const route = useSimpleRouter();
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const isAdmin = useSelector(selectIsAdmin);
    const authInitialized = useSelector(selectAuthInitialized);
    const themePreference = useSelector(selectThemePreference);
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Keep data-theme in sync across all pages
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setPrefersDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        const resolved = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference;
        document.documentElement.setAttribute('data-theme', resolved);
    }, [themePreference, prefersDark]);

    useEffect(() => {
        const unsubscribe = subscribeAuthUser(async (firebaseUser) => {
            if (!firebaseUser) {
                dispatch(setResolvedAuthState({ user: null, profile: null }));
                return;
            }

            const nextProfile = await loadUserProfile(firebaseUser.uid);
            dispatch(
                setResolvedAuthState({
                    user: { uid: firebaseUser.uid, email: firebaseUser.email || '' },
                    profile: nextProfile
                })
            );
            dispatch(refreshUserProfile(firebaseUser.uid));
        });

        return unsubscribe;
    }, [dispatch]);

    useEffect(() => {
        if (!authInitialized) {
            return;
        }

        const isProtectedPath = route.path === '/home' || route.path === '/profile' || route.path === '/chat' || route.path.startsWith('/chat/') || route.path.startsWith('/imported/') || route.path === '/admin';

        if (!isAuthenticated && isProtectedPath) {
            route.navigate('/', { replace: true });
        }

        if (isAuthenticated && route.path === '/') {
            route.navigate('/home', { replace: true });
        }

        if (route.path === '/admin' && isAuthenticated && !isAdmin) {
            route.navigate('/home', { replace: true });
        }
    }, [authInitialized, isAdmin, isAuthenticated, route]);

    useEffect(() => {
        if (!route.path.startsWith('/chat/')) {
            return;
        }

        const routeChatId = decodeURIComponent(route.path.replace('/chat/', '') || '').trim();
        if (!routeChatId) {
            route.navigate('/home', { replace: true });
            return;
        }

        setActiveChatRouteId(routeChatId);
        route.navigate('/chat', { replace: true });
    }, [route]);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        route.navigate('/', { replace: true });
    };

    if (!authInitialized) {
        return (
            <div className="grid min-h-[100svh] place-items-center bg-[var(--page-bg)] text-[var(--text-main)]">
                <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-5 py-4 text-sm">Loading account session...</div>
            </div>
        );
    }

    if (route.path === '/admin') {
        return <AdminPage navigate={route.navigate} />;
    }

    if (route.path === '/chat') {
        return <ChatPage chatId={getActiveChatRouteId()} navigate={route.navigate} onLogout={handleLogout} />;
    }

    if (route.path.startsWith('/imported/')) {
        const importedId = decodeURIComponent(route.path.replace('/imported/', '') || '');
        return <ImportedChatPage importedId={importedId} navigate={route.navigate} onLogout={handleLogout} />;
    }

    if (route.path === '/home') {
        return <Home navigate={route.navigate} onLogout={handleLogout} />;
    }

    if (route.path === '/profile') {
        return <ProfilePage navigate={route.navigate} onLogout={handleLogout} />;
    }

    return <AuthForms onAuthenticated={() => route.navigate('/home')} />;
}