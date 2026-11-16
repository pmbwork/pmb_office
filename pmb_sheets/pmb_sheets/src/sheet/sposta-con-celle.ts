// Taglia e incolla: ciò che sta "sopra" le celle si sposta con loro. Le celle, gli stili e le formule che le citano li sposta già la griglia;
// qui si spostano le convalide dei dati, le celle unite, le formattazioni condizionali, i commenti e gli intervalli denominati.
// Come in Excel: quello che sta nelle celle tagliate passa alla destinazione, e la destinazione perde ciò che aveva (viene sostituita);
// ciò che si trova solo in parte nell'area tagliata (una cella unita che esce dall'area, una regola che la supera) resta com'è.
// Modulo puro, niente DOM: lavora sulle strutture del foglio e le modifica sul posto (le funzioni di cui sotto dicono quali).
import type { MergeRange } from './cell-merge';
import type { DataValidationRule } from './data-validation';
import type { ConditionalFormatRule } from './conditional-format';
import type { NamedRange } from './named-ranges';
import { chiaveCommento, elencaCommenti, type Commento } from './commenti';
import { scriviIntervallo } from './regole-dialogo';
import { shiftFormula } from '../engine/shift-formula';
import { aggiornaPerSpostamento, type BloccoSpostato } from '../engine/sposta-riferimenti';

export interface Area { startRow: number; endRow: number; startCol: number; endCol: number }

export interface Spostamento {
  /** le celle tagliate */
  area: Area;
  foglioOrigine: string;
  foglioDestinazione: string;
  deltaRighe: number;
  deltaColonne: number;
}

/** Ciò che di un foglio si sposta con le celle (lo stato del foglio ha questi campi). */
export interface DatiSopraLeCelle {
  merges: MergeRange[];
  dataValidations: Map<string, DataValidationRule>;
  conditionalFormats: ConditionalFormatRule[];
}

const dentro = (r: number, c: number, a: Area): boolean => r >= a.startRow && r <= a.endRow && c >= a.startCol && c <= a.endCol;
const contenuta = (a: Area, grande: Area): boolean => a.startRow >= grande.startRow && a.endRow <= grande.endRow && a.startCol >= grande.startCol && a.endCol <= grande.endCol;
const siSovrappongono = (a: Area, b: Area): boolean => a.startRow <= b.endRow && a.endRow >= b.startRow && a.startCol <= b.endCol && a.endCol >= b.startCol;
const spostata = (a: Area, s: Spostamento): Area => ({ startRow: a.startRow + s.deltaRighe, endRow: a.endRow + s.deltaRighe, startCol: a.startCol + s.deltaColonne, endCol: a.endCol + s.deltaColonne });

/** L'area dove vanno a finire le celle. */
export function areaDestinazione(s: Spostamento): Area { return spostata(s.area, s); }

function leggiChiave(k: string): { r: number; c: number } | null {
  const m = /^(\d+):(\d+)$/.exec(k);
  return m ? { r: Number(m[1]), c: Number(m[2]) } : null;
}

/** Sostituisce il contenuto di un elenco sul posto (le strutture del foglio si tengono per riferimento: non si possono riassegnare). */
function sostituisci<T>(elenco: T[], nuovo: T[]): void { elenco.splice(0, elenco.length, ...nuovo); }

/** Sposta le convalide e le celle unite e le formattazioni condizionali dall'area tagliata alla destinazione. Modifica `origine` e `destinazione` sul posto
 *  (sono lo stesso oggetto se si taglia dentro lo stesso foglio). */
/**
 * La regola (del foglio `foglio`) dopo un taglia-incolla: se ha una formula, i riferimenti alle celle spostate le seguono, come nelle formule delle celle.
 * `eSpostata`: la regola è una di quelle che si spostano con le celle (allora gli altri suoi riferimenti restano com'erano).
 */
export function regolaDopoSpostamento(r: ConditionalFormatRule, foglio: string, s: Spostamento, eSpostata: boolean): ConditionalFormatRule {
  if (r.type !== 'formula' || r.value1 === undefined || String(r.value1).trim() === '') return r;
  const blocco: BloccoSpostato = { foglio: s.foglioOrigine, startRow: s.area.startRow, endRow: s.area.endRow, startCol: s.area.startCol, endCol: s.area.endCol, deltaRows: s.deltaRighe, deltaCols: s.deltaColonne, foglioDestinazione: s.foglioDestinazione };
  const testo = String(r.value1).trim().startsWith('=') ? String(r.value1) : `=${r.value1}`;
  const nuova = aggiornaPerSpostamento(testo, foglio, blocco, eSpostata);
  return nuova === testo ? r : { ...r, value1: nuova };
}

export function spostaDatiSopraLeCelle(origine: DatiSopraLeCelle, destinazione: DatiSopraLeCelle, s: Spostamento): void {
  const dest = areaDestinazione(s);
  const stessoFoglio = origine === destinazione || s.foglioOrigine === s.foglioDestinazione;

  // convalide: si prendono quelle dell'area, si tolgono dalla sorgente, la destinazione perde le sue sotto l'area coperta, poi si mettono le spostate
  const prese: Array<{ r: number; c: number; regola: DataValidationRule }> = [];
  for (const [k, regola] of [...origine.dataValidations]) {
    const p = leggiChiave(k);
    if (p && dentro(p.r, p.c, s.area)) { prese.push({ ...p, regola }); origine.dataValidations.delete(k); }
  }
  for (const k of [...destinazione.dataValidations.keys()]) {
    const p = leggiChiave(k);
    if (p && dentro(p.r, p.c, dest)) destinazione.dataValidations.delete(k);
  }
  for (const v of prese) destinazione.dataValidations.set(`${v.r + s.deltaRighe}:${v.c + s.deltaColonne}`, v.regola);

  // celle unite: passano solo quelle interamente dentro l'area; la destinazione perde quelle che toccano l'area coperta
  const mosse = origine.merges.filter((m) => contenuta(m, s.area));
  const restoOrigine = origine.merges.filter((m) => !contenuta(m, s.area));
  const nuove = mosse.map((m) => spostata(m, s));
  if (stessoFoglio) {
    sostituisci(origine.merges, [...restoOrigine.filter((m) => !siSovrappongono(m, dest)), ...nuove]);
  } else {
    sostituisci(origine.merges, restoOrigine);
    sostituisci(destinazione.merges, [...destinazione.merges.filter((m) => !siSovrappongono(m, dest)), ...nuove]);
  }

  // formattazioni condizionali: passano le regole il cui intervallo sta tutto nell'area; le formule seguono le celle spostate come quelle delle celle
  // (la regola spostata tiene i suoi riferimenti, salvo quelli alle celle spostate, che le seguono; le altre regole che citano le celle spostate le seguono)
  const conFormula = (r: ConditionalFormatRule, foglio: string, eSpostata: boolean) => regolaDopoSpostamento(r, foglio, s, eSpostata);
  const regoleMosse = origine.conditionalFormats.filter((r) => contenuta(r.range, s.area));
  const regoleResto = origine.conditionalFormats.filter((r) => !contenuta(r.range, s.area)).map((r) => conFormula(r, s.foglioOrigine, false));
  const regoleNuove = regoleMosse.map((r) => conFormula({ ...r, range: spostata(r.range, s) }, s.foglioOrigine, true));
  if (!stessoFoglio) sostituisci(destinazione.conditionalFormats, destinazione.conditionalFormats.map((r) => conFormula(r, s.foglioDestinazione, false)));
  if (stessoFoglio) {
    sostituisci(origine.conditionalFormats, [...regoleResto, ...regoleNuove]);
  } else {
    sostituisci(origine.conditionalFormats, regoleResto);
    sostituisci(destinazione.conditionalFormats, [...destinazione.conditionalFormats, ...regoleNuove]);
  }
}

/** Sposta i commenti (chiave riga:colonna!foglio): quelli dell'area passano alla destinazione, quelli già sotto la destinazione vengono sostituiti. Modifica la mappa sul posto. */
export function spostaCommenti(mappa: Map<string, Commento>, s: Spostamento): void {
  const dest = areaDestinazione(s);
  const presi = elencaCommenti(mappa, s.foglioOrigine).filter((c) => dentro(c.riga, c.colonna, s.area));
  for (const c of presi) mappa.delete(chiaveCommento(s.foglioOrigine, c.riga, c.colonna));
  for (const c of elencaCommenti(mappa, s.foglioDestinazione)) if (dentro(c.riga, c.colonna, dest)) mappa.delete(chiaveCommento(s.foglioDestinazione, c.riga, c.colonna));
  for (const c of presi) mappa.set(chiaveCommento(s.foglioDestinazione, c.riga + s.deltaRighe, c.colonna + s.deltaColonne), { testo: c.testo, data: c.data });
}

/** Il nome del foglio come va scritto davanti a un intervallo: con gli apici se ha spazi o simboli. */
function foglioPerRiferimento(nome: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(nome) ? nome : `'${nome.replace(/'/g, "''")}'`;
}

/** Gli intervalli denominati con la nuova posizione: quelli che stanno tutti nell'area tagliata seguono le celle (anche su un altro foglio). Restituisce l'elenco nuovo. */
export function spostaNomi(nomi: readonly NamedRange[], s: Spostamento): NamedRange[] {
  return nomi.map((n) => {
    if (n.sheetName !== s.foglioOrigine || !contenuta(n, s.area)) return { ...n };
    const nuovo = spostata(n, s);
    const prefisso = n.rangeString.includes('!') ? `${foglioPerRiferimento(s.foglioDestinazione)}!` : '';
    return { ...n, sheetName: s.foglioDestinazione, ...nuovo, rangeString: `${prefisso}${scriviIntervallo(nuovo)}` };
  });
}

/** Due elenchi di nomi sono uguali (per non riscrivere al motore ciò che non è cambiato). */
export function nomiUguali(a: readonly NamedRange[], b: readonly NamedRange[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---- copia: lo stesso, senza togliere niente alla sorgente ----

/** Ciò che stava sopra le celle copiate, fotografato al momento della copia (coordinate della sorgente). */
export interface SopraLeCelle {
  commenti: Array<{ riga: number; colonna: number; testo: string; data: string }>;
  convalide: Array<{ riga: number; colonna: number; regola: DataValidationRule }>;
  /** le celle unite che stanno interamente nell'area copiata */
  unioni: MergeRange[];
  /** le formattazioni condizionali che toccano l'area copiata, ritagliate all'area (come in Excel: la parte che sta nell'area viene copiata) */
  regole: ConditionalFormatRule[];
}

/** La parte comune di due aree, oppure null se non si toccano. */
function intersezione(a: Area, b: Area): Area | null {
  if (!siSovrappongono(a, b)) return null;
  return { startRow: Math.max(a.startRow, b.startRow), endRow: Math.min(a.endRow, b.endRow), startCol: Math.max(a.startCol, b.startCol), endCol: Math.min(a.endCol, b.endCol) };
}

const stessaArea = (a: Area, b: Area): boolean => a.startRow === b.startRow && a.endRow === b.endRow && a.startCol === b.startCol && a.endCol === b.endCol;
const senzaIdENzona = (r: ConditionalFormatRule): string => JSON.stringify({ ...r, id: undefined, range: undefined });

/** La formula di una regola con i riferimenti relativi spostati di (dr, dc). Se non si riesce a leggere resta com'è. */
function formulaSpostata(f: unknown, dr: number, dc: number): unknown {
  if (typeof f !== 'string' || f.trim() === '' || (dr === 0 && dc === 0)) return f;
  try {
    const nuova = shiftFormula(f.trim().startsWith('=') ? f.trim() : `=${f.trim()}`, dr, dc);
    return f.trim().startsWith('=') ? nuova : nuova.substring(1);
  } catch {
    return f;
  }
}

const nuovoIdRegola = (): string => `cf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Toglie la `zona` dalle formattazioni condizionali: una regola che la copre tutta sparisce, una che la copre in parte si restringe,
 *  una che la attraversa si divide in fino a quattro pezzi (sopra, sotto, a sinistra, a destra), il primo con l'id di prima. Modifica l'elenco sul posto. */
export function liberaZonaDalleRegole(regole: ConditionalFormatRule[], zona: Area): void {
  const nuove: ConditionalFormatRule[] = [];
  for (const r of regole) {
    if (!siSovrappongono(r.range, zona)) { nuove.push(r); continue; }
    const q = r.range;
    const pezzi: Area[] = [];
    if (q.startRow < zona.startRow) pezzi.push({ ...q, endRow: zona.startRow - 1 });
    if (q.endRow > zona.endRow) pezzi.push({ ...q, startRow: zona.endRow + 1 });
    const r1 = Math.max(q.startRow, zona.startRow);
    const r2 = Math.min(q.endRow, zona.endRow);
    if (q.startCol < zona.startCol) pezzi.push({ startRow: r1, endRow: r2, startCol: q.startCol, endCol: zona.startCol - 1 });
    if (q.endCol > zona.endCol) pezzi.push({ startRow: r1, endRow: r2, startCol: zona.endCol + 1, endCol: q.endCol });
    pezzi.forEach((p, i) => nuove.push({ ...(JSON.parse(JSON.stringify(r)) as ConditionalFormatRule), id: i === 0 ? r.id : nuovoIdRegola(), range: p }));
  }
  regole.splice(0, regole.length, ...nuove);
}

/** Fotografa commenti, convalide, celle unite e formattazioni condizionali dell'area copiata. Sono copie: cambiare la sorgente dopo non cambia ciò che si incolla. */
export function fotografaSopraLeCelle(area: Area, foglio: string, commenti: Map<string, Commento>, dati: Pick<DatiSopraLeCelle, 'merges' | 'dataValidations'> & Partial<Pick<DatiSopraLeCelle, 'conditionalFormats'>>): SopraLeCelle {
  const convalide: SopraLeCelle['convalide'] = [];
  for (const [k, regola] of dati.dataValidations) {
    const p = leggiChiave(k);
    if (p && dentro(p.r, p.c, area)) convalide.push({ riga: p.r, colonna: p.c, regola: JSON.parse(JSON.stringify(regola)) as DataValidationRule });
  }
  return {
    commenti: elencaCommenti(commenti, foglio).filter((c) => dentro(c.riga, c.colonna, area)).map((c) => ({ riga: c.riga, colonna: c.colonna, testo: c.testo, data: c.data })),
    convalide,
    unioni: dati.merges.filter((m) => contenuta(m, area)).map((m) => ({ ...m })),
    regole: (dati.conditionalFormats ?? []).flatMap((r) => {
      const parte = intersezione(r.range, area);
      if (!parte) return [];
      const copia = { ...(JSON.parse(JSON.stringify(r)) as ConditionalFormatRule), range: parte };
      // la formula di una regola vale per la cella in alto a sinistra della sua zona: se la zona si ritaglia, la formula segue l'angolo nuovo
      if (copia.type === 'formula') copia.value1 = formulaSpostata(copia.value1, parte.startRow - r.range.startRow, parte.startCol - r.range.startCol) as typeof copia.value1;
      return [copia];
    }),
  };
}

/** Incolla trasposta: le regole copiate (senza formula, che andrebbe trasposta nei riferimenti) vanno sulla destinazione con righe e colonne scambiate,
 *  e la zona incollata si libera prima dalle regole che c'erano. Modifica l'elenco sul posto. */
export function incollaRegoleTrasposte(regole: readonly ConditionalFormatRule[], area: Area, destRiga: number, destColonna: number, elenco: ConditionalFormatRule[]): void {
  const altezza = area.endRow - area.startRow + 1;
  const larghezza = area.endCol - area.startCol + 1;
  liberaZonaDalleRegole(elenco, { startRow: destRiga, endRow: destRiga + larghezza - 1, startCol: destColonna, endCol: destColonna + altezza - 1 });
  for (const r of regole) {
    if (r.type === 'formula') continue;
    const zona = {
      startRow: destRiga + (r.range.startCol - area.startCol), endRow: destRiga + (r.range.endCol - area.startCol),
      startCol: destColonna + (r.range.startRow - area.startRow), endCol: destColonna + (r.range.endRow - area.startRow),
    };
    elenco.push({ ...(JSON.parse(JSON.stringify(r)) as ConditionalFormatRule), id: nuovoIdRegola(), range: zona });
  }
}

/** Nessun commento, nessuna convalida, nessuna unione e nessuna formattazione condizionale: non c'è niente da incollare sopra le celle. */
export function sopraVuoto(s: SopraLeCelle | undefined): boolean {
  return !s || (s.commenti.length === 0 && s.convalide.length === 0 && s.unioni.length === 0 && (s.regole ?? []).length === 0);
}

/** Mette sopra le celle incollate ciò che stava sopra quelle copiate. `origini` sono gli angoli in alto a sinistra di ogni piastrella dell'incolla
 *  (l'incolla ripete il blocco se la selezione è un multiplo). Come in Excel un commento, una convalida o una unione copiati sostituiscono quelli che c'erano;
 *  se la sorgente non ha niente in una cella, quello che c'era nella destinazione NON si cancella. Modifica `commenti` e `dati` sul posto. */
export function incollaSopraLeCelle(
  sopra: SopraLeCelle, area: Area, origini: ReadonlyArray<{ riga: number; colonna: number }>, foglioDestinazione: string,
  commenti: Map<string, Commento>, dati: Pick<DatiSopraLeCelle, 'merges' | 'dataValidations'> & Partial<Pick<DatiSopraLeCelle, 'conditionalFormats'>>,
): void {
  for (const o of origini) {
    const dr = o.riga - area.startRow;
    const dc = o.colonna - area.startCol;
    // formattazioni condizionali: la regola copiata si aggiunge sulla destinazione, a meno che ci sia già la stessa regola sulla stessa zona
    // (incollare due volte, o incollare su se stessi, non deve accumulare copie identiche). Le regole che la destinazione aveva restano, come i commenti.
    if (dati.conditionalFormats) {
      // come in Excel, sotto l'area incollata le regole che c'erano vengono sostituite da quelle copiate (anche se la sorgente non ne ha): si tolgono prima
      liberaZonaDalleRegole(dati.conditionalFormats, { startRow: area.startRow + dr, endRow: area.endRow + dr, startCol: area.startCol + dc, endCol: area.endCol + dc });
      for (const r of sopra.regole ?? []) {
        const zona = spostata(r.range, { area, foglioOrigine: '', foglioDestinazione, deltaRighe: dr, deltaColonne: dc });
        const nuova = { ...(JSON.parse(JSON.stringify(r)) as ConditionalFormatRule), id: nuovoIdRegola(), range: zona };
        // le formule con riferimenti relativi seguono lo spostamento della piastrella (A1 copiata 3 righe più sotto diventa A4)
        if (nuova.type === 'formula') nuova.value1 = formulaSpostata(nuova.value1, dr, dc) as typeof nuova.value1;
        const firma = senzaIdENzona(nuova);
        if (dati.conditionalFormats.some((x) => stessaArea(x.range, zona) && senzaIdENzona(x) === firma)) continue;
        dati.conditionalFormats.push(nuova);
      }
    }
    for (const c of sopra.commenti) commenti.set(chiaveCommento(foglioDestinazione, c.riga + dr, c.colonna + dc), { testo: c.testo, data: c.data });
    for (const v of sopra.convalide) dati.dataValidations.set(`${v.riga + dr}:${v.colonna + dc}`, JSON.parse(JSON.stringify(v.regola)) as DataValidationRule);
    for (const m of sopra.unioni) {
      const nuova = spostata(m, { area, foglioOrigine: '', foglioDestinazione, deltaRighe: dr, deltaColonne: dc });
      sostituisci(dati.merges, [...dati.merges.filter((x) => !siSovrappongono(x, nuova)), nuova]);
    }
  }
}

