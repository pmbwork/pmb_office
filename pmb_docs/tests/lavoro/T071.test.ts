import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import { domDaPosizione, posizioneDaDom } from '../../src/editor/render';
import { altezzaFogli } from '../../src/editor/pagine';
import { daTesto, cursore, testoDi } from '../../src/modello/documento';

// Un "browser finto" con regole semplici, per provare l'inserimento dei salti di pagina senza un vero layout:
// righe alte 20 px, 40 caratteri per riga, paragrafi senza spazio tra loro, il primo paragrafo comincia a 96 px.
const LH = 20;
const CPL = 40;
const PAD = 96;
let host: HTMLElement | null = null;
const rettangolo = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 1, width: 1, height: bottom - top, x: 0, y: top });

function calcola(): { top: Map<Text, number[]>; par: Map<Element, { top: number; bottom: number }> } {
  const zona = host!.shadowRoot!.querySelector('.testo') as HTMLElement;
  const top = new Map<Text, number[]>();
  const par = new Map<Element, { top: number; bottom: number }>();
  let y = PAD;
  for (const p of Array.from(zona.children) as HTMLElement[]) {
    const pTop = y;
    y += parseFloat(p.style.paddingTop) || 0;
    let x = 0;
    let haTesto = false;
    const visita = (n: Node): void => {
      if (n.nodeType === 3) {
        const t = n as Text;
        const arr: number[] = [];
        for (let i = 0; i < (t.nodeValue ?? '').length; i++) {
          if (x >= CPL) { y += LH; x = 0; }
          arr.push(y);
          x++;
          haTesto = true;
        }
        top.set(t, arr);
        return;
      }
      const el = n as HTMLElement;
      if (el.classList?.contains('salto')) {
        if (x > 0) { y += LH; x = 0; }
        y += parseFloat(el.style.height) || 0;
        return;
      }
      n.childNodes.forEach(visita);
    };
    p.childNodes.forEach(visita);
    if (x > 0 || !haTesto) y += LH;
    par.set(p, { top: pTop, bottom: y });
  }
  return { top, par };
}

const originali: Array<[object, string, PropertyDescriptor | undefined]> = [];
function sostituisci(oggetto: object, nome: string, valore: unknown): void {
  originali.push([oggetto, nome, Object.getOwnPropertyDescriptor(oggetto, nome)]);
  Object.defineProperty(oggetto, nome, { value: valore, configurable: true, writable: true });
}
function installaBrowserFinto(): void {
  sostituisci(Range.prototype, 'getClientRects', function (this: Range) {
    const nodo = this.startContainer as Text;
    if (nodo.nodeType !== 3 || !host) return [];
    const arr = calcola().top.get(nodo);
    if (!arr) return [];
    const lung = (nodo.nodeValue ?? '').length;
    if (this.startOffset === 0 && this.endOffset === lung && lung > 1) {
      const out: ReturnType<typeof rettangolo>[] = [];
      arr.forEach((t, i) => { if (i === 0 || t !== arr[i - 1]) out.push(rettangolo(t, t + LH)); });
      return out;
    }
    const t = arr[this.startOffset];
    return t === undefined ? [] : [rettangolo(t, t + LH)];
  });
  sostituisci(HTMLElement.prototype, 'getBoundingClientRect', function (this: HTMLElement) {
    if (this === host) return rettangolo(0, 5000);
    if (this.tagName === 'P' && host && (this.parentElement as HTMLElement | null)?.className === 'testo') {
      const m = calcola().par.get(this);
      if (m) return rettangolo(m.top, m.bottom);
    }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
  });
}
afterEach(() => {
  while (originali.length) {
    const [o, nome, d] = originali.pop()!;
    if (d) Object.defineProperty(o, nome, d); else delete (o as Record<string, unknown>)[nome];
  }
  host = null;
});

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  host = el;
  return el;
}
const zona = (el: any): HTMLElement => el.shadowRoot.querySelector('.testo');
const paragrafi = (el: any): HTMLElement[] => Array.from(zona(el).children) as HTMLElement[];
function carica(el: any, testo: string): void { el.impostaStato({ doc: daTesto(testo), sel: cursore(0, 0), pendenti: null }); }
const righe = (n: number): string => Array.from({ length: n }, (_, i) => `riga ${i}`).join('\n');

describe('T071: impaginazione nell\'editor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('senza layout (nessuna misura) c\'è una pagina sola e niente viene aggiunto al testo', async () => {
    const el = await monta();
    carica(el, righe(200));
    expect(el.pagine).toBe(1);
    expect(el.shadowRoot.querySelectorAll('.foglio').length).toBe(1);
    expect(paragrafi(el).every((p) => p.style.paddingTop === '')).toBe(true);
    expect(zona(el).querySelectorAll('.salto').length).toBe(0);
  });

  it('un documento corto sta in un foglio solo', async () => {
    installaBrowserFinto();
    const el = await monta();
    carica(el, righe(46));
    expect(el.pagine).toBe(1);
    expect(el.shadowRoot.querySelectorAll('.foglio').length).toBe(1);
    expect(paragrafi(el).every((p) => p.style.paddingTop === '')).toBe(true);
  });

  it('60 paragrafi di una riga: il 47° va in cima al secondo foglio, con lo spazio esatto sopra il paragrafo', async () => {
    installaBrowserFinto();
    const el = await monta();
    carica(el, righe(60));
    expect(el.pagine).toBe(2);
    const p = paragrafi(el);
    expect(p[46].style.paddingTop).toBe('215px');
    expect(p.filter((x) => x.style.paddingTop !== '').length).toBe(1);
    expect(zona(el).querySelectorAll('.salto').length).toBe(0);
    const fogli = Array.from(el.shadowRoot.querySelectorAll('.foglio')) as HTMLElement[];
    expect(fogli.map((f) => f.style.top)).toEqual(['0px', '1135px']);
    expect(fogli.every((f) => f.style.height === '1123px')).toBe(true);
    expect(zona(el).style.minHeight).toBe(`${altezzaFogli(2) - 192}px`);
    expect(el.getAttribute('style')).toBeNull();
    expect(testoDi(el.stato.doc)).toBe(righe(60));
  });

  it('un paragrafo lungo a cavallo di due fogli viene diviso con un salto in mezzo, senza cambiare il testo', async () => {
    installaBrowserFinto();
    const el = await monta();
    const lungo = 'abcdefghij'.repeat(40);
    // dal 2026-11-25 come in Word un paragrafo non lascia una riga sola in fondo al foglio: qui ne restano due
    carica(el, `${righe(44)}\n${lungo}\nfine`);
    expect(el.pagine).toBe(2);
    const p = paragrafi(el)[44];
    const salti = Array.from(p.querySelectorAll('.salto')) as HTMLElement[];
    expect(salti.length).toBe(1);
    expect(salti[0].style.height).toBe('215px');
    const nodi = Array.from(salti[0].parentNode!.childNodes).map((n) => (n.nodeType === 3 ? (n.nodeValue ?? '').length : 'salto'));
    expect(nodi).toEqual([80, 'salto', 320]);
    expect(p.textContent).toBe(lungo);
    expect(p.style.paddingTop).toBe('');
    expect(testoDi(el.stato.doc)).toBe(`${righe(44)}\n${lungo}\nfine`);
  });

  it('righe isolate come in Word: un paragrafo che lascerebbe una riga sola in fondo al foglio passa tutto al foglio dopo', async () => {
    installaBrowserFinto();
    const el = await monta();
    const lungo = 'abcdefghij'.repeat(40);
    carica(el, `${righe(45)}\n${lungo}\nfine`);
    const p = paragrafi(el)[45];
    expect(p.querySelectorAll('.salto').length).toBe(0);
    expect(parseFloat(p.style.paddingTop)).toBeGreaterThan(0);
    expect(testoDi(el.stato.doc)).toBe(`${righe(45)}\n${lungo}\nfine`);
  });

  it('un paragrafo che comincia proprio dove cade il salto ha lo spazio sopra, non in mezzo', async () => {
    installaBrowserFinto();
    const el = await monta();
    carica(el, `${righe(46)}\n${'x'.repeat(100)}`);
    const p = paragrafi(el)[46];
    expect(p.style.paddingTop).toBe('215px');
    expect(p.querySelectorAll('.salto').length).toBe(0);
    expect(el.pagine).toBe(2);
  });

  it('i salti non rovinano la corrispondenza tra il testo nella pagina e le posizioni del documento', async () => {
    installaBrowserFinto();
    const el = await monta();
    carica(el, `${righe(45)}\n${'abcdefghij'.repeat(40)}\nfine`);
    for (const p of [44, 45, 46]) {
      const lung = (el.stato.doc.paragrafi[p].runs.map((r: any) => r.t).join('') as string).length;
      for (let o = 0; o <= lung; o++) {
        const dom = domDaPosizione(zona(el), { p, o })!;
        expect(dom, `${p}:${o}`).not.toBeNull();
        expect(posizioneDaDom(zona(el), dom.nodo, dom.offset), `${p}:${o}`).toEqual({ p, o });
      }
    }
  });

  it('più fogli quando il testo cresce, meno quando si accorcia; l\'evento "pagine" avvisa solo se il numero cambia', async () => {
    installaBrowserFinto();
    const el = await monta();
    const visti: number[] = [];
    el.addEventListener('pagine', (e: any) => visti.push(e.detail.pagine));
    carica(el, righe(100));
    expect(el.pagine).toBe(3);
    expect(el.shadowRoot.querySelectorAll('.foglio').length).toBe(3);
    carica(el, righe(100).replace('riga 3', 'riga tre'));
    expect(el.pagine).toBe(3);
    carica(el, righe(10));
    expect(el.pagine).toBe(1);
    expect(el.shadowRoot.querySelectorAll('.foglio').length).toBe(1);
    expect(paragrafi(el).every((p) => p.style.paddingTop === '')).toBe(true);
    expect(visti).toEqual([3, 1]);
  });

  it('mentre si scrive il documento si reimpagina da solo', async () => {
    installaBrowserFinto();
    const el = await monta();
    carica(el, righe(46));
    expect(el.pagine).toBe(1);
    const c = el.shadowRoot.querySelector('textarea.ingresso') as HTMLTextAreaElement;
    el.focalizza();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, cancelable: true }));
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    c.value = 'nuova riga';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.pagine).toBe(2);
    expect(paragrafi(el)[46].style.paddingTop).toBe('215px');
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(el.pagine).toBe(1);
    expect(paragrafi(el).every((p) => p.style.paddingTop === '')).toBe(true);
  });
});
