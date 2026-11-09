// Tambahkan baris ini di dalam file sw.js Anda:
self.addEventListener('message', event => {
  if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});