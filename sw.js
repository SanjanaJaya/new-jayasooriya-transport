const CACHE_NAME = 'jt-driver-cache-v10';
const STATIC_ASSETS = [
    '/driver.html',
    '/driver-styles.css',
    '/driver.js',
    '/driver-manifest.json',
    'https://i.postimg.cc/15hFLyyD/New-Logo-White-BG.png',
    'https://i.postimg.cc/QdvbXY1c/id-AYs-TFstv.png',
    'https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap'
];

// Install Service Worker and cache core static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Caching shell assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch events: Network First falling back to Cache (for app code/manifest)
// Cache First for external assets (Leaflet, images, fonts)
self.addEventListener('fetch', event => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Is it an external CDN library or static image? Use Cache First.
    const isStaticCdnOrImage = 
        requestUrl.hostname.includes('cdn.jsdelivr.net') || 
        requestUrl.hostname.includes('fonts.googleapis.com') ||
        requestUrl.hostname.includes('fonts.gstatic.com') ||
        requestUrl.hostname.includes('postimg.cc') ||
        event.request.url.match(/\.(png|jpg|jpeg|gif|svg|ico)$/i);

    // Is it a same-origin resource (like our HTML, JS, CSS, manifest)?
    const isSameOrigin = requestUrl.origin === self.location.origin;

    if (isStaticCdnOrImage) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(() => {
                    // Fail silently or handle offline image fallback
                });
            })
        );
    } else if (isSameOrigin) {
        // App HTML/JS/CSS: Network First, falling back to cache
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                // Check if valid response
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
    }
    // Any other request (like Supabase API database queries) is not intercepted
});

