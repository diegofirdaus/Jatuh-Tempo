// Jatuh Tempo Keluarga: API + feed kalender. File statis (aplikasi) dilayani dari folder public/.

import { bacaSesi, buatCookieSesi, daftarEmail, hapusCookieSesi, tokenAcak, verifikasiTokenGoogle } from './auth.js';
import { buatKalender } from './kalender.js';
import { hariIniWIB, jatuhTempoBerikutnya, tanggalValid } from '../public/js/jadwal.js';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function galat(pesan, status = 400) {
  return json({ galat: pesan }, status);
}

async function bacaJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function sekarang() {
  return new Date().toISOString();
}

// Memeriksa & merapikan isian urusan dari formulir. Mengembalikan { data } atau { galat }.
function rapikanUrusan(input) {
  const judul = String(input.judul || '').trim().slice(0, 120);
  if (!judul) return { galat: 'Nama urusan wajib diisi.' };
  if (!['D', 'I', 'B'].includes(input.pemilik)) return { galat: 'Pilih penanggung jawab.' };
  if (!tanggalValid(input.jatuh_tempo)) return { galat: 'Tanggal jatuh tempo tidak valid.' };
  if (!['bulan', 'tahun', 'manual'].includes(input.ulang)) return { galat: 'Pilih jadwal pengulangan.' };
  const interval = Math.round(Number(input.interval) || 1);
  if (interval < 1 || interval > 20) return { galat: 'Jarak pengulangan harus 1 sampai 20.' };
  const mulai = Math.round(Number(input.mulai_urus));
  if (!Number.isFinite(mulai) || mulai < 1 || mulai > 365) return { galat: '"Mulai urus" harus 1 sampai 365 hari sebelum jatuh tempo.' };
  return {
    data: {
      judul,
      pemilik: input.pemilik,
      jatuh_tempo: input.jatuh_tempo,
      tanggal_patokan: Number(input.jatuh_tempo.slice(8, 10)),
      ulang: input.ulang,
      interval,
      mulai_urus: mulai,
      catatan: String(input.catatan || '').trim().slice(0, 500),
    },
  };
}

async function daftarUrusan(env) {
  const { results: urusan } = await env.DB.prepare(
    'SELECT * FROM urusan WHERE diarsip = 0 ORDER BY jatuh_tempo, judul',
  ).all();
  const { results: terakhir } = await env.DB.prepare(
    `SELECT s.* FROM selesai s
     JOIN (SELECT urusan_id, MAX(selesai_pada) m FROM selesai GROUP BY urusan_id) t
       ON t.urusan_id = s.urusan_id AND t.m = s.selesai_pada`,
  ).all();
  const peta = Object.fromEntries(terakhir.map((s) => [s.urusan_id, s]));
  return urusan.map((u) => ({ ...u, terakhir_selesai: peta[u.id] || null }));
}

async function tokenKalender(env, orang) {
  const ada = await env.DB.prepare('SELECT token FROM kalender WHERE orang = ?').bind(orang).first();
  if (ada) return ada.token;
  const token = tokenAcak();
  await env.DB.prepare('INSERT OR IGNORE INTO kalender (orang, token) VALUES (?, ?)').bind(orang, token).run();
  return (await env.DB.prepare('SELECT token FROM kalender WHERE orang = ?').bind(orang).first()).token;
}

async function linkKalender(env, url) {
  const hasil = {};
  for (const orang of ['D', 'I']) {
    const token = await tokenKalender(env, orang);
    hasil[orang] = `webcal://${url.host}/kal/${token}.ics`;
  }
  return hasil;
}

async function api(request, env, url, orang) {
  const { pathname } = url;
  const metode = request.method;

  if (pathname === '/api/urusan' && metode === 'GET') {
    return json({ urusan: await daftarUrusan(env), hari_ini: hariIniWIB() });
  }

  if (pathname === '/api/urusan' && metode === 'POST') {
    const body = await bacaJson(request);
    if (!body) return galat('Data tidak terbaca.');
    const { data, galat: pesan } = rapikanUrusan(body);
    if (pesan) return galat(pesan);
    const id = crypto.randomUUID();
    const kini = sekarang();
    await env.DB.prepare(
      `INSERT INTO urusan (id, judul, pemilik, jatuh_tempo, tanggal_patokan, ulang, interval, mulai_urus, catatan,
         dibuat_oleh, diubah_oleh, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, data.judul, data.pemilik, data.jatuh_tempo, data.tanggal_patokan, data.ulang, data.interval,
      data.mulai_urus, data.catatan, orang, orang, kini, kini).run();
    return json({ id }, 201);
  }

  const cocok = /^\/api\/urusan\/([0-9a-f-]{36})(\/selesai|\/riwayat)?$/.exec(pathname);
  if (cocok) {
    const [, id, sub] = cocok;
    const urusan = await env.DB.prepare('SELECT * FROM urusan WHERE id = ? AND diarsip = 0').bind(id).first();
    if (!urusan) return galat('Urusan tidak ditemukan. Mungkin sudah dihapus dari HP lain.', 404);

    if (!sub && metode === 'PUT') {
      const body = await bacaJson(request);
      if (!body) return galat('Data tidak terbaca.');
      const { data, galat: pesan } = rapikanUrusan(body);
      if (pesan) return galat(pesan);
      await env.DB.prepare(
        `UPDATE urusan SET judul = ?, pemilik = ?, jatuh_tempo = ?, tanggal_patokan = ?, ulang = ?, interval = ?,
           mulai_urus = ?, catatan = ?, diubah_oleh = ?, diubah_pada = ? WHERE id = ?`,
      ).bind(data.judul, data.pemilik, data.jatuh_tempo, data.tanggal_patokan, data.ulang, data.interval,
        data.mulai_urus, data.catatan, orang, sekarang(), id).run();
      return json({ ok: true });
    }

    if (!sub && metode === 'DELETE') {
      await env.DB.prepare('UPDATE urusan SET diarsip = 1, diubah_oleh = ?, diubah_pada = ? WHERE id = ?')
        .bind(orang, sekarang(), id).run();
      return json({ ok: true });
    }

    if (sub === '/selesai' && metode === 'POST') {
      const body = await bacaJson(request);
      if (!body) return galat('Data tidak terbaca.');
      // Cegah dobel klik / dua HP menandai bersamaan: jatuh tempo yang dikirim harus masih yang sekarang.
      if (body.jatuh_tempo !== urusan.jatuh_tempo) {
        return galat('Urusan ini baru saja diperbarui dari HP lain. Coba lihat lagi.', 409);
      }
      let berikut = jatuhTempoBerikutnya(urusan);
      let arsipkan = false;
      if (urusan.ulang === 'manual') {
        if (body.berhenti) arsipkan = true;
        else if (!tanggalValid(body.jatuh_tempo_berikut)) return galat('Isi tanggal jatuh tempo berikutnya.');
        else if (body.jatuh_tempo_berikut <= urusan.jatuh_tempo) return galat('Tanggal berikutnya harus setelah jatuh tempo sekarang.');
        else berikut = body.jatuh_tempo_berikut;
      }
      const kini = sekarang();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO selesai (id, urusan_id, jatuh_tempo, selesai_pada, oleh, bukti) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), id, urusan.jatuh_tempo, kini, orang, String(body.bukti || '').trim().slice(0, 500)),
        arsipkan
          ? env.DB.prepare('UPDATE urusan SET diarsip = 1, diubah_oleh = ?, diubah_pada = ? WHERE id = ?').bind(orang, kini, id)
          : env.DB.prepare('UPDATE urusan SET jatuh_tempo = ?, diubah_oleh = ?, diubah_pada = ? WHERE id = ?').bind(berikut, orang, kini, id),
      ]);
      return json({ ok: true, jatuh_tempo_berikut: arsipkan ? null : berikut });
    }

    if (sub === '/riwayat' && metode === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM selesai WHERE urusan_id = ? ORDER BY selesai_pada DESC LIMIT 50')
        .bind(id).all();
      return json({ riwayat: results });
    }
  }

  if (pathname === '/api/kalender' && metode === 'GET') {
    return json({ link: await linkKalender(env, url) });
  }

  const reset = /^\/api\/kalender\/([DI])\/ganti$/.exec(pathname);
  if (reset && metode === 'POST') {
    await env.DB.prepare('DELETE FROM kalender WHERE orang = ?').bind(reset[1]).run();
    return json({ link: await linkKalender(env, url) });
  }

  return galat('Alamat tidak dikenal.', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/config') {
      return json({ google_client_id: env.GOOGLE_CLIENT_ID || '', dev_login: env.DEV_LOGIN === '1' });
    }

    if (pathname === '/api/masuk' && request.method === 'POST') {
      if (!env.SESSION_SECRET) return galat('Server belum diatur (SESSION_SECRET kosong).', 500);
      const body = await bacaJson(request);
      const izin = daftarEmail(env);
      let orang = null;
      if (env.DEV_LOGIN === '1' && (body?.dev === 'D' || body?.dev === 'I')) {
        orang = body.dev;
      } else {
        if (!env.GOOGLE_CLIENT_ID) return galat('Server belum diatur (GOOGLE_CLIENT_ID kosong).', 500);
        let email;
        try {
          email = await verifikasiTokenGoogle(body?.credential, env.GOOGLE_CLIENT_ID);
        } catch (e) {
          return galat(`Login Google gagal: ${e.message}`, 401);
        }
        orang = izin[email];
        if (!orang) return galat(`${email} tidak terdaftar. Aplikasi ini hanya untuk Diego dan Irna.`, 403);
      }
      return json({ orang }, 200, { 'set-cookie': await buatCookieSesi(orang, env) });
    }

    if (pathname === '/api/keluar' && request.method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': hapusCookieSesi() });
    }

    const kal = /^\/kal\/([A-Za-z0-9_-]{20,})\.ics$/.exec(pathname);
    if (kal) {
      const baris = await env.DB.prepare('SELECT orang FROM kalender WHERE token = ?').bind(kal[1]).first();
      if (!baris) return new Response('Link kalender tidak berlaku lagi.', { status: 404 });
      const isi = buatKalender(baris.orang, await daftarUrusan(env), `https://${url.host}/`, sekarang());
      return new Response(isi, {
        headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-cache' },
      });
    }

    if (pathname.startsWith('/api/')) {
      const orang = await bacaSesi(request, env);
      if (!orang) return galat('Silakan masuk dulu.', 401);
      if (pathname === '/api/saya') return json({ orang });
      return api(request, env, url, orang);
    }

    return env.ASSETS.fetch(request);
  },
};
