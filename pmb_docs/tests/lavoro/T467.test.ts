// T467: cambiare la lingua con un documento aperto non perde niente. Difetto trovato nel collaudo fisico: il modello Lit in inglese era diverso da quello
// italiano, quindi cambiando lingua Lit ricreava tutto, editor compreso, e il testo del documento spariva dalla pagina.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { html as htmlTradotto } from '../../src/i18n/html';
import { impostaLingua, linguaCorrente } from '../../src/i18n/lingua';
import { render } from 'lit';

const attendi = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));
const testoPagina = (ed: any): string => Array.from(ed.shadowRoot.querySelectorAll('.testo p')).map((p: any) => p.textContent).join('\n');
const titoliMenu = (g: any): string[] => Array.from(g.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button.titolo-menu')).map((b: any) => b.textContent.trim());

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); impostaLingua('it'); });

describe('T467: il cambio di lingua non ricrea i componenti', () => {
  it('il modello è lo stesso in italiano e in inglese (cambiano solo i valori)', () => {
    const modello = (nome: string) => htmlTradotto`<div title="Nuova scheda"><span>Annulla</span> ${nome}</div>`;
    const it = modello('x'); impostaLingua('en'); const en = modello('x'); impostaLingua('it');
    expect(en.strings).toBe(it.strings);
    expect(en.values).not.toEqual(it.values);
    expect(it.values.includes('Nuova scheda')).toBe(true);
    expect(en.values.includes('New tab')).toBe(true);
  });

  it('render ripetuto in due lingue: gli stessi nodi DOM, testi aggiornati', () => {
    const contenitore = document.createElement('div');
    const modello = () => htmlTradotto`<p><b>Salva</b> <i>Annulla</i></p>`;
    render(modello(), contenitore);
    const p = contenitore.querySelector('p')!;
    expect(p.textContent).toBe('Salva Annulla');
    impostaLingua('en');
    render(modello(), contenitore);
    expect(contenitore.querySelector('p')).toBe(p);
    expect(p.textContent).toBe('Save Cancel');
    impostaLingua('it');
    render(modello(), contenitore);
    expect(contenitore.querySelector('p')).toBe(p);
    expect(p.textContent).toBe('Salva Annulla');
  });

  it('con del testo scritto: cambiando lingua l\'editor è lo stesso elemento e il testo resta in pagina', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    const c = ed.shadowRoot.querySelector('textarea.ingresso') as HTMLTextAreaElement;
    c.value = 'Relazione di prova\nSecondo paragrafo importante';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    await attendi(); await g.updateComplete;
    expect(testoPagina(ed)).toBe('Relazione di prova\nSecondo paragrafo importante');
    expect(titoliMenu(g)[1]).toBe('Modifica');

    impostaLingua('en');
    await attendi(); await g.updateComplete; await ed.updateComplete;
    expect(linguaCorrente()).toBe('en');
    expect(g.shadowRoot.querySelector('docs-editor')).toBe(ed); // non è stato ricreato
    expect(testoPagina(ed)).toBe('Relazione di prova\nSecondo paragrafo importante');
    expect(titoliMenu(g)[1]).toBe('Edit');

    impostaLingua('it');
    await attendi(); await g.updateComplete; await ed.updateComplete;
    expect(g.shadowRoot.querySelector('docs-editor')).toBe(ed);
    expect(testoPagina(ed)).toBe('Relazione di prova\nSecondo paragrafo importante');
    expect(titoliMenu(g)[1]).toBe('Modifica');
  });
});
