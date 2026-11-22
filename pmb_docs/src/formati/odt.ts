// Formato .odt (OpenDocument Text, LibreOffice Writer) per pmb_docs:
// esporta il documento e importa i documenti generati da LibreOffice / OpenOffice.
// Puro: riceve o restituisce byte, non tocca il DOM o la finestra.
// Commenti (office:annotation e office:annotation-end, con risposte e «risolto» come li scrive LibreOffice: loext:parent-name e
// loext:resolved) e modifiche registrate (text:tracked-changes con text:change-start/end per l'inserito e text:change per il cancellato).
import { leggiZip, scriviZip, type VoceZip } from '@comune/formati/zip';
import { analizzaXml, elemento, escapaXml, trova, type NodoXml } from '@comune/formati/xml';
import { t } from '../i18n/lingua';
import { cellaCon, riparaUnioni, unioneDi, type Unione } from '../modello/unioni';

/**
 * Il testo di un tratto in ODF. In ODF gli spazi ripetuti, quelli all'inizio e alla fine di un pezzo di testo e le tabulazioni scritte come
 * caratteri si riducono a uno spazio: prima LibreOffice perdeva tabulazioni e spazi multipli dei documenti di pmb_docs. Qui la tabulazione è
 * <text:tab/> e gli spazi che si perderebbero sono <text:s/> (con text:c se sono più d'uno), come li scrive LibreOffice.
 */
export function testoOdf(t: string): string {
  const s = (n: number): string => (n === 1 ? '<text:s/>' : `<text:s text:c="${n}"/>`);
  return t.split('\t').map((pezzo) => escapaXml(pezzo)
    .replace(/ {2,}/g, (m) => ' ' + s(m.length - 1))
    .replace(/^ /, '<text:s/>')
    .replace(/ $/, '<text:s/>')).join('<text:tab/>');
}

const RIGHE_MASSIME_ODT = 1000;
const COLONNE_MASSIME_ODT = 100;
import {
  normalizza, urlValido, commentiUsati, ID_COMMENTO, LUNGHEZZA_MASSIMA_AUTORE, LUNGHEZZA_MASSIMA_COMMENTO,
  stiliUsati, stileValido, LUNGHEZZA_MASSIMA_NOME_STILE, spazioValido, OGGETTO, CAMPO_UNIONE, CAMPO_SEQUENZA, CAMPO_RIFERIMENTO, nomeCampoValido, nomeSegnalibroValido, dimensioniIniziali, immagineValida, IMMAGINE_MASSIMA, type Immagine,
  type AttributiParagrafo, type Commento, type Documento, type Paragrafo, type Revisione, type Run, type StileParagrafo, type StilePersonale,
} from '../modello/documento';
import { motivoNome } from '../modello/stili';
import { numeriDidascalie } from '../modello/didascalie';
import { testiRiferimenti } from '../modello/riferimenti';
import { tipoDaByte } from './immagine';
import { dimensioniPngRagionevoli } from './docx';

/** Gli stili di LibreOffice che corrispondono a quelli già fatti di pmb_docs (nome interno, con _20_ al posto degli spazi). */
const STILI_ODF: Record<StileParagrafo, string> = { n: 'Standard', t: 'Title', s: 'Subtitle', '1': 'Heading_20_1', '2': 'Heading_20_2', '3': 'Heading_20_3' };
function stileDaNomeOdf(nome: string): StileParagrafo | 'base' | undefined {
  if (nome === 'Standard' || nome === 'Default_20_Paragraph_20_Style' || nome === 'Heading') return 'base';
  if (nome === 'Title') return 't';
  if (nome === 'Subtitle') return 's';
  const m = /^Heading_20_([1-9]|10)$/.exec(nome);
  if (m) return Number(m[1]) <= 3 ? (m[1] as StileParagrafo) : '3';
  return undefined;
}

/** Una misura di ODF (cm, mm, in, pt, pc, px) in punti, o undefined. */
function inPunti(v: string | undefined): number | undefined {
  const m = v ? /^(-?[\d.]+)(cm|mm|in|pt|pc|px)$/.exec(v.trim()) : null;
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const fattore: Record<string, number> = { cm: 72 / 2.54, mm: 72 / 25.4, in: 72, pt: 1, pc: 12, px: 0.75 };
  return Math.round(n * fattore[m[2]] * 10) / 10;
}

export const MIME_ODT = 'application/vnd.oasis.opendocument.text';
const NS_OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const NS_STYLE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const NS_FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const NS_XLINK = 'http://www.w3.org/1999/xlink';
const NS_MANIFEST = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
const NS_DC = 'http://purl.org/dc/elements/1.1/';
const NS_LOEXT = 'urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0';
const NS_XMLNS_XML = 'http://www.w3.org/XML/1998/namespace';
const NS_DRAW = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const NS_SVG = 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0';
/** Centimetri per pixel del foglio (96 punti per pollice). */
const CM_PER_PIXEL = 2.54 / 96;
void NS_XMLNS_XML;
/** Nome di un commento nel file: come quelli di LibreOffice. */
const nomeAnnotazione = (id: string): string => `__Annotation__${id}`;

const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

function esadecimale(c: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(c);
  if (!m) return null;
  const h = m[1];
  const sei = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  return '#' + sei.toUpperCase();
}

function runVuoto(t = ''): Run {
  return { t, g: false, c: false, s: false };
}

// ===================== ESPORTAZIONE ODT =====================

export async function esportaOdt(doc: Documento): Promise<Uint8Array> {
  // i numeri delle didascalie, per tratto, e le serie usate (LibreOffice le vuole dichiarate in text:sequence-decls)
  const numeriSq = new WeakMap<Run, number>();
  { const n = numeriDidascalie(doc.paragrafi); doc.paragrafi.forEach((p, i) => p.runs.forEach((r, k) => { const x = n.get(`${i}:${k}`); if (x !== undefined) numeriSq.set(r, x); })); }
  const serieUsate = [...new Set(doc.paragrafi.flatMap((p) => p.runs.filter((r) => r.sq !== undefined).map((r) => r.sq!)))];
  const nomeSequenza = (r: Run): string => `ref${r.sq!.replace(/[^\p{L}\p{N}]/gu, '')}${(numeriSq.get(r) ?? 1) - 1}`;
  // riferimenti incrociati: il testo da mostrare e il paragrafo a cui rimandano (per nome di segnalibro, il primo)
  const testiRif = testiRiferimenti(doc.paragrafi);
  const perSegnalibro = new Map<string, Paragrafo>();
  for (const p of doc.paragrafi) if (p.sg !== undefined && !perSegnalibro.has(p.sg.toLowerCase())) perSegnalibro.set(p.sg.toLowerCase(), p);
  const riferimentoXml = (r: Run, indice: number, k: number): string => {
    const testo = escapaXml(testiRif.get(`${indice}:${k}`) ?? '');
    const bersaglio = perSegnalibro.get(r.xr!.toLowerCase());
    const sq = bersaglio?.runs.find((x) => x.sq !== undefined);
    // «Figura 2» come lo scrive LibreOffice: il rimando alla sequenza della didascalia, con etichetta e numero
    if (r.xm === 'e' && sq) return elemento('text:sequence-ref', { 'text:reference-format': 'category-and-value', 'text:ref-name': nomeSequenza(sq) }, [testo]);
    return elemento('text:bookmark-ref', { 'text:reference-format': 'text', 'text:ref-name': bersaglio?.sg ?? r.xr! }, [testo]);
  };
  const stiliTesto: string[] = [];
  const stiliParagrafo: string[] = [];

  let contatoreStileT = 0;
  let contatoreStileP = 0;
  const mappaStiliT = new Map<string, string>();
  const mappaStiliP = new Map<string, string>();

  function idStileRun(r: Run): string | undefined {
    const chiavi: string[] = [];
    if (r.g) chiavi.push('b');
    if (r.c) chiavi.push('i');
    if (r.s) chiavi.push('u');
    if (r.x === 'b') chiavi.push('s');
    if (r.w === 'd') chiavi.push('ud');
    if (r.q === 'm') chiavi.push('sc');
    if (r.k) chiavi.push(`c:${esadecimale(r.k)}`);
    if (r.h) chiavi.push(`bg:${esadecimale(r.h)}`);
    if (r.z) chiavi.push(`z:${r.z}`);
    if (r.f) chiavi.push(`f:${r.f}`);
    if (r.v) chiavi.push(`v:${r.v}`);
    if (chiavi.length === 0) return undefined;
    const chiave = chiavi.join(';');
    if (mappaStiliT.has(chiave)) return mappaStiliT.get(chiave);

    const nome = `T${++contatoreStileT}`;
    mappaStiliT.set(chiave, nome);

    const attrs: Record<string, string> = {};
    if (r.g) attrs['fo:font-weight'] = 'bold';
    if (r.c) attrs['fo:font-style'] = 'italic';
    if (r.s) { attrs['style:text-underline-style'] = 'solid'; attrs['style:text-underline-width'] = 'auto'; }
    if (r.x === 'b') attrs['style:text-line-through-style'] = 'solid';
    if (r.w === 'd') { attrs['style:text-underline-style'] = 'solid'; attrs['style:text-underline-type'] = 'double'; attrs['style:text-underline-width'] = 'auto'; }
    if (r.q === 'm') attrs['fo:font-variant'] = 'small-caps';
    const col = r.k ? esadecimale(r.k) : null;
    if (col) attrs['fo:color'] = col;
    const bg = r.h ? esadecimale(r.h) : null;
    if (bg) attrs['fo:background-color'] = bg;
    if (r.z) attrs['fo:font-size'] = `${r.z}pt`;
    if (r.f) attrs['style:font-name'] = r.f;
    if (r.v === 'p') attrs['style:text-position'] = 'super 58%';
    if (r.v === 'b') attrs['style:text-position'] = 'sub 58%';

    stiliTesto.push(elemento('style:style', { 'style:name': nome, 'style:family': 'text' }, [
      elemento('style:text-properties', attrs),
    ]));
    return nome;
  }

  // stili personali: in styles.xml come stili con nome (il nome interno è l'identificativo, quello da mostrare è il nome dello stile)
  const personali = stiliUsati(doc);
  const stiliNominati = personali.map((s) => {
    const par: Record<string, string> = {};
    if (s.al === 'ce') par['fo:text-align'] = 'center'; else if (s.al === 'dx') par['fo:text-align'] = 'end'; else if (s.al === 'gi') par['fo:text-align'] = 'justify';
    if (s.sb !== undefined) par['fo:margin-top'] = `${s.sb}pt`;
    if (s.sa !== undefined) par['fo:margin-bottom'] = `${s.sa}pt`;
    if (s.ls !== undefined) par['fo:line-height'] = `${Math.round(s.ls * 100)}%`;
    const txt: Record<string, string> = {};
    if (s.f !== undefined) txt['fo:font-family'] = s.f;
    if (s.z !== undefined) txt['fo:font-size'] = `${s.z}pt`;
    if (s.k !== undefined) txt['fo:color'] = s.k;
    if (s.g) txt['fo:font-weight'] = 'bold';
    if (s.c) txt['fo:font-style'] = 'italic';
    if (s.s) { txt['style:text-underline-style'] = 'solid'; txt['style:text-underline-width'] = 'auto'; }
    return elemento('style:style', { 'style:name': s.id, 'style:display-name': s.nome, 'style:family': 'paragraph', 'style:parent-style-name': STILI_ODF[s.base], ...(['1', '2', '3'].includes(s.base) ? { 'style:default-outline-level': s.base } : {}), 'style:class': 'text' }, [
      ...(Object.keys(par).length > 0 ? [elemento('style:paragraph-properties', par)] : []),
      ...(Object.keys(txt).length > 0 ? [elemento('style:text-properties', txt)] : []),
    ]);
  });

  function idStilePar(p: Paragrafo): string | undefined {
    const chiavi: string[] = [];
    // lo stile con nome da cui deriva: lo stile personale, o quello di LibreOffice per Titolo, Sottotitolo, Titolo 1-3
    const genitore = p.su ?? (p.st !== undefined && p.st !== 'n' ? STILI_ODF[p.st] : undefined);
    if (genitore !== undefined) chiavi.push(`su:${genitore}`);
    if (p.al) chiavi.push(`al:${p.al}`);
    if (p.ls) chiavi.push(`ls:${p.ls}`);
    if (p.ri) chiavi.push(`ri:${p.ri}`);
    if (p.sb) chiavi.push(`sb:${p.sb}`);
    if (p.sa) chiavi.push(`sa:${p.sa}`);
    if (p.bd) chiavi.push(`bd:${p.bd.w}${p.bd.c}${p.bd.s}`);
    if (p.sp) chiavi.push('sp');
    if (p.sc) chiavi.push('sc');
    if (p.hr) chiavi.push('hr');
    if (chiavi.length === 0) return undefined;
    // solo lo stile con nome: il paragrafo lo usa direttamente
    if (chiavi.length === 1 && genitore !== undefined) return genitore;
    const chiave = chiavi.join(';');
    if (mappaStiliP.has(chiave)) return mappaStiliP.get(chiave);

    const nome = `P${++contatoreStileP}`;
    mappaStiliP.set(chiave, nome);

    const attrs: Record<string, string> = {};
    if (p.al === 'ce') attrs['fo:text-align'] = 'center';
    else if (p.al === 'dx') attrs['fo:text-align'] = 'end';
    else if (p.al === 'gi') attrs['fo:text-align'] = 'justify';
    else attrs['fo:text-align'] = 'start';

    if (p.ls) attrs['fo:line-height'] = `${Math.round(p.ls * 100)}%`;
    if (p.ri) attrs['fo:margin-left'] = `${(p.ri * 1.25).toFixed(2)}cm`;
    if (p.sb) attrs['fo:margin-top'] = `${p.sb}pt`;
    if (p.sa) attrs['fo:margin-bottom'] = `${p.sa}pt`;
    if (p.bd) attrs['fo:border'] = `${p.bd.w}pt ${p.bd.s === 'c' ? 'solid' : p.bd.s === 't' ? 'dashed' : 'dotted'} ${p.bd.c}`;
    if (p.sp) attrs['fo:break-before'] = 'page';
    else if (p.sc) attrs['fo:break-before'] = 'column';
    if (p.hr) attrs['fo:border-bottom'] = '0.5pt solid #c7c7c7';

    stiliParagrafo.push(elemento('style:style', { 'style:name': nome, 'style:family': 'paragraph', ...(genitore !== undefined ? { 'style:parent-style-name': genitore } : {}) }, [
      elemento('style:paragraph-properties', attrs),
    ]));
    return nome;
  }

  // immagini: un file in Pictures/ per immagine diversa; la cornice in linea (as-char) o, con il testo intorno, ancorata al carattere e
  // spostata a sinistra o a destra del paragrafo con il testo che scorre accanto (style:wrap parallel, come le scrive LibreOffice)
  const figure = new Map<string, { nome: string; mime: string; dati: Uint8Array }>();
  const stiliCornice = { in: 'fr1', sx: 'fr2', dx: 'fr3' } as const;
  let cornici = 0;
  const cornice = (im: Immagine): string => {
    let fig = figure.get(im.s);
    if (!fig) {
      const m = /^data:image\/(png|jpeg|gif|webp);base64,(.*)$/.exec(im.s) as RegExpExecArray;
      const binario = atob(m[2]);
      const dati = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) dati[i] = binario.charCodeAt(i);
      fig = { nome: `Pictures/immagine${figure.size + 1}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, mime: `image/${m[1]}`, dati };
      figure.set(im.s, fig);
    }
    cornici++;
    return elemento('draw:frame', {
      'draw:style-name': stiliCornice[im.a ?? 'in'], 'draw:name': `Immagine ${cornici}`, 'text:anchor-type': im.a ? 'char' : 'as-char',
      ...(im.a ? { 'svg:y': '0cm' } : {}), 'svg:width': `${(im.w * CM_PER_PIXEL).toFixed(3)}cm`, 'svg:height': `${(im.h * CM_PER_PIXEL).toFixed(3)}cm`, 'draw:z-index': cornici - 1,
    }, [elemento('draw:image', { 'xlink:href': fig.nome, 'xlink:type': 'simple', 'xlink:show': 'embed', 'xlink:actuate': 'onLoad' }),
      // il testo alternativo: svg:desc (la «Descrizione» di LibreOffice)
      ...(im.d ? [elemento('svg:desc', {}, [escapaXml(im.d)])] : [])]);
  };
  const stiliGrafici = [
    elemento('style:style', { 'style:name': 'fr1', 'style:family': 'graphic' }, [elemento('style:graphic-properties', { 'style:vertical-pos': 'top', 'style:vertical-rel': 'baseline' })]),
    ...(['sx', 'dx'] as const).map((a) => elemento('style:style', { 'style:name': stiliCornice[a], 'style:family': 'graphic' }, [elemento('style:graphic-properties', {
      'fo:margin-left': a === 'dx' ? '0.318cm' : '0cm', 'fo:margin-right': a === 'sx' ? '0.318cm' : '0cm', 'fo:margin-top': '0cm', 'fo:margin-bottom': '0.15cm',
      'style:wrap': 'parallel', 'style:number-wrapped-paragraphs': 'no-limit', 'style:wrap-contour': 'false',
      'style:vertical-pos': 'from-top', 'style:vertical-rel': 'paragraph', 'style:horizontal-pos': a === 'sx' ? 'left' : 'right', 'style:horizontal-rel': 'paragraph',
    })])),
  ];

  // commenti: dove comincia e finisce il testo di ognuno (indice del paragrafo e del tratto)
  const commenti = commentiUsati(doc);
  const perId = new Map(commenti.map((c) => [c.id, c] as const));
  const primi = new Map<string, string>();
  const ultimi = new Map<string, string>();
  doc.paragrafi.forEach((par, p) => par.runs.forEach((r, k) => {
    if (r.cm === undefined || !perId.has(r.cm)) return;
    if (!primi.has(r.cm)) primi.set(r.cm, `${p}:${k}`);
    ultimi.set(r.cm, `${p}:${k}`);
  }));
  const inizioDa = new Map<string, string[]>();
  const fineDa = new Map<string, string[]>();
  for (const [id, chiave] of primi) inizioDa.set(chiave, [...(inizioDa.get(chiave) ?? []), id]);
  for (const [id, chiave] of ultimi) fineDa.set(chiave, [...(fineDa.get(chiave) ?? []), id]);
  const paragrafiTesto = (testo: string): string[] => testo.split('\n').map((riga) => elemento('text:p', {}, riga === '' ? [] : [escapaXml(riga)]));
  const annotazione = (nome: string, a: string, d: string, testo: string, extra: Record<string, string>): string =>
    elemento('office:annotation', { 'office:name': nome, ...extra }, [elemento('dc:creator', {}, [escapaXml(a)]), ...(d !== '' ? [elemento('dc:date', {}, [escapaXml(d.replace(/Z$/, ''))])] : []), ...paragrafiTesto(testo)]);
  const inizioCommento = (c: Commento): string => [
    annotazione(nomeAnnotazione(c.id), c.a, c.d, c.t, c.ok ? { 'loext:resolved': 'true' } : {}),
    ...(c.r ?? []).map((r, k) => annotazione(`${nomeAnnotazione(c.id)}_${k + 1}`, r.a, r.d, r.t, { 'loext:parent-name': nomeAnnotazione(c.id), ...(c.ok ? { 'loext:resolved': 'true' } : {}) })),
  ].join('');
  // modifiche registrate: una regione per blocco di testo inserito o cancellato
  const regioni: string[] = [];
  const infoModifica = (rv: Revisione): string => elemento('office:change-info', {}, [elemento('dc:creator', {}, [escapaXml(rv.a)]), elemento('dc:date', {}, [escapaXml(rv.d.replace(/Z$/, '') || '1970-01-01T00:00:00')])]);
  let indiceParagrafo = 0;

  function serializzaParagrafo(p: Paragrafo): string {
    const indice = indiceParagrafo++;
    const stPar = idStilePar(p);
    const attrsPar: Record<string, string> = {};
    if (stPar) attrsPar['text:style-name'] = stPar;

    const spanPar: string[] = [];
    const runs = p.runs && p.runs.length > 0 ? p.runs : [runVuoto()];
    runs.forEach((r, k) => {
      for (const id of inizioDa.get(`${indice}:${k}`) ?? []) spanPar.push(inizioCommento(perId.get(id)!));
      const stRun = idStileRun(r);
      // il campo di unione come lo scrive LibreOffice: text:database-display con il nome della colonna e «nome» come testo
      let runXml = r.im !== undefined ? cornice(r.im)
        : r.xr !== undefined ? riferimentoXml(r, indice, k)
        : r.sq !== undefined ? elemento('text:sequence', { 'text:ref-name': nomeSequenza(r), 'text:name': r.sq, 'text:formula': `ooow:${r.sq}+1`, 'style:num-format': '1' }, [String(numeriSq.get(r) ?? 1)])
        : r.cu !== undefined ? elemento('text:database-display', { 'text:table-name': '', 'text:table-type': 'table', 'text:column-name': r.cu, 'text:database-name': '' }, [escapaXml(`«${r.cu}»`)])
        : testoOdf(r.t);
      if (stRun) {
        runXml = elemento('text:span', { 'text:style-name': stRun }, [runXml]);
      }
      if (r.u && urlValido(r.u)) {
        runXml = elemento('text:a', { 'xlink:type': 'simple', 'xlink:href': r.u }, [runXml]);
      }
      if (r.rv?.t === 'd') {
        // il testo cancellato sta nella regione della modifica; nel testo resta solo il punto in cui era
        const id = `ct${regioni.length + 1}`;
        regioni.push(elemento('text:changed-region', { 'text:id': id }, [elemento('text:deletion', {}, [infoModifica(r.rv), elemento('text:p', {}, [runXml])])]));
        spanPar.push(elemento('text:change', { 'text:change-id': id }));
      } else if (r.rv?.t === 'i') {
        const id = `ct${regioni.length + 1}`;
        regioni.push(elemento('text:changed-region', { 'text:id': id }, [elemento('text:insertion', {}, [infoModifica(r.rv)])]));
        spanPar.push(elemento('text:change-start', { 'text:change-id': id }), runXml, elemento('text:change-end', { 'text:change-id': id }));
      } else spanPar.push(runXml);
      for (const id of fineDa.get(`${indice}:${k}`) ?? []) {
        spanPar.push(elemento('office:annotation-end', { 'office:name': nomeAnnotazione(id) }));
        (perId.get(id)!.r ?? []).forEach((_, n) => spanPar.push(elemento('office:annotation-end', { 'office:name': `${nomeAnnotazione(id)}_${n + 1}` })));
      }
    });

    // il segnalibro del paragrafo (Inserisci › Segnalibro, o quello nascosto di un riferimento incrociato) prende tutto il paragrafo
    if (p.sg !== undefined) { spanPar.unshift(elemento('text:bookmark-start', { 'text:name': p.sg })); spanPar.push(elemento('text:bookmark-end', { 'text:name': p.sg })); }
    const tag = p.st && ['1', '2', '3'].includes(p.st) ? 'text:h' : 'text:p';
    if (tag === 'text:h') {
      attrsPar['text:outline-level'] = p.st ?? '1';
    }
    return elemento(tag, attrsPar, spanPar);
  }

  const corpoXml: string[] = [];
  const paragrafi = doc.paragrafi ?? [];
  let i = 0;

  while (i < paragrafi.length) {
    const p = paragrafi[i];
    if (p.tb) {
      const idTab = p.tb.i;
      const celle: Paragrafo[][][] = [];
      while (i < paragrafi.length && paragrafi[i].tb?.i === idTab) {
        const pt = paragrafi[i];
        const r = pt.tb!.r;
        const c = pt.tb!.c;
        (celle[r] ??= [])[c] ??= [];
        celle[r][c].push(pt);
        i++;
      }
      // celle unite come in ODF: l'ancora con number-columns-spanned / number-rows-spanned, le altre covered-table-cell;
      // le righe di intestazione dentro table:table-header-rows (LibreOffice le ripete in ogni pagina)
      const unioni = celle.map((riga) => riga.map((cella) => unioneDi(cella[0].tb)));
      const intestazione: string[] = [];
      const righeXml: string[] = [];
      celle.forEach((riga, r) => {
        const celleXml: string[] = [];
        riga.forEach((colCella, c) => {
          const u = unioni[r][c];
          if (u.co) { celleXml.push(elemento('table:covered-table-cell')); return; }
          const parsCella = colCella.map((cp) => serializzaParagrafo(cp));
          const attr: Record<string, string | number> = { 'office:value-type': 'string' };
          if (u.cs > 1) attr['table:number-columns-spanned'] = u.cs;
          if (u.rs > 1) attr['table:number-rows-spanned'] = u.rs;
          celleXml.push(elemento('table:table-cell', attr, parsCella));
        });
        (unioni[r][0].h ? intestazione : righeXml).push(elemento('table:table-row', {}, celleXml));
      });
      const colonne = elemento('table:table-column', { 'table:number-columns-repeated': celle[0].length });
      const corpo = intestazione.length > 0 ? [colonne, elemento('table:table-header-rows', {}, intestazione), ...righeXml] : [colonne, ...righeXml];
      corpoXml.push(elemento('table:table', { 'table:name': `Tabella_${idTab}` }, corpo));
    } else {
      corpoXml.push(serializzaParagrafo(p));
      i++;
    }
  }

  const contentXml = INTESTAZIONE_XML + elemento('office:document-content', {
    'xmlns:office': NS_OFFICE,
    'xmlns:style': NS_STYLE,
    'xmlns:text': NS_TEXT,
    'xmlns:table': NS_TABLE,
    'xmlns:fo': NS_FO,
    'xmlns:xlink': NS_XLINK,
    'xmlns:dc': NS_DC,
    'xmlns:loext': NS_LOEXT,
    'xmlns:draw': NS_DRAW,
    'xmlns:svg': NS_SVG,
    'office:version': '1.3',
  }, [
    elemento('office:automatic-styles', {}, [...stiliParagrafo, ...stiliTesto, ...(figure.size > 0 ? stiliGrafici : [])]),
    elemento('office:body', {}, [
      elemento('office:text', {}, [
        ...(serieUsate.length > 0 ? [elemento('text:sequence-decls', {}, serieUsate.map((s) => elemento('text:sequence-decl', { 'text:display-outline-level': '0', 'text:name': s })))] : []),
        ...(regioni.length > 0 || doc.revisioni ? [elemento('text:tracked-changes', { 'text:track-changes': doc.revisioni ? 'true' : 'false' }, regioni)] : []),
        ...corpoXml,
      ]),
    ]),
  ]);

  const stylesXml = INTESTAZIONE_XML + elemento('office:document-styles', {
    'xmlns:office': NS_OFFICE,
    'xmlns:style': NS_STYLE,
    'xmlns:text': NS_TEXT,
    'xmlns:table': NS_TABLE,
    'xmlns:fo': NS_FO,
    'office:version': '1.3',
  }, [
    elemento('office:styles', {}, [
      elemento('style:default-style', { 'style:family': 'paragraph' }, [
        elemento('style:paragraph-properties', { 'fo:line-height': '115%' }),
        elemento('style:text-properties', { 'style:font-name': 'Roboto', 'fo:font-size': '11pt' }),
      ]),
      // gli stili di LibreOffice da cui derivano titoli e stili personali (con l'aspetto che hanno in pmb_docs)
      elemento('style:style', { 'style:name': 'Standard', 'style:family': 'paragraph', 'style:class': 'text' }),
      ...([['Title', 'Title', '26pt', undefined, undefined], ['Subtitle', 'Subtitle', '15pt', '#666666', undefined],
        ['Heading_20_1', 'Heading 1', '20pt', undefined, '1'], ['Heading_20_2', 'Heading 2', '16pt', undefined, '2'], ['Heading_20_3', 'Heading 3', '14pt', '#434343', '3']] as const)
        .map(([nome, mostrato, corpo, colore, livello]) => elemento('style:style', {
          'style:name': nome, 'style:display-name': mostrato, 'style:family': 'paragraph', 'style:parent-style-name': 'Standard', 'style:next-style-name': 'Standard',
          ...(livello ? { 'style:default-outline-level': livello } : {}), 'style:class': livello ? 'text' : 'chapter',
        }, [elemento('style:text-properties', { 'fo:font-size': corpo, ...(colore ? { 'fo:color': colore } : {}) })])),
      ...stiliNominati,
    ]),
    // la pagina (A4, margini di un pollice come in pmb_docs): senza le pagine maestre LibreOffice non collega gli stili ai loro genitori
    elemento('office:automatic-styles', {}, [
      elemento('style:page-layout', { 'style:name': 'pm1' }, [elemento('style:page-layout-properties', {
        'fo:page-width': '21cm', 'fo:page-height': '29.7cm', 'style:print-orientation': 'portrait',
        'fo:margin-top': '2.54cm', 'fo:margin-bottom': '2.54cm', 'fo:margin-left': '2.54cm', 'fo:margin-right': '2.54cm',
      }, doc.colonne ? [elemento('style:columns', { 'fo:column-count': doc.colonne, 'fo:column-gap': '1.25cm' })] : [])]),
    ]),
    elemento('office:master-styles', {}, [elemento('style:master-page', { 'style:name': 'Standard', 'style:page-layout-name': 'pm1' })]),
  ]);

  const metaXml = INTESTAZIONE_XML + elemento('office:document-meta', {
    'xmlns:office': NS_OFFICE,
    'xmlns:meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
    'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
    'office:version': '1.3',
  }, [
    elemento('office:meta', {}, [
      elemento('meta:generator', {}, ['pmb_office pmb_docs 0.1']),
      elemento('dc:date', {}, [new Date().toISOString()]),
    ]),
  ]);

  const manifestXml = INTESTAZIONE_XML + elemento('manifest:manifest', {
    'xmlns:manifest': NS_MANIFEST,
    'manifest:version': '1.3',
  }, [
    elemento('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': MIME_ODT }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'content.xml', 'manifest:media-type': 'text/xml' }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'styles.xml', 'manifest:media-type': 'text/xml' }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'meta.xml', 'manifest:media-type': 'text/xml' }),
    ...Array.from(figure.values(), (x) => elemento('manifest:file-entry', { 'manifest:full-path': x.nome, 'manifest:media-type': x.mime })),
  ]);

  const voci: VoceZip[] = [
    { nome: 'mimetype', dati: new TextEncoder().encode(MIME_ODT), senzaCompressione: true },
    { nome: 'META-INF/manifest.xml', dati: new TextEncoder().encode(manifestXml) },
    { nome: 'content.xml', dati: new TextEncoder().encode(contentXml) },
    { nome: 'styles.xml', dati: new TextEncoder().encode(stylesXml) },
    { nome: 'meta.xml', dati: new TextEncoder().encode(metaXml) },
    ...Array.from(figure.values(), (x) => ({ nome: x.nome, dati: x.dati })),
  ];

  return scriviZip(voci);
}

// ===================== IMPORTAZIONE ODT =====================

export async function importaOdt(bytes: Uint8Array): Promise<Documento> {
  const archivio = await leggiZip(bytes);
  const contentBytes = archivio.get('content.xml');
  if (!contentBytes) throw new Error(t('File ODT non valido: content.xml mancante'));

  const stili = archivio.get('styles.xml');
  // le immagini dell'archivio (solo png, jpeg, gif, webp riconosciute dai byte; non troppo grandi, e non oltre un certo peso in tutto)
  const immagini = new Map<string, string>();
  let totale = 0;
  for (const [nome, dati] of archivio) {
    if (dati.length === 0 || dati.length > IMMAGINE_FILE_MASSIMA || totale + dati.length > IMMAGINI_TOTALE_MASSIMO) continue;
    const tipo = tipoDaByte(dati);
    if (!tipo || (tipo === 'png' && !dimensioniPngRagionevoli(dati))) continue;
    totale += dati.length;
    immagini.set(nome, `data:image/${tipo};base64,${aBase64(dati)}`);
  }
  return documentoDaContenutoOdt(new TextDecoder('utf-8').decode(contentBytes), stili ? new TextDecoder('utf-8').decode(stili) : undefined, immagini);
}

const IMMAGINE_FILE_MASSIMA = 5_000_000;
const IMMAGINI_TOTALE_MASSIMO = 30_000_000;
function aBase64(dati: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dati.length; i += 0x8000) s += String.fromCharCode(...dati.subarray(i, i + 0x8000));
  return btoa(s);
}
/** Una misura di ODF in pixel del foglio, o NaN. */
function inPixel(v: string | undefined): number {
  const pt = inPunti(v);
  return pt === undefined ? NaN : (pt * 96) / 72;
}

/** OpenDocument "piatto" (.fodt): un solo file XML con stili e contenuto insieme, stessa struttura del content.xml di un .odt. */
export function importaFodt(bytes: Uint8Array): Documento {
  const testo = new TextDecoder('utf-8').decode(bytes);
  if (!/<office:document[\s>]/.test(testo)) throw new Error(t('File ODT non valido: content.xml mancante'));
  return documentoDaContenutoOdt(testo);
}

/** Gli stili personali di un documento ODF: gli stili di paragrafo con nome (office:styles, in styles.xml o nel .fodt) che non sono
 *  quelli già fatti. Si fanno al primo paragrafo che li usa (anche attraverso uno stile automatico che ne deriva): base = il primo
 *  stile già fatto della catena, il resto dalla catena (il più vicino vince). */
function lettoreStiliOdf(nominati: NodoXml[], automatici: NodoXml[]): { stileDi: (nome: string | undefined) => StilePersonale | undefined; baseDi: (nome: string | undefined) => StileParagrafo | undefined; ordine: StilePersonale[] } {
  const perNome = new Map<string, NodoXml>();
  for (const s of nominati) if (s.attributi['style:family'] === 'paragraph' && s.attributi['style:name']) perNome.set(s.attributi['style:name'], s);
  const padreAuto = new Map<string, string>();
  for (const s of automatici) if (s.attributi['style:family'] === 'paragraph' && s.attributi['style:name'] && s.attributi['style:parent-style-name']) padreAuto.set(s.attributi['style:name'], s.attributi['style:parent-style-name']);
  const creati = new Map<string, StilePersonale>();
  const ordine: StilePersonale[] = [];
  const crea = (nome: string): StilePersonale | undefined => {
    const fatto = creati.get(nome);
    if (fatto) return fatto;
    if (stileDaNomeOdf(nome) !== undefined || !perNome.has(nome)) return undefined;
    const catena: NodoXml[] = [];
    let base: StileParagrafo = 'n';
    const visti = new Set<string>();
    for (let cur: string | undefined = nome; cur !== undefined && !visti.has(cur);) {
      visti.add(cur);
      const g = stileDaNomeOdf(cur);
      if (g !== undefined) { if (g !== 'base') base = g; break; }
      const n = perNome.get(cur);
      if (!n) break;
      catena.unshift(n);
      cur = n.attributi['style:parent-style-name'];
    }
    const nodo = perNome.get(nome) as NodoXml;
    const mostrato = (nodo.attributi['style:display-name'] ?? nome.replace(/_20_/g, ' ')).trim();
    let nomeStile = mostrato.slice(0, LUNGHEZZA_MASSIMA_NOME_STILE) || 'Stile';
    const prova: Documento = { paragrafi: [], stili: ordine };
    for (let k = 2; motivoNome(prova, nomeStile) !== null && k < 1000; k++) nomeStile = `${mostrato.slice(0, LUNGHEZZA_MASSIMA_NOME_STILE - 6)} (${k})`;
    let id = nome.replace(/_20_/g, '_').replace(/[^A-Za-z0-9_]/g, '_');
    if (!/^[A-Za-z]/.test(id)) id = `S${id}`;
    id = id.slice(0, 36);
    const usati = new Set(ordine.map((x) => x.id));
    for (let k = 2, radice = id; usati.has(id); k++) id = `${radice}${k}`;
    const s: Record<string, unknown> = { id, nome: nomeStile, base };
    for (const n of catena) {
      const tp = trova(n, 'style:text-properties');
      if (tp) {
        const fam = tp.attributi['fo:font-family'] ?? tp.attributi['style:font-name'];
        if (fam) s.f = fam.replace(/^'(.*)'$/, '$1');
        const z = inPunti(tp.attributi['fo:font-size']);
        if (z !== undefined && z > 0) s.z = z;
        const col = tp.attributi['fo:color'];
        if (col && /^#[0-9a-fA-F]{6}$/.test(col)) s.k = col.toLowerCase();
        if (tp.attributi['fo:font-weight'] !== undefined) s.g = tp.attributi['fo:font-weight'] === 'bold' || Number(tp.attributi['fo:font-weight']) >= 600;
        if (tp.attributi['fo:font-style'] !== undefined) s.c = tp.attributi['fo:font-style'] === 'italic' || tp.attributi['fo:font-style'] === 'oblique';
        if (tp.attributi['style:text-underline-style'] !== undefined) s.s = tp.attributi['style:text-underline-style'] !== 'none';
      }
      const pp = trova(n, 'style:paragraph-properties');
      if (pp) {
        const al = pp.attributi['fo:text-align'];
        if (al === 'center') s.al = 'ce'; else if (al === 'end' || al === 'right') s.al = 'dx'; else if (al === 'justify') s.al = 'gi'; else if (al === 'start' || al === 'left') delete s.al;
        const sb = inPunti(pp.attributi['fo:margin-top']); if (sb !== undefined) s.sb = spazioValido(Math.max(0, sb));
        const sa = inPunti(pp.attributi['fo:margin-bottom']); if (sa !== undefined) s.sa = spazioValido(Math.max(0, sa));
        const lh = /^([\d.]+)%$/.exec(pp.attributi['fo:line-height'] ?? '');
        if (lh) { const ls = Math.round(Number(lh[1])) / 100; if (ls >= 0.5 && ls <= 5) s.ls = ls; }
      }
    }
    for (const k of ['sb', 'sa'] as const) if (s[k] === undefined) delete s[k];
    if (s.ls === 1.15) delete s.ls;
    const valido = stileValido(s);
    if (!valido) return undefined;
    creati.set(nome, valido);
    ordine.push(valido);
    return valido;
  };
  /** Lo stile già fatto da cui deriva lo stile del paragrafo (Titolo, Sottotitolo, Titolo 1-3), o undefined. */
  const baseDi = (nome: string | undefined): StileParagrafo | undefined => {
    const visti = new Set<string>();
    for (let cur = nome !== undefined ? (padreAuto.get(nome) ?? nome) : undefined; cur !== undefined && !visti.has(cur);) {
      visti.add(cur);
      const g = stileDaNomeOdf(cur);
      if (g !== undefined) return g === 'base' ? undefined : g;
      cur = perNome.get(cur)?.attributi['style:parent-style-name'];
    }
    return undefined;
  };
  return {
    stileDi: (nome) => (nome === undefined ? undefined : crea(padreAuto.get(nome) ?? nome)),
    baseDi,
    ordine,
  };
}

function documentoDaContenutoOdt(xmlStr: string, stiliXml?: string, immagini: Map<string, string> = new Map()): Documento {
  const radice = analizzaXml(xmlStr);
  const radiceStili = stiliXml !== undefined ? analizzaXml(stiliXml) : radice;
  const nominati = (trova(radiceStili, 'office:styles')?.figli ?? []).filter((x): x is NodoXml => typeof x !== 'string' && x.nome === 'style:style');
  const automatici = (trova(radice, 'office:automatic-styles')?.figli ?? []).filter((x): x is NodoXml => typeof x !== 'string' && x.nome === 'style:style');
  const personali = lettoreStiliOdf(nominati, automatici);

  const stiliMappa = new Map<string, { r?: Partial<Run>; p?: Partial<AttributiParagrafo> }>();
  const autoStyles = trova(radice, 'office:automatic-styles');
  if (autoStyles) {
    const stili = autoStyles.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'style:style');
    for (const s of stili) {
      const nome = s.attributi['style:name'];
      if (!nome) continue;
      const st: { r?: Partial<Run>; p?: Partial<AttributiParagrafo> } = {};

      const textProp = trova(s, 'style:text-properties');
      if (textProp) {
        st.r = {};
        if (textProp.attributi['fo:font-weight'] === 'bold') st.r.g = true;
        if (textProp.attributi['fo:font-style'] === 'italic') st.r.c = true;
        if (textProp.attributi['style:text-underline-style'] === 'solid') {
          if (textProp.attributi['style:text-underline-type'] === 'double') st.r.w = 'd'; else st.r.s = true;
        }
        if (textProp.attributi['fo:font-variant'] === 'small-caps') st.r.q = 'm';
        if (textProp.attributi['style:text-line-through-style'] === 'solid') st.r.x = 'b';
        if (textProp.attributi['fo:color']) st.r.k = textProp.attributi['fo:color'];
        if (textProp.attributi['fo:background-color']) st.r.h = textProp.attributi['fo:background-color'];
        if (textProp.attributi['fo:font-size']) {
          const z = parseFloat(textProp.attributi['fo:font-size']);
          if (!isNaN(z)) st.r.z = z;
        }
        if (textProp.attributi['style:font-name']) st.r.f = textProp.attributi['style:font-name'];
      }

      const parProp = trova(s, 'style:paragraph-properties');
      if (parProp) {
        st.p = {};
        const align = parProp.attributi['fo:text-align'];
        if (align === 'center') st.p.al = 'ce';
        else if (align === 'end' || align === 'right') st.p.al = 'dx';
        else if (align === 'justify') st.p.al = 'gi';
        else if (align === 'start' || align === 'left') st.p.al = 'sx';
        // salto di pagina e interruzione di colonna prima del paragrafo
        if (parProp.attributi['fo:break-before'] === 'page') st.p.sp = true;
        else if (parProp.attributi['fo:break-before'] === 'column') st.p.sc = true;
      }
      stiliMappa.set(nome, st);
    }
  }

  const officeText = trova(radice, 'office:body/office:text');
  if (!officeText) throw new Error(t('Struttura ODT non valida: office:text non trovato'));

  const outParagrafi: Paragrafo[] = [];
  let contatoreTab = 1;

  // ---- commenti e modifiche registrate ----
  const testoDi = (n: NodoXml): string => n.figli.map((f) => (typeof f === 'string' ? f : f.nome === 'text:tab' ? '\t' : f.nome === 'text:s' ? ' ' : f.nome === 'text:line-break' ? '\n' : testoDi(f))).join('');
  const regioni = new Map<string, { rv: Revisione; cancellato?: NodoXml }>();
  const tracciate = trova(officeText, 'text:tracked-changes');
  for (const reg of tracciate ? tracciate.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'text:changed-region') : []) {
    const id = reg.attributi['text:id'] ?? reg.attributi['xml:id'];
    const modifica = reg.figli.find((f): f is NodoXml => typeof f !== 'string' && (f.nome === 'text:insertion' || f.nome === 'text:deletion'));
    if (!id || !modifica) continue;
    const info = trova(modifica, 'office:change-info');
    const autore = info ? trova(info, 'dc:creator') : null;
    const data = info ? trova(info, 'dc:date') : null;
    const rv: Revisione = { t: modifica.nome === 'text:insertion' ? 'i' : 'd', a: (autore ? testoDi(autore) : '').slice(0, LUNGHEZZA_MASSIMA_AUTORE), d: (data ? testoDi(data) : '').slice(0, 40) };
    regioni.set(id, { rv, ...(rv.t === 'd' ? { cancellato: modifica } : {}) });
  }
  // i nomi dei commenti con una fine nel testo (gli altri sono commenti su un punto: prendono il tratto prima)
  const conFine = new Set(Array.from(xmlStr.matchAll(/<office:annotation-end[^>]*office:name="([^"]*)"/g), (m) => m[1]));
  const commenti: Commento[] = [];
  const perNome = new Map<string, Commento>();
  const idPerNome = new Map<string, string>();
  const aperti: string[] = [];
  let insertoAperto: Revisione | undefined;
  let puntoInSospeso: string | undefined;
  // le risposte (loext:parent-name) possono venire prima del commento a cui rispondono (LibreOffice le scrive così): si leggono prima le parentele
  const padreDi = new Map<string, string>();
  for (const m of xmlStr.matchAll(/<office:annotation\b[^>]*>/g)) {
    const nome = /office:name="([^"]*)"/.exec(m[0])?.[1];
    const padre = /(?:loext|office):parent-name="([^"]*)"/.exec(m[0])?.[1];
    if (nome !== undefined && padre !== undefined && padre !== nome) padreDi.set(nome, padre);
  }
  const radiceDi = (nome: string): string => { let x = nome; const visti = new Set<string>(); while (padreDi.has(x) && !visti.has(x)) { visti.add(x); x = padreDi.get(x)!; } return x; };
  const commentoDi = (radice: string): Commento | undefined => {
    let c = perNome.get(radice);
    if (c) return c;
    if (commenti.length >= 2000) return undefined;
    c = { id: String(commenti.length + 1), a: '', d: '', t: '' };
    commenti.push(c); perNome.set(radice, c);
    return c;
  };
  const leggiAnnotazione = (f: NodoXml): string | undefined => {
    const nome = f.attributi['office:name'] ?? `__senza_nome_${perNome.size + 1}`;
    const autore = trova(f, 'dc:creator');
    const data = trova(f, 'dc:date');
    const righe = f.figli.filter((x): x is NodoXml => typeof x !== 'string' && (x.nome === 'text:p' || x.nome === 'text:h')).map(testoDi);
    const base = { a: (autore ? testoDi(autore) : '').slice(0, LUNGHEZZA_MASSIMA_AUTORE), d: (data ? testoDi(data) : '').slice(0, 40), t: righe.join('\n').trim().slice(0, LUNGHEZZA_MASSIMA_COMMENTO) };
    const radice = radiceDi(nome);
    const c = commentoDi(radice);
    if (!c || !ID_COMMENTO.test(c.id)) return undefined;
    if (radice === nome) { c.a = base.a; c.d = base.d; c.t = base.t; if (f.attributi['loext:resolved'] === 'true') c.ok = true; }
    else c.r = [...(c.r ?? []), base];
    idPerNome.set(nome, c.id);
    return nome;
  };
  const segniTratto = (): Pick<Run, 'cm' | 'rv'> => {
    const o: Pick<Run, 'cm' | 'rv'> = {};
    if (aperti.length > 0) o.cm = idPerNome.get(aperti[aperti.length - 1]);
    if (insertoAperto) o.rv = { ...insertoAperto };
    return o;
  };

  // cornici con un'immagine: l'immagine dall'archivio (o scritta dentro, nel .fodt); il testo intorno dallo stile della cornice
  const graficaPer = new Map<string, NodoXml>();
  for (const s of automatici) if (s.attributi['style:family'] === 'graphic' && s.attributi['style:name']) graficaPer.set(s.attributi['style:name'], s);
  function leggiCornice(fr: NodoXml): Immagine | null {
    const img = fr.figli.find((x): x is NodoXml => typeof x !== 'string' && x.nome === 'draw:image');
    if (!img) return null;
    let s = immagini.get((img.attributi['xlink:href'] ?? '').replace(/^\.\//, ''));
    const binario = img.figli.find((x): x is NodoXml => typeof x !== 'string' && x.nome === 'office:binary-data');
    if (!s && binario) {
      const b64 = binario.figli.filter((x): x is string => typeof x === 'string').join('').replace(/\s+/g, '');
      try {
        const bin = atob(b64);
        const dati = new Uint8Array(Math.min(bin.length, 16));
        for (let i = 0; i < dati.length; i++) dati[i] = bin.charCodeAt(i);
        const tipo = tipoDaByte(dati);
        if (tipo && bin.length <= IMMAGINE_FILE_MASSIMA) s = `data:image/${tipo};base64,${b64}`;
      } catch { /* dati illeggibili: si salta l'immagine */ }
    }
    const w = inPixel(fr.attributi['svg:width']);
    const h = inPixel(fr.attributi['svg:height']);
    if (!s || !(w >= 1) || !(h >= 1)) return null;
    const im: Immagine = { s, ...dimensioniIniziali(w, h) };
    // testo alternativo: svg:desc (Descrizione) o svg:title (Titolo) della cornice
    const testoDi = (nome: string): string => { const n = fr.figli.find((x): x is NodoXml => typeof x !== 'string' && x.nome === nome); return n ? n.figli.filter((x): x is string => typeof x === 'string').join('').trim() : ''; };
    const alt = testoDi('svg:desc') || testoDi('svg:title');
    if (alt !== '') im.d = alt.slice(0, 1000);
    const ancora = fr.attributi['text:anchor-type'] ?? 'paragraph';
    const gp = trova(graficaPer.get(fr.attributi['draw:style-name'] ?? '') ?? { nome: '', attributi: {}, figli: [] }, 'style:graphic-properties');
    const avvolge = gp?.attributi['style:wrap'] ?? 'none';
    if (ancora !== 'as-char' && avvolge !== 'none' && avvolge !== 'run-through') {
      const pos = gp?.attributi['style:horizontal-pos'];
      if (avvolge === 'left' || pos === 'right' || pos === 'outside') im.a = 'dx';
      else if (avvolge === 'right' || pos === 'left' || pos === 'inside' || pos === 'from-left') im.a = 'sx';
    }
    return immagineValida(im) && im.s.length <= IMMAGINE_MASSIMA ? im : null;
  }

  // segnalibri e rimandi: dei segnalibri del paragrafo che si sta leggendo, il primo che lo prende tutto diventa il suo (gli altri vi
  // portano: alias; uno che in una didascalia finisce prima della fine prende solo etichetta e numero, come quelli che LibreOffice
  // ricava dai _Ref di Word); le sequenze (didascalie) a cui rimanda un text:sequence-ref danno al loro paragrafo un segnalibro
  // nascosto, se non ne ha; i rimandi si risolvono alla fine
  let segnalibriLetti: Array<{ nome: string; fine?: number }> = [];
  let caratteriLetti = 0;
  let sequenzeLette: string[] = [];
  const alias = new Map<string, { sg: string; e: boolean }>();
  const sequenzeRiferite = new Set<string>();
  { const cerca = (n: NodoXml): void => { for (const f of n.figli) if (typeof f !== 'string') { if (f.nome === 'text:sequence-ref' && f.attributi['text:ref-name']) sequenzeRiferite.add(f.attributi['text:ref-name']); cerca(f); } }; cerca(officeText); }
  const segnalibroDiSequenza = new Map<string, string>();
  let segnalibriNascosti = 0;
  const RIMANDO_SEQUENZA = '\u0001';
  const iniziaParagrafo = (): void => { segnalibriLetti = []; caratteriLetti = 0; sequenzeLette = []; };
  const conSegnalibro = (p: Paragrafo): Paragrafo => {
    const parziale = (b: { fine?: number }): boolean => b.fine !== undefined && b.fine < caratteriLetti;
    const didascalia = p.runs.some((r) => r.sq !== undefined);
    let sg = (segnalibriLetti.find((b) => !parziale(b)) ?? segnalibriLetti[0])?.nome;
    const riferite = sequenzeLette.filter((s) => sequenzeRiferite.has(s));
    if (sg === undefined && riferite.length > 0) sg = `_Ref${900000 + ++segnalibriNascosti}`;
    for (const s of riferite) if (!segnalibroDiSequenza.has(s)) segnalibroDiSequenza.set(s, sg!);
    if (sg !== undefined) for (const b of segnalibriLetti) if (!alias.has(b.nome.toLowerCase())) alias.set(b.nome.toLowerCase(), { sg, e: didascalia && parziale(b) });
    iniziaParagrafo();
    return sg !== undefined ? { ...p, sg } : p;
  };
  function estraiRunDaFigli(figli: Array<NodoXml | string>, ereditati: Partial<Run> = {}): Run[] {
    const runs: Run[] = [];
    for (const f of figli) {
      if (typeof f === 'string') {
        if (f.length > 0) {
          caratteriLetti += f.trim().length;
          runs.push({
            t: f,
            g: ereditati.g ?? false,
            c: ereditati.c ?? false,
            s: ereditati.s ?? false,
            ...ereditati,
            ...segniTratto(),
          });
          if (puntoInSospeso !== undefined && runs[runs.length - 1].cm === undefined) { runs[runs.length - 1].cm = idPerNome.get(puntoInSospeso); puntoInSospeso = undefined; }
        }
      } else if (f.nome === 'text:s' || f.nome === 'text:tab' || f.nome === 'text:line-break') {
        // spazi (text:s, anche più d'uno con text:c), tabulazione e a capo dentro il paragrafo sono elementi in ODF: prima si perdevano
        // («a⇥b» diventava «ab», gli spazi ripetuti e quello dopo un rimando sparivano). L'a capo diventa uno spazio: il modello non ha
        // l'a capo dentro un paragrafo, e così almeno le parole non si attaccano.
        const n = f.nome === 'text:s' ? Math.min(Math.max(Number.parseInt(f.attributi['text:c'] ?? '1', 10) || 1, 1), 1000) : 1;
        runs.push(...estraiRunDaFigli([f.nome === 'text:tab' ? '\t' : ' '.repeat(n)], ereditati));
      } else if (f.nome === 'office:annotation') {
        const nome = leggiAnnotazione(f);
        if (nome === undefined) continue;
        if (conFine.has(nome)) aperti.push(nome);
        else if (radiceDi(nome) !== nome) continue;   // una risposta senza fine nel testo sta dove sta il suo commento
        else {
          // commento su un punto: prende il tratto prima, se c'è; altrimenti quello dopo
          const ultimo = runs[runs.length - 1];
          if (ultimo && ultimo.cm === undefined) ultimo.cm = idPerNome.get(nome); else puntoInSospeso = nome;
        }
      } else if (f.nome === 'office:annotation-end') {
        const k = aperti.lastIndexOf(f.attributi['office:name'] ?? '');
        if (k >= 0) aperti.splice(k, 1);
      } else if (f.nome === 'text:change-start') {
        const r = regioni.get(f.attributi['text:change-id'] ?? '');
        if (r?.rv.t === 'i') insertoAperto = r.rv;
      } else if (f.nome === 'text:change-end') {
        insertoAperto = undefined;
      } else if (f.nome === 'text:change') {
        // testo cancellato: si rimette al suo posto, segnato come cancellato
        const r = regioni.get(f.attributi['text:change-id'] ?? '');
        if (r?.cancellato) {
          const pezzi = r.cancellato.figli.filter((x): x is NodoXml => typeof x !== 'string' && (x.nome === 'text:p' || x.nome === 'text:h'));
          pezzi.forEach((pz, k) => {
            const dentro = estraiRunDaFigli(pz.figli, ereditati).map((x) => ({ ...x, rv: { ...r.rv } }));
            if (k > 0 && dentro.length > 0) dentro[0] = { ...dentro[0], t: ' ' + dentro[0].t };
            runs.push(...dentro);
          });
        }
      } else if (f.nome === 'text:tracked-changes' || f.nome === 'office:annotation' || f.nome === 'text:note-citation') {
        continue;
      } else if (f.nome === 'text:bookmark' || f.nome === 'text:bookmark-start') {
        const nome = nomeSegnalibroValido(f.attributi['text:name'] ?? '');
        if (nome !== null) segnalibriLetti.push({ nome });
      } else if (f.nome === 'text:bookmark-end') {
        const b = segnalibriLetti.find((x) => x.nome === nomeSegnalibroValido(f.attributi['text:name'] ?? '') && x.fine === undefined);
        if (b) b.fine = caratteriLetti;
      } else if ((f.nome === 'text:bookmark-ref' && (f.attributi['text:reference-format'] ?? 'text') === 'text')
        || (f.nome === 'text:sequence-ref' && ['category-and-value', 'text'].includes(f.attributi['text:reference-format'] ?? ''))) {
        // riferimento incrociato al testo di un segnalibro, o a una didascalia («Figura 2» o tutta): il bersaglio si risolve alla fine
        const nome = f.attributi['text:ref-name'] ?? '';
        const sg = nomeSegnalibroValido(nome);
        if (sg !== null) runs.push({ t: CAMPO_RIFERIMENTO, g: ereditati.g ?? false, c: ereditati.c ?? false, s: ereditati.s ?? false, ...ereditati, ...segniTratto(),
          xr: f.nome === 'text:sequence-ref' ? RIMANDO_SEQUENZA + nome : sg, xm: f.attributi['text:reference-format'] === 'category-and-value' ? 'e' : 't' });
        else runs.push(...estraiRunDaFigli(f.figli, ereditati));
      } else if (f.nome === 'text:sequence') {
        // numero di una didascalia (di LibreOffice o di pmb_docs): la serie
        if (f.attributi['text:ref-name']) sequenzeLette.push(f.attributi['text:ref-name']);
        caratteriLetti++;
        const nome = nomeCampoValido(f.attributi['text:name'] ?? '');
        if (nome !== null) runs.push({ t: CAMPO_SEQUENZA, g: ereditati.g ?? false, c: ereditati.c ?? false, s: ereditati.s ?? false, ...ereditati, ...segniTratto(), sq: nome });
      } else if (f.nome === 'text:database-display') {
        // campo di unione (di LibreOffice o di pmb_docs): il nome della colonna
        const nome = nomeCampoValido(f.attributi['text:column-name'] ?? '');
        if (nome !== null) runs.push({ t: CAMPO_UNIONE, g: ereditati.g ?? false, c: ereditati.c ?? false, s: ereditati.s ?? false, ...ereditati, ...segniTratto(), cu: nome });
      } else if (f.nome === 'draw:frame') {
        const im = leggiCornice(f);
        if (im) runs.push({ t: OGGETTO, g: false, c: false, s: false, ...(ereditati.u !== undefined ? { u: ereditati.u } : {}), ...segniTratto(), im });
      } else {
        const stileNome = f.attributi['text:style-name'];
        const stileDati = stileNome ? stiliMappa.get(stileNome)?.r : undefined;
        const curProps = { ...ereditati, ...(stileDati ?? {}) };
        if (f.nome === 'text:a') {
          const href = f.attributi['xlink:href'];
          if (href) curProps.u = href;
        }
        runs.push(...estraiRunDaFigli(f.figli, curProps));
      }
    }
    return runs;
  }

  // le sezioni (text:section: per esempio quelle con le colonne che LibreOffice crea convertendo da Word) contengono paragrafi e tabelle:
  // si leggono come se fossero fuori, una dentro l'altra fino a 20 livelli
  const appiattisci = (nodi: Array<NodoXml | string>, livello: number): NodoXml[] => nodi.flatMap((f) => typeof f === 'string' ? []
    : f.nome === 'text:section' && livello < 20 ? appiattisci(f.figli, livello + 1) : [f]);
  const nodiCorpo = appiattisci(officeText.figli, 0).filter((f) => f.nome !== 'text:tracked-changes');
  for (const n of nodiCorpo) {
    if (n.nome === 'text:p' || n.nome === 'text:h') {
      const stileNome = n.attributi['text:style-name'];
      const stPar = stileNome ? stiliMappa.get(stileNome)?.p : undefined;
      const attr: AttributiParagrafo = { ...(stPar ?? {}) };
      if (n.nome === 'text:h') {
        const lv = n.attributi['text:outline-level'] ?? '1';
        attr.st = (lv === '1' || lv === '2' || lv === '3') ? lv : '1';
      }
      const personale = personali.stileDi(stileNome);
      if (n.nome === 'text:p' && attr.st === undefined) { const b = personali.baseDi(stileNome); if (b) attr.st = b; }
      if (personale) {
        attr.su = personale.id;
        if (personale.base !== 'n' && attr.st === undefined) attr.st = personale.base;
        if (attr.al === undefined && personale.al !== undefined) attr.al = personale.al;
        for (const k of ['sb', 'sa', 'ls'] as const) if (attr[k] === undefined && personale[k] !== undefined) attr[k] = personale[k];
      }
      iniziaParagrafo();
      const runs = estraiRunDaFigli(n.figli);
      outParagrafi.push(conSegnalibro({
        runs: normalizza(runs.length > 0 ? runs : [runVuoto()]),
        ...attr,
      }));
    } else if (n.nome === 'table:table') {
      const idT = contatoreTab++;
      // righe: quelle di table:table-header-rows (intestazione, solo in cima) e le altre, anche dentro table:table-rows o
      // table:table-row-group; celle e righe ripetute (number-columns-repeated, number-rows-repeated) si scrivono tutte
      const righe: Array<{ nodo: NodoXml; h: boolean }> = [];
      const raccogli = (padre: NodoXml, h: boolean): void => {
        for (const f of padre.figli) {
          if (typeof f === 'string') continue;
          if (f.nome === 'table:table-row') {
            const volte = Math.min(Math.max(1, Number(f.attributi['table:number-rows-repeated'] ?? 1) || 1), RIGHE_MASSIME_ODT);
            for (let k = 0; k < volte && righe.length < RIGHE_MASSIME_ODT; k++) righe.push({ nodo: f, h });
          } else if (f.nome === 'table:table-header-rows') raccogli(f, righe.every((x) => x.h));
          else if (f.nome === 'table:table-rows' || f.nome === 'table:table-row-group') raccogli(f, false);
        }
      };
      raccogli(n, false);
      const griglia: Paragrafo[][][] = [];
      const unioni: Unione[][] = [];
      for (const { nodo, h } of righe) {
        const riga: Paragrafo[][] = [];
        const uRiga: Unione[] = [];
        for (const cell of nodo.figli) {
          if (typeof cell === 'string' || (cell.nome !== 'table:table-cell' && cell.nome !== 'table:covered-table-cell')) continue;
          const volte = Math.min(Math.max(1, Number(cell.attributi['table:number-columns-repeated'] ?? 1) || 1), COLONNE_MASSIME_ODT);
          const coperta = cell.nome === 'table:covered-table-cell';
          const intero = (v: string | undefined, max: number): number => { const x = Number(v ?? 1); return Number.isInteger(x) && x > 1 ? Math.min(x, max) : 1; };
          const cs = intero(cell.attributi['table:number-columns-spanned'], COLONNE_MASSIME_ODT);
          const rs = intero(cell.attributi['table:number-rows-spanned'], RIGHE_MASSIME_ODT);
          const parCella = cell.figli.filter((f): f is NodoXml => typeof f !== 'string' && (f.nome === 'text:p' || f.nome === 'text:h'));
          for (let k = 0; k < volte && riga.length < COLONNE_MASSIME_ODT; k++) {
            const pars = coperta || parCella.length === 0 ? [{ runs: [runVuoto()] }]
              : parCella.map((cp) => { iniziaParagrafo(); const runs = estraiRunDaFigli(cp.figli); return conSegnalibro({ runs: normalizza(runs.length > 0 ? runs : [runVuoto()]) }); });
            riga.push(pars);
            uRiga.push({ cs: coperta ? 1 : cs, rs: coperta ? 1 : rs, co: coperta, h });
          }
        }
        if (riga.length > 0) { griglia.push(riga); unioni.push(uRiga); }
      }
      const colonne = griglia.reduce((m, x) => Math.max(m, x.length), 0);
      griglia.forEach((riga, r) => { while (riga.length < colonne) { riga.push([{ runs: [runVuoto()] }]); unioni[r].push({ cs: 1, rs: 1, co: false, h: unioni[r][0].h }); } });
      const sistemate = riparaUnioni(unioni);
      griglia.forEach((riga, r) => riga.forEach((pars, c) => {
        const u = sistemate[r][c];
        const tb = cellaCon(idT, r, c, u);
        if (u.co) outParagrafi.push({ runs: [runVuoto()], tb });
        else for (const p of pars) outParagrafi.push({ ...p, tb: { ...tb } });
      }));
      outParagrafi.push({ runs: [runVuoto()] });
    }
  }

  // i rimandi alle didascalie passano al segnalibro del loro paragrafo (uno che non porta a niente resta, e mostra l'errore)
  // e quelli a un segnalibro passano al segnalibro del paragrafo (e a «Figura 2» se il segnalibro prende solo etichetta e numero)
  const risolti = outParagrafi.map((p) => (p.runs.some((r) => r.xr !== undefined)
    ? { ...p, runs: p.runs.map((r) => {
      if (r.xr === undefined) return r;
      if (r.xr.startsWith(RIMANDO_SEQUENZA)) { const nome = r.xr.slice(1); return { ...r, xr: segnalibroDiSequenza.get(nome) ?? nomeSegnalibroValido(nome) ?? nome }; }
      const a = alias.get(r.xr.toLowerCase());
      return a ? { ...r, xr: a.sg, xm: a.e ? 'e' as const : r.xm } : r;
    }) }
    : p));
  const documento: Documento = {
    paragrafi: risolti.length > 0 ? risolti : [{ runs: [runVuoto()] }],
  };
  if (personali.ordine.length > 0) documento.stili = personali.ordine;
  const ancorati = new Set<string>();
  for (const p of documento.paragrafi) for (const r of p.runs) if (r.cm !== undefined) ancorati.add(r.cm);
  const usati = commenti.filter((c) => ancorati.has(c.id));
  if (usati.length > 0) documento.commenti = usati;
  if (tracciate?.attributi['text:track-changes'] === 'true') documento.revisioni = true;
  // le colonne della pagina (style:columns nella page-layout di styles.xml, come le scrive LibreOffice)
  // oppure (LibreOffice convertendo da Word) una sezione con le colonne in content.xml
  const colonne = (stiliXml ? /<style:page-layout-properties[^>]*>[\s\S]*?<style:columns[^>]*fo:column-count="([23])"/.exec(stiliXml) : null)
    ?? /<style:style[^>]*style:family="section"[^>]*>[\s\S]*?<style:columns[^>]*fo:column-count="([23])"/.exec(xmlStr);
  if (colonne) documento.colonne = Number(colonne[1]) as 2 | 3;
  return documento;
}
