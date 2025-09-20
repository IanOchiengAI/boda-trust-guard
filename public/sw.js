const CACHE_NAME = 'boda-box-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/manifest.json',
  '/offline.html',
  // Cache critical assets for offline functionality
  '/placeholder.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).catch(() => {
          // If network fails and it's a navigation request, show offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      }
    )
  );
});

// Background sync for queued data
self.addEventListener('sync', (event) => {
  if (event.tag === 'emergency-data') {
    event.waitUntil(syncEmergencyData());
  }
});

async function syncEmergencyData() {
  try {
    // Sync any queued emergency data when back online
    const queuedData = await getQueuedData();
    if (queuedData.length > 0) {
      console.log('Syncing queued emergency data:', queuedData.length, 'items');
      // Process queued data
    }
  } catch (error) {
    console.error('Failed to sync emergency data:', error);
  }
}

async function getQueuedData() {
  // Get queued data from IndexedDB or localStorage
  return [];
}