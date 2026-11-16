// Il tag `html` dei modelli Lit, con la traduzione dei testi fissi.
//
// Un testo fisso tradotto non può cambiare il modello: se in inglese il modello fosse diverso da quello italiano, cambiando lingua Lit butterebbe via
// tutto il disegno e lo rifarebbe da capo, compreso l'editor con il documento dentro (il testo scritto sparirebbe dalla pagina). Per questo i testi
// fissi che hanno una traduzione diventano valori del modello: il modello è lo stesso nelle due lingue, cambiano solo i valori, e Lit aggiorna i testi
// sul posto senza ricreare niente. Sono interessati il testo tra due tag e i valori di title, aria-label, placeholder, alt; i valori `${...}` già
// presenti restano al loro posto. I testi che arrivano da variabili (etichette dei dati, messaggi) non passano di qui: si traducono dove nascono, con t().
import { html as htmlLit, type TemplateResult } from 'lit';
import { linguaCorrente, mancanti } from './lingua';
import { EN } from './en';
import { testoPerSistema } from '@comune/piattaforma';

const VALORE = '\u0001'; // un valore ${...} già presente nel modello
const TESTO = '\u0002'; // un testo fisso diventato valore
const haLettere = (s: string): boolean => /[A-Za-zÀ-ÿ]{2,}/.test(s.replace(/\u0001/g, ''));
const normalizza = (s: string): string => s.replace(/\s+/g, ' ').trim();
const contaSegnaposto = (s: string): number => (s.match(/\{\}/g) ?? []).length;

interface Voce { valore?: number; it?: string; en?: string }
interface Piano { parti: TemplateStringsArray; ricetta: Voce[] }

/** Un testo fisso del modello diviso nei pezzi tra un valore e l'altro, in italiano e in inglese; null se non ha traduzione (resta fisso nel modello). */
function pezzi(core: string): { it: string[]; en: string[] } | null {
  if (!haLettere(core) || core.includes('&')) return null; // le entità HTML (&amp;...) restano nel modello fisso
  const chiave = normalizza(core).replace(/\u0001/g, '{}');
  const e = EN[chiave];
  if (e === undefined) { if (linguaCorrente() !== 'it') mancanti.add(chiave); return null; }
  if (contaSegnaposto(e) !== contaSegnaposto(chiave)) return null;
  return { it: core.split(VALORE), en: e.split('{}') };
}

const piani = new WeakMap<TemplateStringsArray, Piano | null>();

/** Il modello uguale in tutte le lingue: ogni testo tradotto è sostituito da valori, e la ricetta dice da dove prendere ciascun valore. */
function pianifica(parti: TemplateStringsArray): Piano | null {
  const unito = '>' + parti.join(VALORE) + '<';
  const testi: Voce[] = [];
  const come = (core: string): string | null => {
    const p = pezzi(core);
    if (!p) return null;
    p.it.forEach((it, i) => testi.push({ it, en: p.en[i] }));
    return p.it.map(() => TESTO).join(VALORE);
  };
  const nuovo = unito.replace(/>([^<>]*)<|\b(title|aria-label|placeholder|alt|aria-description)="([^"]*)"/g, (tutto, interno: string | undefined, nome: string | undefined, valore: string | undefined) => {
    if (interno !== undefined) {
      const iniziale = /^\s*/.exec(interno)![0], finale = /\s*$/.exec(interno.slice(iniziale.length))![0];
      const core = interno.slice(iniziale.length, interno.length - finale.length);
      const c = come(core);
      return c === null ? tutto : `>${iniziale}${c}${finale}<`;
    }
    const c = come(valore!);
    return c === null ? tutto : `${nome}="${c}"`;
  });
  if (testi.length === 0) return null;
  const ricetta: Voce[] = [];
  let v = 0, t = 0;
  for (const ch of nuovo) {
    if (ch === VALORE) ricetta.push({ valore: v++ });
    else if (ch === TESTO) ricetta.push(testi[t++]);
  }
  const nuoveParti = nuovo.slice(1, -1).split(/[\u0001\u0002]/);
  const strings = Object.assign([...nuoveParti], { raw: [...nuoveParti] }) as unknown as TemplateStringsArray;
  return { parti: strings, ricetta };
}

export function html(parti: TemplateStringsArray, ...valori: unknown[]): TemplateResult {
  let piano = piani.get(parti);
  if (piano === undefined) { piano = pianifica(parti); piani.set(parti, piano); }
  if (piano === null) return htmlLit(parti, ...valori);
  const inglese = linguaCorrente() !== 'it';
  return htmlLit(piano.parti, ...piano.ricetta.map((r) => (r.valore !== undefined ? valori[r.valore] : testoPerSistema((inglese ? r.en : r.it) ?? ''))));
}
