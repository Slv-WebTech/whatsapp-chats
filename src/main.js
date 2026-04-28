import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import RootApp from './app/router/RootApp';
import AppErrorBoundary from './shared/components/layout/AppErrorBoundary';
import './index.css';
import { persistor, store } from './app/store/store';
import { BRAND } from './shared/config/branding';
import { BRAND_SW_CACHE_PREFIX } from './config/brandTokens';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const DARK_FAVICON = `${import.meta.env.BASE_URL}favicon-dark-32x32.ico`;
const LIGHT_FAVICON = `${import.meta.env.BASE_URL}favicon-light-32x32.ico`;
const DARK_THEME_COLOR = '#0f172a';
const LIGHT_THEME_COLOR = '#f8fafc';

const showAppUpdateToast = () => {
    if (typeof document === 'undefined') {
        return;
    }

    const existingToast = document.getElementById('app-update-toast');
    if (existingToast) {
        return;
    }

    const toast = document.createElement('div');
    toast.id = 'app-update-toast';
    toast.textContent = 'App updated, reloading...';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    Object.assign(toast.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        padding: '10px 14px',
        borderRadius: '12px',
        border: '1px solid rgba(148,163,184,0.4)',
        background: 'rgba(15,23,42,0.92)',
        color: '#e2e8f0',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '0.8rem',
        letterSpacing: '0.01em',
        boxShadow: '0 16px 34px rgba(2,6,23,0.35)',
        opacity: '0',
        transition: 'opacity 180ms ease'
    });

    document.body.appendChild(toast);
    window.requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });
};

const PersistLoading = () => (
    <div
        style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            color: '#cbd5e1',
            background: 'linear-gradient(160deg, #081318 0%, #0f172a 100%)',
            fontFamily: "'Inter', 'Segoe UI', sans-serif"
        }}
    >
        <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{`Loading ${BRAND.name}...`}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.52, letterSpacing: '0.04em' }}>{BRAND.tagline}</p>
        </div>
    </div>
);

const syncFaviconWithTheme = () => {
    if (typeof document === 'undefined') {
        return;
    }

    const htmlTheme = document.documentElement.getAttribute('data-theme');
    const isDark = htmlTheme === 'dark';
    const baseHref = isDark ? DARK_FAVICON : LIGHT_FAVICON;
    const nextHref = `${baseHref}?v=${encodeURIComponent(APP_VERSION)}&t=${isDark ? 'dark' : 'light'}`;
    const existing = document.getElementById('app-favicon');
    const shortcut = document.getElementById('app-favicon-shortcut');

    if (existing) {
        existing.setAttribute('href', nextHref);
    } else {
        const link = document.createElement('link');
        link.id = 'app-favicon';
        link.rel = 'icon';
        link.type = 'image/x-icon';
        link.href = nextHref;
        document.head.appendChild(link);
    }

    if (shortcut) {
        shortcut.setAttribute('href', nextHref);
    } else {
        const shortcutLink = document.createElement('link');
        shortcutLink.id = 'app-favicon-shortcut';
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.type = 'image/x-icon';
        shortcutLink.href = nextHref;
        document.head.appendChild(shortcutLink);
    }
};

const syncThemeColorWithTheme = () => {
    if (typeof document === 'undefined') {
        return;
    }

    const htmlTheme = document.documentElement.getAttribute('data-theme');
    const isDark = htmlTheme === 'dark';
    const nextColor = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    const existing = document.querySelector('meta[name="theme-color"]');

    if (existing) {
        existing.setAttribute('content', nextColor);
        return;
    }

    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', nextColor);
    document.head.appendChild(meta);
};

const cleanupLegacyFaviconLinks = () => {
    if (typeof document === 'undefined') {
        return;
    }

    const managedIds = new Set(['app-favicon', 'app-favicon-shortcut']);
    const candidates = document.head.querySelectorAll('link[rel]');

    candidates.forEach((link) => {
        const relTokens = link
            .getAttribute('rel')
            ?.toLowerCase()
            .split(/\s+/)
            .filter(Boolean);

        if (!relTokens || !relTokens.includes('icon')) {
            return;
        }

        if (managedIds.has(link.id)) {
            return;
        }

        link.remove();
    });
};

if (typeof document !== 'undefined') {
    cleanupLegacyFaviconLinks();
    syncFaviconWithTheme();
    syncThemeColorWithTheme();

    const observer = new MutationObserver(() => {
        syncFaviconWithTheme();
        syncThemeColorWithTheme();
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(`${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(APP_VERSION)}&cp=${encodeURIComponent(BRAND_SW_CACHE_PREFIX)}`, {
                scope: import.meta.env.BASE_URL
            })
            .then((registration) => {
                registration.update().catch(() => {
                    // Ignore update check failures.
                });

                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) {
                        return;
                    }

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                let hasRefreshed = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (hasRefreshed) {
                        return;
                    }

                    hasRefreshed = true;
                    showAppUpdateToast();
                    window.setTimeout(() => {
                        window.location.reload();
                    }, 900);
                });
            })
            .catch((error) => {
                console.error('Service worker registration failed:', error);
            });
    });
} else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
            registration.unregister().catch(() => {
                // Ignore cleanup failures in development.
            });
        });
    });
}

import { ToastProvider } from './shared/components/UI/Toast.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <Provider store={store}>
                <PersistGate loading={<PersistLoading />} persistor={persistor}>
                    <ToastProvider>
                        <RootApp />
                    </ToastProvider>
                </PersistGate>
            </Provider>
        </AppErrorBoundary>
    </React.StrictMode>
);
