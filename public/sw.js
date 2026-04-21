const appVersion = new URL(self.location.href).searchParams.get('v') || 'dev';
const cachePrefix = new URL(self.location.href).searchParams.get('cp') || 'app-cache';
const CACHE_NAME = `${cachePrefix}-${appVersion}`;
const APP_SHELL_FILES = ['./', './index.html', './site.webmanifest'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            cache.addAll(APP_SHELL_FILES).catch(() => {
                // Ignore shell pre-cache failures and rely on runtime caching.
            })
        )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clonedResponse));
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match('./index.html');
                    return cached || Response.error();
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse));
                return networkResponse;
            });
        })
    );
});