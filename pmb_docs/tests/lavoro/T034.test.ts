import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import { testoDi, daTesto, cursore, type Stato } from '../../src/modello/documento';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const casella = (el: any): HTMLTextAreaElement => el.shadowRoot.querySelector('textarea.ingresso');
const paragrafi = (el: any): Element[] => Array.from(el.shadowRoot.querySelectorAll('.testo p'));
const testoDom = (el: any): string => paragrafi(el).map((p) => p.textContent).join('\n');

function tasto(el: any, key: string, extra: Record<string, boolean> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  casella(el).dispatchEvent(e);
  return e;
}
function scrivi(el: any, testo: string): void {
  const c = casella(el);
  c.value = testo;
  c.dispatchEvent(new Event('input', { bubbles: true }));
}
function appunti(testo: string | null): { clip: any; letti: Record<string, string> } {
  const letti: Record<string, string> = {};
  return { letti, clip: { getData: () => testo ?? '', setData: (t: string, v: string) => { letti[t] = v; } } };
}
function evento(tipo: 'copy' | 'cut' | 'paste', clip: any): Event {
  const e = new Event(tipo, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', { value: clip });
  return e;
}

describe('T034: editor di pmb_docs', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('parte con una pagina vuota: un paragrafo, la casella di ingresso e nessuno stile in linea', async () => {
    const el = await monta();
    expect(paragrafi(el).length).toBe(1);
    expect(paragrafi(el)[0].querySelector('br')).not.toBeNull();
    expect(casella(el)).not.toBeNull();
    expect(testoDi(el.stato.doc)).toBe('');
    expect(el.shadowRoot.querySelectorAll('.testo [style]').length).toBe(0);
  });

  it('il testo arriva dall\'evento input e finisce nel documento e nella pagina', async () => {
    const el = await monta();
    scrivi(el, 'C');
    scrivi(el, 'iao');
    expect(testoDi(el.stato.doc)).toBe('Ciao');
    expect(testoDom(el)).toBe('Ciao');
    expect(casella(el).value).toBe('');
    expect(el.stato.sel).toEqual(cursore(0, 4));
  });

  it('i tasti di comando: invio, cancella, frecce; il default del browser viene fermato', async () => {
    const el = await monta();
    scrivi(el, 'abc');
    expect(tasto(el, 'Enter').defaultPrevented).toBe(true);
    scrivi(el, 'def');
    expect(testoDom(el)).toBe('abc\ndef');
    expect(tasto(el, 'Backspace').defaultPrevented).toBe(true);
    expect(testoDom(el)).toBe('abc\nde');
    tasto(el, 'ArrowLeft');
    tasto(el, 'Delete');
    expect(testoDom(el)).toBe('abc\nd');
    tasto(el, 'Home', { ctrlKey: true });
    expect(el.stato.sel).toEqual(cursore(0, 0));
    tasto(el, 'ArrowRight', { shiftKey: true });
    expect(el.stato.sel.fuoco).toEqual({ p: 0, o: 1 });
    expect(tasto(el, 'a').defaultPrevented).toBe(false);
    expect(testoDom(el)).toBe('abc\nd');
  });

  it('grassetto con Ctrl+B prima di scrivere, annulla e ripeti', async () => {
    const el = await monta();
    scrivi(el, 'ab');
    tasto(el, 'b', { ctrlKey: true });
    scrivi(el, 'cd');
    expect(Array.from(el.shadowRoot.querySelectorAll('.testo span')).map((s: any) => [s.textContent, s.className])).toEqual([['ab', ''], ['cd', 'g']]);
    tasto(el, 'z', { ctrlKey: true });
    expect(testoDom(el)).toBe('ab');
    tasto(el, 'y', { ctrlKey: true });
    expect(testoDom(el)).toBe('abcd');
    tasto(el, 'a', { ctrlKey: true });
    scrivi(el, 'x');
    expect(testoDom(el)).toBe('x');
  });

  it('i pulsanti della barra: grassetto e annulla funzionano, gli altri dicono di non essere collegati', async () => {
    const el = await monta();
    scrivi(el, 'ab');
    tasto(el, 'a', { ctrlKey: true });
    expect(el.eseguiComando('corsivo')).toBe(true);
    expect(el.shadowRoot.querySelector('.testo span').className).toBe('c');
    expect(el.eseguiComando('annulla')).toBe(true);
    expect(el.shadowRoot.querySelector('.testo span').className).toBe('');
    expect(el.eseguiComando('zoom')).toBe(false);
  });

  it('incolla, copia e taglia passano dagli appunti', async () => {
    const el = await monta();
    const i = appunti('uno\ndue');
    const ev = evento('paste', i.clip);
    casella(el).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(testoDom(el)).toBe('uno\ndue');
    tasto(el, 'a', { ctrlKey: true });
    const c = appunti(null);
    const evc = evento('copy', c.clip);
    casella(el).dispatchEvent(evc);
    expect(c.letti['text/plain']).toBe('uno\ndue');
    expect(evc.defaultPrevented).toBe(true);
    const t = appunti(null);
    casella(el).dispatchEvent(evento('cut', t.clip));
    expect(t.letti['text/plain']).toBe('uno\ndue');
    expect(testoDom(el)).toBe('');
    const nulla = appunti(null);
    const evn = evento('copy', nulla.clip);
    casella(el).dispatchEvent(evn);
    expect(evn.defaultPrevented).toBe(false);
  });

  it('durante la composizione (tasti morti, IME) il testo entra solo alla fine', async () => {
    const el = await monta();
    casella(el).dispatchEvent(new Event('compositionstart', { bubbles: true }));
    scrivi(el, 'に');
    expect(testoDi(el.stato.doc)).toBe('');
    expect(tasto(el, 'Backspace', { isComposing: true } as any).defaultPrevented).toBe(false);
    casella(el).dispatchEvent(new Event('compositionend', { bubbles: true }));
    expect(testoDi(el.stato.doc)).toBe('に');
    expect(casella(el).value).toBe('');
  });

  it('ogni modifica avvisa con l\'evento cambio; impostaStato sostituisce il documento', async () => {
    const el = await monta();
    const visti: string[] = [];
    el.addEventListener('cambio', (e: any) => visti.push(testoDi(e.detail.stato.doc)));
    scrivi(el, 'x');
    tasto(el, 'Enter');
    expect(visti).toEqual(['x', 'x\n']);
    const nuovo: Stato = { doc: daTesto('uno\ndue\ntre'), sel: cursore(1, 1), pendenti: null };
    el.impostaStato(nuovo);
    expect(testoDom(el)).toBe('uno\ndue\ntre');
    expect(el.stato.sel).toEqual(cursore(1, 1));
    expect(visti[visti.length - 1]).toBe('uno\ndue\ntre');
    tasto(el, 'z', { ctrlKey: true });
    expect(testoDom(el)).toBe('uno\ndue\ntre');
  });
});

describe('T034: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('la pagina contiene l\'editor e un pulsante della barra agisce sul testo', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('.pagina docs-editor');
    expect(ed).not.toBeNull();
    expect(g.shadowRoot.querySelector('.pagina')?.getAttribute('role')).toBe('textbox');
    await ed.updateComplete;
    scrivi(ed, 'ciao');
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    ed.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
    (tb.shadowRoot.querySelector('button.comando[data-id="grassetto"]') as HTMLButtonElement).click();
    expect(ed.shadowRoot.querySelector('.testo span').className).toBe('g');
    (tb.shadowRoot.querySelector('button.comando[data-id="annulla"]') as HTMLButtonElement).click();
    expect(ed.shadowRoot.querySelector('.testo span').className).toBe('');
  });
});
