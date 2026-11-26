// Stili personali di pmb_docs: crearli dal paragrafo del cursore, applicarli, aggiornarli, rinominarli, toglierli. Tutto puro.
// Uno stile ha una base (Testo normale, Titolo, Sottotitolo, Titolo 1-3: dà l'aspetto di partenza e il livello nel sommario) e ciò
// che cambia: carattere, corpo, colore, grassetto, corsivo, sottolineato si disegnano dallo stile (il paragrafo ha la classe su-ID e
// i tratti con un formato proprio lo tengono); allineamento, spazio prima e dopo e interlinea si copiano nel paragrafo quando lo stile
// si applica o si aggiorna, così restano modificabili come sempre. Il paragrafo porta su = id e st = base.
import {
  conParagrafi, ordina, testoParagrafo, LUNGHEZZA_MASSIMA_NOME_STILE,
  type Documento, type Paragrafo, type Selezione, type Stato, type StilePersonale, type StileParagrafo,
} from './documento';
import { rigaNaturale } from './riga';

/** I nomi degli stili già fatti (in italiano e come li chiama Word): uno stile personale non può chiamarsi così. */
const NOMI_RISERVATI = ['testo normale', 'titolo', 'sottotitolo', 'titolo 1', 'titolo 2', 'titolo 3', 'normal', 'title', 'subtitle', 'heading 1', 'heading 2', 'heading 3'];

export const STILI_MASSIMI = 200;

export function stileDi(doc: Documento, id: string | undefined): StilePersonale | undefined {
  return id === undefined ? undefined : doc.stili?.find((s) => s.id === id);
}

/** Perché il nome non va bene (testo da tradurre), o null se va bene. escluso = lo stile che si sta rinominando. */
export function motivoNome(doc: Documento, nome: string, escluso?: string): string | null {
  const n = nome.trim();
  if (n === '') return 'Scrivi il nome dello stile';
  if (n.length > LUNGHEZZA_MASSIMA_NOME_STILE) return 'Il nome dello stile è troppo lungo';
  if (/[\x00-\x1f\x7f]/.test(n)) return 'Il nome dello stile contiene caratteri non ammessi';
  const basso = n.toLowerCase();
  if (NOMI_RISERVATI.includes(basso)) return 'C\'è già uno stile con questo nome';
  if ((doc.stili ?? []).some((s) => s.id !== escluso && s.nome.toLowerCase() === basso)) return 'C\'è già uno stile con questo nome';
  return null;
}

function nuovoId(doc: Documento): string {
  const usati = new Set((doc.stili ?? []).map((s) => s.id));
  for (let k = 1; ; k++) if (!usati.has(`Stile${k}`)) return `Stile${k}`;
}

/** Lo stile che descrive il paragrafo p: la base è il suo stile (o la base del suo stile personale), il formato dei caratteri è quello
 *  del primo tratto con del testo, allineamento, spazi e interlinea sono quelli del paragrafo. */
export function stileDalParagrafo(doc: Documento, p: number, id: string, nome: string): StilePersonale {
  const par = doc.paragrafi[p];
  const vecchio = stileDi(doc, par.su);
  const base: StileParagrafo = par.st ?? vecchio?.base ?? 'n';
  const s: StilePersonale = { id, nome: nome.trim(), base };
  const r = par.runs.find((x) => x.t !== '' && x.im === undefined) ?? par.runs[0];
  // il carattere di un tratto senza formato proprio è quello dello stile attuale del paragrafo
  const f = r?.f ?? vecchio?.f; if (f !== undefined) s.f = f;
  const z = r?.z ?? vecchio?.z; if (z !== undefined) s.z = z;
  const k = r?.k ?? vecchio?.k; if (k !== undefined && /^#[0-9a-fA-F]{6}$/.test(k)) s.k = k.toLowerCase();
  // grassetto, corsivo e sottolineato: del tratto o dello stile attuale (nel disegno si sommano)
  if (r?.g || vecchio?.g) s.g = true;
  if (r?.c || vecchio?.c) s.c = true;
  if (r?.s || vecchio?.s) s.s = true;
  if (par.al !== undefined && par.al !== 'sx') s.al = par.al;
  if (par.sb !== undefined) s.sb = par.sb;
  if (par.sa !== undefined) s.sa = par.sa;
  if (par.ls !== undefined) s.ls = par.ls;
  return s;
}

/** Il paragrafo con lo stile applicato: su e st, poi allineamento, spazi e interlinea dello stile (tolti se lo stile non li ha). */
function conStile(par: Paragrafo, s: StilePersonale): Paragrafo {
  const n: Paragrafo = { ...par, su: s.id };
  if (s.base === 'n') delete n.st; else n.st = s.base;
  for (const k of ['al', 'sb', 'sa', 'ls'] as const) {
    if (s[k] === undefined) delete n[k];
    else (n as unknown as Record<string, unknown>)[k] = s[k];
  }
  // il formato dei caratteri ora viene dallo stile: i tratti che lo ripetono tale e quale lo lasciano allo stile
  n.runs = par.runs.map((r) => {
    const x = { ...r };
    if (s.f !== undefined && x.f === s.f) delete x.f;
    if (s.z !== undefined && x.z === s.z) delete x.z;
    if (s.k !== undefined && x.k?.toLowerCase() === s.k) delete x.k;
    return x;
  });
  return n;
}

const paragrafiToccati = (doc: Documento, sel: Selezione): [number, number] => {
  const [i, f] = ordina(doc, sel);
  return [i.p, f.p];
};

/** Applica lo stile ai paragrafi della selezione (non alle voci del sommario). */
export function applicaStile(doc: Documento, sel: Selezione, id: string): Documento {
  const s = stileDi(doc, id);
  if (!s) return doc;
  const [da, a] = paragrafiToccati(doc, sel);
  return conParagrafi(doc, doc.paragrafi.map((par, p) => (p >= da && p <= a && !par.sm ? conStile(par, s) : par)));
}

/** Toglie lo stile personale dai paragrafi della selezione (lo fa chi applica uno stile già fatto). */
export function togliStile(doc: Documento, sel: Selezione): Documento {
  const [da, a] = paragrafiToccati(doc, sel);
  if (!doc.paragrafi.slice(da, a + 1).some((p) => p.su !== undefined)) return doc;
  return conParagrafi(doc, doc.paragrafi.map((par, p) => {
    if (p < da || p > a || par.su === undefined) return par;
    const { su, ...resto } = par; void su;
    return resto;
  }));
}

/** Crea uno stile dal paragrafo del cursore e lo applica ai paragrafi della selezione. Restituisce il motivo se non si può. */
export function creaStile(stato: Stato, nome: string): Stato | string {
  const motivo = motivoNome(stato.doc, nome);
  if (motivo !== null) return motivo;
  if ((stato.doc.stili ?? []).length >= STILI_MASSIMI) return 'Ci sono già troppi stili nel documento';
  const [i] = ordina(stato.doc, stato.sel);
  if (stato.doc.paragrafi[i.p].sm) return 'Metti il cursore in un paragrafo che non sia una voce del sommario';
  const s = stileDalParagrafo(stato.doc, i.p, nuovoId(stato.doc), nome);
  const doc: Documento = { ...stato.doc, stili: [...(stato.doc.stili ?? []), s] };
  return { ...stato, doc: applicaStile(doc, stato.sel, s.id), pendenti: null };
}

/** Ridefinisce lo stile dal paragrafo del cursore (Word: «Aggiorna in base alla selezione») e lo riapplica a tutti i paragrafi che lo usano. */
export function aggiornaStile(stato: Stato, id: string): Stato {
  const vecchio = stileDi(stato.doc, id);
  if (!vecchio) return stato;
  const [i] = ordina(stato.doc, stato.sel);
  const s = stileDalParagrafo(stato.doc, i.p, id, vecchio.nome);
  const stili = (stato.doc.stili ?? []).map((x) => (x.id === id ? s : x));
  const doc: Documento = { ...stato.doc, stili };
  return { ...stato, doc: conParagrafi(doc, doc.paragrafi.map((par, p) => (par.su === id || p === i.p ? conStile(par, s) : par))), pendenti: null };
}

export function rinominaStile(doc: Documento, id: string, nome: string): Documento | string {
  if (!stileDi(doc, id)) return doc;
  const motivo = motivoNome(doc, nome, id);
  if (motivo !== null) return motivo;
  return { ...doc, stili: (doc.stili ?? []).map((s) => (s.id === id ? { ...s, nome: nome.trim() } : s)) };
}

/** Toglie lo stile dal documento: i paragrafi che lo usavano restano con la sua base (e con allineamento e spazi che avevano). */
export function eliminaStile(doc: Documento, id: string): Documento {
  if (!stileDi(doc, id)) return doc;
  const stili = (doc.stili ?? []).filter((s) => s.id !== id);
  const paragrafi = doc.paragrafi.map((par) => {
    if (par.su !== id) return par;
    const { su, ...resto } = par; void su;
    return resto;
  });
  const out: Documento = { ...doc, paragrafi };
  if (stili.length > 0) out.stili = stili; else delete out.stili;
  return out;
}

export interface VoceStile { stile: StilePersonale; usi: number; esempio: string }
/** Gli stili del documento, con quanti paragrafi li usano e il testo del primo. */
export function elencoStili(doc: Documento): VoceStile[] {
  return (doc.stili ?? []).map((stile) => {
    const usati = doc.paragrafi.filter((p) => p.su === stile.id);
    return { stile, usi: usati.length, esempio: usati.length > 0 ? testoParagrafo(usati[0]).slice(0, 60) : '' };
  });
}

/** Le regole CSS che disegnano gli stili nell'editor (dentro .testo). La specificità (due classi sul paragrafo) vince sugli stili già
 *  fatti (st-1, ...), che hanno una classe sola; i tratti con un formato proprio lo scrivono sullo span e vincono comunque. */
export function cssStili(stili: StilePersonale[] | undefined, famiglia: (f: string) => string, riga: (f: string) => number = rigaNaturale): string {
  return (stili ?? []).map((s) => {
    const d: string[] = [];
    if (s.f !== undefined) d.push(`font-family: ${famiglia(s.f)}`, `--rn: ${riga(s.f)}`);
    // spazi e interlinea dello stile (un paragrafo con i suoi li scrive sul paragrafo e vince)
    if (s.sb !== undefined) d.push(`margin-top: ${s.sb}pt`);
    if (s.sa !== undefined) d.push(`margin-bottom: ${s.sa}pt`);
    if (s.ls !== undefined) d.push(`--ls: ${s.ls}`);
    if (s.z !== undefined) d.push(`font-size: ${s.z}pt`);
    if (s.k !== undefined && /^#[0-9a-fA-F]{6}$/.test(s.k)) d.push(`color: ${s.k}`);
    if (s.g) d.push('font-weight: 700');
    if (s.c) d.push('font-style: italic');
    if (s.s) d.push('text-decoration: underline');
    return d.length > 0 ? `.testo p.su.su-${s.id} { ${d.join('; ')}; }` : '';
  }).filter((x) => x !== '').join('\n');
}

/** Il documento senza stili personali, con il loro formato scritto direttamente nei tratti: per i formati che non hanno stili
 *  (PDF, HTML, RTF) o che li leggono male. */
export function senzaStiliPersonali(doc: Documento): Documento {
  if (!doc.stili || doc.stili.length === 0) return doc;
  const out: Documento = {
    ...doc,
    paragrafi: doc.paragrafi.map((par) => {
      const s = stileDi(doc, par.su);
      if (!s) return par;
      const { su, ...resto } = par; void su;
      return {
        ...resto,
        runs: par.runs.map((r) => ({
          ...r,
          ...(r.f === undefined && s.f !== undefined ? { f: s.f } : {}),
          ...(r.z === undefined && s.z !== undefined ? { z: s.z } : {}),
          ...(r.k === undefined && s.k !== undefined ? { k: s.k } : {}),
          g: r.g || s.g === true, c: r.c || s.c === true, s: r.s || s.s === true,
        })),
      };
    }),
  };
  delete out.stili;
  return out;
}
