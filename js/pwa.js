// PWA: pendaftaran service worker, tombol "Pasang", petunjuk iPhone, dan pemberitahuan versi baru.
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const standalone = () =>
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const kartu = $('#pasang');
  let tunda = null;

  function tutupLama() {
    try {
      return Date.now() - Number(localStorage.getItem('pasang_tutup') || 0) < 7 * 864e5;
    } catch (e) {
      return false;
    }
  }

  function tampilKartu() {
    if (kartu && !standalone() && !tutupLama()) {
      kartu.classList.remove('hide');
    }
  }

  // Handle Event Prompt Pasang (Android / Desktop Chrome / Edge)
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    tunda = e;
    const b = $('#pasang-btn');
    if (b) b.classList.remove('hide');
    tampilKartu();
  });

  window.addEventListener('appinstalled', () => {
    tunda = null;
    if (kartu) kartu.classList.add('hide');
    if (window.toast) toast('Aplikasi Absen sudah terpasang di HP Anda.');
  });

  // Petunjuk khusus iOS
  if (ios && !standalone()) {
    const i = $('#pasang-ios');
    if (i) i.classList.remove('hide');
    tampilKartu();
  }

  // Tombol Pasang
  const bp = $('#pasang-btn');
  if (bp) {
    bp.onclick = async () => {
      if (!tunda) return;
      tunda.prompt();
      try {
        await tunda.userChoice;
      } catch (e) {}
      tunda = null;
      if (kartu) kartu.classList.add('hide');
    };
  }

  // Tombol Tutup Banner Pasang
  const bt = $('#pasang-tutup');
  if (bt) {
    bt.onclick = () => {
      if (kartu) kartu.classList.add('hide');
      try {
        localStorage.setItem('pasang_tutup', String(Date.now()));
      } catch (e) {}
    };
  }

  // Register & Handle Service Worker Update
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    const tawarkan = reg => {
      const b = $('#update');
      const btn = $('#update-btn');
      if (!b || !btn || !reg.waiting) return;

      b.classList.remove('hide');
      btn.onclick = () => {
        btn.disabled = true;
        // Mengirim pesan ke Service Worker yang sedang menunggu
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      };
    };

    window.addEventListener('load', () => {
      // Gunakan '/sw.js' agar scope mencakup seluruh root domain Vercel Anda
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // Cek jika ada versi baru yang menggantung
        if (reg.waiting && navigator.serviceWorker.controller) {
          tawarkan(reg);
        }

        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              tawarkan(reg);
            }
          });
        });
      }).catch(err => {
        console.error('Gagal mendaftarkan Service Worker:', err);
      });
    });

    // Auto-reload saat Service Worker baru mengambil alih (controllerchange)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
})();