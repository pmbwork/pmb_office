import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-simboli';
import { CATALOGO_SIMBOLI } from '../../src/guscio/docs-simboli';
import { testoDi } from '../../src/modello/documento';

async function montaGuscio(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T407: Caratteri speciali e simboli tipografici', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('CATALOGO_SIMBOLI contiene simboli validi per ogni categoria', () => {
    expect(CATALOGO_SIMBOLI.length).toBeGreaterThan(30);
    const categorie = new Set(CATALOGO_SIMBOLI.map((s) => s.categoria));
    expect(categorie.has('frecce')).toBe(true);
    expect(categorie.has('valute')).toBe(true);
    expect(categorie.has('matematica')).toBe(true);
    expect(categorie.has('tipografia')).toBe(true);
    expect(categorie.has('greco')).toBe(true);

    for (const s of CATALOGO_SIMBOLI) {
      expect(s.char.length).toBeGreaterThan(0);
      expect(s.nome.length).toBeGreaterThan(0);
    }
  });

  it('DocsSimboli filtra per categoria e per testo cercato', async () => {
    const dialog: any = document.createElement('docs-simboli');
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    const griglia = q(dialog, '.griglia');
    expect(griglia).not.toBeNull();
    const iniziali = griglia?.querySelectorAll('.tasto-simbolo').length ?? 0;
    expect(iniziali).toBe(CATALOGO_SIMBOLI.length);

    // Filtra per valute
    const catValute = Array.from(dialog.shadowRoot.querySelectorAll('.cat-btn')).find(
      (b: any) => b.textContent?.trim() === 'Valute'
    ) as HTMLElement | undefined;
    expect(catValute).toBeDefined();
    catValute?.click();
    await dialog.updateComplete;

    const bottoniValute = griglia?.querySelectorAll('.tasto-simbolo') ?? [];
    expect(bottoniValute.length).toBe(CATALOGO_SIMBOLI.filter((s) => s.categoria === 'valute').length);

    // Cerca "euro"
    const cerca = q(dialog, '.cerca') as HTMLInputElement;
    cerca.value = 'euro';
    cerca.dispatchEvent(new Event('input', { bubbles: true }));
    await dialog.updateComplete;

    const dopoRicerca = griglia?.querySelectorAll('.tasto-simbolo') ?? [];
    expect(dopoRicerca.length).toBe(1);
    expect(dopoRicerca[0].textContent?.trim()).toBe('€');
  });

  it('DocsSimboli emette evento inserisci al clic su un simbolo', async () => {
    const dialog: any = document.createElement('docs-simboli');
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    let simboloInserito = '';
    dialog.addEventListener('inserisci', (e: CustomEvent) => {
      simboloInserito = e.detail.simbolo;
    });

    const primoSimbolo = q(dialog, '.tasto-simbolo') as HTMLButtonElement;
    expect(primoSimbolo).not.toBeNull();
    primoSimbolo.click();

    expect(simboloInserito).toBe(CATALOGO_SIMBOLI[0].char);
  });

  it('Menu Inserisci > Simboli apre il selettore e inserisce il carattere nel documento', async () => {
    const el = await montaGuscio();
    const menu = q(el, 'docs-menubar');

    // Apertura da menu
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'inserisci', voce: 'Simboli' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    const simboliComp = q(el, 'docs-simboli');
    expect(simboliComp).not.toBeNull();

    // Seleziona un simbolo (€)
    simboliComp?.dispatchEvent(new CustomEvent('inserisci', {
      detail: { simbolo: '€' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    const editor: any = q(el, 'docs-editor');
    expect(testoDi(editor.stato.doc)).toContain('€');

    // Escape chiude il dialogo
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;

    expect(q(el, 'docs-simboli')).toBeNull();
  });

  it('nessun elemento in DocsGuscio ha stili in linea (CSP compliant)', async () => {
    const el = await montaGuscio();
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.apriSimboli();
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
