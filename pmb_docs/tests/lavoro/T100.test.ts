import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import { GEOMETRIA_A4, GEOMETRIA_STAMPA, altezzaFogli, impagina, inizioPagina } from '../../src/editor/pagine';
import { cursore, daTesto } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T100: la geometria della stampa', () => {
  it('sulla carta i fogli si toccano e sono alti quanto un A4 (297 mm); lo schermo resta com\'era', () => {
    expect(GEOMETRIA_STAMPA).toEqual({ altezzaPagina: 1122.52, margineAlto: 96, margineBasso: 96, spazio: 0 });
    expect(GEOMETRIA_A4).toEqual({ altezzaPagina: 1123, margineAlto: 96, margineBasso: 96, spazio: 12 });
    expect(inizioPagina(1, GEOMETRIA_STAMPA)).toBeCloseTo(1122.52, 5);
    expect(inizioPagina(3, GEOMETRIA_STAMPA)).toBeCloseTo(3 * 1122.52, 5);
    expect(altezzaFogli(3, GEOMETRIA_STAMPA)).toBeCloseTo(3 * 1122.52, 5);
    expect(altezzaFogli(3, GEOMETRIA_A4)).toBe(3 * 1123 + 2 * 12);
  });

  it('con la geometria di stampa una riga che non entra va in cima al foglio dopo, e i fogli successivi stanno a passo di un A4', () => {
    const imp = impagina([{ alto: 96, basso: 112 }, { alto: 1000, basso: 1030 }, { alto: 1040, basso: 1056 }], GEOMETRIA_STAMPA);
    expect(imp.pagine).toBe(2);
    expect(imp.salti.length).toBe(1);
    expect(imp.salti[0].riga).toBe(1);
    expect(imp.salti[0].altezza).toBeCloseTo(1122.52 + 96 - 1000, 5);
    expect(imp.paginaDiRiga).toEqual([0, 1, 1]);
    // la stessa riga sullo schermo cade nello stesso foglio, ma il foglio dopo comincia 12 px più in basso
    const schermo = impagina([{ alto: 96, basso: 112 }, { alto: 1000, basso: 1030 }, { alto: 1040, basso: 1056 }], GEOMETRIA_A4);
    expect(schermo.salti[0].altezza).toBe(1123 + 12 + 96 - 1000);
  });

  it('un testo con più fogli non lascia mai una riga a cavallo di due fogli in stampa', () => {
    const righe = Array.from({ length: 300 }, (_, i) => ({ alto: 96 + i * 20, basso: 96 + i * 20 + 18 }));
    const imp = impagina(righe, GEOMETRIA_STAMPA);
    const spostamento = new Map<number, number>();
    let extra = 0;
    for (const s of imp.salti) { extra += s.altezza; spostamento.set(s.riga, extra); }
    let corrente = 0;
    righe.forEach((r, i) => {
      corrente = spostamento.has(i) ? spostamento.get(i)! : corrente;
      const alto = r.alto + corrente;
      const basso = r.basso + corrente;
      const foglio = Math.floor(alto / 1122.52 + 1e-9);
      expect(Math.floor((basso - 1e-6) / 1122.52), `riga ${i}`).toBe(foglio);
      expect(basso, `riga ${i}`).toBeLessThanOrEqual(foglio * 1122.52 + 1122.52 - 96 + 0.5);
    });
    expect(imp.pagine).toBeGreaterThan(5);
  });
});

async function editor(testo = 'uno due tre'): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  el.impostaStato({ doc: daTesto(testo), sel: cursore(0, 0), pendenti: null });
  return el;
}
const foglio = (el: any): HTMLElement => el.shadowRoot.querySelector('.foglio');
const zona = (el: any): HTMLElement => el.shadowRoot.querySelector('.testo');

describe('T100: l\'editor in stampa', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('preparaStampa mette i fogli come sulla carta e finisciStampa li riporta come sullo schermo, senza toccare il documento', async () => {
    const el = await editor('uno due\ntre');
    expect(el.inStampa).toBe(false);
    expect(foglio(el).style.height).toBe('1123px');
    expect(zona(el).style.minHeight).toBe('931px');
    el.preparaStampa();
    expect(el.inStampa).toBe(true);
    expect(foglio(el).style.height).toBe('1122.52px');
    expect(foglio(el).style.top).toBe('0px');
    expect(zona(el).style.minHeight).toBe('0px');
    expect(Array.from(zona(el).querySelectorAll('p')).map((p) => p.textContent)).toEqual(['uno due', 'tre']);
    el.finisciStampa();
    expect(el.inStampa).toBe(false);
    expect(foglio(el).style.height).toBe('1123px');
    expect(zona(el).style.minHeight).toBe('931px');
    expect(el.stato.doc.paragrafi.length).toBe(2);
  });

  it('chiamarle due volte, o finisciStampa senza aver preparato, non cambia niente e non ridisegna', async () => {
    const el = await editor();
    const ridisegna = vi.spyOn(el, 'ridisegna' as any);
    el.finisciStampa();
    expect(ridisegna).not.toHaveBeenCalled();
    el.preparaStampa();
    el.preparaStampa();
    expect(ridisegna).toHaveBeenCalledTimes(1);
    el.finisciStampa();
    el.finisciStampa();
    expect(ridisegna).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------- tutto insieme nel guscio
async function guscio(testo = 'uno due tre'): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ doc: daTesto(testo), sel: cursore(0, 0), pendenti: null });
  return { g, ed };
}
function tastoGuscio(ed: any, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...extra });
  ed.shadowRoot.querySelector('textarea').dispatchEvent(e);
  return e;
}

describe('T100: nel guscio', () => {
  let stampa: ReturnType<typeof vi.fn>;
  beforeEach(() => { document.body.innerHTML = ''; stampa = vi.fn(); (window as any).print = stampa; });
  afterEach(() => { delete (window as any).print; });

  it('prima della stampa l\'editor si prepara, dopo la stampa torna come sullo schermo', async () => {
    const { ed } = await guscio();
    window.dispatchEvent(new Event('beforeprint'));
    expect(ed.inStampa).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(ed.inStampa).toBe(false);
  });

  it('Ctrl+P stampa e non lascia fare al browser; Ctrl+Maiusc+P (caratteri non stampabili) no', async () => {
    const { ed } = await guscio();
    const e = tastoGuscio(ed, 'p', { ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(stampa).toHaveBeenCalledTimes(1);
    tastoGuscio(ed, 'P', { ctrlKey: true, shiftKey: true });
    expect(stampa).toHaveBeenCalledTimes(1);
  });

  it('il pulsante Stampa della barra e File > Stampa e File > Anteprima di stampa stampano', async () => {
    const { g } = await guscio();
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    (tb.shadowRoot.querySelector('button.comando[data-id="stampa"]') as HTMLButtonElement).click();
    expect(stampa).toHaveBeenCalledTimes(1);
    const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
    await barraMenu.updateComplete;
    for (const etichetta of ['Stampa', 'Anteprima di stampa']) {
      (barraMenu.shadowRoot.querySelector('button.titolo-menu[data-menu="file"]') as HTMLButtonElement).click();
      await barraMenu.updateComplete;
      const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === etichetta)!;
      voce.click();
      await attendi();
    }
    expect(stampa).toHaveBeenCalledTimes(3);
  });
});

describe('T100: gli stili di stampa', () => {
  it('il foglio di stile della pagina chiede un A4 senza margini e scioglie l\'altezza fissa in stampa', () => {
    const css = readFileSync('src/stile-base.css', 'utf8');
    expect(css).toMatch(/@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
    const stampa = css.slice(css.indexOf('@media print'));
    expect(stampa).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*visible/);
    expect(stampa).toMatch(/docs-guscio\s*\{[^}]*overflow:\s*visible/);
    expect(css).toContain('overflow: hidden');
  });

  it('il guscio nasconde in stampa menu, barre, righello e ricerca e scioglie l\'area del foglio; l\'editor nasconde fogli e cursore e stampa i colori', () => {
    const guscioSrc = readFileSync('src/guscio/docs-guscio.ts', 'utf8');
    const m = guscioSrc.slice(guscioSrc.indexOf('@media print'));
    expect(m).toMatch(/\.trascina,\s*\.intestazione,\s*docs-menubar,\s*\.contenitore-strumenti,\s*\.righello,\s*docs-trova,\s*docs-link,\s*docs-finestra,\s*\.avviso\s*\{\s*display:\s*none/);
    expect(m).toMatch(/\.area-editor\s*\{\s*position:\s*static;\s*display:\s*block;\s*overflow:\s*visible/);
    expect(m).toMatch(/\.pagina\s*\{\s*width:\s*auto;\s*margin:\s*0/);
    const editorSrc = readFileSync('src/editor/docs-editor.ts', 'utf8');
    const e = editorSrc.slice(editorSrc.indexOf('@media print'));
    expect(e).toMatch(/\.fogli,\s*\.sovrapposizione,\s*\.ingresso\s*\{\s*display:\s*none/);
    expect(e).toMatch(/-webkit-print-color-adjust:\s*exact;\s*print-color-adjust:\s*exact/);
  });
});
