// Login Google (verifikasi ID token) dan cookie sesi bertanda tangan HMAC.

const enc = new TextEncoder();
const COOKIE = 'jt_sesi';
const UMUR_SESI_DETIK = 180 * 24 * 60 * 60;

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dariB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// "D:a@gmail.com,I:b@gmail.com" → { 'a@gmail.com': 'D', 'b@gmail.com': 'I' }
export function daftarEmail(env) {
  const peta = {};
  for (const bagian of (env.ALLOWED_EMAILS || '').split(',')) {
    const [orang, email] = bagian.split(':').map((s) => s && s.trim());
    if ((orang === 'D' || orang === 'I') && email) peta[email.toLowerCase()] = orang;
  }
  return peta;
}

let cacheKunci = { kunci: null, sampai: 0 };

async function kunciGoogle() {
  if (cacheKunci.kunci && Date.now() < cacheKunci.sampai) return cacheKunci.kunci;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('Gagal mengambil kunci Google');
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  cacheKunci = { kunci: keys, sampai: Date.now() + maxAge * 1000 };
  return keys;
}

// Mengembalikan email yang terverifikasi, atau melempar error.
export async function verifikasiTokenGoogle(token, clientId) {
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) throw new Error('Token tidak valid');
  const header = JSON.parse(new TextDecoder().decode(dariB64url(h)));
  const isi = JSON.parse(new TextDecoder().decode(dariB64url(p)));
  const jwk = (await kunciGoogle()).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') throw new Error('Kunci token tidak dikenal');
  const kunci = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sah = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kunci, dariB64url(s), enc.encode(`${h}.${p}`));
  if (!sah) throw new Error('Tanda tangan token salah');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(isi.iss)) throw new Error('Penerbit token salah');
  if (isi.aud !== clientId) throw new Error('Token bukan untuk aplikasi ini');
  if (isi.exp * 1000 < Date.now()) throw new Error('Token kedaluwarsa');
  if (!isi.email_verified) throw new Error('Email belum terverifikasi');
  return String(isi.email).toLowerCase();
}

async function kunciHmac(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function buatCookieSesi(orang, env) {
  const isi = b64url(enc.encode(JSON.stringify({ o: orang, exp: Math.floor(Date.now() / 1000) + UMUR_SESI_DETIK })));
  const ttd = b64url(await crypto.subtle.sign('HMAC', await kunciHmac(env.SESSION_SECRET), enc.encode(isi)));
  return `${COOKIE}=${isi}.${ttd}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${UMUR_SESI_DETIK}`;
}

export function hapusCookieSesi() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Mengembalikan 'D' / 'I' bila sesi sah, selain itu null.
export async function bacaSesi(request, env) {
  if (!env.SESSION_SECRET) return null;
  const cookie = request.headers.get('cookie') || '';
  const nilai = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!nilai) return null;
  const [isi, ttd] = nilai.split('.');
  if (!isi || !ttd) return null;
  try {
    const sah = await crypto.subtle.verify('HMAC', await kunciHmac(env.SESSION_SECRET), dariB64url(ttd), enc.encode(isi));
    if (!sah) return null;
    const data = JSON.parse(new TextDecoder().decode(dariB64url(isi)));
    if (data.exp * 1000 < Date.now()) return null;
    return data.o === 'D' || data.o === 'I' ? data.o : null;
  } catch {
    return null;
  }
}

export function tokenAcak(panjangByte = 24) {
  return b64url(crypto.getRandomValues(new Uint8Array(panjangByte)));
}
