// Lettura di pagine .html / .htm nel modello di scambio: ogni tabella della pagina diventa un foglio.
// Si usa l'analizzatore HTML del sistema (DOMParser) su un documento inerte: gli script non girano e le immagini non si scaricano.
// Si importano testo, numeri, celle unite (colspan, rowspan), grassetto (b, strong, th), corsivo, colori del testo e dello sfondo, allineamento.
// Non si importano: immagini, elenchi fuori dalle tabelle, formule (si legge il valore).
import type { CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import type { Scambio } from './scambio';
import { indirizzoCella } from './scambio';
import { mettiCella, nomiUniciFogli, nuovoFoglio, testoPerCella } from './lettura-comune';
import { t } from '../i18n/lingua';

const NOMI_COLORE: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', navy: '#000080', teal: '#008080', lime: '#00ff00', aqua: '#00ffff',
};

function colore(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(s);
  if (m) return `#${[m[1], m[2], m[3]].map((x) => Math.min(255, parseInt(x, 10)).toString(16).padStart(2, '0')).join('')}`;
  return NOMI_COLORE[s];
}

function stile(el: Element): Record<string, string> {
  const o: Record<string, string> = {};
  for (const parte of (el.getAttribute('style') ?? '').split(';')) {
    const i = parte.indexOf(':');
    if (i > 0) o[parte.slice(0, i).trim().toLowerCase()] = parte.slice(i + 1).trim();
  }
  return o;
}

function testoDi(nodo: Node): string {
  let s = '';
  const giro = (n: Node): void => {
    if (n.nodeType === 3) { s += n.nodeValue ?? ''; return; }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return;
    if (tag === 'br') { s += '\n'; return; }
    for (const f of Array.from(n.childNodes)) giro(f);
    if (tag === 'p' || tag === 'div') s += '\n';
  };
  giro(nodo);
  return s.replace(/[ \t\r\f]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/^\n+|\n+$/g, '').trim();
}

const intero = (v: string | null, def: number, max: number): number => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : def;
};

export function leggiHtml(testoPagina: string): { scambio: Scambio; avvisi: string[] } {
  const doc = new DOMParser().parseFromString(testoPagina, 'text/html');
  const tabelle = Array.from(doc.querySelectorAll('table')).filter((tb) => tb.parentElement?.closest('table') === null || tb.parentElement?.closest('table') === undefined);
  if (tabelle.length === 0) throw new Error(t('la pagina non contiene tabelle'));
  const avvisi: string[] = [];
  const fogli = tabelle.map((tb, indice) => {
    const didascalia = testoDi(tb.querySelector('caption') ?? doc.createTextNode(''));
    const f = nuovoFoglio(didascalia !== '' ? didascalia : `Tabella ${indice + 1}`);
    const occupate = new Set<string>();
    let r = 0;
    const righe = Array.from(tb.querySelectorAll('tr')).filter((tr) => tr.closest('table') === tb);
    for (const tr of righe) {
      r++;
      if (r > MAX_ROWS) break;
      let c = 1;
      for (const cella of Array.from(tr.children)) {
        const tag = cella.tagName.toLowerCase();
        if (tag !== 'td' && tag !== 'th') continue;
        while (occupate.has(`${r},${c}`)) c++;
        if (c > MAX_COLS) break;
        const colspan = intero(cella.getAttribute('colspan'), 1, MAX_COLS - c + 1);
        const rowspan = intero(cella.getAttribute('rowspan'), 1, MAX_ROWS - r + 1);
        for (let dr = 0; dr < rowspan; dr++) for (let dc = 0; dc < colspan; dc++) if (dr + dc > 0) occupate.add(`${r + dr},${c + dc}`);
        if (colspan > 1 || rowspan > 1) f.unioni.push({ startRow: r, endRow: r + rowspan - 1, startCol: c, endCol: c + colspan - 1 });
        // testoPerCella mette già l'apice ai testi che devono restare testo (zeri iniziali, codici lunghi, formule)
        mettiCella(f, r, c, testoPerCella(testoDi(cella)).testo);
        const s: CellStyle = {};
        const css = stile(cella);
        if (tag === 'th' || cella.querySelector('b, strong') !== null && testoDi(cella.querySelector('b, strong')!) === testoDi(cella) || /bold|[6-9]00/.test(css['font-weight'] ?? '')) s.bold = true;
        if (cella.querySelector('i, em') !== null && testoDi(cella.querySelector('i, em')!) === testoDi(cella) || css['font-style'] === 'italic') s.italic = true;
        const k = colore(css.color ?? cella.querySelector('font')?.getAttribute('color'));
        if (k) s.color = k;
        const sfondo = colore(css['background-color'] ?? css.background ?? cella.getAttribute('bgcolor'));
        if (sfondo && sfondo !== '#ffffff') s.fill = sfondo;
        const al = (css['text-align'] ?? cella.getAttribute('align') ?? '').toLowerCase();
        if (al === 'center') s.hAlign = 'center'; else if (al === 'right') s.hAlign = 'right'; else if (al === 'left') s.hAlign = 'left';
        if (Object.keys(s).length > 0) f.stili[indirizzoCella(r, c)] = s;
        c += colspan;
      }
    }
    return f;
  });
  nomiUniciFogli(fogli);
  if (doc.querySelector('img') !== null) avvisi.push(t('Le immagini della pagina non sono state importate.'));
  if (tabelle.length > 1) avvisi.push(t('La pagina contiene {} tabelle: ognuna è un foglio.', tabelle.length));
  return { scambio: { fogli, foglioAttivo: fogli[0].nome }, avvisi };
}
