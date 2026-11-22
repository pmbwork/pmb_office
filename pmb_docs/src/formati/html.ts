// Lettura di pagine .html / .htm per pmb_docs.
// Si usa l'analizzatore HTML del sistema (DOMParser) su un documento inerte: gli script non girano e le immagini non si scaricano.
// Si leggono titoli, paragrafi, elenchi, tabelle, link, grassetto, corsivo, sottolineato, barrato, colori, corpo e carattere (da style e da <font>),
// righe orizzontali e immagini incorporate (data:). Il resto si legge come testo.
import { dimensioniIniziali, immagineValida, normalizza, OGGETTO, urlValido, type AttributiParagrafo, type Documento, type Immagine, type Paragrafo, type Run, type TipoElenco } from '../modello/documento';

const NOMI_COLORE: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', navy: '#000080', teal: '#008080', lime: '#00ff00', aqua: '#00ffff',
  fuchsia: '#ff00ff', olive: '#808000', pink: '#ffc0cb', brown: '#a52a2a',
};

/** Un colore CSS (#rgb, #rrggbb, rgb(), nome comune) come "#rrggbb", oppure undefined. */
export function coloreCss(v: string): string | undefined {
  const s = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(s);
  if (m) return `#${[m[1], m[2], m[3]].map((x) => Math.min(255, parseInt(x, 10)).toString(16).padStart(2, '0')).join('')}`;
  return NOMI_COLORE[s];
}

function stileInline(el: Element): Record<string, string> {
  const o: Record<string, string> = {};
  const s = el.getAttribute('style');
  if (!s) return o;
  for (const parte of s.split(';')) {
    const i = parte.indexOf(':');
    if (i > 0) o[parte.slice(0, i).trim().toLowerCase()] = parte.slice(i + 1).trim();
  }
  return o;
}

function corpoDa(v: string): number | undefined {
  const m = /^([\d.]+)\s*(px|pt)?$/.exec(v.trim().toLowerCase());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const pt = m[2] === 'pt' ? n : n * 0.75;
  return pt >= 1 && pt <= 400 ? Math.round(pt * 2) / 2 : undefined;
}

const CORPO_FONT_TAG = [8, 10, 12, 14, 18, 24, 36];
const BLOCCHI = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'figcaption', 'address', 'dd', 'dt', 'dl', 'ul', 'ol', 'table', 'tr', 'hr', 'center', 'form', 'fieldset']);
const IGNORATI = new Set(['script', 'style', 'head', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'canvas', 'select', 'button', 'textarea', 'title', 'meta', 'link']);

interface Formato { g: boolean; c: boolean; s: boolean; x: boolean; f?: string; z?: number; k?: string; h?: string; u?: string; v?: 'p' | 'd' }

export function importaHtml(bytes: Uint8Array, decodifica: (b: Uint8Array) => string): Documento {
  let testo = decodifica(bytes);
  // dichiarazione di codifica nella pagina: se dice windows-1252/iso-8859-1 e il testo non era UTF-8 valido, la decodifica automatica ha già scelto
  const doc = new DOMParser().parseFromString(testo, 'text/html');
  testo = '';
  const corpo = doc.body ?? doc.documentElement;
  const paragrafi: Paragrafo[] = [];
  let runs: Run[] = [];
  let attrCorrente: AttributiParagrafo = {};
  let tabelle = 0;
  const celle: Array<{ i: number; r: number; c: number }> = [];

  const scarica = (extra: AttributiParagrafo = {}): void => {
    const pieni = runs.length > 0;
    const p: Paragrafo = { runs: normalizza(pieni ? runs : [{ t: '', g: false, c: false, s: false }]), ...attrCorrente, ...extra };
    const cella = celle[celle.length - 1];
    if (cella) p.tb = { ...cella };
    paragrafi.push(p);
    runs = [];
  };
  const finisciRiga = (): void => { if (runs.length > 0) scarica(); };

  const aggiungi = (t: string, f: Formato): void => {
    if (t === '') return;
    const r: Run = { t, g: f.g, c: f.c, s: f.s };
    if (f.x) r.x = 'b';
    if (f.f) r.f = f.f;
    if (f.z !== undefined) r.z = f.z;
    if (f.k) r.k = f.k;
    if (f.h) r.h = f.h;
    if (f.u) r.u = f.u;
    if (f.v) r.v = f.v;
    runs.push(r);
  };

  const formatoDi = (el: Element, ereditato: Formato): Formato => {
    const f: Formato = { ...ereditato };
    const tag = el.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong' || /^h[1-6]$/.test(tag) || tag === 'th') f.g = true;
    if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'dfn' || tag === 'address') f.c = true;
    if (tag === 'u' || tag === 'ins') f.s = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') f.x = true;
    if (tag === 'sup') f.v = 'p';
    if (tag === 'sub') f.v = 'd';
    if (tag === 'mark') f.h = '#ffff00';
    if (tag === 'code' || tag === 'pre' || tag === 'kbd' || tag === 'samp' || tag === 'tt') f.f = 'Courier New';
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (urlValido(href)) { f.u = href; }
    }
    if (tag === 'font') {
      const colore = el.getAttribute('color');
      const k = colore ? coloreCss(colore) : undefined;
      if (k) f.k = k;
      const faccia = el.getAttribute('face');
      if (faccia) f.f = faccia.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const size = parseInt(el.getAttribute('size') ?? '', 10);
      if (size >= 1 && size <= 7) f.z = CORPO_FONT_TAG[size - 1];
    }
    const s = stileInline(el);
    if (s['font-weight'] && (s['font-weight'] === 'bold' || parseInt(s['font-weight'], 10) >= 600)) f.g = true;
    if (s['font-weight'] === 'normal' || s['font-weight'] === '400') f.g = false;
    if (s['font-style'] === 'italic' || s['font-style'] === 'oblique') f.c = true;
    const deco = s['text-decoration'] ?? s['text-decoration-line'] ?? '';
    if (/underline/.test(deco)) f.s = true;
    if (/line-through/.test(deco)) f.x = true;
    if (s.color) { const k = coloreCss(s.color); if (k) f.k = k; }
    const sfondo = s['background-color'] ?? (s.background && !/url|gradient/.test(s.background) ? s.background : undefined);
    if (sfondo) { const h = coloreCss(sfondo); if (h && h !== '#ffffff') f.h = h; }
    if (s['font-size']) { const z = corpoDa(s['font-size']); if (z !== undefined) f.z = z; }
    if (s['font-family']) f.f = s['font-family'].split(',')[0].trim().replace(/^["']|["']$/g, '');
    return f;
  };

  const attributiBlocco = (el: Element): AttributiParagrafo => {
    const a: AttributiParagrafo = {};
    const s = stileInline(el);
    const al = (s['text-align'] ?? el.getAttribute('align') ?? '').toLowerCase();
    if (al === 'center') a.al = 'ce';
    else if (al === 'right' || al === 'end') a.al = 'dx';
    else if (al === 'justify') a.al = 'gi';
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') a.st = '1';
    else if (tag === 'h2') a.st = '2';
    else if (/^h[3-6]$/.test(tag)) a.st = '3';
    return a;
  };

  const visita = (nodo: Node, f: Formato, el_lista: { tipo: TipoElenco; livello: number } | null, preformattato: boolean): void => {
    if (nodo.nodeType === 3) {
      let t = nodo.nodeValue ?? '';
      if (!preformattato) t = t.replace(/[\t\r\n\f ]+/g, ' ');
      else t = t.replace(/\r\n?/g, '\n');
      if (preformattato && t.includes('\n')) {
        const righe = t.split('\n');
        righe.forEach((riga, k) => { if (k > 0) scarica(); aggiungi(riga, f); });
        return;
      }
      aggiungi(t, f);
      return;
    }
    if (nodo.nodeType !== 1) return;
    const el = nodo as Element;
    const tag = el.tagName.toLowerCase();
    if (IGNORATI.has(tag) || el.hasAttribute('hidden')) return;
    const nuovoF = formatoDi(el, f);

    if (tag === 'br') { scarica(); return; }
    if (tag === 'hr') { finisciRiga(); scarica({ hr: true }); return; }
    if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) {
        const w0 = parseInt(el.getAttribute('width') ?? '', 10) || 300;
        const h0 = parseInt(el.getAttribute('height') ?? '', 10) || 200;
        const { w, h } = dimensioniIniziali(w0, h0);
        const im: Immagine = { s: src.replace(/^data:image\/jpg/i, 'data:image/jpeg'), w, h };
        if (immagineValida(im)) runs.push({ t: OGGETTO, g: nuovoF.g, c: nuovoF.c, s: nuovoF.s, im, ...(nuovoF.u ? { u: nuovoF.u } : {}) });
      } else {
        const alt = el.getAttribute('alt');
        if (alt) aggiungi(alt, nuovoF);
      }
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      finisciRiga();
      const tipo: TipoElenco = tag === 'ol' ? 'n' : 'p';
      const livello = el_lista ? el_lista.livello + 1 : 0;
      for (const figlio of Array.from(el.childNodes)) visita(figlio, nuovoF, { tipo, livello }, preformattato);
      finisciRiga();
      return;
    }
    if (tag === 'li') {
      finisciRiga();
      const prec = attrCorrente;
      attrCorrente = { ...attributiBlocco(el), el: el_lista?.tipo ?? 'p', ...(el_lista && el_lista.livello > 0 ? { ri: Math.min(8, el_lista.livello) } : {}) };
      const casella = el.querySelector(':scope > input[type="checkbox"]');
      if (casella) { attrCorrente.el = 't'; if (casella.hasAttribute('checked')) attrCorrente.fa = true; }
      for (const figlio of Array.from(el.childNodes)) visita(figlio, nuovoF, el_lista, preformattato);
      // sotto-elenchi dentro il <li> hanno già scaricato la voce corrente: qui resta l'eventuale testo finale
      finisciRiga();
      attrCorrente = prec;
      return;
    }
    if (tag === 'table') {
      finisciRiga();
      const id = ++tabelle;
      let r = 0;
      const righe = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.closest('table') === el);
      for (const tr of righe) {
        let c = 0;
        for (const td of Array.from(tr.children)) {
          const t = td.tagName.toLowerCase();
          if (t !== 'td' && t !== 'th') continue;
          celle.push({ i: id, r, c });
          const prima = paragrafi.length;
          const prec = attrCorrente;
          attrCorrente = attributiBlocco(td);
          visita(td, f, null, preformattato);
          finisciRiga();
          attrCorrente = prec;
          if (paragrafi.length === prima) scarica();
          celle.pop();
          c++;
        }
        r++;
      }
      scarica(); // paragrafo vuoto dopo la tabella (come negli altri formati)
      return;
    }
    if (tag === 'td' || tag === 'th') {
      for (const figlio of Array.from(el.childNodes)) visita(figlio, nuovoF, el_lista, preformattato);
      return;
    }
    if (BLOCCHI.has(tag)) {
      finisciRiga();
      const prec = attrCorrente;
      attrCorrente = { ...prec, ...attributiBlocco(el) };
      if (tag === 'blockquote') attrCorrente.ri = 1;
      const pre = preformattato || tag === 'pre';
      for (const figlio of Array.from(el.childNodes)) visita(figlio, nuovoF, el_lista, pre);
      finisciRiga();
      attrCorrente = prec;
      return;
    }
    for (const figlio of Array.from(el.childNodes)) visita(figlio, nuovoF, el_lista, preformattato);
  };

  visita(corpo, { g: false, c: false, s: false, x: false }, null, false);
  finisciRiga();
  // spazi iniziali e finali di ogni paragrafo (nati dal ritorno a capo nel sorgente)
  for (const p of paragrafi) {
    if (p.runs.length > 0) {
      p.runs[0] = { ...p.runs[0], t: p.runs[0].t.replace(/^ +/, '') };
      const u = p.runs.length - 1;
      p.runs[u] = { ...p.runs[u], t: p.runs[u].t.replace(/ +$/, '') };
      p.runs = normalizza(p.runs);
      if (p.runs.length === 0) p.runs = [{ t: '', g: false, c: false, s: false }];
    }
  }
  return { paragrafi: paragrafi.length > 0 ? paragrafi : [{ runs: [{ t: '', g: false, c: false, s: false }] }] };
}
