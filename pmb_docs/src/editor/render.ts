// Disegno del documento di pmb_docs nella pagina, e corrispondenza tra punti del DOM e posizioni del documento.
// Un paragrafo è un <p data-p="N">; un tratto di testo è uno <span> con le classi g, c, s per grassetto, corsivo, sottolineato
// e, se serve, carattere, corpo e colori impostati dal codice (CSSOM, mai l'attributo style scritto a mano).
// Un'immagine è <span class="immagine"> con dentro l'<img> (misure negli attributi width e height) e il carattere dell'immagine,
// così le posizioni del testo valgono anche per lei.
// Le tabelle sono <table class="tabella"> con righe e celle (<tr>, <td>) che contengono i paragrafi della cella: un paragrafo
// resta sempre <p data-p="N"> con N = posizione nel documento, e paragrafiDom li dà in ordine, dentro o fuori dalle tabelle.
// Un link ha in più la classe link e l'indirizzo in data-u (colore e sottolineatura li dà lo stile dell'editor).
// Il paragrafo porta le classi dell'allineamento (al-ce, al-dx, al-gi), dell'interlinea (ls-100, ls-150, ls-200, ...),
// dello stile (st-t, st-s, st-1, st-2, st-3), del rientro (ri-1 ... ri-8) e dell'elenco (el); il punto o il numero
// della voce sta in data-m. Un paragrafo vuoto contiene solo un <br>, così ha l'altezza di una riga.
import { numeriElenco, type Documento, type Paragrafo, type Posizione } from '../modello/documento';
import { famigliaCss } from '../guscio/caratteri';

const PUNTI = ['•', '◦', '▪'];

function lettere(n: number): string {
  let s = '';
  let k = n;
  while (k > 0) { k -= 1; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); }
  return s;
}
function romani(n: number): string {
  const tabella: Array<[number, string]> = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  let k = n;
  for (const [v, r] of tabella) while (k >= v) { s += r; k -= v; }
  return s;
}

/** Punto o numero davanti a una voce di elenco ("" se il paragrafo non è in un elenco). Livelli: 1. a. i. e poi si ripete. */
export function marcatore(par: Paragrafo, numero: number | null): string {
  const livello = par.ri ?? 0;
  if (par.el === 'p') return PUNTI[livello % 3];
  if (par.el === 't') return par.fa ? '☑' : '☐';
  if (par.el === 'n' && numero !== null) {
    const tipo = livello % 3;
    return (tipo === 0 ? String(numero) : tipo === 1 ? lettere(numero) : romani(numero)) + '.';
  }
  return '';
}

export function classiParagrafo(par: Paragrafo): string {
  const c: string[] = [];
  if (par.al === 'ce' || par.al === 'dx' || par.al === 'gi') c.push(`al-${par.al}`);
  if (par.ls !== undefined && par.ls !== 1.15) c.push(`ls-${Math.round(par.ls * 100)}`);
  if (par.st !== undefined && par.st !== 'n') c.push(`st-${par.st}`);
  if (par.ri !== undefined && par.ri > 0) c.push(`ri-${par.ri}`);
  if (par.el !== undefined) c.push('el');
  if (par.el === 't') c.push(par.fa ? 'att fatto' : 'att');
  if (par.sp) c.push('salto-pagina');
  if (par.hr) c.push('linea-orizzontale');
  if (par.sg !== undefined) c.push('segnalibro');
  if (par.bd !== undefined) c.push('bordo');
  return c.join(' ');
}

/** I paragrafi disegnati, in ordine di documento (anche quelli dentro le tabelle). */
export function paragrafiDom(contenitore: HTMLElement): HTMLElement[] {
  return Array.from(contenitore.querySelectorAll<HTMLElement>('p[data-p]'));
}

function disegnaParagrafo(d: Document, par: Paragrafo, i: number, numero: number | null): HTMLElement {
  const p = d.createElement('p');
  p.setAttribute('data-p', String(i));
  const classiP = classiParagrafo(par);
  if (classiP !== '') p.className = classiP;
  if (par.sg !== undefined) p.setAttribute('data-sg', par.sg);
  // spazio prima/dopo e interlinea fuori dai valori fissi: stile scritto con il CSSOM (la CSP non ammette l'attributo style nel testo)
  if (par.bd !== undefined) p.style.border = `${par.bd.w}pt ${par.bd.s === 't' ? 'dashed' : par.bd.s === 'p' ? 'dotted' : 'solid'} ${par.bd.c}`;
  if (par.sb !== undefined) p.style.marginTop = `${par.sb}pt`;
  if (par.sa !== undefined) p.style.marginBottom = `${par.sa}pt`;
  if (par.ls !== undefined && ![1, 1.15, 1.5, 2].includes(par.ls)) p.style.lineHeight = String(par.ls);
  const m = marcatore(par, numero);
  if (m !== '') p.setAttribute('data-m', m);
  if (par.runs.length === 0) p.appendChild(d.createElement('br'));
  for (const r of par.runs) {
    if (r.im !== undefined) {
      const contenitore = d.createElement('span');
      contenitore.className = r.u !== undefined ? 'immagine link' : 'immagine';
      if (r.u !== undefined) { contenitore.setAttribute('data-u', r.u); contenitore.title = `${r.u} (Ctrl+clic per aprire)`; }
      const immagine = d.createElement('img');
      immagine.setAttribute('src', r.im.s);
      immagine.setAttribute('width', String(r.im.w));
      immagine.setAttribute('height', String(r.im.h));
      immagine.setAttribute('alt', '');
      immagine.setAttribute('draggable', 'false');
      contenitore.appendChild(immagine);
      contenitore.appendChild(d.createTextNode(r.t));
      p.appendChild(contenitore);
      continue;
    }
    const s = d.createElement('span');
    const classi = [r.g ? 'g' : '', r.c ? 'c' : '', r.s ? 's' : '', r.x === 'b' ? 'x' : '', r.v === 'p' ? 'ap' : r.v === 'd' ? 'pe' : '', r.u !== undefined ? 'link' : ''].filter((x) => x !== '').join(' ');
    if (classi !== '') s.className = classi;
    if (r.u !== undefined) { s.setAttribute('data-u', r.u); s.title = `${r.u} (Ctrl+clic per aprire)`; }
    if (r.z !== undefined) s.style.fontSize = `${r.v !== undefined ? Math.round(r.z * 0.58 * 10) / 10 : r.z}pt`;
    if (r.f !== undefined) s.style.fontFamily = famigliaCss(r.f);
    if (r.k !== undefined) s.style.color = r.k;
    if (r.h !== undefined) s.style.backgroundColor = r.h;
    s.textContent = r.t;
    p.appendChild(s);
  }
  return p;
}

/** Paragrafi (fuori dalle tabelle) disegnati l'ultima volta in un contenitore, con il loro nodo: il modello è immutabile,
 *  quindi un paragrafo che è ancora lo stesso oggetto ha ancora lo stesso aspetto e il suo nodo si può riusare. */
const DISEGNATI = new WeakMap<HTMLElement, Array<{ par: Paragrafo; el: HTMLElement }>>();

/** Toglie da un paragrafo riusato ciò che l'impaginazione vi aveva aggiunto (spazi di salto pagina e riempimento in cima). */
function pulisciImpaginazione(contenitore: HTMLElement, riusati: Set<HTMLElement>): void {
  // solo i paragrafi che restano: quelli che stanno per sparire non serve ripulirli (con migliaia di righe costa secondi)
  contenitore.querySelectorAll('.salto').forEach((s) => {
    const p = s.closest('p');
    if (!p || !riusati.has(p)) return;
    s.remove();
    p.normalize();
  });
  contenitore.querySelectorAll<HTMLElement>('p[data-p][style]').forEach((p) => {
    if (!riusati.has(p)) return;
    p.style.paddingTop = '';
    if (p.getAttribute('style') === '') p.removeAttribute('style');
  });
}

/** Da quanti nodi in su si tolgono dal DOM in un solo colpo invece che uno alla volta. */
const SOGLIA_TOGLI_IN_BLOCCO = 100;

export function disegna(contenitore: HTMLElement, doc: Documento): void {
  const d = contenitore.ownerDocument;
  const numeri = numeriElenco(doc);
  // nodi riusabili: i paragrafi liberi dell'ultimo disegno, cercati per oggetto (reggono inserimenti e cancellazioni in mezzo)
  const vecchi = new Map<Paragrafo, HTMLElement[]>();
  for (const { par, el } of DISEGNATI.get(contenitore) ?? []) {
    if (el.parentNode !== contenitore) continue;
    const lista = vecchi.get(par);
    if (lista) lista.push(el); else vecchi.set(par, [el]);
  }
  const nuovi: Array<{ par: Paragrafo; el: HTMLElement }> = [];
  const blocchi: HTMLElement[] = [];
  const riusati = new Set<HTMLElement>();
  const daParagrafo = (par: Paragrafo, i: number): HTMLElement => {
    const el = vecchi.get(par)?.shift();
    if (el) {
      if (el.getAttribute('data-p') !== String(i)) el.setAttribute('data-p', String(i));
      const m = marcatore(par, numeri[i]);
      if ((el.getAttribute('data-m') ?? '') !== m) { if (m !== '') el.setAttribute('data-m', m); else el.removeAttribute('data-m'); }
      riusati.add(el);
      nuovi.push({ par, el });
      return el;
    }
    const nuovo = disegnaParagrafo(d, par, i, numeri[i]);
    nuovi.push({ par, el: nuovo });
    return nuovo;
  };
  let i = 0;
  while (i < doc.paragrafi.length) {
    const tb = doc.paragrafi[i].tb;
    if (!tb) { blocchi.push(daParagrafo(doc.paragrafi[i], i)); i++; continue; }
    const tabella = d.createElement('table');
    tabella.className = 'tabella';
    tabella.setAttribute('data-t', String(tb.i));
    const corpo = d.createElement('tbody');
    tabella.appendChild(corpo);
    let riga: HTMLElement | null = null;
    let cella: HTMLElement | null = null;
    let r = -1;
    let c = -1;
    for (; i < doc.paragrafi.length && doc.paragrafi[i].tb?.i === tb.i; i++) {
      const x = doc.paragrafi[i].tb as { r: number; c: number; w?: number };
      if (x.r !== r || riga === null) { riga = d.createElement('tr'); corpo.appendChild(riga); r = x.r; c = -1; }
      if (x.c !== c || cella === null) {
        cella = d.createElement('td');
        cella.setAttribute('data-r', String(x.r));
        cella.setAttribute('data-c', String(x.c));
        if (x.w !== undefined) cella.style.width = `${x.w}px`;
        riga.appendChild(cella);
        c = x.c;
      }
      cella.appendChild(disegnaParagrafo(d, doc.paragrafi[i], i, numeri[i]));
    }
    blocchi.push(tabella);
  }
  if (riusati.size > 0) pulisciImpaginazione(contenitore, riusati);
  // si tolgono i nodi non più usati (tabelle vecchie, paragrafi spariti o cambiati), poi si mettono i blocchi nell'ordine giusto
  let daTogliere = 0;
  for (let n = contenitore.firstChild; n; n = n.nextSibling) if (!riusati.has(n as HTMLElement)) daTogliere++;
  if (daTogliere > SOGLIA_TOGLI_IN_BLOCCO) {
    // tanti nodi da togliere (per esempio dopo "Seleziona tutto" e Canc): uno alla volta il browser impiega secondi, in blocco millisecondi
    const restano: ChildNode[] = [];
    for (let n = contenitore.firstChild; n; n = n.nextSibling) if (riusati.has(n as HTMLElement)) restano.push(n);
    contenitore.replaceChildren(...restano);
  } else {
    let f = contenitore.firstChild;
    while (f) {
      const prossimo: ChildNode | null = f.nextSibling;
      if (!riusati.has(f as HTMLElement)) contenitore.removeChild(f);
      f = prossimo;
    }
  }
  let cursore: ChildNode | null = contenitore.firstChild;
  for (const b of blocchi) {
    if (b === cursore) cursore = cursore.nextSibling;
    else contenitore.insertBefore(b, cursore);
  }
  DISEGNATI.set(contenitore, nuovi);
}

function lunghezzaTesto(n: Node): number {
  if (n.nodeType === 3) return (n.nodeValue ?? '').length;
  let tot = 0;
  n.childNodes.forEach((f) => { tot += lunghezzaTesto(f); });
  return tot;
}

function caratteriPrima(p: Node, nodo: Node, offset: number): number {
  let n = 0;
  let trovato = false;
  const visita = (x: Node): void => {
    if (trovato) return;
    if (x === nodo) {
      if (x.nodeType === 3) n += offset;
      else for (let i = 0; i < offset && i < x.childNodes.length; i++) n += lunghezzaTesto(x.childNodes[i]);
      trovato = true;
      return;
    }
    if (x.nodeType === 3) { n += (x.nodeValue ?? '').length; return; }
    x.childNodes.forEach(visita);
  };
  visita(p);
  return n;
}

const PARAGRAFO = 'p[data-p]';
const numeroParagrafo = (p: Element): number => Number(p.getAttribute('data-p'));

/** Posizione del documento che corrisponde a un punto (nodo, offset) del DOM, oppure null se il punto è fuori dalla pagina. */
export function posizioneDaDom(contenitore: HTMLElement, nodo: Node, offset: number): Posizione | null {
  if (nodo === contenitore) {
    const figli = Array.from(contenitore.children);
    const tutti = paragrafiDom(contenitore);
    if (figli.length === 0 || tutti.length === 0) return null;
    if (offset >= figli.length) return { p: tutti.length - 1, o: lunghezzaTesto(tutti[tutti.length - 1]) };
    const f = figli[Math.max(0, offset)];
    const primo = f.matches(PARAGRAFO) ? f : f.querySelector(PARAGRAFO);
    return primo ? { p: numeroParagrafo(primo), o: 0 } : null;
  }
  if (!contenitore.contains(nodo)) return null;
  let cur: Node | null = nodo;
  while (cur && cur !== contenitore && !(cur.nodeType === 1 && (cur as Element).matches(PARAGRAFO))) cur = cur.parentNode;
  if (cur && cur !== contenitore) return { p: numeroParagrafo(cur as Element), o: caratteriPrima(cur, nodo, offset) };
  // un punto dentro una tabella ma fuori dai paragrafi (riga, cella): si prende il primo paragrafo che contiene
  if (nodo.nodeType === 1) {
    const primo = (nodo as Element).querySelector(PARAGRAFO);
    if (primo) return { p: numeroParagrafo(primo), o: 0 };
  }
  return null;
}

/** Punto (nodo, offset) del DOM che corrisponde a una posizione del documento, oppure null se non esiste. */
export function domDaPosizione(contenitore: HTMLElement, pos: Posizione): { nodo: Node; offset: number } | null {
  const par = contenitore.querySelector(`p[data-p="${pos.p}"]`);
  if (!par) return null;
  let resto = pos.o;
  let trovato: { nodo: Node; offset: number } | null = null;
  const visita = (x: Node): void => {
    if (trovato) return;
    if (x.nodeType === 3) {
      const l = (x.nodeValue ?? '').length;
      if (resto <= l) trovato = { nodo: x, offset: resto };
      else resto -= l;
      return;
    }
    x.childNodes.forEach(visita);
  };
  visita(par);
  if (trovato) return trovato;
  return lunghezzaTesto(par) === 0 && pos.o === 0 ? { nodo: par, offset: 0 } : null;
}
