// Tabelle di pmb_docs: inserire una tabella, aggiungere e togliere righe e colonne, unire e dividere celle, la riga di intestazione,
// l'ordinamento delle righe e le regole ai bordi delle celle. Tutto puro.
// Una tabella è una serie di paragrafi contigui con l'attributo tb { i: numero della tabella, r: riga, c: colonna } in ordine
// riga per riga; una cella può avere più paragrafi. Dopo una tabella c'è sempre un paragrafo normale, per poterne uscire.
// Le celle unite e la riga di intestazione sono descritte in modello/unioni.ts: le celle coperte da un'unione restano nella tabella
// (un paragrafo vuoto) ma non si vedono, e il cursore non ci entra mai (vedi fuoriDalleCoperte).
import {
  cancellaSelezione, collassata, conParagrafi, cursore, estraiTesto, ordina, stessaCella, testoParagrafo,
  type CellaTabella, type Documento, type Paragrafo, type Posizione, type Stato,
} from '../modello/documento';
import {
  ancoraDi, cellaCon, eliminaRigaUnioni, inserisciRigaUnioni, trasponiUnioni, UNIONE_SEMPLICE, unioneDi, type Unione,
} from '../modello/unioni';

export const RIGHE_MASSIME = 50;
export const COLONNE_MASSIME = 20;

export type OperazioneTabella = 'rigaSopra' | 'rigaSotto' | 'colonnaPrima' | 'colonnaDopo' | 'eliminaRiga' | 'eliminaColonna' | 'eliminaTabella'
  | 'unisciCelle' | 'dividiCella' | 'intestazione' | 'ordinaCrescente' | 'ordinaDecrescente';

/** La tabella letta dal documento: celle[riga][colonna] = i paragrafi della cella, unioni[riga][colonna] = com'è fatta la cella. */
export interface Tabella { i: number; da: number; a: number; righe: number; colonne: number; celle: Paragrafo[][][]; unioni: Unione[][] }

export function tabellaAl(doc: Documento, p: number): Tabella | null {
  const tb = doc.paragrafi[p]?.tb;
  if (!tb) return null;
  let da = p;
  while (da > 0 && doc.paragrafi[da - 1].tb?.i === tb.i) da--;
  let a = p;
  while (a < doc.paragrafi.length - 1 && doc.paragrafi[a + 1].tb?.i === tb.i) a++;
  const celle: Paragrafo[][][] = [];
  const unioni: Unione[][] = [];
  for (let k = da; k <= a; k++) {
    const x = doc.paragrafi[k].tb as CellaTabella;
    (celle[x.r] ??= [])[x.c] ??= [];
    celle[x.r][x.c].push(doc.paragrafi[k]);
    (unioni[x.r] ??= [])[x.c] ??= unioneDi(x);
  }
  return { i: tb.i, da, a, righe: celle.length, colonne: celle[0].length, celle, unioni };
}

function senzaCella(par: Paragrafo): Paragrafo { const { tb, ...resto } = par; void tb; return resto; }

/** I paragrafi della tabella, in ordine, con tb aggiornato. */
function appiattisci(i: number, celle: Paragrafo[][][], unioni?: Unione[][]): Paragrafo[] {
  const out: Paragrafo[] = [];
  celle.forEach((riga, r) => riga.forEach((cella, c) => {
    const u = unioni?.[r]?.[c] ?? UNIONE_SEMPLICE();
    const tb = cellaCon(i, r, c, u);
    // una cella coperta resta un paragrafo vuoto
    if (u.co) { out.push({ runs: [], tb }); return; }
    cella.forEach((par) => out.push({ ...senzaCella(par), tb: { ...tb } }));
  }));
  return out;
}

/** Posizione (all'inizio) del paragrafo k della cella (r, c) della tabella i, o null se non c'è. */
function trovaCella(doc: Documento, i: number, r: number, c: number, k = 0): number | null {
  let visti = 0;
  for (let p = 0; p < doc.paragrafi.length; p++) {
    const tb = doc.paragrafi[p].tb;
    if (tb && tb.i === i && tb.r === r && tb.c === c) { if (visti === k) return p; visti++; }
  }
  return null;
}

function cellaVuota(): Paragrafo[] { return [{ runs: [] }]; }

export function inserisciTabella(stato: Stato, righe: number, colonne: number): Stato {
  if (!Number.isInteger(righe) || !Number.isInteger(colonne) || righe < 1 || colonne < 1 || righe > RIGHE_MASSIME || colonne > COLONNE_MASSIME) return stato;
  const [c] = ordina(stato.doc, stato.sel);
  if (stato.doc.paragrafi[c.p].tb) return stato;
  const id = stato.doc.paragrafi.reduce((m, p) => Math.max(m, (p.tb?.i ?? -1) + 1), 0);
  const celle = Array.from({ length: righe }, () => Array.from({ length: colonne }, cellaVuota));
  const nuovi = appiattisci(id, celle);
  const dopo = stato.doc.paragrafi[c.p + 1];
  if (!dopo || dopo.tb) nuovi.push({ runs: [] });
  const paragrafi = [...stato.doc.paragrafi.slice(0, c.p + 1), ...nuovi, ...stato.doc.paragrafi.slice(c.p + 1)];
  return { doc: conParagrafi(stato.doc, paragrafi), sel: cursore(c.p + 1, 0), pendenti: null };
}

/** Le celle (riga e colonna) di inizio e fine della selezione, se stanno nella stessa tabella. */
function celleSelezione(stato: Stato): { t: Tabella; a: CellaTabella; b: CellaTabella } | null {
  const [i, f] = ordina(stato.doc, stato.sel);
  const a = stato.doc.paragrafi[i.p].tb;
  const b = stato.doc.paragrafi[f.p].tb;
  if (!a || !b || a.i !== b.i) return null;
  return { t: tabellaAl(stato.doc, i.p) as Tabella, a, b };
}

/** Il rettangolo più piccolo che contiene le due celle e tutte le celle unite che tocca. */
function rettangolo(g: Unione[][], a: CellaTabella, b: CellaTabella): [number, number, number, number] {
  let r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r), c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
  for (let cambiato = true; cambiato;) {
    cambiato = false;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const an = ancoraDi(g, r, c);
        if (!an) continue;
        const u = g[an[0]][an[1]];
        const [nr1, nc1, nr2, nc2] = [Math.min(r1, an[0]), Math.min(c1, an[1]), Math.max(r2, an[0] + u.rs - 1), Math.max(c2, an[1] + u.cs - 1)];
        if (nr1 !== r1 || nc1 !== c1 || nr2 !== r2 || nc2 !== c2) { [r1, c1, r2, c2] = [nr1, nc1, nr2, nc2]; cambiato = true; }
      }
    }
  }
  return [r1, c1, r2, c2];
}

/** Il motivo per cui l'operazione non si può fare dove sta il cursore, o null se si può. */
export function motivoTabella(stato: Stato, op: OperazioneTabella): string | null {
  const [c] = ordina(stato.doc, stato.sel);
  const t = tabellaAl(stato.doc, c.p);
  if (!t) return 'Metti il cursore in una tabella';
  const tb = stato.doc.paragrafi[c.p].tb as CellaTabella;
  if (op === 'unisciCelle') {
    const s = celleSelezione(stato);
    if (!s || stessaCella(s.a, s.b)) return 'Seleziona due o più celle della stessa tabella da unire';
    return null;
  }
  if (op === 'dividiCella') {
    const an = ancoraDi(t.unioni, tb.r, tb.c);
    const u = an ? t.unioni[an[0]][an[1]] : null;
    return u && (u.cs > 1 || u.rs > 1) ? null : 'La cella del cursore non è una cella unita';
  }
  if (op === 'ordinaCrescente' || op === 'ordinaDecrescente') {
    const prima = primaRigaDati(t);
    if (t.righe - prima < 2) return 'Non ci sono righe da ordinare';
    if (t.unioni.slice(prima).some((riga) => riga.some((u) => u.rs > 1))) return 'Non si possono ordinare righe con celle unite in verticale';
    if (t.unioni[prima].some((u, k) => u.co && (ancoraDi(t.unioni, prima, k) as [number, number])[0] < prima)) return 'Non si possono ordinare righe con celle unite in verticale';
    const sequenza = ordineRighe(t, tb.c, op === 'ordinaDecrescente');
    if (sequenza.every((r, q) => r === q)) return 'Le righe sono già in ordine';
    return null;
  }
  return null;
}

function primaRigaDati(t: Tabella): number {
  let r = 0;
  while (r < t.righe && t.unioni[r][0].h) r++;
  return r;
}

export function modificaTabella(stato: Stato, op: OperazioneTabella): Stato {
  const [c] = ordina(stato.doc, stato.sel);
  const t = tabellaAl(stato.doc, c.p);
  if (!t) return stato;
  if (motivoTabella(stato, op) !== null) return stato;
  const { r: r0, c: c0 } = stato.doc.paragrafi[c.p].tb as CellaTabella;
  const primo = trovaCella(stato.doc, t.i, r0, c0) as number;
  const k = c.p - primo;
  const fuori = (paragrafi: Paragrafo[], pos: Posizione): Stato => ({ doc: conParagrafi(stato.doc, paragrafi), sel: { ancora: pos, fuoco: pos }, pendenti: null });
  const prima = stato.doc.paragrafi.slice(0, t.da);
  const dopo = stato.doc.paragrafi.slice(t.a + 1);
  const eliminaTutta = (): Stato => {
    const paragrafi = [...prima, ...dopo];
    if (paragrafi.length === 0) paragrafi.push({ runs: [] });
    const p = Math.min(t.da, paragrafi.length - 1);
    return fuori(paragrafi, { p, o: 0 });
  };
  const rifai = (celle: Paragrafo[][][], unioni: Unione[][], r: number, col: number, kk: number, o: number): Stato =>
    ricostruisci(stato.doc, t, prima, dopo, celle, unioni, r, col, kk, o);
  if (op === 'eliminaTabella') return eliminaTutta();
  if (op === 'unisciCelle') return unisci(stato, rifai);
  if (op === 'dividiCella') {
    const [ar, ac] = ancoraDi(t.unioni, r0, c0) as [number, number];
    const u = t.unioni[ar][ac];
    const unioni = t.unioni.map((riga) => riga.map((x) => ({ ...x })));
    for (let rr = ar; rr < ar + u.rs; rr++) for (let cc = ac; cc < ac + u.cs; cc++) unioni[rr][cc] = { cs: 1, rs: 1, co: false, h: unioni[rr][cc].h };
    return rifai(t.celle, unioni, ar, ac, k, c.o);
  }
  if (op === 'intestazione') {
    // la riga del cursore diventa intestazione con tutte quelle sopra; se lo è già, smettono di esserlo lei e quelle sotto
    const era = t.unioni[r0][0].h;
    const unioni = t.unioni.map((riga, r) => riga.map((x) => ({ ...x, h: era ? x.h && r < r0 : x.h || r <= r0 })));
    return rifai(t.celle, unioni, r0, c0, k, c.o);
  }
  if (op === 'ordinaCrescente' || op === 'ordinaDecrescente') return ordinaRighe(t, c0, op === 'ordinaDecrescente', rifai, r0, k, c.o);
  let celle = t.celle.map((riga) => riga.map((cella) => cella));
  let unioni = t.unioni;
  let r = r0;
  let col = c0;
  const intestazioni = t.unioni.map((riga) => riga[0].h);
  const conIntestazioni = (g: Unione[][], h: boolean[]): Unione[][] => g.map((riga, rr) => riga.map((x) => ({ ...x, h: h[rr] })));
  if (op === 'rigaSopra' || op === 'rigaSotto') {
    const dove = op === 'rigaSopra' ? r0 : r0 + (t.unioni[r0][c0].rs);
    celle = [...celle.slice(0, dove), Array.from({ length: t.colonne }, cellaVuota), ...celle.slice(dove)];
    unioni = inserisciRigaUnioni(unioni, dove);
    if (op === 'rigaSopra') r = r0 + 1;
  } else if (op === 'colonnaPrima' || op === 'colonnaDopo') {
    const dove = op === 'colonnaPrima' ? c0 : c0 + (t.unioni[r0][c0].cs);
    celle = celle.map((riga) => [...riga.slice(0, dove), cellaVuota(), ...riga.slice(dove)]);
    unioni = conIntestazioni(trasponiUnioni(inserisciRigaUnioni(trasponiUnioni(unioni), dove)), intestazioni);
    if (op === 'colonnaPrima') col = c0 + 1;
  } else if (op === 'eliminaRiga') {
    if (t.righe === 1) return eliminaTutta();
    // con una cella unita in verticale si tolgono tutte le righe che copre
    const quante = t.unioni[r0][c0].rs;
    if (quante >= t.righe) return eliminaTutta();
    for (let q = 0; q < quante; q++) { celle = celle.filter((_, i) => i !== r0); unioni = eliminaRigaUnioni(unioni, r0); }
    r = Math.min(r0, celle.length - 1);
    return rifai(celle, unioni, r, Math.min(col, t.colonne - 1), 0, 0);
  } else {
    if (t.colonne === 1) return eliminaTutta();
    const quante = t.unioni[r0][c0].cs;
    if (quante >= t.colonne) return eliminaTutta();
    for (let q = 0; q < quante; q++) {
      celle = celle.map((riga) => riga.filter((_, i) => i !== c0));
      unioni = conIntestazioni(trasponiUnioni(eliminaRigaUnioni(trasponiUnioni(unioni), c0)), intestazioni);
    }
    col = Math.min(c0, celle[0].length - 1);
    return rifai(celle, unioni, r, col, 0, 0);
  }
  return rifai(celle, unioni, r, col, k, c.o);
}

type Rifai = (celle: Paragrafo[][][], unioni: Unione[][], r: number, c: number, k: number, o: number) => Stato;

/** Unisce le celle selezionate (allargate alle unioni che toccano): il contenuto di tutte va nella prima, in ordine di lettura, senza i paragrafi vuoti. */
function unisci(stato: Stato, rifai: Rifai): Stato {
  const s = celleSelezione(stato) as { t: Tabella; a: CellaTabella; b: CellaTabella };
  const { t } = s;
  const [r1, c1, r2, c2] = rettangolo(t.unioni, s.a, s.b);
  const celle = t.celle.map((riga) => riga.map((cella) => cella));
  const unioni = t.unioni.map((riga) => riga.map((x) => ({ ...x })));
  const contenuto: Paragrafo[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (!t.unioni[r][c].co) contenuto.push(...t.celle[r][c].filter((p) => testoParagrafo(p) !== ''));
      celle[r][c] = cellaVuota();
      unioni[r][c] = { cs: 1, rs: 1, co: true, h: unioni[r][c].h };
    }
  }
  celle[r1][c1] = contenuto.length > 0 ? contenuto : cellaVuota();
  unioni[r1][c1] = { cs: c2 - c1 + 1, rs: r2 - r1 + 1, co: false, h: unioni[r1][c1].h };
  return rifai(celle, unioni, r1, c1, 0, 0);
}

/** Chiave di ordinamento di una cella: un numero se il testo è un numero (anche con la virgola), altrimenti il testo. */
function chiave(paragrafi: Paragrafo[]): number | string {
  const testo = paragrafi.map(testoParagrafo).join('\n').trim();
  const numero = testo.replace(/\s/g, '');
  if (/^[-+]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(numero)) return Number(numero.replace(/\./g, '').replace(',', '.'));
  if (/^[-+]?\d*\.\d+$/.test(numero)) return Number(numero);
  return testo;
}

const COLLATORE = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** L'ordine delle righe dopo l'ordinamento secondo la colonna c (dove la cella è coperta in orizzontale conta l'ancora della riga):
 *  le righe di intestazione restano in cima; prima i numeri, poi i testi; le celle vuote sempre in fondo; a parità resta l'ordine di prima. */
function ordineRighe(t: Tabella, c: number, decrescente: boolean): number[] {
  const da = primaRigaDati(t);
  const valore = (r: number): number | string => {
    const an = ancoraDi(t.unioni, r, c) as [number, number];
    return chiave(t.celle[an[0]][an[1]]);
  };
  const indici = Array.from({ length: t.righe - da }, (_, q) => da + q);
  const chiavi = new Map(indici.map((r) => [r, valore(r)]));
  const confronta = (x: number, y: number): number => {
    const a = chiavi.get(x) as number | string;
    const b = chiavi.get(y) as number | string;
    const va = a === '', vb = b === '';
    if (va || vb) return va === vb ? 0 : va ? 1 : -1;
    let d: number;
    if (typeof a === 'number' && typeof b === 'number') d = a - b;
    else if (typeof a === 'number') d = -1;
    else if (typeof b === 'number') d = 1;
    else d = COLLATORE.compare(a, b);
    return decrescente ? -d : d;
  };
  return [...Array.from({ length: da }, (_, q) => q), ...[...indici].sort((x, y) => confronta(x, y) || x - y)];
}

function ordinaRighe(t: Tabella, c: number, decrescente: boolean, rifai: Rifai, r0: number, k: number, o: number): Stato {
  const sequenza = ordineRighe(t, c, decrescente);
  const celle = sequenza.map((r) => t.celle[r]);
  const unioni = sequenza.map((r) => t.unioni[r].map((x) => ({ ...x })));
  return rifai(celle, unioni, sequenza.indexOf(r0), c, k, o);
}

function ricostruisci(base: Documento, t: Tabella, prima: Paragrafo[], dopo: Paragrafo[], celle: Paragrafo[][][], unioni: Unione[][], r: number, c: number, k: number, o: number): Stato {
  const paragrafi = [...prima, ...appiattisci(t.i, celle, unioni), ...dopo];
  const doc: Documento = conParagrafi(base, paragrafi);
  // se la cella di arrivo è coperta, si va nella sua ancora
  const an = ancoraDi(unioni, r, c) ?? [r, c];
  if (an[0] !== r || an[1] !== c) { [r, c] = an; k = 0; o = 0; }
  const p = trovaCella(doc, t.i, r, c, k) ?? (trovaCella(doc, t.i, r, c) as number);
  const lunghezza = testoParagrafo(paragrafi[p]).length;
  const pos = { p, o: Math.min(o, lunghezza) };
  return { doc, sel: { ancora: pos, fuoco: pos }, pendenti: null };
}

/** true se la selezione va da una cella a un'altra (o da un paragrafo normale a una cella). */
export function attraversaCelle(doc: Documento, sel: Stato['sel']): boolean {
  const [i, f] = ordina(doc, sel);
  return !stessaCella(doc.paragrafi[i.p].tb, doc.paragrafi[f.p].tb);
}

/** true se cancellare dal cursore unirebbe due celle diverse (o una cella e il testo fuori dalla tabella). */
export function cancellaSuConfine(doc: Documento, pos: Posizione, direzione: 'indietro' | 'avanti'): boolean {
  const par = doc.paragrafi[pos.p];
  if (direzione === 'indietro') {
    return pos.o === 0 && pos.p > 0 && !stessaCella(par.tb, doc.paragrafi[pos.p - 1].tb);
  }
  return pos.o === testoParagrafo(par).length && pos.p < doc.paragrafi.length - 1 && !stessaCella(par.tb, doc.paragrafi[pos.p + 1].tb);
}

/** Toglie il testo selezionato paragrafo per paragrafo, senza unire paragrafi di celle diverse. Il cursore va dove cominciava la selezione. */
export function svuotaSelezione(stato: Stato): Stato {
  if (collassata(stato.sel)) return stato;
  const [i, f] = ordina(stato.doc, stato.sel);
  let doc = stato.doc;
  for (let p = f.p; p >= i.p; p--) {
    const da = p === i.p ? i.o : 0;
    const a = p === f.p ? f.o : testoParagrafo(doc.paragrafi[p]).length;
    if (da < a) doc = cancellaSelezione({ doc, sel: { ancora: { p, o: da }, fuoco: { p, o: a } }, pendenti: null }).doc;
  }
  return { doc, sel: cursore(i.p, i.o), pendenti: null };
}

/** Il testo selezionato (serve a "taglia" prima di svuotare). */
export function testoSelezionato(stato: Stato): string { return estraiTesto(stato.doc, stato.sel); }

/** true se il cursore (o l'inizio della selezione) è dentro una tabella. */
export function inTabella(stato: Stato): boolean {
  return stato.doc.paragrafi[ordina(stato.doc, stato.sel)[0].p]?.tb !== undefined;
}

/** true se il cursore è in una riga di intestazione. */
export function inIntestazione(stato: Stato): boolean {
  return stato.doc.paragrafi[ordina(stato.doc, stato.sel)[0].p]?.tb?.h === true;
}

function vaiAllaCella(stato: Stato, i: number, r: number, c: number): Stato {
  const p = trovaCella(stato.doc, i, r, c) as number;
  return { ...stato, sel: cursore(p, 0), pendenti: null };
}

/** Tab e Maiusc+Tab: il cursore va all'inizio della cella dopo o prima (saltando quelle coperte da un'unione); nell'ultima cella Tab
 *  aggiunge una riga. Fuori da una tabella, o nella prima cella indietro, restituisce lo stato identico. */
export function cellaVicina(stato: Stato, indietro: boolean): Stato {
  const [p0] = ordina(stato.doc, stato.sel);
  const tb = stato.doc.paragrafi[p0.p].tb;
  if (!tb) return stato;
  const t = tabellaAl(stato.doc, p0.p) as Tabella;
  let r = tb.r;
  let c = tb.c;
  for (;;) {
    if (indietro) {
      if (c > 0) c--; else if (r > 0) { r--; c = t.colonne - 1; } else return stato;
    } else if (c < t.colonne - 1) c++;
    else if (r < t.righe - 1) { r++; c = 0; }
    else {
      const nuovo = modificaTabella({ ...stato, sel: cursore(p0.p, 0) }, 'rigaSotto');
      const u = tabellaAl(nuovo.doc, nuovo.sel.fuoco.p) as Tabella;
      return vaiAllaCella(nuovo, tb.i, u.righe - 1, 0);
    }
    if (!t.unioni[r][c].co) return vaiAllaCella(stato, tb.i, r, c);
  }
}

const coperta = (doc: Documento, p: number): boolean => doc.paragrafi[p]?.tb?.co === true;

/** Il cursore non sta mai in una cella coperta da un'unione (non si vede): se un'azione ce lo porta, va al primo paragrafo visibile
 *  nella direzione in cui si muoveva (avanti all'inizio, indietro alla fine). prima = la selezione prima dell'azione. */
export function fuoriDalleCoperte(stato: Stato, prima: Stato['sel']): Stato {
  const { doc, sel } = stato;
  if (!coperta(doc, sel.fuoco.p) && !coperta(doc, sel.ancora.p)) return stato;
  const sposta = (pos: Posizione, avanti: boolean): Posizione => {
    if (!coperta(doc, pos.p)) return pos;
    for (let p = pos.p; p >= 0 && p < doc.paragrafi.length; p += avanti ? 1 : -1) {
      if (!coperta(doc, p)) return { p, o: avanti ? 0 : testoParagrafo(doc.paragrafi[p]).length };
    }
    // in fondo (o in cima) al documento: si cerca dall'altra parte
    for (let p = pos.p; p >= 0 && p < doc.paragrafi.length; p += avanti ? -1 : 1) {
      if (!coperta(doc, p)) return { p, o: avanti ? testoParagrafo(doc.paragrafi[p]).length : 0 };
    }
    return pos;
  };
  const avanti = sel.fuoco.p > prima.fuoco.p || (sel.fuoco.p === prima.fuoco.p && sel.fuoco.o >= prima.fuoco.o);
  const fuoco = sposta(sel.fuoco, avanti);
  const ancora = collassata(sel) ? fuoco : sposta(sel.ancora, avanti);
  return { ...stato, sel: { ancora, fuoco } };
}
