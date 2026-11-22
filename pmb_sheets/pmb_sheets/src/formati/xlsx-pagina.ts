// Impostazione di pagina in un file .xlsx (scritta per pmb_office, lotto 3): pageSetup, pageMargins, printOptions, headerFooter, rowBreaks e colBreaks
// nel foglio; area di stampa e righe/colonne da ripetere come nomi _xlnm.Print_Area e _xlnm.Print_Titles della cartella.
// Scrittura e lettura stanno insieme così le due direzioni restano uguali. Puro: testo XML in entrata e in uscita.
import { elemento, escapaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import { MAX_COLS, MAX_ROWS, columnIndexToLetters, parseCellAddress } from '../engine/address';
import { eDiPartenza, paginaPredefinita, ripulisciPagina, type FormatoCarta, type ImpostaPagina, type TestiMargine } from '../sheet/pagina';
import type { FoglioScambio } from './scambio';

const CODICE_CARTA: Record<FormatoCarta, number> = { Letter: 1, Legal: 5, A3: 8, A4: 9, A5: 11 };
/** Codici dei formati di carta di Excel (gli stessi nei file .xlsx e .xls). */
export const CARTA_DA_CODICE: Record<number, FormatoCarta> = { 1: 'Letter', 5: 'Legal', 8: 'A3', 9: 'A4', 11: 'A5' };
const POLLICI = 25.4;
const pollici = (mm: number): number => Math.round((mm / POLLICI) * 10000) / 10000;
/** Da pollici (come li scrive Excel) a millimetri, arrotondati al decimo. */
export const mm = (p: number): number => Math.round(p * POLLICI * 10) / 10;

// ---- intestazione e piè di pagina: &L &C &R, campi &P &N &A &F &D &T, una & si scrive && ----
const CAMPI_EXCEL: Array<[string, string]> = [['&[Pagina]', '&P'], ['&[Pagine]', '&N'], ['&[Foglio]', '&A'], ['&[File]', '&F'], ['&[Data]', '&D'], ['&[Ora]', '&T']];

function versoExcel(testo: string): string {
  let out = '';
  for (let i = 0; i < testo.length; i++) {
    const campo = CAMPI_EXCEL.find(([nostro]) => testo.startsWith(nostro, i));
    if (campo) { out += campo[1]; i += campo[0].length - 1; continue; }
    if (testo.startsWith('&&', i)) { out += '&&'; i++; continue; }
    out += testo[i] === '&' ? '&&' : testo[i];
  }
  return out;
}
export function margineExcel(t: TestiMargine): string {
  return [['&L', t.sinistra], ['&C', t.centro], ['&R', t.destra]].filter(([, v]) => v !== '').map(([k, v]) => k + versoExcel(v)).join('');
}
/** Legge «&LTesto&CPagina &P&RFile &F»; i codici di carattere (&B, &I, &"Arial", &12…) si tolgono. */
export function leggiMargineExcel(testo: string): TestiMargine {
  const out: TestiMargine = { sinistra: '', centro: '', destra: '' };
  let dove: keyof TestiMargine = 'centro';
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (ch !== '&') { out[dove] += ch; continue; }
    const k = testo[i + 1] ?? '';
    i++;
    if (k === '&') out[dove] += '&';
    else if (k === 'L') dove = 'sinistra';
    else if (k === 'C') dove = 'centro';
    else if (k === 'R') dove = 'destra';
    else if (k === 'P') out[dove] += '&[Pagina]';
    else if (k === 'N') out[dove] += '&[Pagine]';
    else if (k === 'A') out[dove] += '&[Foglio]';
    else if (k === 'F') out[dove] += '&[File]';
    else if (k === 'D') out[dove] += '&[Data]';
    else if (k === 'T') out[dove] += '&[Ora]';
    else if (k === '"') { const fine = testo.indexOf('"', i + 1); i = fine < 0 ? testo.length : fine; }
    else if (/\d/.test(k)) { while (/\d/.test(testo[i + 1] ?? '')) i++; }
    // &B &I &U &S &E &X &Y &K... (aspetto del testo): si ignorano
  }
  return out;
}

// ---- scrittura ----

/** Ciò che va dentro <sheetPr>, dopo tabColor: fitToPage se il foglio si adatta a pagine. */
export function sheetPrPagina(f: FoglioScambio): string[] {
  return f.pagina?.adatta ? [elemento('pageSetUpPr', { fitToPage: 1 })] : [];
}

/** Gli elementi del foglio da mettere dopo i collegamenti e prima dei disegni: printOptions, pageMargins, pageSetup, headerFooter, rowBreaks, colBreaks. */
export function paginaXml(f: FoglioScambio): string[] {
  const p = f.pagina;
  if (!p || eDiPartenza(p)) return [];
  const out: string[] = [];
  if (p.griglia || p.intestazioniRigheColonne || p.centraOrizzontale || p.centraVerticale) {
    out.push(elemento('printOptions', {
      horizontalCentered: p.centraOrizzontale ? 1 : undefined, verticalCentered: p.centraVerticale ? 1 : undefined,
      headings: p.intestazioniRigheColonne ? 1 : undefined, gridLines: p.griglia ? 1 : undefined,
    }));
  }
  const m = p.margini;
  out.push(elemento('pageMargins', { left: pollici(m.sinistro), right: pollici(m.destro), top: pollici(m.alto), bottom: pollici(m.basso), header: pollici(m.alto / 2), footer: pollici(m.basso / 2) }));
  out.push(elemento('pageSetup', {
    paperSize: CODICE_CARTA[p.formato],
    scale: p.adatta ? undefined : p.scala,
    fitToWidth: p.adatta ? p.adatta.larghezza : undefined,
    fitToHeight: p.adatta ? p.adatta.altezza : undefined,
    pageOrder: p.ordine === 'destra' ? 'overThenDown' : undefined,
    orientation: p.orientamento === 'orizzontale' ? 'landscape' : 'portrait',
  }));
  const testa = margineExcel(p.intestazione);
  const piede = margineExcel(p.pie);
  out.push(elemento('headerFooter', {}, [
    ...(testa ? [elemento('oddHeader', {}, [escapaXml(testa)])] : []),
    ...(piede ? [elemento('oddFooter', {}, [escapaXml(piede)])] : []),
  ]));
  const interruzioni = (nome: string, l: number[], max: number): void => {
    if (l.length === 0) return;
    out.push(elemento(nome, { count: l.length, manualBreakCount: l.length }, l.map((n) => elemento('brk', { id: n - 1, max, man: 1 }))));
  };
  interruzioni('rowBreaks', p.interruzioniRighe, MAX_COLS - 1);
  interruzioni('colBreaks', p.interruzioniColonne, MAX_ROWS - 1);
  return out;
}

const quota = (foglio: string): string => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(foglio) ? foglio : `'${foglio.replace(/'/g, "''")}'`);

/** I nomi _xlnm.Print_Area e _xlnm.Print_Titles dei fogli (localSheetId = posizione del foglio). */
export function nomiStampaXml(fogli: FoglioScambio[], nomiNelFile: string[]): string[] {
  const out: string[] = [];
  fogli.forEach((f, i) => {
    const p = f.pagina;
    if (!p) return;
    const q = quota(nomiNelFile[i]);
    if (p.area) {
      const a = p.area;
      out.push(elemento('definedName', { name: '_xlnm.Print_Area', localSheetId: i }, [escapaXml(`${q}!$${columnIndexToLetters(a.startCol)}$${a.startRow}:$${columnIndexToLetters(a.endCol)}$${a.endRow}`)]));
    }
    const titoli: string[] = [];
    if (p.colonneRipetute) titoli.push(`${q}!$${columnIndexToLetters(p.colonneRipetute.da)}:$${columnIndexToLetters(p.colonneRipetute.a)}`);
    if (p.righeRipetute) titoli.push(`${q}!$${p.righeRipetute.da}:$${p.righeRipetute.a}`);
    if (titoli.length > 0) out.push(elemento('definedName', { name: '_xlnm.Print_Titles', localSheetId: i }, [escapaXml(titoli.join(','))]));
  });
  return out;
}

// ---- lettura ----

/** L'impostazione di pagina letta da un foglio; undefined se il foglio non ne ha (o ha quella di partenza). */
export function leggiPaginaXlsx(radice: NodoXml): ImpostaPagina | undefined {
  const ps = trova(radice, 'pageSetup');
  const pm = trova(radice, 'pageMargins');
  const po = trova(radice, 'printOptions');
  const hf = trova(radice, 'headerFooter');
  const rb = trova(radice, 'rowBreaks');
  const cb = trova(radice, 'colBreaks');
  if (!ps && !pm && !po && !hf && !rb && !cb) return undefined;
  const p = paginaPredefinita();
  const vero = (v: string | undefined): boolean => v === '1' || v === 'true';
  if (ps) {
    const c = CARTA_DA_CODICE[Number(ps.attributi.paperSize ?? 9)];
    if (c) p.formato = c;
    p.orientamento = ps.attributi.orientation === 'landscape' ? 'orizzontale' : 'verticale';
    if (ps.attributi.pageOrder === 'overThenDown') p.ordine = 'destra';
    const adatta = vero(trova(radice, 'sheetPr/pageSetUpPr')?.attributi.fitToPage);
    if (adatta) p.adatta = { larghezza: Number(ps.attributi.fitToWidth ?? 1), altezza: Number(ps.attributi.fitToHeight ?? 1) };
    else { p.adatta = null; p.scala = Number(ps.attributi.scale ?? 100); }
  }
  if (pm) {
    const v = (k: string, d: number): number => { const n = Number(pm.attributi[k]); return Number.isFinite(n) ? mm(n) : d; };
    p.margini = { alto: v('top', p.margini.alto), basso: v('bottom', p.margini.basso), sinistro: v('left', p.margini.sinistro), destro: v('right', p.margini.destro) };
  }
  if (po) {
    p.griglia = vero(po.attributi.gridLines);
    p.intestazioniRigheColonne = vero(po.attributi.headings);
    p.centraOrizzontale = vero(po.attributi.horizontalCentered);
    p.centraVerticale = vero(po.attributi.verticalCentered);
  }
  if (hf) {
    const testa = trova(hf, 'oddHeader');
    const piede = trova(hf, 'oddFooter');
    p.intestazione = testa ? leggiMargineExcel(testoXml(testa)) : { sinistra: '', centro: '', destra: '' };
    p.pie = piede ? leggiMargineExcel(testoXml(piede)) : { sinistra: '', centro: '', destra: '' };
  }
  const brk = (n: NodoXml | undefined): number[] => (n ? figliElemento(n, 'brk').map((b) => Number(b.attributi.id) + 1).filter((x) => Number.isInteger(x) && x >= 2) : []);
  p.interruzioniRighe = brk(rb);
  p.interruzioniColonne = brk(cb);
  const pulita = ripulisciPagina(p);
  return eDiPartenza(pulita) ? undefined : pulita;
}

/** Aree di stampa e titoli dai nomi _xlnm della cartella, per posizione del foglio. */
export function leggiNomiStampa(cartella: NodoXml): Map<number, Pick<ImpostaPagina, 'area' | 'righeRipetute' | 'colonneRipetute'>> {
  const out = new Map<number, Pick<ImpostaPagina, 'area' | 'righeRipetute' | 'colonneRipetute'>>();
  const dn = trova(cartella, 'definedNames');
  for (const n of dn ? figliElemento(dn, 'definedName') : []) {
    const nome = n.attributi.name;
    const i = Number(n.attributi.localSheetId);
    if (!Number.isInteger(i) || i < 0 || (nome !== '_xlnm.Print_Area' && nome !== '_xlnm.Print_Titles')) continue;
    const voce = out.get(i) ?? {};
    aggiungiNomeStampa(voce, nome === '_xlnm.Print_Area' ? 'area' : 'titoli', testoXml(n));
    out.set(i, voce);
  }
  return out;
}

/** Il testo di un nome Print_Area o Print_Titles («Foglio!$A$1:$D$20», «Foglio!$1:$2,Foglio!$A:$A») nella voce di pagina (lo usano anche i file .xls). */
export function aggiungiNomeStampa(voce: Pick<ImpostaPagina, 'area' | 'righeRipetute' | 'colonneRipetute'>, tipo: 'area' | 'titoli', testo: string): void {
  // più riferimenti separati da virgole; il nome del foglio davanti si toglie
  for (const parte of testo.split(',')) {
    const rif = parte.trim().replace(/^.*!/, '').replace(/\$/g, '');
    let m: RegExpExecArray | null;
    if (tipo === 'area') {
      const [x, y] = rif.split(':');
      const a = parseCellAddress(x ?? ''), b = parseCellAddress(y ?? x ?? '');
      if (a && b && voce.area === undefined) voce.area = { startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) };
    } else if ((m = /^(\d+):(\d+)$/.exec(rif))) {
      voce.righeRipetute = { da: Number(m[1]), a: Number(m[2]) };
    } else if ((m = /^([A-Za-z]+):([A-Za-z]+)$/.exec(rif))) {
      const col = (s: string): number => [...s.toUpperCase()].reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0);
      voce.colonneRipetute = { da: col(m[1]), a: col(m[2]) };
    }
  }
}

/** Mette insieme ciò che si legge dal foglio e ciò che si legge dai nomi della cartella. */
export function unisciPagina(dalFoglio: ImpostaPagina | undefined, dalNome: Pick<ImpostaPagina, 'area' | 'righeRipetute' | 'colonneRipetute'> | undefined): ImpostaPagina | undefined {
  if (!dalFoglio && !dalNome) return undefined;
  const p = ripulisciPagina({ ...(dalFoglio ?? paginaPredefinita()), ...(dalNome ?? {}) });
  return eDiPartenza(p) ? undefined : p;
}
