import { t } from '../i18n/lingua';
// Equazioni: si scrivono in una notazione simile a LaTeX (\frac{a}{b}, \sqrt{x}, x^{2}, x_{i}, \sum_{i=1}^{n}, lettere greche e simboli) e si
// compongono su un canvas, per metterle nel documento come immagine. Qui c'è il lettore della notazione e la composizione (testabile senza canvas).

export type Nodo =
  | { t: 'testo'; v: string; stile: 'corsivo' | 'dritto' | 'operatore' }
  | { t: 'riga'; figli: Nodo[] }
  | { t: 'frazione'; num: Nodo; den: Nodo }
  | { t: 'radice'; arg: Nodo; indice?: Nodo }
  | { t: 'apice'; base: Nodo; sup?: Nodo; sub?: Nodo }
  | { t: 'grande'; simbolo: string; sub?: Nodo; sup?: Nodo };

export class ErroreEquazione extends Error {}

const SIMBOLI: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', leq: '≤', geq: '≥', neq: '≠', approx: '≈', equiv: '≡', infty: '∞', partial: '∂', nabla: '∇', to: '→', leftarrow: '←', Rightarrow: '⇒',
  Leftrightarrow: '⇔', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃', degree: '°', ldots: '…', angle: '∠', perp: '⊥', parallel: '∥', propto: '∝',
};
const GRANDI: Record<string, string> = { sum: '∑', prod: '∏', int: '∫', oint: '∮' };
const FUNZIONI = new Set(['sin', 'cos', 'tan', 'cot', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'sec', 'csc', 'arcsin', 'arccos', 'arctan']);
export const LUNGHEZZA_MASSIMA = 400;
const PROFONDITA_MASSIMA = 12;

/** Legge la notazione e dà l'albero dell'equazione; lancia ErroreEquazione se è scritta male (parentesi graffe non chiuse, comando sconosciuto...). */
export function leggiEquazione(src: string): Nodo {
  if (src.length > LUNGHEZZA_MASSIMA) throw new ErroreEquazione(t('L\'equazione è troppo lunga (al massimo {} caratteri)', LUNGHEZZA_MASSIMA));
  let i = 0;
  const fine = (): boolean => i >= src.length;
  const spazi = (): void => { while (!fine() && /\s/.test(src[i])) i++; };

  function gruppo(prof: number): Nodo {
    spazi();
    if (src[i] === '{') { i++; const r = riga(prof + 1, '}'); if (src[i] !== '}') throw new ErroreEquazione(t('Manca una parentesi graffa } di chiusura')); i++; return r; }
    const a = atomo(prof + 1);
    if (a === null) throw new ErroreEquazione(t('Manca un argomento: scrivilo tra graffe, per esempio \\frac{a}{b} o x^{2}'));
    return a;
  }

  function comando(prof: number): Nodo {
    i++; // la barra
    let nome = '';
    if (!fine() && /[A-Za-z]/.test(src[i])) { while (!fine() && /[A-Za-z]/.test(src[i])) nome += src[i++]; }
    else if (!fine()) { nome = src[i++]; }
    if (nome === 'frac') { const num = gruppo(prof); const den = gruppo(prof); return { t: 'frazione', num, den }; }
    if (nome === 'sqrt') {
      spazi();
      let indice: Nodo | undefined;
      if (src[i] === '[') { i++; const j = src.indexOf(']', i); if (j < 0) throw new ErroreEquazione(t('Manca la parentesi quadra ] dell\'indice della radice')); indice = leggiEquazione(src.slice(i, j)); i = j + 1; }
      return { t: 'radice', arg: gruppo(prof), indice };
    }
    if (GRANDI[nome]) return { t: 'grande', simbolo: GRANDI[nome] };
    if (SIMBOLI[nome]) return { t: 'testo', v: SIMBOLI[nome], stile: 'dritto' };
    if (FUNZIONI.has(nome)) return { t: 'testo', v: nome, stile: 'operatore' };
    if (nome === ',' || nome === ';' || nome === ' ' || nome === 'quad') return { t: 'testo', v: nome === 'quad' ? ' ' : ' ', stile: 'dritto' };
    if (['{', '}', '\\', '%', '_', '^', '&', '#', '$'].includes(nome)) return { t: 'testo', v: nome, stile: 'dritto' };
    throw new ErroreEquazione(t('Comando sconosciuto: \\{}', nome));
  }

  function atomoSemplice(prof: number): Nodo | null {
    spazi();
    if (fine()) return null;
    const c = src[i];
    if (c === '}' || c === '^' || c === '_') return null;
    if (c === '\\') return comando(prof);
    if (c === '{') return gruppo(prof);
    i++;
    if (/[A-Za-z]/.test(c)) return { t: 'testo', v: c, stile: 'corsivo' };
    if (/[0-9.,]/.test(c)) return { t: 'testo', v: c, stile: 'dritto' };
    if ('+-=<>*/()[]|!:;\''.includes(c)) return { t: 'testo', v: c === '-' ? '−' : c === '*' ? '·' : c, stile: 'dritto' };
    return { t: 'testo', v: c, stile: 'dritto' };
  }

  function atomo(prof: number): Nodo | null {
    if (prof > PROFONDITA_MASSIMA) throw new ErroreEquazione(t('L\'equazione è annidata troppo in profondità'));
    let base = atomoSemplice(prof);
    if (base === null) return null;
    // apici e pedici (anche insieme, in qualunque ordine)
    let sup: Nodo | undefined; let sub: Nodo | undefined;
    for (;;) {
      spazi();
      if (src[i] === '^' && sup === undefined) { i++; sup = gruppo(prof); } else if (src[i] === '_' && sub === undefined) { i++; sub = gruppo(prof); } else break;
    }
    if (sup === undefined && sub === undefined) return base;
    if (base.t === 'grande') return { ...base, sub, sup };
    if (base.t === 'testo' && base.stile === 'operatore') return { t: 'apice', base, sub, sup };
    return { t: 'apice', base, sup, sub };
  }

  function riga(prof: number, chiusura?: string): Nodo {
    const figli: Nodo[] = [];
    for (;;) {
      spazi();
      if (fine() || (chiusura !== undefined && src[i] === chiusura)) break;
      if (src[i] === '}') throw new ErroreEquazione(t('Parentesi graffa } senza la { di apertura'));
      if (src[i] === '^' || src[i] === '_') throw new ErroreEquazione(t('Un apice o un pedice (^ _) ha bisogno di qualcosa prima'));
      const a = atomo(prof);
      if (a === null) break;
      figli.push(a);
    }
    return { t: 'riga', figli };
  }

  const r = riga(0);
  if (!fine()) throw new ErroreEquazione(t('Parentesi graffa } senza la { di apertura'));
  return r;
}

// ---- composizione ----
export type Misuratore = (testo: string, corpo: number, stile: 'corsivo' | 'dritto' | 'operatore') => number;
export interface Disegnatore {
  testo(v: string, x: number, y: number, corpo: number, stile: 'corsivo' | 'dritto' | 'operatore'): void;
  linea(x1: number, y1: number, x2: number, y2: number, spessore: number): void;
  percorso(punti: Array<[number, number]>, spessore: number): void;
}
/** Una casella composta: larghezza, quanto sale sopra la linea di base e quanto scende sotto; disegna con la linea di base a y. */
export interface Casella { w: number; su: number; giu: number; disegna(d: Disegnatore, x: number, y: number): void }

const ALTEZZA_X = 0.5; // altezza della linea della frazione sopra la linea di base, in corpi

export function componi(n: Nodo, corpo: number, misura: Misuratore): Casella {
  switch (n.t) {
    case 'testo': {
      const operatore = n.stile === 'operatore';
      const sp = /^[+−=<>≤≥≠≈±∓×÷→⇒⇔∈∉⊂≡∝]$/.test(n.v) ? corpo * 0.25 : 0;
      const w = misura(n.v, corpo, n.stile) + (operatore ? corpo * 0.15 : 0) + 2 * sp;
      return { w, su: corpo * 0.8, giu: corpo * 0.22, disegna: (d, x, y) => d.testo(n.v, x + sp, y, corpo, n.stile) };
    }
    case 'riga': {
      const parti = n.figli.map((f) => componi(f, corpo, misura));
      const w = parti.reduce((s, p) => s + p.w, 0);
      return {
        w, su: Math.max(corpo * 0.8, ...parti.map((p) => p.su)), giu: Math.max(corpo * 0.22, ...parti.map((p) => p.giu)),
        disegna: (d, x, y) => { let cx = x; for (const p of parti) { p.disegna(d, cx, y); cx += p.w; } },
      };
    }
    case 'frazione': {
      const num = componi(n.num, corpo * 0.9, misura); const den = componi(n.den, corpo * 0.9, misura);
      const w = Math.max(num.w, den.w) + corpo * 0.4;
      const asse = corpo * ALTEZZA_X; const sp = Math.max(1, corpo / 14); const vuoto = corpo * 0.18;
      return {
        w, su: asse + vuoto + num.giu + num.su, giu: Math.max(0, den.su + vuoto + den.giu - asse),
        disegna: (d, x, y) => {
          d.linea(x + corpo * 0.1, y - asse, x + w - corpo * 0.1, y - asse, sp);
          num.disegna(d, x + (w - num.w) / 2, y - asse - vuoto - num.giu);
          den.disegna(d, x + (w - den.w) / 2, y - asse + vuoto + den.su);
        },
      };
    }
    case 'radice': {
      const arg = componi(n.arg, corpo, misura);
      const indice = n.indice ? componi(n.indice, corpo * 0.6, misura) : null;
      const ant = corpo * 0.75; const sp = Math.max(1, corpo / 14);
      const alto = arg.su + corpo * 0.25; const basso = arg.giu;
      const inizio = indice ? Math.max(0, indice.w - ant * 0.5) : 0;
      return {
        w: inizio + ant + arg.w + corpo * 0.1, su: alto + sp, giu: basso,
        disegna: (d, x, y) => {
          const x0 = x + inizio;
          d.percorso([[x0, y - corpo * 0.25], [x0 + ant * 0.25, y - corpo * 0.35], [x0 + ant * 0.55, y + basso], [x0 + ant, y - alto]], sp);
          d.linea(x0 + ant, y - alto, x0 + ant + arg.w + corpo * 0.1, y - alto, sp);
          arg.disegna(d, x0 + ant + corpo * 0.05, y);
          if (indice) indice.disegna(d, x, y - alto * 0.45);
        },
      };
    }
    case 'apice': {
      const base = componi(n.base, corpo, misura);
      const sup = n.sup ? componi(n.sup, corpo * 0.7, misura) : null;
      const sub = n.sub ? componi(n.sub, corpo * 0.7, misura) : null;
      const salita = base.su * 0.55; const discesa = corpo * 0.2;
      const w = base.w + Math.max(sup?.w ?? 0, sub?.w ?? 0) + (sup || sub ? corpo * 0.05 : 0);
      return {
        w, su: Math.max(base.su, sup ? salita + sup.su : 0), giu: Math.max(base.giu, sub ? discesa + sub.giu : 0),
        disegna: (d, x, y) => {
          base.disegna(d, x, y);
          if (sup) sup.disegna(d, x + base.w + corpo * 0.05, y - salita);
          if (sub) sub.disegna(d, x + base.w + corpo * 0.05, y + discesa);
        },
      };
    }
    case 'grande': {
      const f = corpo * (n.simbolo === '∫' || n.simbolo === '∮' ? 1.5 : 1.3);
      const simbolo = misura(n.simbolo, f, 'dritto');
      const sup = n.sup ? componi(n.sup, corpo * 0.7, misura) : null;
      const sub = n.sub ? componi(n.sub, corpo * 0.7, misura) : null;
      const integrale = n.simbolo === '∫' || n.simbolo === '∮';
      // negli integrali i limiti stanno di fianco, in somme e prodotti sopra e sotto
      const w = integrale ? simbolo + Math.max(sup?.w ?? 0, sub?.w ?? 0) : Math.max(simbolo, sup?.w ?? 0, sub?.w ?? 0);
      const su = Math.max(f * 0.75, integrale ? (sup ? f * 0.55 + sup.su : 0) : f * 0.75 + (sup ? sup.su + sup.giu + 2 : 0));
      const giu = Math.max(f * 0.25, integrale ? (sub ? f * 0.3 + sub.giu : 0) : f * 0.25 + (sub ? sub.su + sub.giu + 2 : 0));
      return {
        w, su, giu,
        disegna: (d, x, y) => {
          if (integrale) {
            d.testo(n.simbolo, x, y + f * 0.2, f, 'dritto');
            if (sup) sup.disegna(d, x + simbolo, y - f * 0.55);
            if (sub) sub.disegna(d, x + simbolo * 0.6, y + f * 0.3);
          } else {
            d.testo(n.simbolo, x + (w - simbolo) / 2, y, f, 'dritto');
            if (sup) sup.disegna(d, x + (w - sup.w) / 2, y - f * 0.75 - sup.giu - 2);
            if (sub) sub.disegna(d, x + (w - sub.w) / 2, y + f * 0.25 + sub.su + 2);
          }
        },
      };
    }
  }
}

/** I modelli della palette: l'etichetta sul pulsante, il nome per chi usa uno screen reader e che cosa si scrive per ottenerlo. */
export const MODELLI_EQUAZIONE: Array<{ etichetta: string; nome: string; testo: string }> = [
  { etichetta: 'a/b', nome: 'Frazione', testo: '\\frac{a}{b}' }, { etichetta: '√', nome: 'Radice quadrata', testo: '\\sqrt{x}' }, { etichetta: 'ⁿ√', nome: 'Radice n-esima', testo: '\\sqrt[n]{x}' },
  { etichetta: 'xⁿ', nome: 'Potenza', testo: 'x^{n}' }, { etichetta: 'xₙ', nome: 'Pedice', testo: 'x_{n}' }, { etichetta: '∑', nome: 'Sommatoria', testo: '\\sum_{i=1}^{n} x_{i}' },
  { etichetta: '∏', nome: 'Produttoria', testo: '\\prod_{i=1}^{n} x_{i}' }, { etichetta: '∫', nome: 'Integrale', testo: '\\int_{a}^{b} f(x)\\,dx' },
  { etichetta: 'π', nome: 'Pi greco', testo: '\\pi' }, { etichetta: 'α', nome: 'Alfa', testo: '\\alpha' }, { etichetta: 'β', nome: 'Beta', testo: '\\beta' }, { etichetta: 'θ', nome: 'Teta', testo: '\\theta' },
  { etichetta: 'λ', nome: 'Lambda', testo: '\\lambda' }, { etichetta: 'Δ', nome: 'Delta maiuscolo', testo: '\\Delta' }, { etichetta: '±', nome: 'Più o meno', testo: '\\pm' },
  { etichetta: '≤', nome: 'Minore o uguale', testo: '\\leq' }, { etichetta: '≥', nome: 'Maggiore o uguale', testo: '\\geq' },
  { etichetta: '≠', nome: 'Diverso', testo: '\\neq' }, { etichetta: '≈', nome: 'Circa uguale', testo: '\\approx' }, { etichetta: '∞', nome: 'Infinito', testo: '\\infty' },
  { etichetta: '→', nome: 'Freccia a destra', testo: '\\to' }, { etichetta: '×', nome: 'Per (moltiplicazione)', testo: '\\times' },
];

// ---- canvas ----
/** Compone l'equazione su un canvas nuovo (sfondo trasparente) a risoluzione doppia e lo restituisce; null se il canvas non c'è. */
export function equazioneSuTela(src: string, corpo = 20, scala = 2): HTMLCanvasElement | null {
  const nodo = leggiEquazione(src);
  const tela = document.createElement('canvas');
  const prova = tela.getContext('2d');
  if (!prova) return null;
  const carattere = (c: number, s: 'corsivo' | 'dritto' | 'operatore'): string => `${s === 'corsivo' ? 'italic ' : ''}${Math.round(c * 100) / 100}px "Cambria Math", "Times New Roman", serif`;
  const misura: Misuratore = (t, c, s) => { prova.font = carattere(c, s); return prova.measureText(t).width; };
  const cas = componi(nodo, corpo, misura);
  const margine = 8;
  const w = Math.ceil(cas.w + 2 * margine); const h = Math.ceil(cas.su + cas.giu + 2 * margine);
  tela.width = w * scala; tela.height = h * scala;
  const ctx = tela.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(scala, scala);
  ctx.fillStyle = '#000000'; ctx.strokeStyle = '#000000'; ctx.textBaseline = 'alphabetic'; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  const d: Disegnatore = {
    testo: (v, x, y, c, s) => { ctx.font = carattere(c, s); ctx.fillText(v, x, y); },
    linea: (x1, y1, x2, y2, sp) => { ctx.lineWidth = sp; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    percorso: (punti, sp) => { ctx.lineWidth = sp; ctx.beginPath(); punti.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))); ctx.stroke(); },
  };
  cas.disegna(d, margine, margine + cas.su);
  return tela;
}
