// MEB SERVICE WORKER SELF-DESTRUCT & CACHE PURGE
// Tự động xóa sạch toàn bộ cache và unregister để tránh lỗi màn hình trắng (White Screen of Death)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      return self.registration.unregister();
    })
  );
});

// Cho phép tất cả request đi trực tiếp tới network
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
