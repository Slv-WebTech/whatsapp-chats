import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AuthForms from './features/auth/components/AuthForms';
import OnboardingModal, { useOnboarding } from './components/OnboardingModal.jsx';
import { useSimpleRouter } from './app/router/useSimpleRouter';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { useToast } from './components/ui/Toast.jsx';
const AdminPage = lazy(() => import('./pages/Admin'));
const ChatPage = lazy(() => import('./pages/Chat'));
const Home = lazy(() => import('./pages/Home'));
const ImportedChatPage = lazy(() => import('./pages/ImportedChat'));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const ProfilePage = lazy(() => import('./pages/Profile'));
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
import { loadUserProfile, subscribeAuthUser, syncUserChatMembership } from './services/firebase/socialService';

export default function RootApp() {
    const dispatch = useDispatch();
    const route = useSimpleRouter();
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const { toast } = useToast();
    const isAdmin = useSelector(selectIsAdmin);
    const authInitialized = useSelector(selectAuthInitialized);
    const themePreference = useSelector(selectThemePreference);
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

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
            syncUserChatMembership(firebaseUser.uid).catch(() => {
                // Non-blocking warmup for user chat sidebar data.
            });
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

        if (isAuthenticated && (route.path === '/' || route.path === '/landing' || route.path === '/login')) {
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

    const handleLogout = useCallback(async () => {
        await dispatch(logoutUser());
        route.navigate('/', { replace: true });
    }, [dispatch, route]);

    const handleInactivityWarning = useCallback(() => {
        toast('You will be logged out in 1 minute due to inactivity.', 'info', 60000);
    }, [toast]);

    useInactivityLogout({
        enabled: isAuthenticated,
        onLogout: handleLogout,
        onWarning: handleInactivityWarning,
    });

    const loadingFallback = (
        <div className="grid min-h-[100svh] place-items-center bg-[var(--page-bg)] text-[var(--text-main)]">
            <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-5 py-4 text-sm">Loading page...</div>
        </div>
    );

    if (!authInitialized) {
        return (
            <div className="grid min-h-[100svh] place-items-center bg-[var(--page-bg)] text-[var(--text-main)]">
                <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-5 py-4 text-sm">Loading account session...</div>
            </div>
        );
    }

    if (route.path === '/admin') {
        return <Suspense fallback={loadingFallback}><AdminPage navigate={route.navigate} /></Suspense>;
    }

    if (route.path === '/chat') {
        return <Suspense fallback={loadingFallback}><ChatPage chatId={getActiveChatRouteId()} navigate={route.navigate} onLogout={handleLogout} /></Suspense>;
    }

    if (route.path.startsWith('/imported/')) {
        const importedId = decodeURIComponent(route.path.replace('/imported/', '') || '');
        return <Suspense fallback={loadingFallback}><ImportedChatPage importedId={importedId} navigate={route.navigate} onLogout={handleLogout} /></Suspense>;
    }

    if (route.path === '/home') {
        return <Suspense fallback={loadingFallback}><Home navigate={route.navigate} onLogout={handleLogout} /></Suspense>;
    }

    if (route.path === '/profile') {
        return <Suspense fallback={loadingFallback}><ProfilePage navigate={route.navigate} onLogout={handleLogout} /></Suspense>;
    }

    if (route.path === '/' || route.path === '/landing') {
        return (
            <Suspense fallback={loadingFallback}>
                <LandingPage
                    onSignIn={() => route.navigate('/login')}
                    onSelectAction={(action) => {
                        if (action === 'live') route.navigate('/login');
                        else if (action === 'import') route.navigate('/login');
                        else if (action === 'analyze') route.navigate('/login');
                    }}
                />
            </Suspense>
        );
    }

    if (route.path === '/login' || route.path === '/sign-up') {
        return (
            <>
                {isAuthenticated && showOnboarding && <OnboardingModal onDone={dismissOnboarding} />}
                <AuthForms onAuthenticated={() => route.navigate('/home')} />
            </>
        );
    }

    return (
        <>
            {isAuthenticated && showOnboarding && <OnboardingModal onDone={dismissOnboarding} />}
            <AuthForms onAuthenticated={() => route.navigate('/home')} />
        </>
    );
}