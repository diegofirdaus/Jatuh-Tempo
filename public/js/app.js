import { T } from './teks.js';
import { ORANG, CONTOH, hariIniWIB, jatuhTempoBerikutnya, statusUrusan, tahapPengingat, tambahHari, teksUlang } from './jadwal.js';

const SINKRON_MS = 15000;
const ANDROID = /Android/i.test(navigator.userAgent);
const ICSX_PLAY_STORE = 'https://play.google.com/store/apps/details?id=at.bitfire.icsdroid';

const keadaan = {
  orang: null,
  ruang: 'keluarga',
  urusan: [],
  hariIni: hariIniWIB(),
  filter: 'semua',
  offline: false,
};

const app = document.getElementById('app');
const lembar = document.getElementById('lembar');

// ---------- Bantuan ----------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function fmt(tgl, panjang = false) {
  return new Date(`${tgl}T00:00:00Z`).toLocaleDateString('id-ID', {
    weekday: panjang ? 'long' : 'short',
    day: 'numeric',
    month: panjang ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtWaktu(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

function inisial(o, besar = false) {
  return `<span class="inisial o-${o}${besar ? ' besar' : ''}" aria-hidden="true">${ORANG[o].inisial}</span>`;
}

function teksTahap(mulai) {
  return tahapPengingat(mulai)
    .map((t) => (t.hari === 0 ? 'hari H' : `${t.hari} hari`))
    .join(' → ');
}

let waktuToast;
function toast(pesan) {
  const el = document.getElementById('toast');
  el.textContent = pesan;
  el.hidden = false;
  clearTimeout(waktuToast);
  waktuToast = setTimeout(() => { el.hidden = true; }, 3200);
}

async function panggil(jalur, opsi = {}) {
  const res = await fetch(jalur, {
    ...opsi,
    headers: opsi.body ? { 'content-type': 'application/json' } : {},
    body: opsi.body ? JSON.stringify(opsi.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && jalur !== '/api/masuk') {
    keadaan.orang = null;
    tutupLembar();
    tampilMasuk(T.galatSesi);
    throw new Error(T.galatSesi);
  }
  if (!res.ok) throw new Error(data.galat || T.galatUmum);
  return data;
}

// ---------- Masuk ----------

async function tampilMasuk(pesanGalat = '') {
  let config = { google_client_id: '', dev_login: false, demo: false };
  try { config = await (await fetch('/api/config')).json(); } catch { /* tampilkan layar tanpa tombol */ }

  app.innerHTML = `
    <main class="masuk">
      <span class="bola bola-1" aria-hidden="true"></span>
      <span class="bola bola-2" aria-hidden="true"></span>
      <figure class="polaroid">
        <img src="/ikon/padel.webp" width="720" height="720" alt="Ilustrasi Diego dan Irna di lapangan padel">
        <figcaption>${esc(T.polaroid)}</figcaption>
      </figure>
      <div class="masuk-isi">
        <h1>Jatuh <em>Tempo</em></h1>
        <p class="masuk-sub">${esc(T.subjudulMasuk)}</p>
        ${pesanGalat ? `<p class="galat" role="alert">${esc(pesanGalat)}</p>` : ''}
        ${config.google_client_id ? '<div id="tombol-google" class="tombol-google"></div>' : `<p class="bantu">${esc(T.belumDiatur)}</p>`}
        ${config.dev_login ? `
          <button class="tombol kedua penuh" data-dev="D">${esc(T.masukUji('Diego'))}</button>
          <button class="tombol kedua penuh" data-dev="I">${esc(T.masukUji('Irna'))}</button>` : ''}
        ${config.demo ? `
          <section class="masuk-demo" aria-labelledby="judul-demo">
            <h2 id="judul-demo">${esc(T.demoJudul)}</h2>
            <div class="demo-pilih">
              <button class="demo-tombol o-D" data-demo="D"><span class="inisial" aria-hidden="true">D</span>${esc(T.masukDemo('Diego'))}</button>
              <button class="demo-tombol o-I" data-demo="I"><span class="inisial" aria-hidden="true">I</span>${esc(T.masukDemo('Irna'))}</button>
            </div>
            <p>${esc(T.demoIsi)}</p>
          </section>` : ''}
      </div>
    </main>`;

  app.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', () => masuk({ dev: b.dataset.dev })));
  app.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => masuk({ demo: b.dataset.demo })));

  if (config.google_client_id) {
    const pasang = () => {
      if (!window.google?.accounts?.id) return setTimeout(pasang, 150);
      window.google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: (r) => masuk({ credential: r.credential }),
        ux_mode: 'popup',
      });
      const wadah = document.getElementById('tombol-google');
      if (wadah) {
        window.google.accounts.id.renderButton(wadah, {
          theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id',
          width: Math.min(400, Math.round(wadah.getBoundingClientRect().width)),
        });
      }
    };
    pasang();
  }
}

async function masuk(body) {
  try {
    const { orang, ruang } = await panggil('/api/masuk', { method: 'POST', body });
    keadaan.orang = orang;
    keadaan.ruang = ruang;
    keadaan.filter = 'semua';
    await muat();
  } catch (e) {
    tampilMasuk(e.message);
  }
}

async function keluar() {
  await fetch('/api/keluar', { method: 'POST' });
  keadaan.orang = null;
  keadaan.ruang = 'keluarga';
  keadaan.urusan = [];
  window.google?.accounts?.id?.disableAutoSelect();
  tutupLembar();
  tampilMasuk();
}

// ---------- Data ----------

async function muat() {
  try {
    const data = await panggil('/api/urusan');
    keadaan.urusan = data.urusan;
    keadaan.hariIni = data.hari_ini;
    keadaan.offline = false;
  } catch (e) {
    if (!keadaan.orang) return;
    keadaan.offline = true;
  }
  tampilDashboard();
}

let pengatur;
function mulaiSinkron() {
  clearInterval(pengatur);
  pengatur = setInterval(() => {
    if (keadaan.orang && document.visibilityState === 'visible') muat();
  }, SINKRON_MS);
}
document.addEventListener('visibilitychange', () => {
  if (keadaan.orang && document.visibilityState === 'visible') muat();
});

// ---------- Dashboard ----------

function cocokFilter(u) {
  if (keadaan.filter === 'semua') return true;
  return u.pemilik === keadaan.filter;
}

function kartu(u) {
  const st = statusUrusan(u, keadaan.hariIni);
  const label = st.sisa < 0 ? T.telatHari(-st.sisa) : T.sisaHari(st.sisa);
  const perluAksi = st.kode !== 'aman';
  return `
    <li class="kartu o-${u.pemilik}">
      <button class="kartu-isi" data-detail="${u.id}">
        ${inisial(u.pemilik)}
        <span class="kartu-teks">
          <span class="kartu-judul">${esc(u.judul)}</span>
          <span class="kartu-meta"><span class="sisa s-${st.kode}">${esc(label)}</span>${esc(fmt(u.jatuh_tempo))}</span>
        </span>
      </button>
      ${perluAksi ? `<button class="tombol-selesai" data-selesai="${u.id}">${esc(T.tombolSelesai)}</button>` : ''}
    </li>`;
}

function tampilDashboard() {
  const semua = keadaan.urusan;
  const terlihat = semua.filter(cocokFilter);
  const kelompok = { telat: [], urus: [], aman: [] };
  for (const u of terlihat) {
    const k = statusUrusan(u, keadaan.hariIni).kode;
    kelompok[k === 'hari-ini' ? 'telat' : k].push(u);
  }

  const chip = (kode) => {
    const aktif = keadaan.filter === kode;
    const isi = kode === 'semua' ? esc(T.semua) : `${inisial(kode)}${esc(ORANG[kode].nama)}`;
    return `<button class="chip${kode === 'semua' ? ' tanpa-inisial' : ''}" aria-pressed="${aktif}" data-filter="${kode}">${isi}</button>`;
  };

  const bagian = (kode, judul) =>
    kelompok[kode].length
      ? `<section class="bagian b-${kode}"><h2>${esc(judul)}</h2><ul class="daftar">${kelompok[kode].map(kartu).join('')}</ul></section>`
      : '';

  const ringkas = [
    kelompok.telat.length ? `<span class="r-telat">${esc(T.ringkasTelat(kelompok.telat.length))}</span>` : '',
    kelompok.urus.length ? `<span class="r-urus">${esc(T.ringkasUrus(kelompok.urus.length))}</span>` : '',
    kelompok.aman.length ? `<span class="r-aman">${esc(T.ringkasAman(kelompok.aman.length))}</span>` : '',
  ].join('');

  let isi;
  if (!semua.length) {
    isi = `<div class="kosong"><h2>${esc(T.kosongJudul)}</h2><p>${esc(T.kosongIsi)}</p>
      <button class="tombol" data-tambah>${esc(T.tombolTambah)}</button></div>`;
  } else if (!terlihat.length) {
    isi = `<div class="kosong"><p>${esc(T.kosongFilter)}</p></div>`;
  } else {
    isi = bagian('telat', T.bagianTelat) + bagian('urus', T.bagianUrus) + bagian('aman', T.bagianAman);
  }

  app.innerHTML = `
    <div class="wadah">
      <header class="kepala">
        <h1>${esc(T.namaAplikasi)}</h1>
        <button class="tombol-ikon" data-kalender>📅 ${esc(T.kalender)}</button>
        <button class="tombol-ikon" data-akun aria-label="${esc(T.keluar)}">${inisial(keadaan.orang)}</button>
      </header>
      ${keadaan.ruang === 'demo' ? `<div class="pita-demo"><p>${esc(T.bannerDemo)}</p><button class="tombol-kecil" data-ulang-demo>${esc(T.tombolUlangDemo)}</button></div>` : ''}
      ${keadaan.offline ? `<p class="offline">${esc(T.gagalMuat)}</p>` : ''}
      ${semua.length ? `<div class="ringkasan">${ringkas}</div>` : ''}
      ${semua.length ? `<nav class="penyaring" aria-label="Penyaring">${['semua', 'D', 'I', 'B'].map(chip).join('')}</nav>` : ''}
      ${isi}
    </div>
    ${semua.length ? `<button class="fab" data-tambah><span aria-hidden="true">+</span>${esc(T.tombolTambah)}</button>` : ''}`;
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.filter) { keadaan.filter = t.dataset.filter; tampilDashboard(); }
  else if (t.hasAttribute('data-tambah')) lembarContoh();
  else if (t.dataset.selesai) lembarSelesai(cari(t.dataset.selesai));
  else if (t.dataset.detail) lembarDetail(cari(t.dataset.detail));
  else if (t.hasAttribute('data-kalender')) lembarKalender();
  else if (t.hasAttribute('data-akun')) lembarAkun();
  else if (t.hasAttribute('data-ulang-demo')) ulangDemo();
});

async function ulangDemo() {
  try {
    await panggil('/api/demo/ulang', { method: 'POST', body: {} });
    tutupLembar();
    toast(T.toastUlangDemo);
    await muat();
  } catch (e) { toast(e.message); }
}

function cari(id) {
  return keadaan.urusan.find((u) => u.id === id);
}

// ---------- Lembar (dialog) ----------

function bukaLembar(judul, isiHtml, pasang) {
  lembar.innerHTML = `
    <div class="lembar-isi">
      <div class="lembar-kepala">
        <h2 id="lembar-judul">${esc(judul)}</h2>
        <button class="tutup" data-tutup aria-label="${esc(T.tombolTutup)}">×</button>
      </div>
      ${isiHtml}
    </div>`;
  lembar.querySelectorAll('[data-tutup]').forEach((b) => b.addEventListener('click', tutupLembar));
  if (!lembar.open) lembar.showModal();
  pasang?.(lembar);
}

function tutupLembar() {
  if (lembar.open) lembar.close();
}

lembar.addEventListener('click', (e) => {
  if (e.target === lembar) tutupLembar(); // ketuk di luar lembar
});

function lembarAkun() {
  const demo = keadaan.ruang === 'demo';
  bukaLembar(`${ORANG[keadaan.orang].nama}${demo ? ' (demo)' : ''}`, `
    ${demo ? `<p class="bantu">${esc(T.bannerDemo)}</p><button class="tombol kedua penuh" data-ulang>${esc(T.tombolUlangDemo)}</button>` : ''}
    <button class="tombol kedua penuh" data-keluar>${esc(T.keluar)}</button>`,
  (el) => {
    el.querySelector('[data-keluar]').addEventListener('click', keluar);
    el.querySelector('[data-ulang]')?.addEventListener('click', ulangDemo);
  });
}

function lembarContoh() {
  const grup = CONTOH.map((k) => `
    <div class="kelompok">
      <h3>${esc(k.kelompok)}</h3>
      <div class="grid-contoh">
        ${k.daftar.map((c, i) => `
          <button class="contoh" data-k="${esc(k.kelompok)}" data-i="${i}">
            <b>${esc(c.judul)}</b><small>${esc(teksUlang(c))} · urus ${c.mulai_urus} hari sebelum</small>
          </button>`).join('')}
      </div>
    </div>`).join('');

  bukaLembar(T.pilihContoh, `
    ${grup}
    <button class="contoh" data-kosong><b>${esc(T.contohKosong)}</b><small>${esc(T.contohKosongIsi)}</small></button>`,
  (el) => {
    el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      const c = CONTOH.find((k) => k.kelompok === b.dataset.k).daftar[Number(b.dataset.i)];
      lembarForm({ ...c, pemilik: keadaan.orang });
    }));
    el.querySelector('[data-kosong]').addEventListener('click', () =>
      lembarForm({ judul: '', ulang: 'bulan', interval: 1, mulai_urus: 7, pemilik: keadaan.orang }));
  });
}

function lembarForm(awal, id = null) {
  const radio = (nama, nilai, label, cek, kelas = '') =>
    `<label class="${kelas}"><input type="radio" name="${nama}" value="${nilai}"${cek ? ' checked' : ''}>${label}</label>`;

  bukaLembar(id ? T.judulUbah : T.judulTambah, `
    <form id="form-urusan" class="lembar-form" novalidate style="display:grid;gap:16px">
      <div class="kolom">
        <label for="f-judul">${esc(T.labelJudul)}</label>
        <input id="f-judul" name="judul" type="text" maxlength="120" required value="${esc(awal.judul)}">
      </div>
      <div class="kolom">
        <span class="label" id="l-pemilik">${esc(T.labelPemilik)}</span>
        <div class="pilihan" role="radiogroup" aria-labelledby="l-pemilik">
          ${['D', 'I', 'B'].map((o) => radio('pemilik', o, `${inisial(o)}${esc(ORANG[o].nama)}`, awal.pemilik === o)).join('')}
        </div>
      </div>
      <div class="kolom">
        <label for="f-jt">${esc(T.labelJatuhTempo)}</label>
        <input id="f-jt" name="jatuh_tempo" type="date" required value="${esc(awal.jatuh_tempo || '')}">
      </div>
      <div class="kolom">
        <span class="label" id="l-ulang">${esc(T.labelUlang)}</span>
        <div class="pilihan" role="radiogroup" aria-labelledby="l-ulang">
          ${radio('ulang', 'bulan', 'Bulanan', awal.ulang === 'bulan', 'tanpa-inisial')}
          ${radio('ulang', 'tahun', 'Tahunan', awal.ulang === 'tahun', 'tanpa-inisial')}
          ${radio('ulang', 'manual', esc(T.ulangManual), awal.ulang === 'manual', 'tanpa-inisial')}
        </div>
        <p class="bantu" id="bantu-manual">${esc(T.bantuManual)}</p>
      </div>
      <div class="baris-dua">
        <div class="kolom" id="kolom-interval">
          <label for="f-interval" id="l-interval"></label>
          <input id="f-interval" name="interval" type="number" inputmode="numeric" min="1" max="20" value="${esc(awal.interval || 1)}">
        </div>
        <div class="kolom">
          <label for="f-mulai">${esc(T.labelMulaiUrus)}</label>
          <input id="f-mulai" name="mulai_urus" type="number" inputmode="numeric" min="1" max="365" value="${esc(awal.mulai_urus)}">
        </div>
      </div>
      <p class="bantu" id="bantu-tahap"></p>
      <div class="kolom">
        <label for="f-catatan">${esc(T.labelCatatan)}</label>
        <textarea id="f-catatan" name="catatan" maxlength="500" placeholder="${esc(T.contohCatatan)}">${esc(awal.catatan || '')}</textarea>
      </div>
      <p class="galat-form" id="galat-form" role="alert" hidden></p>
      <div class="aksi">
        <button type="button" class="tombol kedua" data-tutup>${esc(T.tombolBatal)}</button>
        <button type="submit" class="tombol">${esc(T.tombolSimpan)}</button>
      </div>
    </form>`,
  (el) => {
    const form = el.querySelector('form');
    const perbarui = () => {
      const ulang = form.ulang.value;
      el.querySelector('#kolom-interval').hidden = ulang === 'manual';
      el.querySelector('#bantu-manual').hidden = ulang !== 'manual';
      el.querySelector('#l-interval').textContent = T.labelInterval(ulang);
      el.querySelector('#bantu-tahap').textContent = T.bantuMulaiUrus(teksTahap(form.mulai_urus.value));
    };
    form.addEventListener('input', perbarui);
    form.addEventListener('change', perbarui);
    perbarui();
    if (!id) form.jatuh_tempo.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const galat = el.querySelector('#galat-form');
      const data = Object.fromEntries(new FormData(form));
      const tombol = form.querySelector('[type="submit"]');
      tombol.disabled = true;
      try {
        await panggil(id ? `/api/urusan/${id}` : '/api/urusan', { method: id ? 'PUT' : 'POST', body: data });
        tutupLembar();
        toast(T.toastTersimpan);
        await muat();
      } catch (err) {
        galat.textContent = err.message;
        galat.hidden = false;
        tombol.disabled = false;
      }
    });
  });
}

function lembarSelesai(u) {
  if (!u) return;
  const berikut = jatuhTempoBerikutnya(u);
  const manual = u.ulang === 'manual';
  const saran = manual ? tambahHari(u.jatuh_tempo, 30) : '';

  bukaLembar(T.judulSelesai(u.judul), `
    <form id="form-selesai" novalidate style="display:grid;gap:16px">
      <div class="kolom">
        <label for="s-bukti">${esc(T.labelBukti)}</label>
        <textarea id="s-bukti" name="bukti" maxlength="500" placeholder="${esc(T.contohBukti)}"></textarea>
      </div>
      ${manual ? `
        <div class="kolom" id="kolom-berikut">
          <label for="s-berikut">${esc(T.labelBerikutManual)}</label>
          <input id="s-berikut" name="jatuh_tempo_berikut" type="date" min="${esc(tambahHari(u.jatuh_tempo, 1))}" value="${esc(saran)}">
        </div>
        <label class="cek"><input type="checkbox" name="berhenti" id="s-berhenti">${esc(T.labelBerhenti)}</label>`
      : `<p class="info">${esc(T.infoBerikut(fmt(berikut, true)))}</p>`}
      <p class="galat-form" role="alert" hidden></p>
      <div class="aksi">
        <button type="button" class="tombol kedua" data-tutup>${esc(T.tombolBatal)}</button>
        <button type="submit" class="tombol">${esc(T.tombolSelesai)}</button>
      </div>
    </form>`,
  (el) => {
    const form = el.querySelector('form');
    const berhenti = form.querySelector('#s-berhenti');
    berhenti?.addEventListener('change', () => { el.querySelector('#kolom-berikut').hidden = berhenti.checked; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tombol = form.querySelector('[type="submit"]');
      const galat = form.querySelector('.galat-form');
      tombol.disabled = true;
      tombol.textContent = T.bersiapSelesai;
      try {
        const hasil = await panggil(`/api/urusan/${u.id}/selesai`, {
          method: 'POST',
          body: {
            jatuh_tempo: u.jatuh_tempo,
            bukti: form.bukti.value,
            jatuh_tempo_berikut: form.jatuh_tempo_berikut?.value,
            berhenti: berhenti?.checked || false,
          },
        });
        tutupLembar();
        toast(T.toastSelesai(hasil.jatuh_tempo_berikut ? fmt(hasil.jatuh_tempo_berikut) : null));
        await muat();
      } catch (err) {
        galat.textContent = err.message;
        galat.hidden = false;
        tombol.disabled = false;
        tombol.textContent = T.tombolSelesai;
      }
    });
  });
}

function lembarDetail(u) {
  if (!u) return;
  const st = statusUrusan(u, keadaan.hariIni);
  const mulaiTgl = tambahHari(u.jatuh_tempo, -u.mulai_urus);

  bukaLembar(u.judul, `
    <dl class="detail-baris">
      <dt>${esc(T.jatuhTempo)}</dt><dd>${esc(fmt(u.jatuh_tempo, true))}</dd>
      <dt>Status</dt><dd><span class="sisa s-${st.kode}">${esc(st.sisa < 0 ? T.telatHari(-st.sisa) : T.sisaHari(st.sisa))}</span></dd>
      <dt>Diurus</dt><dd>${inisial(u.pemilik)} ${esc(ORANG[u.pemilik].nama)}</dd>
      <dt>Berulang</dt><dd>${esc(teksUlang(u))}</dd>
      <dt>Pengingat</dt><dd>${esc(T.mulaiUrusPada(fmt(mulaiTgl)))}; ${esc(teksTahap(u.mulai_urus))}</dd>
      ${u.catatan ? `<dt>Catatan</dt><dd>${esc(u.catatan)}</dd>` : ''}
    </dl>
    <p class="bantu">${esc(T.diubahOleh(ORANG[u.diubah_oleh]?.nama || '-', fmtWaktu(u.diubah_pada)))}</p>
    <div class="aksi">
      <button class="tombol kedua" data-ubah>${esc(T.tombolUbah)}</button>
      <button class="tombol" data-selesaikan>${esc(T.tombolSelesai)}</button>
    </div>
    <div class="kolom">
      <span class="label">${esc(T.judulRiwayat)}</span>
      <ul class="riwayat" id="riwayat"><li style="border:0">${esc(T.memuat)}</li></ul>
    </div>
    <div id="hapus-area">
      <button class="tombol-kecil" data-hapus>${esc(T.tombolHapus)}</button>
    </div>`,
  async (el) => {
    el.querySelector('[data-ubah]').addEventListener('click', () => lembarForm(u, u.id));
    el.querySelector('[data-selesaikan]').addEventListener('click', () => lembarSelesai(u));
    el.querySelector('[data-hapus]').addEventListener('click', () => {
      el.querySelector('#hapus-area').innerHTML = `
        <p class="info">${esc(T.yakinHapus)}</p>
        <div class="aksi" style="margin-top:10px">
          <button class="tombol kedua" data-batal-hapus>${esc(T.tombolBatal)}</button>
          <button class="tombol bahaya" data-yakin-hapus>${esc(T.tombolYakinHapus)}</button>
        </div>`;
      el.querySelector('[data-batal-hapus]').addEventListener('click', () => lembarDetail(u));
      el.querySelector('[data-yakin-hapus]').addEventListener('click', async () => {
        try {
          await panggil(`/api/urusan/${u.id}`, { method: 'DELETE' });
          tutupLembar();
          toast(T.toastDihapus);
          await muat();
        } catch (err) { toast(err.message); }
      });
    });

    try {
      const { riwayat } = await panggil(`/api/urusan/${u.id}/riwayat`);
      const daftar = el.querySelector('#riwayat');
      if (!daftar) return;
      daftar.innerHTML = riwayat.length
        ? riwayat.map((r) => `<li>${esc(T.riwayatBaris(fmt(r.jatuh_tempo), fmtWaktu(r.selesai_pada), ORANG[r.oleh]?.nama || '-'))}
            ${r.bukti ? `<span class="bukti">${esc(r.bukti)}</span>` : ''}</li>`).join('')
        : `<li style="border:0;padding:0" class="bantu">${esc(T.riwayatKosong)}</li>`;
    } catch { /* riwayat opsional */ }
  });
}

async function lembarKalender() {
  bukaLembar(T.judulKalender, `<p class="bantu">${esc(T.memuat)}</p>`);
  let link;
  try {
    ({ link } = await panggil('/api/kalender'));
  } catch (e) {
    bukaLembar(T.judulKalender, `<p class="galat-form">${esc(e.message)}</p>`);
    return;
  }
  const urutan = keadaan.orang === 'D' ? ['D', 'I'] : ['I', 'D'];
  const kotak = (o) => {
    const https = link[o].replace(/^webcal:/, 'https:');
    return `
      <div class="kal-kotak">
        <h3>${inisial(o)} ${esc(T.kalenderMilik(ORANG[o].nama))}</h3>
        <div class="kal-link">${esc(https)}</div>
        ${ANDROID ? `
          <p class="bantu">${esc(T.bantuAndroid)}</p>
          <div class="aksi">
            <a class="tombol kedua" href="${ICSX_PLAY_STORE}" target="_blank" rel="noopener">${esc(T.tombolPlayStore)}</a>
            <button class="tombol" data-salin="${esc(https)}">${esc(T.tombolSalin)}</button>
          </div>
          <a class="tombol-kecil" href="${esc(link[o])}">${esc(T.tombolBukaIcsx)}</a>` : `
          <div class="aksi">
            <a class="tombol" href="${esc(link[o])}">${esc(T.tombolBukaKalender)}</a>
            <button class="tombol-kecil" data-salin="${esc(https)}">${esc(T.tombolSalin)}</button>
          </div>`}
        <button class="tombol-kecil" data-ganti="${o}">${esc(T.tombolGantiLink)}</button>
        <p class="bantu">${esc(T.bantuGantiLink)}</p>
      </div>`;
  };
  const langkah = (isi) => `<ol class="langkah">${isi.map((s) => `<li>${s.startsWith('Penting') ? `<strong>${esc(s)}</strong>` : esc(s)}</li>`).join('')}</ol>`;
  const langkahIphone = `<div class="kolom"><span class="label">${esc(T.langkahIphone)}</span>${langkah(T.langkahIphoneIsi)}</div>`;
  const langkahAndroid = `<div class="kolom"><span class="label">${esc(T.langkahAndroid)}</span>${langkah(T.langkahAndroidIsi)}</div>`;

  bukaLembar(T.judulKalender, `
    <p class="bantu">${esc(T.introKalender)}</p>
    ${kotak(urutan[0])}
    ${ANDROID ? langkahAndroid + langkahIphone : langkahIphone + langkahAndroid}
    <p class="bantu">${esc(T.catatanGoogle)}</p>
    ${kotak(urutan[1])}`,
  (el) => {
    el.querySelectorAll('[data-salin]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.salin);
        toast(T.tersalin);
      } catch {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(b.closest('.kal-kotak').querySelector('.kal-link'));
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }));
    el.querySelectorAll('[data-ganti]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await panggil(`/api/kalender/${b.dataset.ganti}/ganti`, { method: 'POST', body: {} });
        lembarKalender();
      } catch (e) { toast(e.message); }
    }));
  });
}

// ---------- Mulai ----------

async function mulai() {
  try {
    const res = await fetch('/api/saya', { credentials: 'same-origin' });
    if (res.ok) {
      const sesi = await res.json();
      keadaan.orang = sesi.orang;
      keadaan.ruang = sesi.ruang;
      await muat();
    } else {
      await tampilMasuk();
    }
  } catch {
    await tampilMasuk(T.gagalMuat);
  }
  mulaiSinkron();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

mulai();
