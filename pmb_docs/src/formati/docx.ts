// Formato .docx (Word, Google Documenti, LibreOffice) per pmb_docs: esporta il documento e importa quelli degli altri.
// Si esportano testo, grassetto, corsivo, sottolineato, carattere, corpo, colori, allineamento, interlinea, elenchi,
// rientri e stili (Titolo, Sottotitolo, Titolo 1-3). Si importano gli stessi elementi; di quello che pmb_docs non ha
// (note, modifiche registrate) si conserva solo il testo dei paragrafi:
//   - i campi (indice, data, numeri di pagina nel testo) restano come testo, col valore che avevano;
//   - un'interruzione di riga dentro un paragrafo diventa un nuovo paragrafo; il testo cancellato dalle modifiche registrate non entra.
// Le tabelle (w:tbl) si esportano con bordi neri sottili, colonne di uguale larghezza e tutta la larghezza del testo; si importano
// righe e celle (le celle unite diventano una cella più celle vuote, le righe corte si completano con celle vuote, le tabelle
// dentro una cella diventano paragrafi della cella). Dopo ogni tabella resta sempre un paragrafo.
// Le immagini (png, jpeg, gif, webp) si esportano come immagini incorporate (w:drawing, file in word/media) e si importano da
// w:drawing, anche quelle di Word e Google Documenti; si ridimensionano per stare nel foglio e non si ingrandiscono.
// I link (w:hyperlink) si esportano con una relazione esterna per indirizzo e lo stile di carattere Hyperlink (azzurro, sottolineato);
// si importano anche quelli di Google Documenti, di Word e di LibreOffice, ma solo se l'indirizzo è http, https o mailto.
// L'intestazione e il piè di pagina (da 1 a 3 paragrafi, uguali su tutte le pagine) si esportano come word/header1.xml e word/footer1.xml,
// con i campi PAGE (numero della pagina) e NUMPAGES (numero delle pagine); si importano quelli "default" della sezione finale, anche di
// Word e Google Documenti (campi semplici e campi complessi), ridotti a testo semplice: allineamento, grassetto, corsivo, sottolineato,
// carattere, corpo e colori; senza link, immagini e tabelle, al massimo 3 paragrafi e 300 caratteri per paragrafo.
import { leggiZip, scriviZip, type VoceZip } from '@comune/formati/zip';
import { analizzaXml, elemento, escapaXml, figliElemento, profonditaXml, trova, type NodoXml } from '@comune/formati/xml';
import { t } from '../i18n/lingua';

/** Livelli di annidamento XML ammessi in un .docx importato. */
export const PROFONDITA_XML_MASSIMA = 256;
import {
  normalizza, urlValido, dimensioniIniziali, OGGETTO, CARATTERE_NORMALE, CORPO_NORMALE, CAMPO_PAGINA, CAMPO_PAGINE, RIGHE_MARGINE_MASSIME,
  impostaIntestazione, impostaPiede, nomeSegnalibroValido, spazioValido, bordoValido,
  type Allineamento, type AttributiParagrafo, type Documento, type Immagine, type Paragrafo, type Run, type StileParagrafo,
} from '../modello/documento';

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const INTESTAZIONE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ===================== esportazione =====================
const ID_STILE: Record<StileParagrafo, string | undefined> = { n: undefined, t: 'Title', s: 'Subtitle', '1': 'Heading1', '2': 'Heading2', '3': 'Heading3' };
const JC: Record<Allineamento, string> = { sx: 'left', ce: 'center', dx: 'right', gi: 'both' };
const PUNTI_ELENCO = ['●', '○', '■'];
const FORMATI_NUMERO = ['decimal', 'lowerLetter', 'lowerRoman'];

/** Colore "#rgb", "#rrggbb" o "#rrggbbaa" come "RRGGBB"; null se non è un colore. */
function esadecimale(c: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(c);
  if (!m) return null;
  const h = m[1];
  const sei = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  return sei.toUpperCase();
}

function proprietaRun(r: Run): string {
  const f: string[] = [];
  if (r.u !== undefined) f.push(elemento('w:rStyle', { 'w:val': 'Hyperlink' }));
  if (r.f !== undefined) f.push(elemento('w:rFonts', { 'w:ascii': r.f, 'w:hAnsi': r.f, 'w:eastAsia': r.f, 'w:cs': r.f }));
  if (r.g) f.push(elemento('w:b'));
  if (r.c) f.push(elemento('w:i'));
  if (r.x === 'b') f.push(elemento('w:strike'));
  const colore = r.k !== undefined ? esadecimale(r.k) : null;
  if (colore) f.push(elemento('w:color', { 'w:val': colore }));
  if (r.z !== undefined) {
    const mezzi = Math.round(r.z * 2);
    f.push(elemento('w:sz', { 'w:val': mezzi }), elemento('w:szCs', { 'w:val': mezzi }));
  }
  if (r.s) f.push(elemento('w:u', { 'w:val': 'single' }));
  const sfondo = r.h !== undefined ? esadecimale(r.h) : null;
  if (sfondo) f.push(elemento('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': sfondo }));
  if (r.v !== undefined) f.push(elemento('w:vertAlign', { 'w:val': r.v === 'p' ? 'superscript' : 'subscript' }));
  return f.length > 0 ? elemento('w:rPr', {}, f) : '';
}

function daBase64(b64: string): Uint8Array {
  const binario = atob(b64);
  const out = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
  return out;
}
function aBase64(dati: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dati.length; i += 0x8000) s += String.fromCharCode(...dati.subarray(i, i + 0x8000));
  return btoa(s);
}

function contenutoRun(t: string): string[] {
  const out: string[] = [];
  t.split('\t').forEach((pezzo, i) => {
    if (i > 0) out.push(elemento('w:tab'));
    if (pezzo !== '') out.push(elemento('w:t', { 'xml:space': 'preserve' }, [escapaXml(pezzo)]));
  });
  return out;
}

const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const EMU_PER_PIXEL = 9525;

/** Un'immagine incorporata nel testo: l'identificativo della relazione è quello del file in word/media. */
function disegnoXml(im: Immagine, idRelazione: string, numero: number): string {
  const cx = Math.round(im.w * EMU_PER_PIXEL);
  const cy = Math.round(im.h * EMU_PER_PIXEL);
  const nome = `Immagine ${numero}`;
  const immagine = elemento('pic:pic', { 'xmlns:pic': NS_PIC }, [
    elemento('pic:nvPicPr', {}, [elemento('pic:cNvPr', { id: numero, name: nome }), elemento('pic:cNvPicPr')]),
    elemento('pic:blipFill', {}, [elemento('a:blip', { 'r:embed': idRelazione }), elemento('a:stretch', {}, [elemento('a:fillRect')])]),
    elemento('pic:spPr', {}, [
      elemento('a:xfrm', {}, [elemento('a:off', { x: 0, y: 0 }), elemento('a:ext', { cx, cy })]),
      elemento('a:prstGeom', { prst: 'rect' }, [elemento('a:avLst')]),
    ]),
  ]);
  return elemento('w:drawing', {}, [elemento('wp:inline', { distT: 0, distB: 0, distL: 0, distR: 0 }, [
    elemento('wp:extent', { cx, cy }),
    elemento('wp:docPr', { id: numero, name: nome }),
    elemento('wp:cNvGraphicFramePr', {}, [elemento('a:graphicFrameLocks', { noChangeAspect: 1 })]),
    elemento('a:graphic', {}, [elemento('a:graphicData', { uri: NS_PIC }, [immagine])]),
  ])]);
}

/** Un tratto con dentro i campi del numero di pagina: il testo a pezzi e i campi semplici PAGE e NUMPAGES (con il formato del tratto). */
function campiXml(r: Run, rp: string): string {
  return r.t.split(/([\uE000\uE001])/).filter((x) => x !== '').map((pezzo) => {
    if (pezzo === CAMPO_PAGINA || pezzo === CAMPO_PAGINE) {
      return elemento('w:fldSimple', { 'w:instr': pezzo === CAMPO_PAGINA ? ' PAGE ' : ' NUMPAGES ' }, [elemento('w:r', {}, [...(rp !== '' ? [rp] : []), elemento('w:t', {}, ['1'])])]);
    }
    return elemento('w:r', {}, [...(rp !== '' ? [rp] : []), ...contenutoRun(pezzo)]);
  }).join('');
}

function paragrafoXml(par: Paragrafo, numId: number, idLink: (url: string) => string, idImmagine: (im: Immagine) => { id: string; numero: number }): string {
  // l'ordine dei figli di w:pPr è quello dello schema di Word: pStyle, pageBreakBefore, numPr, pBdr, spacing, ind, jc
  const p: string[] = [];
  const stile = par.st !== undefined ? ID_STILE[par.st] : undefined;
  if (stile) p.push(elemento('w:pStyle', { 'w:val': stile }));
  if (par.sp) p.push(elemento('w:pageBreakBefore'));
  if (par.el !== undefined && numId > 0) {
    p.push(elemento('w:numPr', {}, [elemento('w:ilvl', { 'w:val': par.ri ?? 0 }), elemento('w:numId', { 'w:val': numId })]));
  }
  if (par.bd) {
    const val = par.bd.s === 't' ? 'dashed' : par.bd.s === 'p' ? 'dotted' : 'single';
    const lato = (nome: string): string => elemento(nome, { 'w:val': val, 'w:sz': Math.round(par.bd!.w * 8), 'w:space': 4, 'w:color': par.bd!.c.slice(1).toUpperCase() });
    p.push(elemento('w:pBdr', {}, [lato('w:top'), lato('w:left'), lato('w:bottom'), lato('w:right')]));
  } else if (par.hr) p.push(elemento('w:pBdr', {}, [elemento('w:bottom', { 'w:val': 'single', 'w:sz': 6, 'w:space': 1, 'w:color': 'CCCCCC' })]));
  if (par.ls !== undefined || par.sb !== undefined || par.sa !== undefined) {
    const sp: Record<string, number | string> = {};
    if (par.sb !== undefined) sp['w:before'] = Math.round(par.sb * 20);
    if (par.sa !== undefined) sp['w:after'] = Math.round(par.sa * 20);
    if (par.ls !== undefined) { sp['w:line'] = Math.round(par.ls * 240); sp['w:lineRule'] = 'auto'; }
    p.push(elemento('w:spacing', sp));
  }
  if (par.el === undefined && par.ri !== undefined) p.push(elemento('w:ind', { 'w:left': par.ri * 720 }));
  if (par.al !== undefined) p.push(elemento('w:jc', { 'w:val': JC[par.al] }));
  const figli: string[] = [];
  if (p.length > 0) figli.push(elemento('w:pPr', {}, p));
  const runXml = (r: Run): string => {
    const rp = proprietaRun(r);
    if (r.im !== undefined) {
      const { id, numero } = idImmagine(r.im);
      return elemento('w:r', {}, [...(rp !== '' ? [rp] : []), disegnoXml(r.im, id, numero)]);
    }
    if (r.t.includes(CAMPO_PAGINA) || r.t.includes(CAMPO_PAGINE)) return campiXml(r, rp);
    return elemento('w:r', {}, [...(rp !== '' ? [rp] : []), ...contenutoRun(r.t)]);
  };
  for (let i = 0; i < par.runs.length;) {
    const u = par.runs[i].u;
    let j = i + 1;
    while (u !== undefined && j < par.runs.length && par.runs[j].u === u) j++;
    const gruppo = par.runs.slice(i, j).map(runXml);
    if (u !== undefined) figli.push(elemento('w:hyperlink', { 'r:id': idLink(u), 'w:history': 1 }, gruppo));
    else figli.push(...gruppo);
    i = j;
  }
  if (par.sg !== undefined) {
    const id = ++segnalibriScritti;
    const inizio = elemento('w:bookmarkStart', { 'w:id': id, 'w:name': nomeSegnalibroUnico(par.sg) });
    figli.splice(p.length > 0 ? 1 : 0, 0, inizio);
    figli.push(elemento('w:bookmarkEnd', { 'w:id': id }));
  }
  return elemento('w:p', {}, figli);
}

/** Numero progressivo dei segnalibri scritti nel file in preparazione (Word vuole un id diverso per ognuno). */
let segnalibriScritti = 0;
const nomiSegnalibriScritti = new Set<string>();
/** Il nome per Word, mai uguale a uno già scritto in questo file (Word ne tiene uno solo per nome: «a b» e «a_b» diventerebbero lo stesso). */
function nomeSegnalibroUnico(nome: string): string {
  const base = nomeSegnalibroDocx(nome);
  let n = base;
  for (let k = 2; nomiSegnalibriScritti.has(n.toLowerCase()); k++) n = `${base.slice(0, 37 - String(k).length)}_${k}`;
  nomiSegnalibriScritti.add(n.toLowerCase());
  return n;
}
/** Word ammette nei nomi dei segnalibri solo lettere, cifre e trattino basso, al massimo 40 caratteri, e comincia con una lettera. */
function nomeSegnalibroDocx(nome: string): string {
  let n = nome.replace(/[^\p{L}\p{N}_]/gu, '_').slice(0, 40);
  if (!/^\p{L}/u.test(n)) n = ('S_' + n).slice(0, 40);
  return n;
}

const LARGHEZZA_TESTO = 9026;

function tabellaXml(pars: Paragrafo[], xmlParagrafo: (p: Paragrafo) => string): string {
  const righe: Paragrafo[][][] = [];
  for (const p of pars) {
    const { r, c } = p.tb as { r: number; c: number };
    ((righe[r] ??= [])[c] ??= []).push(p);
  }
  const colonne = righe[0].length;
  const larghezza = Math.floor(LARGHEZZA_TESTO / colonne);
  const bordo = (nome: string): string => elemento(nome, { 'w:val': 'single', 'w:sz': 4, 'w:space': 0, 'w:color': '000000' });
  const margine = (nome: string): string => elemento(nome, { 'w:w': 100, 'w:type': 'dxa' });
  const proprieta = elemento('w:tblPr', {}, [
    elemento('w:tblW', { 'w:w': larghezza * colonne, 'w:type': 'dxa' }),
    elemento('w:tblBorders', {}, ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:insideH', 'w:insideV'].map(bordo)),
    elemento('w:tblLayout', { 'w:type': 'fixed' }),
    elemento('w:tblCellMar', {}, ['w:top', 'w:left', 'w:bottom', 'w:right'].map(margine)),
  ]);
  const griglia = elemento('w:tblGrid', {}, Array.from({ length: colonne }, () => elemento('w:gridCol', { 'w:w': larghezza })));
  const righeXml = righe.map((riga) => elemento('w:tr', {}, riga.map((cella) => elemento('w:tc', {}, [
    elemento('w:tcPr', {}, [elemento('w:tcW', { 'w:w': larghezza, 'w:type': 'dxa' })]),
    ...cella.map(xmlParagrafo),
  ]))));
  return elemento('w:tbl', {}, [proprieta, griglia, ...righeXml]);
}

function stileXml(id: string, nome: string, extra: { pPr?: string[]; rPr?: string[]; ripetizione?: boolean }): string {
  const figli = [
    elemento('w:name', { 'w:val': nome }),
    elemento('w:basedOn', { 'w:val': 'Normal' }),
    elemento('w:next', { 'w:val': 'Normal' }),
    elemento('w:qFormat'),
  ];
  if (extra.pPr) figli.push(elemento('w:pPr', {}, extra.pPr));
  if (extra.rPr) figli.push(elemento('w:rPr', {}, extra.rPr));
  return elemento('w:style', { 'w:type': 'paragraph', 'w:styleId': id }, figli);
}

function stiliXml(conLink = false): string {
  const sz = (mezzi: number): string[] => [elemento('w:sz', { 'w:val': mezzi }), elemento('w:szCs', { 'w:val': mezzi })];
  const titolo = (prima: number, dopo: number, livello: number): string[] => [
    elemento('w:keepNext'), elemento('w:keepLines'), elemento('w:spacing', { 'w:before': prima, 'w:after': dopo }), elemento('w:outlineLvl', { 'w:val': livello }),
  ];
  const stili = [
    elemento('w:style', { 'w:type': 'paragraph', 'w:default': 1, 'w:styleId': 'Normal' }, [elemento('w:name', { 'w:val': 'Normal' }), elemento('w:qFormat')]),
    stileXml('Heading1', 'heading 1', { pPr: titolo(400, 120, 0), rPr: sz(40) }),
    stileXml('Heading2', 'heading 2', { pPr: titolo(360, 120, 1), rPr: sz(32) }),
    stileXml('Heading3', 'heading 3', { pPr: titolo(320, 80, 2), rPr: [elemento('w:color', { 'w:val': '434343' }), ...sz(28)] }),
    stileXml('Title', 'Title', { pPr: [elemento('w:keepNext'), elemento('w:keepLines'), elemento('w:spacing', { 'w:after': 60 })], rPr: sz(52) }),
    stileXml('Subtitle', 'Subtitle', { pPr: [elemento('w:keepNext'), elemento('w:keepLines'), elemento('w:spacing', { 'w:after': 320 })], rPr: [elemento('w:color', { 'w:val': '666666' }), ...sz(30)] }),
  ];
  const predefiniti = elemento('w:docDefaults', {}, [
    elemento('w:rPrDefault', {}, [elemento('w:rPr', {}, [
      elemento('w:rFonts', { 'w:ascii': CARATTERE_NORMALE, 'w:hAnsi': CARATTERE_NORMALE, 'w:eastAsia': CARATTERE_NORMALE, 'w:cs': CARATTERE_NORMALE }),
      ...sz(CORPO_NORMALE * 2),
      elemento('w:lang', { 'w:val': 'it-IT', 'w:eastAsia': 'it-IT', 'w:bidi': 'ar-SA' }),
    ])]),
    elemento('w:pPrDefault', {}, [elemento('w:pPr', {}, [elemento('w:spacing', { 'w:after': 0, 'w:line': 276, 'w:lineRule': 'auto' })])]),
  ]);
  if (conLink) {
    stili.push(
      elemento('w:style', { 'w:type': 'character', 'w:default': 1, 'w:styleId': 'DefaultParagraphFont' }, [elemento('w:name', { 'w:val': 'Default Paragraph Font' })]),
      elemento('w:style', { 'w:type': 'character', 'w:styleId': 'Hyperlink' }, [
        elemento('w:name', { 'w:val': 'Hyperlink' }),
        elemento('w:basedOn', { 'w:val': 'DefaultParagraphFont' }),
        elemento('w:rPr', {}, [elemento('w:color', { 'w:val': '1155CC' }), elemento('w:u', { 'w:val': 'single' })]),
      ]),
    );
  }
  return INTESTAZIONE + elemento('w:styles', { 'xmlns:w': NS_W }, [predefiniti, ...stili]);
}

function livelloElenco(i: number, tipo: 'p' | 'n' | 'vuota' | 'spuntata'): string {
  const sinistra = 720 * (i + 1);
  const numerato = tipo === 'n';
  const testo = numerato ? `%${i + 1}.` : tipo === 'vuota' ? '☐' : tipo === 'spuntata' ? '☑' : PUNTI_ELENCO[i % 3];
  return elemento('w:lvl', { 'w:ilvl': i }, [
    elemento('w:start', { 'w:val': 1 }),
    elemento('w:numFmt', { 'w:val': numerato ? FORMATI_NUMERO[i % 3] : 'bullet' }),
    elemento('w:lvlText', { 'w:val': testo }),
    elemento('w:lvlJc', { 'w:val': 'left' }),
    elemento('w:pPr', {}, [elemento('w:ind', { 'w:left': sinistra, 'w:hanging': 360 })]),
  ]);
}

/** numId delle voci di elenco di attività: casella vuota e casella spuntata (fuori dalla serie 3, 4, ... dei gruppi numerati). */
const NUM_ATTIVITA_VUOTA = 1000;
const NUM_ATTIVITA_FATTA = 1001;

function numerazioneXml(gruppiNumerati: number[], conAttivita: boolean): string {
  const livelli = (tipo: 'p' | 'n' | 'vuota' | 'spuntata'): string[] => Array.from({ length: 9 }, (_, i) => livelloElenco(i, tipo));
  const astratto = (id: number, tipo: 'p' | 'n' | 'vuota' | 'spuntata'): string => elemento('w:abstractNum', { 'w:abstractNumId': id }, [elemento('w:multiLevelType', { 'w:val': 'hybridMultilevel' }), ...livelli(tipo)]);
  const astratti = [
    astratto(1, 'p'),
    astratto(2, 'n'),
    ...(conAttivita ? [astratto(3, 'vuota'), astratto(4, 'spuntata')] : []),
  ];
  const numeri = [
    ...(conAttivita ? [
      elemento('w:num', { 'w:numId': NUM_ATTIVITA_VUOTA }, [elemento('w:abstractNumId', { 'w:val': 3 })]),
      elemento('w:num', { 'w:numId': NUM_ATTIVITA_FATTA }, [elemento('w:abstractNumId', { 'w:val': 4 })]),
    ] : []),
    elemento('w:num', { 'w:numId': 1 }, [elemento('w:abstractNumId', { 'w:val': 1 })]),
    elemento('w:num', { 'w:numId': 2 }, [elemento('w:abstractNumId', { 'w:val': 2 })]),
    ...gruppiNumerati.map((id) => elemento('w:num', { 'w:numId': id }, [
      elemento('w:abstractNumId', { 'w:val': 2 }),
      ...Array.from({ length: 9 }, (_, i) => elemento('w:lvlOverride', { 'w:ilvl': i }, [elemento('w:startOverride', { 'w:val': 1 })])),
    ])),
  ];
  return INTESTAZIONE + elemento('w:numbering', { 'xmlns:w': NS_W }, [...astratti, ...numeri]);
}

export async function esportaDocx(doc: Documento): Promise<Uint8Array> {
  segnalibriScritti = 0;
  nomiSegnalibriScritti.clear();
  const gruppiNumerati: number[] = [];
  let precedenteNumerato = false;
  let usaAttivita = false;
  let idCorrente = 0;
  const collegamenti = new Map<string, string>();
  let prossimoId = 3;
  const idLink = (url: string): string => {
    let id = collegamenti.get(url);
    if (id === undefined) { id = `rId${prossimoId++}`; collegamenti.set(url, id); }
    return id;
  };
  let disegni = 0;
  const media = new Map<string, { id: string; numero: number; nome: string; estensione: string; mime: string; dati: Uint8Array }>();
  const idImmagine = (im: Immagine): { id: string; numero: number } => {
    let m = media.get(im.s);
    if (m === undefined) {
      const tipo = /^data:image\/(png|jpeg|gif|webp);base64,(.*)$/.exec(im.s) as RegExpExecArray;
      const numero = media.size + 1;
      m = { id: `rId${prossimoId++}`, numero, nome: `image${numero}.${tipo[1]}`, estensione: tipo[1], mime: `image/${tipo[1]}`, dati: daBase64(tipo[2]) };
      media.set(im.s, m);
    }
    return { id: m.id, numero: ++disegni };
  };
  const xmlParagrafo = (par: Paragrafo): string => {
    let numId = -1;
    if (par.el === 'p') numId = 1;
    else if (par.el === 't') { numId = par.fa ? NUM_ATTIVITA_FATTA : NUM_ATTIVITA_VUOTA; usaAttivita = true; }
    else if (par.el === 'n') {
      if (!precedenteNumerato) { idCorrente = 3 + gruppiNumerati.length; gruppiNumerati.push(idCorrente); }
      numId = idCorrente;
    }
    precedenteNumerato = par.el === 'n';
    return paragrafoXml(par, numId, idLink, idImmagine);
  };
  const paragrafi: string[] = [];
  const tutti = doc.paragrafi;
  for (let k = 0; k < tutti.length;) {
    const tb = tutti[k].tb;
    if (!tb) { paragrafi.push(xmlParagrafo(tutti[k])); k++; continue; }
    let fine = k;
    while (fine < tutti.length && tutti[fine].tb?.i === tb.i) fine++;
    paragrafi.push(tabellaXml(tutti.slice(k, fine), xmlParagrafo));
    k = fine;
    // dopo una tabella in fondo, o prima di un'altra tabella, Word vuole un paragrafo
    if (k >= tutti.length || tutti[k].tb) paragrafi.push(elemento('w:p'));
  }
  const margini: Array<{ id: string; file: string; radice: string; riferimento: string; relazione: string; paragrafi: Paragrafo[] }> = [];
  if (doc.intestazione !== undefined) margini.push({ id: `rId${prossimoId++}`, file: 'header1.xml', radice: 'w:hdr', riferimento: 'w:headerReference', relazione: 'header', paragrafi: doc.intestazione });
  if (doc.piede !== undefined) margini.push({ id: `rId${prossimoId++}`, file: 'footer1.xml', radice: 'w:ftr', riferimento: 'w:footerReference', relazione: 'footer', paragrafi: doc.piede });
  const nessunLegame = (): never => { throw new Error(t('Intestazione o piè di pagina non validi: niente link né immagini')); };
  const partiMargine = margini.map((m) => INTESTAZIONE + elemento(m.radice, { 'xmlns:w': NS_W, 'xmlns:r': NS_R }, m.paragrafi.map((p) => paragrafoXml({ ...(p.al !== undefined ? { al: p.al } : {}), runs: p.runs }, -1, nessunLegame, nessunLegame))));
  const sezione = elemento('w:sectPr', {}, [
    ...margini.map((m) => elemento(m.riferimento, { 'w:type': 'default', 'r:id': m.id })),
    elemento('w:pgSz', { 'w:w': 11906, 'w:h': 16838 }),
    elemento('w:pgMar', { 'w:top': 1440, 'w:right': 1440, 'w:bottom': 1440, 'w:left': 1440, 'w:header': 708, 'w:footer': 708, 'w:gutter': 0 }),
  ]);
  const documento = INTESTAZIONE + elemento('w:document', { 'xmlns:w': NS_W, 'xmlns:r': NS_R, 'xmlns:wp': NS_WP, 'xmlns:a': NS_A }, [elemento('w:body', {}, [...paragrafi, sezione])]);
  const tipo = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  const contenuti = INTESTAZIONE + elemento('Types', { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' }, [
    elemento('Default', { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }),
    elemento('Default', { Extension: 'xml', ContentType: 'application/xml' }),
    ...Array.from(new Set(Array.from(media.values(), (m) => m.estensione)), (e) => elemento('Default', { Extension: e, ContentType: `image/${e}` })),
    elemento('Override', { PartName: '/word/document.xml', ContentType: `${tipo}.document.main+xml` }),
    elemento('Override', { PartName: '/word/styles.xml', ContentType: `${tipo}.styles+xml` }),
    elemento('Override', { PartName: '/word/numbering.xml', ContentType: `${tipo}.numbering+xml` }),
    ...margini.map((m) => elemento('Override', { PartName: `/word/${m.file}`, ContentType: `${tipo}.${m.relazione}+xml` })),
  ]);
  const relazioni = INTESTAZIONE + elemento('Relationships', { xmlns: NS_PKG }, [
    elemento('Relationship', { Id: 'rId1', Type: `${NS_R}/officeDocument`, Target: 'word/document.xml' }),
  ]);
  const relazioniDocumento = INTESTAZIONE + elemento('Relationships', { xmlns: NS_PKG }, [
    elemento('Relationship', { Id: 'rId1', Type: `${NS_R}/styles`, Target: 'styles.xml' }),
    elemento('Relationship', { Id: 'rId2', Type: `${NS_R}/numbering`, Target: 'numbering.xml' }),
    ...Array.from(collegamenti, ([url, id]) => elemento('Relationship', { Id: id, Type: `${NS_R}/hyperlink`, Target: url, TargetMode: 'External' })),
    ...Array.from(media.values(), (m) => elemento('Relationship', { Id: m.id, Type: `${NS_R}/image`, Target: `media/${m.nome}` })),
    ...margini.map((m) => elemento('Relationship', { Id: m.id, Type: `${NS_R}/${m.relazione}`, Target: m.file })),
  ]);
  const enc = new TextEncoder();
  const voci: VoceZip[] = [
    { nome: '[Content_Types].xml', dati: enc.encode(contenuti) },
    { nome: '_rels/.rels', dati: enc.encode(relazioni) },
    { nome: 'word/document.xml', dati: enc.encode(documento) },
    { nome: 'word/_rels/document.xml.rels', dati: enc.encode(relazioniDocumento) },
    { nome: 'word/styles.xml', dati: enc.encode(stiliXml(collegamenti.size > 0)) },
    { nome: 'word/numbering.xml', dati: enc.encode(numerazioneXml(gruppiNumerati, usaAttivita)) },
    ...Array.from(media.values(), (m) => ({ nome: `word/media/${m.nome}`, dati: m.dati })),
    ...margini.map((m, i) => ({ nome: `word/${m.file}`, dati: enc.encode(partiMargine[i]) })),
  ];
  return scriviZip(voci);
}

// ===================== importazione =====================
const EVIDENZIA: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080',
  darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080',
  lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

interface Contesto {
  stili: Map<string, StileParagrafo>;
  /** formato di numerazione per numId e livello: "bullet", "decimal", "none", ... */
  numeri: Map<string, Map<number, string>>;
  carattere: string;
  corpo: number;
  tema: { minore?: string; maggiore?: string };
  /** indirizzi dei link per identificativo di relazione (solo quelli ammessi) */
  link: Map<string, string>;
  /** immagini incorporate per identificativo di relazione, già pronte (solo quelle ammesse) */
  immagini: Map<string, string>;
  /** dentro un'intestazione o un piè di pagina: i campi PAGE e NUMPAGES diventano i campi del numero di pagina */
  campi?: boolean;
  /** un'interruzione di pagina (w:br type=page) è stata letta: il prossimo paragrafo comincia su un foglio nuovo */
  saltoPendente?: boolean;
  /** spaziatura (prima, dopo, interlinea, spaziatura contestuale) in vigore per uno stile di paragrafo, o per lo stile predefinito se manca */
  spazio?: (stile?: string) => SpazioStile;
  /** note a piè di pagina e di chiusura: testi per chiave (f<id>, e<id>) e note incontrate nel testo, nell'ordine */
  note?: { testi: Map<string, string>; usate: Array<{ numero: number; testo: string }> };
}

const val = (n: NodoXml | undefined, nome = 'w:val'): string | undefined => n?.attributi[nome];
function attivo(n: NodoXml | undefined): boolean {
  if (!n) return false;
  const v = n.attributi['w:val'];
  return !(v === '0' || v === 'false' || v === 'off');
}

function stileDaNome(nome: string): StileParagrafo | undefined {
  const m = /^(?:heading|titolo) ?([1-9])$/.exec(nome.toLowerCase());
  if (m) return Number(m[1]) <= 3 ? (m[1] as StileParagrafo) : '3';
  const n = nome.toLowerCase();
  if (n === 'title' || n === 'titolo') return 't';
  if (n === 'subtitle' || n === 'sottotitolo') return 's';
  return undefined;
}

function leggiStili(radice: NodoXml | null): { stili: Map<string, StileParagrafo>; carattere?: string; corpo?: number; temaCarattere?: string } {
  const stili = new Map<string, StileParagrafo>();
  let carattere: string | undefined;
  let corpo: number | undefined;
  let temaCarattere: string | undefined;
  if (!radice) return { stili };
  const leggiRPr = (rPr: NodoXml | undefined): void => {
    if (!rPr) return;
    const rf = trova(rPr, 'w:rFonts');
    const nome = rf?.attributi['w:ascii'] ?? rf?.attributi['w:hAnsi'];
    if (nome) { carattere = nome; temaCarattere = undefined; }
    else if (rf) { const t = rf.attributi['w:asciiTheme'] ?? rf.attributi['w:hAnsiTheme']; if (t) { temaCarattere = t; carattere = undefined; } }
    const sz = Number(val(trova(rPr, 'w:sz')));
    if (Number.isFinite(sz) && sz > 0) corpo = sz / 2;
  };
  leggiRPr(trova(radice, 'w:docDefaults/w:rPrDefault/w:rPr'));
  for (const s of figliElemento(radice, 'w:style')) {
    if (s.attributi['w:type'] !== 'paragraph') continue;
    const id = s.attributi['w:styleId'];
    if (!id) continue;
    const nome = val(trova(s, 'w:name')) ?? id;
    const st = stileDaNome(nome) ?? stileDaNome(id);
    if (st) stili.set(id, st);
    if (s.attributi['w:default'] === '1' || s.attributi['w:default'] === 'true') leggiRPr(trova(s, 'w:rPr'));
  }
  return { stili, carattere, corpo, temaCarattere };
}

function leggiNumerazione(radice: NodoXml | null): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  if (!radice) return out;
  const astratti = new Map<string, Map<number, string>>();
  for (const a of figliElemento(radice, 'w:abstractNum')) {
    const livelli = new Map<number, string>();
    for (const l of figliElemento(a, 'w:lvl')) {
      const formato = val(trova(l, 'w:numFmt')) ?? 'decimal';
      const simbolo = val(trova(l, 'w:lvlText')) ?? '';
      // casella da spuntare: pmb_docs le scrive come elenco puntato il cui simbolo è ☐ o ☑ (Word usa anche altri simboli, che restano puntini)
      livelli.set(Number(l.attributi['w:ilvl'] ?? 0), formato === 'bullet' && simbolo === '☐' ? 'attivita' : formato === 'bullet' && simbolo === '☑' ? 'attivita-fatta' : formato);
    }
    astratti.set(a.attributi['w:abstractNumId'] ?? '', livelli);
  }
  for (const n of figliElemento(radice, 'w:num')) {
    const a = astratti.get(val(trova(n, 'w:abstractNumId')) ?? '');
    if (a) out.set(n.attributi['w:numId'] ?? '', a);
  }
  return out;
}

function leggiTema(radice: NodoXml | null): { minore?: string; maggiore?: string } {
  if (!radice) return {};
  const tipo = (nome: string): string | undefined => {
    const t = trova(radice, `a:themeElements/a:fontScheme/${nome}/a:latin`);
    const v = t?.attributi['typeface'];
    return v ? v : undefined;
  };
  return { minore: tipo('a:minorFont'), maggiore: tipo('a:majorFont') };
}

/** Spaziatura di un paragrafo di Word: prima e dopo in punti, interlinea come moltiplicatore (solo la regola "auto"), spaziatura contestuale. */
interface SpazioStile { sb?: number; sa?: number; line?: number; contestuale?: boolean }
function leggiSpazio(sp: NodoXml | undefined | null): SpazioStile {
  const o: SpazioStile = {};
  if (!sp) return o;
  const n = (k: string): number | undefined => { const v = Number(sp.attributi[k]); return sp.attributi[k] !== undefined && Number.isFinite(v) && v >= 0 ? v : undefined; };
  const prima = n('w:before'); if (prima !== undefined && sp.attributi['w:beforeAutospacing'] !== '1') o.sb = prima / 20;
  const dopo = n('w:after'); if (dopo !== undefined && sp.attributi['w:afterAutospacing'] !== '1') o.sa = dopo / 20;
  if ((sp.attributi['w:lineRule'] ?? 'auto') === 'auto') { const l = Number(sp.attributi['w:line']); if (Number.isFinite(l) && l > 0) o.line = l / 240; }
  else if (sp.attributi['w:line'] !== undefined) o.line = 0; // interlinea esatta o minima: pmb_docs non la rappresenta, ma deve annullare quella ereditata
  return o;
}
/** Costruisce la funzione che dà la spaziatura effettiva di uno stile: predefiniti del documento, poi la catena degli stili da cui deriva. */
function creaSpazio(radice: NodoXml | null): (stile?: string) => SpazioStile {
  if (!radice) return () => ({});
  const predefiniti = leggiSpazio(trova(radice, 'w:docDefaults/w:pPrDefault/w:pPr/w:spacing'));
  const stili = new Map<string, { base?: string; sp: SpazioStile }>();
  let predefinito: string | undefined;
  for (const s of figliElemento(radice, 'w:style')) {
    if (s.attributi['w:type'] !== 'paragraph') continue;
    const id = s.attributi['w:styleId'];
    if (!id) continue;
    const sp = leggiSpazio(trova(s, 'w:pPr/w:spacing'));
    const cs = trova(s, 'w:pPr/w:contextualSpacing');
    if (cs) sp.contestuale = val(cs) !== '0' && val(cs) !== 'false';
    stili.set(id, { base: val(trova(s, 'w:basedOn')), sp });
    if (s.attributi['w:default'] === '1' || s.attributi['w:default'] === 'true') predefinito = id;
  }
  return (id) => {
    const catena: SpazioStile[] = [];
    const visti = new Set<string>();
    for (let cur = id ?? predefinito; cur !== undefined && !visti.has(cur); ) {
      const x = stili.get(cur);
      if (!x) break;
      visti.add(cur);
      catena.unshift(x.sp);
      cur = x.base;
    }
    return Object.assign({}, predefiniti, ...catena) as SpazioStile;
  };
}

type AttributiConStile = AttributiParagrafo & { __cs?: string };
function leggiPPr(pPr: NodoXml | undefined, ctx: Contesto): AttributiParagrafo {
  const a: AttributiConStile = {};
  if (!pPr) { aggiungiSpazio(a, undefined, undefined, ctx); return a; }
  if (attivo(trova(pPr, 'w:pageBreakBefore'))) a.sp = true;
  const pBdr = trova(pPr, 'w:pBdr');
  if (pBdr) {
    // un bordo su due lati o più è un bordo attorno al paragrafo; la sola linea sotto è la linea orizzontale di pmb_docs
    const lati = ['w:top', 'w:left', 'w:bottom', 'w:right'].map((n) => trova(pBdr, n)).filter((x): x is NodoXml => !!x && (x.attributi['w:val'] ?? 'single') !== 'nil' && x.attributi['w:val'] !== 'none');
    if (lati.length >= 2) {
      const v = lati[0].attributi['w:val'] ?? 'single';
      const sz = Number(lati[0].attributi['w:sz']);
      const col = (lati[0].attributi['w:color'] ?? '000000').replace('#', '');
      const bordo = bordoValido({ w: Number.isFinite(sz) && sz > 0 ? sz / 8 : 1, c: /^[0-9a-fA-F]{6}$/.test(col) ? `#${col}` : '#000000', s: /dash/i.test(v) ? 't' : /dot/i.test(v) ? 'p' : 'c' });
      if (bordo) a.bd = bordo;
    } else if (trova(pBdr, 'w:bottom')) a.hr = true;
  }
  const stile = val(trova(pPr, 'w:pStyle'));
  const st = stile !== undefined ? ctx.stili.get(stile) : undefined;
  if (st) a.st = st;
  const jc = val(trova(pPr, 'w:jc'));
  if (jc === 'center') a.al = 'ce';
  else if (jc === 'right' || jc === 'end') a.al = 'dx';
  else if (jc === 'both' || jc === 'distribute') a.al = 'gi';
  aggiungiSpazio(a, trova(pPr, 'w:spacing'), stile, ctx);
  const numPr = trova(pPr, 'w:numPr');
  let inElenco = false;
  if (numPr) {
    const numId = val(trova(numPr, 'w:numId'));
    const livello = Math.min(8, Math.max(0, Number(val(trova(numPr, 'w:ilvl')) ?? 0) || 0));
    const formato = numId !== undefined && numId !== '0' ? ctx.numeri.get(numId)?.get(livello) : undefined;
    if (formato !== undefined && formato !== 'none') {
      inElenco = true;
      if (formato === 'attivita' || formato === 'attivita-fatta') { a.el = 't'; if (formato === 'attivita-fatta') a.fa = true; } else a.el = formato === 'bullet' ? 'p' : 'n';
      if (livello > 0) a.ri = livello;
    }
  }
  if (!inElenco) {
    const ind = trova(pPr, 'w:ind');
    const sinistra = Number(ind?.attributi['w:left'] ?? ind?.attributi['w:start']);
    if (Number.isFinite(sinistra) && sinistra >= 360) a.ri = Math.min(8, Math.max(1, Math.round(sinistra / 720)));
  }
  return a;
}

/** Mette nel paragrafo prima/dopo e interlinea: quelli scritti nel paragrafo, altrimenti quelli dello stile (stili con aspetto proprio come Titolo: margini già nel disegno). */
function aggiungiSpazio(a: AttributiConStile, sp: NodoXml | undefined, stile: string | undefined, ctx: Contesto): void {
  const eff = ctx.spazio ? ctx.spazio(stile) : {};
  const dir = leggiSpazio(sp);
  const proprio = a.st !== undefined && a.st !== 'n';
  const sb = spazioValido(dir.sb ?? (proprio ? undefined : eff.sb));
  const sa = spazioValido(dir.sa ?? (proprio ? undefined : eff.sa));
  if (sb !== undefined) a.sb = sb;
  if (sa !== undefined) a.sa = sa;
  const riga = dir.line ?? (proprio ? undefined : eff.line);
  if (riga !== undefined && riga > 0) {
    const ls = Math.round(riga * 100) / 100;
    if (ls >= 0.5 && ls <= 5 && ls !== 1.15) a.ls = ls;
  }
  if (!proprio && eff.contestuale && dir.sb === undefined && dir.sa === undefined) a.__cs = stile ?? '';
}

/** Spaziatura contestuale (elenchi di Word): tra due paragrafi consecutivi con lo stesso stile non c'è spazio. Toglie anche il segno interno. */
function applicaSpazioContestuale(paragrafi: Paragrafo[]): Paragrafo[] {
  const out = paragrafi.map((p) => ({ ...p })) as Array<Paragrafo & { __cs?: string }>;
  for (let i = 0; i + 1 < out.length; i++) {
    const cs = out[i].__cs;
    if (cs !== undefined && out[i + 1].__cs === cs) { delete out[i].sa; delete out[i + 1].sb; }
  }
  for (const p of out) delete p.__cs;
  return out;
}

function leggiFormatoRun(rPr: NodoXml | undefined, ctx: Contesto): Omit<Run, 't'> {
  const f: Omit<Run, 't'> = { g: false, c: false, s: false };
  let carattere = ctx.carattere;
  let corpo = ctx.corpo;
  if (rPr) {
    f.g = attivo(trova(rPr, 'w:b'));
    f.c = attivo(trova(rPr, 'w:i'));
    const u = trova(rPr, 'w:u');
    f.s = !!u && val(u) !== 'none';
    if (attivo(trova(rPr, 'w:strike'))) f.x = 'b';
    const va = val(trova(rPr, 'w:vertAlign'));
    if (va === 'superscript') f.v = 'p';
    else if (va === 'subscript') f.v = 'd';
    const rf = trova(rPr, 'w:rFonts');
    if (rf) {
      const esplicito = rf.attributi['w:ascii'] ?? rf.attributi['w:hAnsi'] ?? rf.attributi['w:cs'] ?? rf.attributi['w:eastAsia'];
      const tema = rf.attributi['w:asciiTheme'] ?? rf.attributi['w:hAnsiTheme'];
      if (esplicito) carattere = esplicito;
      else if (tema) carattere = (tema.startsWith('major') ? ctx.tema.maggiore : ctx.tema.minore) ?? carattere;
    }
    const sz = Number(val(trova(rPr, 'w:sz')));
    if (Number.isFinite(sz) && sz > 0) corpo = sz / 2;
    const colore = val(trova(rPr, 'w:color'));
    if (colore && /^[0-9a-fA-F]{6}$/.test(colore)) f.k = `#${colore.toLowerCase()}`;
    const ev = val(trova(rPr, 'w:highlight'));
    const sfondo = val(trova(rPr, 'w:shd'), 'w:fill');
    if (ev !== undefined && ev in EVIDENZIA) f.h = EVIDENZIA[ev];
    else if (sfondo && /^[0-9a-fA-F]{6}$/.test(sfondo)) f.h = `#${sfondo.toLowerCase()}`;
  }
  if (carattere.toLowerCase() !== CARATTERE_NORMALE.toLowerCase()) f.f = carattere;
  if (corpo !== CORPO_NORMALE && corpo >= 1 && corpo <= 400) f.z = corpo;
  return f;
}

const IMMAGINE_MASSIMA_FILE = 5_000_000;
/** Il tipo di un'immagine dai primi byte (non dal nome del file): png, jpeg, gif, webp; altrimenti null. */
function tipoImmagine(b: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | null {
  const inizia = (...x: number[]): boolean => x.every((v, i) => b[i] === v);
  if (inizia(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (inizia(0xff, 0xd8, 0xff)) return 'jpeg';
  if (inizia(0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (inizia(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

function leggiImmagini(relazioni: NodoXml | null, file: Map<string, Uint8Array>, principale: string): Map<string, string> {
  const out = new Map<string, string>();
  let totale = 0;
  if (!relazioni) return out;
  for (const r of figliElemento(relazioni, 'Relationship')) {
    const id = r.attributi['Id'];
    const bersaglio = r.attributi['Target'];
    if (!id || !bersaglio || !(r.attributi['Type'] ?? '').endsWith('/image') || r.attributi['TargetMode'] === 'External') continue;
    const dati = file.get(percorsoRelativo(principale, bersaglio));
    const tipo = dati ? tipoImmagine(dati) : null;
    if (!dati || !tipo || dati.length > IMMAGINE_MASSIMA_FILE) continue;
    if (tipo === 'png' && !dimensioniPngRagionevoli(dati)) continue;
    if (totale + dati.length > IMMAGINI_TOTALE_MASSIMO) continue; // oltre un certo peso le altre immagini si lasciano fuori: il documento resterebbe ingestibile
    totale += dati.length;
    out.set(id, `data:image/${tipo};base64,${aBase64(dati)}`);
  }
  return out;
}

/** Peso massimo di tutte le immagini importate da un file, in byte. */
const IMMAGINI_TOTALE_MASSIMO = 30_000_000;
/** Un PNG può dichiarare nell'intestazione misure enormi con pochi byte: si rifiuta oltre 20000 punti per lato o 100 milioni di punti in tutto (il browser li decodificherebbe per intero). */
export function dimensioniPngRagionevoli(b: Uint8Array): boolean {
  if (b.length < 24) return false;
  const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
  const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
  return w >= 1 && h >= 1 && w <= 20000 && h <= 20000 && w * h <= 100_000_000;
}

/** Il primo elemento con quel nome dentro un nodo (a qualunque profondità), o null. */
function cercaNodo(n: NodoXml, nome: string): NodoXml | null {
  for (const f of n.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === nome) return f;
    const dentro = cercaNodo(f, nome);
    if (dentro) return dentro;
  }
  return null;
}

/** L'immagine di un w:drawing (in linea o ancorata), ridotta per stare nel foglio; null se manca, non si trova il file o non è ammessa. */
function leggiDisegno(disegno: NodoXml, ctx: Contesto): Immagine | null {
  const blip = cercaNodo(disegno, 'a:blip');
  const s = blip ? ctx.immagini.get(blip.attributi['r:embed'] ?? '') : undefined;
  const misura = cercaNodo(disegno, 'wp:extent');
  if (!s || !misura) return null;
  const w = Number(misura.attributi['cx']) / EMU_PER_PIXEL;
  const h = Number(misura.attributi['cy']) / EMU_PER_PIXEL;
  if (!(w >= 1) || !(h >= 1)) return null;
  const { w: lw, h: lh } = dimensioniIniziali(w, h);
  return { s, w: lw, h: lh };
}

const CONTENITORI_RUN = new Set(['w:hyperlink', 'w:ins', 'w:moveTo', 'w:smartTag', 'w:fldSimple', 'w:sdt', 'w:sdtContent', 'w:customXml']);
const CONTENITORI_CORPO = new Set(['w:tbl', 'w:tr', 'w:tc', 'w:sdt', 'w:sdtContent', 'w:customXml', 'w:ins', 'w:moveTo']);

/** Indirizzo di un campo semplice HYPERLINK "indirizzo", se è ammesso. */
function indirizzoCampo(istruzione: string | undefined): string | undefined {
  const m = /^\s*HYPERLINK\s+"([^"]+)"/i.exec(istruzione ?? '');
  return m && urlValido(m[1]) ? m[1] : undefined;
}

function leggiLink(relazioni: NodoXml | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!relazioni) return out;
  for (const r of figliElemento(relazioni, 'Relationship')) {
    const id = r.attributi['Id'];
    const bersaglio = r.attributi['Target'];
    if (id && bersaglio && (r.attributi['Type'] ?? '').endsWith('/hyperlink') && urlValido(bersaglio)) out.set(id, bersaglio);
  }
  return out;
}

type TipoCampo = 'pagina' | 'pagine' | null;
function tipoCampo(istruzione: string): TipoCampo {
  if (/^\s*PAGE\b/i.test(istruzione)) return 'pagina';
  if (/^\s*NUMPAGES\b/i.test(istruzione)) return 'pagine';
  return null;
}
/** Un campo complesso (fldChar) in lettura: l'istruzione che si accumula, e se si è già nel suo risultato. */
interface CampoAperto { istruzione: string; tipo: TipoCampo; risultato: boolean; formato: Omit<Run, 't'> }

function convertiParagrafo(p: NodoXml, ctx: Contesto): Paragrafo[] {
  const attrs = leggiPPr(trova(p, 'w:pPr'), ctx);
  const risultato: Paragrafo[] = [];
  let corrente: Run[] = [];
  let campo: CampoAperto | null = null;
  const emettiCampo = (c: CampoAperto): void => { corrente.push({ ...c.formato, t: c.tipo === 'pagina' ? CAMPO_PAGINA : CAMPO_PAGINE }); };
  const continuazione: AttributiParagrafo = { ...attrs }; // i pezzi dopo il primo non ripetono salto di pagina, spazio prima e segnalibro
  delete continuazione.sp; delete continuazione.sb; delete continuazione.sg;
  const chiudi = (): void => { const sp = ctx.saltoPendente === true; ctx.saltoPendente = false; risultato.push({ ...(risultato.length === 0 ? attrs : continuazione), ...(sp ? { sp: true } : {}), runs: normalizza(corrente) }); corrente = []; };
  const leggiRun = (r: NodoXml, u?: string): void => {
    const formato = leggiFormatoRun(trova(r, 'w:rPr'), ctx);
    if (u !== undefined) {
      // l'azzurro e la sottolineatura sono quelli del link, non un formato del testo
      if (formato.k === '#1155cc' || formato.k === '#0563c1') delete formato.k;
      formato.s = false;
    }
    let testo = '';
    const scarica = (): void => { if (testo !== '') corrente.push({ ...formato, t: testo, ...(u !== undefined ? { u } : {}) }); testo = ''; };
    for (const f of r.figli) {
      if (typeof f === 'string') continue;
      if (ctx.campi && f.nome === 'w:fldChar') {
        scarica();
        const fase = f.attributi['w:fldCharType'];
        if (fase === 'begin') campo = { istruzione: '', tipo: null, risultato: false, formato };
        else if (fase === 'separate' && campo) { campo.tipo = tipoCampo(campo.istruzione); campo.risultato = true; if (campo.tipo) emettiCampo(campo); }
        else if (fase === 'end' && campo) {
          if (!campo.risultato) { campo.tipo = tipoCampo(campo.istruzione); if (campo.tipo) emettiCampo(campo); }
          campo = null;
        }
        continue;
      }
      if (ctx.campi && campo && (!campo.risultato || campo.tipo)) {
        if (f.nome === 'w:instrText' && !campo.risultato) campo.istruzione += f.figli.filter((x): x is string => typeof x === 'string').join('');
        continue;
      }
      if (f.nome === 'w:t') testo += f.figli.filter((x): x is string => typeof x === 'string').join('');
      else if (f.nome === 'w:tab') testo += '\t';
      else if (f.nome === 'w:noBreakHyphen') testo += '-';
      else if ((f.nome === 'w:footnoteReference' || f.nome === 'w:endnoteReference') && ctx.note && ctx.note.usate.length < NOTE_MASSIME) {
        // la nota diventa come quelle di pmb_docs: un numero in apice nel testo e un paragrafo "N. testo" in fondo al documento
        const nota = ctx.note.testi.get((f.nome === 'w:footnoteReference' ? 'f' : 'e') + (f.attributi['w:id'] ?? ''));
        if (nota !== undefined) {
          const numero = ctx.note.usate.length + 1;
          ctx.note.usate.push({ numero, testo: nota });
          scarica();
          corrente.push({ ...formato, t: String(numero), v: 'p', ...(u !== undefined ? { u } : {}) });
        }
      }
      else if (f.nome === 'w:drawing' || f.nome === 'mc:AlternateContent') {
        const disegno = f.nome === 'w:drawing' ? f : cercaNodo(f, 'w:drawing');
        const im = disegno ? leggiDisegno(disegno, ctx) : null;
        if (im) { scarica(); corrente.push({ ...formato, t: OGGETTO, im, ...(u !== undefined ? { u } : {}) }); }
      }
      else if ((f.nome === 'w:br' && ((f.attributi['w:type'] ?? 'textWrapping') === 'textWrapping')) || f.nome === 'w:cr') { scarica(); chiudi(); }
      else if (f.nome === 'w:br' && f.attributi['w:type'] === 'page') { scarica(); if (corrente.length > 0) chiudi(); ctx.saltoPendente = true; }
    }
    scarica();
  };
  const visita = (n: NodoXml, u?: string): void => {
    for (const f of n.figli) {
      if (typeof f === 'string') continue;
      if (f.nome === 'w:r') leggiRun(f, u);
      else if (f.nome === 'w:hyperlink') visita(f, ctx.link.get(f.attributi['r:id'] ?? ''));
      else if (ctx.campi && f.nome === 'w:fldSimple' && tipoCampo(f.attributi['w:instr'] ?? '') !== null) {
        const primo = cercaNodo(f, 'w:r');
        corrente.push({ ...leggiFormatoRun(primo ? trova(primo, 'w:rPr') : undefined, ctx), t: tipoCampo(f.attributi['w:instr'] ?? '') === 'pagina' ? CAMPO_PAGINA : CAMPO_PAGINE });
      }
      else if (f.nome === 'w:fldSimple') visita(f, indirizzoCampo(f.attributi['w:instr']) ?? u);
      else if (CONTENITORI_RUN.has(f.nome)) visita(f, u);
    }
  };
  visita(p);
  // un'interruzione di pagina in fondo al paragrafo non lascia un paragrafo vuoto: il salto passa al paragrafo che segue
  if (!(ctx.saltoPendente === true && corrente.length === 0 && risultato.length > 0)) chiudi();
  // lo spazio dopo conta solo sull'ultimo pezzo
  for (let k = 0; k < risultato.length - 1; k++) if (risultato[k].sa !== undefined) { const senza = { ...risultato[k] }; delete senza.sa; risultato[k] = senza; }
  // il segnalibro (quelli di Word che cominciano con _ sono interni: _GoBack, _Toc...) va solo sul primo dei paragrafi nati da questo
  const segnalibro = p.figli.find((f): f is NodoXml => typeof f !== 'string' && f.nome === 'w:bookmarkStart' && !(f.attributi['w:name'] ?? '_').startsWith('_'));
  const nomeSg = segnalibro ? nomeSegnalibroValido(segnalibro.attributi['w:name'] ?? '') : null;
  if (nomeSg !== null) risultato[0] = { ...risultato[0], sg: nomeSg };
  return risultato;
}

/** Tutti i paragrafi di un blocco, senza tabelle: quelle (anche annidate) diventano i loro paragrafi, uno dopo l'altro. */
function appiattisciCorpo(n: NodoXml, ctx: Contesto, out: Paragrafo[]): void {
  for (const f of n.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === 'w:p') out.push(...convertiParagrafo(f, ctx));
    else if (CONTENITORI_CORPO.has(f.nome)) appiattisciCorpo(f, ctx, out);
  }
}

const RIGHE_MASSIME_IMPORT = 1000;
const COLONNE_MASSIME_IMPORT = 100;
const VUOTA = (): Paragrafo[] => [{ runs: [] }];

function convertiTabella(tbl: NodoXml, ctx: Contesto, out: Paragrafo[], id: number): void {
  const griglia: Paragrafo[][][] = [];
  for (const tr of figliElemento(tbl, 'w:tr')) {
    const riga: Paragrafo[][] = [];
    for (const tc of figliElemento(tr, 'w:tc')) {
      const unione = Number(val(trova(tc, 'w:tcPr/w:gridSpan')) ?? 1);
      const larga = Number.isInteger(unione) && unione > 1 ? Math.min(unione, COLONNE_MASSIME_IMPORT + 1) : 1;
      const vm = trova(tc, 'w:tcPr/w:vMerge');
      const continua = vm !== undefined && vm !== null && val(vm) !== 'restart';
      const contenuto: Paragrafo[] = [];
      if (!continua) appiattisciCorpo(tc, ctx, contenuto);
      riga.push(contenuto.length > 0 ? contenuto : VUOTA());
      for (let k = 1; k < larga; k++) riga.push(VUOTA());
    }
    if (riga.length > 0) griglia.push(riga);
  }
  const colonne = griglia.reduce((m, r) => Math.max(m, r.length), 0);
  if (griglia.length > RIGHE_MASSIME_IMPORT || colonne > COLONNE_MASSIME_IMPORT) { appiattisciCorpo(tbl, ctx, out); return; }
  griglia.forEach((riga, r) => {
    while (riga.length < colonne) riga.push(VUOTA());
    riga.forEach((cella, c) => cella.forEach((par) => out.push({ ...par, tb: { i: id, r, c } })));
  });
}

function convertiCorpo(n: NodoXml, ctx: Contesto, out: Paragrafo[], tabelle: { prossima: number }): void {
  for (const f of n.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === 'w:p') out.push(...convertiParagrafo(f, ctx));
    else if (f.nome === 'w:tbl') convertiTabella(f, ctx, out, tabelle.prossima++);
    else if (CONTENITORI_CORPO.has(f.nome)) convertiCorpo(f, ctx, out, tabelle);
  }
}

/** Dopo ogni tabella ci deve essere un paragrafo normale (per poterne uscire): lo si aggiunge in fondo e tra due tabelle. */
const NOTE_MASSIME = 200;
const CARATTERI_NOTA_MASSIMI = 2000;
/** Il testo di tutti i w:t dentro un nodo, con uno spazio tra un paragrafo e l'altro. */
function testoDelNodo(n: NodoXml): string {
  const pezzi: string[] = [];
  const visita = (x: NodoXml): void => {
    for (const f of x.figli) {
      if (typeof f === 'string') continue;
      if (f.nome === 'w:t') pezzi.push(f.figli.filter((y): y is string => typeof y === 'string').join(''));
      else if (f.nome === 'w:tab') pezzi.push(' ');
      else { visita(f); if (f.nome === 'w:p') pezzi.push(' '); }
    }
  };
  visita(n);
  return pezzi.join('').replace(/\s+/g, ' ').trim().slice(0, CARATTERI_NOTA_MASSIMI);
}
/** I testi delle note di un file (footnotes.xml o endnotes.xml) per identificativo; i separatori non contano. */
function leggiNote(radice: NodoXml | null, nome: 'w:footnote' | 'w:endnote', prefisso: 'f' | 'e', out: Map<string, string>): void {
  if (!radice) return;
  for (const n of figliElemento(radice, nome)) {
    const tipo = n.attributi['w:type'];
    if (tipo !== undefined && tipo !== 'normal') continue;
    const id = n.attributi['w:id'];
    if (id !== undefined) out.set(prefisso + id, testoDelNodo(n));
  }
}
/** I paragrafi delle note in fondo al documento, come li scrive "Inserisci › Nota a piè di pagina" di pmb_docs (la prima ha la linea sopra). */
function paragrafiNote(usate: Array<{ numero: number; testo: string }>): Paragrafo[] {
  return usate.map((n) => ({
    ...(n.numero === 1 ? { hr: true } : {}),
    runs: [
      { t: `${n.numero}. `, g: true, c: false, s: false, z: 9 },
      { t: n.testo === '' ? '(nota vuota)' : n.testo, g: false, c: false, s: false, z: 9 },
    ],
  }));
}

function paragrafoDopoLeTabelle(paragrafi: Paragrafo[]): Paragrafo[] {
  const out: Paragrafo[] = [];
  paragrafi.forEach((par, i) => {
    out.push(par);
    const dopo = paragrafi[i + 1];
    if (par.tb && (dopo === undefined || (dopo.tb !== undefined && dopo.tb.i !== par.tb.i))) out.push({ runs: [] });
  });
  return out;
}

const MARGINE_CARATTERI = 300;

/** I primi `massimo` caratteri dei tratti. */
function tagliaTratti(runs: Run[], massimo: number): Run[] {
  const out: Run[] = [];
  let usati = 0;
  for (const r of runs) {
    if (usati >= massimo) break;
    out.push(r.t.length + usati > massimo ? { ...r, t: r.t.slice(0, massimo - usati) } : r);
    usati += r.t.length;
  }
  return out;
}

/** L'intestazione o il piè di pagina letti da una parte di Word: testo semplice, senza link, immagini e tabelle, al massimo 3 paragrafi di 300 caratteri. */
function leggiMargine(radice: NodoXml | null, ctx: Contesto): Paragrafo[] | undefined {
  if (!radice) return undefined;
  const tutti: Paragrafo[] = [];
  appiattisciCorpo(radice, { ...ctx, campi: true }, tutti);
  const paragrafi: Paragrafo[] = tutti.map((p) => ({
    ...(p.al !== undefined ? { al: p.al } : {}),
    runs: tagliaTratti(normalizza(p.runs.filter((r) => r.im === undefined).map(({ u, ...resto }) => { void u; return resto; })), MARGINE_CARATTERI),
  }));
  while (paragrafi.length > 0 && paragrafi[paragrafi.length - 1].runs.length === 0) paragrafi.pop();
  return paragrafi.slice(0, RIGHE_MARGINE_MASSIME);
}

function percorsoRelativo(base: string, destinazione: string): string {
  if (destinazione.startsWith('/')) return destinazione.slice(1);
  const parti = base.split('/').slice(0, -1);
  for (const p of destinazione.split('/')) { if (p === '..') parti.pop(); else if (p !== '.') parti.push(p); }
  return parti.join('/');
}

export async function importaDocx(bytes: Uint8Array): Promise<Documento> {
  let file: Map<string, Uint8Array>;
  try { file = await leggiZip(bytes); } catch (e) { throw new Error(t('DOCX non valido: {}', (e as Error).message)); }
  const dec = new TextDecoder('utf-8');
  const leggi = (nome: string): NodoXml | null => {
    const d = file.get(nome);
    if (!d) return null;
    let x: NodoXml;
    try { x = analizzaXml(dec.decode(d)); } catch (e) { throw new Error(t('DOCX non valido: {}: {}', nome, (e as Error).message)); }
    // le funzioni che leggono l'albero sono ricorsive: un file con migliaia di livelli esaurirebbe lo stack (i documenti veri ne hanno poche decine)
    if (profonditaXml(x) > PROFONDITA_XML_MASSIMA) throw new Error(t('DOCX non valido: {}: elementi annidati troppo in profondità', nome));
    return x;
  };
  let principale = 'word/document.xml';
  const rels = leggi('_rels/.rels');
  if (rels) {
    const r = figliElemento(rels, 'Relationship').find((x) => (x.attributi['Type'] ?? '').endsWith('/officeDocument'));
    if (r?.attributi['Target']) principale = percorsoRelativo('_rels/.rels', r.attributi['Target'].startsWith('/') ? r.attributi['Target'] : `../${r.attributi['Target']}`);
  }
  const radice = leggi(principale);
  if (!radice || radice.nome !== 'w:document') throw new Error(t('DOCX non valido: manca il testo del documento'));
  const corpo = trova(radice, 'w:body');
  if (!corpo) throw new Error(t('DOCX non valido: manca il corpo del documento'));
  const relPrincipale = leggi(`${principale.split('/').slice(0, -1).join('/')}/_rels/${principale.split('/').pop()}.rels`);
  const parte = (suffisso: string, predefinita: string): string => {
    const r = relPrincipale ? figliElemento(relPrincipale, 'Relationship').find((x) => (x.attributi['Type'] ?? '').endsWith(`/${suffisso}`)) : undefined;
    return r?.attributi['Target'] ? percorsoRelativo(principale, r.attributi['Target']) : predefinita;
  };
  const dirPrincipale = principale.split('/').slice(0, -1).join('/');
  const predef = (nome: string): string => (dirPrincipale ? `${dirPrincipale}/${nome}` : nome);
  const radiceStili = leggi(parte('styles', predef('styles.xml')));
  const stili = leggiStili(radiceStili);
  const tema = leggiTema(leggi(parte('theme', predef('theme/theme1.xml'))));
  const ctx: Contesto = {
    stili: stili.stili,
    spazio: creaSpazio(radiceStili),
    note: { testi: new Map(), usate: [] },
    numeri: leggiNumerazione(leggi(parte('numbering', predef('numbering.xml')))),
    carattere: CARATTERE_NORMALE,
    corpo: CORPO_NORMALE,
    tema,
    link: leggiLink(relPrincipale),
    immagini: leggiImmagini(relPrincipale, file, principale),
  };
  if (stili.carattere) ctx.carattere = stili.carattere;
  else if (stili.temaCarattere) ctx.carattere = (stili.temaCarattere.startsWith('major') ? tema.maggiore : tema.minore) ?? CARATTERE_NORMALE;
  if (stili.corpo) ctx.corpo = stili.corpo;
  leggiNote(leggi(parte('footnotes', predef('footnotes.xml'))), 'w:footnote', 'f', ctx.note!.testi);
  leggiNote(leggi(parte('endnotes', predef('endnotes.xml'))), 'w:endnote', 'e', ctx.note!.testi);
  const paragrafi: Paragrafo[] = [];
  convertiCorpo(corpo, ctx, paragrafi, { prossima: 0 });
  paragrafi.push(...paragrafiNote(ctx.note!.usate));
  const tutti = paragrafoDopoLeTabelle(applicaSpazioContestuale(paragrafi));
  let documento: Documento = { paragrafi: tutti.length > 0 ? tutti : [{ runs: [] }] };
  const sezione = trova(corpo, 'w:sectPr');
  const margine = (riferimento: string): Paragrafo[] | undefined => {
    const r = sezione ? figliElemento(sezione, riferimento).find((x) => (x.attributi['w:type'] ?? 'default') === 'default') : undefined;
    const legame = r && relPrincipale ? figliElemento(relPrincipale, 'Relationship').find((x) => x.attributi['Id'] === r.attributi['r:id']) : undefined;
    return legame?.attributi['Target'] ? leggiMargine(leggi(percorsoRelativo(principale, legame.attributi['Target'])), ctx) : undefined;
  };
  const intestazione = margine('w:headerReference');
  const piede = margine('w:footerReference');
  try { if (intestazione) documento = impostaIntestazione(documento, intestazione); } catch { /* intestazione non ammessa: si ignora */ }
  try { if (piede) documento = impostaPiede(documento, piede); } catch { /* piè di pagina non ammesso: si ignora */ }
  return documento;
}
