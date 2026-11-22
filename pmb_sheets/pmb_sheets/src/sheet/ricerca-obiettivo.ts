/**
 * Ricerca obiettivo (come Dati › Analisi di simulazione › Ricerca obiettivo di Excel): trovare il valore x di una cella perché una
 * formula che ne dipende dia il risultato voluto. Si cerca dove g(x) = f(x) - obiettivo vale 0: prima il metodo delle secanti
 * partendo dal valore attuale; se non converge, si allarga un intervallo finché g cambia segno e si chiude con la bisezione.
 * Si ferma, come Excel, quando |g| ≤ 0,001 o dopo 100 passi di ogni metodo. Il calcolo di f lo dà chi chiama (in pmb_sheets: si scrive
 * x nella cella, si ricalcola e si legge la formula). Modulo puro.
 */
export interface EsitoRicerca { trovato: boolean; x: number; valore: number | null; passi: number }
export interface OpzioniRicerca { tolleranza?: number; passiMassimi?: number }

type Funzione = (x: number) => Promise<number | null>;

export async function ricercaObiettivo(f: Funzione, obiettivo: number, x0: number, o: OpzioniRicerca = {}): Promise<EsitoRicerca> {
  const tol = o.tolleranza ?? 0.001;
  const massimo = o.passiMassimi ?? 100;
  let passi = 0;
  const g = async (x: number): Promise<number | null> => {
    passi++;
    const v = await f(x);
    return v === null || !Number.isFinite(v) ? null : v - obiettivo;
  };
  let migliore: { x: number; g: number } | null = null;
  const tieni = (x: number, gx: number | null): void => { if (gx !== null && (!migliore || Math.abs(gx) < Math.abs(migliore.g))) migliore = { x, g: gx }; };
  const fine = async (x: number): Promise<EsitoRicerca> => {
    const v = await f(x);
    return { trovato: v !== null && Math.abs(v - obiettivo) <= tol, x, valore: v, passi };
  };

  // 1. secanti dal valore attuale e da uno vicino
  let a = Number.isFinite(x0) ? x0 : 0;
  let ga = await g(a);
  tieni(a, ga);
  if (ga !== null && Math.abs(ga) <= tol) return fine(a);
  let b = a !== 0 ? a * 1.01 : 0.01;
  let gb = await g(b);
  tieni(b, gb);
  for (let k = 0; k < massimo && ga !== null && gb !== null; k++) {
    if (Math.abs(gb) <= tol) return fine(b);
    if (gb === ga) break;
    const c = b - (gb * (b - a)) / (gb - ga);
    if (!Number.isFinite(c)) break;
    a = b; ga = gb;
    b = c; gb = await g(b);
    tieni(b, gb);
  }

  // 2. un intervallo dove g cambia segno, allargandolo attorno al valore di partenza, poi bisezione
  const centro = Number.isFinite(x0) ? x0 : 0;
  let passo = Math.max(1, Math.abs(centro));
  let sx: { x: number; g: number } | null = null;
  let dx: { x: number; g: number } | null = null;
  // il riferimento è il primo punto con un valore (la partenza può dare un errore, per esempio la radice di un negativo)
  const g0 = await g(centro);
  tieni(centro, g0);
  let rif: { x: number; g: number } | null = g0 !== null ? { x: centro, g: g0 } : null;
  for (let k = 0; k < 60 && !(sx && dx); k++, passo *= 2) {
    for (const x of [centro - passo, centro + passo]) {
      const gx = await g(x);
      tieni(x, gx);
      if (gx === null) continue;
      if (!rif) { rif = { x, g: gx }; continue; }
      if (Math.sign(gx) !== Math.sign(rif.g) || gx === 0) { sx = rif; dx = { x, g: gx }; break; }
    }
  }
  if (sx && dx) {
    let lo = sx, hi = dx;
    for (let k = 0; k < massimo; k++) {
      const m = (lo.x + hi.x) / 2;
      const gm = await g(m);
      if (gm === null) break;
      tieni(m, gm);
      if (Math.abs(gm) <= tol) return fine(m);
      if (Math.sign(gm) === Math.sign(lo.g)) lo = { x: m, g: gm }; else hi = { x: m, g: gm };
    }
  }
  const m = migliore as { x: number; g: number } | null;
  return fine(m ? m.x : centro);
}
