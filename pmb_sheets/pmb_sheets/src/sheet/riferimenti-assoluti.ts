// F4 durante la scrittura di una formula: il riferimento sotto il cursore passa da A1 a $A$1, poi A$1, poi $A1, poi torna A1 (come in Excel e Fogli).
// Con il cursore su una parte che non è un riferimento, o dentro un testo tra virgolette, non cambia niente.

const RIFERIMENTO = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![\w(])/g;

/** Gli intervalli [da, a) dei testi tra virgolette della formula. */
function testiTraVirgolette(formula: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let inizio = -1;
  for (let i = 0; i < formula.length; i++) {
    if (formula[i] !== '"') continue;
    if (inizio < 0) inizio = i;
    else { out.push([inizio, i + 1]); inizio = -1; }
  }
  if (inizio >= 0) out.push([inizio, formula.length]);
  return out;
}

/** Il passo successivo del ciclo: A1 → $A$1 → A$1 → $A1 → A1. */
function prossimo(colAbs: boolean, rigaAbs: boolean): { colAbs: boolean; rigaAbs: boolean } {
  if (!colAbs && !rigaAbs) return { colAbs: true, rigaAbs: true };
  if (colAbs && rigaAbs) return { colAbs: false, rigaAbs: true };
  if (!colAbs && rigaAbs) return { colAbs: true, rigaAbs: false };
  return { colAbs: false, rigaAbs: false };
}

/**
 * Cambia il tipo di riferimento (relativo o assoluto) di quello che contiene la posizione `cursore`, o che finisce proprio lì.
 * Restituisce la formula nuova e dove mettere il cursore (alla fine del riferimento); null se lì non c'è un riferimento.
 * Per un intervallo (A1:B2) cambia solo l'estremo sotto il cursore.
 */
export function cambiaRiferimento(formula: string, cursore: number): { formula: string; cursore: number } | null {
  if (!formula.startsWith('=')) return null;
  const virgolette = testiTraVirgolette(formula);
  RIFERIMENTO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RIFERIMENTO.exec(formula)) !== null) {
    const da = m.index;
    const a = da + m[0].length;
    if (cursore < da || cursore > a) continue;
    if (virgolette.some(([x, y]) => da >= x && da < y)) continue;
    // una lettera attaccata davanti (nome di funzione o di foglio) non è un riferimento: "LOG10" si legge come funzione, non come LOG10 cella
    if (da > 0 && /[A-Za-z_]/.test(formula[da - 1])) continue;
    const { colAbs, rigaAbs } = prossimo(m[1] === '$', m[3] === '$');
    const nuovo = `${colAbs ? '$' : ''}${m[2]}${rigaAbs ? '$' : ''}${m[4]}`;
    return { formula: formula.slice(0, da) + nuovo + formula.slice(a), cursore: da + nuovo.length };
  }
  return null;
}
