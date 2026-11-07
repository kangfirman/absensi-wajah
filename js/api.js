// Helper umum: sesi, panggilan API, escape HTML, toast, pemuat skrip CDN
const Sesi = {
  get() { try { const s = JSON.parse(localStorage.getItem('absensi_sesi') || 'null'); if (s && s.exp > Date.now()) return s; } catch (e) {} return null; },
  set(s) { try { localStorage.setItem('absensi_sesi', JSON.stringify(s)); } catch (e) {} },
  clear() { try { localStorage.removeItem('absensi_sesi'); } catch (e) {} }
};

function configOk() { const u = (window.APP_CONFIG || {}).GAS_URL || ''; return !!u && !/GANTI|XXXX/.test(u); }

async function api(action, data) {
  if (!configOk()) return { success: false, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js lalu push ulang.' };
  const s = Sesi.get();
  try {
    const res = await fetch(window.APP_CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // wajib text/plain agar tidak kena preflight CORS
      body: JSON.stringify({ action: action, token: s ? s.token : undefined, data: data || {} })
    });
    const j = await res.json();
    if (j.code === 'AUTH') { Sesi.clear(); document.dispatchEvent(new Event('sesi-habis')); }
    return j;
  } catch (e) {
    return { success: false, message: 'Tidak dapat terhubung ke server. Periksa internet dan URL GAS di config.js.' };
  }
}

function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function toast(msg, tipe) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (tipe || 'ok');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 3800);
}

const _skrip = {};
function muatSkrip(url) {
  if (!_skrip[url]) _skrip[url] = new Promise(function (ok, gagal) {
    const s = document.createElement('script');
    s.src = url; s.onload = ok; s.onerror = function () { delete _skrip[url]; gagal(new Error('Gagal memuat ' + url)); };
    document.head.appendChild(s);
  });
  return _skrip[url];
}
