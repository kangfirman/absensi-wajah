# Absensi Wajah Siswa

Frontend statis (GitHub Pages) untuk sistem absensi wajah. Backend: Google Apps Script + Google Sheets (berkas `Kode.gs`, **tidak** disertakan di repo ini).

- `index.html` — halaman pilihan peran
- `daftar.html` — pendaftaran wajah siswa (ponsel)
- `admin.html` — portal guru: dashboard, absen wajah, data siswa, rekap, pengaturan
- `js/config.js` — isi `GAS_URL` (URL `/exec`)

Panduan lengkap: `PANDUAN-INSTALASI.md`. Pengenalan wajah berjalan sepenuhnya di browser (face-api.js); server hanya menyimpan angka pemetaan wajah, bukan foto.
