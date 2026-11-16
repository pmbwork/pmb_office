// Controllo ortografico puro e dizionario personalizzato per pmb_docs.
// Include un vocabolario italiano fondamentale, verifica delle parole,
// algoritmo di suggerimento basato su distanza di Levenshtein e analisi del documento.

import { testoParagrafo, type Documento } from '../modello/documento';

export interface ErroreOrtografico {
  p: number;
  da: number;
  a: number;
  parola: string;
  suggerimenti: string[];
}

// Vocabolario italiano comune ad alta frequenza
const VOCABOLARIO_BASE: string[] = [
  'a', 'ad', 'agli', 'ai', 'al', 'all', 'alla', 'alle', 'allo', 'anche', 'ancora', 'anno',
  'aperto', 'aprire', 'avere', 'aveva', 'avevano', 'avuto', 'bene', 'bello', 'bella',
  'buono', 'buona', 'casa', 'caso', 'che', 'chi', 'ci', 'ciao', 'ciò', 'città', 'come',
  'con', 'contro', 'cosa', 'così', 'cui', 'da', 'dal', 'dall', 'dalla', 'dalle', 'dallo',
  'dare', 'dato', 'del', 'dell', 'della', 'delle', 'dello', 'dentro', 'deve', 'devono',
  'di', 'dice', 'dire', 'detto', 'dopo', 'dove', 'due', 'e', 'è', 'ed', 'era', 'erano',
  'essere', 'stato', 'stata', 'stati', 'state', 'fanno', 'fare', 'fatto', 'fatta', 'fine',
  'fino', 'fra', 'già', 'giorno', 'gli', 'grande', 'grandi', 'ha', 'hanno', 'ho', 'i',
  'il', 'in', 'indietro', 'insieme', 'invece', 'io', 'l', 'la', 'le', 'lei', 'loro', 'lui',
  'ma', 'mai', 'me', 'meglio', 'meno', 'mentre', 'mio', 'mia', 'miei', 'mie', 'molto',
  'molti', 'molta', 'molte', 'mondo', 'ne', 'negli', 'nei', 'nel', 'nell', 'nella', 'nelle',
  'nello', 'niente', 'no', 'noi', 'non', 'nostro', 'nostra', 'nostri', 'nostre', 'notte',
  'nuovo', 'nuova', 'nuovi', 'nuove', 'o', 'od', 'ogni', 'ora', 'oltre', 'padre', 'paese',
  'parola', 'parole', 'parte', 'parti', 'per', 'perché', 'però', 'persona', 'persone',
  'più', 'poco', 'pochi', 'poca', 'poche', 'poi', 'possono', 'potere', 'potuto', 'presto',
  'prima', 'primo', 'primi', 'prime', 'proprio', 'pure', 'quale', 'quali', 'quando',
  'quanto', 'quanta', 'quanti', 'quante', 'quasi', 'quello', 'quella', 'quelli', 'quelle',
  'quel', 'questo', 'questa', 'questi', 'queste', 'qui', 'quindi', 'sa', 'sarà', 'saranno',
  'se', 'secondo', 'sei', 'sempre', 'senza', 'si', 'sì', 'sia', 'siamo', 'siete', 'sono',
  'sopra', 'sotto', 'spesso', 'stesso', 'stessa', 'stessi', 'stesse', 'su', 'sul', 'sull',
  'sulla', 'sulle', 'sullo', 'suo', 'sua', 'suoi', 'sue', 'tanto', 'tanta', 'tanti', 'tante',
  'tempo', 'tra', 'tre', 'tu', 'tuo', 'tua', 'tuoi', 'tue', 'tutto', 'tutta', 'tutti',
  'tutte', 'un', 'una', 'uno', 'un\'altra', 'un\'altro', 'uomo', 'uomini', 'va', 'vanno',
  'vedere', 'visto', 'venire', 'venuto', 'venuta', 'venuti', 'venute', 'vero', 'vera',
  'veri', 'vere', 'via', 'vita', 'voi', 'volere', 'voluto', 'volta', 'volte', 'vostro',
  'vostra', 'vostri', 'vostre',
  // Termini per testi d'ufficio e documentali
  'documento', 'documenti', 'ufficio', 'relazione', 'copia', 'versione', 'formato',
  'italiano', 'italiana', 'italiani', 'italiane',
  'testo', 'pagina', 'pagine', 'tabella', 'tabelle', 'immagine', 'immagini', 'stampa',
  'file', 'salva', 'salvato', 'apri', 'chiudi', 'modifica', 'inserisci', 'elimina',
  'grassetto', 'corsivo', 'sottolineato', 'allineamento', 'interlinea', 'margine', 'margini',
];

const SET_VOCABOLARIO = new Set(VOCABOLARIO_BASE.map((p) => p.toLowerCase()));

/** Calcola la distanza di modifica (Levenshtein) tra due stringhe. */
export function distanzaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let rigaPrec = new Array(n + 1);
  let rigaCorr = new Array(n + 1);

  for (let j = 0; j <= n; j++) rigaPrec[j] = j;

  for (let i = 1; i <= m; i++) {
    rigaCorr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const costo = ca === b.charCodeAt(j - 1) ? 0 : 1;
      rigaCorr[j] = Math.min(
        rigaPrec[j] + 1,       // cancellazione
        rigaCorr[j - 1] + 1,   // inserimento
        rigaPrec[j - 1] + costo // sostituzione
      );
    }
    const tmp = rigaPrec;
    rigaPrec = rigaCorr;
    rigaCorr = tmp;
  }

  return rigaPrec[n];
}

/** Pulisce e isola una parola rimuovendo la punteggiatura iniziale e finale. */
export function normalizzaParola(parola: string): string {
  return parola
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .toLowerCase();
}

/** Verifica se una parola è ortograficamente corretta. */
export function parolaCorretta(parola: string, dizionarioPersonale?: Set<string>): boolean {
  const p = normalizzaParola(parola);
  if (p === '') return true;
  // Numeri o codici alfanumerici non sono considerati errori
  if (/^\d+$/.test(p) || /^[0-9a-fA-F]+$/.test(p) && p.length > 5) return true;
  // Singoli caratteri non sono considerati errori
  if (p.length <= 1) return true;

  if (dizionarioPersonale && dizionarioPersonale.has(p)) return true;
  return SET_VOCABOLARIO.has(p);
}

/** Genera i migliori suggerimenti ortografici per una parola non corretta. */
export function suggerimentiOrtografici(
  parola: string,
  limite = 4,
  dizionarioPersonale?: Set<string>
): string[] {
  const target = normalizzaParola(parola);
  if (target === '') return [];

  const candidati: Array<{ parola: string; dist: number }> = [];

  const controllaLista = (set: Iterable<string>) => {
    for (const v of set) {
      if (Math.abs(v.length - target.length) > 2) continue;
      const dist = distanzaLevenshtein(target, v);
      if (dist <= 2) {
        candidati.push({ parola: v, dist });
      }
    }
  };

  controllaLista(SET_VOCABOLARIO);
  if (dizionarioPersonale) controllaLista(dizionarioPersonale);

  candidati.sort((a, b) => a.dist - b.dist);

  const unici = new Set<string>();
  const res: string[] = [];
  for (const c of candidati) {
    if (!unici.has(c.parola)) {
      unici.add(c.parola);
      res.push(c.parola);
      if (res.length >= limite) break;
    }
  }

  return res;
}

/** Analizza il documento e restituisce tutti gli errori ortografici con coordinate e suggerimenti. */
export function trovaErroriOrtografici(
  doc: Documento,
  dizionarioPersonale?: Set<string>
): ErroreOrtografico[] {
  const errori: ErroreOrtografico[] = [];

  doc.paragrafi.forEach((par, p) => {
    const testo = testoParagrafo(par);
    if (!testo.trim()) return;

    // Espressione regolare per identificare le parole e i loro offset
    const regex = /[a-zA-ZàèéìòùÀÈÉÌÒÙ0-9']+/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(testo)) !== null) {
      const raw = match[0];
      const da = match.index;
      const a = da + raw.length;
      const pNorm = normalizzaParola(raw);

      if (pNorm && !parolaCorretta(pNorm, dizionarioPersonale)) {
        errori.push({
          p,
          da,
          a,
          parola: raw,
          suggerimenti: suggerimentiOrtografici(pNorm, 3, dizionarioPersonale),
        });
      }
    }
  });

  return errori;
}
