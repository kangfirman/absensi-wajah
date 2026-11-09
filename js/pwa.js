// PWA: pendaftaran service worker, tombol "Pasang", petunjuk iPhone, dan pemberitahuan versi baru.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const kartu = $('#pasang');
let tunda = null;

function tutupLama() { try { return Date.now() - Number(localStorage.getItem('pasang_tutup') || 0) < 7 * 864e5; } catch (e) { return false; } }
function tampilKartu() { if (kartu && !standalone() && !tutupLama()) kartu.classList.remove('hide'); }

window.addEventListener('beforeinstallprompt', e => {            // Android / Chrome / Edge
  e.preventDefault(); tunda = e;
  const b = $('#pasang-btn'); if (b) b.classList.remove('hide');
  tampilKartu();
});
window.addEventListener('appinstalled', () => { tunda = null; if (kartu) kartu.classList.add('hide'); if (window.toast) toast('Aplikasi Absen sudah terpasang di HP Anda.'); });
if (ios && !standalone()) { const i = $('#pasang-ios'); if (i) i.classList.remove('hide'); tampilKartu(); }  // iPhone: tidak ada tombol pasang otomatis

const bp = $('#pasang-btn');
if (bp) bp.onclick = async () => { if (!tunda) return; tunda.prompt(); try { await tunda.userChoice; } catch (e) {} tunda = null; kartu.classList.add('hide'); };
const bt = $('#pasang-tutup');
if (bt) bt.onclick = () => { kartu.classList.add('hide'); try { localStorage.setItem('pasang_tutup', String(Date.now())); } catch (e) {} };

// Service worker + pembaruan
if ('serviceWorker' in navigator) {
  const sudahDikontrol = !!navigator.serviceWorker.controller; let muatUlang = false;
  const tawarkan = reg => {
    const b = $('#update'); if (!b || !reg.waiting) return;
    b.classList.remove('hide');
    $('#update-btn').onclick = () => { $('#update-btn').disabled = true; reg.waiting.postMessage('SKIP_WAITING'); };
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      if (reg.waiting && navigator.serviceWorker.controller) tawarkan(reg);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) tawarkan(reg); });
      });
    }).catch(() => {});
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!sudahDikontrol || muatUlang) return; muatUlang = true; location.reload(); });
}
})();
