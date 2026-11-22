// Leggi ad alta voce, comune a pmb_docs e pmb_sheets: la sintesi vocale del sistema (Web Speech API di WebView2, che usa le voci di
// Windows). Solo voci del computer (localService): niente Internet, niente testo mandato fuori. La lettura va a pezzi (un paragrafo o
// una cella alla volta), si ferma con ferma() e chi chiama sa a che pezzo si è (per evidenziarlo).

export interface Lettura { pezzi: string[]; lingua: string; suPezzo?: (indice: number) => void; fine?: () => void }

function motore(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}
// chiedere l'elenco una volta all'avvio fa caricare le voci prima della prima lettura
try { motore()?.getVoices(); } catch { /* senza sintesi vocale non si legge */ }

/** Le voci del computer per una lingua ("it", "it-IT", "en"...), prima quelle della lingua esatta. */
export function vociLocali(lingua: string): SpeechSynthesisVoice[] {
  const m = motore();
  if (!m) return [];
  const base = lingua.toLowerCase().split(/[-_]/)[0];
  const locali = m.getVoices().filter((v) => v.localService);
  const esatte = locali.filter((v) => v.lang.toLowerCase() === lingua.toLowerCase());
  const stessa = locali.filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base && !esatte.includes(v));
  return [...esatte, ...stessa];
}

let corrente: { annullata: boolean } | null = null;

/** true se in questo momento si sta leggendo. */
export function staLeggendo(): boolean { return corrente !== null; }

/** Ferma la lettura in corso. */
export function ferma(): void {
  if (corrente) corrente.annullata = true;
  corrente = null;
  motore()?.cancel();
}

/** Comincia a leggere (fermando un'eventuale lettura in corso). false se il sistema non sa leggere o non ha una voce del computer. */
export function leggi(l: Lettura): boolean {
  const m = motore();
  if (!m || typeof SpeechSynthesisUtterance === 'undefined') return false;
  ferma();
  const pezzi = l.pezzi.map((p) => p.trim()).filter((p) => p !== '');
  if (pezzi.length === 0) return false;
  // in WebView2 l'elenco delle voci arriva un momento dopo l'avvio: se è ancora vuoto si aspetta (al massimo 3 secondi) e si riprova
  if (m.getVoices().length === 0) {
    const attesa = { annullata: false };
    corrente = attesa;
    let fatto = false;
    const riprova = (): void => {
      if (fatto) return;
      fatto = true;
      m.removeEventListener?.('voiceschanged', riprova);
      if (attesa.annullata || corrente !== attesa) return;
      corrente = null;
      if (m.getVoices().length === 0 || !leggi(l)) l.fine?.();
    };
    m.addEventListener?.('voiceschanged', riprova);
    setTimeout(riprova, 3000);
    return true;
  }
  const voce = vociLocali(l.lingua)[0] ?? m.getVoices().find((v) => v.localService);
  if (!voce) return false;
  const questa = { annullata: false };
  corrente = questa;
  const parla = (i: number): void => {
    if (questa.annullata) return;
    if (i >= pezzi.length) { if (corrente === questa) corrente = null; l.fine?.(); return; }
    const u = new SpeechSynthesisUtterance(pezzi[i].slice(0, 4000));
    u.voice = voce;
    u.lang = voce.lang;
    u.onend = () => parla(i + 1);
    u.onerror = () => { if (corrente === questa) corrente = null; l.fine?.(); };
    l.suPezzo?.(i);
    m.speak(u);
  };
  parla(0);
  return true;
}
