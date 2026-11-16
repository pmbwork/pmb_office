// T468: barra degli strumenti personalizzabile (come Firefox): catalogo di tutte le funzioni, pannello «Funzioni» con la puntina,
// finestra «Personalizza» (aggiungi, togli, sposta, trascina, separatori, ripristina), salvataggio nelle preferenze, menu nascosti.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { catalogo, funzione, barraPredefinita, ripulisciBarra, divisione, alternaNellaBarra, sposta, SEPARATORE } from '../../src/guscio/barra-personalizzata';
import { VOCI_BARRA } from '../../src/guscio/barra-dati';
import { MENU } from '../../src/guscio/menu-dati';
import { CHIAVE_PREFERENZE } from '../../src/guscio/preferenze';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function guscio(): Promise<any> {
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  return g;
}
const tb = (g: any): any => g.shadowRoot.querySelector('docs-toolbar');
const prefs = (): any => JSON.parse(localStorage.getItem(CHIAVE_PREFERENZE) ?? '{}');

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('T468: catalogo e regole della barra', () => {
  it('il catalogo ha tutti i comandi della barra e tutte le voci finali dei menu, senza doppioni', () => {
    const ids = catalogo().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of VOCI_BARRA) expect(ids).toContain(v.id);
    let foglie = 0;
    for (const m of MENU) for (const v of m.voci) foglie += v.figli ? v.figli.length : 1;
    expect(ids.length).toBe(VOCI_BARRA.length + foglie);
    expect(funzione('menu:inserisci›Tabella')?.menu).toEqual({ menu: 'inserisci', voce: 'Tabella' });
    expect(funzione('menu:formato›Colonne›2 colonne')?.menu).toEqual({ menu: 'formato', voce: '2 colonne', padre: 'Colonne' });
  });
  it('la barra predefinita è quella di sempre, con i separatori tra i gruppi', () => {
    const b = barraPredefinita();
    expect(b.filter((x) => x !== SEPARATORE)).toEqual(VOCI_BARRA.map((v) => v.id));
    expect(b.filter((x) => x === SEPARATORE).length).toBe(6);
  });
  it('ripulitura: via sconosciuti, doppioni e separatori in testa, in coda o doppi', () => {
    expect(ripulisciBarra([SEPARATORE, 'grassetto', 'grassetto', 'boh', SEPARATORE, SEPARATORE, 'corsivo', SEPARATORE])).toEqual(['grassetto', SEPARATORE, 'corsivo']);
    expect(ripulisciBarra('x')).toBeNull();
  });
  it('puntina, spostamento e divisione con «⋮» quando non c\'è spazio', () => {
    expect(alternaNellaBarra(['grassetto'], 'corsivo')).toEqual(['grassetto', 'corsivo']);
    expect(alternaNellaBarra(['grassetto', 'corsivo'], 'grassetto')).toEqual(['corsivo']);
    expect(sposta(['a', 'b', 'c'].map((x) => ({ a: 'grassetto', b: 'corsivo', c: 'link' } as any)[x]), 2, 0)).toEqual(['link', 'grassetto', 'corsivo']);
    const { visibili, nascoste } = divisione(['grassetto', 'corsivo', SEPARATORE, 'link', 'immagine'], 80, () => '');
    expect(visibili).toEqual(['grassetto', 'corsivo']);
    expect(nascoste).toEqual(['link', 'immagine']);
  });
});

describe('T468: la barra nel programma', () => {
  it('una barra scelta si disegna in quell\'ordine, con i separatori e le voci di menu come pulsanti di testo', async () => {
    localStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify({ barra: ['grassetto', SEPARATORE, 'menu:inserisci›Tabella', 'corsivo'] }));
    const g = await guscio();
    const t = tb(g);
    await t.updateComplete;
    const elementi = Array.from(t.shadowRoot.querySelector('.barra-strumenti').children).map((e: any) => e.dataset?.id ?? (e.classList.contains('separatore') ? '|' : e.className));
    expect(elementi.slice(0, 4)).toEqual(['grassetto', '|', 'menu:inserisci›Tabella', 'corsivo']);
    const tabella = t.shadowRoot.querySelector('button[data-id="menu:inserisci›Tabella"]');
    expect(tabella.textContent.trim()).toBe('Tabella');
  });

  it('un pulsante che viene da un menu fa quello che fa la voce di menu (Visualizza › Tema scuro)', async () => {
    localStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify({ barra: ['menu:visualizza›Modalità›Tema scuro'] }));
    const g = await guscio();
    await tb(g).updateComplete;
    tb(g).shadowRoot.querySelector('button[data-id="menu:visualizza›Modalità›Tema scuro"]').click();
    await attendi(); await g.updateComplete;
    expect(g.getAttribute('tema')).toBe('scuro');
  });

  it('pannello Funzioni: la puntina mette e toglie dalla barra, la scelta si salva e resta dopo il riavvio', async () => {
    const g = await guscio();
    const t = tb(g);
    t.shadowRoot.querySelector('button.fisso[data-id="funzioni"]').click();
    await t.updateComplete;
    const riga = t.shadowRoot.querySelector('.riga-funzione[data-funzione="menu:strumenti›Conteggio parole"]');
    expect(riga).not.toBeNull();
    riga.querySelector('button.puntina').click();
    await attendi(); await g.updateComplete; await t.updateComplete;
    expect(prefs().barra.at(-1)).toBe('menu:strumenti›Conteggio parole');
    expect(t.barraEffettiva).toContain('menu:strumenti›Conteggio parole'); // a 1024 px finisce sotto «⋮»
    expect(t.shadowRoot.querySelector('button.altri')).not.toBeNull();
    // riavvio
    document.body.innerHTML = '';
    const g2 = await guscio();
    await tb(g2).updateComplete;
    expect(tb(g2).barraEffettiva).toContain('menu:strumenti›Conteggio parole');
    // togliere con la puntina riporta alla barra predefinita (preferenza null)
    tb(g2).shadowRoot.querySelector('button.fisso[data-id="funzioni"]').click();
    await tb(g2).updateComplete;
    tb(g2).shadowRoot.querySelector('.riga-funzione[data-funzione="menu:strumenti›Conteggio parole"] button.puntina').click();
    await attendi(); await g2.updateComplete;
    expect(prefs().barra).toBeNull();
  });

  it('dal pannello Funzioni si esegue una funzione anche senza metterla nella barra', async () => {
    const g = await guscio();
    const t = tb(g);
    t.shadowRoot.querySelector('button.fisso[data-id="funzioni"]').click();
    await t.updateComplete;
    t.shadowRoot.querySelector('.riga-funzione[data-funzione="menu:strumenti›Conteggio parole"] button.esegui').click();
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-conteggio')).not.toBeNull();
    expect(t.shadowRoot.querySelector('.pannello-funzioni')).toBeNull();
  });

  it('finestra Personalizza: aggiungi, sposta, togli, separatore, trascina, ripristina, Fatto', async () => {
    const g = await guscio();
    const t = tb(g);
    t.shadowRoot.querySelector('button.fisso[data-id="funzioni"]').click();
    await t.updateComplete;
    t.shadowRoot.querySelector('button.personalizza').click();
    await attendi(); await g.updateComplete;
    const d: any = g.shadowRoot.querySelector('docs-personalizza-barra');
    expect(d).not.toBeNull();
    const barra = (): string[] => prefs().barra ?? barraPredefinita();
    // aggiungi
    d.shadowRoot.querySelector('.riga[data-id="menu:inserisci›Equazione"] button.aggiungi').click();
    await d.updateComplete; await g.updateComplete;
    expect(barra().at(-1)).toBe('menu:inserisci›Equazione');
    // sposta a sinistra
    const n = barra().length;
    (d.shadowRoot.querySelectorAll('.barra .elemento')[n - 1] as any).querySelector('button.sinistra').click();
    await d.updateComplete;
    expect(barra()[n - 2]).toBe('menu:inserisci›Equazione');
    // togli il primo (cerca)
    (d.shadowRoot.querySelector('.barra .elemento[data-id="cerca"] button.togli') as any).click();
    await d.updateComplete;
    expect(barra()).not.toContain('cerca');
    // separatore
    d.shadowRoot.querySelector('button.separatore').click();
    await d.updateComplete;
    expect(barra().at(-1)).not.toBe(SEPARATORE); // un separatore in coda non serve: si toglie
    // trascina «Link» davanti al primo elemento
    const primo = d.shadowRoot.querySelector('.barra .elemento');
    const link = d.shadowRoot.querySelector('.barra .elemento[data-id="link"]');
    link.dispatchEvent(new Event('dragstart'));
    primo.dispatchEvent(Object.assign(new Event('drop', { cancelable: true }), { preventDefault() {}, stopPropagation() {} }));
    await d.updateComplete;
    expect(barra()[0]).toBe('link');
    // trascina fuori (sul catalogo): esce dalla barra
    d.shadowRoot.querySelector('.barra .elemento[data-id="link"]').dispatchEvent(new Event('dragstart'));
    d.shadowRoot.querySelector('.catalogo').dispatchEvent(new Event('drop', { cancelable: true }));
    await d.updateComplete;
    expect(barra()).not.toContain('link');
    // la barra vera è cambiata subito
    await t.updateComplete;
    expect(t.barraEffettiva).toContain('menu:inserisci›Equazione');
    expect(t.barraEffettiva).not.toContain('cerca');
    // ripristina
    d.shadowRoot.querySelector('button.ripristina').click();
    await attendi(); await g.updateComplete;
    expect(prefs().barra).toBeNull();
    d.shadowRoot.querySelector('button.fatto').click();
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-personalizza-barra')).toBeNull();
  });

  it('tasto destro sulla barra: «Togli dalla barra» e «Personalizza…»; anche dal menu Visualizza', async () => {
    const g = await guscio();
    const t = tb(g);
    const b = t.shadowRoot.querySelector('button[data-id="grassetto"]');
    b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, clientX: 300, clientY: 70, cancelable: true }));
    await t.updateComplete;
    t.shadowRoot.querySelector('.menu-contesto button.togli').click();
    await attendi(); await g.updateComplete;
    expect(prefs().barra).not.toContain('grassetto');
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'visualizza', voce: 'Personalizza barra degli strumenti' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-personalizza-barra')).not.toBeNull();
  });

  it('la freccia a destra (e Ctrl+Maiusc+F) nasconde i menu e li rimostra; la scelta si ricorda', async () => {
    const g = await guscio();
    const t = tb(g);
    t.shadowRoot.querySelector('button.nascondi-menu').click();
    await attendi(); await g.updateComplete;
    expect(g.hasAttribute('menu-nascosti')).toBe(true);
    expect(prefs().menuNascosti).toBe(true);
    await t.updateComplete;
    expect(t.shadowRoot.querySelector('button.nascondi-menu').getAttribute('aria-label')).toBe('Mostra i menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, bubbles: true }));
    await attendi(); await g.updateComplete;
    expect(g.hasAttribute('menu-nascosti')).toBe(false);
  });
});
