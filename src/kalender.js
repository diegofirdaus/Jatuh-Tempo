// Feed kalender .ics untuk Apple Calendar & Google Calendar.
// Tiap tahap pengingat jadi event 15 menit jam 08.00 WIB dengan alarm.

import { tahapPengingat, tambahHari, teksUlang, ORANG } from '../public/js/jadwal.js';

function escapeTeks(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Baris iCalendar maksimal 75 oktet; lanjutan diawali spasi.
function lipat(baris) {
  const bytes = new TextEncoder().encode(baris);
  if (bytes.length <= 75) return baris;
  const hasil = [];
  let sisa = baris;
  let batas = 75;
  while (new TextEncoder().encode(sisa).length > batas) {
    let potong = batas;
    while (new TextEncoder().encode(sisa.slice(0, potong)).length > batas) potong--;
    hasil.push(sisa.slice(0, potong));
    sisa = sisa.slice(potong);
    batas = 74; // satu oktet dipakai spasi awal
  }
  hasil.push(sisa);
  return hasil.join('\r\n ');
}

// 08.00 WIB = 01.00 UTC pada tanggal yang sama.
function jamDelapanWIB(tgl) {
  return `${tgl.replace(/-/g, '')}T010000Z`;
}

function cap(isoString) {
  return isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function judulTahap(tahap, judul) {
  if (tahap.jenis === 'hari-h') return `Jatuh tempo hari ini: ${judul}`;
  if (tahap.jenis === 'mulai') return `Mulai urus (${tahap.hari} hari lagi): ${judul}`;
  return `${tahap.hari} hari lagi: ${judul}`;
}

export function buatKalender(orang, daftarUrusan, urlAplikasi, sekarangIso) {
  const nama = ORANG[orang].nama;
  const baris = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jatuh Tempo Keluarga//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeTeks(`Jatuh Tempo – ${nama}`)}`,
    'X-WR-TIMEZONE:Asia/Jakarta',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  const stamp = cap(sekarangIso);

  for (const u of daftarUrusan) {
    if (u.diarsip || !(u.pemilik === orang || u.pemilik === 'B')) continue;
    for (const tahap of tahapPengingat(u.mulai_urus)) {
      const tgl = tambahHari(u.jatuh_tempo, -tahap.hari);
      const deskripsi = [
        `Jatuh tempo: ${u.jatuh_tempo}`,
        `Penanggung jawab: ${ORANG[u.pemilik].nama}`,
        teksUlang(u),
        u.catatan ? `Catatan: ${u.catatan}` : '',
        `Tandai selesai di ${urlAplikasi}`,
      ].filter(Boolean).join('\n');
      baris.push(
        'BEGIN:VEVENT',
        // UID memuat jatuh tempo, jadi setelah ditandai selesai event lama hilang dan yang baru muncul.
        `UID:${u.id}-${u.jatuh_tempo}-${tahap.hari}@jatuh-tempo`,
        `DTSTAMP:${stamp}`,
        `LAST-MODIFIED:${cap(u.diubah_pada)}`,
        `DTSTART:${jamDelapanWIB(tgl)}`,
        'DURATION:PT15M',
        `SUMMARY:${escapeTeks(`[${ORANG[u.pemilik].inisial}] ${judulTahap(tahap, u.judul)}`)}`,
        `DESCRIPTION:${escapeTeks(deskripsi)}`,
        `URL:${urlAplikasi}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeTeks(judulTahap(tahap, u.judul))}`,
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  baris.push('END:VCALENDAR');
  return baris.map(lipat).join('\r\n') + '\r\n';
}
