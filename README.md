# Jatuh Tempo

Pengingat jatuh tempo keluarga: tagihan dan dokumen berkala (pajak mobil, PAM, internet, kartu kredit, SIM, paspor, servis, asuransi) dalam satu dashboard yang terlihat berdua, dengan pengingat bertahap di Apple Calendar dan Google Calendar.

Latar belakang & ruang lingkup: [docs/one-pager.md](docs/one-pager.md).

## Fitur

- **Dashboard bersama**: Diego dan Irna melihat data yang sama; perubahan dari HP lain muncul dalam ±15 detik.
- **Tambah dari contoh siap pakai**: kendaraan, rumah & utilitas, keuangan, dokumen pribadi, masing-masing dengan jarak "mulai urus" sendiri (paspor 180 hari, SIM 60 hari, PAM 5 hari).
- **Pengingat kalender bertahap**: mulai urus → 14 → 7 → 1 hari → hari H, jam 08.00 WIB dengan alarm. Tahap yang lebih jauh dari "mulai urus" dilewati.
- **Link kalender per orang**: kalender Diego = urusan Diego + Berdua; kalender Irna = urusan Irna + Berdua.
- **Warna & inisial per orang** (D biru, I merah muda, B ungu) plus penyaring cepat.
- **Tanggal berubah-ubah** (kartu kredit): setelah selesai, aplikasi menanyakan tanggal berikutnya.
- **Tandai selesai + catatan bukti**; tanggal berikutnya dihitung dari jatuh tempo lama, riwayat tersimpan.
- **Mode demo untuk penguji**: tombol "Coba demo sebagai Diego/Irna" di layar login, tanpa akun. Data contoh disimpan di ruang terpisah (`ruang = 'demo'`) sehingga data keluarga asli tidak terlihat; tombol "Kembalikan data contoh" mengisi ulang. Matikan dengan `DEMO = "0"`.
- **Bahasa Indonesia sederhana**. Semua teks ada di `public/js/teks.js` (English menyusul di v2).

## Susunan

| Bagian | Isi |
|---|---|
| `src/worker.js` | Cloudflare Worker: API, login, feed kalender |
| `src/auth.js` | Verifikasi login Google + cookie sesi |
| `src/kalender.js` | Pembuat feed `.ics` |
| `public/` | Aplikasi (PWA) tanpa build step |
| `public/js/jadwal.js` | Logika tanggal & tahap pengingat (dipakai server dan browser) |
| `src/demo.js` | Data contoh untuk mode demo |
| `migrations/` | Skema database D1 |
| `test/` | Tes logika tanggal & kalender (`npm test`) |

## Menjalankan di komputer sendiri

```bash
npm install
cat > .dev.vars <<'EOF'
SESSION_SECRET="string-acak-panjang"
ALLOWED_EMAILS="D:diego.firdaus@gmail.com,I:budiarti.irna@gmail.com"
DEV_LOGIN="1"
EOF
npm run db:migrate:local
npm run dev        # buka http://localhost:8787
npm test
```

`DEV_LOGIN="1"` memunculkan tombol "Masuk sebagai Diego/Irna (mode uji)". **Jangan** pasang di server sungguhan.

## Deploy ke Cloudflare

Butuh `CLOUDFLARE_API_TOKEN` (izin *Workers Scripts: Edit* dan *D1: Edit*) dan `CLOUDFLARE_ACCOUNT_ID`.

1. Buat database, lalu salin `database_id` ke `wrangler.toml`:
   ```bash
   npx wrangler d1 create jatuh-tempo
   npm run db:migrate:remote
   ```
2. Simpan rahasia:
   ```bash
   openssl rand -base64 32 | npx wrangler secret put SESSION_SECRET
   echo "D:diego.firdaus@gmail.com,I:budiarti.irna@gmail.com" | npx wrangler secret put ALLOWED_EMAILS
   ```
3. Deploy: `npm run deploy`. Catat alamatnya, mis. `https://jatuh-tempo.<akun>.workers.dev`.
4. Login Google: di [Google Cloud Console](https://console.cloud.google.com/apis/credentials) buat **OAuth client ID** tipe *Web application*, isi **Authorized JavaScript origins** dengan alamat langkah 3 (tanpa garis miring di akhir). Redirect URI tidak perlu. Isi `GOOGLE_CLIENT_ID` di `wrangler.toml`, lalu `npm run deploy` lagi.

## Memasang di HP

1. Buka alamat aplikasi, masuk dengan Google.
2. **iPhone**: Safari → Share → *Add to Home Screen*. **Android**: Chrome → menu ⋮ → *Install app*.
3. Ketuk **Kalender HP** di aplikasi dan ikuti langkahnya:
   - **iPhone**: ketuk "Pasang di kalender HP ini" → Subscribe → **matikan "Remove Alerts"** → Auto-refresh tiap jam.
   - **Android**: pasang **ICSx⁵** (gratis, Play Store), tempel link kalender, sinkron tiap jam. Google Calendar langganan-URL biasa diperbarui hanya tiap 8–24 jam dan sering tidak membunyikan alarm.
