/**
 * Service Worker - PWA Offline Support
 * Production-Grade Caching Strategy
 */

const CACHE_NAME = 'zpopcorn-v2.0.0';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, then network
  CACHE_FIRST: [
    /\/assets\//,
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/
  ],
  // Network first, then cache
  NETWORK_FIRST: [
    /api\.themoviedb\.org/,
    /\/api\//
  ],
  // Stale while revalidate
  STALE_WHILE_REVALIDATE: [
    /image\.tmdb\.org/
  ]
};

self.addEventListener('install', (event) => {
  console.log('📦 SW: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 SW: Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('📦 SW: Installed');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('📦 SW: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log(`📦 SW: Deleting old cache ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('📦 SW: Activated');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome extensions and other schemes
  if (!url.protocol.startsWith('http')) return;

  // Determine strategy
  let strategy = 'NETWORK_FIRST'; // Default

  for (const [strategyName, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => pattern.test(url.pathname) || pattern.test(url.href))) {
      strategy = strategyName;
      break;
    }
  }

  switch (strategy) {
    case 'CACHE_FIRST':
      event.respondWith(cacheFirst(request));
      break;
    case 'STALE_WHILE_REVALIDATE':
      event.respondWith(staleWhileRevalidate(request));
      break;
    case 'NETWORK_FIRST':
    default:
      event.respondWith(networkFirst(request));
      break;
  }
});

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      // Check if expired
      const cachedTime = cached.headers.get('sw-cached-at');
      if (cachedTime) {
        const age = Date.now() - parseInt(cachedTime);
        if (age < CACHE_TTL) {
          return cached;
        }
      } else {
        return cached;
      }
    }

    const response = await fetch(request);
    
    if (response.ok) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      
      cache.put(request, cachedResponse);
    }

    return response;
  } catch (error) {
    console.warn('SW cacheFirst failed:', error);
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Don't cache TMDB API responses in SW (handled by app cache)
      if (!request.url.includes('themoviedb.org')) {
        const cache = await caches.open(CACHE_NAME);
        const responseToCache = response.clone();
        cache.put(request, responseToCache);
      }
    }

    return response;
  } catch (error) {
    console.warn('SW networkFirst failed, trying cache:', error);
    
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      // Add offline header
      const headers = new Headers(cached.headers);
      headers.set('x-sw-offline', 'true');
      
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = new Response(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>غير متصل - zPopcorn</title>
          <style>
            body { 
              font-family: system-ui; 
              background: #0a0a0f; 
              color: white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              text-align: center;
            }
            .offline { padding: 40px; }
            .offline-icon { font-size: 64px; margin-bottom: 16px; }
            .offline-title { font-size: 1.5rem; margin-bottom: 8px; }
            .offline-desc { opacity: 0.7; margin-bottom: 24px; }
            .btn { 
              background: #8b5cf6; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 8px; 
              cursor: pointer;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="offline">
            <div class="offline-icon">📡</div>
            <h1 class="offline-title">غير متصل بالإنترنت</h1>
            <p class="offline-desc">أنت في وضع عدم الاتصال. بعض الميزات قد لا تكون متاحة.<br>البيانات المحلية لا تزال متاحة.</p>
            <button class="btn" onclick="window.location.reload()">إعادة المحاولة</button>
          </div>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
      return offlineResponse;
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Background sync for analytics
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

async function syncAnalytics() {
  console.log('📦 SW: Syncing analytics...');
  // Implementation would sync local analytics when online
}

// Push notifications (for future)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.message || data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      dir: 'rtl',
      lang: 'ar',
      data: data
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'zPopcorn', options)
    );
  } catch (e) {
    console.warn('Push handling failed:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  if (data && data.action) {
    url = data.action;
  } else if (data && data.entityType && data.entityId) {
    url = `/${data.entityType}/${data.entityId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
        .then(() => console.log('📦 SW: Cache cleared'))
    );
  }
});

console.log('📦 SW: Loaded v2.0.0');
