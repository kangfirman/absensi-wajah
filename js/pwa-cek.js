// Diagnosis PWA: memeriksa syarat pemasangan, service worker, cache offline, model wajah, kamera, dan koneksi server.
// Fungsi nilaiManifest() murni (tanpa DOM) agar mudah diuji.
function nilaiManifest(m, urlManifest) {
  const out = [], add = (judul, status, detail, saran) => out.push({ judul, status, detail, saran: saran || '' });
  if (!m || typeof m !== 'object') { add('Manifest', 'fail', 'manifest.json tidak dapat dibaca.', 'Pastikan manifest.json ada di folder yang sama dengan absen.html dan sudah di-push.'); return out; }
  const nama = m.name || m.short_name;
  add('Nama aplikasi', nama ? 'ok' : 'fail', nama ? '"' + nama + '"' + (m.short_name ? ' (singkat: "' + m.short_name + '")' : '') : 'name/short_name kosong.', nama ? '' : 'Isi "name" di manifest.json.');
  if (m.short_name && m.short_name.length > 12) add('Nama singkat', 'warn', 'short_name ' + m.short_name.length + ' huruf; di layar utama bisa terpotong.', 'Pendekkan hingga 12 huruf.');
  let su = '', sc = '';
  try { su = new URL(m.start_url || '.', urlManifest).href; sc = new URL(m.scope || '.', urlManifest).href; } catch (e) {}
  add('Halaman awal (start_url)', su ? 'ok' : 'fail', su || 'tidak valid', su ? '' : 'Isi start_url, mis. "./absen.html".');
  if (su && sc) add('Cakupan (scope)', su.indexOf(sc) === 0 ? 'ok' : 'fail', 'scope ' + sc, su.indexOf(sc) === 0 ? '' : 'start_url harus berada di dalam scope.');
  const tamp = ['standalone', 'fullscreen', 'minimal-ui'];
  add('Mode tampilan', tamp.indexOf(m.display) > -1 ? 'ok' : 'fail', 'display = ' + (m.display || '(kosong)'), tamp.indexOf(m.display) > -1 ? '' : 'Gunakan "standalone".');
  const ik = Array.isArray(m.icons) ? m.icons : [];
  const ada = px => ik.some(i => /png|webp/.test(i.type || i.src || '') && String(i.sizes || '').split(/\s+/).some(z => { const n = parseInt(z, 10); return n >= px; }) && (!i.purpose || /any/.test(i.purpose)));
  add('Ikon 192px', ada(192) ? 'ok' : 'fail', ada(192) ? 'tersedia' : 'tidak ada ikon PNG ≥192px', ada(192) ? '' : 'Tambahkan icons/icon-192.png.');
  add('Ikon 512px', ada(512) ? 'ok' : 'fail', ada(512) ? 'tersedia' : 'tidak ada ikon PNG ≥512px', ada(512) ? '' : 'Tambahkan icons/icon-512.png.');
  const mask = ik.some(i => /maskable/.test(i.purpose || ''));
  add('Ikon maskable (Android)', mask ? 'ok' : 'warn', mask ? 'tersedia' : 'tidak ada', mask ? '' : 'Tanpa ini ikon bisa tampil di dalam kotak putih di sebagian HP Android.');
  add('Warna tema', m.theme_color ? 'ok' : 'warn', m.theme_color || '(kosong)', m.theme_color ? '' : 'Isi theme_color agar bilah atas senada.');
  return out;
}

(() => {
'use strict';
if (typeof document === 'undefined') return;
const $ = s => document.querySelector(s);
const ST = { ok: ['check_circle', 'Lulus'], warn: ['warning', 'Perhatian'], fail: ['error', 'Gagal'], info: ['info', 'Info'] };
let daftar = [], bip = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); bip = e; });

const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
const mb = n => (n / 1048576).toFixed(0) + ' MB';

function render() {
  const n = { ok: 0, warn: 0, fail: 0 }; daftar.forEach(d => { if (n[d.status] !== undefined) n[d.status]++; });
  $('#ringkas').innerHTML = `<b>${n.ok}</b> lulus • <b>${n.warn}</b> perhatian • <b>${n.fail}</b> gagal` + (n.fail ? ' — perbaiki yang berstatus Gagal lebih dulu.' : n.warn ? ' — tidak ada yang fatal.' : ' — semuanya siap.');
  $('#hasil').innerHTML = daftar.map(d => { const s = ST[d.status] || ST.info;
    return `<div class="cek"><span class="ms ic-${d.status}" aria-hidden="true">${s[0]}</span><div><b>${esc(d.judul)}</b> <span class="pill ${d.status === 'fail' ? 'err' : d.status === 'warn' ? 'warn' : d.status === 'ok' ? 'ok' : 'info'}">${s[1]}</span><p>${esc(d.detail)}</p>${d.saran ? `<p class="saran">Saran: ${esc(d.saran)}</p>` : ''}</div></div>`; }).join('');
}
const tambah = (judul, status, detail, saran) => { daftar.push({ judul, status, detail: detail || '', saran: saran || '' }); render(); };
const tambahSemua = arr => arr.forEach(x => tambah(x.judul, x.status, x.detail, x.saran));

async function periksa() {
  daftar = []; render();
  tambah('Koneksi aman (HTTPS)', window.isSecureContext ? 'ok' : 'fail', location.protocol + '//' + location.host, window.isSecureContext ? '' : 'Kamera dan pemasangan hanya bekerja lewat HTTPS. Buka lewat alamat https://…github.io/…');
  tambah('Internet', navigator.onLine ? 'ok' : 'warn', navigator.onLine ? 'tersambung' : 'tidak tersambung', navigator.onLine ? '' : 'Absen membutuhkan internet.');
  tambah('Mode tampilan saat ini', 'info', standalone() ? 'Aplikasi terpasang (layar penuh)' : 'Di dalam browser' + (ios ? ' (iPhone)' : ''), '');

  // Manifest
  let mf = null, mfUrl = new URL('manifest.json', location.href).href;
  try { const l = document.querySelector('link[rel=manifest]'); if (l) mfUrl = l.href; const r = await fetch(mfUrl, { cache: 'no-store' }); if (r.ok) mf = await r.json(); } catch (e) {}
  tambahSemua(nilaiManifest(mf, mfUrl));
  if (mf && Array.isArray(mf.icons)) {                       // ikon benar-benar bisa dimuat & ukurannya sesuai
    for (const i of mf.icons) {
      const u = new URL(i.src, mfUrl).href;
      const ok = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth + 'x' + im.naturalHeight); im.onerror = () => res(''); im.src = u; });
      tambah('Berkas ikon ' + i.src, ok ? (ok === String(i.sizes) ? 'ok' : 'warn') : 'fail', ok ? 'termuat, ukuran ' + ok + (ok === String(i.sizes) ? '' : ' (manifest menyebut ' + i.sizes + ')') : 'tidak dapat dimuat', ok ? (ok === String(i.sizes) ? '' : 'Samakan ukuran di manifest dengan berkasnya.') : 'Pastikan folder icons/ ikut di-push.');
    }
  }

  // Service worker
  if (!('serviceWorker' in navigator)) tambah('Service worker', 'fail', 'Browser tidak mendukung.', 'Gunakan Chrome / Safari versi terbaru.');
  else {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) tambah('Service worker', 'fail', 'Belum terdaftar.', 'Buka halaman absen.html sekali (dengan internet), tunggu beberapa detik, lalu periksa ulang.');
    else {
      tambah('Service worker', reg.active ? 'ok' : 'warn', (reg.active ? 'aktif' : 'belum aktif') + ', cakupan ' + reg.scope, reg.active ? '' : 'Tunggu beberapa detik lalu periksa ulang.');
      tambah('Mengontrol halaman ini', navigator.serviceWorker.controller ? 'ok' : 'warn', navigator.serviceWorker.controller ? 'ya' : 'belum (normal tepat setelah pemasangan pertama)', navigator.serviceWorker.controller ? '' : 'Muat ulang halaman sekali.');
      if (reg.waiting) tambah('Versi baru', 'warn', 'Versi baru menunggu diaktifkan.', 'Buka absen.html lalu ketuk "Perbarui", atau tutup dan buka aplikasi dua kali.');
    }
  }

  // Cache offline & model
  if (!('caches' in window)) tambah('Penyimpanan cache', 'fail', 'Browser tidak mendukung Cache Storage.', 'Perbarui browser. Mode privat/incognito juga dapat menonaktifkannya.');
  else {
    try {
      const ks = await caches.keys(), shell = ks.filter(k => k.indexOf('absen-shell-') === 0).sort().pop();
      if (!shell) tambah('Cangkang aplikasi (offline)', 'warn', 'Belum tersimpan.', 'Buka absen.html dengan internet sekali.');
      else {
        const u = (await (await caches.open(shell)).keys()).map(r => r.url);
        const wajib = ['absen.html', 'js/absen.js', 'js/api.js', 'js/face.js', 'css/style.css', 'manifest.json', 'offline.html'], hilang = wajib.filter(w => !u.some(x => x.indexOf('/' + w) > -1));
        tambah('Cangkang aplikasi (offline)', hilang.length ? 'warn' : 'ok', hilang.length ? 'belum lengkap, kurang: ' + hilang.join(', ') : 'lengkap (' + u.length + ' berkas, ' + shell + ')', hilang.length ? 'Buka absen.html dengan internet, lalu periksa ulang.' : '');
      }
      const mk = ks.find(k => k.indexOf('absensi-model-') === 0);
      if (!mk) tambah('Model pengenalan wajah', 'warn', 'Belum tersimpan di HP.', 'Buka absen.html lewat Wi-Fi sekali; model (±12 MB) akan tersimpan untuk hari berikutnya.');
      else { const n = (await (await caches.open(mk)).keys()).length; tambah('Model pengenalan wajah', n >= 9 ? 'ok' : 'warn', n + ' berkas tersimpan' + (n >= 9 ? ' (lengkap)' : ' (belum lengkap, perlu ≥9)'), n >= 9 ? '' : 'Buka absen.html dengan internet yang stabil sampai kamera menyala.'); }
    } catch (e) { tambah('Penyimpanan cache', 'warn', 'Tidak dapat diperiksa: ' + e.message, ''); }
  }
  try {
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(), p = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      tambah('Ruang penyimpanan', e.quota && e.usage / e.quota > 0.9 ? 'warn' : 'ok', 'terpakai ' + mb(e.usage) + ' dari ' + mb(e.quota) + (p === null ? '' : p ? ' • dilindungi dari penghapusan otomatis' : ' • belum dilindungi'), p === false ? 'Memasang aplikasi ke layar utama biasanya membuat penyimpanan lebih awet.' : ''); }
  } catch (e) {}

  // Kamera & perangkat
  tambah('Kamera', navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'ok' : 'fail', navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'didukung' : 'tidak didukung', 'Gunakan Chrome/Safari terbaru lewat HTTPS.');
  try { if (navigator.permissions && navigator.permissions.query) { const p = await navigator.permissions.query({ name: 'camera' }); tambah('Izin kamera', p.state === 'granted' ? 'ok' : p.state === 'denied' ? 'fail' : 'info', 'status: ' + ({ granted: 'diizinkan', denied: 'DITOLAK', prompt: 'akan ditanyakan saat dibuka' })[p.state], p.state === 'denied' ? 'Buka pengaturan browser/aplikasi → Izin → Kamera → Izinkan.' : ''); }
    else tambah('Izin kamera', 'info', 'tidak dapat diperiksa di browser ini' + (ios ? ' (iPhone akan menanyakan izin tiap aplikasi dibuka — itu perilaku iOS)' : ''), ''); } catch (e) { tambah('Izin kamera', 'info', 'tidak dapat diperiksa', ''); }
  let gl = false; try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) {}
  tambah('Akselerasi grafis (WebGL)', gl ? 'ok' : 'warn', gl ? 'tersedia' : 'tidak tersedia — pengenalan wajah akan lambat', gl ? '' : 'Aktifkan akselerasi perangkat keras di browser atau coba browser lain.');
  tambah('Jaga layar & getar', 'info', ('wakeLock' in navigator ? 'layar dijaga menyala: ya' : 'layar dijaga menyala: tidak didukung') + ' • ' + (navigator.vibrate ? 'getar: ya' : 'getar: tidak didukung (normal di iPhone)'), '');
  if (navigator.deviceMemory || navigator.hardwareConcurrency) tambah('Perangkat', 'info', (navigator.deviceMemory ? 'RAM ±' + navigator.deviceMemory + ' GB • ' : '') + (navigator.hardwareConcurrency || '?') + ' inti CPU', '');

  // Kode & server
  let kode = ''; try { kode = localStorage.getItem('absen_kode') || ''; } catch (e) {}
  tambah('Kode absen tersimpan', kode ? 'ok' : 'warn', kode ? kode.slice(0, 2) + '••••••' : 'belum ada', kode ? '' : 'Buka link absen dari guru sekali (atau tempel kodenya di halaman absen).');
  const pc = pesanConfig();
  if (pc) tambah('Konfigurasi Supabase', 'fail', pc, 'Isi js/config.js lalu push.');
  else {
    const r = await api('mandiri.status', { k: kode || 'PERIKSA00' });
    if (r.success) tambah('Server (Supabase)', 'ok', 'tersambung' + (r.data.buka ? ' • absen mandiri sedang dibuka' : ' • absen mandiri sedang tutup/kode tidak cocok'), '');
    else tambah('Server (Supabase)', 'fail', r.message || 'gagal', 'Periksa internet, SUPABASE_URL, dan pastikan SETUP_SUPABASE.sql sudah dijalankan.');
  }

  // Tawaran pemasangan
  await new Promise(r => setTimeout(r, 1200));
  if (standalone()) tambah('Pemasangan', 'ok', 'Aplikasi sudah terpasang dan dibuka dari layar utama.', '');
  else if (bip) tambah('Pemasangan', 'ok', 'Browser siap memasang aplikasi (menu ⋮ → Pasang aplikasi / tombol Pasang di halaman absen).', '');
  else tambah('Pemasangan', ios ? 'info' : 'warn', ios ? 'iPhone: pasang lewat Bagikan → Tambahkan ke Layar Utama (harus Safari).' : 'Browser belum menawarkan pemasangan.', ios ? '' : 'Pastikan memakai Chrome (bukan browser di dalam aplikasi chat), semua pemeriksaan di atas Lulus, atau sudah terpasang. Coba muat ulang lalu periksa ulang.');
}

function laporan() {
  const baris = daftar.map(d => '[' + (ST[d.status] ? ST[d.status][1].toUpperCase() : d.status) + '] ' + d.judul + ' — ' + d.detail + (d.saran ? ' | Saran: ' + d.saran : ''));
  return ['Laporan Periksa Aplikasi Absen', new Date().toLocaleString('id-ID'), location.href, navigator.userAgent, ''].concat(baris).join('\n');
}
$('#ulang').onclick = periksa;
$('#salin').onclick = async () => { try { await navigator.clipboard.writeText(laporan()); toast('Laporan disalin. Tempel ke pesan untuk pengelola.'); } catch (e) { prompt('Salin laporan ini:', laporan()); } };
$('#reset').onclick = async () => {
  if (!confirm('Hapus cache aplikasi dan model? Aplikasi akan mengunduh ulang (±12 MB) saat dibuka berikutnya.')) return;
  try { const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : []; await Promise.all(regs.map(r => r.unregister())); } catch (e) {}
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => /^(absen-|absensi-model-)/.test(k)).map(k => caches.delete(k))); } catch (e) {}
  toast('Cache dihapus. Memuat ulang…'); setTimeout(() => location.reload(), 700);
};
periksa();
})();
