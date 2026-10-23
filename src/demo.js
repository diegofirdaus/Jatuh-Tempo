// Data contoh untuk ruang demo (penguji). Tanggal relatif terhadap hari ini,
// jadi selalu ada urusan yang terlambat, perlu diurus, dan aman.

import { hariIniWIB, tambahBulan, tambahHari } from '../public/js/jadwal.js';

export const RUANG_DEMO = 'demo';
export const BATAS_URUSAN_DEMO = 60;

const CONTOH_DEMO = [
  { judul: 'Internet rumah', pemilik: 'B', ulang: 'bulan', interval: 1, mulai_urus: 5, geser: -2, catatan: 'No. pelanggan 1220-4471' },
  { judul: 'Tagihan kartu kredit BCA', pemilik: 'I', ulang: 'manual', interval: 1, mulai_urus: 7, geser: 3, catatan: 'Tanggal jatuh tempo berubah tiap bulan, lihat di lembar tagihan.' },
  { judul: 'Tagihan PAM', pemilik: 'D', ulang: 'bulan', interval: 1, mulai_urus: 5, geser: 4, riwayat: 'Transfer BCA mobile, ref 551020' },
  { judul: 'Pajak tahunan STNK Avanza', pemilik: 'D', ulang: 'tahun', interval: 1, mulai_urus: 30, geser: 20, catatan: 'Bayar lewat Samsat digital (SIGNAL).' },
  { judul: 'Perpanjang paspor Irna', pemilik: 'I', ulang: 'tahun', interval: 10, mulai_urus: 180, geser: 150 },
  { judul: 'Iuran BPJS Kesehatan', pemilik: 'B', ulang: 'bulan', interval: 1, mulai_urus: 5, geser: 18, riwayat: 'Autodebet gagal, bayar manual via Tokopedia' },
  { judul: 'Perpanjang SIM A Diego', pemilik: 'D', ulang: 'tahun', interval: 5, mulai_urus: 60, geser: 95 },
  { judul: 'PBB rumah', pemilik: 'B', ulang: 'tahun', interval: 1, mulai_urus: 30, geser: 240 },
];

// Menghapus isi ruang demo lalu mengisinya lagi dengan data contoh.
export async function isiUlangDemo(env) {
  const hariIni = hariIniWIB();
  const kini = new Date().toISOString();
  const perintah = [
    env.DB.prepare('DELETE FROM selesai WHERE urusan_id IN (SELECT id FROM urusan WHERE ruang = ?)').bind(RUANG_DEMO),
    env.DB.prepare('DELETE FROM urusan WHERE ruang = ?').bind(RUANG_DEMO),
  ];
  for (const c of CONTOH_DEMO) {
    const id = crypto.randomUUID();
    const jatuhTempo = tambahHari(hariIni, c.geser);
    perintah.push(env.DB.prepare(
      `INSERT INTO urusan (id, ruang, judul, pemilik, jatuh_tempo, tanggal_patokan, ulang, interval, mulai_urus, catatan,
         dibuat_oleh, diubah_oleh, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, RUANG_DEMO, c.judul, c.pemilik, jatuhTempo, Number(jatuhTempo.slice(8, 10)), c.ulang, c.interval,
      c.mulai_urus, c.catatan || '', 'D', 'D', kini, kini));
    if (c.riwayat) {
      // Satu periode sebelumnya sudah diselesaikan, supaya riwayat & catatan bukti bisa dilihat.
      const jtLalu = tambahBulan(jatuhTempo, -c.interval, Number(jatuhTempo.slice(8, 10)));
      perintah.push(env.DB.prepare(
        'INSERT INTO selesai (id, urusan_id, jatuh_tempo, selesai_pada, oleh, bukti) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), id, jtLalu, `${tambahHari(jtLalu, -2)}T03:00:00.000Z`, c.pemilik === 'I' ? 'I' : 'D', c.riwayat));
    }
  }
  await env.DB.batch(perintah);
}

export async function pastikanDemoTerisi(env) {
  const ada = await env.DB.prepare('SELECT COUNT(*) AS n FROM urusan WHERE ruang = ? AND diarsip = 0').bind(RUANG_DEMO).first();
  if (!ada?.n) await isiUlangDemo(env);
}
