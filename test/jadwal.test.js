import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hariIniWIB, jatuhTempoBerikutnya, selisihHari, statusUrusan, tahapPengingat, tambahBulan, tanggalValid,
} from '../public/js/jadwal.js';
import { buatKalender } from '../src/kalender.js';

test('tanggal berikutnya dihitung dari jatuh tempo lama', () => {
  assert.equal(jatuhTempoBerikutnya({ ulang: 'tahun', interval: 1, jatuh_tempo: '2026-03-10' }), '2027-03-10');
  assert.equal(jatuhTempoBerikutnya({ ulang: 'tahun', interval: 5, jatuh_tempo: '2026-03-10' }), '2031-03-10');
  assert.equal(jatuhTempoBerikutnya({ ulang: 'bulan', interval: 1, jatuh_tempo: '2026-12-20' }), '2027-01-20');
  assert.equal(jatuhTempoBerikutnya({ ulang: 'bulan', interval: 6, jatuh_tempo: '2026-09-15' }), '2027-03-15');
  assert.equal(jatuhTempoBerikutnya({ ulang: 'manual', interval: 1, jatuh_tempo: '2026-03-10' }), null);
});

test('akhir bulan tidak melorot permanen', () => {
  const feb = tambahBulan('2026-01-31', 1, 31);
  assert.equal(feb, '2026-02-28');
  assert.equal(tambahBulan(feb, 1, 31), '2026-03-31');
  assert.equal(tambahBulan('2028-02-29', 12, 29), '2029-02-28');
  assert.equal(tambahBulan('2029-02-28', 12, 29), '2030-02-28');
  assert.equal(tambahBulan('2031-02-28', 12, 29), '2032-02-29');
});

test('tahap pengingat mengikuti "mulai urus"', () => {
  const hari = (n) => tahapPengingat(n).map((t) => t.hari);
  assert.deepEqual(hari(180), [180, 14, 7, 1, 0]);
  assert.deepEqual(hari(60), [60, 14, 7, 1, 0]);
  assert.deepEqual(hari(14), [14, 7, 1, 0]);
  assert.deepEqual(hari(5), [5, 1, 0]);
  assert.deepEqual(hari(1), [1, 0]);
  assert.equal(tahapPengingat(14)[0].jenis, 'mulai');
  assert.equal(tahapPengingat(5).at(-1).jenis, 'hari-h');
});

test('status dashboard', () => {
  const u = { jatuh_tempo: '2026-11-01', mulai_urus: 5 };
  assert.equal(statusUrusan(u, '2026-10-20').kode, 'aman');
  assert.equal(statusUrusan(u, '2026-10-27').kode, 'urus');
  assert.equal(statusUrusan(u, '2026-11-01').kode, 'hari-ini');
  assert.deepEqual(statusUrusan(u, '2026-11-03'), { kode: 'telat', sisa: -2 });
});

test('hari ini memakai WIB', () => {
  // 23 Okt 2026 18.00 UTC = 24 Okt 01.00 WIB
  assert.equal(hariIniWIB(Date.UTC(2026, 9, 23, 18)), '2026-10-24');
  assert.equal(hariIniWIB(Date.UTC(2026, 9, 23, 16, 59)), '2026-10-23');
  assert.equal(selisihHari('2026-12-30', '2027-01-02'), 3);
});

test('validasi tanggal', () => {
  assert.ok(tanggalValid('2026-02-28'));
  assert.ok(!tanggalValid('2026-02-30'));
  assert.ok(!tanggalValid('10-03-2026'));
  assert.ok(!tanggalValid(undefined));
});

test('kalender per orang berisi urusannya + Berdua, jam 08.00 WIB dengan alarm', () => {
  const dasar = { mulai_urus: 5, ulang: 'bulan', interval: 1, catatan: '', diarsip: 0, diubah_pada: '2026-10-01T00:00:00.000Z' };
  const daftar = [
    { ...dasar, id: 'a', judul: 'PAM', pemilik: 'D', jatuh_tempo: '2026-11-20' },
    { ...dasar, id: 'b', judul: 'Internet, rumah', pemilik: 'B', jatuh_tempo: '2026-11-25' },
    { ...dasar, id: 'c', judul: 'Kartu kredit Irna', pemilik: 'I', jatuh_tempo: '2026-11-18' },
  ];
  const ics = buatKalender('D', daftar, 'https://contoh.workers.dev/', '2026-10-23T11:00:00.000Z');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /X-WR-CALNAME:Jatuh Tempo – Diego/);
  assert.ok(ics.includes('[D] Mulai urus (5 hari lagi): PAM'));
  assert.ok(ics.includes('[B] Jatuh tempo hari ini: Internet\\, rumah'));
  assert.ok(!ics.includes('Kartu kredit Irna'));
  assert.ok(ics.includes('DTSTART:20261115T010000Z')); // 20 Nov - 5 hari, 08.00 WIB
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6); // 2 urusan × (5, 1, H)
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 6);
  for (const baris of ics.split('\r\n')) assert.ok(new TextEncoder().encode(baris).length <= 75, baris);

  const irna = buatKalender('I', daftar, 'https://contoh.workers.dev/', '2026-10-23T11:00:00.000Z');
  assert.ok(irna.includes('Kartu kredit Irna'));
  assert.ok(!irna.includes(': PAM'));
});
