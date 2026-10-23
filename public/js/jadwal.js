// Logika jadwal yang dipakai bersama oleh Worker (server) dan aplikasi (browser).
// Semua tanggal berbentuk string "YYYY-MM-DD" dan dihitung dalam zona WIB (UTC+7, tanpa DST).

export const ORANG = {
  D: { nama: 'Diego', inisial: 'D' },
  I: { nama: 'Irna', inisial: 'I' },
  B: { nama: 'Berdua', inisial: 'B' },
};

// Tahapan tetap sebelum jatuh tempo; "mulai urus" ditambahkan per urusan.
export const TAHAP_TETAP = [14, 7, 1];

const WIB_MS = 7 * 60 * 60 * 1000;

export function hariIniWIB(now = Date.now()) {
  return new Date(now + WIB_MS).toISOString().slice(0, 10);
}

function keUTC(tgl) {
  const [y, m, d] = tgl.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function dariUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function tambahHari(tgl, n) {
  return dariUTC(keUTC(tgl) + n * 86400000);
}

export function selisihHari(dari, ke) {
  return Math.round((keUTC(ke) - keUTC(dari)) / 86400000);
}

export function tanggalValid(tgl) {
  if (typeof tgl !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return false;
  return dariUTC(keUTC(tgl)) === tgl;
}

// Tambah n bulan, memakai "tanggal patokan" supaya 31 Jan → 28 Feb → 31 Mar (tidak melorot ke 28).
export function tambahBulan(tgl, n, tanggalPatokan) {
  const [y, m, d] = tgl.split('-').map(Number);
  const patokan = tanggalPatokan || d;
  const total = (m - 1) + n;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const akhirBulan = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return dariUTC(Date.UTC(ty, tm, Math.min(patokan, akhirBulan)));
}

// Jatuh tempo berikutnya, dihitung dari jatuh tempo lama (bukan dari tanggal bayar).
// Mengembalikan null untuk urusan "manual" (mis. kartu kredit): pengguna mengisi sendiri.
export function jatuhTempoBerikutnya(urusan) {
  const n = Math.max(1, Number(urusan.interval) || 1);
  if (urusan.ulang === 'bulan') return tambahBulan(urusan.jatuh_tempo, n, urusan.tanggal_patokan);
  if (urusan.ulang === 'tahun') return tambahBulan(urusan.jatuh_tempo, n * 12, urusan.tanggal_patokan);
  return null;
}

// Daftar pengingat: mulai urus → 14 → 7 → 1 hari → hari H.
// Tahap tetap yang lebih jauh dari "mulai urus" dilewati (PAM 5 hari → 5, 1, H).
export function tahapPengingat(mulaiUrus) {
  const lead = Math.max(0, Number(mulaiUrus) || 0);
  const hari = new Set([lead, ...TAHAP_TETAP.filter((h) => h <= lead), 0]);
  return [...hari].sort((a, b) => b - a).map((h) => ({
    hari: h,
    jenis: h === 0 ? 'hari-h' : h === lead ? 'mulai' : 'tahap',
  }));
}

// Status untuk dashboard.
export function statusUrusan(urusan, hariIni) {
  const sisa = selisihHari(hariIni, urusan.jatuh_tempo);
  if (sisa < 0) return { kode: 'telat', sisa };
  if (sisa === 0) return { kode: 'hari-ini', sisa };
  if (sisa <= Number(urusan.mulai_urus)) return { kode: 'urus', sisa };
  return { kode: 'aman', sisa };
}

export function teksUlang(urusan) {
  const n = Number(urusan.interval) || 1;
  if (urusan.ulang === 'bulan') return n === 1 ? 'Tiap bulan' : `Tiap ${n} bulan`;
  if (urusan.ulang === 'tahun') return n === 1 ? 'Tiap tahun' : `Tiap ${n} tahun`;
  return 'Tanggal diisi tiap kali';
}

// Contoh urusan siap pakai. ulang: 'bulan' | 'tahun' | 'manual'.
export const CONTOH = [
  {
    kelompok: 'Kendaraan',
    daftar: [
      { judul: 'Pajak tahunan STNK', ulang: 'tahun', interval: 1, mulai_urus: 30, catatan: 'Bawa KTP & STNK, atau bayar lewat Samsat digital.' },
      { judul: 'Ganti plat & STNK 5 tahunan', ulang: 'tahun', interval: 5, mulai_urus: 60, catatan: 'Wajib cek fisik kendaraan di Samsat.' },
      { judul: 'Perpanjang SIM', ulang: 'tahun', interval: 5, mulai_urus: 60, catatan: 'Berlaku sampai tanggal di kartu SIM.' },
      { judul: 'Servis berkala mobil', ulang: 'bulan', interval: 6, mulai_urus: 14 },
      { judul: 'Asuransi kendaraan', ulang: 'tahun', interval: 1, mulai_urus: 30 },
    ],
  },
  {
    kelompok: 'Rumah & utilitas',
    daftar: [
      { judul: 'Tagihan PAM', ulang: 'bulan', interval: 1, mulai_urus: 5 },
      { judul: 'Listrik PLN pascabayar', ulang: 'bulan', interval: 1, mulai_urus: 5 },
      { judul: 'Internet rumah', ulang: 'bulan', interval: 1, mulai_urus: 5 },
      { judul: 'PBB rumah', ulang: 'tahun', interval: 1, mulai_urus: 30 },
      { judul: 'IPL / iuran lingkungan', ulang: 'bulan', interval: 1, mulai_urus: 5 },
    ],
  },
  {
    kelompok: 'Keuangan',
    daftar: [
      { judul: 'Tagihan kartu kredit', ulang: 'manual', interval: 1, mulai_urus: 7, catatan: 'Tanggal jatuh tempo berubah tiap bulan, lihat di lembar tagihan.' },
      { judul: 'Cicilan', ulang: 'bulan', interval: 1, mulai_urus: 5 },
      { judul: 'Premi asuransi jiwa / kesehatan', ulang: 'tahun', interval: 1, mulai_urus: 30 },
      { judul: 'Iuran BPJS Kesehatan', ulang: 'bulan', interval: 1, mulai_urus: 5, catatan: 'Paling lambat tanggal 10 tiap bulan.' },
    ],
  },
  {
    kelompok: 'Dokumen pribadi',
    daftar: [
      { judul: 'Perpanjang paspor', ulang: 'tahun', interval: 10, mulai_urus: 180, catatan: 'Banyak negara minta paspor berlaku minimal 6 bulan.' },
      { judul: 'Visa / izin tinggal', ulang: 'manual', interval: 1, mulai_urus: 60 },
      { judul: 'Perbarui data KTP / KK', ulang: 'manual', interval: 1, mulai_urus: 30, catatan: 'Mis. setelah pindah alamat atau anggota keluarga bertambah.' },
    ],
  },
];
