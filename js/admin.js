(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const S = { me: null, kelas: [], charts: [], nav: 0, siswa: [], rekap: null, rekapF: null };
const CDN = {
  chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
  gsi: 'https://accounts.google.com/gsi/client'
};
const NAV = { dashboard: 'Dashboard', absen: 'Absen Wajah', siswa: 'Data Siswa', rekap: 'Rekap & Laporan', pengaturan: 'Pengaturan' };
const WARNA = ['#0D9488', '#4F46E5', '#D97706', '#0284C7', '#DB2777', '#7C3AED', '#059669', '#EA580C'];
const SKEL = '<div class="grid g4"><div class="skel" style="height:120px"></div><div class="skel" style="height:120px"></div><div class="skel" style="height:120px"></div><div class="skel" style="height:120px"></div></div><div class="skel" style="height:280px;margin-top:20px"></div>';

const ava = n => { n = String(n || '?'); const t = n.trim().split(/\s+/); let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<span class="ava" style="background:${WARNA[h % WARNA.length]}">${esc((t[0][0] + (t[1] ? t[1][0] : '')).toUpperCase())}</span>`; };
const pill = s => `<span class="pill ${({ Hadir: 'ok', Terlambat: 'warn', Izin: 'info', Sakit: 'info', Terdaftar: 'ok', 'Belum Daftar': 'warn', Nonaktif: 'err', 'Belum Hadir': 'err' })[s] || 'info'}">${esc(s)}</span>`;
const hariIni = () => new Date().toLocaleDateString('sv-SE');
const geser = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const fmtTgl = (t, o) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', o || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const aktifNav = my => my === S.nav;

function modal(html, lebar) {
  const o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="modal"${lebar ? ` style="width:min(${lebar}px,100%)"` : ''}>${html}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
  o.addEventListener('click', e => { if (e.target.closest('[data-x]')) o.remove(); });
  document.body.appendChild(o); return o;
}
async function chart(canvas, cfg) { await muatSkrip(CDN.chart); const c = new Chart(canvas, cfg); S.charts.push(c); return c; }
function bersihChart() { S.charts.forEach(c => c.destroy()); S.charts = []; }
async function tanya(teks) { return confirm(teks); }

function nomorHal(p, n) {
  const a = []; for (let i = 1; i <= n; i++) if (n <= 7 || i === 1 || i === n || Math.abs(i - p) <= 1) a.push(i);
  let out = '', last = 0; a.forEach(i => { if (i - last > 1) out += '<span class="muted">…</span>'; out += `<button data-p="${i}" class="${i === p ? 'on' : ''}">${i}</button>`; last = i; }); return out;
}
function tabelHal(el, kepala, list, size, baris, kosong) {
  let p = 1;
  const gambar = () => {
    const tot = list.length, n = Math.max(1, Math.ceil(tot / size)); p = Math.min(p, n);
    const sl = list.slice((p - 1) * size, p * size);
    el.innerHTML = tot
      ? `<div class="tw"><table><thead><tr>${kepala}</tr></thead><tbody>${sl.map(baris).join('')}</tbody></table></div><div class="pg"><span class="muted">Menampilkan ${(p - 1) * size + 1}–${(p - 1) * size + sl.length} dari ${tot}</span><span class="row" style="gap:4px">${nomorHal(p, n)}</span></div>`
      : `<div class="empty"><div class="ms">inbox</div><p>${kosong}</p></div>`;
    el.querySelectorAll('.pg button').forEach(b => b.onclick = () => { p = Number(b.dataset.p); gambar(); });
  };
  gambar();
}
const opsiKelas = (semua, pilih) => (semua ? `<option value="">${semua}</option>` : '') + S.kelas.map(k => `<option ${k.kelas === pilih ? 'selected' : ''}>${esc(k.kelas)}</option>`).join('');

// ============ LOGIN ============
async function mulai() {
  document.addEventListener('sesi-habis', () => { toast('Sesi berakhir, silakan masuk lagi.', 'warn'); setTimeout(() => location.reload(), 800); });
  const s = Sesi.get();
  if (s) { S.me = s.me; const r = await api('me'); if (r.success) return masuk(); }
  tampilLogin();
}
async function tampilLogin() {
  $('#app').classList.add('hide'); $('#login').classList.remove('hide');
  $('#darurat').classList.toggle('hide', location.hash !== '#darurat');
  if (!configOk()) { $('#lmsg').textContent = pesanConfig(); return; }
  const c = await api('auth.config');
  if (!c.success) { $('#lmsg').innerHTML = esc(c.message) + `<br><a href="${esc(window.APP_CONFIG.GAS_URL.trim())}?action=ping" target="_blank" rel="noopener" style="color:var(--p)">Tes URL backend ↗</a>`; return; }
  if (!c.data.googleClientId) { $('#gbtn').innerHTML = '<p class="muted" style="text-align:center;font-size:13px">Login Google belum dikonfigurasi. Buka <b>admin.html#darurat</b> untuk masuk dengan akses darurat lalu isi Client ID di Pengaturan.</p>'; return; }
  try {
    await muatSkrip(CDN.gsi);
    google.accounts.id.initialize({ client_id: c.data.googleClientId, callback: onGoogle });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', width: 300, text: 'signin_with', locale: 'id' });
  } catch (e) { $('#lmsg').textContent = 'Gagal memuat login Google. Periksa koneksi internet.'; }
}
async function onGoogle(resp) {
  $('#lmsg').textContent = 'Memverifikasi akun…';
  const r = await api('auth.google', { idToken: resp.credential });
  if (r.success) { Sesi.set({ token: r.data.token, exp: r.data.exp, me: r.data.me }); S.me = r.data.me; return masuk(); }
  $('#lmsg').textContent = '';
  if (r.code === 'DENIED') {
    $('#gbtn').classList.add('hide'); $('#ditolak').classList.remove('hide');
    $('#dtxt').textContent = r.message + ' Hubungi admin sekolah untuk didaftarkan.';
    $('#ganti').onclick = () => { try { google.accounts.id.disableAutoSelect(); } catch (e) {} location.reload(); };
  } else $('#lmsg').textContent = r.message;
}
$('#darurat').onsubmit = async e => {
  e.preventDefault();
  const r = await api('auth.darurat', { username: $('#du').value.trim(), password: $('#dp').value });
  $('#dp').value = '';
  if (!r.success) return toast(r.message, 'error');
  Sesi.set({ token: r.data.token, exp: r.data.exp, me: r.data.me }); S.me = r.data.me; masuk();
};
function keluar(e) { if (e) e.preventDefault(); Sesi.clear(); try { google.accounts.id.disableAutoSelect(); } catch (x) {} location.hash = ''; location.reload(); }
$('#keluar').onclick = keluar; $('#keluar2').onclick = keluar;

async function masuk() {
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  $('#user').textContent = (S.me.nama || S.me.email) + (S.me.darurat ? ' (darurat)' : '');
  $('#tglTop').textContent = fmtTgl(hariIni());
  await muatKelas();
  if (!location.hash || location.hash === '#darurat') location.hash = '#dashboard'; else route();
}
async function muatKelas() {
  const k = await api('kelas.list'); S.kelas = k.success ? k.data : [];
  const n = S.kelas.reduce((a, c) => a + (c.aktif - c.terdaftar), 0);
  $('#bdgS').textContent = n + ' Belum'; $('#bdgS').classList.toggle('hide', !n);
}

// ============ ROUTER ============
const HAL = { dashboard: rDashboard, absen: rAbsen, siswa: rSiswa, rekap: rRekap, pengaturan: rPengaturan };
function route() {
  if (!Sesi.get()) return;
  let h = (location.hash || '').slice(1); if (!HAL[h]) h = 'dashboard';
  hentiAbsen(); bersihChart();
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.h === h));
  $('#judul').textContent = NAV[h];
  HAL[h](++S.nav);
}
window.addEventListener('hashchange', () => { if (location.hash !== '#darurat') route(); });

// ============ DASHBOARD ============
async function rDashboard(my) {
  $('#konten').innerHTML = `<div class="page"><div class="row between"><div><h2>Ringkasan Presensi Siswa</h2><div class="muted" id="dsub"></div></div>
   <div class="row"><select id="dk" style="width:auto">${opsiKelas('Semua Kelas')}</select><input type="date" id="dt" value="${hariIni()}" style="width:auto"></div></div><div id="dbody">${SKEL}</div></div>`;
  const muat = async () => {
    $('#dbody').innerHTML = SKEL;
    const r = await api('dashboard', { kelas: $('#dk').value, tanggal: $('#dt').value || hariIni() });
    if (!aktifNav(my)) return;
    if (!r.success) { $('#dbody').innerHTML = `<div class="card empty">${esc(r.message)}</div>`; return; }
    gambarDash(r.data);
  };
  $('#dk').onchange = muat; $('#dt').onchange = muat; muat();
}
async function gambarDash(d) {
  const h = d.ringkas, k = d.kelas;
  $('#dsub').textContent = `${d.namaSekolah} • Jam masuk ${d.jamMasuk} • ${fmtTgl(d.tanggal)}`;
  $('#dbody').innerHTML = `
  <div class="grid g4">
   <div class="card metric i"><div class="lb">Total siswa aktif</div><div class="n">${h.total}</div><div class="muted">${d.tanpaWajah} belum daftar wajah</div></div>
   <div class="card metric"><div class="lb">Hadir</div><div class="n">${h.hadir}</div><div class="muted">${pct(h.hadir, h.total)}% dari total</div></div>
   <div class="card metric w"><div class="lb">Terlambat</div><div class="n">${h.terlambat}</div><div class="muted">${pct(h.terlambat, h.total)}% dari total</div></div>
   <div class="card metric e"><div class="lb">Belum hadir / alpa</div><div class="n">${h.belum}</div><div class="muted">Izin ${h.izin} • Sakit ${h.sakit}</div></div>
  </div>
  <div class="grid g2" style="margin-top:20px"><div class="card"><h3>Kehadiran per Kelas</h3><p class="muted">Persentase hadir + terlambat terhadap jumlah siswa</p><div class="cv"><canvas id="c1"></canvas></div></div>
   <div class="card"><h3>Distribusi Status</h3><p class="muted">Seluruh siswa pada tanggal terpilih</p><div class="cv"><canvas id="c2"></canvas></div></div></div>
  <div class="card" style="margin-top:20px"><h3>Tren Kehadiran Mingguan (Senin–Jumat)</h3><p class="muted">Dibanding target 90%</p><div class="cv"><canvas id="c3"></canvas></div></div>
  <div class="card" style="margin-top:20px"><div class="row between"><h3>Entri Terbaru Hari Ini</h3><a class="btn out sm" href="#rekap">Lihat Rekap</a></div><div id="feed" style="margin-top:12px"></div></div>`;
  tabelHal($('#feed'), '<th>Jam</th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Metode</th><th>Status</th>', d.terbaru, 5,
    a => `<tr><td class="mono">${esc(a.jam)}</td><td class="mono muted">${esc(a.nis)}</td><td><div class="row" style="gap:8px">${ava(a.nama)}${esc(a.nama)}</div></td><td><span class="chip">${esc(a.kelas)}</span></td><td>${esc(a.metode)}</td><td>${pill(a.status)}${a.status === 'Terlambat' ? ` <span class="muted">+${esc(a.terlambat_menit)}m</span>` : ''}</td></tr>`, 'Belum ada absensi pada tanggal ini.');
  const opsi = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  chart($('#c1'), { type: 'bar', data: { labels: k.map(x => x.kelas), datasets: [
    { label: 'Hadir', data: k.map(x => pct(x.hadir, x.total)), backgroundColor: '#14B8A6' },
    { label: 'Terlambat', data: k.map(x => pct(x.terlambat, x.total)), backgroundColor: '#F59E0B' }] },
    options: Object.assign({}, opsi, { scales: { x: { stacked: true }, y: { stacked: true, max: 100, ticks: { callback: v => v + '%' } } } }) });
  chart($('#c2'), { type: 'doughnut', data: { labels: ['Hadir', 'Terlambat', 'Izin/Sakit', 'Belum hadir/alpa'], datasets: [{ data: [h.hadir, h.terlambat, h.izin + h.sakit, h.belum], backgroundColor: ['#10B981', '#F59E0B', '#0284C7', '#EF4444'] }] }, options: Object.assign({}, opsi, { cutout: '62%' }) });
  chart($('#c3'), { type: 'line', data: { labels: d.pekan.map(x => fmtTgl(x.tanggal, { weekday: 'short', day: 'numeric', month: 'short' })), datasets: [
    { label: 'Kehadiran aktual (%)', data: d.pekan.map(x => x.persen), borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,.12)', fill: true, tension: .3 },
    { label: 'Target (90%)', data: d.pekan.map(() => 90), borderColor: '#D97706', borderDash: [6, 6], pointRadius: 0 }] },
    options: Object.assign({}, opsi, { scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } }) });
}

// ============ ABSEN WAJAH ============
const A = { jalan: false, jeda: false, siswa: [], sudah: {}, log: [], terakhir: null, ambang: 0.5, last: { nis: null, n: 0 }, cool: {}, kirim: false, clk: null, rst: null, trk: { target: null, cur: null }, lbl: { t: 'Mencari wajah…', s: 'cari', sub: '' } };
function hentiAbsen() {
  A.jalan = false; clearInterval(A.clk); clearTimeout(A.rst);
  const v = $('#cam'); if (v) Wajah.henti(v);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function setSt(t, kls) {
  const c = $('#vst'); if (!c) return; c.textContent = t;
  $('#vp').className = 'vp ' + (kls === 'kenal' || kls === 'sukses' || kls === 'gagal' ? kls : '');
  if (kls === 'sukses' || kls === 'info') { clearTimeout(A.rst); A.rst = setTimeout(() => { if (A.jalan) setSt('Menunggu siswa di depan kamera…', ''); }, 2800); }
}
function rAbsen(my) {
  A.jalan = false; A.jeda = false; A.log = []; A.sudah = {}; A.terakhir = null;
  $('#konten').innerHTML = `<div class="page">
  <div class="card row between" style="margin-bottom:20px"><div class="row"><select id="ak" style="width:auto">${opsiKelas('Semua Kelas')}</select><span class="chip mono" id="jam">--:--:--</span><span class="chip" id="sesi">Sesi belum dimulai</span></div>
   <div class="row"><button class="btn out" id="jeda" disabled><span class="ms">pause</span> Jeda Sesi</button><button class="btn ind" id="fs"><span class="ms">fullscreen</span> Layar Penuh</button></div></div>
  <div class="grid g-main"><div>
   <div class="vp" id="vp"><video id="cam" playsinline muted></video><canvas class="trk" id="trk"></canvas><div class="vp-chip" id="vst">Belum dimulai</div><button class="btn warn vp-btn hide" id="man"><span class="ms">edit_note</span> Input Absen Manual</button>
    <div class="vp-cover" id="cover"><div><div class="ms" style="font-size:52px">face</div><h3 style="color:#fff;margin:8px 0">Mulai Sesi Absen</h3><p>Pilih kelas lalu mulai. Browser akan meminta izin kamera.</p><button class="btn" id="mulai">Mulai Sesi</button><p class="mono" id="minfo" style="margin-top:10px"></p></div></div></div>
   <div class="card" style="margin-top:16px"><b>Panduan Operator Kelas</b><p class="muted" style="margin:6px 0 0">Pastikan cahaya merata dan siswa berdiri 60–80 cm dari kamera. Siswa maju satu per satu. Jika wajah tidak dikenali setelah beberapa detik, gunakan <b>Input Absen Manual</b>.</p></div>
  </div><div>
   <div class="card"><div class="row between"><b>Progress Presensi</b><span class="chip" id="pp">0%</span></div><div style="margin:10px 0"><span style="font-size:28px;font-weight:700" id="pn">0</span> <span class="muted" id="pt">dari 0 siswa sudah absen</span></div><div class="bar"><i id="pb" style="width:0"></i></div><div class="muted" style="margin-top:8px;font-size:12px" id="pw"></div></div>
   <div class="card big" style="margin-top:16px"><div class="row between"><b>BARU SAJA TERDETEKSI</b><span class="chip">Real-time</span></div><div id="baru" style="margin-top:10px" class="muted">Belum ada.</div></div>
   <div class="card" style="margin-top:16px"><b>10 Siswa Terakhir Hari Ini</b><div id="log" style="margin-top:10px"></div></div>
  </div></div></div>`;
  $('#ak').onchange = () => { hentiAbsen(); rAbsen(my); };
  $('#mulai').onclick = mulaiAbsen;
  $('#fs').onclick = () => { const e = $('#vp'); if (e.requestFullscreen) e.requestFullscreen(); };
  $('#jeda').onclick = () => { A.jeda = !A.jeda; $('#jeda').innerHTML = A.jeda ? '<span class="ms">play_arrow</span> Lanjutkan' : '<span class="ms">pause</span> Jeda Sesi'; setSt(A.jeda ? 'Sesi dijeda' : 'Menunggu siswa di depan kamera…', ''); };
  $('#man').onclick = manual;
  A.clk = setInterval(() => { const j = $('#jam'); if (j) j.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); }, 1000);
}
async function mulaiAbsen() {
  const b = $('#mulai'); b.disabled = true;
  try {
    $('#minfo').textContent = 'Mengambil data siswa…';
    const r = await api('absen.boot', { kelas: $('#ak').value });
    if (!r.success) throw new Error(r.message);
    A.siswa = r.data.siswa; A.ambang = r.data.ambang || 0.5; A.sudah = {}; r.data.sudah.forEach(a => { A.sudah[a.nis] = a; });
    A.log = r.data.sudah.slice().sort((x, y) => x.jam < y.jam ? 1 : -1);
    await Wajah.muat(t => { $('#minfo').textContent = t; });
    $('#minfo').textContent = 'Menyalakan kamera…';
    await Wajah.kamera($('#cam'));
    const m = r.data.jamMasuk.split(':'), tt = Number(m[0]) * 60 + Number(m[1]) + r.data.toleransi;
    $('#sesi').textContent = `Sesi Aktif | Masuk ${r.data.jamMasuk}, toleransi ${String(Math.floor(tt / 60) % 24).padStart(2, '0')}:${String(tt % 60).padStart(2, '0')}`;
    $('#cover').classList.add('hide'); $('#man').classList.remove('hide'); $('#jeda').disabled = false;
    A.jalan = true; A.jeda = false; A.trk = { target: null, cur: null }; A.lbl = LBL_CARI; setSt('Menunggu siswa di depan kamera…', ''); updProg(); renderKanan(); trkLoop(); loopAbsen();
    if (!A.siswa.some(s => s.desc)) toast('Belum ada siswa yang terdaftar wajahnya di pilihan ini. Gunakan absen manual.', 'warn');
  } catch (e) {
    b.disabled = false;
    $('#minfo').textContent = e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera di browser.' : (e.message || 'Gagal memulai sesi.');
  }
}
const LBL_CARI = { t: 'Mencari wajah…', s: 'cari', sub: '' };
async function loopAbsen() {
  if (!A.jalan) return;
  if (document.visibilityState === 'visible') {
    if (A.jeda) A.trk.target = null;
    else {
      try {
        const r = await Wajah.deteksi($('#cam'));
        if (!A.jalan) return;
        if (r) { A.trk.target = { box: r.box, t: Date.now() }; prosesWajah(r); }
        else { A.last = { nis: null, n: 0 }; if (!A.kirim) A.lbl = LBL_CARI; if (!A.rst) setSt('Menunggu siswa di depan kamera…', ''); }
      } catch (e) { console.error(e.message); }
    }
  }
  setTimeout(loopAbsen, 100);
}
function prosesWajah(r) {
  if (A.kirim) return;
  const m = Wajah.cocok(r.desc, A.siswa.filter(s => s.desc), A.ambang);
  if (!m) { A.last = { nis: null, n: 0 }; A.lbl = { t: 'Tidak dikenal', s: 'gagal', sub: 'Coba lagi atau absen manual' }; setSt('Wajah tidak dikenali — coba lagi atau gunakan absen manual', 'gagal'); return; }
  const s = m.siswa;
  if (A.sudah[s.nis]) {
    const x = A.sudah[s.nis]; A.lbl = { t: s.nama, s: 'sukses', sub: `✔ ${x.status} • ${x.jam}` };
    if (!A.cool[s.nis] || Date.now() - A.cool[s.nis] > 5000) { A.cool[s.nis] = Date.now(); setSt(`${s.nama} sudah absen pukul ${x.jam}`, 'info'); }
    return;
  }
  A.last = A.last.nis === s.nis ? { nis: s.nis, n: A.last.n + 1 } : { nis: s.nis, n: 1 };
  A.lbl = { t: s.nama, s: 'kenal', sub: 'Memverifikasi…' };
  setSt(`Memverifikasi ${s.nama}…`, 'kenal');
  if (A.last.n >= 2) { A.kirim = true; catat(s, { metode: 'Wajah', akurasi: m.akurasi }).finally(() => { A.kirim = false; A.last = { nis: null, n: 0 }; }); }
}

// ---- Pelacak kotak wajah (kanvas di atas video) ----
// Koordinat video -> tampilan: object-fit: cover + video dicerminkan (scaleX(-1)); kanvas tidak dicerminkan agar teks terbaca
function petakan(b, vw, vh, cw, ch) {
  const s = Math.max(cw / vw, ch / vh), ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
  return { x: cw - (b.x * s + ox + b.w * s), y: b.y * s + oy, w: b.w * s, h: b.h * s };
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function trkLoop() {
  const cv = $('#trk'); if (!cv) return;
  if (!A.jalan) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
  gambarTrk(cv); requestAnimationFrame(trkLoop);
}
function gambarTrk(cv) {
  const vid = $('#cam'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const T = A.trk;
  if (!T.target || Date.now() - T.target.t > 800 || !vid.videoWidth) { T.cur = null; return; }
  const b = T.target.box;                                   // geser halus ke posisi terbaru (tracking mulus)
  T.cur = T.cur ? { x: T.cur.x + (b.x - T.cur.x) * .4, y: T.cur.y + (b.y - T.cur.y) * .4, w: T.cur.w + (b.w - T.cur.w) * .4, h: T.cur.h + (b.h - T.cur.h) * .4 } : { x: b.x, y: b.y, w: b.w, h: b.h };
  const d = petakan(T.cur, vid.videoWidth, vid.videoHeight, r.width, r.height), pad = Math.max(8, d.w * .12);
  const x = d.x - pad, y = d.y - pad, w = d.w + pad * 2, h = d.h + pad * 2, L = A.lbl;
  const col = { cari: '#2DD4BF', kenal: '#F59E0B', sukses: '#10B981', gagal: '#EF4444' }[L.s] || '#2DD4BF';
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = col; g.globalAlpha = .5; g.lineWidth = 1.5; rr(g, x, y, w, h, 10); g.stroke(); g.globalAlpha = 1;
  const c = Math.min(w, h) * .22; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = 8;
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(k => { g.beginPath(); g.moveTo(k[0], k[1] + k[3] * c); g.lineTo(k[0], k[1]); g.lineTo(k[0] + k[2] * c, k[1]); g.stroke(); });
  g.shadowBlur = 0;
  // label nama di atas kotak
  g.font = '700 15px Inter, system-ui, sans-serif'; const w1 = g.measureText(L.t).width;
  g.font = '600 12px Inter, system-ui, sans-serif'; const w2 = L.sub ? g.measureText(L.sub).width : 0;
  const lw = Math.max(w1, w2) + 22, lh = L.sub ? 44 : 28;
  const lx = Math.max(4, Math.min(r.width - lw - 4, x + w / 2 - lw / 2)); let ly = y - lh - 8; if (ly < 4) ly = y + 8;
  g.fillStyle = col; rr(g, lx, ly, lw, lh, 8); g.fill();
  g.fillStyle = L.s === 'kenal' ? '#1c1917' : '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '700 15px Inter, system-ui, sans-serif'; g.fillText(L.t, lx + lw / 2, ly + (L.sub ? 14 : lh / 2));
  if (L.sub) { g.font = '600 12px Inter, system-ui, sans-serif'; g.fillText(L.sub, lx + lw / 2, ly + 31); }
}

async function catat(s, extra) {
  const r = await api('absen.catat', Object.assign({ nis: s.nis }, extra));
  if (!r.success) { A.lbl = { t: s.nama, s: 'gagal', sub: 'Gagal mencatat' }; setSt('Gagal mencatat: ' + r.message, 'gagal'); toast(r.message, 'error'); return false; }
  const a = r.data.absen; A.sudah[a.nis] = a;
  if (r.data.duplikat) { A.lbl = { t: s.nama, s: 'sukses', sub: `✔ ${a.status} • ${a.jam}` }; setSt(`${s.nama} sudah absen pukul ${a.jam}`, 'info'); updProg(); return true; }
  A.log.unshift(a); A.terakhir = { a, akurasi: extra.akurasi };
  A.lbl = { t: s.nama, s: 'sukses', sub: `✔ ${a.status} • ${a.jam}` }; setSt(`✔ ${s.nama} — ${a.status}`, 'sukses'); updProg(); renderKanan(); return true;
}
function updProg() {
  const tot = A.siswa.length, sudah = A.siswa.filter(s => A.sudah[s.nis]).length, p = pct(sudah, tot);
  if (!$('#pn')) return;
  $('#pn').textContent = sudah; $('#pt').textContent = `dari ${tot} siswa sudah absen`; $('#pp').textContent = Math.round(p) + '% selesai'; $('#pb').style.width = p + '%';
  const nw = A.siswa.filter(s => !s.desc).length;
  $('#pw').textContent = `${tot - sudah} siswa belum absen` + (nw ? ` • ${nw} belum daftar wajah (absen manual)` : '');
}
function renderKanan() {
  const t = A.terakhir;
  if ($('#baru')) $('#baru').innerHTML = t ? `<div class="row" style="gap:12px">${ava(t.a.nama)}<div><b>${esc(t.a.nama)}</b><div class="muted mono">NIS ${esc(t.a.nis)} • ${esc(t.a.kelas)}</div><div class="muted mono">${esc(t.a.jam)} WIB</div></div></div><div style="margin-top:10px">${pill(t.a.status)}${t.akurasi !== undefined && t.a.metode === 'Wajah' ? ` <span class="chip mono">Kecocokan ${esc(t.akurasi)}%</span>` : ''}</div>` : 'Belum ada.';
  if ($('#log')) $('#log').innerHTML = A.log.slice(0, 10).map(a => `<div class="feed ${a.status === 'Terlambat' ? 'late' : ''}">${ava(a.nama)}<div class="grow"><b>${esc(a.nama)}</b><div class="mono muted">${esc(a.jam)} • NIS ${esc(a.nis)}</div></div>${pill(a.status)}</div>`).join('') || '<div class="muted">Belum ada.</div>';
}
function manual() {
  const daftar = A.siswa.filter(s => !A.sudah[s.nis]);
  const o = modal(`<h3>Input Absen Manual</h3><div class="f" style="margin-top:12px"><input id="mq" placeholder="Cari nama / NIS"></div><div id="ml" style="max-height:260px;overflow:auto;margin-bottom:12px"></div>
   <div class="f"><label>Status</label><select id="mst"><option value="Otomatis">Hadir / Terlambat (otomatis sesuai jam)</option><option>Izin</option><option>Sakit</option></select></div>
   <div class="row"><button class="btn out" data-x>Batal</button><button class="btn grow" id="msv">Simpan</button></div>`);
  const isi = () => { const q = $('#mq', o).value.toLowerCase(); const l = daftar.filter(s => !q || s.nama.toLowerCase().includes(q) || s.nis.includes(q));
    $('#ml', o).innerHTML = l.map(s => `<label class="chk" style="padding:6px 4px;border-bottom:1px solid var(--bd)"><input type="checkbox" value="${esc(s.nis)}"><span>${esc(s.nama)} <span class="muted mono">${esc(s.nis)} • ${esc(s.kelas)}</span></span></label>`).join('') || '<div class="muted">Semua siswa sudah absen.</div>'; };
  $('#mq', o).oninput = isi; isi();
  $('#msv', o).onclick = async () => {
    const pilih = [...o.querySelectorAll('#ml input:checked')].map(i => i.value);
    if (!pilih.length) return toast('Pilih minimal satu siswa.', 'warn');
    $('#msv', o).disabled = true;
    for (const nis of pilih) await catat(A.siswa.find(s => s.nis === nis), { metode: 'Manual', status: $('#mst', o).value });
    o.remove(); toast(pilih.length + ' siswa dicatat.');
  };
}

// ============ DATA SISWA ============
async function rSiswa(my) {
  $('#konten').innerHTML = `<div class="page"><div class="row between"><h2>Data Siswa</h2><div class="row"><button class="btn out" id="imp"><span class="ms">upload_file</span> Import Excel/CSV</button><button class="btn" id="tbh"><span class="ms">add</span> Tambah Siswa</button></div></div>
   <div class="card"><div class="row" style="margin-bottom:14px"><input id="sq" placeholder="Cari nama / NIS" style="max-width:260px"><select id="sk" style="width:auto">${opsiKelas('Semua Kelas')}</select><select id="ss" style="width:auto"><option value="">Semua Status</option><option>Terdaftar</option><option>Belum Daftar</option><option>Nonaktif</option></select></div><div id="stb">${SKEL.split('</div>')[0]}</div></div></div>`;
  const r = await api('siswa.list'); if (!aktifNav(my)) return;
  if (!r.success) { $('#stb').innerHTML = `<div class="empty">${esc(r.message)}</div>`; return; }
  S.siswa = r.data;
  const gambar = () => {
    const q = $('#sq').value.toLowerCase(), k = $('#sk').value, st = $('#ss').value;
    const l = S.siswa.filter(s => (!k || s.kelas === k) && (!q || s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)) && (!st || (st === 'Nonaktif' ? !s.aktif : (s.aktif && s.statusWajah === st))));
    tabelHal($('#stb'), '<th>NIS</th><th>Nama</th><th>Kelas</th><th>Status Wajah</th><th>Tgl Daftar</th><th>Aksi</th>', l, 15,
      s => `<tr style="${s.aktif ? '' : 'opacity:.55'}"><td class="mono">${esc(s.nis)}</td><td><div class="row" style="gap:8px">${ava(s.nama)}${esc(s.nama)}</div></td><td><span class="chip">${esc(s.kelas)}</span></td><td>${s.aktif ? pill(s.statusWajah) : pill('Nonaktif')}</td><td class="mono muted">${esc(s.tanggalDaftar || '-')}</td>
       <td class="act"><button class="btn ghost" data-a="edit" data-n="${esc(s.nis)}" title="Ubah"><span class="ms">edit</span></button><button class="btn ghost" data-a="wajah" data-n="${esc(s.nis)}" title="Hapus data wajah"><span class="ms">face_retouching_off</span></button><button class="btn ghost" data-a="aktif" data-n="${esc(s.nis)}" title="${s.aktif ? 'Nonaktifkan' : 'Aktifkan'}"><span class="ms">${s.aktif ? 'block' : 'check_circle'}</span></button></td></tr>`, 'Tidak ada siswa yang cocok.');
  };
  ['sq', 'sk', 'ss'].forEach(i => { $('#' + i).oninput = gambar; $('#' + i).onchange = gambar; });
  $('#stb').onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const s = S.siswa.find(x => x.nis === b.dataset.n); if (!s) return;
    if (b.dataset.a === 'edit') formSiswa(s, muat);
    if (b.dataset.a === 'wajah' && await tanya(`Hapus data wajah ${s.nama}? Siswa harus mendaftar ulang lewat link kelas.`)) { const x = await api('siswa.hapusWajah', { nis: s.nis }); toast(x.message, x.success ? 'ok' : 'error'); muat(); }
    if (b.dataset.a === 'aktif') { const x = await api('siswa.simpan', { nis: s.nis, nama: s.nama, kelas: s.kelas, wali: s.wali, aktif: !s.aktif }); toast(x.success ? (s.aktif ? 'Siswa dinonaktifkan.' : 'Siswa diaktifkan.') : x.message, x.success ? 'ok' : 'error'); muat(); }
  };
  async function muat() { const x = await api('siswa.list'); if (x.success) { S.siswa = x.data; gambar(); } await muatKelas(); }
  $('#tbh').onclick = () => formSiswa(null, muat); $('#imp').onclick = () => impor(muat);
  gambar();
}
function formSiswa(s, selesai) {
  const baru = !s, o = modal(`<h3>${baru ? 'Tambah Siswa' : 'Ubah Siswa'}</h3><div style="margin-top:14px">
   <div class="f"><label>NIS *</label><input id="fn" value="${esc(s ? s.nis : '')}" ${baru ? '' : 'readonly'}></div>
   <div class="f"><label>Nama Lengkap *</label><input id="fm" value="${esc(s ? s.nama : '')}"></div>
   <div class="f"><label>Kelas *</label><input id="fk" list="dk" value="${esc(s ? s.kelas : '')}"><datalist id="dk">${S.kelas.map(k => `<option value="${esc(k.kelas)}">`).join('')}</datalist></div>
   <div class="f"><label>Nomor Wali (opsional)</label><input id="fw" value="${esc(s ? s.wali : '')}"></div>
   <label class="chk"><input type="checkbox" id="fa" ${!s || s.aktif ? 'checked' : ''}>Siswa aktif</label><div class="err-t" id="fe"></div></div>
   <div class="row" style="margin-top:16px"><button class="btn out" data-x>Batal</button><button class="btn grow" id="fs">Simpan</button></div>`);
  $('#fs', o).onclick = async () => {
    const b = $('#fs', o); b.disabled = true;
    const r = await api('siswa.simpan', { baru, nis: $('#fn', o).value, nama: $('#fm', o).value, kelas: $('#fk', o).value, wali: $('#fw', o).value, aktif: $('#fa', o).checked });
    if (!r.success) { $('#fe', o).textContent = r.message; b.disabled = false; return; }
    o.remove(); toast(r.message); selesai();
  };
}
function impor(selesai) {
  const o = modal(`<h3>Import Data Siswa</h3><p class="muted">File Excel (.xlsx) atau CSV dengan kolom: <b>NIS, Nama, Kelas, Nomor Wali</b>.</p>
   <div class="drop" id="dz"><div class="ms">upload_file</div><p>Klik untuk memilih file</p><input type="file" id="fl" accept=".csv,.xlsx,.xls" class="hide"></div>
   <p><a href="#" id="tpl" style="color:var(--p)">Unduh template CSV</a></p><div id="pv"></div>
   <div class="row" style="margin-top:14px"><button class="btn out" data-x>Batal</button><button class="btn grow" id="go" disabled>Import</button></div>`, 720);
  let valid = [];
  $('#dz', o).onclick = () => $('#fl', o).click();
  $('#tpl', o).onclick = e => { e.preventDefault(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['NIS,Nama,Kelas,Nomor Wali\n2024101,Contoh Siswa,X-B,\n'], { type: 'text/csv' })); a.download = 'template-siswa.csv'; a.click(); };
  $('#fl', o).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      await muatSkrip(CDN.xlsx);
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
      const hd = (raw[0] || []).map(x => String(x).toLowerCase().trim()), ada = hd.includes('nis');
      const idx = (...n) => hd.findIndex(h => n.includes(h));
      const c = ada ? { nis: idx('nis'), nama: idx('nama', 'nama lengkap'), kelas: idx('kelas', 'rombel'), wali: idx('nomor wali', 'no wali', 'wali', 'hp') } : { nis: 0, nama: 1, kelas: 2, wali: 3 };
      const rows = raw.slice(ada ? 1 : 0).filter(r => r.some(x => String(x).trim())).slice(0, 600).map(r => ({ nis: String(r[c.nis] || '').trim(), nama: String(r[c.nama] || '').trim(), kelas: String(r[c.kelas] || '').trim(), wali: c.wali > -1 ? String(r[c.wali] || '').trim() : '' }));
      const cek = r => !/^[A-Za-z0-9._-]{3,20}$/.test(r.nis) ? 'NIS tidak valid' : !r.nama ? 'Nama kosong' : !/^[A-Za-z0-9 .\-_\/]{1,20}$/.test(r.kelas) ? 'Kelas tidak valid' : '';
      valid = rows.filter(r => !cek(r));
      $('#pv', o).innerHTML = `<div class="row" style="margin:10px 0"><span class="pill ok">${valid.length} valid</span><span class="pill err">${rows.length - valid.length} error</span></div><div class="tw" style="max-height:240px;overflow:auto"><table><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead><tbody>${rows.slice(0, 100).map(r => { const e = cek(r); return `<tr><td class="mono">${esc(r.nis)}</td><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td><td>${e ? `<span class="pill err">${e}</span>` : '<span class="pill ok">Valid</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
      $('#go', o).disabled = !valid.length;
    } catch (x) { toast('Gagal membaca file: ' + x.message, 'error'); }
  };
  $('#go', o).onclick = async () => {
    $('#go', o).disabled = true;
    const r = await api('siswa.impor', { rows: valid });
    if (!r.success) { toast(r.message, 'error'); $('#go', o).disabled = false; return; }
    o.remove(); toast(r.message); selesai();
  };
}

// ============ REKAP ============
async function rRekap(my) {
  const f = S.rekapF || { dari: geser(-6), sampai: hariIni(), kelas: '', status: '', q: '', mode: 'grafik' };
  $('#konten').innerHTML = `<div class="page"><div class="row between"><h2>Rekap & Laporan</h2><div class="row"><button class="btn out" id="xx"><span class="ms">table_view</span> Unduh Excel</button><button class="btn out" id="xp"><span class="ms">picture_as_pdf</span> Unduh PDF</button></div></div>
   <div class="card" style="margin-bottom:20px"><div class="row"><input type="date" id="rd" value="${f.dari}" style="width:auto"><span class="muted">s/d</span><input type="date" id="rs" value="${f.sampai}" style="width:auto"><select id="rk" style="width:auto">${opsiKelas('Semua Kelas', f.kelas)}</select>
    <select id="rt" style="width:auto"><option value="">Semua Status</option>${['Hadir', 'Terlambat', 'Izin', 'Sakit'].map(x => `<option ${f.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select><input id="rq" placeholder="Cari nama / NIS" value="${esc(f.q)}" style="max-width:220px"><button class="btn" id="rg">Terapkan</button>
    <div class="seg"><button data-m="grafik" class="${f.mode === 'grafik' ? 'on' : ''}">Grafik</button><button data-m="tabel" class="${f.mode === 'tabel' ? 'on' : ''}">Tabel</button></div></div></div><div id="rb">${SKEL.split('</div>')[0]}</div></div>`;
  const muat = async () => {
    bersihChart();
    S.rekapF = { dari: $('#rd').value, sampai: $('#rs').value, kelas: $('#rk').value, status: $('#rt').value, q: $('#rq').value, mode: f.mode };
    $('#rb').innerHTML = '<div class="skel" style="height:280px"></div>';
    const r = await api('rekap', S.rekapF); if (!aktifNav(my)) return;
    if (!r.success) { $('#rb').innerHTML = `<div class="card empty">${esc(r.message)}</div>`; return; }
    S.rekap = r.data; gambarRekap(S.rekapF.mode);
  };
  $('#rg').onclick = muat;
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { f.mode = b.dataset.m; if (S.rekapF) S.rekapF.mode = f.mode; document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); if (S.rekap) { bersihChart(); gambarRekap(f.mode); } });
  $('#xx').onclick = expExcel; $('#xp').onclick = expPdf;
  muat();
}
function gambarRekap(mode) {
  const d = S.rekap, el = $('#rb');
  if (!d.rows.length) { el.innerHTML = '<div class="card empty"><div class="ms">inbox</div><p>Tidak ada data absensi pada filter ini.</p></div>'; return; }
  const note = d.terpotong ? '<p class="muted">Menampilkan 5.000 data terbaru. Persempit rentang tanggal untuk data lengkap.</p>' : '';
  if (mode === 'tabel') {
    el.innerHTML = `<div class="card">${note}<div id="rtb"></div></div>`;
    tabelHal($('#rtb'), '<th>Tanggal</th><th>Jam</th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Metode</th>', d.rows, 25,
      a => `<tr><td class="mono">${esc(a.tanggal)}</td><td class="mono">${esc(a.jam)}</td><td class="mono muted">${esc(a.nis)}</td><td>${esc(a.nama)}</td><td><span class="chip">${esc(a.kelas)}</span></td><td>${pill(a.status)}</td><td>${esc(a.metode)}</td></tr>`, 'Kosong.');
    return;
  }
  el.innerHTML = `${note}<div class="grid g2"><div class="card"><h3>Perbandingan per Kelas</h3><div class="cv"><canvas id="r1"></canvas></div></div><div class="card"><h3>Proporsi Status</h3><div class="cv"><canvas id="r2"></canvas></div></div></div><div class="card" style="margin-top:20px"><h3>Tren Harian</h3><div class="cv"><canvas id="r3"></canvas></div></div>`;
  const ks = Object.keys(d.perKelas).sort((a, b) => a.localeCompare(b, 'id', { numeric: true })), hs = Object.keys(d.perHari).sort();
  const W = { Hadir: '#10B981', Terlambat: '#F59E0B', Izin: '#0284C7', Sakit: '#6366F1' }, opsi = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  chart($('#r1'), { type: 'bar', data: { labels: ks, datasets: Object.keys(W).map(s => ({ label: s, data: ks.map(k => d.perKelas[k][s]), backgroundColor: W[s] })) }, options: Object.assign({}, opsi, { scales: { x: { stacked: true }, y: { stacked: true } } }) });
  chart($('#r2'), { type: 'doughnut', data: { labels: Object.keys(W), datasets: [{ data: Object.keys(W).map(s => d.perStatus[s]), backgroundColor: Object.values(W) }] }, options: Object.assign({}, opsi, { cutout: '60%' }) });
  chart($('#r3'), { type: 'line', data: { labels: hs.map(t => fmtTgl(t, { day: 'numeric', month: 'short' })), datasets: [{ label: 'Hadir + Terlambat', data: hs.map(t => d.perHari[t].Hadir + d.perHari[t].Terlambat), borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,.12)', fill: true, tension: .3 }] }, options: opsi });
}
const barisExport = () => S.rekap.rows.map(a => [a.tanggal, a.jam, a.nis, a.nama, a.kelas, a.status, a.terlambat_menit, a.metode]);
const kepalaExport = ['Tanggal', 'Jam', 'NIS', 'Nama', 'Kelas', 'Status', 'Terlambat (menit)', 'Metode'];
async function expExcel() {
  if (!S.rekap || !S.rekap.rows.length) return toast('Tidak ada data untuk diunduh.', 'warn');
  try { await muatSkrip(CDN.xlsx); const ws = XLSX.utils.aoa_to_sheet([kepalaExport].concat(barisExport())), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rekap'); XLSX.writeFile(wb, `rekap-absensi_${S.rekapF.dari}_${S.rekapF.sampai}.xlsx`); } catch (e) { toast(e.message, 'error'); }
}
async function expPdf() {
  if (!S.rekap || !S.rekap.rows.length) return toast('Tidak ada data untuk diunduh.', 'warn');
  try {
    await muatSkrip(CDN.jspdf); await muatSkrip(CDN.autotable);
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13); doc.text(`Rekap Absensi Siswa • ${S.rekapF.dari} s/d ${S.rekapF.sampai}`, 14, 14);
    doc.autoTable({ startY: 20, head: [kepalaExport], body: barisExport(), styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] } });
    doc.save(`rekap-absensi_${S.rekapF.dari}_${S.rekapF.sampai}.pdf`);
  } catch (e) { toast(e.message, 'error'); }
}

// ============ PENGATURAN ============
async function rPengaturan(my) {
  $('#konten').innerHTML = `<div class="page"><h2 style="margin-bottom:20px">Pengaturan</h2><div id="pb">${SKEL.split('</div>')[0]}</div></div>`;
  await muatKelas();
  const [c, a, rs] = await Promise.all([api('pengaturan.get'), api('admin.list'), api('rahasia.status')]);
  if (!aktifNav(my)) return;
  if (!c.success) { $('#pb').innerHTML = `<div class="card empty">${esc(c.message)}</div>`; return; }
  const cfg = c.data, base = new URL('daftar.html', location.href).href;
  $('#pb').innerHTML = `
  <div class="card"><h3>Jam Absen</h3><p class="muted">Siswa yang absen setelah jam masuk + toleransi dicatat Terlambat.</p><div class="grid g3" style="margin-top:12px">
   <div class="f"><label>Nama sekolah</label><input id="cn" value="${esc(cfg.nama_sekolah)}"></div><div class="f"><label>Jam masuk</label><input type="time" id="cj" value="${esc(cfg.jam_masuk)}"></div>
   <div class="f"><label>Toleransi (menit)</label><input type="number" id="ct" min="0" max="180" value="${esc(cfg.toleransi_menit)}"></div></div>
   <div class="f" style="max-width:320px"><label>Ambang kecocokan wajah (0.3–0.7)</label><input type="number" step="0.01" min="0.3" max="0.7" id="ca" value="${esc(cfg.ambang_wajah)}"><div class="muted" style="font-size:12px;margin-top:4px">Makin kecil makin ketat (lebih aman, tapi bisa gagal mengenali). Default 0.5.</div></div>
   <button class="btn" id="csv">Simpan Perubahan</button></div>
  <div class="card" style="margin-top:20px"><h3>Daftar Admin / Guru</h3><p class="muted">Hanya akun Google berikut yang dapat masuk ke portal ini.</p><div id="al" style="margin:12px 0"></div>
   <div class="row"><input id="ae" type="email" placeholder="email@sekolah.sch.id" style="max-width:280px"><input id="an" placeholder="Nama (opsional)" style="max-width:200px"><button class="btn" id="at">Tambah</button></div></div>
  <div class="card" style="margin-top:20px"><h3>Link Pendaftaran Wajah per Kelas</h3><p class="muted">Bagikan link kelas kepada siswa. Siswa cukup mengisi NIS-nya. Jika token bocor, buat ulang.</p><div id="kl" class="tw" style="margin-top:12px"></div></div>
  <div class="card" style="margin-top:20px"><h3>Keamanan & Login</h3>
   <div class="f" style="margin-top:12px"><label>Google OAuth Client ID</label><div class="row"><input id="gid" value="${esc(rs.success ? rs.data.googleClientId : '')}" placeholder="xxxx.apps.googleusercontent.com" style="max-width:460px"><button class="btn" id="gsv">Simpan</button></div>
    <div class="muted" style="font-size:12px;margin-top:4px">Authorized JavaScript origin yang harus didaftarkan: <span class="mono">${esc(location.origin)}</span></div></div>
   <div class="f" style="max-width:360px"><label>Ganti kata sandi akses darurat</label><input id="dpw" type="password" autocomplete="new-password" placeholder="Min. 12 karakter, huruf + angka"><button class="btn out" id="dsv" style="margin-top:8px">Ganti Kata Sandi</button></div>
   <button class="btn out" id="kst"><span class="ms">logout</span> Keluar dari semua perangkat</button></div>`;

  const admins = a.success ? a.data : [];
  const gAdmin = () => { $('#al').innerHTML = admins.map(x => `<div class="feed">${ava(x.nama || x.email)}<div class="grow"><b>${esc(x.nama || '-')}</b><div class="muted mono">${esc(x.email)}</div></div><button class="btn ghost" data-e="${esc(x.email)}"><span class="ms">delete</span></button></div>`).join('') || '<div class="muted">Belum ada admin.</div>'; };
  gAdmin();
  $('#al').onclick = async e => { const b = e.target.closest('[data-e]'); if (!b || !await tanya('Hapus admin ' + b.dataset.e + '?')) return; const r = await api('admin.hapus', { email: b.dataset.e }); toast(r.message, r.success ? 'ok' : 'error'); if (r.success) { admins.splice(admins.findIndex(x => x.email === b.dataset.e), 1); gAdmin(); } };
  $('#at').onclick = async () => { const r = await api('admin.tambah', { email: $('#ae').value, nama: $('#an').value }); toast(r.message, r.success ? 'ok' : 'error'); if (r.success) { const l = await api('admin.list'); admins.splice(0, admins.length, ...l.data); gAdmin(); $('#ae').value = ''; $('#an').value = ''; } };
  $('#csv').onclick = async () => { const r = await api('pengaturan.simpan', { nama_sekolah: $('#cn').value, jam_masuk: $('#cj').value, toleransi_menit: $('#ct').value, ambang_wajah: $('#ca').value }); toast(r.message, r.success ? 'ok' : 'error'); };
  const gKelas = () => { $('#kl').innerHTML = S.kelas.length ? `<table><thead><tr><th>Kelas</th><th>Terdaftar</th><th>Token</th><th>Link</th><th></th></tr></thead><tbody>${S.kelas.map(k => `<tr><td><span class="chip">${esc(k.kelas)}</span></td><td>${k.terdaftar}/${k.aktif}</td><td class="mono">${esc(k.token)}</td><td><button class="btn ghost" data-c="${esc(k.token)}"><span class="ms">content_copy</span> Salin link</button></td><td><button class="btn out sm" data-r="${esc(k.kelas)}">Buat ulang</button></td></tr>`).join('')}</tbody></table>` : '<div class="muted">Belum ada kelas. Tambahkan siswa terlebih dulu.</div>'; };
  gKelas();
  $('#kl').onclick = async e => {
    const c = e.target.closest('[data-c]'), r = e.target.closest('[data-r]');
    if (c) { const url = base + '?token=' + c.dataset.c; try { await navigator.clipboard.writeText(url); toast('Link disalin.'); } catch (x) { prompt('Salin link ini:', url); } }
    if (r && await tanya(`Buat ulang token kelas ${r.dataset.r}? Link lama langsung tidak berlaku.`)) { const x = await api('kelas.token', { kelas: r.dataset.r }); toast(x.message, x.success ? 'ok' : 'error'); await muatKelas(); gKelas(); }
  };
  $('#gsv').onclick = async () => { const r = await api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai: $('#gid').value }); toast(r.message, r.success ? 'ok' : 'error'); };
  $('#dsv').onclick = async () => { const r = await api('auth.rotasiDarurat', { passwordBaru: $('#dpw').value }); $('#dpw').value = ''; toast(r.message, r.success ? 'ok' : 'error'); };
  $('#kst').onclick = async () => { if (await tanya('Keluar dari semua perangkat?')) { await api('auth.keluarSemua'); keluar(); } };
}

mulai();
})();
