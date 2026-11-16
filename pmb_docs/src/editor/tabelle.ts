// Tabelle di pmb_docs: inserire una tabella, aggiungere e togliere righe e colonne, e le regole ai bordi delle celle. Tutto puro.
// Una tabella è una serie di paragrafi contigui con l'attributo tb { i: numero della tabella, r: riga, c: colonna } in ordine
// riga per riga; una cella può avere più paragrafi. Dopo una tabella c'è sempre un paragrafo normale, per poterne uscire.
import {
  cancellaSelezione, collassata, conParagrafi, cursore, estraiTesto, ordina, stessaCella, testoParagrafo,
  type CellaTabella, type Documento, type Paragrafo, type Posizione, type Stato,
} from '../modello/documento';

export const RIGHE_MASSIME = 50;
export const COLONNE_MASSIME = 20;

export type OperazioneTabella = 'rigaSopra' | 'rigaSotto' | 'colonnaPrima' | 'colonnaDopo' | 'eliminaRiga' | 'eliminaColonna' | 'eliminaTabella';

/** La tabella letta dal documento: celle[riga][colonna] = i paragrafi della cella. */
export interface Tabella { i: number; da: number; a: number; righe: number; colonne: number; celle: Paragrafo[][][] }

export function tabellaAl(doc: Documento, p: number): Tabella | null {
  const tb = doc.paragrafi[p]?.tb;
  if (!tb) return null;
  let da = p;
  while (da > 0 && doc.paragrafi[da - 1].tb?.i === tb.i) da--;
  let a = p;
  while (a < doc.paragrafi.length - 1 && doc.paragrafi[a + 1].tb?.i === tb.i) a++;
  const celle: Paragrafo[][][] = [];
  for (let k = da; k <= a; k++) {
    const { r, c } = doc.paragrafi[k].tb as CellaTabella;
    (celle[r] ??= [])[c] ??= [];
    celle[r][c].push(doc.paragrafi[k]);
  }
  return { i: tb.i, da, a, righe: celle.length, colonne: celle[0].length, celle };
}

function senzaCella(par: Paragrafo): Paragrafo { const { tb, ...resto } = par; void tb; return resto; }

/** I paragrafi della tabella, in ordine, con tb aggiornato. */
function appiattisci(i: number, celle: Paragrafo[][][]): Paragrafo[] {
  const out: Paragrafo[] = [];
  celle.forEach((riga, r) => riga.forEach((cella, c) => cella.forEach((par) => out.push({ ...senzaCella(par), tb: { i, r, c } }))));
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

export function modificaTabella(stato: Stato, op: OperazioneTabella): Stato {
  const [c] = ordina(stato.doc, stato.sel);
  const t = tabellaAl(stato.doc, c.p);
  if (!t) return stato;
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
  if (op === 'eliminaTabella') return eliminaTutta();
  let celle = t.celle.map((riga) => riga.map((cella) => cella));
  let r = r0;
  let col = c0;
  if (op === 'rigaSopra' || op === 'rigaSotto') {
    const dove = op === 'rigaSopra' ? r0 : r0 + 1;
    celle = [...celle.slice(0, dove), Array.from({ length: t.colonne }, cellaVuota), ...celle.slice(dove)];
    if (op === 'rigaSopra') r = r0 + 1;
  } else if (op === 'colonnaPrima' || op === 'colonnaDopo') {
    const dove = op === 'colonnaPrima' ? c0 : c0 + 1;
    celle = celle.map((riga) => [...riga.slice(0, dove), cellaVuota(), ...riga.slice(dove)]);
    if (op === 'colonnaPrima') col = c0 + 1;
  } else if (op === 'eliminaRiga') {
    if (t.righe === 1) return eliminaTutta();
    celle = celle.filter((_, i) => i !== r0);
    r = Math.min(r0, celle.length - 1);
    return ricostruisci(stato.doc, t, prima, dopo, celle, r, col, 0, 0);
  } else {
    if (t.colonne === 1) return eliminaTutta();
    celle = celle.map((riga) => riga.filter((_, i) => i !== c0));
    col = Math.min(c0, celle[0].length - 1);
    return ricostruisci(stato.doc, t, prima, dopo, celle, r, col, 0, 0);
  }
  return ricostruisci(stato.doc, t, prima, dopo, celle, r, col, k, c.o);
}

function ricostruisci(base: Documento, t: Tabella, prima: Paragrafo[], dopo: Paragrafo[], celle: Paragrafo[][][], r: number, c: number, k: number, o: number): Stato {
  const paragrafi = [...prima, ...appiattisci(t.i, celle), ...dopo];
  const doc: Documento = conParagrafi(base, paragrafi);
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

function vaiAllaCella(stato: Stato, i: number, r: number, c: number): Stato {
  const p = trovaCella(stato.doc, i, r, c) as number;
  return { ...stato, sel: cursore(p, 0), pendenti: null };
}

/** Tab e Maiusc+Tab: il cursore va all'inizio della cella dopo o prima; nell'ultima cella Tab aggiunge una riga. Fuori da una tabella, o nella prima cella indietro, restituisce lo stato identico. */
export function cellaVicina(stato: Stato, indietro: boolean): Stato {
  const [p0] = ordina(stato.doc, stato.sel);
  const tb = stato.doc.paragrafi[p0.p].tb;
  if (!tb) return stato;
  const t = tabellaAl(stato.doc, p0.p) as Tabella;
  if (indietro) {
    if (tb.c > 0) return vaiAllaCella(stato, tb.i, tb.r, tb.c - 1);
    if (tb.r > 0) return vaiAllaCella(stato, tb.i, tb.r - 1, t.colonne - 1);
    return stato;
  }
  if (tb.c < t.colonne - 1) return vaiAllaCella(stato, tb.i, tb.r, tb.c + 1);
  if (tb.r < t.righe - 1) return vaiAllaCella(stato, tb.i, tb.r + 1, 0);
  return vaiAllaCella(modificaTabella(stato, 'rigaSotto'), tb.i, tb.r + 1, 0);
}
