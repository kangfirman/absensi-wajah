(() => {
'use strict';
const $ = s => document.querySelector(s);
// Urutan pose; foto diambil OTOMATIS saat pose terpenuhi & stabil (tanpa tombol)
const POSE = ['Hadap lurus ke kamera', 'Tengok sedikit ke KIRI', 'Tengok sedikit ke KANAN', 'Dongakkan wajah sedikit', 'Tundukkan wajah sedikit'];
const S = { nis: '', token: '', hasil: null, desc: [], arah: [], base: null, stabil: 0, tunda: 0, t0: 0, lid: 0, jalan: false };

function langkah(n) {
  ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => $('#' + id).classList.toggle('hide', i + 1 !== n));
  [1, 2, 3].forEach(i => { const e = $('#s' + i); e.className = i === n ? 'on' : (i < n ? 'done' : ''); });
  if (n === 4) $('.steps').classList.add('hide');
  window.scrollTo(0, 0);
}
function titik() { $('#dots').innerHTML = POSE.map((_, i) => `<i class="${i < S.desc.length ? 'on' : ''}"></i>`).join(''); }
const info = t => { $('#instr').textContent = t; };

const q = new URLSearchParams(location.search);
if (q.get('token')) $('#tok').value = q.get('token');
if (q.get('nis')) $('#nis').value = q.get('nis');

$('#b1').onclick = async () => {
  const nis = $('#nis').value.trim(), tok = $('#tok').value.trim().toUpperCase();
  $('#e1').textContent = '';
  if (!nis || !tok) { $('#e1').textContent = 'NIS dan token wajib diisi.'; return; }
  const b = $('#b1'); b.disabled = true; b.textContent = 'Memeriksa…';
  const r = await api('daftar.cek', { nis, token: tok });
  b.disabled = false; b.textContent = 'Cek Data';
  if (!r.success) { $('#e1').textContent = r.message; return; }
  S.nis = nis; S.token = tok; S.hasil = r.data;
  if (r.data.statusWajah !== 'Terdaftar') Wajah.muat().catch(() => {});   // siapkan & simpan model di latar belakang selagi siswa membaca persetujuan
  const sudah = r.data.statusWajah === 'Terdaftar';
  $('#hasil').classList.remove('hide');
  $('#hasil').innerHTML = `<div class="muted" style="font-size:12px">NAMA LENGKAP</div><b>${esc(r.data.nama)}</b>
   <div class="muted" style="font-size:12px;margin-top:8px">KELAS</div><b>${esc(r.data.kelas)}</b>
   <div style="margin-top:8px"><span class="pill ${sudah ? 'ok' : 'warn'}">${sudah ? 'Sudah Terdaftar' : 'Belum Terdaftar'}</span></div>`;
  if (sudah) { $('#e1').textContent = 'Wajah sudah terdaftar. Hubungi guru jika perlu mendaftar ulang.'; return; }
  $('#b1').classList.add('hide'); $('#b1n').classList.remove('hide');
};
$('#b1n').onclick = () => langkah(2);
$('#b2b').onclick = () => langkah(1);
$('#setuju').onchange = e => { $('#b2n').disabled = !e.target.checked; };
$('#b2n').onclick = () => { langkah(3); mulaiKamera(); };
$('#b3r').onclick = () => { if (Wajah.siap && $('#cam').srcObject) mulaiAuto(); };

async function mulaiKamera() {
  $('#e3').textContent = ''; S.desc = []; titik();
  try {
    await Wajah.muat(t => { info(t); $('#info3').textContent = t; });
    await Wajah.kamera($('#cam'));
    mulaiAuto();
  } catch (e) {
    $('#e3').textContent = e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera di browser lalu muat ulang halaman.' : (e.message || 'Gagal menyiapkan kamera.');
    info('Kamera belum siap');
  }
}

function mulaiAuto() {
  S.desc = []; S.arah = []; S.base = null; S.stabil = 0; S.jalan = true;
  S.tunda = Date.now() + 800; S.t0 = S.tunda; S.lid++;
  $('#e3').textContent = ''; titik();
  $('#info3').textContent = 'Foto diambil otomatis. Ikuti petunjuk di layar dan tahan posisi sejenak.';
  info(POSE[0] + ' (otomatis)');
  auto(S.lid);
}

// Pose ke-i terpenuhi? (arah diukur relatif terhadap foto lurus pertama; kiri/kanan & atas/bawah harus berlawanan)
function poseOk(d, i) {
  if (i === 0) return Math.abs(d.yaw - 0.5) < 0.15;
  const v = i <= 2 ? d.yaw - S.base.yaw : d.pitch - S.base.pitch, min = i <= 2 ? 0.07 : 0.05;
  if (Math.abs(v) < min) return false;
  if (i === 2 || i === 4) return Math.sign(v) !== S.arah[i - 1];
  return true;
}

async function auto(id) {
  if (!S.jalan || id !== S.lid) return;
  if (document.visibilityState === 'visible' && Date.now() >= S.tunda) {
    let r = null;
    try { r = await Wajah.deteksi($('#cam')); } catch (e) {}
    if (!S.jalan || id !== S.lid) return;
    proses(r);
  }
  setTimeout(() => auto(id), 220);
}

function proses(r) {
  const i = S.desc.length;
  if (!r) { S.stabil = 0; info('Wajah tidak terdeteksi — hadapkan wajah ke kamera'); return; }
  if (r.lebar < 0.2) { S.stabil = 0; info('Dekatkan wajah ke kamera'); return; }
  if (r.skor < 0.8) { S.stabil = 0; info('Wajah kurang jelas — cari tempat lebih terang'); return; }
  const lewat = Date.now() - S.t0 > 7000;            // jaga-jaga: bila pose sulit tercapai, lanjut setelah 7 detik
  if (!poseOk(r, i) && !lewat) { S.stabil = 0; info(POSE[i] + ' (otomatis)'); return; }
  S.stabil++;
  if (S.stabil < 3) { info('Tahan posisi…'); return; }
  S.desc.push(r.desc);
  if (i === 0) S.base = { yaw: r.yaw, pitch: r.pitch };
  else S.arah[i] = Math.sign(i <= 2 ? r.yaw - S.base.yaw : r.pitch - S.base.pitch) || 1;
  S.stabil = 0; S.tunda = Date.now() + 1200; S.t0 = S.tunda; titik();
  const vp = $('#vp'); vp.classList.add('sukses'); setTimeout(() => vp.classList.remove('sukses'), 600);
  if (S.desc.length >= POSE.length) { S.jalan = false; kirim(); return; }
  info('✔ Tersimpan • Berikutnya: ' + POSE[S.desc.length]);
}

async function kirim() {
  info('Memeriksa & menyimpan…');
  let maks = 0;
  for (let i = 0; i < S.desc.length; i++) for (let j = i + 1; j < S.desc.length; j++) maks = Math.max(maks, Wajah.jarak(S.desc[i], S.desc[j]));
  if (maks > 0.75) { $('#e3').textContent = 'Hasil pemindaian tidak konsisten (mungkin ada wajah lain). Mengulang dari awal…'; setTimeout(mulaiAuto, 1500); return; }
  const r = await api('daftar.simpan', { nis: S.nis, token: S.token, descriptors: S.desc, setuju: true });
  if (!r.success) { $('#e3').textContent = r.message + ' Mengulang dari awal…'; setTimeout(mulaiAuto, 2500); return; }
  Wajah.henti($('#cam'));
  $('#sukses').textContent = S.hasil.nama + ' • ' + S.hasil.kelas;
  langkah(4);
}
titik();
if (!configOk()) $('#e1').textContent = 'Aplikasi belum dikonfigurasi (GAS_URL kosong). Hubungi admin.';
})();
