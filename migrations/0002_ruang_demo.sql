-- Ruang data: 'keluarga' (data asli) atau 'demo' (data contoh untuk penguji). Keduanya tidak saling terlihat.
ALTER TABLE urusan ADD COLUMN ruang TEXT NOT NULL DEFAULT 'keluarga';
CREATE INDEX urusan_ruang ON urusan (ruang, diarsip, jatuh_tempo);

-- Link kalender kini per ruang + orang. Token lama dipertahankan supaya langganan yang sudah terpasang tetap jalan.
CREATE TABLE kalender_baru (
  ruang TEXT NOT NULL DEFAULT 'keluarga',
  orang TEXT NOT NULL CHECK (orang IN ('D', 'I')),
  token TEXT NOT NULL UNIQUE,
  PRIMARY KEY (ruang, orang)
);
INSERT INTO kalender_baru (ruang, orang, token) SELECT 'keluarga', orang, token FROM kalender;
DROP TABLE kalender;
ALTER TABLE kalender_baru RENAME TO kalender;
