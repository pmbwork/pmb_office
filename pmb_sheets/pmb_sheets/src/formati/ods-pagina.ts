// Impostazione di pagina in un file .ods (scritta per pmb_office, lotto 3). In OpenDocument la pagina sta in styles.xml: un style:page-layout
// (carta, orientamento, margini, scala, griglia, centratura, ordine) e una style:master-page con intestazione e piè di pagina; la tabella la
// richiama con uno stile di famiglia "table". L'area di stampa è l'attributo table:print-ranges della tabella.
// Righe e colonne da ripetere e interruzioni a mano non si scrivono in .ods (si avvisa); il resto va e torna. Puro: testo XML in entrata e in uscita.
import { elemento, escapaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { columnIndexToLetters, parseCellAddress } from '../engine/address';
import { CARTA, eDiPartenza, paginaPredefinita, ripulisciPagina, type FormatoCarta, type ImpostaPagina, type TestiMargine } from '../sheet/pagina';
import type { FoglioScambio } from './scambio';

const cm = (mm: number): string => `${Math.round(mm * 100) / 1000}cm`;
/** Una lunghezza di OpenDocument («2cm», «20mm», «0.79in», «56.7pt») in mm. */
export function lunghezzaMm(v: string | undefined): number | undefined {
  const m = /^(-?[\d.]+)(cm|mm|in|pt|pc)$/.exec((v ?? '').trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const per: Record<string, number> = { cm: 10, mm: 1, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6 };
  return Number.isFinite(n) ? Math.round(n * per[m[2]] * 10) / 10 : undefined;
}

// ---- intestazione e piè di pagina: campi come elementi text: ----
const CAMPI_ODS: Array<[string, string]> = [['&[Pagina]', 'text:page-number'], ['&[Pagine]', 'text:page-count'], ['&[Foglio]', 'text:sheet-name'], ['&[File]', 'text:file-name'], ['&[Data]', 'text:date'], ['&[Ora]', 'text:time']];

function paragrafo(testo: string): string {
  const parti: string[] = [];
  let buffer = '';
  for (let i = 0; i < testo.length; i++) {
    const campo = CAMPI_ODS.find(([nostro]) => testo.startsWith(nostro, i));
    if (campo) {
      if (buffer) { parti.push(escapaXml(buffer)); buffer = ''; }
      parti.push(elemento(campo[1], campo[1] === 'text:file-name' ? { 'text:display': 'name-and-extension' } : {}));
      i += campo[0].length - 1;
      continue;
    }
    if (testo.startsWith('&&', i)) { buffer += '&'; i++; continue; }
    buffer += testo[i];
  }
  if (buffer) parti.push(escapaXml(buffer));
  return elemento('text:p', {}, parti);
}
function margine(nome: 'style:header' | 'style:footer', t: TestiMargine): string {
  if (t.sinistra === '' && t.centro === '' && t.destra === '') return elemento(nome, { 'style:display': 'false' });
  return elemento(nome, {}, [
    elemento('style:region-left', {}, [paragrafo(t.sinistra)]),
    elemento('style:region-center', {}, [paragrafo(t.centro)]),
    elemento('style:region-right', {}, [paragrafo(t.destra)]),
  ]);
}

/** Il nome della pagina mastro del foglio in posizione i (se ha un'impostazione di pagina). */
export const nomeMastro = (i: number): string => `PaginaPmb${i + 1}`;
export const nomeStileTabella = (i: number): string => `taPmb${i + 1}`;

export function haPagina(f: FoglioScambio): boolean { return !!f.pagina && !eDiPartenza(f.pagina); }

/** styles.xml con i layout e le pagine mastro dei fogli che hanno un'impostazione di pagina e gli stili con nome `stiliComuni`
 *  (quelli delle formattazioni condizionali); null se non c'è niente da scrivere. */
export function stiliPaginaXml(fogli: FoglioScambio[], ns: Record<string, string>, intestazione: string, stiliComuni: readonly string[] = []): string | null {
  const conPagina = fogli.map((f, i) => [f, i] as const).filter(([f]) => haPagina(f));
  if (conPagina.length === 0 && stiliComuni.length === 0) return null;
  const layout: string[] = [];
  const mastri: string[] = [];
  for (const [f, i] of conPagina) {
    const p = f.pagina!;
    const [w, h] = CARTA[p.formato];
    const or = p.orientamento === 'orizzontale';
    const stampa = ['charts', 'drawings', 'objects', 'zero-values', ...(p.griglia ? ['grid'] : []), ...(p.intestazioniRigheColonne ? ['headers'] : [])].join(' ');
    const centratura = p.centraOrizzontale && p.centraVerticale ? 'both' : p.centraOrizzontale ? 'horizontal' : p.centraVerticale ? 'vertical' : 'none';
    layout.push(elemento('style:page-layout', { 'style:name': `pl${i + 1}` }, [
      elemento('style:page-layout-properties', {
        'fo:page-width': cm(or ? h : w), 'fo:page-height': cm(or ? w : h), 'style:print-orientation': or ? 'landscape' : 'portrait',
        'fo:margin-top': cm(p.margini.alto), 'fo:margin-bottom': cm(p.margini.basso), 'fo:margin-left': cm(p.margini.sinistro), 'fo:margin-right': cm(p.margini.destro),
        ...(p.adatta ? { 'style:scale-to-X': String(p.adatta.larghezza), 'style:scale-to-Y': String(p.adatta.altezza) } : { 'style:scale-to': `${p.scala}%` }),
        'style:print': stampa, 'style:print-page-order': p.ordine === 'destra' ? 'ltr' : 'ttb', 'style:table-centering': centratura,
      }),
    ]));
    mastri.push(elemento('style:master-page', { 'style:name': nomeMastro(i), 'style:page-layout-name': `pl${i + 1}` }, [margine('style:header', p.intestazione), margine('style:footer', p.pie)]));
  }
  return intestazione + elemento('office:document-styles', { ...ns, 'office:version': '1.3' }, [
    ...(stiliComuni.length > 0 ? [elemento('office:styles', {}, [...stiliComuni])] : []),
    ...(layout.length > 0 ? [elemento('office:automatic-styles', {}, layout)] : []),
    ...(mastri.length > 0 ? [elemento('office:master-styles', {}, mastri)] : []),
  ]);
}

/** Il colore della scheda del foglio, se valido ("#rrggbb" minuscolo). */
export function coloreScheda(f: FoglioScambio): string | undefined {
  return typeof f.colore === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.colore) ? f.colore.toLowerCase() : undefined;
}

/** Vero se il foglio ha bisogno di uno stile di tabella (pagina mastro o colore della scheda). */
const haStileTabella = (f: FoglioScambio): boolean => haPagina(f) || coloreScheda(f) !== undefined || f.nascosto === true;

/** Gli stili di tabella (in content.xml) che legano ogni foglio alla sua pagina mastro e portano il colore della scheda.
 *  Il colore si scrive in tutti e due i modi: `table:tab-color` (OpenDocument 1.3) e `tableooo:tab-color` (quello che legge LibreOffice). */
export function stiliTabellaXml(fogli: FoglioScambio[]): string[] {
  return fogli.flatMap((f, i) => {
    if (!haStileTabella(f)) return [];
    const colore = coloreScheda(f);
    return [elemento('style:style', { 'style:name': nomeStileTabella(i), 'style:family': 'table', 'style:master-page-name': haPagina(f) ? nomeMastro(i) : undefined }, [
      elemento('style:table-properties', { 'table:display': f.nascosto ? 'false' : 'true', 'table:tab-color': colore, 'tableooo:tab-color': colore }),
    ])];
  });
}

const quota = (foglio: string): string => `'${foglio.replace(/'/g, "''")}'`;

/** Gli attributi da dare a table:table: lo stile con la pagina mastro e l'area di stampa. */
export function attributiTabella(f: FoglioScambio, i: number, nomeNelFile: string): Record<string, string | undefined> {
  if (!haStileTabella(f)) return {};
  const a = haPagina(f) ? f.pagina!.area : undefined;
  return {
    'table:style-name': nomeStileTabella(i),
    'table:print-ranges': a ? `${quota(nomeNelFile)}.${columnIndexToLetters(a.startCol)}${a.startRow}:${quota(nomeNelFile)}.${columnIndexToLetters(a.endCol)}${a.endRow}` : undefined,
  };
}

/** Le parti dell'impostazione che il file .ods non conserva: si avvisa chi salva. */
export function perditeOds(f: FoglioScambio): boolean {
  const p = f.pagina;
  return !!p && (!!p.righeRipetute || !!p.colonneRipetute || p.interruzioniRighe.length > 0 || p.interruzioniColonne.length > 0);
}

// ---- lettura ----

function testoParagrafo(n: NodoXml | undefined): string {
  if (!n) return '';
  let out = '';
  const visita = (x: NodoXml): void => {
    for (const c of x.figli) {
      if (typeof c === 'string') { out += c; continue; }
      const campo = CAMPI_ODS.find(([, el]) => el === c.nome);
      if (campo) out += campo[0];
      else if (c.nome === 'text:s') out += ' '.repeat(Math.max(1, Number(c.attributi['text:c'] ?? 1)));
      else visita(c);
    }
  };
  for (const p of figliElemento(n, 'text:p')) { if (out !== '') out += ' '; visita(p); }
  return out;
}
function leggiMargine(n: NodoXml | undefined): TestiMargine {
  if (!n || n.attributi['style:display'] === 'false') return { sinistra: '', centro: '', destra: '' };
  const sx = trova(n, 'style:region-left'), ce = trova(n, 'style:region-center'), dx = trova(n, 'style:region-right');
  if (!sx && !ce && !dx) return { sinistra: '', centro: testoParagrafo(n), destra: '' };
  return { sinistra: testoParagrafo(sx), centro: testoParagrafo(ce), destra: testoParagrafo(dx) };
}

/** Le impostazioni di pagina dei mastri di styles.xml, per nome della pagina mastro. */
export function leggiMastri(stili: NodoXml | undefined): Map<string, ImpostaPagina> {
  const out = new Map<string, ImpostaPagina>();
  if (!stili) return out;
  const layout = new Map<string, NodoXml>();
  for (const g of [...figliElemento(stili, 'office:automatic-styles'), ...figliElemento(stili, 'office:styles')]) {
    for (const pl of figliElemento(g, 'style:page-layout')) if (pl.attributi['style:name']) layout.set(pl.attributi['style:name'], pl);
  }
  for (const ms of figliElemento(stili, 'office:master-styles')) {
    for (const m of figliElemento(ms, 'style:master-page')) {
      const nome = m.attributi['style:name'];
      if (!nome) continue;
      const p = paginaPredefinita();
      const pp = trova(layout.get(m.attributi['style:page-layout-name'] ?? '') ?? { nome: '', attributi: {}, figli: [] }, 'style:page-layout-properties');
      if (pp) {
        const a = pp.attributi;
        const lw = lunghezzaMm(a['fo:page-width']), lh = lunghezzaMm(a['fo:page-height']);
        p.orientamento = a['style:print-orientation'] === 'landscape' || (lw !== undefined && lh !== undefined && lw > lh) ? 'orizzontale' : 'verticale';
        if (lw !== undefined && lh !== undefined) {
          const corto = Math.min(lw, lh), lungo = Math.max(lw, lh);
          const formato = (Object.keys(CARTA) as FormatoCarta[]).find((k) => Math.abs(CARTA[k][0] - corto) < 2 && Math.abs(CARTA[k][1] - lungo) < 2);
          if (formato) p.formato = formato;
        }
        const mg = (k: string, d: number): number => lunghezzaMm(a[k]) ?? d;
        p.margini = { alto: mg('fo:margin-top', p.margini.alto), basso: mg('fo:margin-bottom', p.margini.basso), sinistro: mg('fo:margin-left', p.margini.sinistro), destro: mg('fo:margin-right', p.margini.destro) };
        if (a['style:scale-to-X'] !== undefined || a['style:scale-to-Y'] !== undefined) p.adatta = { larghezza: Number(a['style:scale-to-X'] ?? 0), altezza: Number(a['style:scale-to-Y'] ?? 0) };
        else if (a['style:scale-to-pages'] !== undefined) p.adatta = { larghezza: Number(a['style:scale-to-pages']), altezza: 0 };
        else if (a['style:scale-to'] !== undefined) { p.adatta = null; p.scala = Number(String(a['style:scale-to']).replace('%', '')); }
        const voci = (a['style:print'] ?? '').split(/\s+/);
        p.griglia = voci.includes('grid');
        p.intestazioniRigheColonne = voci.includes('headers');
        p.ordine = a['style:print-page-order'] === 'ltr' ? 'destra' : 'giu';
        const c = a['style:table-centering'];
        p.centraOrizzontale = c === 'horizontal' || c === 'both';
        p.centraVerticale = c === 'vertical' || c === 'both';
      }
      p.intestazione = leggiMargine(trova(m, 'style:header'));
      p.pie = leggiMargine(trova(m, 'style:footer'));
      out.set(nome, ripulisciPagina(p));
    }
  }
  return out;
}

/** La pagina mastro di ogni stile di tabella (dalle automatic-styles di content.xml). */
export function mastriDegliStiliTabella(gruppi: NodoXml[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of gruppi) for (const s of figliElemento(g, 'style:style')) {
    if (s.attributi['style:family'] === 'table' && s.attributi['style:name'] && s.attributi['style:master-page-name']) out.set(s.attributi['style:name'], s.attributi['style:master-page-name']);
  }
  return out;
}

/** Il colore della scheda di ogni stile di tabella (dalle automatic-styles di content.xml): `table:tab-color` o `tableooo:tab-color`. */
export function coloriDegliStiliTabella(gruppi: NodoXml[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of gruppi) for (const s of figliElemento(g, 'style:style')) {
    if (s.attributi['style:family'] !== 'table' || !s.attributi['style:name']) continue;
    const p = trova(s, 'style:table-properties');
    const c = p?.attributi['table:tab-color'] ?? p?.attributi['tableooo:tab-color'];
    if (c !== undefined && /^#[0-9a-fA-F]{6}$/.test(c)) out.set(s.attributi['style:name'], c.toLowerCase());
  }
  return out;
}

/** Gli stili di tabella che nascondono il foglio (table:display="false"). */
export function stiliTabellaNascosti(gruppi: NodoXml[]): Set<string> {
  const out = new Set<string>();
  for (const g of gruppi) for (const s of figliElemento(g, 'style:style')) {
    if (s.attributi['style:family'] !== 'table' || !s.attributi['style:name']) continue;
    if (trova(s, 'style:table-properties')?.attributi['table:display'] === 'false') out.add(s.attributi['style:name']);
  }
  return out;
}

/** L'impostazione di pagina di una tabella: quella della sua pagina mastro, più l'area di stampa. undefined se è quella di partenza. */
export function paginaDellaTabella(t: NodoXml, stiliTabella: Map<string, string>, mastri: Map<string, ImpostaPagina>): ImpostaPagina | undefined {
  const mastro = stiliTabella.get(t.attributi['table:style-name'] ?? '');
  const base = (mastro ? mastri.get(mastro) : undefined) ?? paginaPredefinita();
  const p = ripulisciPagina(base);
  const pr = (t.attributi['table:print-ranges'] ?? '').trim().split(/\s+/)[0] ?? '';
  if (pr !== '') {
    // 'Foglio'.A1:'Foglio'.F40  oppure  $Foglio.$A$1:.$F$40
    const [x, y] = pr.split(':').map((s) => s.replace(/^.*\./, '').replace(/\$/g, ''));
    const a = parseCellAddress(x ?? ''), b = parseCellAddress(y ?? x ?? '');
    if (a && b) p.area = { startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) };
  }
  return eDiPartenza(p) ? undefined : p;
}
