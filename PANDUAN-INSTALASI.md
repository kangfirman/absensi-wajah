# Panduan Instalasi — Absensi Wajah Siswa

Arsitektur: **Backend = Google Apps Script (API JSON + Google Sheets)** · **Frontend = GitHub Pages (HTML/CSS/JS)**.
Kerjakan berurutan: A (backend) → B (Client ID login) → C (frontend) → D (uji coba).

---

## A. Backend — Google Apps Script

1. Buka https://script.google.com → **Proyek baru**.
2. Ganti nama berkas `Code.gs` menjadi `Kode`, hapus isinya, lalu tempel seluruh isi berkas **Kode.gs**. Simpan (Ctrl+S).
3. Jalankan setup **SEKALI**: dropdown fungsi → `setupAppEnvironment` → ▶ **Run** → *Review permissions* → pilih akun → *Lanjutan* → *Buka … (tidak aman)* → **Izinkan**.
4. Buka **Execution log** dan **catat sandi akses darurat** (muncul sekali):
   ```
   Nama pengguna : darurat
   Kata sandi    : (16 karakter acak)
   ```
5. Cek Google Drive: folder **📁 Absensi Wajah Siswa** berisi spreadsheet **🗃️ Database**. Akun yang menjalankan setup otomatis menjadi **admin pertama**.
6. **Deploy → Deployment baru → ⚙ Aplikasi web**:
   - Execute as: **Me** · Who has access: **Anyone** → **Deploy**
   - **Salin URL berakhiran `/exec`.**
7. Uji: buka `URL/exec` di browser → harus tampil JSON `{"success":true,...,"siap":true}`.

> Setiap mengubah `Kode.gs` setelah ini: **Deploy → Kelola deployment → ✏ → Versi baru → Deploy** (URL tetap sama).
> Zona waktu bawaan WIB. Di luar WIB: ⚙ Setelan proyek → Script Properties → tambah `ZONA_WAKTU` = `Asia/Makassar` / `Asia/Jayapura`.

## B. Login Google (OAuth Client ID)

Dibutuhkan agar guru bisa masuk dengan akun Google. (Tanpa ini Anda tetap bisa masuk lewat akses darurat.)

1. https://console.cloud.google.com → buat proyek baru.
2. **APIs & Services → OAuth consent screen** → pilih *External* (atau *Internal* jika akun Google Workspace sekolah) → isi nama aplikasi & email → simpan. Klik **Publish app** (agar semua guru bisa masuk; cakupan dasar email/profil tidak perlu verifikasi). Jika tetap *Testing*, tambahkan email guru di **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins** → tambahkan `https://USERNAME.github.io` (tanpa garis miring di akhir dan tanpa nama repo).
5. Salin **Client ID** (`…apps.googleusercontent.com`).
6. Isi Client ID lewat aplikasi (langkah D3), atau manual: Apps Script → ⚙ Setelan proyek → **Script Properties** → tambah `GOOGLE_CLIENT_ID`.

## C. Frontend — GitHub Pages

**Folder kerja = isi ZIP yang diekstrak (folder `absensi-wajah-siswa`).** Di dalamnya langsung ada `index.html`, `css/`, `js/`. Folder inilah yang di-`git init` — jangan masuk lebih dalam, jangan naik satu level.

1. Edit **`js/config.js`**: ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL `/exec` dari langkah A6.
2. Buat akun GitHub, lalu repository **Public** baru (jangan centang README/.gitignore/license).
3. Buka terminal **di folder kerja** (Windows: buka folder di File Explorer → klik address bar → ketik `powershell` → Enter). Pastikan `dir` / `ls` menampilkan `index.html` di baris atas.
4. Jalankan satu per satu:
   ```bash
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (GitHub → Settings → Developer settings → Tokens (classic) → scope **repo**). Layar terlihat kosong saat tempel — itu normal.
5. Repo → **Settings → Pages** → Source: *Deploy from a branch* → **main / (root)** → Save. Centang **Enforce HTTPS** (wajib untuk kamera).
6. Tunggu 1–2 menit → buka `https://USERNAME.github.io/NAMA-REPO/`.

Update berikutnya: `git add .` → `git commit -m "pesan"` → `git push`, lalu Ctrl+Shift+R.

## D. Uji coba

1. Buka `…/admin.html#darurat` → masuk dengan akun **darurat** (sandi dari langkah A4).
2. **Pengaturan → Keamanan**: tempel **Client ID** → Simpan. Lalu **ganti kata sandi darurat** (min. 12 karakter).
3. Muat ulang `admin.html` → masuk dengan tombol **Google** (akun yang menjalankan setup).
4. **Pengaturan**: atur nama sekolah, jam masuk, toleransi; tambahkan email guru lain.
5. **Data Siswa**: hapus 3 siswa contoh, lalu **Import** daftar siswa (CSV/Excel: NIS, Nama, Kelas, Nomor Wali).
6. **Pengaturan → Link Pendaftaran**: salin link kelas → bagikan ke siswa (dibuka di ponsel).
7. Setelah beberapa siswa mendaftar, buka **Absen Wajah** → pilih kelas → **Mulai Sesi**.

## Keamanan & rahasia

| Disimpan di Script Properties (bukan di kode/Sheets/frontend) | Keterangan |
|---|---|
| `SESSION_SECRET`, `EMERGENCY_*` | dibuat otomatis oleh setup |
| `GOOGLE_CLIENT_ID` | diisi lewat Pengaturan atau manual |
| `TOKEN_KELAS` | token pendaftaran tiap kelas; hanya admin yang dapat melihat |
| `SPREADSHEET_ID`, `DRIVE_ROOT_FOLDER_ID` | otomatis |

- Frontend hanya memegang URL `/exec` (memang publik).
- Jangan bagikan spreadsheet database dan jangan menambah editor proyek Apps Script sembarangan (editor bisa melihat Script Properties).
- Sheet **Wajah** berisi angka pemetaan wajah (bukan foto). Batasi akses spreadsheet hanya untuk admin tepercaya.

## Troubleshooting

| Gejala | Solusi |
|---|---|
| "Konfigurasi belum lengkap" | `js/config.js` belum diisi URL `/exec`, lalu push ulang |
| Halaman 404 | `index.html` tidak di root repo → lihat langkah C3 (folder salah di-push) |
| Tanpa styling / CSS 404 | Folder `css/` & `js/` tidak ikut → push dari terminal, bukan upload web |
| Tombol Google tidak muncul | Client ID belum diisi, atau origin `https://USERNAME.github.io` belum didaftarkan |
| "Akun … tidak terdaftar sebagai admin" | Tambahkan email di Pengaturan → Daftar Admin (masuk via akses darurat) |
| Kamera tidak menyala | Izinkan kamera di browser; pastikan URL **https** (bukan file://) |
| "Wajah tidak dikenali" terus | Perbaiki cahaya; naikkan ambang (mis. 0.55) atau pakai absen manual |
| Salah mengenali siswa lain | Turunkan ambang (mis. 0.45) dan minta siswa daftar ulang di cahaya baik |
| Perubahan backend tidak berlaku | Deploy **Versi baru** (langkah A, catatan di bawah) |
| Akses darurat terkunci | Tunggu 15 menit, atau jalankan `resetAksesDarurat()` dari editor Apps Script |

## Batasan yang perlu diketahui

- Tidak ada **deteksi kehidupan (liveness)**: foto wajah di layar ponsel berpotensi dikenali. Karena siswa absen satu per satu di depan guru, pengawasan guru adalah pengamannya.
- Model pengenalan wajah (±12 MB) diunduh dari CDN saat pertama kali dibuka lalu di-cache browser.
- Kuota Apps Script jauh di atas kebutuhan 50–100 siswa per hari.
