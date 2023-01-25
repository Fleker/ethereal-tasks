console.debug('Service worker init...')
self.addEventListener('fetch', (e) => {
  console.debug(`[Service Worker] Fetched resource ${e.request.url}`);
});