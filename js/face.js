// Pengenalan wajah di browser (face-api.js). Server tidak pernah memproses gambar.
// CACHE MODEL: pustaka + model (±12 MB) diunduh SEKALI lalu disimpan di Cache Storage browser,
// sehingga hari berikutnya dibuka dari penyimpanan HP (tanpa internet, hitungan detik).
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/';
const FACE_LIB = CDN_BASE + 'dist/face-api.js';
const MODEL_URL = CDN_BASE + 'model/';
const CACHE_MODEL = 'absensi-model-v1';   // naikkan angkanya jika versi model/pustaka diganti

// Semua permintaan ke CDN_BASE (pustaka & berkas model, termasuk yang diminta TensorFlow.js) -> cache-first.
// Permintaan lain (mis. ke Apps Script) diteruskan apa adanya.
const _fetchAsli = window.fetch.bind(window);
async function fetchCache(url) {
  try {
    if (!('caches' in window)) throw new Error('no-cache-api');
    const c = await caches.open(CACHE_MODEL), hit = await c.match(url);
    if (hit) { Wajah.dariCache++; return hit; }
    const r = await _fetchAsli(url, { mode: 'cors' });
    if (r.ok) { Wajah.jaringan++; await c.put(url, r.clone()); }
    return r;
  } catch (e) { return _fetchAsli(url); }
}
window.fetch = function (u, o) {
  const url = typeof u === 'string' ? u : (u && u.url);
  return url && url.indexOf(CDN_BASE) === 0 ? fetchCache(url) : _fetchAsli(u, o);
};
try { if ('caches' in window) caches.keys().then(ks => ks.filter(k => k.indexOf('absensi-model-') === 0 && k !== CACHE_MODEL).forEach(k => caches.delete(k))); } catch (e) {}

// Pustaka dimuat lewat cache juga (lalu dijalankan sebagai skrip blob); bila gagal pakai <script> biasa
async function muatLib() {
  if (window.faceapi) return;
  try {
    const teks = await (await fetch(FACE_LIB)).text();
    await muatSkrip(URL.createObjectURL(new Blob([teks], { type: 'text/javascript' })));
    if (!window.faceapi) throw new Error('faceapi tidak tersedia');
  } catch (e) { await muatSkrip(FACE_LIB); }
}

const Wajah = {
  siap: false, jaringan: 0, dariCache: 0, ms: 0, info: null, _p: null,

  // Aman dipanggil berkali-kali / bersamaan: hanya satu proses muat yang berjalan
  muat(info) {
    if (this.siap) return Promise.resolve();
    if (info) this.info = info;
    if (!this._p) this._p = this._muat().catch(e => { this._p = null; throw e; });
    return this._p;
  },
  async _muat() {
    const say = t => { if (this.info) this.info(t); }, t0 = performance.now();
    say('Menyiapkan pengenalan wajah…');
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}  // minta agar cache tidak dihapus otomatis
    await muatLib();
    let n = 0; say('Memuat model 0/3…');
    await Promise.all([faceapi.nets.ssdMobilenetv1, faceapi.nets.faceLandmark68Net, faceapi.nets.faceRecognitionNet]
      .map(net => net.loadFromUri(MODEL_URL).then(() => say('Memuat model ' + (++n) + '/3…'))));   // 3 model diunduh/dibaca paralel
    if (faceapi.tf && faceapi.tf.ready) await faceapi.tf.ready();
    say('Pemanasan…'); await this.warm();
    this.siap = true; this.ms = Math.round(performance.now() - t0);
  },
  // Inferensi kosong agar shader WebGL terkompilasi sekarang, bukan saat siswa pertama difoto
  async warm() {
    try {
      const a = document.createElement('canvas'); a.width = a.height = 160; const g = a.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 160, 160);
      await faceapi.detectSingleFace(a, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }));
      const b = document.createElement('canvas'); b.width = b.height = 150;
      await faceapi.nets.faceLandmark68Net.detectLandmarks(b);
      await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(b);
    } catch (e) {}
  },
  async kamera(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Browser tidak mendukung kamera. Gunakan Chrome/Edge/Safari terbaru lewat HTTPS.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    return stream;
  },
  henti(video) {
    const st = video && video.srcObject;
    if (st) st.getTracks().forEach(function (t) { t.stop(); });
    if (video) video.srcObject = null;
  },
  async deteksi(video) {
    const r = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 })).withFaceLandmarks().withFaceDescriptor();
    if (!r) return null;
    const p = r.landmarks.positions, w = p[16].x - p[0].x;
    let ey = 0; for (let i = 36; i < 48; i++) ey += p[i].y; ey /= 12;
    const dagu = p[8].y - ey;
    return {
      desc: Array.from(r.descriptor), skor: r.detection.score,
      yaw: w > 0 ? (p[30].x - p[0].x) / w : 0.5,          // ~0.5 = menghadap lurus
      pitch: dagu > 0 ? (p[30].y - ey) / dagu : 0.5,      // dipakai relatif terhadap foto pertama
      lebar: video.videoWidth ? r.detection.box.width / video.videoWidth : 1,
      box: { x: r.detection.box.x, y: r.detection.box.y, w: r.detection.box.width, h: r.detection.box.height }
    };
  },
  jarak(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); },
  // Cocokkan dengan jarak TERDEKAT tiap siswa; tolak bila ambigu (dua siswa sama-sama dekat)
  cocok(desc, daftar, ambang) {
    let best = null, bestD = 9, kedua = 9;
    daftar.forEach(function (s) {
      let m = 9;
      s.desc.forEach(function (d) { const j = Wajah.jarak(desc, d); if (j < m) m = j; });
      if (m < bestD) { kedua = bestD; bestD = m; best = s; } else if (m < kedua) kedua = m;
    });
    if (!best || bestD > ambang) return null;
    if (kedua < 9 && kedua - bestD < 0.04) return null;
    return { siswa: best, jarak: bestD, akurasi: Math.round(Math.max(0, Math.min(1, 1 - bestD / (ambang * 2))) * 1000) / 10 };
  }
};
