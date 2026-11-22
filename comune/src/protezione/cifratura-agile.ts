// «Password per aprire» dei file .docx e .xlsx: la cifratura «agile» di Office 2010 e successivi (specifica pubblica [MS-OFFCRYPTO] 2.3.4.10-15).
// Il pacchetto (lo zip del documento) si cifra con AES-CBC a pezzi da 4096 byte; la chiave è casuale ed è a sua volta cifrata con una chiave
// ricavata dalla password (SHA-512 ripetuto 100000 volte, con il sale). Il risultato è un file composto con i flussi EncryptionInfo,
// EncryptedPackage e la cartella \u0006DataSpaces che dice a Office come leggerli. Un HMAC sul pacchetto cifrato ne garantisce l'integrità.
// AES e HMAC sono quelli della Web Crypto API (nel browser e in Node); SHA-512 e SHA-1 ripetuti sono quelli sincroni di pmb_office.
// La cifratura «standard» di Office 2007 (AES-ECB) e quella con certificati non si leggono: lo si dice all'utente.
// Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.
import { eFileComposto, leggiCfb } from '../formati/cfb';
import { scriviCfb } from '../formati/cfb-scrivi';
import { analizzaXml, escapaAttributo, figliElemento, trova, type NodoXml } from '../formati/xml';
import { aBase64, daBase64, sha512 } from './impronte';
import { sha1 } from '../formati/cifratura-office';

/** La password data non apre il file (o il file non ha la password e se ne è data una sbagliata). */
export class PasswordSbagliata extends Error { constructor() { super('password sbagliata'); this.name = 'PasswordSbagliata'; } }
/** Il file è cifrato in un modo che pmb_office non legge. */
export class CifraturaNonSupportata extends Error { constructor(come: string) { super(come); this.name = 'CifraturaNonSupportata'; } }

const SEGMENTO = 4096;
const BLOCCO_VERIFICA_INGRESSO = [0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79];
const BLOCCO_VERIFICA_VALORE = [0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e];
const BLOCCO_CHIAVE = [0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6];
const BLOCCO_HMAC_CHIAVE = [0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6];
const BLOCCO_HMAC_VALORE = [0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33];
/** Giri di SHA-512 sulla password, come Office. */
export const GIRI_CIFRATURA = 100000;
const GIRI_MASSIMI = 10_000_000;

type Hash = 'SHA1' | 'SHA256' | 'SHA384' | 'SHA512';
const DIM_HASH: Record<Hash, number> = { SHA1: 20, SHA256: 32, SHA384: 48, SHA512: 64 };
const NOME_WEB: Record<Hash, string> = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' };

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new CifraturaNonSupportata('la cifratura non è disponibile in questo ambiente');
  return c.subtle;
}
const unisci = (...parti: Array<Uint8Array | number[]>): Uint8Array => {
  const o = new Uint8Array(parti.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of parti) { o.set(p, i); i += p.length; }
  return o;
};
const u32 = (n: number): Uint8Array => Uint8Array.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const utf16le = (s: string): Uint8Array => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[2 * i] = s.charCodeAt(i) & 0xff; b[2 * i + 1] = s.charCodeAt(i) >>> 8; } return b; };
const uguali = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const casuali = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

async function hash(alg: Hash, dati: Uint8Array): Promise<Uint8Array> {
  if (alg === 'SHA512') return sha512(dati);
  if (alg === 'SHA1') return sha1(dati);
  return new Uint8Array(await subtle().digest(NOME_WEB[alg], dati as BufferSource));
}

/** Allunga (con 0x36) o accorcia un valore alla lunghezza voluta ([MS-OFFCRYPTO] 2.3.4.11). */
function aMisura(b: Uint8Array, n: number): Uint8Array {
  if (b.length >= n) return b.slice(0, n);
  const o = new Uint8Array(n).fill(0x36); o.set(b); return o;
}

/** H0 = H(sale + password), poi Hn = H(giro + Hn-1): il valore da cui si ricavano le chiavi della password. */
async function hashPassword(alg: Hash, password: string, sale: Uint8Array, giri: number): Promise<Uint8Array> {
  let h = await hash(alg, unisci(sale, utf16le(password)));
  const n = DIM_HASH[alg];
  const buf = new Uint8Array(4 + n);
  for (let i = 0; i < giri; i++) {
    buf[0] = i & 0xff; buf[1] = (i >>> 8) & 0xff; buf[2] = (i >>> 16) & 0xff; buf[3] = (i >>> 24) & 0xff;
    buf.set(h, 4);
    h = alg === 'SHA512' ? sha512(buf) : alg === 'SHA1' ? sha1(buf) : await hash(alg, buf);
  }
  return h;
}

export async function chiaveAes(chiave: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', chiave as BufferSource, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}
/** AES-CBC senza riempimento (i dati sono già multipli di 16 byte). La Web Crypto aggiunge e toglie il riempimento PKCS#7: in cifratura
 *  si scarta l'ultimo blocco; in decifratura si accoda il blocco che la cifratura di un riempimento intero darebbe. */
async function cifraAes(chiave: CryptoKey, iv: Uint8Array, dati: Uint8Array): Promise<Uint8Array> {
  const c = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, chiave, dati as BufferSource));
  return c.subarray(0, dati.length);
}
export async function decifraAes(chiave: CryptoKey, iv: Uint8Array, dati: Uint8Array): Promise<Uint8Array> {
  if (dati.length === 0 || dati.length % 16 !== 0) throw new CifraturaNonSupportata('dati cifrati di lunghezza non valida');
  const ultimo = dati.subarray(dati.length - 16);
  const riempimento = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: ultimo as BufferSource }, chiave, new Uint8Array(0)));
  return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, chiave, unisci(dati, riempimento.subarray(0, 16)) as BufferSource));
}
const multiplo16 = (b: Uint8Array): Uint8Array => { if (b.length % 16 === 0) return b; const o = new Uint8Array(b.length + 16 - (b.length % 16)); o.set(b); return o; };

/** Vero se i byte sono un file composto con dentro un pacchetto di Office cifrato (.docx, .xlsx, .pptx con password). */
export function eOfficeCifrato(b: Uint8Array): boolean {
  if (!eFileComposto(b)) return false;
  try { const a = leggiCfb(b); return a.flusso('EncryptionInfo') !== undefined && a.flusso('EncryptedPackage') !== undefined; } catch { return false; }
}

interface Parametri { alg: Hash; bitChiave: number; dimBlocco: number; sale: Uint8Array }
function parametri(n: NodoXml | undefined): Parametri {
  if (!n) throw new CifraturaNonSupportata('informazioni di cifratura mancanti');
  const a = n.attributi;
  const alg = a.hashAlgorithm as Hash;
  if (a.cipherAlgorithm !== 'AES' || a.cipherChaining !== 'ChainingModeCBC' || !(alg in DIM_HASH)) throw new CifraturaNonSupportata(`cifratura ${a.cipherAlgorithm ?? '?'} ${a.cipherChaining ?? ''} ${a.hashAlgorithm ?? ''}`);
  const bitChiave = Number(a.keyBits), dimBlocco = Number(a.blockSize);
  if (![128, 192, 256].includes(bitChiave) || dimBlocco !== 16) throw new CifraturaNonSupportata(`chiave da ${a.keyBits} bit`);
  return { alg, bitChiave, dimBlocco, sale: daBase64(a.saltValue ?? '') };
}

/**
 * Decifra un .docx/.xlsx con la password per aprire: dà il pacchetto zip. PasswordSbagliata se la password non è quella,
 * CifraturaNonSupportata se il file usa un'altra cifratura (Office 2007 «standard», certificati, algoritmi diversi da AES).
 */
export async function decifraOffice(b: Uint8Array, password: string): Promise<Uint8Array> {
  const a = leggiCfb(b);
  const info = a.flusso('EncryptionInfo'), pacchetto = a.flusso('EncryptedPackage');
  if (!info || !pacchetto || info.length < 8 || pacchetto.length < 8) throw new CifraturaNonSupportata('file cifrato incompleto');
  const dv = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const maggiore = dv.getUint16(0, true), minore = dv.getUint16(2, true);
  if (maggiore !== 4 || minore !== 4) throw new CifraturaNonSupportata(minore === 2 ? 'cifratura «standard» di Office 2007' : `cifratura versione ${maggiore}.${minore}`);
  const xml = analizzaXml(new TextDecoder().decode(info.subarray(8)));
  const dati = parametri(trova(xml, 'keyData'));
  const conPassword = figliElemento(trova(xml, 'keyEncryptors') ?? xml, 'keyEncryptor').find((k) => k.attributi.uri === 'http://schemas.microsoft.com/office/2006/keyEncryptor/password');
  const chiaveCifrata = conPassword ? figliElemento(conPassword, 'p:encryptedKey')[0] : undefined;
  if (!chiaveCifrata) throw new CifraturaNonSupportata('cifratura con certificato');
  const pk = parametri(chiaveCifrata);
  const giri = Number(chiaveCifrata.attributi.spinCount);
  if (!Number.isInteger(giri) || giri < 0 || giri > GIRI_MASSIMI) throw new CifraturaNonSupportata('numero di giri non valido');
  const h = await hashPassword(pk.alg, password, pk.sale, giri);
  const chiaveDi = async (blocco: number[]): Promise<CryptoKey> => chiaveAes(aMisura(await hash(pk.alg, unisci(h, blocco)), pk.bitChiave / 8));
  const attr = chiaveCifrata.attributi;
  const ingresso = await decifraAes(await chiaveDi(BLOCCO_VERIFICA_INGRESSO), pk.sale, daBase64(attr.encryptedVerifierHashInput ?? ''));
  const valore = await decifraAes(await chiaveDi(BLOCCO_VERIFICA_VALORE), pk.sale, daBase64(attr.encryptedVerifierHashValue ?? ''));
  const atteso = await hash(pk.alg, ingresso.subarray(0, pk.sale.length));
  if (!uguali(atteso, valore.subarray(0, DIM_HASH[pk.alg]))) throw new PasswordSbagliata();
  const chiave = (await decifraAes(await chiaveDi(BLOCCO_CHIAVE), pk.sale, daBase64(attr.encryptedKeyValue ?? ''))).subarray(0, dati.bitChiave / 8);
  const k = await chiaveAes(chiave);
  // integrità: l'HMAC del flusso cifrato, con la chiave e il valore cifrati nelle informazioni
  const integrita = trova(xml, 'dataIntegrity');
  if (integrita) {
    const ivDi = async (blocco: number[]): Promise<Uint8Array> => aMisura(await hash(dati.alg, unisci(dati.sale, blocco)), dati.dimBlocco);
    const chiaveHmac = (await decifraAes(k, await ivDi(BLOCCO_HMAC_CHIAVE), daBase64(integrita.attributi.encryptedHmacKey ?? ''))).subarray(0, DIM_HASH[dati.alg]);
    const valoreHmac = (await decifraAes(k, await ivDi(BLOCCO_HMAC_VALORE), daBase64(integrita.attributi.encryptedHmacValue ?? ''))).subarray(0, DIM_HASH[dati.alg]);
    const kh = await subtle().importKey('raw', chiaveHmac as BufferSource, { name: 'HMAC', hash: NOME_WEB[dati.alg] }, false, ['sign']);
    const calcolato = new Uint8Array(await subtle().sign('HMAC', kh, pacchetto as BufferSource));
    if (!uguali(calcolato, valoreHmac)) throw new CifraturaNonSupportata('il file cifrato è rovinato (controllo di integrità non superato)');
  }
  const pv = new DataView(pacchetto.buffer, pacchetto.byteOffset, pacchetto.byteLength);
  const dimensione = pv.getUint32(0, true) + pv.getUint32(4, true) * 2 ** 32;
  if (dimensione > (pacchetto.length - 8) || dimensione > 512 * 1024 * 1024) throw new CifraturaNonSupportata('dimensione del pacchetto non valida');
  const out = new Uint8Array(Math.ceil((pacchetto.length - 8) / 16) * 16);
  for (let i = 0, p = 8; p < pacchetto.length; i++, p += SEGMENTO) {
    const pezzo = pacchetto.subarray(p, Math.min(pacchetto.length, p + SEGMENTO));
    const iv = aMisura(await hash(dati.alg, unisci(dati.sale, u32(i))), dati.dimBlocco);
    out.set(await decifraAes(k, iv, pezzo.length % 16 === 0 ? pezzo : multiplo16(pezzo)), p - 8);
  }
  return out.slice(0, dimensione);
}

// ---- scrittura ----
/** UNICODE-LP-P4 di [MS-OFFCRYPTO] 2.1.2: lunghezza in byte, testo UTF-16 e riempimento a 4 byte. */
function testoLp(s: string): Uint8Array { const t = utf16le(s); return unisci(u32(t.length), t, new Uint8Array((4 - (t.length % 4)) % 4)); }
const VERSIONE_1_0 = [1, 0, 0, 0];
/** La cartella \u0006DataSpaces ([MS-OFFCRYPTO] 2.1.5-2.1.8, 2.2.6): fissa per la cifratura «forte». */
function spaziDati(): Array<{ percorso: string; dati: Uint8Array }> {
  const versione = unisci(testoLp('Microsoft.Container.DataSpaces'), VERSIONE_1_0, VERSIONE_1_0, VERSIONE_1_0);
  const voce = unisci(u32(1), u32(0), testoLp('EncryptedPackage'), testoLp('StrongEncryptionDataSpace'));
  const mappa = unisci(u32(8), u32(1), u32(voce.length + 4), voce);
  const definizione = unisci(u32(8), u32(1), testoLp('StrongEncryptionTransform'));
  const id = testoLp('{FF9A3F03-56EF-4613-BDD5-5A41C1D07246}');
  const primario = unisci(u32(8 + id.length), u32(1), id, testoLp('Microsoft.Container.EncryptionTransform'), VERSIONE_1_0, VERSIONE_1_0, VERSIONE_1_0, u32(0), u32(0), u32(0), u32(4));
  return [
    { percorso: '\u0006DataSpaces/Version', dati: versione },
    { percorso: '\u0006DataSpaces/DataSpaceMap', dati: mappa },
    { percorso: '\u0006DataSpaces/DataSpaceInfo/StrongEncryptionDataSpace', dati: definizione },
    { percorso: '\u0006DataSpaces/TransformInfo/StrongEncryptionTransform/\u0006Primary', dati: primario },
  ];
}
/** Solo per i test: i flussi fissi della cartella \u0006DataSpaces. */
export const spaziDatiPerProva = spaziDati;

/** Cifra un pacchetto (lo zip di un .docx o .xlsx) con la password per aprire, come Office: AES-256, SHA-512, 100000 giri. */
export async function cifraOffice(pacchetto: Uint8Array, password: string, giri = GIRI_CIFRATURA): Promise<Uint8Array> {
  const alg: Hash = 'SHA512';
  const saleDati = casuali(16), saleChiave = casuali(16), chiave = casuali(32), verifica = casuali(16), chiaveHmac = casuali(64);
  const k = await chiaveAes(chiave);
  // il pacchetto, a pezzi da 4096 byte
  const pezzi: Uint8Array[] = [];
  for (let i = 0, p = 0; p < pacchetto.length; i++, p += SEGMENTO) {
    const iv = aMisura(await hash(alg, unisci(saleDati, u32(i))), 16);
    pezzi.push(await cifraAes(k, iv, multiplo16(pacchetto.subarray(p, Math.min(pacchetto.length, p + SEGMENTO)))));
  }
  const flusso = unisci(u32(pacchetto.length), u32(Math.floor(pacchetto.length / 2 ** 32)), ...pezzi);
  // la chiave, cifrata con la password
  const h = await hashPassword(alg, password, saleChiave, giri);
  const chiaveDi = async (blocco: number[]): Promise<CryptoKey> => chiaveAes(aMisura(await hash(alg, unisci(h, blocco)), 32));
  const ingresso = await cifraAes(await chiaveDi(BLOCCO_VERIFICA_INGRESSO), saleChiave, verifica);
  const valore = await cifraAes(await chiaveDi(BLOCCO_VERIFICA_VALORE), saleChiave, multiplo16(await hash(alg, verifica)));
  const chiaveCifrata = await cifraAes(await chiaveDi(BLOCCO_CHIAVE), saleChiave, chiave);
  // integrità
  const ivDi = async (blocco: number[]): Promise<Uint8Array> => aMisura(await hash(alg, unisci(saleDati, blocco)), 16);
  const kh = await subtle().importKey('raw', chiaveHmac as BufferSource, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const hmac = new Uint8Array(await subtle().sign('HMAC', kh, flusso as BufferSource));
  const hmacChiave = await cifraAes(k, await ivDi(BLOCCO_HMAC_CHIAVE), chiaveHmac);
  const hmacValore = await cifraAes(k, await ivDi(BLOCCO_HMAC_VALORE), hmac);
  const comuni = `saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512"`;
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + '<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password" xmlns:c="http://schemas.microsoft.com/office/2006/keyEncryptor/certificate">'
    + `<keyData ${comuni} saltValue="${escapaAttributo(aBase64(saleDati))}"/>`
    + `<dataIntegrity encryptedHmacKey="${aBase64(hmacChiave)}" encryptedHmacValue="${aBase64(hmacValore)}"/>`
    + '<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">'
    + `<p:encryptedKey spinCount="${giri}" ${comuni} saltValue="${aBase64(saleChiave)}" encryptedVerifierHashInput="${aBase64(ingresso)}" encryptedVerifierHashValue="${aBase64(valore)}" encryptedKeyValue="${aBase64(chiaveCifrata)}"/>`
    + '</keyEncryptor></keyEncryptors></encryption>';
  const info = unisci([4, 0, 4, 0], u32(0x40), new TextEncoder().encode(xml));
  return scriviCfb([...spaziDati(), { percorso: 'EncryptionInfo', dati: info }, { percorso: 'EncryptedPackage', dati: flusso }]);
}
