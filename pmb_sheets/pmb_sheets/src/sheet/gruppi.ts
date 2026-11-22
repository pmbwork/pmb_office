/**
 * Raggruppa e struttura (come Dati › Struttura › Raggruppa di Excel e LibreOffice): righe o colonne raggruppate su livelli da 1 a 7;
 * un gruppo si comprime (le sue righe o colonne si nascondono) e si espande. Ogni foglio ha i suoi livelli: riga (o colonna) → livello.
 * Nei file: .xlsx con outlineLevel su righe e colonne (e hidden per quelle compresse), .ods con table:table-row-group e
 * table:table-column-group annidati (table:display="false" per quelli compressi). Modulo puro.
 */
export const LIVELLO_MASSIMO = 7;

/** I livelli della struttura di un foglio (solo quelli > 0). */
export interface Gruppi { righe: Record<number, number>; colonne: Record<number, number> }

export function gruppiVuoti(): Gruppi { return { righe: {}, colonne: {} }; }
export function copiaGruppi(g: Gruppi | undefined): Gruppi | undefined {
  if (!g) return undefined;
  const c = { righe: { ...g.righe }, colonne: { ...g.colonne } };
  return Object.keys(c.righe).length + Object.keys(c.colonne).length > 0 ? c : undefined;
}
export function gruppiValidi(x: unknown): Gruppi | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const pulisci = (o: unknown, max: number): Record<number, number> => {
    const out: Record<number, number> = {};
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= max && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= LIVELLO_MASSIMO) out[n] = v as number;
    }
    return out;
  };
  return copiaGruppi({ righe: pulisci((x as Gruppi).righe, 1_048_576), colonne: pulisci((x as Gruppi).colonne, 16_384) });
}

type Asse = 'righe' | 'colonne';

/** Raggruppa (alza di un livello, al massimo 7) le righe o colonne da..a. */
export function raggruppa(g: Gruppi | undefined, asse: Asse, da: number, a: number): Gruppi {
  const n = copiaGruppi(g) ?? gruppiVuoti();
  for (let i = Math.min(da, a); i <= Math.max(da, a); i++) n[asse][i] = Math.min(LIVELLO_MASSIMO, (n[asse][i] ?? 0) + 1);
  return n;
}

/** Separa (abbassa di un livello) le righe o colonne da..a; false se nessuna era raggruppata. */
export function separa(g: Gruppi | undefined, asse: Asse, da: number, a: number): Gruppi | null {
  const n = copiaGruppi(g) ?? gruppiVuoti();
  let cambiato = false;
  for (let i = Math.min(da, a); i <= Math.max(da, a); i++) {
    const l = n[asse][i];
    if (!l) continue;
    cambiato = true;
    if (l <= 1) delete n[asse][i]; else n[asse][i] = l - 1;
  }
  return cambiato ? n : null;
}

/** Il gruppo più interno che contiene la riga (o colonna) i: da, a, livello; null se i non è raggruppata. */
export function gruppoDi(g: Gruppi | undefined, asse: Asse, i: number): { da: number; a: number; livello: number } | null {
  const l = g?.[asse][i];
  if (!g || !l) return null;
  let da = i, a = i;
  while ((g[asse][da - 1] ?? 0) >= l) da--;
  while ((g[asse][a + 1] ?? 0) >= l) a++;
  return { da, a, livello: l };
}

/** Tutti i gruppi di un livello (o più) come intervalli [da, a], dall'alto. Serve ai file .ods (gruppi annidati). */
export function intervalliDelLivello(g: Gruppi | undefined, asse: Asse, livello: number): Array<[number, number]> {
  if (!g) return [];
  const chiavi = Object.keys(g[asse]).map(Number).filter((k) => g[asse][k] >= livello).sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (const k of chiavi) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo[1] === k - 1) ultimo[1] = k; else out.push([k, k]);
  }
  return out;
}

/** Il livello più alto usato (per sheetFormatPr outlineLevelRow / outlineLevelCol di .xlsx). */
export function livelloMassimo(g: Gruppi | undefined, asse: Asse): number {
  return g ? Math.max(0, ...Object.values(g[asse])) : 0;
}
