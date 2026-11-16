// Dove stanno le righe sullo schermo quando alcune sono nascoste o hanno un'altezza diversa dalle altre.
// Le righe normali sono tutte alte uguale; poche eccezioni (nascoste = altezza 0, oppure altezza personalizzata) spostano tutte quelle sotto.
// Si tengono le eccezioni ordinate con le somme progressive degli scostamenti, così "dov'è la riga r" e "che riga c'è all'altezza y" costano un
// paio di ricerche binarie anche con milioni di righe. Le misure sono quelle del foglio (senza zoom). Modulo puro: niente DOM.

export class GeometriaRighe {
  /** altezza di una riga normale */
  readonly base: number;
  /** numero di righe del foglio */
  readonly max: number;
  private righe: number[] = [];
  /** somma[i] = somma degli scostamenti (altezza - base) delle prime i eccezioni; ha una voce in più */
  private somma: number[] = [0];
  private nascoste: number[] = [];

  constructor(base: number, max: number, altezze?: Map<number, number>, nascoste?: Iterable<number>) {
    this.base = base;
    this.max = max;
    const nasc = new Set<number>();
    for (const r of nascoste ?? []) if (Number.isInteger(r) && r >= 1 && r <= max) nasc.add(r);
    const eccezioni = new Map<number, number>();
    if (altezze) for (const [r, h] of altezze) if (Number.isInteger(r) && r >= 1 && r <= max && Number.isFinite(h) && h >= 0 && h !== base) eccezioni.set(r, h);
    for (const r of nasc) eccezioni.set(r, 0);
    this.righe = [...eccezioni.keys()].sort((a, b) => a - b);
    this.nascoste = this.righe.filter((r) => eccezioni.get(r) === 0);
    let s = 0;
    for (const r of this.righe) { s += (eccezioni.get(r) as number) - base; this.somma.push(s); }
    this.altezzeEccezioni = eccezioni;
  }
  private altezzeEccezioni: Map<number, number>;

  /** Vero se tutte le righe sono alte uguale e nessuna è nascosta. */
  get uniforme(): boolean { return this.righe.length === 0; }

  /** Quante eccezioni stanno prima della riga r (cioè hanno numero minore di r). */
  private prima(r: number): number {
    let lo = 0;
    let hi = this.righe.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.righe[m] < r) lo = m + 1; else hi = m;
    }
    return lo;
  }

  /** Altezza della riga r (0 se è nascosta). */
  altezza(r: number): number {
    return this.altezzeEccezioni.get(r) ?? this.base;
  }

  nascosta(r: number): boolean {
    return this.altezza(r) === 0;
  }

  /** Distanza dal bordo alto del foglio al bordo alto della riga r (r da 1; r = max + 1 dà l'altezza totale). */
  top(r: number): number {
    return (r - 1) * this.base + this.somma[this.prima(r)];
  }

  /** Altezza di tutte le righe del foglio. */
  totale(): number { return this.top(this.max + 1); }

  /** La riga che sta all'altezza y dal bordo alto: la prima il cui bordo basso supera y (le righe nascoste non hanno altezza e si saltano). */
  rigaDaY(y: number): number {
    if (y < 0) return 1;
    let lo = 1;
    let hi = this.max;
    while (lo < hi) {
      const m = Math.floor((lo + hi) / 2);
      if (this.top(m + 1) > y) hi = m; else lo = m + 1;
    }
    return lo;
  }

  /** La prima riga visibile da r in giù (r stessa se non è nascosta); salta di colpo un intero blocco di righe nascoste. */
  prossimaVisibile(r: number): number {
    let lo = 0;
    let hi = this.nascoste.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.nascoste[m] < r) lo = m + 1; else hi = m; }
    if (lo >= this.nascoste.length || this.nascoste[lo] !== r) return r;
    // fine del blocco di righe consecutive che comincia in `lo`
    let a = lo;
    let b = this.nascoste.length - 1;
    while (a < b) { const m = (a + b + 1) >> 1; if (this.nascoste[m] - this.nascoste[lo] === m - lo) a = m; else b = m - 1; }
    return this.nascoste[a] + 1;
  }

  /** Quante righe nascoste ci sono tra a e b (estremi compresi). */
  contaNascosteTra(a: number, b: number): number {
    if (b < a || this.nascoste.length === 0) return 0;
    const finoA = (x: number): number => {
      let lo = 0;
      let hi = this.nascoste.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (this.nascoste[m] <= x) lo = m + 1; else hi = m;
      }
      return lo;
    };
    return finoA(b) - finoA(a - 1);
  }
}
