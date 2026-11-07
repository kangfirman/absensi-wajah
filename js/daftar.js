(() => {
'use strict';
const $ = s => document.querySelector(s);
const SUDUT = ['Hadap lurus ke kamera', 'Tengok sedikit ke KIRI', 'Tengok sedikit ke KANAN', 'Dongak sedikit', 'Tunduk sedikit'];
const S = { nis: '', token: '', hasil: null, desc: [], sibuk: false };

function langkah(n) {
  ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => $('#' + id).classList.toggle('hide', i + 1 !== n));
  [1, 2, 3].forEach(i => { const e = $('#s' + i); e.className = i === n ? 'on' : (i < n ? 'done' : ''); });
  if (n === 4) $('.steps').classList.add('hide');
  window.scrollTo(0, 0);
}
function titik() { $('#dots').innerHTML = SUDUT.map((_, i) => `<i class="${i < S.desc.length ? 'on' : ''}"></i>`).join(''); }

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

async function mulaiKamera() {
  S.desc = []; titik(); $('#b3').disabled = true; $('#e3').textContent = '';
  try {
    await Wajah.muat(t => { $('#instr').textContent = t; $('#info3').textContent = t; });
    await Wajah.kamera($('#cam'));
    $('#info3').textContent = 'Pastikan wajah terang dan terlihat jelas. Ikuti petunjuk di layar.';
    $('#instr').textContent = SUDUT[0]; $('#b3').disabled = false;
  } catch (e) {
    $('#e3').textContent = e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera di browser lalu muat ulang halaman.' : (e.message || 'Gagal menyiapkan kamera.');
    $('#instr').textContent = 'Kamera belum siap';
  }
}

$('#b3').onclick = async () => {
  if (S.sibuk) return; S.sibuk = true; $('#b3').disabled = true; $('#e3').textContent = '';
  let r = null;
  for (let i = 0; i < 3 && !r; i++) { try { r = await Wajah.deteksi($('#cam')); } catch (e) {} if (!r) await new Promise(ok => setTimeout(ok, 300)); }
  S.sibuk = false; $('#b3').disabled = false;
  if (!r) { $('#e3').textContent = 'Wajah tidak terdeteksi. Cari tempat lebih terang dan hadapkan wajah ke kamera.'; return; }
  if (r.skor < 0.8) { $('#e3').textContent = 'Wajah kurang jelas. Dekatkan wajah dan tambah cahaya.'; return; }
  S.desc.push(r.desc); titik();
  const vp = $('#vp'); vp.classList.add('sukses'); setTimeout(() => vp.classList.remove('sukses'), 500);
  if (S.desc.length < SUDUT.length) { $('#instr').textContent = SUDUT[S.desc.length]; return; }
  kirim();
};

async function kirim() {
  $('#b3').disabled = true; $('#instr').textContent = 'Memeriksa & menyimpan…';
  let maks = 0;
  for (let i = 0; i < S.desc.length; i++) for (let j = i + 1; j < S.desc.length; j++) maks = Math.max(maks, Wajah.jarak(S.desc[i], S.desc[j]));
  if (maks > 0.75) { S.desc = []; titik(); $('#e3').textContent = 'Hasil pemindaian tidak konsisten (mungkin ada wajah lain). Ulangi dari awal.'; $('#instr').textContent = SUDUT[0]; $('#b3').disabled = false; return; }
  const r = await api('daftar.simpan', { nis: S.nis, token: S.token, descriptors: S.desc, setuju: true });
  if (!r.success) { S.desc = []; titik(); $('#e3').textContent = r.message; $('#instr').textContent = SUDUT[0]; $('#b3').disabled = false; return; }
  Wajah.henti($('#cam'));
  $('#sukses').textContent = S.hasil.nama + ' • ' + S.hasil.kelas;
  langkah(4);
}
titik();
if (!configOk()) $('#e1').textContent = 'Aplikasi belum dikonfigurasi (GAS_URL kosong). Hubungi admin.';
})();
