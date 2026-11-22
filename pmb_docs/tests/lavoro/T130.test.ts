import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import '../../src/guscio/docs-righello';
import '../../src/guscio/docs-guscio';
import { ICONE_DOCS } from '../../src/guscio/icone';
import { ICONE, iconaDiMisura } from '@comune/icone';
import { tacche } from '../../src/guscio/righello';

describe('T130: le icone sono quelle comuni della suite (come pmb_sheets)', () => {
  it('ogni icona viene dall\'insieme comune, nella misura di pmb_sheets; le funzioni uguali hanno la stessa icona dei due programmi', () => {
    for (const [id, s] of Object.entries(ICONE_DOCS)) {
      expect(s.includes('width="18" height="18"'), id).toBe(true);
      expect(s.includes('scale(0.025)'), id).toBe(false); // niente più icone sottili di Material Symbols
    }
    const uguali: Array<[string, keyof typeof ICONE]> = [['annulla', 'undo'], ['ripeti', 'redo'], ['stampa', 'print'], ['grassetto', 'bold'], ['corsivo', 'italic'], ['sottolineato', 'underline'],
      ['barrato', 'strike'], ['colore-testo', 'textColor'], ['evidenzia', 'highlight'], ['copia-formato', 'formatPainter'], ['elenco-puntato', 'listBullets'], ['elenco-numerato', 'listNumbers'], ['cancella-formattazione', 'clearFormatting']];
    for (const [docs, sheets] of uguali) expect(ICONE_DOCS[docs], docs).toBe(iconaDiMisura(ICONE[sheets], 18));
    expect(ICONE_DOCS['colore-testo']).toContain('fill="#1d4ed8"'); // la riga blu della A, come in pmb_sheets
    // evidenziare il testo non è colorare lo sfondo di una cella (segnalazione dell'utente, 2026-11-18): evidenziatore con la riga gialla
    expect(ICONE_DOCS['evidenzia']).toContain('fill="#facc15"');
    expect(ICONE_DOCS['evidenzia']).not.toBe(ICONE_DOCS['colore-testo']);
  });
});

describe('T130: il righello come in Google Documenti', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  async function righello(): Promise<any> {
    const r: any = document.createElement('docs-righello');
    document.body.appendChild(r);
    await r.updateComplete;
    return r;
  }

  it('le tacche del mezzo centimetro sono alte (8 px), le altre basse (4 px), e stanno ognuna un pixel prima della posizione', async () => {
    const r = await righello();
    const t = tacche();
    const linee = Array.from(r.shadowRoot.querySelectorAll('line.tacca')) as any[];
    const mezzi = t.filter((c) => c.tipo === 'mezzo').map((c) => String(c.x - 0.5));
    expect(linee.length).toBe(mezzi.length + 1);
    expect(linee.filter((l) => l.getAttribute('y1') === '7').map((l) => l.getAttribute('x1'))).toEqual(mezzi);
    expect(linee.every((l) => l.getAttribute('y2') === '15')).toBe(true);
    const basse = Array.from(r.shadowRoot.querySelectorAll('rect.punto')) as any[];
    expect(basse.length).toBe(t.filter((c) => c.tipo === 'quarto').length);
    for (const b of basse) {
      expect([b.getAttribute('y'), b.getAttribute('height'), b.getAttribute('width')]).toEqual(['11', '4', '1']);
    }
  });

  it('nei margini le tacche sono scure, nel testo chiare', async () => {
    const r = await righello();
    const scure = tacche().filter((c) => c.x <= 96.01 || c.x >= 697.99).length;
    expect(r.shadowRoot.querySelectorAll('.scura').length).toBe(scure);
    expect(scure).toBeGreaterThan(20);
    expect(r.shadowRoot.querySelectorAll('line.tacca:not(.scura), rect.punto:not(.scura)').length).toBeGreaterThan(40);
  });

  it('i numeri stanno sopra la linea (y = 9) con una tacca bassa sotto', async () => {
    const r = await righello();
    const testi = Array.from(r.shadowRoot.querySelectorAll('text')) as any[];
    expect(testi.length).toBe(19); // il numero sotto l'indicatore del margine destro non si scrive
    expect(testi.every((t) => t.getAttribute('y') === '9')).toBe(true);
    expect(r.shadowRoot.querySelectorAll('line.tacca-cm').length).toBe(20);
  });

  it('due indicatori blu segnano i margini: un rettangolo e un triangolo staccati per parte', async () => {
    const r = await righello();
    const rett = Array.from(r.shadowRoot.querySelectorAll('rect.indicatore')) as any[];
    const tri = Array.from(r.shadowRoot.querySelectorAll('polygon.indicatore')) as any[];
    expect(rett.map((x) => [x.getAttribute('x'), x.getAttribute('y'), x.getAttribute('width'), x.getAttribute('height')])).toEqual([['90', '2', '12', '4'], ['692', '2', '12', '4']]);
    expect(tri.map((x) => x.getAttribute('points'))).toEqual(['90,6 102,6 96,12.5', '692,6 704,6 698,12.5']);
  });
});

describe('T130: il guscio si adatta come Google Documenti', () => {
  let osservati: Element[];
  let richiamo: (() => void) | null;
  let fermati: number;
  beforeEach(() => {
    document.body.innerHTML = '';
    osservati = [];
    richiamo = null;
    fermati = 0;
    vi.stubGlobal('ResizeObserver', class {
      constructor(f: () => void) { richiamo = f; }
      observe(e: Element) { osservati.push(e); }
      disconnect() { fermati++; }
      unobserve() {}
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  async function guscio(): Promise<any> {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    return g;
  }

  it('osserva l area del foglio e il foglio; quando cambiano il righello si riallinea; allo smontaggio smette di osservare', async () => {
    const g = await guscio();
    const area = g.shadowRoot.querySelector('.area-editor');
    const pagina = g.shadowRoot.querySelector('.pagina');
    expect(osservati).toEqual([area, pagina]);
    Object.defineProperty(area, 'offsetWidth', { value: 1600, configurable: true });
    Object.defineProperty(area, 'clientWidth', { value: 1585, configurable: true });
    richiamo!();
    expect(g.shadowRoot.querySelector('.righello').style.paddingRight).toBe('15px');
    Object.defineProperty(area, 'clientWidth', { value: 1600, configurable: true });
    richiamo!();
    expect(g.shadowRoot.querySelector('.righello').hasAttribute('style')).toBe(false);
    g.remove();
    expect(fermati).toBe(1);
  });

  it('senza ResizeObserver (ambienti vecchi) il guscio parte lo stesso', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const g = await guscio();
    expect(g.shadowRoot.querySelector('.pagina')).not.toBeNull();
  });
});

describe('T130: gli stili che portano il guscio a Google Documenti', () => {
  const guscio = readFileSync('src/guscio/docs-guscio.ts', 'utf8');
  const barra = readFileSync('src/guscio/docs-toolbar.ts', 'utf8');
  const menu = readFileSync('src/guscio/docs-menubar.ts', 'utf8');
  const css = readFileSync('src/stile-base.css', 'utf8');

  it('il foglio sta a 384 px a 1600 px di larghezza e mai più a sinistra di 301 px; il righello lo segue', () => {
    expect(guscio).toContain('margin-left: max(var(--sx-minimo, 301px), calc((100vw - var(--larghezza-foglio, 794px) - 38px) / 2));');
    expect(guscio).toContain('padding-left: max(calc(var(--sx-minimo, 301px) - 16px), calc((100vw - var(--larghezza-foglio, 794px) - 38px) / 2 - 16px));');
    expect(guscio).toContain('justify-content: flex-start; align-items: flex-start;');
    expect(guscio).toContain('border-bottom: 1px solid var(--pmb-bordo, #c4c7c5)');
  });

  it('intestazione come pmb_sheets (etichetta, logo, nome, stato; niente stella), barra di scorrimento sottile', () => {
    expect(guscio).toContain('.logo-app { position: absolute; left: ${unsafeCSS(String(MISURE.logo.x))}px;'); // logo orizzontale grande a sinistra, al posto di etichetta e logo quadrato
    // il logo è quello ufficiale (comune/scripts/aggiorna-logo.py), uguale in pmb_sheets: mai una versione ricolorata; nel tema scuro sta su un riquadro chiaro
    expect(guscio).toContain('url("${unsafeCSS(LOGO_PMB_DOCS_ORIZZONTALE)}")');
    expect(guscio).not.toContain('data:image/png;base64');
    expect(guscio).toContain(':host([tema="scuro"]) .logo-app { background-color: #ffffff;');
    expect(guscio).not.toContain('badge-app');
    expect(guscio).not.toContain('.intestazione::before');
    // finestra bassa: le sue regole vengono dopo quelle di «Mostra righello» (stessa specificità: vince l'ultima), altrimenti senza righello il foglio resterebbe alla posizione della finestra alta
    expect(guscio.indexOf('@media (max-height: ${unsafeCSS(String(MISURE.compatta.altezzaFinestra))}px)')).toBeGreaterThan(guscio.indexOf(':host([senza-righello]) .area-editor { top: 197px !important; }'));
    expect(guscio.indexOf('@media (max-height:')).toBeGreaterThan(guscio.indexOf(':host([menu-nascosti]) docs-schede { top: 73px; }'));
    expect(guscio).not.toContain('.stella');
    expect(guscio).toContain('span.titolo-documento { cursor: text; }'); // il nome del documento si rinomina con un clic
    for (const s of ['::-webkit-scrollbar-button { display: none; }', 'background: var(--pmb-hover, #e1e3e1)', 'border-width: 0 4px 0 3px']) expect(guscio, s).toContain(s);
  });

  it('la barra: colori, triangolini disegnati; niente commento né «Modifica» finti; la freccia che nasconde i menu è un pulsante vero', () => {
    expect(barra).toContain('.barra-strumenti, button { color: var(--pmb-testo, #0f172a); }');
    expect(barra).toContain("'FrecciaDocs', Roboto, Inter, Arial, sans-serif");
    for (const id of ['zoom', 'stile-paragrafo', 'carattere', 'allineamento', 'elenco-attivita', 'elenco-puntato', 'elenco-numerato']) {
      expect(barra, id).toContain(`button.comando[data-id='${id}']::after`);
    }
    expect(barra).not.toContain("button.comando[data-id='immagine']::before"); // l'icona «aggiungi commento» era solo disegnata: i commenti non ci sono
    expect(barra).not.toContain("content: attr(data-testo)");
    expect(barra).not.toContain('.barra-strumenti::after');
    expect(barra).toContain('button.nascondi-menu');
    expect(barra).toContain('.icona svg { overflow: visible; }');
    expect((barra.match(/-webkit-mask:/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('il segno ▾ del testo è reso invisibile, e i titoli dei menu stanno dove stanno in Google', () => {
    expect(css).toContain("@font-face { font-family: 'FrecciaDocs'; src: local('Segoe UI Symbol'), local('Arial'); unicode-range: U+25BE; size-adjust: 1%; }");
    expect(menu).toContain(".titolo-menu[data-menu='visualizza'], .titolo-menu[data-menu='formato'] { margin-left: 1px; }");
    expect(menu).toContain(".titolo-menu[data-menu='strumenti'] { margin-left: 2px; }");
  });
});
