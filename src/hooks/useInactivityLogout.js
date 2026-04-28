import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const WARNING_BEFORE_MS = 60 * 1000; // warn 1 minute before logout

// Activity events that reset the inactivity timer
const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'wheel',
    'pointermove',
];

/**
 * Automatically logs out the user after INACTIVITY_TIMEOUT_MS of no activity.
 * Fires an optional onWarning callback 1 minute before logout so the UI can
 * show a toast/banner.
 *
 * @param {object} params
 * @param {boolean}          params.enabled      – only active when the user is authenticated
 * @param {() => void}       params.onLogout     – called when the timeout fires
 * @param {() => void}       [params.onWarning]  – called 1 min before logout
 * @param {() => void}       [params.onActivity] – called whenever activity resets the timer
 */
export function useInactivityLogout({ enabled, onLogout, onWarning, onActivity }) {
    const logoutTimerRef = useRef(null);
    const warningTimerRef = useRef(null);
    const warnedRef = useRef(false);

    const clearTimers = useCallback(() => {
        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
            logoutTimerRef.current = null;
        }
        if (warningTimerRef.current) {
            clearTimeout(warningTimerRef.current);
            warningTimerRef.current = null;
        }
    }, []);

    const startTimers = useCallback(() => {
        clearTimers();
        warnedRef.current = false;

        // Warning fires (INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS) after last activity
        if (onWarning) {
            warningTimerRef.current = setTimeout(() => {
                if (!warnedRef.current) {
                    warnedRef.current = true;
                    onWarning();
                }
            }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
        }

        // Logout fires INACTIVITY_TIMEOUT_MS after last activity
        logoutTimerRef.current = setTimeout(() => {
            onLogout();
        }, INACTIVITY_TIMEOUT_MS);
    }, [clearTimers, onLogout, onWarning]);

    const handleActivity = useCallback(() => {
        if (!enabled) return;
        startTimers();
        onActivity?.();
    }, [enabled, startTimers, onActivity]);

    useEffect(() => {
        if (!enabled) {
            clearTimers();
            return;
        }

        // Start the initial countdown
        startTimers();

        // Attach activity listeners to the document (passive for performance)
        const options = { passive: true };
        ACTIVITY_EVENTS.forEach((event) => {
            document.addEventListener(event, handleActivity, options);
        });

        // Also reset when the user returns to the tab/window
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                handleActivity();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearTimers();
            ACTIVITY_EVENTS.forEach((event) => {
                document.removeEventListener(event, handleActivity, options);
            });
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, handleActivity, startTimers, clearTimers]);
}
