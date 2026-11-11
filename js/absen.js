(() => {
'use strict';
const $ = s => document.querySelector(s);
const KUNCI = 'absen_kode';
const CARI = { t: 'Mencari wajah…', s: 'cari' };
const S = { jalan: false, gambar: false, kirim: false, stabil: 0, gagal: 0, id: 0, trk: { target: null, cur: null }, lbl: CARI };

// Kode absen: dari link (?k=), dari tempelan siswa, atau tersimpan di HP (agar aplikasi terpasang langsung jalan)
function ambilKode(teks) {
  let k = String(teks || '').trim();
  const m = k.match(/[?&]k=([A-Za-z0-9]+)/); if (m) k = m[1];
  k = k.toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(k) ? k : '';
}
function bacaKode() {
  const dariUrl = ambilKode(new URLSearchParams(location.search).get('k'));
  if (dariUrl) { try { localStorage.setItem(KUNCI, dariUrl); } catch (e) {} return dariUrl; }
  try { return ambilKode(localStorage.getItem(KUNCI)); } catch (e) { return ''; }
}
let K = bacaKode();

const setSt = t => { $('#vst').textContent = t; };
const tampil = id => ['kam', 'tutup', 'selesai'].forEach(x => $('#' + x).classList.toggle('hide', x !== id));
function progres(f) { const b = $('#progi'); if (b) b.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }
function tutup(pesan, mintaKode) {
  S.jalan = false; S.gambar = false; lepasLayar();
  $('#tmsg').textContent = pesan; $('#kodeform').classList.toggle('hide', !mintaKode); tampil('tutup');
}
$('#kodeform').onsubmit = e => {
  e.preventDefault();
  const k = ambilKode($('#kodein').value);
  if (!k) { $('#kodeerr').textContent = 'Kode tidak dikenali. Tempel link lengkap dari guru, atau ketik kodenya (6–12 huruf/angka).'; return; }
  try { localStorage.setItem(KUNCI, k); } catch (x) {}
  location.href = location.pathname + '?k=' + k;
};

setInterval(() => { $('#jam').textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); }, 1000);

// Jaga layar tetap menyala selama memindai
let wl = null;
async function jagaLayar() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { wl = null; } }
function lepasLayar() { try { if (wl) wl.release(); } catch (e) {} wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.jalan) jagaLayar(); });
const getar = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

window.addEventListener('offline', () => { if (S.jalan) { S.stabil = 0; setSt('Tidak ada internet — absen dijeda sampai tersambung lagi'); } });
window.addEventListener('online', () => { if (S.jalan) setSt('Hadapkan wajah ke kamera'); });

function infoMuat(t) {
  setSt(t); const m = String(t).match(/(\d+)\/(\d+)/);
  if (m) progres(Number(m[1]) / Number(m[2]) * 0.9); else if (/Pemanasan/.test(t)) progres(0.95);
}

async function mulai() {
  if (!configOk()) return tutup(pesanConfig());
  if (!K) return tutup('Masukkan kode absen dari guru. Tempel link atau ketik kodenya di bawah.', true);
  tampil('kam'); setSt('Meminta izin kamera…'); jagaLayar();
  const pKam = Wajah.kamera($('#cam')).then(() => null, e => e);          // kamera langsung diminta/dibuka
  const pMuat = Wajah.muat(infoMuat).then(() => null, e => e);             // model dibaca dari cache HP (atau diunduh sekali) — paralel
  const st = await api('mandiri.status', { k: K });                        // sambil memeriksa apakah absen dibuka
  if (!st.success || !st.data.buka) {
    const p = st.success ? st.data.pesan : st.message;
    tutup(p, /tidak valid|diganti/i.test(p)); pKam.then(() => Wajah.henti($('#cam'))); return;
  }
  $('#sek').textContent = st.data.namaSekolah || 'Absen Wajah Siswa';
  const eK = await pKam;
  if (eK) return tutup(eK.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera untuk aplikasi ini di pengaturan HP/browser, lalu buka lagi.' : (eK.message || 'Kamera tidak dapat dibuka.'));
  const eM = await pMuat;
  if (eM) return tutup('Gagal memuat model pengenalan wajah. Periksa internet lalu buka lagi.');
  progres(1); setTimeout(() => { const p = $('#prog'); if (p) p.classList.add('hide'); }, 400);
  pindai();
}

function pindai() {
  S.jalan = true; S.gambar = true; S.kirim = false; S.stabil = 0; S.gagal = 0; S.lbl = CARI; S.trk = { target: null, cur: null }; S.id++;
  $('#ban').classList.remove('show'); setSt('Hadapkan wajah ke kamera'); jagaLayar();
  trkLoop(); loop(S.id);
}

// Dua tahap: (1) detektor cepat melacak kotak & memastikan wajah stabil, (2) vektor wajah lengkap diambil SEKALI lalu dikirim
async function loop(id) {
  if (!S.jalan || id !== S.id) return;
  if (!S.kirim && document.visibilityState === 'visible' && navigator.onLine !== false) {
    try { await (Wajah.cepatSiap ? langkahCepat(id) : langkahLengkap(id)); } catch (e) { console.error(e.message); }
  }
  setTimeout(() => loop(id), Wajah.cepatSiap ? 30 : 150);
}
async function langkahCepat(id) {
  const r = await Wajah.cepat($('#cam'));
  if (!S.jalan || id !== S.id) return;
  if (!r) { S.stabil = 0; S.trk.target = null; setSt('Hadapkan wajah ke kamera'); return; }
  S.trk.target = { box: r.box, t: Date.now() };
  if (r.lebar < 0.25) { S.stabil = 0; setSt('Dekatkan wajah ke kamera'); return; }
  if (r.skor < 0.6) { S.stabil = 0; setSt('Wajah kurang jelas — cari tempat lebih terang'); return; }
  S.stabil++; S.lbl = { t: 'Memindai…', s: 'kenal' }; setSt('Tahan sebentar, sedang memindai…');
  if (S.stabil < 4) return;
  const f = await Wajah.deteksi($('#cam'));                               // SSD + landmark + vektor (sama persis dengan saat pendaftaran)
  if (!S.jalan || id !== S.id) return;
  if (f && f.skor >= 0.8 && f.lebar >= 0.25) kirim(f.desc); else S.stabil = 0;
}
async function langkahLengkap(id) {                                       // cadangan bila detektor cepat gagal dimuat
  const r = await Wajah.deteksi($('#cam'));
  if (!S.jalan || id !== S.id) return;
  if (!r) { S.stabil = 0; S.trk.target = null; setSt('Hadapkan wajah ke kamera'); return; }
  S.trk.target = { box: r.box, t: Date.now() };
  if (r.lebar < 0.25) { S.stabil = 0; setSt('Dekatkan wajah ke kamera'); }
  else if (r.skor < 0.8) { S.stabil = 0; setSt('Wajah kurang jelas — cari tempat lebih terang'); }
  else { S.stabil++; S.lbl = { t: 'Memindai…', s: 'kenal' }; setSt('Tahan sebentar, sedang memindai…'); if (S.stabil >= 2) kirim(r.desc); }
}

async function kirim(desc) {
  S.kirim = true; setSt('Memeriksa wajah…'); S.lbl = { t: 'Memeriksa…', s: 'kenal' };
  const r = await api('mandiri.absen', { k: K, descriptor: desc });
  if (!S.jalan) return;
  if (r.success) return berhasil(r.data);
  if (r.code === 'TUTUP') { Wajah.henti($('#cam')); return tutup(r.message, /tidak valid|diganti/i.test(r.message)); }
  S.gagal++; S.lbl = { t: 'Tidak dikenal', s: 'gagal' }; S.stabil = 0;
  setSt(S.gagal >= 4 ? 'Masih gagal. Cari tempat lebih terang, atau minta guru mengabsen manual.' : r.message);
  setTimeout(() => { S.kirim = false; S.lbl = CARI; }, 2200);
}

function berhasil(d) {
  S.jalan = false; S.lbl = { t: d.nama, s: 'sukses' }; getar(d.duplikat ? 80 : [60, 40, 60]);
  const b = $('#ban');
  b.className = 'ban ' + (d.duplikat ? 'info' : ({ Hadir: 'ok', Terlambat: 'warn' }[d.status] || 'info'));
  $('#bh').textContent = d.duplikat ? 'SUDAH TERCATAT' : 'PRESENSI BERHASIL';
  $('#bn').textContent = d.nama; $('#bs').textContent = `Kelas: ${d.kelas} - ${d.status}`; $('#bt').textContent = d.jam + ' WIB';
  void b.offsetWidth; b.classList.add('show');
  setSt(d.duplikat ? 'Anda sudah absen hari ini' : 'Absen tercatat');
  setTimeout(() => {
    S.gambar = false; Wajah.henti($('#cam')); lepasLayar();
    $('#sn').textContent = d.nama; $('#sk').textContent = 'Kelas ' + d.kelas + ' • ' + d.jam + ' WIB';
    $('#sp').innerHTML = `<span class="pill ${({ Hadir: 'ok', Terlambat: 'warn' })[d.status] || 'info'}">${esc(d.status)}</span>` + (d.duplikat ? '<div class="muted" style="margin-top:8px">Anda sudah tercatat sebelumnya hari ini.</div>' : '');
    tampil('selesai');
  }, 2600);
}

$('#lagi').onclick = async () => {
  tampil('kam'); setSt('Membuka kamera…');
  try { await Wajah.kamera($('#cam')); pindai(); } catch (e) { tutup('Kamera tidak dapat dibuka: ' + (e.message || e.name)); }
};

// ---- Kotak pelacak wajah (sama dengan layar guru) ----
function petakan(b, vw, vh, cw, ch) { const s = Math.max(cw / vw, ch / vh), ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2; return { x: cw - (b.x * s + ox + b.w * s), y: b.y * s + oy, w: b.w * s, h: b.h * s }; }
function trkLoop() {
  const cv = $('#trk'), vid = $('#cam'); if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  if (!S.gambar) return;
  const T = S.trk;
  if (T.target && Date.now() - T.target.t < 800 && vid.videoWidth) {
    const b = T.target.box;
    T.cur = T.cur ? { x: T.cur.x + (b.x - T.cur.x) * .45, y: T.cur.y + (b.y - T.cur.y) * .45, w: T.cur.w + (b.w - T.cur.w) * .45, h: T.cur.h + (b.h - T.cur.h) * .45 } : { x: b.x, y: b.y, w: b.w, h: b.h };
    const d = petakan(T.cur, vid.videoWidth, vid.videoHeight, r.width, r.height), pad = Math.max(4, d.w * .06), L = S.lbl;
    const x = d.x - pad, y = d.y - pad, w = d.w + pad * 2, h = d.h + pad * 2, col = { cari: '#16A34A', kenal: '#F59E0B', sukses: '#16A34A', gagal: '#EF4444' }[L.s] || '#16A34A';
    g.strokeStyle = col; g.lineWidth = 2.5; g.strokeRect(x, y, w, h);
    g.font = '700 14px Inter, system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    const lh = 24, lw = Math.max(w, g.measureText(L.t).width + 16), lx = Math.max(0, Math.min(x, r.width - lw)); let ly = y - lh; if (ly < 0) ly = y;
    g.fillStyle = col; g.fillRect(lx, ly, lw, lh); g.fillStyle = L.s === 'kenal' ? '#1c1917' : '#fff'; g.fillText(L.t, lx + 8, ly + lh / 2 + 1);
  } else T.cur = null;
  requestAnimationFrame(trkLoop);
}

mulai();
})();
