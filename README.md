# Absensi Wajah Siswa — versi Supabase

Frontend statis (GitHub Pages) + Supabase (Postgres + Auth). Tidak memakai Google Apps Script lagi.

- `index.html` — pilihan peran · `daftar.html` — pendaftaran wajah siswa · `absen.html` — absen mandiri HP siswa (PWA: `manifest.json`, `sw.js`, `icons/`, `js/pwa.js`) · `admin.html` — portal guru
- `js/config.js` — isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (kunci publik; jangan pernah kunci service_role/secret)

Panduan lengkap: `PANDUAN-SUPABASE.md`. Pencocokan wajah siswa (absen mandiri) dilakukan di database; data wajah tidak dikirim ke HP.
