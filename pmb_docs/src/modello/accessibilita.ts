// Controllo accessibilità (Strumenti › Controlla accessibilità, come «Verifica accessibilità» di Word e LibreOffice): le cose del documento
// che rendono difficile leggerlo con un lettore di schermo o con poca vista, ognuna con il punto del testo e il modo di correggerla.
// Le regole seguono le linee guida pubbliche WCAG 2.1 (contrasto 4,5:1, 3:1 per il testo grande) e PDF/UA. Modulo puro.
import { testoParagrafo, type Documento, type StileParagrafo } from './documento';

export type TipoProblema = 'immagine-senza-alt' | 'titolo-saltato' | 'tabella-senza-intestazione' | 'contrasto' | 'paragrafi-vuoti' | 'link-poco-chiaro' | 'senza-titoli';
export interface ProblemaAccessibilita { tipo: TipoProblema; p: number; o: number; /** il testo vicino, per riconoscerlo nell'elenco */ estratto: string }

/** I testi di un link che non dicono dove porta (come li segnala Word). */
const LINK_POCO_CHIARI = new Set(['qui', 'clicca qui', 'premi qui', 'link', 'questo', 'questo link', 'leggi', 'leggi qui', 'di più', 'altro', 'here', 'click here', 'this', 'more', 'read more', 'link here']);
const PROBLEMI_MASSIMI = 500;

/** Luminanza relativa di un colore #rrggbb (WCAG 2.1). */
function luminanza(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const c = [m[1], m[2], m[3]].map((x) => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** Rapporto di contrasto tra due colori (da 1 a 21), o null se uno non è valido. */
export function contrasto(a: string, b: string): number | null {
  const la = luminanza(a), lb = luminanza(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const LIVELLO: Partial<Record<StileParagrafo, number>> = { '1': 1, '2': 2, '3': 3 };

export function controllaAccessibilita(doc: Documento): ProblemaAccessibilita[] {
  const out: ProblemaAccessibilita[] = [];
  const aggiungi = (x: ProblemaAccessibilita): void => { if (out.length < PROBLEMI_MASSIMI) out.push({ ...x, estratto: x.estratto.replace(/[￼]/g, '').trim().slice(0, 60) }); };
  const baseStile = new Map((doc.stili ?? []).map((s) => [s.id, s.base] as const));
  let ultimoLivello = 0, titoli = 0, conTesto = 0, vuoti = 0, inizioVuoti = -1;
  const tabelleViste = new Set<number>();
  doc.paragrafi.forEach((par, p) => {
    const testo = testoParagrafo(par);
    // titoli: il livello (anche quello di uno stile personale fatto da un titolo) non salta (1 → 3)
    const st = par.su !== undefined ? baseStile.get(par.su) : par.st;
    const livello = st ? LIVELLO[st] : undefined;
    if (livello !== undefined && testo.trim() !== '') {
      titoli++;
      if (ultimoLivello > 0 && livello > ultimoLivello + 1) aggiungi({ tipo: 'titolo-saltato', p, o: 0, estratto: testo });
      ultimoLivello = livello;
    }
    if (testo.trim() !== '') conTesto++;
    // paragrafi vuoti in fila (fuori dalle tabelle) usati per fare spazio
    if (par.tb === undefined && testo.trim() === '' && !par.runs.some((r) => r.im)) { if (vuoti === 0) inizioVuoti = p; vuoti++; }
    else { if (vuoti >= 3) aggiungi({ tipo: 'paragrafi-vuoti', p: inizioVuoti, o: 0, estratto: testo }); vuoti = 0; }
    // tabelle: la prima riga è di intestazione
    if (par.tb && !tabelleViste.has(par.tb.i)) {
      tabelleViste.add(par.tb.i);
      const primaRiga = doc.paragrafi.filter((x) => x.tb?.i === par.tb!.i && x.tb.r === 0);
      if (!primaRiga.some((x) => x.tb?.h)) aggiungi({ tipo: 'tabella-senza-intestazione', p, o: 0, estratto: testo });
    }
    let o = 0;
    par.runs.forEach((r, k) => {
      if (r.im && !(r.im.d && r.im.d.trim() !== '')) aggiungi({ tipo: 'immagine-senza-alt', p, o, estratto: testo });
      // contrasto del testo colorato sullo sfondo (l'evidenziazione o la pagina bianca)
      if (r.k && r.t.trim() !== '' && !r.im) {
        const c = contrasto(r.k, r.h && r.h !== 'none' ? r.h : '#ffffff');
        const grande = (r.z ?? 11) >= 18 || ((r.z ?? 11) >= 14 && r.g);
        if (c !== null && c < (grande ? 3 : 4.5)) aggiungi({ tipo: 'contrasto', p, o, estratto: r.t });
      }
      // link: il testo dice dove porta (un gruppo di tratti con lo stesso indirizzo si guarda una volta sola)
      if (r.u !== undefined && (k === 0 || par.runs[k - 1].u !== r.u)) {
        let t = '';
        for (let j = k; j < par.runs.length && par.runs[j].u === r.u; j++) t += par.runs[j].t;
        if (LINK_POCO_CHIARI.has(t.trim().toLowerCase().replace(/[.:!…]+$/, ''))) aggiungi({ tipo: 'link-poco-chiaro', p, o, estratto: t });
      }
      o += r.t.length;
    });
  });
  if (vuoti >= 3) aggiungi({ tipo: 'paragrafi-vuoti', p: inizioVuoti, o: 0, estratto: '' });
  if (titoli === 0 && conTesto >= 20) aggiungi({ tipo: 'senza-titoli', p: 0, o: 0, estratto: testoParagrafo(doc.paragrafi[0] ?? { runs: [] }) });
  return out.sort((a, b) => a.p - b.p || a.o - b.o);
}

/** Che cosa non va e come si corregge, per l'elenco (frasi intere, così si traducono). */
export const SPIEGAZIONI: Record<TipoProblema, { titolo: string; correzione: string }> = {
  'immagine-senza-alt': { titolo: 'Immagine senza testo alternativo', correzione: 'Seleziona l\'immagine: Formato › Immagine › Testo alternativo…' },
  'titolo-saltato': { titolo: 'Il titolo salta un livello', correzione: 'Usa i livelli in ordine (Titolo 1, poi Titolo 2, poi Titolo 3): chi usa un lettore di schermo si orienta con i titoli.' },
  'tabella-senza-intestazione': { titolo: 'Tabella senza riga di intestazione', correzione: 'Metti il cursore nella prima riga: Formato › Tabella › Ripeti come riga di intestazione.' },
  'contrasto': { titolo: 'Testo con poco contrasto', correzione: 'Scegli un colore del testo più scuro (o uno sfondo più chiaro): il rapporto di contrasto deve essere almeno 4,5:1.' },
  'paragrafi-vuoti': { titolo: 'Paragrafi vuoti usati per fare spazio', correzione: 'Togli i paragrafi vuoti e usa lo spazio prima e dopo il paragrafo (Formato › Interlinea e spaziatura paragrafo).' },
  'link-poco-chiaro': { titolo: 'Il testo del link non dice dove porta', correzione: 'Scrivi nel testo del link dove porta (per esempio «il regolamento del concorso»), non «qui» o «clicca qui».' },
  'senza-titoli': { titolo: 'Documento lungo senza titoli', correzione: 'Dai ai titoli delle parti gli stili Titolo 1, 2 e 3: servono per orientarsi e per il sommario.' },
};
