// Formato .docx (Word, Google Documenti, LibreOffice) per pmb_docs: esporta il documento e importa quelli degli altri.
// Si esportano testo, grassetto, corsivo, sottolineato, carattere, corpo, colori, allineamento, interlinea, elenchi,
// rientri e stili (Titolo, Sottotitolo, Titolo 1-3). Si importano gli stessi elementi; di quello che pmb_docs non ha
// (note, modifiche registrate) si conserva solo il testo dei paragrafi:
//   - i campi (indice, data, numeri di pagina nel testo) restano come testo, col valore che avevano;
//   - un'interruzione di riga dentro un paragrafo diventa un nuovo paragrafo.
// Commenti (word/comments.xml, con risposte e «risolto» da word/commentsExtended.xml) e modifiche registrate (w:ins, w:del, e la
// registrazione accesa in word/settings.xml) si importano e si esportano come li scrive Word.
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
import { numeriDidascalie } from '../modello/didascalie';
import { testiRiferimenti } from '../modello/riferimenti';
import { leggiZip, scriviZip, type VoceZip } from '@comune/formati/zip';
import { analizzaXml, elemento, escapaXml, figliElemento, profonditaXml, trova, type NodoXml } from '@comune/formati/xml';
import { t } from '../i18n/lingua';
import { impronteValide } from '@comune/protezione/impronte';
import { ancoraDi, cellaCon, riparaUnioni, unioneDi, type Unione } from '../modello/unioni';
import { motivoNome } from '../modello/stili';

/** Livelli di annidamento XML ammessi in un .docx importato. */
export const PROFONDITA_XML_MASSIMA = 256;
import {
  normalizza, urlValido, dimensioniIniziali, OGGETTO, CARATTERE_NORMALE, CORPO_NORMALE, CAMPO_PAGINA, CAMPO_PAGINE, CAMPO_UNIONE, CAMPO_SEQUENZA, CAMPO_RIFERIMENTO, nomeCampoValido, RIGHE_MARGINE_MASSIME,
  impostaIntestazione, impostaPiede, nomeSegnalibroValido, spazioValido, bordoValido, commentiUsati, ID_COMMENTO, LUNGHEZZA_MASSIMA_COMMENTO, LUNGHEZZA_MASSIMA_AUTORE,
  stiliUsati, stileValido, LUNGHEZZA_MASSIMA_NOME_STILE, filigranaValida, LUNGHEZZA_MASSIMA_FILIGRANA, LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO,
  type Allineamento, type AttributiParagrafo, type Commento, type Documento, type Immagine, type Paragrafo, type Revisione, type Run, type StileParagrafo, type StilePersonale,
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
  if (r.q === 'm') f.push(elemento('w:smallCaps'));
  if (r.x === 'b') f.push(elemento('w:strike'));
  const colore = r.k !== undefined ? esadecimale(r.k) : null;
  if (colore) f.push(elemento('w:color', { 'w:val': colore }));
  if (r.z !== undefined) {
    const mezzi = Math.round(r.z * 2);
    f.push(elemento('w:sz', { 'w:val': mezzi }), elemento('w:szCs', { 'w:val': mezzi }));
  }
  if (r.s || r.w === 'd') f.push(elemento('w:u', { 'w:val': r.w === 'd' ? 'double' : 'single' }));
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

function contenutoRun(t: string, cancellato = false): string[] {
  const out: string[] = [];
  // tabulazione, trattino non divisibile e trattino facoltativo sono elementi a sé in Word (w:tab, w:noBreakHyphen, w:softHyphen)
  for (const pezzo of t.split(/([\t\u2011\u00ad])/)) {
    if (pezzo === '\t') out.push(elemento('w:tab'));
    else if (pezzo === '\u2011') out.push(elemento('w:noBreakHyphen'));
    else if (pezzo === '\u00ad') out.push(elemento('w:softHyphen'));
    else if (pezzo !== '') out.push(elemento(cancellato ? 'w:delText' : 'w:t', { 'xml:space': 'preserve' }, [escapaXml(pezzo)]));
  }
  return out;
}

const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_VML = 'urn:schemas-microsoft-com:vml';
const NS_O = 'urn:schemas-microsoft-com:office:office';

/** La filigrana di testo come la scrive Word: un paragrafo nell'intestazione con una forma VML (WordArt) grigia, semitrasparente,
 *  ruotata di 315 gradi e centrata sulla pagina, dietro al testo. */
function filigranaXml(testo: string): string {
  const largo = Math.min(468, Math.max(120, testo.length * 52));
  return elemento('w:p', {}, [elemento('w:pPr', {}, [elemento('w:pStyle', { 'w:val': 'Header' })]), elemento('w:r', {}, [elemento('w:pict', {}, [
    elemento('v:shapetype', { id: '_x0000_t136', coordsize: '21600,21600', 'o:spt': 136, adj: '10800', path: 'm@7,l@8,m@5,21600l@6,21600e' }, [
      elemento('v:path', { textpathok: 't', 'o:connecttype': 'custom' }),
      elemento('v:textpath', { on: 't', fitshape: 't' }),
    ]),
    elemento('v:shape', {
      id: 'PowerPlusWaterMarkObject1', 'o:spid': '_x0000_s2049', type: '#_x0000_t136',
      style: `position:absolute;margin-left:0;margin-top:0;width:${largo}pt;height:${Math.round(largo / 4)}pt;rotation:315;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin`,
      'o:allowincell': 'f', fillcolor: 'silver', stroked: 'f',
    }, [elemento('v:fill', { opacity: '.5' }), elemento('v:textpath', { style: 'font-family:"Arial";font-size:1pt', string: testo })]),
  ])])]);
}
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
  const comune = [
    elemento('wp:docPr', { id: numero, name: nome, descr: im.d }),
    elemento('wp:cNvGraphicFramePr', {}, [elemento('a:graphicFrameLocks', { noChangeAspect: 1 })]),
    elemento('a:graphic', {}, [elemento('a:graphicData', { uri: NS_PIC }, [immagine])]),
  ];
  if (im.a !== undefined) {
    // testo intorno: immagine ancorata al paragrafo, allineata a sinistra o a destra della colonna, testo a riquadro sui due lati (come Word)
    return elemento('w:drawing', {}, [elemento('wp:anchor', {
      distT: 0, distB: 57150, distL: im.a === 'dx' ? 114300 : 0, distR: im.a === 'sx' ? 114300 : 0,
      simplePos: 0, relativeHeight: 251658240 + numero, behindDoc: 0, locked: 0, layoutInCell: 1, allowOverlap: 1,
    }, [
      elemento('wp:simplePos', { x: 0, y: 0 }),
      elemento('wp:positionH', { relativeFrom: 'column' }, [elemento('wp:align', {}, [im.a === 'sx' ? 'left' : 'right'])]),
      elemento('wp:positionV', { relativeFrom: 'paragraph' }, [elemento('wp:posOffset', {}, ['0'])]),
      elemento('wp:extent', { cx, cy }),
      elemento('wp:effectExtent', { l: 0, t: 0, r: 0, b: 0 }),
      elemento('wp:wrapSquare', { wrapText: 'bothSides' }),
      ...comune,
    ])]);
  }
  return elemento('w:drawing', {}, [elemento('wp:inline', { distT: 0, distB: 0, distL: 0, distR: 0 }, [
    elemento('wp:extent', { cx, cy }),
    ...comune,
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

/** Dove cominciano e finiscono i commenti in un paragrafo: per indice del tratto, gli identificativi (di Word) da aprire prima e da chiudere dopo. */
interface SegniCommenti { prima: Map<number, string[]>; dopo: Map<number, string[]> }
/** Numero progressivo delle modifiche registrate scritte nel file (w:id di w:ins e w:del, diverso per ognuna). */
let revisioniScritte = 0;
function revisioneXml(rv: Revisione, contenuto: string): string {
  const attr: Record<string, string | number> = { 'w:id': 100000 + ++revisioniScritte, 'w:author': rv.a };
  if (rv.d !== '') attr['w:date'] = rv.d;
  return elemento(rv.t === 'i' ? 'w:ins' : 'w:del', attr, [contenuto]);
}

const campo = (fase: 'begin' | 'separate' | 'end'): string => elemento('w:r', {}, [elemento('w:fldChar', { 'w:fldCharType': fase })]);
const istruzione = (testo: string): string => elemento('w:r', {}, [elemento('w:instrText', { 'xml:space': 'preserve' }, [escapaXml(testo)])]);
/**
 * Una voce del sommario come la scrive Word: stile «toc N», collegamento al segnalibro del titolo, tabulazione e campo PAGEREF del numero
 * di pagina (lo calcola Word, che aggiorna i campi all'apertura); la prima voce apre il campo TOC, l'ultima lo chiude.
 */
function vocesommarioXml(par: Paragrafo, primo: boolean, ultimo: boolean): string {
  const sm = par.sm!;
  const nome = nomeSegnalibroDocx(sm.n);
  const testo = par.runs.map((r) => r.t).join('').replace(/[\uFFFC\uE000\uE001]/g, '');
  const figli: string[] = [elemento('w:pPr', {}, [elemento('w:pStyle', { 'w:val': `TOC${sm.l}` })])];
  if (primo) figli.push(campo('begin'), istruzione(' TOC \\o "1-3" \\h \\z \\u '), campo('separate'));
  figli.push(elemento('w:hyperlink', { 'w:anchor': nome, 'w:history': 1 }, [
    elemento('w:r', {}, contenutoRun(testo)),
    elemento('w:r', {}, [elemento('w:tab')]),
    campo('begin'), istruzione(` PAGEREF ${nome} \\h `), campo('separate'), elemento('w:r', {}, [elemento('w:t', {}, ['1'])]), campo('end'),
  ]));
  if (ultimo) figli.push(campo('end'));
  return elemento('w:p', {}, figli);
}

function paragrafoXml(par: Paragrafo, numId: number, idLink: (url: string) => string, idImmagine: (im: Immagine) => { id: string; numero: number }, commenti?: SegniCommenti): string {
  // l'ordine dei figli di w:pPr è quello dello schema di Word: pStyle, pageBreakBefore, numPr, pBdr, spacing, ind, jc
  const p: string[] = [];
  const stile = par.su ?? (par.st !== undefined ? ID_STILE[par.st] : undefined);
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
  // l'interruzione di colonna di Word sta nel testo: un w:br di tipo column all'inizio del paragrafo
  if (par.sc) figli.push(elemento('w:r', {}, [elemento('w:br', { 'w:type': 'column' })]));
  const runSemplice = (r: Run): string => {
    const rp = proprietaRun(r);
    if (r.im !== undefined) {
      const { id, numero } = idImmagine(r.im);
      return elemento('w:r', {}, [...(rp !== '' ? [rp] : []), disegnoXml(r.im, id, numero)]);
    }
    if (r.sq !== undefined) {
      // numero di didascalia come lo scrive Word: SEQ con il nome della serie e il numero già calcolato come risultato
      const nome = /\s/.test(r.sq) ? `"${r.sq.replace(/"/g, '')}"` : r.sq;
      return elemento('w:fldSimple', { 'w:instr': ` SEQ ${nome} \\* ARABIC ` }, [elemento('w:r', {}, [...(rp !== '' ? [rp] : []), elemento('w:t', {}, [String(NUMERI_SEQUENZA.get(r) ?? 1)])])]);
    }
    if (r.xr !== undefined) {
      // riferimento incrociato come lo scrive Word: REF al segnalibro (\h = è anche un collegamento) e il testo già calcolato come risultato
      const rif = RIFERIMENTI_DOCX.get(r);
      return elemento('w:fldSimple', { 'w:instr': ` REF ${rif?.nome ?? nomeSegnalibroDocx(r.xr)} \\h ` }, [elemento('w:r', {}, [...(rp !== '' ? [rp] : []), ...contenutoRun(rif?.testo ?? '')])]);
    }
    if (r.cu !== undefined) {
      // campo di unione come lo scrive Word: MERGEFIELD con il nome (tra virgolette se ha spazi) e «nome» come risultato
      const nome = /\s/.test(r.cu) ? `"${r.cu.replace(/"/g, '')}"` : r.cu;
      return elemento('w:fldSimple', { 'w:instr': ` MERGEFIELD ${nome} ` }, [elemento('w:r', {}, [...(rp !== '' ? [rp] : []), elemento('w:t', {}, [escapaXml(`«${r.cu}»`)])])]);
    }
    if (r.t.includes(CAMPO_PAGINA) || r.t.includes(CAMPO_PAGINE)) return campiXml(r, rp);
    return elemento('w:r', {}, [...(rp !== '' ? [rp] : []), ...contenutoRun(r.t, r.rv?.t === 'd')]);
  };
  // ogni tratto: prima l'inizio dei commenti che partono da lì, poi il tratto (dentro w:ins o w:del se è una modifica registrata),
  // poi la fine dei commenti che finiscono lì con il loro richiamo (come li scrive Word)
  const segnalibroE = NOMI_SEGNALIBRI.get(par)?.etichetta;
  const runXml = (r: Run, k: number): string => {
    const pezzi: string[] = [];
    // il segnalibro di etichetta e numero della didascalia (a cui rimandano i riferimenti «Figura 2»): dal primo tratto al numero
    if (segnalibroE && k === 0) pezzi.push(elemento('w:bookmarkStart', { 'w:id': segnalibroE.id, 'w:name': segnalibroE.nome }));
    for (const id of commenti?.prima.get(k) ?? []) pezzi.push(elemento('w:commentRangeStart', { 'w:id': id }));
    pezzi.push(r.rv ? revisioneXml(r.rv, runSemplice(r)) : runSemplice(r));
    for (const id of commenti?.dopo.get(k) ?? []) pezzi.push(elemento('w:commentRangeEnd', { 'w:id': id }), elemento('w:r', {}, [elemento('w:commentReference', { 'w:id': id })]));
    if (segnalibroE && k === segnalibroE.fino) pezzi.push(elemento('w:bookmarkEnd', { 'w:id': segnalibroE.id }));
    return pezzi.join('');
  };
  for (let i = 0; i < par.runs.length;) {
    const u = par.runs[i].u;
    let j = i + 1;
    while (u !== undefined && j < par.runs.length && par.runs[j].u === u) j++;
    const gruppo = par.runs.slice(i, j).map((r, x) => runXml(r, i + x));
    if (u !== undefined) figli.push(elemento('w:hyperlink', { 'r:id': idLink(u), 'w:history': 1 }, gruppo));
    else figli.push(...gruppo);
    i = j;
  }
  if (par.sg !== undefined) {
    const id = ++segnalibriScritti;
    const inizio = elemento('w:bookmarkStart', { 'w:id': id, 'w:name': NOMI_SEGNALIBRI.get(par)?.nome ?? nomeSegnalibroUnico(par.sg) });
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
  // i segnalibri interni dei titoli del sommario («_Toc…», nascosti in Word) restano come sono
  if (/^_(Toc|Ref)[A-Za-z0-9_]{1,36}$/.test(nome)) return nome;
  // gli altri segnalibri interni (che cominciano con «_», per esempio quelli dei titoli di LibreOffice) restano nascosti anche in Word
  if (nome.startsWith('_')) return ('_' + nome.slice(1).replace(/[^\p{L}\p{N}_]/gu, '_')).slice(0, 40);
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
  // celle unite come le scrive Word: una w:tc per ogni unione orizzontale (gridSpan), e nelle righe sotto una w:tc vuota con vMerge
  const unioni = righe.map((riga) => riga.map((cella) => unioneDi(cella[0].tb)));
  const righeXml = righe.map((riga, r) => {
    const celleXml: string[] = [];
    riga.forEach((cella, c) => {
      const u = unioni[r][c];
      // i paragrafi si scrivono tutti (anche quelli delle celle coperte, che poi si scartano): xmlParagrafo li conta in ordine
      const pars = cella.map(xmlParagrafo);
      let an: [number, number] = [r, c];
      if (u.co) {
        an = ancoraDi(unioni, r, c) ?? [r, c];
        if (an[1] !== c || an[0] === r) return; // coperta in orizzontale: la copre la gridSpan della sua riga
      }
      const a = unioni[an[0]][an[1]];
      const pr = [elemento('w:tcW', { 'w:w': larghezza * a.cs, 'w:type': 'dxa' })];
      if (a.cs > 1) pr.push(elemento('w:gridSpan', { 'w:val': a.cs }));
      if (a.rs > 1) pr.push(u.co ? elemento('w:vMerge') : elemento('w:vMerge', { 'w:val': 'restart' }));
      celleXml.push(elemento('w:tc', {}, [elemento('w:tcPr', {}, pr), ...(u.co ? [elemento('w:p')] : pars)]));
    });
    const intestazione = unioni[r][0].h ? [elemento('w:trPr', {}, [elemento('w:tblHeader')])] : [];
    return elemento('w:tr', {}, [...intestazione, ...celleXml]);
  });
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

/** Uno stile personale come lo scrive Word: customStyle, basato sullo stile già fatto che gli fa da base (Titolo 1 dà il livello nel
 *  sommario), con spazi, interlinea e allineamento nel pPr e carattere, grassetto, corsivo, colore, corpo e sottolineato nel rPr. */
function stilePersonaleXml(s: StilePersonale): string {
  const pPr: string[] = [];
  if (s.sb !== undefined || s.sa !== undefined || s.ls !== undefined) {
    pPr.push(elemento('w:spacing', {
      ...(s.sb !== undefined ? { 'w:before': Math.round(s.sb * 20) } : {}),
      ...(s.sa !== undefined ? { 'w:after': Math.round(s.sa * 20) } : {}),
      ...(s.ls !== undefined ? { 'w:line': Math.round(s.ls * 240), 'w:lineRule': 'auto' } : {}),
    }));
  }
  if (s.al !== undefined && s.al !== 'sx') pPr.push(elemento('w:jc', { 'w:val': s.al === 'ce' ? 'center' : s.al === 'dx' ? 'right' : 'both' }));
  const rPr: string[] = [];
  if (s.f !== undefined) rPr.push(elemento('w:rFonts', { 'w:ascii': s.f, 'w:hAnsi': s.f, 'w:cs': s.f }));
  if (s.g) rPr.push(elemento('w:b'));
  if (s.c) rPr.push(elemento('w:i'));
  if (s.k !== undefined) rPr.push(elemento('w:color', { 'w:val': s.k.slice(1).toUpperCase() }));
  if (s.z !== undefined) rPr.push(elemento('w:sz', { 'w:val': Math.round(s.z * 2) }), elemento('w:szCs', { 'w:val': Math.round(s.z * 2) }));
  if (s.s) rPr.push(elemento('w:u', { 'w:val': 'single' }));
  const base = ID_STILE[s.base] ?? 'Normal';
  return elemento('w:style', { 'w:type': 'paragraph', 'w:customStyle': 1, 'w:styleId': s.id }, [
    elemento('w:name', { 'w:val': s.nome }),
    elemento('w:basedOn', { 'w:val': base }),
    elemento('w:next', { 'w:val': s.base === 'n' ? s.id : 'Normal' }),
    elemento('w:qFormat'),
    ...(pPr.length > 0 ? [elemento('w:pPr', {}, pPr)] : []),
    ...(rPr.length > 0 ? [elemento('w:rPr', {}, rPr)] : []),
  ]);
}

function stiliXml(conLink = false, conSommario = false, personali: StilePersonale[] = []): string {
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
  for (const s of personali) stili.push(stilePersonaleXml(s));
  if (conSommario) {
    // voci del sommario: rientro per livello e tabulazione a destra con i puntini (come gli stili «toc 1-3» di Word)
    for (const l of [1, 2, 3]) stili.push(stileXml(`TOC${l}`, `toc ${l}`, { pPr: [elemento('w:tabs', {}, [elemento('w:tab', { 'w:val': 'right', 'w:leader': 'dot', 'w:pos': LARGHEZZA_TESTO - 10 })]), elemento('w:spacing', { 'w:after': 100 }), elemento('w:ind', { 'w:left': (l - 1) * 220 })] }));
  }
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

/** paraId di Word per il paragrafo di un commento: 8 cifre esadecimali sotto 0x80000000. */
const paraId = (n: number): string => (0x10000000 + n).toString(16).toUpperCase();
/** Il commento come lo scrive Word in comments.xml: un paragrafo per riga, l'ultimo con il paraId che usa commentsExtended.xml. */
function commentoXml(id: string, autore: string, data: string, testo: string, pid: string): string {
  const attr: Record<string, string> = { 'w:id': id, 'w:author': autore, 'w:initials': autore.split(/\s+/).map((x) => x.charAt(0)).join('').slice(0, 8) };
  if (data !== '') attr['w:date'] = data;
  const righe = testo.split('\n');
  return elemento('w:comment', attr, righe.map((riga, i) => elemento('w:p', i === righe.length - 1 ? { 'w14:paraId': pid, 'w14:textId': '77777777' } : {}, [
    ...(i === 0 ? [elemento('w:r', {}, [elemento('w:annotationRef')])] : []),
    ...(riga !== '' ? [elemento('w:r', {}, contenutoRun(riga))] : []),
  ])));
}
const NS_W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const NS_W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** I numeri delle didascalie del documento che si sta scrivendo, per tratto (si calcolano una volta all'inizio). */
let NUMERI_SEQUENZA = new WeakMap<Run, number>();
/** I nomi Word dei segnalibri dei paragrafi del corpo, scelti all'inizio (un riferimento può venire prima del suo bersaglio); per le
 *  didascalie a cui rimanda un riferimento «Figura 2» anche il segnalibro di etichetta e numero (id, nome, ultimo tratto). */
let NOMI_SEGNALIBRI = new WeakMap<Paragrafo, { nome: string; etichetta?: { id: number; nome: string; fino: number } }>();
/** Per ogni riferimento incrociato: il segnalibro Word a cui rimanda e il testo da mostrare. */
let RIFERIMENTI_DOCX = new WeakMap<Run, { nome: string; testo: string }>();

/** Sceglie i nomi dei segnalibri e prepara i riferimenti (vedi NOMI_SEGNALIBRI e RIFERIMENTI_DOCX). */
function preparaRiferimenti(doc: Documento): void {
  NOMI_SEGNALIBRI = new WeakMap();
  RIFERIMENTI_DOCX = new WeakMap();
  const perNome = new Map<string, Paragrafo>();
  for (const p of doc.paragrafi) if (p.sg !== undefined) { NOMI_SEGNALIBRI.set(p, { nome: nomeSegnalibroUnico(p.sg) }); if (!perNome.has(p.sg.toLowerCase())) perNome.set(p.sg.toLowerCase(), p); }
  const testi = testiRiferimenti(doc.paragrafi);
  doc.paragrafi.forEach((p, i) => p.runs.forEach((r, k) => {
    if (r.xr === undefined) return;
    const testo = testi.get(`${i}:${k}`) ?? '';
    const bersaglio = perNome.get(r.xr.toLowerCase());
    const voce = bersaglio ? NOMI_SEGNALIBRI.get(bersaglio) : undefined;
    if (!bersaglio || !voce) { RIFERIMENTI_DOCX.set(r, { nome: nomeSegnalibroDocx(r.xr), testo }); return; }
    const fino = bersaglio.runs.findIndex((x) => x.sq !== undefined);
    if (r.xm === 'e' && fino >= 0) {
      if (!voce.etichetta) voce.etichetta = { id: ++segnalibriScritti, nome: nomeSegnalibroUnico(`${voce.nome.slice(0, 36)}_e`), fino };
      RIFERIMENTI_DOCX.set(r, { nome: voce.etichetta.nome, testo });
    } else RIFERIMENTI_DOCX.set(r, { nome: voce.nome, testo });
  }));
}

export async function esportaDocx(doc: Documento): Promise<Uint8Array> {
  NUMERI_SEQUENZA = new WeakMap();
  { const n = numeriDidascalie(doc.paragrafi); doc.paragrafi.forEach((p, i) => p.runs.forEach((r, k) => { const x = n.get(`${i}:${k}`); if (x !== undefined) NUMERI_SEQUENZA.set(r, x); })); }
  segnalibriScritti = 0;
  revisioniScritte = 0;
  // commenti: identificativi di Word (0, 1, 2...: il commento e poi le sue risposte), e dove comincia e finisce il testo di ognuno
  const commenti = commentiUsati(doc);
  const idWord = new Map<string, string[]>();
  const partiCommenti: string[] = [];
  const estesi: string[] = [];
  let prossimoCommento = 0;
  for (const c of commenti) {
    const ids: string[] = [];
    const pidPrincipale = paraId(prossimoCommento);
    const principale = String(prossimoCommento++);
    ids.push(principale);
    partiCommenti.push(commentoXml(principale, c.a, c.d, c.t, pidPrincipale));
    estesi.push(elemento('w15:commentEx', { 'w15:paraId': pidPrincipale, 'w15:done': c.ok ? 1 : 0 }));
    for (const r of c.r ?? []) {
      const pid = paraId(prossimoCommento);
      const id = String(prossimoCommento++);
      ids.push(id);
      partiCommenti.push(commentoXml(id, r.a, r.d, r.t, pid));
      estesi.push(elemento('w15:commentEx', { 'w15:paraId': pid, 'w15:paraIdParent': pidPrincipale, 'w15:done': c.ok ? 1 : 0 }));
    }
    idWord.set(c.id, ids);
  }
  const segni = new Map<number, SegniCommenti>();
  const segnoDi = (p: number): SegniCommenti => { let x = segni.get(p); if (!x) { x = { prima: new Map(), dopo: new Map() }; segni.set(p, x); } return x; };
  const visti = new Map<string, { p: number; k: number }>();
  doc.paragrafi.forEach((par, p) => par.runs.forEach((r, k) => {
    if (r.cm === undefined || !idWord.has(r.cm)) return;
    if (!visti.has(r.cm)) { const m = segnoDi(p).prima; m.set(k, [...(m.get(k) ?? []), ...idWord.get(r.cm)!]); }
    visti.set(r.cm, { p, k });
  }));
  // l'ultimo tratto di ogni commento: lì si chiude (il commento può prendere più paragrafi)
  const ultimi = new Map<string, { p: number; k: number }>();
  doc.paragrafi.forEach((par, p) => par.runs.forEach((r, k) => { if (r.cm !== undefined && idWord.has(r.cm)) ultimi.set(r.cm, { p, k }); }));
  for (const [cm, { p, k }] of ultimi) { const m = segnoDi(p).dopo; m.set(k, [...(m.get(k) ?? []), ...idWord.get(cm)!]); }
  let paragrafoCorpo = 0;
  const conSommario = doc.paragrafi.some((p) => p.sm);
  const conImpostazioni = doc.revisioni === true || conSommario || doc.protezione !== undefined;
  nomiSegnalibriScritti.clear();
  preparaRiferimenti(doc);
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
    const indice = paragrafoCorpo++;
    if (par.sm) return vocesommarioXml(par, !doc.paragrafi[indice - 1]?.sm, !doc.paragrafi[indice + 1]?.sm);
    return paragrafoXml(par, numId, idLink, idImmagine, segni.get(indice));
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
  if (doc.intestazione !== undefined || doc.filigrana) margini.push({ id: `rId${prossimoId++}`, file: 'header1.xml', radice: 'w:hdr', riferimento: 'w:headerReference', relazione: 'header', paragrafi: doc.intestazione ?? [{ runs: [] }] });
  if (doc.piede !== undefined) margini.push({ id: `rId${prossimoId++}`, file: 'footer1.xml', radice: 'w:ftr', riferimento: 'w:footerReference', relazione: 'footer', paragrafi: doc.piede });
  const nessunLegame = (): never => { throw new Error(t('Intestazione o piè di pagina non validi: niente link né immagini')); };
  const partiMargine = margini.map((m) => INTESTAZIONE + elemento(m.radice, { 'xmlns:w': NS_W, 'xmlns:r': NS_R, ...(m.radice === 'w:hdr' && doc.filigrana ? { 'xmlns:v': NS_VML, 'xmlns:o': NS_O } : {}) }, [
    ...(m.radice === 'w:hdr' && doc.filigrana ? [filigranaXml(doc.filigrana)] : []),
    ...m.paragrafi.map((p) => paragrafoXml({ ...(p.al !== undefined ? { al: p.al } : {}), runs: p.runs }, -1, nessunLegame, nessunLegame)),
  ]));
  const sezione = elemento('w:sectPr', {}, [
    ...margini.map((m) => elemento(m.riferimento, { 'w:type': 'default', 'r:id': m.id })),
    elemento('w:pgSz', { 'w:w': 11906, 'w:h': 16838 }),
    elemento('w:pgMar', { 'w:top': 1440, 'w:right': 1440, 'w:bottom': 1440, 'w:left': 1440, 'w:header': 708, 'w:footer': 708, 'w:gutter': 0 }),
    // le colonne del testo, come le scrive Word (spazio tra le colonne 1,25 cm)
    ...(doc.colonne ? [elemento('w:cols', { 'w:num': doc.colonne, 'w:space': 708 })] : []),
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
    ...(partiCommenti.length > 0 ? [
      elemento('Override', { PartName: '/word/comments.xml', ContentType: `${tipo}.comments+xml` }),
      elemento('Override', { PartName: '/word/commentsExtended.xml', ContentType: `${tipo}.commentsExtended+xml` }),
    ] : []),
    ...(conImpostazioni ? [elemento('Override', { PartName: '/word/settings.xml', ContentType: `${tipo}.settings+xml` })] : []),
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
    ...(partiCommenti.length > 0 ? [
      elemento('Relationship', { Id: `rId${prossimoId++}`, Type: `${NS_R}/comments`, Target: 'comments.xml' }),
      elemento('Relationship', { Id: `rId${prossimoId++}`, Type: 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended', Target: 'commentsExtended.xml' }),
    ] : []),
    ...(conImpostazioni ? [elemento('Relationship', { Id: `rId${prossimoId++}`, Type: `${NS_R}/settings`, Target: 'settings.xml' })] : []),
  ]);
  const enc = new TextEncoder();
  const voci: VoceZip[] = [
    { nome: '[Content_Types].xml', dati: enc.encode(contenuti) },
    { nome: '_rels/.rels', dati: enc.encode(relazioni) },
    { nome: 'word/document.xml', dati: enc.encode(documento) },
    { nome: 'word/_rels/document.xml.rels', dati: enc.encode(relazioniDocumento) },
    { nome: 'word/styles.xml', dati: enc.encode(stiliXml(collegamenti.size > 0 || conSommario, conSommario, stiliUsati(doc))) },
    { nome: 'word/numbering.xml', dati: enc.encode(numerazioneXml(gruppiNumerati, usaAttivita)) },
    ...Array.from(media.values(), (m) => ({ nome: `word/media/${m.nome}`, dati: m.dati })),
    ...margini.map((m, i) => ({ nome: `word/${m.file}`, dati: enc.encode(partiMargine[i]) })),
    ...(partiCommenti.length > 0 ? [
      { nome: 'word/comments.xml', dati: enc.encode(INTESTAZIONE + elemento('w:comments', { 'xmlns:w': NS_W, 'xmlns:w14': NS_W14, 'xmlns:mc': NS_MC, 'mc:Ignorable': 'w14' }, partiCommenti)) },
      { nome: 'word/commentsExtended.xml', dati: enc.encode(INTESTAZIONE + elemento('w15:commentsEx', { 'xmlns:w15': NS_W15, 'xmlns:mc': NS_MC, 'mc:Ignorable': 'w15' }, estesi)) },
    ] : []),
    // il sommario: Word aggiorna i campi (numeri di pagina) all'apertura
    ...(conImpostazioni ? [{ nome: 'word/settings.xml', dati: enc.encode(INTESTAZIONE + elemento('w:settings', { 'xmlns:w': NS_W }, [...(doc.revisioni ? [elemento('w:trackRevisions')] : []), ...(doc.protezione ? [protezioneXml(doc.protezione)] : []), ...(conSommario ? [elemento('w:updateFields', { 'w:val': 'true' })] : [])])) }] : []),
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
  /** stili delle voci del sommario e loro livello */
  sommario?: Map<string, 1 | 2 | 3>;
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
  /** i segnalibri letti (in minuscolo): il segnalibro del paragrafo a cui portano, e se prendono solo etichetta e numero di una didascalia */
  alias: Map<string, { sg: string; e: boolean }>;
  /** un'interruzione di pagina (w:br type=page) è stata letta: il prossimo paragrafo comincia su un foglio nuovo */
  saltoPendente?: boolean;
  /** un'interruzione di colonna (w:br type=column) è stata letta: il prossimo paragrafo comincia nella colonna dopo */
  colonnaPendente?: boolean;
  /** spaziatura (prima, dopo, interlinea, spaziatura contestuale) in vigore per uno stile di paragrafo, o per lo stile predefinito se manca */
  spazio?: (stile?: string) => SpazioStile;
  /** note a piè di pagina e di chiusura: testi per chiave (f<id>, e<id>) e note incontrate nel testo, nell'ordine */
  note?: { testi: Map<string, string>; usate: Array<{ numero: number; testo: string }> };
  /** dentro w:ins o w:del: la modifica registrata dei tratti letti */
  revisione?: Revisione;
  /** commenti: quelli aperti (w:commentRangeStart non ancora chiusi), il commento principale di ogni identificativo (le risposte vanno al loro), quelli che hanno già del testo */
  commenti?: { aperti: string[]; principale: Map<string, string>; ancorati: Set<string> };
  /** stili di paragrafo propri del file (non Normale, Titolo, Sottotitolo, Titolo 1-3 né le voci del sommario): la definizione per
   *  styleId e lo stile personale di pmb_docs, fatto al primo paragrafo che lo usa */
  personali?: { definizioni: Map<string, NodoXml>; predefinito?: string; creati: Map<string, StilePersonale>; ordine: StilePersonale[] };
  /** lo stile personale del paragrafo che si sta leggendo (i tratti senza carattere o corpo propri prendono il suo) */
  stileParagrafo?: StilePersonale;
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

function leggiStili(radice: NodoXml | null): { stili: Map<string, StileParagrafo>; sommario: Map<string, 1 | 2 | 3>; carattere?: string; corpo?: number; temaCarattere?: string; definizioni: Map<string, NodoXml>; predefinito?: string } {
  const stili = new Map<string, StileParagrafo>();
  const sommario = new Map<string, 1 | 2 | 3>();
  const definizioni = new Map<string, NodoXml>();
  let predefinito: string | undefined;
  let carattere: string | undefined;
  let corpo: number | undefined;
  let temaCarattere: string | undefined;
  if (!radice) return { stili, sommario, definizioni };
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
    definizioni.set(id, s);
    // stili delle voci del sommario («toc 1» … «toc 9»; l'identificativo cambia con la lingua di Word: TOC1, Sommario1…)
    const toc = /^toc ([1-9])$/i.exec(nome);
    if (toc) sommario.set(id, Math.min(3, Number(toc[1])) as 1 | 2 | 3);
    if (s.attributi['w:default'] === '1' || s.attributi['w:default'] === 'true') { leggiRPr(trova(s, 'w:rPr')); predefinito = id; }
  }
  // LibreOffice non segna lo stile predefinito: è quello che si chiama Normal
  if (predefinito === undefined) predefinito = [...definizioni.entries()].find(([id, s]) => id === 'Normal' || (val(trova(s, 'w:name')) ?? '').toLowerCase() === 'normal')?.[0];
  return { stili, sommario, carattere, corpo, temaCarattere, definizioni, predefinito };
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

/** Lo stile personale di pmb_docs per lo stile di Word styleId, o undefined se è uno stile già fatto (o non c'è). Si fa al primo uso:
 *  la base è il primo stile già fatto della catena basedOn; carattere, corpo, colore, grassetto, corsivo, sottolineato e allineamento
 *  si prendono dalla catena (il più vicino vince), spazi e interlinea da quelli in vigore per lo stile. */
function stilePersonaleDaWord(id: string, ctx: Contesto): StilePersonale | undefined {
  const P = ctx.personali;
  if (!P) return undefined;
  const fatto = P.creati.get(id);
  if (fatto) return fatto;
  if (ctx.stili.has(id) || ctx.sommario?.has(id) || id === P.predefinito || !P.definizioni.has(id)) return undefined;
  const catena: NodoXml[] = [];
  let base: StileParagrafo = 'n';
  const visti = new Set<string>();
  for (let cur: string | undefined = id; cur !== undefined && !visti.has(cur);) {
    visti.add(cur);
    const st = ctx.stili.get(cur);
    if (st) { base = st; break; }
    if (cur === P.predefinito) break;
    const n = P.definizioni.get(cur);
    if (!n) break;
    catena.unshift(n);
    cur = val(trova(n, 'w:basedOn'));
  }
  const nodo = P.definizioni.get(id) as NodoXml;
  let nome = (val(trova(nodo, 'w:name')) ?? id).trim().slice(0, LUNGHEZZA_MASSIMA_NOME_STILE) || id.slice(0, LUNGHEZZA_MASSIMA_NOME_STILE);
  const prova: Documento = { paragrafi: [], stili: P.ordine };
  for (let k = 2; motivoNome(prova, nome) !== null && k < 1000; k++) nome = `${(val(trova(nodo, 'w:name')) ?? id).trim().slice(0, LUNGHEZZA_MASSIMA_NOME_STILE - 6)} (${k})`;
  let pid = id.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z]/.test(pid)) pid = `S${pid}`;
  pid = pid.slice(0, 36);
  const usati = new Set(P.ordine.map((x) => x.id));
  for (let k = 2, radice = pid; usati.has(pid); k++) pid = `${radice}${k}`;
  const s: Record<string, unknown> = { id: pid, nome, base };
  for (const n of catena) {
    const rPr = trova(n, 'w:rPr');
    if (rPr) {
      const rf = trova(rPr, 'w:rFonts');
      const esplicito = rf?.attributi['w:ascii'] ?? rf?.attributi['w:hAnsi'];
      const tema = rf?.attributi['w:asciiTheme'] ?? rf?.attributi['w:hAnsiTheme'];
      if (esplicito) s.f = esplicito;
      else if (tema) { const t = tema.startsWith('major') ? ctx.tema.maggiore : ctx.tema.minore; if (t) s.f = t; }
      const sz = Number(val(trova(rPr, 'w:sz')));
      if (Number.isFinite(sz) && sz > 0) s.z = sz / 2;
      const colore = val(trova(rPr, 'w:color'));
      if (colore && /^[0-9a-fA-F]{6}$/.test(colore)) s.k = `#${colore.toLowerCase()}`;
      if (trova(rPr, 'w:b')) s.g = attivo(trova(rPr, 'w:b'));
      if (trova(rPr, 'w:i')) s.c = attivo(trova(rPr, 'w:i'));
      const u = trova(rPr, 'w:u');
      if (u) s.s = val(u) !== 'none';
    }
    const jc = val(trova(n, 'w:pPr/w:jc'));
    if (jc === 'center') s.al = 'ce'; else if (jc === 'right' || jc === 'end') s.al = 'dx'; else if (jc === 'both' || jc === 'distribute') s.al = 'gi'; else if (jc === 'left' || jc === 'start') delete s.al;
  }
  if (typeof s.f === 'string' && s.f.toLowerCase() === ctx.carattere.toLowerCase()) delete s.f;
  if (s.z === ctx.corpo) delete s.z;
  // spazi e interlinea: solo quelli scritti negli stili personali della catena (quelli dello stile di base li dà già la base)
  const sp: SpazioStile = Object.assign({}, ...catena.map((n) => leggiSpazio(trova(n, 'w:pPr/w:spacing'))));
  if (sp.sb !== undefined) s.sb = sp.sb;
  if (sp.sa !== undefined) s.sa = sp.sa;
  if (sp.line !== undefined && sp.line > 0) { const ls = Math.round(sp.line * 100) / 100; if (ls >= 0.5 && ls <= 5 && ls !== 1.15) s.ls = ls; }
  const valido = stileValido(s);
  if (!valido) return undefined;
  P.creati.set(id, valido);
  P.ordine.push(valido);
  return valido;
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
  const personale = !st && stile !== undefined ? stilePersonaleDaWord(stile, ctx) : undefined;
  if (st) a.st = st;
  else if (personale) { a.su = personale.id; if (personale.base !== 'n') a.st = personale.base; }
  const jc = val(trova(pPr, 'w:jc'));
  if (jc === 'center') a.al = 'ce';
  else if (jc === 'right' || jc === 'end') a.al = 'dx';
  else if (jc === 'both' || jc === 'distribute') a.al = 'gi';
  else if (jc === undefined && personale?.al !== undefined) a.al = personale.al;
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
  const sp = ctx.stileParagrafo;
  let carattere = sp?.f ?? ctx.carattere;
  let corpo = sp?.z ?? ctx.corpo;
  if (rPr) {
    f.g = attivo(trova(rPr, 'w:b'));
    f.c = attivo(trova(rPr, 'w:i'));
    const u = trova(rPr, 'w:u');
    // il sottolineato doppio di Word è un sottolineato a sé (w:u double)
    if (u && val(u) === 'double') { f.s = false; f.w = 'd'; } else f.s = !!u && val(u) !== 'none';
    if (attivo(trova(rPr, 'w:strike'))) f.x = 'b';
    if (attivo(trova(rPr, 'w:smallCaps'))) f.q = 'm';
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
  if (sp?.f !== undefined ? carattere !== sp.f : carattere.toLowerCase() !== CARATTERE_NORMALE.toLowerCase()) f.f = carattere;
  if ((sp?.z !== undefined ? corpo !== sp.z : corpo !== CORPO_NORMALE) && corpo >= 1 && corpo <= 400) f.z = corpo;
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
  const im: Immagine = { s, w: lw, h: lh };
  // testo alternativo: descr di wp:docPr (Word lo scrive lì), o il titolo se manca
  const docPr = cercaNodo(disegno, 'wp:docPr');
  const alt = (docPr?.attributi['descr'] ?? docPr?.attributi['title'] ?? '').trim();
  if (alt !== '') im.d = alt.slice(0, LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO);
  // ancorata con il testo intorno (a riquadro, stretto, attraverso): a sinistra o a destra secondo l'allineamento o la posizione
  const ancora = cercaNodo(disegno, 'wp:anchor');
  if (ancora && ancora.attributi['behindDoc'] !== '1' && ['wp:wrapSquare', 'wp:wrapTight', 'wp:wrapThrough'].some((n) => figliElemento(ancora, n).length > 0)) {
    const ph = figliElemento(ancora, 'wp:positionH')[0];
    const allinea = ph ? figliElemento(ph, 'wp:align')[0] : undefined;
    const testoAllinea = allinea ? allinea.figli.filter((x): x is string => typeof x === 'string').join('').trim() : '';
    const scosta = ph ? figliElemento(ph, 'wp:posOffset')[0] : undefined;
    const offset = scosta ? Number(scosta.figli.filter((x): x is string => typeof x === 'string').join('')) / EMU_PER_PIXEL : NaN;
    if (testoAllinea === 'right' || testoAllinea === 'outside') im.a = 'dx';
    else if (testoAllinea === 'left' || testoAllinea === 'inside' ) im.a = 'sx';
    else if (Number.isFinite(offset)) im.a = offset + w / 2 > LARGHEZZA_TESTO_PIXEL / 2 ? 'dx' : 'sx';
  }
  return im;
}

/** Larghezza del testo della pagina di Word in pixel (A4 con margini di un pollice), per capire da che parte sta un'immagine spostata. */
const LARGHEZZA_TESTO_PIXEL = 602;

const CONTENITORI_RUN = new Set(['w:hyperlink', 'w:moveTo', 'w:smartTag', 'w:fldSimple', 'w:sdt', 'w:sdtContent', 'w:customXml']);

/** Inizio o fine di un commento nel testo (anche tra un paragrafo e l'altro). */
function segnaCommento(f: NodoXml, ctx: Contesto): boolean {
  if (!ctx.commenti || (f.nome !== 'w:commentRangeStart' && f.nome !== 'w:commentRangeEnd')) return false;
  const id = ctx.commenti.principale.get(f.attributi['w:id'] ?? '');
  if (id === undefined) return true;
  const aperti = ctx.commenti.aperti;
  if (f.nome === 'w:commentRangeStart') aperti.push(id);
  else { const k = aperti.lastIndexOf(id); if (k >= 0) aperti.splice(k, 1); }
  return true;
}
/** Commento e modifica registrata dei tratti che si stanno leggendo. */
function segniTratto(ctx: Contesto): Pick<Run, 'cm' | 'rv'> {
  const o: Pick<Run, 'cm' | 'rv'> = {};
  const aperti = ctx.commenti?.aperti;
  if (aperti && aperti.length > 0) { o.cm = aperti[aperti.length - 1]; ctx.commenti!.ancorati.add(o.cm); }
  if (ctx.revisione) o.rv = { ...ctx.revisione };
  return o;
}
function revisioneDa(n: NodoXml, t: 'i' | 'd'): Revisione {
  return { t, a: (n.attributi['w:author'] ?? '').slice(0, LUNGHEZZA_MASSIMA_AUTORE), d: (n.attributi['w:date'] ?? '').slice(0, 40) };
}
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

type TipoCampo = 'pagina' | 'pagine' | 'unione' | 'sequenza' | 'riferimento' | null;
/** Il tipo di un campo dalla sua istruzione: il numero della pagina e delle pagine contano solo nelle intestazioni e nei piè di pagina
 *  (margini); il campo di unione (MERGEFIELD) ovunque. */
function tipoCampo(istruzione: string, margini = true): TipoCampo {
  if (margini && /^\s*PAGE\b/i.test(istruzione)) return 'pagina';
  if (margini && /^\s*NUMPAGES\b/i.test(istruzione)) return 'pagine';
  if (nomeMergefield(istruzione) !== null) return 'unione';
  if (nomeSeq(istruzione) !== null) return 'sequenza';
  if (nomeRef(istruzione) !== null) return 'riferimento';
  return null;
}
/** Il segnalibro di REF Nome (le opzioni \h \n \p... si ignorano). */
function nomeRef(istruzione: string): string | null {
  const m = /^\s*REF\s+([^\s\\"]+)/i.exec(istruzione);
  return m ? nomeSegnalibroValido(m[1]) : null;
}
/** Il nome della serie di SEQ Figura o SEQ "Nome con spazi" (le opzioni \* \r \h... si ignorano). */
function nomeSeq(istruzione: string): string | null {
  const m = /^\s*SEQ\s+(?:"([^"]+)"|([^\s\\]+))/i.exec(istruzione);
  return m ? nomeCampoValido(m[1] ?? m[2]) : null;
}
/** Il nome del campo di MERGEFIELD Nome o MERGEFIELD "Nome con spazi" (le opzioni \* \b \f... si ignorano). */
function nomeMergefield(istruzione: string): string | null {
  const m = /^\s*MERGEFIELD\s+(?:"([^"]+)"|([^\s\\]+))/i.exec(istruzione);
  return m ? nomeCampoValido(m[1] ?? m[2]) : null;
}
/** Un campo complesso (fldChar) in lettura: l'istruzione che si accumula, e se si è già nel suo risultato. */
interface CampoAperto { istruzione: string; tipo: TipoCampo; risultato: boolean; formato: Omit<Run, 't'> }

function convertiParagrafo(p: NodoXml, ctx: Contesto): Paragrafo[] {
  const attrs = leggiPPr(trova(p, 'w:pPr'), ctx);
  ctx.stileParagrafo = attrs.su !== undefined ? ctx.personali?.ordine.find((s) => s.id === attrs.su) : undefined;
  try { return convertiParagrafoCon(p, ctx, attrs); } finally { ctx.stileParagrafo = undefined; }
}

function convertiParagrafoCon(p: NodoXml, ctx: Contesto, attrs: AttributiParagrafo): Paragrafo[] {
  const risultato: Paragrafo[] = [];
  let corrente: Run[] = [];
  let campo: CampoAperto | null = null;
  const emettiCampo = (c: CampoAperto): void => {
    if (c.tipo === 'unione') { const nome = nomeMergefield(c.istruzione); if (nome !== null) corrente.push({ ...c.formato, t: CAMPO_UNIONE, cu: nome }); return; }
    if (c.tipo === 'sequenza') { const nome = nomeSeq(c.istruzione); if (nome !== null) corrente.push({ ...c.formato, t: CAMPO_SEQUENZA, sq: nome }); return; }
    if (c.tipo === 'riferimento') { const nome = nomeRef(c.istruzione); if (nome !== null) corrente.push({ ...c.formato, t: CAMPO_RIFERIMENTO, xr: nome, xm: 't' }); return; }
    corrente.push({ ...c.formato, t: c.tipo === 'pagina' ? CAMPO_PAGINA : CAMPO_PAGINE });
  };
  const continuazione: AttributiParagrafo = { ...attrs }; // i pezzi dopo il primo non ripetono salto di pagina, spazio prima e segnalibro
  delete continuazione.sp; delete continuazione.sb; delete continuazione.sg;
  const chiudi = (): void => { const sp = ctx.saltoPendente === true, sc = ctx.colonnaPendente === true; ctx.saltoPendente = false; ctx.colonnaPendente = false; risultato.push({ ...(risultato.length === 0 ? attrs : continuazione), ...(sp ? { sp: true } : {}), ...(sc ? { sc: true } : {}), runs: normalizza(corrente) }); corrente = []; };
  const leggiRun = (r: NodoXml, u?: string): void => {
    const formato = leggiFormatoRun(trova(r, 'w:rPr'), ctx);
    if (u !== undefined) {
      // l'azzurro e la sottolineatura sono quelli del link, non un formato del testo
      if (formato.k === '#1155cc' || formato.k === '#0563c1') delete formato.k;
      formato.s = false;
    }
    let testo = '';
    const scarica = (): void => { if (testo !== '') corrente.push({ ...formato, t: testo, ...(u !== undefined ? { u } : {}), ...segniTratto(ctx) }); testo = ''; };
    for (const f of r.figli) {
      if (typeof f === 'string') continue;
      if (f.nome === 'w:fldChar') {
        scarica();
        const fase = f.attributi['w:fldCharType'];
        if (fase === 'begin') campo = { istruzione: '', tipo: null, risultato: false, formato };
        else if (fase === 'separate' && campo) { campo.tipo = tipoCampo(campo.istruzione, ctx.campi === true); campo.risultato = true; if (campo.tipo) emettiCampo(campo); }
        else if (fase === 'end' && campo) {
          if (!campo.risultato) { campo.tipo = tipoCampo(campo.istruzione, ctx.campi === true); if (campo.tipo) emettiCampo(campo); }
          campo = null;
        }
        continue;
      }
      if (campo && (!campo.risultato || campo.tipo)) {
        if (f.nome === 'w:instrText' && !campo.risultato) campo.istruzione += f.figli.filter((x): x is string => typeof x === 'string').join('');
        continue;
      }
      if (f.nome === 'w:t' || (f.nome === 'w:delText' && ctx.revisione?.t === 'd')) testo += f.figli.filter((x): x is string => typeof x === 'string').join('');
      else if (f.nome === 'w:commentReference' && ctx.commenti) {
        // un commento senza inizio e fine nel testo: si attacca al tratto prima del richiamo
        const id = ctx.commenti.principale.get(f.attributi['w:id'] ?? '');
        scarica();
        const ultimo = corrente[corrente.length - 1];
        if (id !== undefined && !ctx.commenti.ancorati.has(id) && ultimo && ultimo.cm === undefined) { corrente[corrente.length - 1] = { ...ultimo, cm: id }; ctx.commenti.ancorati.add(id); }
      }
      else if (f.nome === 'w:tab') testo += '\t';
      else if (f.nome === 'w:noBreakHyphen') testo += '\u2011';
      else if (f.nome === 'w:softHyphen') testo += '\u00ad';
      else if ((f.nome === 'w:footnoteReference' || f.nome === 'w:endnoteReference') && ctx.note && ctx.note.usate.length < NOTE_MASSIME) {
        // la nota diventa come quelle di pmb_docs: un numero in apice nel testo e un paragrafo "N. testo" in fondo al documento
        const nota = ctx.note.testi.get((f.nome === 'w:footnoteReference' ? 'f' : 'e') + (f.attributi['w:id'] ?? ''));
        if (nota !== undefined) {
          const numero = ctx.note.usate.length + 1;
          ctx.note.usate.push({ numero, testo: nota });
          scarica();
          corrente.push({ ...formato, t: String(numero), v: 'p', ...(u !== undefined ? { u } : {}), ...segniTratto(ctx) });
        }
      }
      else if (f.nome === 'w:drawing' || f.nome === 'mc:AlternateContent') {
        const disegno = f.nome === 'w:drawing' ? f : cercaNodo(f, 'w:drawing');
        const im = disegno ? leggiDisegno(disegno, ctx) : null;
        if (im) { scarica(); corrente.push({ ...formato, t: OGGETTO, im, ...(u !== undefined ? { u } : {}), ...segniTratto(ctx) }); }
      }
      else if ((f.nome === 'w:br' && ((f.attributi['w:type'] ?? 'textWrapping') === 'textWrapping')) || f.nome === 'w:cr') { scarica(); chiudi(); }
      else if (f.nome === 'w:br' && f.attributi['w:type'] === 'page') { scarica(); if (corrente.length > 0) chiudi(); ctx.saltoPendente = true; }
      else if (f.nome === 'w:br' && f.attributi['w:type'] === 'column') { scarica(); if (corrente.length > 0) chiudi(); ctx.colonnaPendente = true; }
    }
    scarica();
  };
  const visita = (n: NodoXml, u?: string): void => {
    for (const f of n.figli) {
      if (typeof f === 'string') continue;
      if (f.nome === 'w:r') leggiRun(f, u);
      else if (segnaCommento(f, ctx)) continue;
      else if (f.nome === 'w:ins' || f.nome === 'w:del') {
        // testo inserito o cancellato con la registrazione delle modifiche
        const prima = ctx.revisione;
        ctx.revisione = revisioneDa(f, f.nome === 'w:ins' ? 'i' : 'd');
        visita(f, u);
        ctx.revisione = prima;
      }
      else if (f.nome === 'w:hyperlink') visita(f, ctx.link.get(f.attributi['r:id'] ?? ''));
      else if (f.nome === 'w:fldSimple' && tipoCampo(f.attributi['w:instr'] ?? '', ctx.campi === true) !== null) {
        const primo = cercaNodo(f, 'w:r');
        const formatoCampo = leggiFormatoRun(primo ? trova(primo, 'w:rPr') : undefined, ctx);
        const istr = f.attributi['w:instr'] ?? '';
        const tipo = tipoCampo(istr, ctx.campi === true);
        if (tipo === 'unione') corrente.push({ ...formatoCampo, t: CAMPO_UNIONE, cu: nomeMergefield(istr)! });
        else if (tipo === 'sequenza') corrente.push({ ...formatoCampo, t: CAMPO_SEQUENZA, sq: nomeSeq(istr)! });
        else if (tipo === 'riferimento') corrente.push({ ...formatoCampo, t: CAMPO_RIFERIMENTO, xr: nomeRef(istr)!, xm: 't' });
        else corrente.push({ ...formatoCampo, t: tipo === 'pagina' ? CAMPO_PAGINA : CAMPO_PAGINE });
      }
      else if (f.nome === 'w:fldSimple') visita(f, indirizzoCampo(f.attributi['w:instr']) ?? u);
      else if (CONTENITORI_RUN.has(f.nome)) visita(f, u);
    }
  };
  visita(p);
  // un'interruzione di pagina in fondo al paragrafo non lascia un paragrafo vuoto: il salto passa al paragrafo che segue
  if (!((ctx.saltoPendente === true || ctx.colonnaPendente === true) && corrente.length === 0 && risultato.length > 0)) chiudi();
  // lo spazio dopo conta solo sull'ultimo pezzo
  for (let k = 0; k < risultato.length - 1; k++) if (risultato[k].sa !== undefined) { const senza = { ...risultato[k] }; delete senza.sa; risultato[k] = senza; }
  // il segnalibro (quelli di Word che cominciano con _ sono interni: _GoBack, _Toc...) va solo sul primo dei paragrafi nati da questo
  // i segnalibri di Word che cominciano con _ sono interni (_GoBack…): restano solo quelli dei titoli del sommario (_Toc…)
  // restano anche quelli dei riferimenti incrociati (_Ref…). Se il paragrafo ne ha più d'uno, il primo che lo prende tutto è il suo; gli
  // altri rimandano allo stesso paragrafo (ctx.alias). Uno che in una didascalia finisce prima della fine prende solo etichetta e numero.
  const tenuti = p.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'w:bookmarkStart' && (!(f.attributi['w:name'] ?? '_').startsWith('_') || /^_(Toc|Ref)/i.test(f.attributi['w:name'] ?? '')));
  const parziale = (b: NodoXml): boolean => {
    const fine = p.figli.findIndex((f) => typeof f !== 'string' && f.nome === 'w:bookmarkEnd' && f.attributi['w:id'] === b.attributi['w:id']);
    if (fine < 0) return false;
    const conTesto = (n: NodoXml): boolean => n.nome === 'w:t' ? n.figli.some((x) => typeof x === 'string' && x.trim() !== '') : n.figli.some((x) => typeof x !== 'string' && conTesto(x));
    return p.figli.slice(fine + 1).some((f) => typeof f !== 'string' && conTesto(f));
  };
  const didascalia = risultato[0].runs.some((r) => r.sq !== undefined);
  const segnalibro = tenuti.find((b) => !parziale(b)) ?? tenuti[0];
  const nomeSg = segnalibro ? nomeSegnalibroValido(segnalibro.attributi['w:name'] ?? '') : null;
  if (nomeSg !== null) {
    risultato[0] = { ...risultato[0], sg: nomeSg };
    for (const b of tenuti) {
      const nome = nomeSegnalibroValido(b.attributi['w:name'] ?? '');
      if (nome !== null && !ctx.alias.has(nome.toLowerCase())) ctx.alias.set(nome.toLowerCase(), { sg: nomeSg, e: didascalia && parziale(b) });
    }
  }
  // voce del sommario: stile «toc N»; il titolo a cui rimanda è nel collegamento (w:anchor); il numero di pagina dopo la tabulazione si toglie
  const stileP = val(trova(trova(p, 'w:pPr') ?? p, 'w:pStyle'));
  const livelloToc = stileP !== undefined ? ctx.sommario?.get(stileP) : undefined;
  if (livelloToc !== undefined && risultato.length === 1) {
    // senza collegamento (sommario di Word senza l'opzione \h) il titolo è nel campo PAGEREF della voce
    const istruzioni: string[] = [];
    const raccogli = (n: NodoXml): void => { for (const f of n.figli) if (typeof f !== 'string') { if (f.nome === 'w:instrText') istruzioni.push(f.figli.filter((x): x is string => typeof x === 'string').join('')); else raccogli(f); } };
    raccogli(p);
    const daCampo = /PAGEREF\s+(_?[A-Za-z0-9_]+)/.exec(istruzioni.join(''))?.[1];
    const ancora = cercaNodo(p, 'w:hyperlink')?.attributi['w:anchor'] ?? daCampo ?? '';
    const testo = risultato[0].runs.map((r) => r.t).join('').replace(/\t[^\t]*$/, '').trim();
    const primo = risultato[0].runs[0];
    const { st, el, ri, al, ...resto } = risultato[0]; void st; void el; void ri; void al;
    risultato[0] = { ...resto, sm: { n: ancora.slice(0, 60), l: livelloToc }, runs: testo === '' ? [] : [{ t: testo, g: primo?.g ?? false, c: primo?.c ?? false, s: false }] };
  }
  return risultato;
}

/** Tutti i paragrafi di un blocco, senza tabelle: quelle (anche annidate) diventano i loro paragrafi, uno dopo l'altro. */
function appiattisciCorpo(n: NodoXml, ctx: Contesto, out: Paragrafo[]): void {
  for (const f of n.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === 'w:p') out.push(...convertiParagrafo(f, ctx));
    else if (segnaCommento(f, ctx)) continue;
    else if (CONTENITORI_CORPO.has(f.nome)) appiattisciCorpo(f, ctx, out);
  }
}

const RIGHE_MASSIME_IMPORT = 1000;
const COLONNE_MASSIME_IMPORT = 100;
const VUOTA = (): Paragrafo[] => [{ runs: [] }];

function convertiTabella(tbl: NodoXml, ctx: Contesto, out: Paragrafo[], id: number): void {
  const griglia: Paragrafo[][][] = [];
  const unioni: Unione[][] = [];
  // le righe di intestazione (w:tblHeader) contano solo in cima alla tabella, come in Word
  let inCima = true;
  for (const tr of figliElemento(tbl, 'w:tr')) {
    const riga: Paragrafo[][] = [];
    const uRiga: Unione[] = [];
    const th = trova(tr, 'w:trPr/w:tblHeader');
    const h = inCima && th !== undefined && th !== null && !['0', 'false', 'off'].includes(val(th) ?? '');
    if (!h) inCima = false;
    for (const tc of figliElemento(tr, 'w:tc')) {
      const unione = Number(val(trova(tc, 'w:tcPr/w:gridSpan')) ?? 1);
      const larga = Number.isInteger(unione) && unione > 1 ? Math.min(unione, COLONNE_MASSIME_IMPORT + 1) : 1;
      const vm = trova(tc, 'w:tcPr/w:vMerge');
      const continua = vm !== undefined && vm !== null && val(vm) !== 'restart';
      const contenuto: Paragrafo[] = [];
      // anche una cella che continua un'unione verticale va letta (segnalibri, commenti), ma il testo resta nella cella di sopra
      appiattisciCorpo(tc, ctx, contenuto);
      const col = uRiga.length;
      // vMerge: l'unione comincia nella stessa colonna di una riga sopra; se lì non c'è un'ancora larga uguale, la cella resta normale
      const sopra = unioni.length > 0 ? ancoraDi(unioni, unioni.length - 1, col) : null;
      const ancora = continua && sopra && sopra[1] === col && unioni[sopra[0]][col].cs === larga ? unioni[sopra[0]][col] : null;
      if (ancora) {
        ancora.rs++;
        for (let k = 0; k < larga; k++) { riga.push(VUOTA()); uRiga.push({ cs: 1, rs: 1, co: true, h }); }
        continue;
      }
      riga.push(contenuto.length > 0 && !continua ? contenuto : VUOTA());
      uRiga.push({ cs: larga, rs: 1, co: false, h });
      for (let k = 1; k < larga; k++) { riga.push(VUOTA()); uRiga.push({ cs: 1, rs: 1, co: true, h }); }
    }
    if (riga.length > 0) { griglia.push(riga); unioni.push(uRiga); }
  }
  const colonne = griglia.reduce((m, r) => Math.max(m, r.length), 0);
  if (griglia.length > RIGHE_MASSIME_IMPORT || colonne > COLONNE_MASSIME_IMPORT) { appiattisciCorpo(tbl, ctx, out); return; }
  griglia.forEach((riga, r) => {
    while (riga.length < colonne) { riga.push(VUOTA()); unioni[r].push({ cs: 1, rs: 1, co: false, h: unioni[r][0]?.h ?? false }); }
  });
  const sistemate = riparaUnioni(unioni);
  griglia.forEach((riga, r) => riga.forEach((cella, c) => {
    const u = sistemate[r][c];
    const tb = cellaCon(id, r, c, u);
    if (u.co) out.push({ runs: [], tb });
    else cella.forEach((par) => out.push({ ...par, tb: { ...tb } }));
  }));
}

function convertiCorpo(n: NodoXml, ctx: Contesto, out: Paragrafo[], tabelle: { prossima: number }): void {
  for (const f of n.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === 'w:p') out.push(...convertiParagrafo(f, ctx));
    else if (segnaCommento(f, ctx)) continue;
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
  appiattisciCorpo(radice, { ...ctx, campi: true, commenti: undefined, revisione: undefined, personali: undefined }, tutti);
  const paragrafi: Paragrafo[] = tutti.map((p) => ({
    ...(p.al !== undefined ? { al: p.al } : {}),
    runs: tagliaTratti(normalizza(p.runs.filter((r) => r.im === undefined && r.rv?.t !== 'd').map(({ u, cm, rv, ...resto }) => { void u; void cm; void rv; return resto; })), MARGINE_CARATTERI),
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

const COMMENTI_MASSIMI = 2000;
/** Il testo di un commento: i suoi paragrafi, uno per riga. */
function testoCommento(c: NodoXml): string {
  const righe: string[] = [];
  const visita = (n: NodoXml, riga: string[]): void => {
    for (const f of n.figli) {
      if (typeof f === 'string') continue;
      if (f.nome === 'w:t') riga.push(f.figli.filter((y): y is string => typeof y === 'string').join(''));
      else if (f.nome === 'w:tab') riga.push('\t');
      else if (f.nome === 'w:br') riga.push('\n');
      else if (f.nome !== 'w:delText') visita(f, riga);
    }
  };
  for (const p of figliElemento(c, 'w:p')) { const riga: string[] = []; visita(p, riga); righe.push(riga.join('')); }
  return righe.join('\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, LUNGHEZZA_MASSIMA_COMMENTO);
}
/**
 * I commenti di word/comments.xml, con risposte e «risolto» da word/commentsExtended.xml (Word 2013 e dopo): l'elenco dei commenti
 * principali, e per ogni identificativo di Word il commento principale a cui va il testo (le risposte vanno a quello a cui rispondono).
 */
function leggiCommenti(radice: NodoXml | null, estesi: NodoXml | null): { elenco: Commento[]; principale: Map<string, string> } {
  const elenco: Commento[] = [];
  const principale = new Map<string, string>();
  if (!radice) return { elenco, principale };
  const perParaId = new Map<string, string>();
  const dati: Array<{ id: string; a: string; d: string; t: string }> = [];
  for (const c of figliElemento(radice, 'w:comment').slice(0, COMMENTI_MASSIMI)) {
    const id = c.attributi['w:id'] ?? '';
    if (!ID_COMMENTO.test(id)) continue;
    const paragrafi = figliElemento(c, 'w:p');
    const pid = paragrafi.length > 0 ? paragrafi[paragrafi.length - 1].attributi['w14:paraId'] : undefined;
    if (pid) perParaId.set(pid.toUpperCase(), id);
    dati.push({ id, a: (c.attributi['w:author'] ?? '').slice(0, LUNGHEZZA_MASSIMA_AUTORE), d: (c.attributi['w:date'] ?? '').slice(0, 40), t: testoCommento(c) });
  }
  const padre = new Map<string, string>();
  const risolti = new Set<string>();
  for (const e of estesi ? figliElemento(estesi, 'w15:commentEx') : []) {
    const id = perParaId.get((e.attributi['w15:paraId'] ?? '').toUpperCase());
    if (id === undefined) continue;
    const p = perParaId.get((e.attributi['w15:paraIdParent'] ?? '').toUpperCase());
    if (p !== undefined && p !== id) padre.set(id, p);
    if (e.attributi['w15:done'] === '1') risolti.add(id);
  }
  const radiceDi = (id: string): string => { let x = id; const visti = new Set<string>(); while (padre.has(x) && !visti.has(x)) { visti.add(x); x = padre.get(x)!; } return x; };
  const principali = new Map<string, Commento>();
  for (const d of dati) if (radiceDi(d.id) === d.id) { const c: Commento = { ...d, ...(risolti.has(d.id) ? { ok: true } : {}) }; principali.set(d.id, c); elenco.push(c); }
  for (const d of dati) {
    const r = radiceDi(d.id);
    principale.set(d.id, principali.has(r) ? r : d.id);
    if (r !== d.id && principali.has(r)) { const c = principali.get(r)!; c.r = [...(c.r ?? []), { a: d.a, d: d.d, t: d.t }]; }
  }
  return { elenco, principale };
}

/** La protezione in sola lettura come la scrive Word (Limita modifica): con l'impronta di Word (cryptAlgorithmSid 14 = SHA-512). */
function protezioneXml(p: NonNullable<Documento['protezione']>): string {
  const w = p.impronte?.find((i) => i.alg === 'Word-SHA-512' && i.sale !== undefined);
  return elemento('w:documentProtection', {
    'w:edit': 'readOnly', 'w:enforcement': 1,
    ...(w ? { 'w:cryptProviderType': 'rsaAES', 'w:cryptAlgorithmClass': 'hash', 'w:cryptAlgorithmType': 'typeAny', 'w:cryptAlgorithmSid': 14, 'w:cryptSpinCount': w.giri ?? 100000, 'w:hash': w.hash, 'w:salt': w.sale! } : {}),
  });
}

/** La protezione di Word: solo «sola lettura» applicata (enforcement); l'impronta se è quella di Word con SHA-512 (Sid 14, o algorithmName
 *  SHA-512 della forma nuova, che usa la password senza la chiave a 32 bit). Con altre impronte la protezione resta senza password. */
function leggiProtezione(n: NodoXml | undefined | null): Documento['protezione'] | undefined {
  if (!n || n.attributi['w:edit'] !== 'readOnly' || !attivo({ ...n, attributi: { 'w:val': n.attributi['w:enforcement'] ?? '0' } })) return undefined;
  const a = n.attributi;
  if (a['w:cryptAlgorithmSid'] === '14' && a['w:hash'] && a['w:salt']) {
    const impronte = impronteValide([{ alg: 'Word-SHA-512', hash: a['w:hash'], sale: a['w:salt'], giri: Number(a['w:cryptSpinCount'] ?? 100000) }]);
    return impronte ? { impronte } : {};
  }
  if (a['w:algorithmName'] === 'SHA-512' && a['w:hashValue'] && a['w:saltValue']) {
    const impronte = impronteValide([{ alg: 'SHA-512', hash: a['w:hashValue'], sale: a['w:saltValue'], giri: Number(a['w:spinCount'] ?? 100000) }]);
    return impronte ? { impronte } : {};
  }
  return {};
}

/** I riferimenti incrociati letti puntano al segnalibro scritto nel campo REF: qui passano al segnalibro del paragrafo, e quelli a un
 *  segnalibro di sola etichetta e numero diventano «Figura 2». Quelli a un segnalibro che non c'è restano (mostrano l'errore). */
function risolviRiferimenti(paragrafi: Paragrafo[], alias: Map<string, { sg: string; e: boolean }>): Paragrafo[] {
  return paragrafi.map((p) => (p.runs.some((r) => r.xr !== undefined)
    ? { ...p, runs: p.runs.map((r) => { const a = r.xr !== undefined ? alias.get(r.xr.toLowerCase()) : undefined; return a ? { ...r, xr: a.sg, xm: a.e ? 'e' : 't' } : r; }) }
    : p));
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
    sommario: stili.sommario,
    spazio: creaSpazio(radiceStili),
    note: { testi: new Map(), usate: [] },
    numeri: leggiNumerazione(leggi(parte('numbering', predef('numbering.xml')))),
    carattere: CARATTERE_NORMALE,
    corpo: CORPO_NORMALE,
    tema,
    link: leggiLink(relPrincipale),
    immagini: leggiImmagini(relPrincipale, file, principale),
    alias: new Map(),
    personali: { definizioni: stili.definizioni, ...(stili.predefinito !== undefined ? { predefinito: stili.predefinito } : {}), creati: new Map(), ordine: [] },
  };
  if (stili.carattere) ctx.carattere = stili.carattere;
  else if (stili.temaCarattere) ctx.carattere = (stili.temaCarattere.startsWith('major') ? tema.maggiore : tema.minore) ?? CARATTERE_NORMALE;
  if (stili.corpo) ctx.corpo = stili.corpo;
  const commenti = leggiCommenti(leggi(parte('comments', predef('comments.xml'))), leggi(parte('commentsExtended', predef('commentsExtended.xml'))));
  ctx.commenti = { aperti: [], principale: commenti.principale, ancorati: new Set() };
  leggiNote(leggi(parte('footnotes', predef('footnotes.xml'))), 'w:footnote', 'f', ctx.note!.testi);
  leggiNote(leggi(parte('endnotes', predef('endnotes.xml'))), 'w:endnote', 'e', ctx.note!.testi);
  const paragrafi: Paragrafo[] = [];
  convertiCorpo(corpo, ctx, paragrafi, { prossima: 0 });
  paragrafi.push(...paragrafiNote(ctx.note!.usate));
  const tutti = risolviRiferimenti(paragrafoDopoLeTabelle(applicaSpazioContestuale(paragrafi)), ctx.alias);
  let documento: Documento = { paragrafi: tutti.length > 0 ? tutti : [{ runs: [] }] };
  if (ctx.personali!.ordine.length > 0) documento.stili = ctx.personali!.ordine;
  const conTesto = commenti.elenco.filter((c) => ctx.commenti!.ancorati.has(c.id));
  if (conTesto.length > 0) documento.commenti = conTesto;
  const impostazioni = leggi(parte('settings', predef('settings.xml')));
  if (impostazioni && trova(impostazioni, 'w:trackRevisions') && attivo(trova(impostazioni, 'w:trackRevisions'))) documento.revisioni = true;
  const protezione = impostazioni ? leggiProtezione(trova(impostazioni, 'w:documentProtection')) : undefined;
  if (protezione) documento.protezione = protezione;
  const sezione = trova(corpo, 'w:sectPr');
  const numeroColonne = Number(sezione ? trova(sezione, 'w:cols')?.attributi['w:num'] : undefined);
  if (numeroColonne === 2 || numeroColonne === 3) documento.colonne = numeroColonne;
  const margine = (riferimento: string): Paragrafo[] | undefined => {
    const r = sezione ? figliElemento(sezione, riferimento).find((x) => (x.attributi['w:type'] ?? 'default') === 'default') : undefined;
    const legame = r && relPrincipale ? figliElemento(relPrincipale, 'Relationship').find((x) => x.attributi['Id'] === r.attributi['r:id']) : undefined;
    return legame?.attributi['Target'] ? leggiMargine(leggi(percorsoRelativo(principale, legame.attributi['Target'])), ctx) : undefined;
  };
  const intestazione = margine('w:headerReference');
  // la filigrana di Word: la forma con il testo (v:textpath string) nell'intestazione
  const fonteFiligrana = (() => {
    const r = sezione ? figliElemento(sezione, 'w:headerReference').find((x) => (x.attributi['w:type'] ?? 'default') === 'default') : undefined;
    const legame = r && relPrincipale ? figliElemento(relPrincipale, 'Relationship').find((x) => x.attributi['Id'] === r.attributi['r:id']) : undefined;
    const radice = legame?.attributi['Target'] ? leggi(percorsoRelativo(principale, legame.attributi['Target'])) : null;
    // la prima v:textpath con il testo (quella della v:shapetype non ne ha)
    const cerca = (n: NodoXml): string | undefined => {
      if (n.nome === 'v:textpath' && n.attributi['string']) return n.attributi['string'];
      for (const f of n.figli) if (typeof f !== 'string') { const s = cerca(f); if (s) return s; }
      return undefined;
    };
    return radice ? cerca(radice) : undefined;
  })();
  if (fonteFiligrana) { const f = filigranaValida(fonteFiligrana.slice(0, LUNGHEZZA_MASSIMA_FILIGRANA)); if (f) documento.filigrana = f; }
  const piede = margine('w:footerReference');
  try { if (intestazione) documento = impostaIntestazione(documento, intestazione); } catch { /* intestazione non ammessa: si ignora */ }
  try { if (piede) documento = impostaPiede(documento, piede); } catch { /* piè di pagina non ammesso: si ignora */ }
  return documento;
}
