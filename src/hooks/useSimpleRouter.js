import { useCallback, useEffect, useMemo, useState } from 'react';

function getCurrentRoute() {
    if (typeof window === 'undefined') {
        return { path: '/', search: '', hash: '' };
    }

    return {
        path: window.location.pathname || '/',
        search: window.location.search || '',
        hash: window.location.hash || ''
    };
}

export function useSimpleRouter() {
    const [route, setRoute] = useState(getCurrentRoute);

    useEffect(() => {
        const onChange = () => setRoute(getCurrentRoute());
        window.addEventListener('popstate', onChange);
        return () => window.removeEventListener('popstate', onChange);
    }, []);

    const navigate = useCallback((to, { replace = false } = {}) => {
        if (typeof window === 'undefined') {
            return;
        }

        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({}, '', to);
        setRoute(getCurrentRoute());
    }, []);

    const params = useMemo(() => new URLSearchParams(route.search), [route.search]);

    return {
        ...route,
        params,
        navigate
    };
}