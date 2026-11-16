import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import '../../src/editor/docs-editor';
import { ALTEZZA_MARGINE, DISTANZA_MARGINE, disegnaMargini } from '../../src/editor/margini';
import {
  CAMPO_PAGINA, CAMPO_PAGINE, cursore, daTesto, impostaIntestazione, impostaPiede, type Documento, type Paragrafo, type Run,
} from '../../src/modello/documento';

const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const par = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [run(t)] });
const INTESTAZIONE: Paragrafo[] = [par('Relazione', { al: 'ce' })];
const PIEDE: Paragrafo[] = [par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`, { al: 'dx' })];
function conMargini(i: Paragrafo[] | undefined = INTESTAZIONE, p: Paragrafo[] | undefined = PIEDE): Documento { return impostaPiede(impostaIntestazione(daTesto('corpo'), i), p); }
const posizione = (i: number): number => i * 1135 + 7;
const testi = (zona: Element): string[] => Array.from(zona.querySelectorAll('p')).map((x) => x.textContent ?? '');
const pagineDi = (strato: Element): HTMLElement[] => Array.from(strato.children) as HTMLElement[];
const zone = (pagina: HTMLElement) => ({ i: pagina.querySelector('.intestazione') as HTMLElement, p: pagina.querySelector('.piede') as HTMLElement });
function strato(): HTMLElement { return document.createElement('div'); }

describe('T302 intestazione e piè di pagina disegnati nei fogli', () => {
  it('le misure: 48 px dal bordo e 48 px di altezza', () => {
    expect(DISTANZA_MARGINE).toBe(48);
    expect(ALTEZZA_MARGINE).toBe(48);
  });

  it('un blocco per pagina, alto quanto la pagina e messo dove comincia, con intestazione e piè di pagina in quest\'ordine', () => {
    const s = strato();
    disegnaMargini(s, conMargini(), 3, posizione, 1123);
    const pagine = pagineDi(s);
    expect(pagine.length).toBe(3);
    pagine.forEach((p, i) => {
      expect(p.className).toBe('margine-pagina');
      expect(p.style.top).toBe(`${posizione(i)}px`);
      expect(p.style.height).toBe('1123px');
      expect(Array.from(p.children).map((c) => c.className)).toEqual(['intestazione', 'piede']);
    });
  });

  it('il testo è lo stesso su ogni pagina e i campi hanno il numero della pagina e delle pagine', () => {
    const s = strato();
    disegnaMargini(s, conMargini(), 3, posizione, 1123);
    pagineDi(s).forEach((p, i) => {
      expect(testi(zone(p).i)).toEqual(['Relazione']);
      expect(testi(zone(p).p)).toEqual([`Pag. ${i + 1} di 3`]);
    });
    const dodici = strato();
    disegnaMargini(dodici, impostaPiede(conMargini(), [par(`${CAMPO_PAGINA}/${CAMPO_PAGINA}/${CAMPO_PAGINE}`)]), 12, posizione, 1123);
    expect(testi(zone(pagineDi(dodici)[11]).p)).toEqual(['12/12/12']);
    expect(testi(zone(pagineDi(dodici)[0]).p)).toEqual(['1/1/12']);
    const conNumeroInTesta = strato();
    disegnaMargini(conNumeroInTesta, conMargini([par(`Capitolo ${CAMPO_PAGINA} su ${CAMPO_PAGINE}`)]), 5, posizione, 1123);
    expect(pagineDi(conNumeroInTesta).map((p) => testi(zone(p).i)[0])).toEqual(['Capitolo 1 su 5', 'Capitolo 2 su 5', 'Capitolo 3 su 5', 'Capitolo 4 su 5', 'Capitolo 5 su 5']);
  });

  it('allineamento e formato dei tratti si vedono', () => {
    const s = strato();
    disegnaMargini(s, conMargini([
      { al: 'ce', runs: [run('a', { g: true, c: true, s: true, z: 14, k: '#ff0000', f: 'Roboto', h: '#ffff00' })] },
      par('b', { al: 'dx' }), par('c', { al: 'gi' }),
    ]), 1, posizione, 1123);
    const [uno, due, tre] = Array.from(zone(pagineDi(s)[0]).i.querySelectorAll('p'));
    expect([uno.className, due.className, tre.className]).toEqual(['al-ce', 'al-dx', 'al-gi']);
    const tratto = uno.querySelector('span') as HTMLElement;
    expect(tratto.className).toBe('g c s');
    expect(tratto.style.fontSize).toBe('14pt');
    expect(tratto.style.fontFamily).toContain('Roboto');
    expect(tratto.style.color).not.toBe('');
    expect(tratto.style.backgroundColor).not.toBe('');
  });

  it('disegnare ancora aggiorna senza accumulare: più pagine, meno pagine, testo nuovo, intestazione tolta', () => {
    const s = strato();
    disegnaMargini(s, conMargini(), 1, posizione, 1123);
    disegnaMargini(s, conMargini(), 1, posizione, 1123);
    expect(pagineDi(s).length).toBe(1);
    expect(zone(pagineDi(s)[0]).i.querySelectorAll('p').length).toBe(1);
    disegnaMargini(s, conMargini(), 4, posizione, 1123);
    expect(pagineDi(s).length).toBe(4);
    expect(testi(zone(pagineDi(s)[3]).p)).toEqual(['Pag. 4 di 4']);
    expect(testi(zone(pagineDi(s)[0]).p)).toEqual(['Pag. 1 di 4']);
    disegnaMargini(s, conMargini(), 2, posizione, 1123);
    expect(pagineDi(s).length).toBe(2);
    disegnaMargini(s, conMargini([par('Altra')], [par('Altro')]), 2, posizione, 1123);
    expect(testi(zone(pagineDi(s)[1]).i)).toEqual(['Altra']);
    expect(testi(zone(pagineDi(s)[1]).p)).toEqual(['Altro']);
    disegnaMargini(s, impostaIntestazione(conMargini(), undefined), 2, posizione, 1123);
    expect(zone(pagineDi(s)[1]).i.childNodes.length).toBe(0);
    expect(testi(zone(pagineDi(s)[1]).p)).toEqual(['Pag. 2 di 2']);
    disegnaMargini(s, impostaPiede(conMargini(), undefined), 2, posizione, 1123);
    expect(testi(zone(pagineDi(s)[0]).i)).toEqual(['Relazione']);
    expect(zone(pagineDi(s)[0]).p.childNodes.length).toBe(0);
    disegnaMargini(s, daTesto('niente'), 2, posizione, 1123);
    expect(pagineDi(s).length).toBe(2);
    for (const p of pagineDi(s)) { expect(zone(p).i.childNodes.length).toBe(0); expect(zone(p).p.childNodes.length).toBe(0); }
    pagineDi(s).forEach((p, i) => expect(p.style.top).toBe(`${posizione(i)}px`));
    disegnaMargini(s, conMargini(), 2, (i) => i * 10, 500);
    expect(pagineDi(s).map((p) => [p.style.top, p.style.height])).toEqual([['0px', '500px'], ['10px', '500px']]);
  });

  it('il documento passato non si cambia', () => {
    const d = conMargini();
    const copia = JSON.stringify(d);
    disegnaMargini(strato(), d, 3, posizione, 1123);
    expect(JSON.stringify(d)).toBe(copia);
    expect(d.piede?.[0].runs[0].t).toContain(CAMPO_PAGINA);
  });

  it('niente stili scritti a mano nel codice: la CSP li vieterebbe', () => {
    const src = readFileSync('src/editor/margini.ts', 'utf8');
    expect(src).not.toMatch(/setAttribute\(\s*['"]style['"]/);
    expect(src).not.toMatch(/style="/);
    expect(src).not.toMatch(/innerHTML|eval\(|new Function/);
  });
});

describe('T302 nell\'editor', () => {
  let el: HTMLElement & { impostaStato: (s: unknown) => void; preparaStampa: () => void; finisciStampa: () => void; shadowRoot: ShadowRoot; updateComplete: Promise<unknown> };
  beforeEach(async () => {
    document.body.innerHTML = '';
    el = document.createElement('docs-editor') as typeof el;
    document.body.appendChild(el);
    await el.updateComplete;
  });
  afterEach(() => { document.body.innerHTML = ''; });
  const carica = (doc: Documento) => el.impostaStato({ doc, sel: cursore(0, 0), pendenti: null });

  it('lo strato dei margini sta tra i fogli e il testo e mostra intestazione e piè di pagina', () => {
    carica(conMargini());
    const figli = Array.from(el.shadowRoot.children).map((c) => c.className).filter((c) => c !== '');
    expect(figli.slice(0, 4)).toEqual(['fogli', 'margini', 'numeri-riga', 'testo']);
    const pagine = el.shadowRoot.querySelectorAll('.margini .margine-pagina');
    expect(pagine.length).toBe(1);
    expect(testi(pagine[0].querySelector('.intestazione') as Element)).toEqual(['Relazione']);
    expect(testi(pagine[0].querySelector('.piede') as Element)).toEqual(['Pag. 1 di 1']);
    expect(testi(el.shadowRoot.querySelector('.testo') as Element)).toEqual(['corpo']);
  });

  it('con più fogli ogni foglio ha il suo numero', () => {
    carica(conMargini());
    (el as unknown as { disegnaFogli: (n: number) => void }).disegnaFogli(3);
    const pagine = Array.from(el.shadowRoot.querySelectorAll('.margini .margine-pagina'));
    expect(pagine.length).toBe(3);
    expect(pagine.map((p) => testi(p.querySelector('.piede') as Element)[0])).toEqual(['Pag. 1 di 3', 'Pag. 2 di 3', 'Pag. 3 di 3']);
    expect(pagine.map((p) => (p as HTMLElement).style.top)).toEqual(['0px', '1135px', '2270px']);
    expect(el.shadowRoot.querySelectorAll('.foglio').length).toBe(3);
  });

  it('un documento senza intestazione né piè di pagina lascia i margini vuoti, e aprirne un altro li aggiorna', () => {
    carica(conMargini());
    carica(daTesto('altro'));
    const pagina = el.shadowRoot.querySelector('.margini .margine-pagina') as HTMLElement;
    expect(pagina.querySelector('.intestazione')?.childNodes.length).toBe(0);
    expect(pagina.querySelector('.piede')?.childNodes.length).toBe(0);
    carica(impostaPiede(conMargini([par('Nuova')]), undefined));
    expect(testi(el.shadowRoot.querySelector('.margini .intestazione') as Element)).toEqual(['Nuova']);
  });

  it('in stampa i fogli si toccano e i margini seguono la misura della carta; poi si torna allo schermo', () => {
    carica(conMargini());
    el.preparaStampa();
    let pagina = el.shadowRoot.querySelector('.margini .margine-pagina') as HTMLElement;
    expect([pagina.style.top, pagina.style.height]).toEqual(['0px', '1122.52px']);
    expect(testi(pagina.querySelector('.piede') as Element)).toEqual(['Pag. 1 di 1']);
    el.finisciStampa();
    pagina = el.shadowRoot.querySelector('.margini .margine-pagina') as HTMLElement;
    expect([pagina.style.top, pagina.style.height]).toEqual(['0px', '1123px']);
  });

  it('in stampa con più fogli ogni margine sta dove comincia la sua pagina di carta', () => {
    carica(conMargini());
    el.preparaStampa();
    (el as unknown as { disegnaFogli: (n: number) => void }).disegnaFogli(3);
    const pagine = Array.from(el.shadowRoot.querySelectorAll('.margini .margine-pagina')) as HTMLElement[];
    expect(pagine.map((p) => [p.style.top, p.style.height])).toEqual([['0px', '1122.52px'], ['1122.52px', '1122.52px'], ['2245.04px', '1122.52px']]);
    expect(pagine.map((p) => testi(p.querySelector('.piede') as Element)[0])).toEqual(['Pag. 1 di 3', 'Pag. 2 di 3', 'Pag. 3 di 3']);
    el.finisciStampa();
  });

  it('le regole di stile dei margini: altezza, allineamenti e formato', () => {
    const src = readFileSync('src/editor/docs-editor.ts', 'utf8');
    expect(src).toMatch(/\.margine-pagina \.intestazione, \.margine-pagina \.piede \{ position: absolute; left: 0; right: 0; height: 48px; overflow: hidden; \}/);
    expect(src).toMatch(/\.margine-pagina p \{ position: relative; margin: 0; min-height: 1\.15em; white-space: pre-wrap; overflow-wrap: anywhere; color: #000000; \}/);
    expect(src).toMatch(/\.margine-pagina p\.al-ce \{ text-align: center; \}/);
    expect(src).toMatch(/\.margine-pagina p\.al-dx \{ text-align: right; \}/);
    expect(src).toMatch(/\.margine-pagina p\.al-gi \{ text-align: justify; \}/);
    expect(src).toMatch(/\.margine-pagina \.g \{ font-weight: 700; \}/);
    expect(src).toMatch(/\.margine-pagina \.c \{ font-style: italic; \}/);
    expect(src).toMatch(/\.margine-pagina \.s \{ text-decoration: underline; \}/);
  });

  it('la pagina si stampa con i margini e non intercetta il mouse', () => {
    const src = readFileSync('src/editor/docs-editor.ts', 'utf8');
    const stampa = src.slice(src.indexOf('@media print {'), src.indexOf('.trovato {'));
    expect(stampa).toMatch(/\.margini, \.margini \* \{ -webkit-print-color-adjust: exact; print-color-adjust: exact; \}/);
    const nascosti = stampa.split('\n').find((l) => l.includes('display: none')) ?? '';
    expect(nascosti).toContain('.fogli');
    expect(nascosti).not.toContain('margini');
    expect(src).toMatch(/\.margini \{[^}]*pointer-events: none;[^}]*\}/);
    expect(src).toMatch(/\.margini \{[^}]*z-index: 1;[^}]*\}/);
    expect(src).toMatch(/\.margine-pagina \.intestazione \{ top: 48px; \}/);
    expect(src).toMatch(/\.margine-pagina \.piede \{ bottom: 48px; display: flex; flex-direction: column; justify-content: flex-end; \}/);
    expect(src).toMatch(/\.margine-pagina \{ position: absolute; left: var\(--margine-sinistro, 96px\); right: var\(--margine-destro, 96px\); \}/);
  });
});
