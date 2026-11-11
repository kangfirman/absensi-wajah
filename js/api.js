// Helper umum: koneksi Supabase, sesi login, panggilan API (RPC), escape HTML, toast, pemuat skrip CDN.
// Kontrak API tetap sama seperti versi Apps Script: api('aksi.nama', data) -> { success, data, message, code }.
// "aksi.nama" dipetakan ke fungsi database api_aksi_nama(p jsonb).
const SB_URL_OK = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

function jwtRole(k) {
  try { const p = k.split('.'); if (p.length !== 3) return ''; return (JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))).role) || ''; } catch (e) { return ''; }
}
function pesanConfig() {
  const c = window.APP_CONFIG || {}, u = String(c.SUPABASE_URL || '').trim(), k = String(c.SUPABASE_ANON_KEY || '').trim();
  if (!u || !k || /GANTI|XXXX/.test(u + k)) return 'Konfigurasi belum lengkap: isi SUPABASE_URL dan SUPABASE_ANON_KEY di js/config.js lalu push ulang.';
  if (!SB_URL_OK.test(u)) return 'SUPABASE_URL tidak valid. Contoh: https://abcdxyz.supabase.co (tanpa /rest/v1 dan tanpa path lain).';
  if (/^sb_secret_/i.test(k) || jwtRole(k) === 'service_role') return 'BAHAYA: itu kunci RAHASIA (service_role/secret). Pakai kunci "anon"/"publishable" saja di frontend, dan segera buat ulang kunci rahasia tersebut.';
  return '';
}
function configOk() { return pesanConfig() === ''; }

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (pesanConfig() || !window.supabase || !window.supabase.createClient) return null;
  const c = window.APP_CONFIG;
  _sb = window.supabase.createClient(c.SUPABASE_URL.trim().replace(/\/+$/, ''), c.SUPABASE_ANON_KEY.trim(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'absensi-auth' }
  });
  return _sb;
}

// Sesi login admin (Supabase Auth)
const Sesi = {
  _s: null, _h: false,
  async init() {
    const c = sb(); if (!c) return null;
    const r = await c.auth.getSession(); this._s = r.data ? r.data.session : null;
    if (!this._h) { this._h = true; c.auth.onAuthStateChange((ev, s) => { this._s = s; }); }
    return this._s;
  },
  get() { return this._s; },
  async keluar(semua) { const c = sb(); try { if (c) await c.auth.signOut(semua ? { scope: 'global' } : undefined); } catch (e) {} this._s = null; }
};

function pesanError(e, fn) {
  const m = String(e.message || ''), c = String(e.code || '');
  if (c === 'PGRST202' || /Could not find the function|schema cache/i.test(m)) return 'Fungsi ' + fn + ' belum ada di database. Jalankan SETUP_SUPABASE.sql di SQL Editor Supabase.';
  if (c === '42501' || /permission denied/i.test(m)) return 'Akses ditolak oleh database. Jalankan ulang SETUP_SUPABASE.sql.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak dapat terhubung ke Supabase. Periksa internet dan SUPABASE_URL. Jika project gratis sempat dijeda, buka dashboard Supabase lalu klik Restore project.';
  return 'Kesalahan database: ' + m.slice(0, 200);
}

async function api(action, data) {
  const pc = pesanConfig();
  if (pc) return { success: false, message: pc };
  const c = sb();
  if (!c) return { success: false, message: 'Pustaka Supabase gagal dimuat. Periksa internet lalu muat ulang halaman.' };
  const fn = 'api_' + String(action).replace(/\./g, '_').toLowerCase();
  try {
    const r = await c.rpc(fn, { p: data || {} });
    if (r.error) {
      if (/JWT/i.test(String(r.error.message || ''))) { Sesi._s = null; document.dispatchEvent(new Event('sesi-habis')); return { success: false, code: 'AUTH', message: 'Sesi berakhir. Silakan masuk lagi.' }; }
      return { success: false, message: pesanError(r.error, fn) };
    }
    const res = r.data;
    if (res && res.code === 'AUTH') { Sesi._s = null; document.dispatchEvent(new Event('sesi-habis')); }
    return res || { success: false, message: 'Balasan kosong dari server.' };
  } catch (e) {
    return { success: false, message: 'Tidak dapat terhubung ke Supabase. Periksa internet.' };
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
