// Lettura di file .rtf (Rich Text Format: WordPad, Word, LibreOffice) per pmb_docs.
// Puro: riceve i byte, restituisce un Documento. Si legge testo, grassetto, corsivo, sottolineato, barrato, carattere, corpo, colori,
// evidenziazione, allineamento, elenchi, tabelle, link e immagini png/jpeg. Il resto (stili, note, campi, oggetti) si salta senza errori.
import { dimensioniIniziali, immagineValida, normalizza, OGGETTO, urlValido, type AttributiParagrafo, type Documento, type Immagine, type Paragrafo, type Run } from '../modello/documento';
import { t } from '../i18n/lingua';

const PROFONDITA_MASSIMA = 200;
/** Parole di controllo che cambiano paragrafi e tabelle: dentro una parte saltata (intestazione, piè di pagina, nota, oggetto) non devono toccare
 *  il documento. Prima un \par in una nota spezzava il paragrafo in cui la nota si trova, e un \pard in un'intestazione toglieva l'allineamento. */
const STRUTTURA = new Set(['par', 'sect', 'page', 'line', 'pard', 'ql', 'qc', 'qr', 'qj', 'intbl', 'cell', 'nestcell', 'row', 'nestrow']);

interface Stato {
  g: boolean; c: boolean; s: boolean; x: boolean;
  z?: number; f?: string; cf: number; hl: number; uc: number; nascosto: boolean;
  u?: string;
  /** destinazione da saltare del tutto */
  salta: boolean;
  /** dove si raccoglie il testo di una destinazione speciale invece di scriverlo nel documento */
  raccolta?: 'fonttbl' | 'colortbl' | 'fldinst' | 'listtext' | 'pict';
}

const CODIFICHE: Record<number, string> = {
  437: 'ibm866', 874: 'windows-874', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5',
  1250: 'windows-1250', 1251: 'windows-1251', 1252: 'windows-1252', 1253: 'windows-1253', 1254: 'windows-1254',
  1255: 'windows-1255', 1256: 'windows-1256', 1257: 'windows-1257', 1258: 'windows-1258', 10000: 'macintosh',
};

const SIMBOLI: Record<string, string> = {
  emdash: '—', endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”',
  bullet: '•', emspace: ' ', enspace: ' ', qmspace: ' ', tab: '\t',
};

/** Destinazioni che non sono testo del documento. */
const DA_SALTARE = new Set([
  'stylesheet', 'info', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata', 'datastore', 'latentstyles', 'colorschememapping',
  'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf', 'footnote', 'annotation', 'object', 'shppict',
  'nonshppict', 'xmlnstbl', 'pgptbl', 'revtbl', 'private', 'userprops', 'factoidname', 'bkmkstart', 'bkmkend', 'fldtype', 'falt', 'panose',
  'fcharset', 'template', 'defchp', 'defpap', 'filetbl', 'wgrffmtfilter', 'mmathPr', 'pnseclvl', 'ftnsep', 'ftnsepc', 'aftnsep', 'aftnsepc',
]);

export function importaRtf(bytes: Uint8Array): Documento {
  const sorgente = Array.from({ length: Math.min(bytes.length, 8) }, (_, i) => String.fromCharCode(bytes[i])).join('');
  if (!sorgente.startsWith('{\\rtf')) throw new Error(t('File RTF non valido'));
  // RTF è ASCII: i caratteri speciali sono scritti con \'hh e \uN
  let testo = '';
  const BLOCCO = 32768;
  for (let i = 0; i < bytes.length; i += BLOCCO) testo += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + BLOCCO)));

  const colori: string[] = []; // l'indice 0 è «automatico» (voce vuota): lo crea il primo punto e virgola della tabella
  const font = new Map<number, string>();
  let codifica = 'windows-1252';
  let decoder = new TextDecoder(codifica);

  const paragrafi: Paragrafo[] = [];
  let runs: Run[] = [];
  let attr: AttributiParagrafo = {};
  let nelleTabelle = false; // \intbl attivo per il paragrafo corrente
  let tabella = 0, riga = 0, colonna = 0, inTabella = false;
  let urlCampo: string | undefined;
  let testoRaccolto = '';
  let rtfFontCorrente = -1;
  let rtfColoreCorrente: [number, number, number] = [-1, -1, -1];
  let pict: { tipo: 'png' | 'jpeg' | null; w: number; h: number; hex: string } = { tipo: null, w: 0, h: 0, hex: '' };

  const nuovoStato = (): Stato => ({ g: false, c: false, s: false, x: false, cf: 0, hl: 0, uc: 1, nascosto: false, salta: false });
  let st = nuovoStato();
  const pila: Stato[] = [];

  const run = (s: string): Run => {
    const r: Run = { t: s, g: st.g, c: st.c, s: st.s };
    if (st.x) r.x = 'b';
    if (st.z !== undefined) r.z = st.z;
    if (st.f) r.f = st.f;
    if (st.cf > 0 && colori[st.cf]) r.k = colori[st.cf];
    if (st.hl > 0 && colori[st.hl]) r.h = colori[st.hl];
    if (st.u) r.u = st.u;
    return r;
  };
  const scrivi = (s: string): void => {
    if (s === '' || st.salta || st.nascosto) return;
    if (st.raccolta === 'fonttbl' || st.raccolta === 'colortbl' || st.raccolta === 'fldinst' || st.raccolta === 'listtext' || st.raccolta === 'pict') { testoRaccolto += s; return; }
    runs.push(run(s));
  };
  const chiudiParagrafo = (): void => {
    const p: Paragrafo = { runs: normalizza(runs.length > 0 ? runs : [{ t: '', g: false, c: false, s: false }]), ...attr };
    if (nelleTabelle) {
      if (!inTabella) { tabella++; riga = 0; colonna = 0; inTabella = true; }
      p.tb = { i: tabella, r: riga, c: colonna };
    } else if (inTabella) {
      inTabella = false;
    }
    paragrafi.push(p);
    runs = [];
    // il tipo di elenco resta fino al \pard successivo
  };
  const chiudiCampoLink = (): void => {
    const m = /HYPERLINK\s+(?:\\[a-z]\s+)*"([^"]+)"/i.exec(testoRaccolto) ?? /HYPERLINK\s+(\S+)/i.exec(testoRaccolto);
    urlCampo = m && urlValido(m[1]) ? m[1] : undefined;
  };
  const decodificaByte = (b: number[]): string => {
    try { return decoder.decode(Uint8Array.from(b)); } catch { return ''; }
  };

  let i = 0;
  const n = testo.length;
  let pendenti: number[] = []; // byte \'hh in attesa di essere decodificati insieme (codifiche a più byte)
  let daSaltare = 0; // caratteri di ripiego dopo \uN
  const scaricaByte = (): void => { if (pendenti.length > 0) { scrivi(decodificaByte(pendenti)); pendenti = []; } };
  let primoDelGruppo = false;
  let profondita = 0;

  while (i < n) {
    const c = testo[i];
    if (c === '{') {
      scaricaByte();
      if (++profondita > PROFONDITA_MASSIMA) throw new Error(t('File RTF non valido'));
      pila.push({ ...st });
      primoDelGruppo = true;
      i++;
      continue;
    }
    if (c === '}') {
      scaricaByte();
      const chiuso = st;
      if (chiuso.raccolta === 'fldinst' && pila.length > 0 && pila[pila.length - 1].raccolta !== 'fldinst') chiudiCampoLink();
      if (chiuso.raccolta === 'listtext' && pila.length > 0 && pila[pila.length - 1].raccolta !== 'listtext') {
        const marcatore = testoRaccolto.replace(/[\s ]/g, '');
        attr.el = /^[0-9a-zA-Z]+[.)]?$/.test(marcatore) && marcatore !== '' ? 'n' : 'p';
      }
      if (chiuso.raccolta === 'pict' && pila.length > 0 && pila[pila.length - 1].raccolta !== 'pict') {
        if (pict.tipo && pict.hex.length >= 8) {
          try {
            const byte = new Uint8Array(pict.hex.length >> 1);
            for (let k = 0; k < byte.length; k++) byte[k] = parseInt(pict.hex.substr(k * 2, 2), 16);
            let b64 = '';
            for (let k = 0; k < byte.length; k += 8192) b64 += String.fromCharCode(...byte.subarray(k, k + 8192));
            const mime = pict.tipo === 'png' ? 'image/png' : 'image/jpeg';
            const { w, h } = dimensioniIniziali(pict.w > 0 ? pict.w : 300, pict.h > 0 ? pict.h : 200);
            const im: Immagine = { s: `data:${mime};base64,${btoa(b64)}`, w, h };
            if (immagineValida(im) && !st.salta) {
              const prima = pila[pila.length - 1];
              runs.push({ t: OGGETTO, g: prima.g, c: prima.c, s: prima.s, im });
            }
          } catch { /* immagine illeggibile: si salta */ }
        }
        pict = { tipo: null, w: 0, h: 0, hex: '' };
      }
      if (chiuso.raccolta === 'fonttbl' && pila.length > 0 && pila[pila.length - 1].raccolta !== 'fonttbl') { /* le voci si chiudono nel proprio gruppo */ }
      const prec = pila.pop();
      if (prec) st = prec;
      profondita = Math.max(0, profondita - 1);
      i++;
      continue;
    }
    if (c === '\\') {
      const succ = testo[i + 1];
      if (succ === undefined) break;
      // simboli di controllo
      if (!/[A-Za-z]/.test(succ)) {
        i += 2;
        if (succ === "'") {
          const hex = testo.substr(i, 2);
          i += 2;
          const v = parseInt(hex, 16);
          if (daSaltare > 0) { daSaltare--; continue; }
          if (Number.isFinite(v)) pendenti.push(v);
          continue;
        }
        scaricaByte();
        if (succ === '*') {
          // destinazione facoltativa: si salta, salvo i campi gestiti sotto
          if (primoDelGruppo) {
            const m = /^\\([a-z]+)/i.exec(testo.slice(i, i + 40));
            const nome = m ? m[1] : '';
            if (nome === 'fldinst') { st.raccolta = 'fldinst'; testoRaccolto = ''; }
            else if (nome === 'pn' || nome === 'listtext') { st.salta = true; }
            else if (nome === 'shppict') { /* contiene \pict: si legge */ }
            else st.salta = true;
          }
          primoDelGruppo = false;
          continue;
        }
        primoDelGruppo = false;
        if (succ === '\\' || succ === '{' || succ === '}') scrivi(succ);
        else if (succ === '~') scrivi(' ');
        else if (succ === '_') scrivi('‑');
        else if ((succ === '\n' || succ === '\r') && !st.salta) { chiudiParagrafo(); }
        continue;
      }
      // parola di controllo
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(testo[j])) j++;
      const nome = testo.slice(i + 1, j);
      let segno = 1;
      if (testo[j] === '-') { segno = -1; j++; }
      let k = j;
      while (k < n && testo[k] >= '0' && testo[k] <= '9') k++;
      const haNumero = k > j;
      const num = haNumero ? segno * parseInt(testo.slice(j, k), 10) : undefined;
      j = haNumero ? k : (segno === -1 ? j - 1 : j);
      if (testo[j] === ' ') j++; // lo spazio che chiude la parola di controllo
      i = j;
      const eraPrimo = primoDelGruppo;
      primoDelGruppo = false;
      if (nome !== 'u' && nome !== 'uc') scaricaByte();

      // destinazioni
      if (eraPrimo) {
        if (nome === 'fonttbl') { st.raccolta = 'fonttbl'; continue; }
        if (nome === 'colortbl') { st.raccolta = 'colortbl'; colori.length = 0; rtfColoreCorrente = [-1, -1, -1]; testoRaccolto = ''; continue; }
        if (nome === 'fldinst') { st.raccolta = 'fldinst'; testoRaccolto = ''; continue; }
        if (nome === 'fldrslt') { st.u = urlCampo; continue; }
        if (nome === 'listtext' || nome === 'pntext') { st.raccolta = 'listtext'; testoRaccolto = ''; continue; }
        if (nome === 'pict') { st.raccolta = 'pict'; pict = { tipo: null, w: 0, h: 0, hex: '' }; continue; }
        if (DA_SALTARE.has(nome)) { st.salta = true; continue; }
      }

      // \binN: seguono N byte di dati binari (oggetti incorporati), da saltare senza leggerli come testo o come parentesi dei gruppi
      if (nome === 'bin') { if (num !== undefined && num > 0) i = Math.min(n, i + num); continue; }
      if (st.salta && STRUTTURA.has(nome)) continue;
      switch (nome) {
        case 'ansicpg':
          if (num !== undefined) { codifica = CODIFICHE[num] ?? 'windows-1252'; try { decoder = new TextDecoder(codifica); } catch { decoder = new TextDecoder('windows-1252'); } }
          break;
        case 'uc': if (num !== undefined) st.uc = Math.max(0, Math.min(8, num)); break;
        case 'u': {
          if (num === undefined) break;
          scaricaByte();
          scrivi(String.fromCharCode(num < 0 ? num + 65536 : num));
          daSaltare = st.uc;
          break;
        }
        case 'f':
          if (st.raccolta === 'fonttbl') { rtfFontCorrente = num ?? -1; }
          else if (num !== undefined) { const nomeFont = font.get(num); st.f = nomeFont; }
          break;
        case 'fs': if (num !== undefined && num >= 2 && num <= 800) st.z = num / 2; break;
        case 'b': st.g = num !== 0; break;
        case 'i': st.c = num !== 0; break;
        case 'ul': case 'uld': case 'uldb': case 'ulw': case 'ulth': case 'uldash': st.s = num !== 0; break;
        case 'ulnone': st.s = false; break;
        case 'strike': case 'striked': st.x = num !== 0; break;
        case 'v': st.nascosto = num !== 0; break;
        case 'cf': if (num !== undefined) st.cf = num; break;
        case 'highlight': case 'chcbpat': if (num !== undefined) st.hl = num; break;
        case 'red': if (st.raccolta === 'colortbl') rtfColoreCorrente[0] = num ?? 0; break;
        case 'green': if (st.raccolta === 'colortbl') rtfColoreCorrente[1] = num ?? 0; break;
        case 'blue': if (st.raccolta === 'colortbl') rtfColoreCorrente[2] = num ?? 0; break;
        case 'plain': st.g = false; st.c = false; st.s = false; st.x = false; st.z = undefined; st.f = undefined; st.cf = 0; st.hl = 0; st.nascosto = false; break;
        case 'pard': attr = {}; nelleTabelle = false; break;
        case 'ql': delete attr.al; break;
        case 'qc': attr.al = 'ce'; break;
        case 'qr': attr.al = 'dx'; break;
        case 'qj': attr.al = 'gi'; break;
        case 'intbl': nelleTabelle = true; break;
        case 'par': case 'sect': case 'page': chiudiParagrafo(); break;
        case 'line': chiudiParagrafo(); break;
        case 'tab': scrivi('\t'); break;
        case 'cell': case 'nestcell': chiudiParagrafo(); colonna++; break;
        case 'row': case 'nestrow': riga++; colonna = 0; break;
        case 'pngblip': pict.tipo = 'png'; break;
        case 'jpegblip': pict.tipo = 'jpeg'; break;
        case 'picwgoal': if (num !== undefined) pict.w = Math.round(num / 15); break;
        case 'pichgoal': if (num !== undefined) pict.h = Math.round(num / 15); break;
        default:
          if (Object.prototype.hasOwnProperty.call(SIMBOLI, nome)) scrivi(SIMBOLI[nome]);
      }
      continue;
    }
    // testo semplice
    if (c === '\r' || c === '\n') { i++; continue; }
    if (daSaltare > 0) { daSaltare--; i++; continue; }
    primoDelGruppo = false;
    if (st.raccolta === 'pict') {
      let j = i;
      while (j < n && testo[j] !== '{' && testo[j] !== '}' && testo[j] !== '\\') j++;
      pict.hex += testo.slice(i, j).replace(/[^0-9a-fA-F]/g, '');
      i = j;
      continue;
    }
    // un blocco di testo fino al prossimo carattere speciale
    let j = i;
    while (j < n && testo[j] !== '{' && testo[j] !== '}' && testo[j] !== '\\' && testo[j] !== '\r' && testo[j] !== '\n') j++;
    let pezzo = testo.slice(i, j);
    i = j;
    if (daSaltare > 0) { const tolti = Math.min(daSaltare, pezzo.length); pezzo = pezzo.slice(tolti); daSaltare -= tolti; }
    if (st.raccolta === 'fonttbl') {
      // "Arial;" o "Times New Roman;": il nome finisce al punto e virgola
      testoRaccolto += pezzo;
      const fine = testoRaccolto.indexOf(';');
      if (fine >= 0) {
        const nomeFont = testoRaccolto.slice(0, fine).trim();
        if (rtfFontCorrente >= 0 && nomeFont !== '') font.set(rtfFontCorrente, nomeFont);
        testoRaccolto = '';
      }
      continue;
    }
    if (st.raccolta === 'colortbl') {
      for (const ch of pezzo) {
        if (ch === ';') {
          const [r, g, b] = rtfColoreCorrente;
          colori.push(r >= 0 ? `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}` : '');
          rtfColoreCorrente = [-1, -1, -1];
        }
      }
      continue;
    }
    // byte \'hh già letti ma non ancora scritti: si scrivono prima del testo che segue
    scaricaByte();
    scrivi(pezzo);
  }
  scaricaByte();
  if (runs.length > 0 || paragrafi.length === 0) chiudiParagrafo();
  return { paragrafi };
}
