const appVersion = new URL(self.location.href).searchParams.get('v') || 'dev';
const cachePrefix = new URL(self.location.href).searchParams.get('cp') || 'app-cache';
const CACHE_NAME = `${cachePrefix}-${appVersion}`;
const APP_SHELL_FILES = ['./', './index.html', './offline.html', './site.webmanifest'];

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
        return;
    }

    if (event.data?.type === 'SHOW_NOTIFICATION') {
        const payload = event.data?.payload || {};
        const title = String(payload.title || 'New message');
        const options = {
            body: String(payload.body || ''),
            icon: payload.icon,
            badge: payload.badge,
            tag: payload.tag,
            renotify: Boolean(payload.renotify),
            data: payload.data || {}
        };

        event.waitUntil(self.registration.showNotification(title, options));
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = String(event.notification?.data?.url || './');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            const existing = windowClients.find((client) => client.url.includes(self.location.origin));

            if (existing) {
                return existing.focus().then(() => existing.navigate(targetUrl));
            }

            return clients.openWindow(targetUrl);
        })
    );
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
                    const cachedPage = await caches.match('./index.html');
                    if (cachedPage) {
                        return cachedPage;
                    }

                    const offlinePage = await caches.match('./offline.html');
                    return offlinePage || Response.error();
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

self.addEventListener('sync', (event) => {
    if (event.tag !== 'beyondstrings-sync') {
        return;
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            clientList.forEach((client) => {
                client.postMessage({ type: 'SYNC_RETRY_OFFLINE_QUEUE' });
            });
        })
    );
});

self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { notification: { title: 'BeyondStrings', body: event.data?.text() || 'New message' } };
    }

    const title = String(payload?.notification?.title || payload?.title || 'BeyondStrings');
    const options = {
        body: String(payload?.notification?.body || payload?.body || 'You have a new message.'),
        icon: payload?.notification?.icon || payload?.icon,
        badge: payload?.notification?.badge || payload?.badge,
        tag: payload?.notification?.tag || payload?.tag || 'beyondstrings-push',
        data: payload?.data || { url: './' }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});
