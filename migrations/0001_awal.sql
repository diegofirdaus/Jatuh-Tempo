-- Urusan keluarga (tagihan & dokumen berkala)
CREATE TABLE urusan (
  id TEXT PRIMARY KEY,
  judul TEXT NOT NULL,
  pemilik TEXT NOT NULL CHECK (pemilik IN ('D', 'I', 'B')),
  jatuh_tempo TEXT NOT NULL,            -- YYYY-MM-DD
  tanggal_patokan INTEGER,              -- tanggal asli (1-31) agar 31 Jan → 28 Feb → 31 Mar
  ulang TEXT NOT NULL CHECK (ulang IN ('bulan', 'tahun', 'manual')),
  interval INTEGER NOT NULL DEFAULT 1,
  mulai_urus INTEGER NOT NULL DEFAULT 14,
  catatan TEXT NOT NULL DEFAULT '',
  diarsip INTEGER NOT NULL DEFAULT 0,
  dibuat_oleh TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);
CREATE INDEX urusan_aktif ON urusan (diarsip, jatuh_tempo);

-- Riwayat "tandai selesai" beserta catatan bukti
CREATE TABLE selesai (
  id TEXT PRIMARY KEY,
  urusan_id TEXT NOT NULL REFERENCES urusan (id),
  jatuh_tempo TEXT NOT NULL,            -- jatuh tempo yang diselesaikan
  selesai_pada TEXT NOT NULL,
  oleh TEXT NOT NULL,
  bukti TEXT NOT NULL DEFAULT ''
);
CREATE INDEX selesai_urusan ON selesai (urusan_id, selesai_pada);

-- Token rahasia untuk link langganan kalender per orang
CREATE TABLE kalender (
  orang TEXT PRIMARY KEY CHECK (orang IN ('D', 'I')),
  token TEXT NOT NULL UNIQUE
);
