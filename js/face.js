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
