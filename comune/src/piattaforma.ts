// Differenze tra Windows e Mac che l'interfaccia deve conoscere: quale tasto fa da "Ctrl" e come si scrivono le scorciatoie.
// Su Mac le scorciatoie dei programmi usano Cmd (⌘) al posto di Ctrl, e i menu le mostrano con i simboli del Mac (⇧⌘S).

let forzata: boolean | null = null;

/** Solo per i test: finge di essere (true) o di non essere (false) su un Mac; null torna a guardare il sistema vero. */
export function impostaMacPerProva(mac: boolean | null): void { forzata = mac; }

/** Vero se il programma gira su un Mac. */
export function suMac(): boolean {
  if (forzata !== null) return forzata;
  if (typeof navigator === 'undefined') return false;
  const dati = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const piattaforma = dati?.platform || navigator.platform || '';
  if (piattaforma) return /mac/i.test(piattaforma);
  return /Macintosh|Mac OS X/.test(navigator.userAgent || '');
}

/** Il tasto principale delle scorciatoie è premuto: Cmd su Mac, Ctrl su Windows. */
export function tastoPrimario(e: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return suMac() ? e.metaKey : e.ctrlKey;
}

// Simboli del Mac nell'ordine in cui il Mac li scrive: Control, Opzione, Maiuscole, Comando
const MODIFICATORI_MAC: Array<[RegExp, string]> = [
  [/^(Ctrl|Control)$/i, '⌘'],
  [/^(Alt|Opzione|Option)$/i, '⌥'],
  [/^(Maiusc|Shift)$/i, '⇧'],
];
const ORDINE_MAC = ['⌃', '⌥', '⇧', '⌘'];
const TASTI_MAC: Record<string, string> = { Invio: '↩', Enter: '↩', Canc: '⌦', Del: '⌦', Delete: '⌦', Esc: '⎋', Tab: '⇥', Backspace: '⌫' };

/** «Ctrl+Maiusc+S» scritto come lo scrive il Mac («⇧⌘S»). Su Windows restituisce la scritta com'è. */
export function scorciatoiaPerSistema(s: string): string {
  if (!suMac() || !s) return s;
  // più scorciatoie alternative («Ctrl+Y, Ctrl+Maiusc+Z») si convertono una per una
  return s.split(/(\s*,\s*|\s+o\s+|\s+or\s+)/).map((pezzo, i) => (i % 2 === 1 ? pezzo : convertiUna(pezzo))).join('');
}

// Una scorciatoia dentro una frase: uno o più modificatori seguiti da un tasto («Ctrl+Maiusc+S», «Ctrl+clic», «Ctrl+;», «Alt+F4»)
const IN_TESTO = /\b(?:(?:Ctrl|Alt|Maiusc|Shift)\+)+(?:F\d{1,2}\b|[A-Za-zÀ-ÿ]+|\+|[^\s,.)»"'])/g;

/** Le scorciatoie scritte in una frase («Grassetto (Ctrl+B)») convertite per il Mac («Grassetto (⌘B)»). Su Windows la frase resta com'è. */
export function scorciatoieNelTesto(testo: string): string {
  if (!suMac() || !testo || !/(Ctrl|Alt|Maiusc|Shift)\+/.test(testo)) return testo;
  return testo.replace(IN_TESTO, (m) => convertiUna(m));
}

function convertiUna(s: string): string {
  const parti = s.split('+').map(p => p.trim());
  // «Ctrl++» (zoom): l'ultimo tasto è il segno più
  if (s.endsWith('++')) { parti.splice(parti.length - 2, 2, '+'); }
  if (parti.length < 2) return TASTI_MAC[s] ?? s;
  const tasto = parti[parti.length - 1];
  const simboli: string[] = [];
  for (const p of parti.slice(0, -1)) {
    const m = MODIFICATORI_MAC.find(([re]) => re.test(p));
    if (!m) return s; // qualcosa che non è un modificatore: si lascia com'è
    if (!simboli.includes(m[1])) simboli.push(m[1]);
  }
  simboli.sort((a, b) => ORDINE_MAC.indexOf(a) - ORDINE_MAC.indexOf(b));
  return simboli.join('') + (TASTI_MAC[tasto] ?? (tasto.length === 1 ? tasto.toUpperCase() : tasto));
}

/** Un testo dell'interfaccia adattato al sistema: sul Mac le scorciatoie con i simboli del Mac e «Windows» diventa «macOS»
 *  («Automatica (come Windows)» → «Automatica (come macOS)»). Su Windows il testo resta com'è. */
export function testoPerSistema(testo: string): string {
  if (!suMac() || !testo) return testo;
  return scorciatoieNelTesto(testo).replace(/\bWindows\b/g, 'macOS');
}

/** Vero se il programma gira dal device portatile (pmb_office con la sua cartella webview2, per esempio su AI_PRO): lo dice la parte
 *  nativa prima che la pagina parta (window.__PMB_PORTATILE__, src-tauri/src/lib.rs). Lì non si installa niente nel PC ospite. */
export function portatile(): boolean {
  return typeof globalThis !== 'undefined' && (globalThis as { __PMB_PORTATILE__?: boolean }).__PMB_PORTATILE__ === true;
}
