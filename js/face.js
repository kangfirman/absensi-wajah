// Pengenalan wajah di browser (face-api.js). Server tidak pernah memproses gambar.
const FACE_LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

const Wajah = {
  siap: false,
  async muat(info) {
    if (this.siap) return;
    info && info('Memuat pustaka pengenalan wajah…');
    await muatSkrip(FACE_LIB);
    info && info('Memuat model (±12 MB, hanya sekali)…');
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    this.siap = true;
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
    return r ? { desc: Array.from(r.descriptor), skor: r.detection.score } : null;
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
