// «Password per aprire» dei file OpenDocument (.odt, .ods): specifica OASIS ODF 1.2/1.3, parte 3 (Packages), capitolo «Encryption».
// Ogni parte del pacchetto (tranne mimetype e META-INF/manifest.xml) è compressa con deflate e poi cifrata con AES-256-CBC; la chiave
// viene da PBKDF2 (HMAC-SHA1, 100000 giri) sulla «chiave di partenza» SHA-256 della password; il manifesto dice per ogni parte sale, vettore
// iniziale e impronta SHA-256 del primo kilobyte (per riconoscere la password sbagliata). È il modo che pmb_office usa per scrivere.
// In lettura si accettano anche: il pacchetto cifrato tutto insieme («encrypted-package») con AES-256-GCM e chiave da Argon2id, come lo
// scrive il LibreOffice di oggi, AES-GCM per parte, e la chiave di partenza SHA-1 dei file più vecchi. Blowfish (OpenOffice.org 1-3) no.
// Scritto per pmb_office a partire dalle specifiche, senza codice di altri programmi.
import { leggiZip, scriviZip, deflateGrezzo, inflateGrezzo, type VoceZip } from '../formati/zip';
import { analizzaXml, escapaAttributo, figliElemento, type NodoXml } from '../formati/xml';
import { aBase64, daBase64 } from './impronte';
import { CifraturaNonSupportata, PasswordSbagliata, chiaveAes, decifraAes } from './cifratura-agile';
import { argon2id } from './argon2';

export const GIRI_PBKDF2 = 100000;
const MANIFESTO = 'META-INF/manifest.xml';
const NS_MANIFESTO = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
const AES_CBC = 'http://www.w3.org/2001/04/xmlenc#aes256-cbc';
const AES_GCM = 'http://www.w3.org/2009/xmlenc11#aes256-gcm';

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new CifraturaNonSupportata('la cifratura non è disponibile in questo ambiente');
  return c.subtle;
}
const uguali = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const digest = async (alg: string, d: Uint8Array): Promise<Uint8Array> => new Uint8Array(await subtle().digest(alg, d as BufferSource));

/** Vero se il manifesto del pacchetto dice che qualche parte è cifrata. */
export function eOdfCifrato(voci: Map<string, Uint8Array>): boolean {
  const m = voci.get(MANIFESTO);
  return m !== undefined && new TextDecoder().decode(m).includes('encryption-data');
}

interface DatiCifratura { algoritmo: string; iv: Uint8Array; partenza: string; derivazione: NodoXml; checksumTipo?: string; checksum?: Uint8Array }
function datiCifratura(voce: NodoXml): DatiCifratura | null {
  const e = figliElemento(voce, 'manifest:encryption-data')[0];
  if (!e) return null;
  const alg = figliElemento(e, 'manifest:algorithm')[0];
  const der = figliElemento(e, 'manifest:key-derivation')[0];
  const sk = figliElemento(e, 'manifest:start-key-generation')[0];
  if (!alg || !der) throw new CifraturaNonSupportata('dati di cifratura incompleti');
  return {
    algoritmo: alg.attributi['manifest:algorithm-name'] ?? '',
    iv: daBase64(alg.attributi['manifest:initialisation-vector'] ?? ''),
    partenza: sk?.attributi['manifest:start-key-generation-name'] ?? 'SHA1',
    derivazione: der,
    checksumTipo: e.attributi['manifest:checksum-type'],
    checksum: e.attributi['manifest:checksum'] ? daBase64(e.attributi['manifest:checksum']) : undefined,
  };
}

/** La chiave AES di una parte: chiave di partenza dalla password, poi PBKDF2 o Argon2id. */
async function chiaveDi(d: DatiCifratura, password: string, cache: Map<string, CryptoKey>): Promise<CryptoKey> {
  const a = d.derivazione.attributi;
  const nome = a['manifest:key-derivation-name'] ?? '';
  const sale = daBase64(a['manifest:salt'] ?? '');
  const misura = Number(a['manifest:key-size'] ?? 16);
  const chiaveCache = [d.partenza, nome, a['manifest:salt'], a['manifest:iteration-count'], misura, a['loext:argon2-iterations'], a['loext:argon2-memory'], a['loext:argon2-lanes']].join('|');
  const giaFatta = cache.get(chiaveCache);
  if (giaFatta) return giaFatta;
  const pw = new TextEncoder().encode(password);
  const partenza = /sha256$/i.test(d.partenza) ? await digest('SHA-256', pw) : /sha1$/i.test(d.partenza) || d.partenza === 'SHA1' ? await digest('SHA-1', pw) : null;
  if (!partenza) throw new CifraturaNonSupportata(`chiave di partenza ${d.partenza}`);
  if (misura !== 32) throw new CifraturaNonSupportata(`chiave da ${misura} byte`);
  let chiave: Uint8Array;
  if (nome === 'PBKDF2') {
    const giri = Number(a['manifest:iteration-count']);
    if (!Number.isInteger(giri) || giri < 1 || giri > 10_000_000) throw new CifraturaNonSupportata('numero di giri non valido');
    const base = await subtle().importKey('raw', partenza as BufferSource, 'PBKDF2', false, ['deriveBits']);
    chiave = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-1', salt: sale as BufferSource, iterations: giri }, base, misura * 8));
  } else if (/argon2id$/.test(nome)) {
    chiave = argon2id(partenza, sale, { giri: Number(a['loext:argon2-iterations']), memoriaKiB: Number(a['loext:argon2-memory']), corsie: Number(a['loext:argon2-lanes']), lunghezza: misura });
  } else throw new CifraturaNonSupportata(`derivazione della chiave ${nome}`);
  const k = d.algoritmo === AES_GCM
    ? await subtle().importKey('raw', chiave as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    : await chiaveAes(chiave);
  cache.set(chiaveCache, k);
  return k;
}

/** Decifra e decomprime una parte; PasswordSbagliata se l'impronta (o il controllo di GCM) non torna. */
async function decifraParte(dati: Uint8Array, d: DatiCifratura, password: string, cache: Map<string, CryptoKey>): Promise<Uint8Array> {
  const k = await chiaveDi(d, password, cache);
  let compresso: Uint8Array;
  if (d.algoritmo === AES_GCM) {
    // come in XML Encryption 1.1: i dati sono vettore iniziale (12 byte), testo cifrato e controllo (16 byte)
    if (dati.length < 28) throw new CifraturaNonSupportata('parte cifrata troppo corta');
    try { compresso = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: dati.subarray(0, 12) as BufferSource, tagLength: 128 }, k, dati.subarray(12) as BufferSource)); } catch { throw new PasswordSbagliata(); }
  } else if (d.algoritmo === AES_CBC) {
    const grezzo = await decifraAes(k, d.iv, dati);
    // riempimento W3C: l'ultimo byte dice quanti byte togliere
    const n = grezzo[grezzo.length - 1];
    if (n < 1 || n > 16) throw new PasswordSbagliata();
    compresso = grezzo.subarray(0, grezzo.length - n);
    if (d.checksum) {
      const tipo = d.checksumTipo ?? '';
      const primo = compresso.subarray(0, 1024);
      const impronta = /sha256-1k$/i.test(tipo) ? await digest('SHA-256', primo) : /sha1-1k$|SHA1\/1K$/i.test(tipo) ? await digest('SHA-1', primo) : null;
      if (impronta && !uguali(impronta, d.checksum)) throw new PasswordSbagliata();
    }
  } else throw new CifraturaNonSupportata(/blowfish/i.test(d.algoritmo) ? 'cifratura Blowfish dei vecchi OpenOffice.org' : `algoritmo ${d.algoritmo}`);
  try { return await inflateGrezzo(compresso); } catch { throw new PasswordSbagliata(); }
}

/** Il manifesto senza i dati di cifratura (e con le dimensioni tolte): quello di un pacchetto in chiaro. */
function manifestoInChiaro(testo: string): string {
  return testo.replace(/<manifest:encryption-data[\s\S]*?<\/manifest:encryption-data>/g, '').replace(/\s*<manifest:file-entry([^>]*?)>\s*<\/manifest:file-entry>/g, '\n <manifest:file-entry$1/>');
}

/** Decifra un pacchetto OpenDocument con la password: dà i byte del pacchetto in chiaro (uno zip che i lettori aprono come sempre). */
export async function decifraOdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const voci = await leggiZip(bytes);
  const manifesto = voci.get(MANIFESTO);
  if (!manifesto) throw new CifraturaNonSupportata('manca il manifesto');
  const radice = analizzaXml(new TextDecoder().decode(manifesto));
  const cache = new Map<string, CryptoKey>();
  const voci2 = figliElemento(radice, 'manifest:file-entry');
  // il pacchetto cifrato tutto insieme: dentro c'è il pacchetto vero
  const intero = voci2.find((v) => v.attributi['manifest:full-path'] === 'encrypted-package');
  if (intero) {
    const d = datiCifratura(intero);
    const dati = voci.get('encrypted-package');
    if (!d || !dati) throw new CifraturaNonSupportata('pacchetto cifrato incompleto');
    return decifraParte(dati, d, password, cache);
  }
  const fuori: VoceZip[] = [];
  const cifrate = new Map<string, DatiCifratura>();
  for (const v of voci2) { const d = datiCifratura(v); if (d) cifrate.set(v.attributi['manifest:full-path'] ?? '', d); }
  let verificata = false;
  for (const [nome, dati] of voci) {
    if (nome === MANIFESTO) { fuori.push({ nome, dati: new TextEncoder().encode(manifestoInChiaro(new TextDecoder().decode(dati))) }); continue; }
    const d = cifrate.get(nome);
    if (!d) { fuori.push({ nome, dati, senzaCompressione: nome === 'mimetype' }); continue; }
    fuori.push({ nome, dati: await decifraParte(dati, d, password, cache) });
    verificata = true;
  }
  if (!verificata) throw new CifraturaNonSupportata('nessuna parte cifrata trovata');
  return scriviZip(fuori);
}

/**
 * Cifra un pacchetto OpenDocument in chiaro con la password, come prevede lo standard ODF: AES-256-CBC, PBKDF2 con 100000 giri,
 * chiave di partenza SHA-256, impronta sha256-1k. La miniatura (che mostrerebbe il contenuto) si toglie.
 */
export async function cifraOdf(bytes: Uint8Array, password: string, giri = GIRI_PBKDF2): Promise<Uint8Array> {
  const voci = await leggiZip(bytes);
  const manifesto = voci.get(MANIFESTO);
  if (!manifesto) throw new CifraturaNonSupportata('manca il manifesto');
  const radice = analizzaXml(new TextDecoder().decode(manifesto));
  const partenza = await digest('SHA-256', new TextEncoder().encode(password));
  const base = await subtle().importKey('raw', partenza as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const fuori: VoceZip[] = [];
  const cifratura = new Map<string, string>();
  for (const [nome, dati] of voci) {
    if (nome === MANIFESTO || nome.startsWith('Thumbnails/')) continue;
    if (nome === 'mimetype' || nome.endsWith('/') || dati.length === 0) { fuori.push({ nome, dati, senzaCompressione: nome === 'mimetype' }); continue; }
    const compresso = await deflateGrezzo(dati);
    const impronta = await digest('SHA-256', compresso.subarray(0, 1024));
    const sale = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const chiave = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-1', salt: sale as BufferSource, iterations: giri }, base, 256));
    const k = await chiaveAes(chiave);
    const cifrato = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, k, compresso as BufferSource));
    fuori.push({ nome, dati: cifrato, senzaCompressione: true });
    cifratura.set(nome, `<manifest:encryption-data manifest:checksum-type="${NS_MANIFESTO}#sha256-1k" manifest:checksum="${aBase64(impronta)}">`
      + `<manifest:algorithm manifest:algorithm-name="${AES_CBC}" manifest:initialisation-vector="${aBase64(iv)}"/>`
      + `<manifest:start-key-generation manifest:start-key-generation-name="http://www.w3.org/2000/09/xmldsig#sha256" manifest:key-size="32"/>`
      + `<manifest:key-derivation manifest:key-derivation-name="PBKDF2" manifest:key-size="32" manifest:iteration-count="${giri}" manifest:salt="${aBase64(sale)}"/>`
      + '</manifest:encryption-data>');
  }
  // il manifesto: le stesse voci (senza la miniatura), con dimensione e dati di cifratura per le parti cifrate
  const attributiRadice = Object.entries(radice.attributi).map(([k, v]) => ` ${k}="${escapaAttributo(v)}"`).join('');
  const righe = figliElemento(radice, 'manifest:file-entry')
    .filter((v) => !(v.attributi['manifest:full-path'] ?? '').startsWith('Thumbnails/'))
    .map((v) => {
      const percorso = v.attributi['manifest:full-path'] ?? '';
      const c = cifratura.get(percorso);
      const attr = Object.entries(v.attributi).filter(([k]) => k !== 'manifest:size').map(([k, x]) => ` ${k}="${escapaAttributo(x)}"`).join('');
      return c ? ` <manifest:file-entry${attr} manifest:size="${voci.get(percorso)!.length}">${c}</manifest:file-entry>` : ` <manifest:file-entry${attr}/>`;
    });
  // le parti cifrate che il manifesto non elencava (non dovrebbe succedere) si aggiungono: senza voce non si potrebbero decifrare
  const elencate = new Set(figliElemento(radice, 'manifest:file-entry').map((v) => v.attributi['manifest:full-path']));
  for (const [percorso, c] of cifratura) if (!elencate.has(percorso)) righe.push(` <manifest:file-entry manifest:full-path="${escapaAttributo(percorso)}" manifest:media-type="" manifest:size="${voci.get(percorso)!.length}">${c}</manifest:file-entry>`);
  const testo = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest${attributiRadice}>\n${righe.join('\n')}\n</manifest:manifest>`;
  const conMime = fuori.findIndex((v) => v.nome === 'mimetype');
  const ordinate = conMime >= 0 ? [fuori[conMime], ...fuori.filter((_, i) => i !== conMime)] : fuori;
  return scriviZip([...ordinate, { nome: MANIFESTO, dati: new TextEncoder().encode(testo) }]);
}
