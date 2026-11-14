/* Service worker Absen Mandiri (PWA)
 * - Cangkang aplikasi: jaringan dulu (maks 2,5 dtk) lalu cache -> selalu segar, tetap terbuka saat sinyal jelek/offline
 * - Ikon & manifest: cache dulu
 * - pustaka supabase-js & font: tampilkan cache, perbarui di latar belakang
 * - Tidak menyentuh: panggilan Supabase (API/login) dan model wajah (sudah di-cache oleh js/face.js)
 * Naikkan VERSI setiap kali berkas aplikasi berubah agar HP siswa memperbarui cache. */
const VERSI = 'v1.1.0';
const SHELL = 'absen-shell-' + VERSI, RUNTIME = 'absen-rt-' + VERSI;
const PRE = ['./absen.html', './css/style.css', './js/config.js', './js/api.js', './js/face.js', './js/absen.js', './js/pwa.js',
             './manifest.json', './offline.html', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const CDN_PRE = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SHELL);
  await Promise.all(PRE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  const r = await caches.open(RUNTIME);
  await Promise.all(CDN_PRE.map(u => r.add(new Request(u, { mode: 'cors' })).catch(() => {})));
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  const ks = await caches.keys();
  await Promise.all(ks.filter(k => k.indexOf('absen-') === 0 && k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// Kunci cache tanpa query (?k=KODE tidak boleh tersimpan di kunci cache)
const kunci = req => { const u = new URL(req.url); return u.origin + u.pathname; };

async function cacheFirst(req, nama) {
  const c = await caches.open(nama), hit = await c.match(kunci(req));
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) c.put(kunci(req), r.clone());
  return r;
}
async function networkFirst(req, nama, batas) {
  const c = await caches.open(nama);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('lambat')), batas))]);
    if (r && r.ok) c.put(kunci(req), r.clone());
    return r;
  } catch (e) {
    const hit = await c.match(kunci(req));
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const a = await c.match(new URL('./absen.html', self.registration.scope).href); if (a) return a;
      const o = await c.match(new URL('./offline.html', self.registration.scope).href); if (o) return o;
    }
    return Response.error();
  }
}
async function staleWhileRevalidate(req, nama) {
  const c = await caches.open(nama), hit = await c.match(req);
  const jar = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await jar) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (/\/(icons\/|manifest\.json$)/.test(u.pathname)) return e.respondWith(cacheFirst(req, SHELL));
    if (req.mode === 'navigate' || /\.(html|js|css)$/.test(u.pathname)) return e.respondWith(networkFirst(req, SHELL, 2500));
    return;
  }
  if (u.href.indexOf('https://cdn.jsdelivr.net/npm/@supabase/') === 0 || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    return e.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
});
