import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-toolbar';
import '../../src/guscio/docs-popup';
import '../../src/editor/docs-editor';
import { contenutoComando } from '../../src/guscio/contenuto-barra';
import { popupPerComando } from '../../src/guscio/popup-dati';

const casella = (el: any): HTMLTextAreaElement => el.shadowRoot.querySelector('textarea.ingresso');
const paragrafi = (el: any): HTMLElement[] => Array.from(el.shadowRoot.querySelectorAll('.testo p')) as HTMLElement[];
function tasto(el: any, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  casella(el).dispatchEvent(e);
  return e;
}
function scrivi(el: any, testo: string): void {
  const c = casella(el);
  c.value = testo;
  c.dispatchEvent(new Event('input', { bubbles: true }));
}
async function monta(): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
async function guscio(): Promise<{ g: any; ed: any; tb: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  const tb: any = g.shadowRoot.querySelector('docs-toolbar');
  await ed.updateComplete;
  await tb.updateComplete;
  return { g, ed, tb };
}
const bottone = (tb: any, id: string): HTMLButtonElement => tb.shadowRoot.querySelector(`button.comando[data-id="${id}"]`);
async function aggiorna(g: any, tb: any): Promise<void> { await g.updateComplete; await tb.updateComplete; }

describe('T044: editor con formattazione', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('scorciatoie di allineamento e di cancella formattazione', async () => {
    const el = await monta();
    scrivi(el, 'ciao');
    expect(tasto(el, 'E', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(paragrafi(el)[0].className).toBe('al-ce');
    tasto(el, 'R', { ctrlKey: true, shiftKey: true });
    expect(paragrafi(el)[0].className).toBe('al-dx');
    tasto(el, 'L', { ctrlKey: true, shiftKey: true });
    expect(paragrafi(el)[0].getAttribute('class')).toBeNull();
    tasto(el, 'a', { ctrlKey: true });
    tasto(el, 'b', { ctrlKey: true });
    expect(el.shadowRoot.querySelector('.testo span').className).toBe('g');
    tasto(el, '\\', { ctrlKey: true });
    expect(el.shadowRoot.querySelector('.testo span').className).toBe('');
  });

  it('elenco puntato con Ctrl+Maiusc+8, nuova voce con invio, Tab per il sottolivello, invio su voce vuota per uscire', async () => {
    const el = await monta();
    scrivi(el, 'uno');
    tasto(el, '*', { ctrlKey: true, shiftKey: true, code: 'Digit8' });
    expect(paragrafi(el)[0].getAttribute('data-m')).toBe('•');
    tasto(el, 'Enter');
    scrivi(el, 'due');
    expect(tasto(el, 'Tab').defaultPrevented).toBe(true);
    expect(paragrafi(el).map((p) => [p.className, p.getAttribute('data-m')])).toEqual([['el', '•'], ['ri-1 el', '◦']]);
    tasto(el, 'Tab', { shiftKey: true });
    tasto(el, 'Enter');
    tasto(el, 'Enter');
    expect(paragrafi(el).map((p) => p.getAttribute('data-m'))).toEqual(['•', '•', null]);
  });

  it('applicaAzione: corpo e colore sul testo selezionato; i pulsanti più e meno cambiano il corpo', async () => {
    const el = await monta();
    scrivi(el, 'abc');
    tasto(el, 'a', { ctrlKey: true });
    el.applicaAzione({ tipo: 'attributo', chiave: 'z', valore: 24 });
    el.applicaAzione({ tipo: 'attributo', chiave: 'k', valore: '#ff0000' });
    const s = el.shadowRoot.querySelector('.testo span') as HTMLElement;
    expect(s.style.fontSize).toBe('24pt');
    expect(s.style.color).not.toBe('');
    expect(el.eseguiComando('aumenta-corpo')).toBe(true);
    expect((el.shadowRoot.querySelector('.testo span') as HTMLElement).style.fontSize).toBe('30pt');
    expect(el.eseguiComando('riduci-corpo')).toBe(true);
    expect((el.shadowRoot.querySelector('.testo span') as HTMLElement).style.fontSize).toBe('24pt');
    expect(el.eseguiComando('elenco-numerato')).toBe(true);
    expect(paragrafi(el)[0].getAttribute('data-m')).toBe('1.');
    expect(el.eseguiComando('zoom')).toBe(false);
  });

  it('il testo non cambia quando si cambiano gli attributi, e annulla li riporta indietro', async () => {
    const el = await monta();
    scrivi(el, 'xyz');
    tasto(el, 'a', { ctrlKey: true });
    el.applicaAzione({ tipo: 'stile', valore: '1' });
    expect(paragrafi(el)[0].className).toBe('st-1');
    expect(paragrafi(el)[0].textContent).toBe('xyz');
    tasto(el, 'z', { ctrlKey: true });
    expect(paragrafi(el)[0].getAttribute('class')).toBeNull();
    expect(paragrafi(el)[0].textContent).toBe('xyz');
  });
});

describe('T044: barra strumenti con stato', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('le caselle mostrano i valori passati e i pulsanti accesi hanno la classe attivo', async () => {
    const tb: any = document.createElement('docs-toolbar');
    tb.larghezza = 1600;
    document.body.appendChild(tb);
    await tb.updateComplete;
    expect((bottone(tb, 'corpo').textContent ?? '').trim()).toBe('11');
    expect(bottone(tb, 'grassetto').classList.contains('attivo')).toBe(false);
    tb.valori = { 'corpo': '24', 'carattere': 'Georgia ▾', 'stile-paragrafo': 'Titolo 1 ▾' };
    tb.attivi = ['grassetto', 'elenco-puntato'];
    await tb.updateComplete;
    expect((bottone(tb, 'corpo').textContent ?? '').trim()).toBe('24');
    expect((bottone(tb, 'carattere').textContent ?? '').trim()).toBe('Georgia ▾');
    expect((bottone(tb, 'stile-paragrafo').textContent ?? '').trim()).toBe('Titolo 1 ▾');
    expect(bottone(tb, 'grassetto').classList.contains('attivo')).toBe(true);
    expect(bottone(tb, 'grassetto').getAttribute('aria-pressed')).toBe('true');
    expect(bottone(tb, 'elenco-puntato').classList.contains('attivo')).toBe(true);
    expect(bottone(tb, 'corsivo').classList.contains('attivo')).toBe(false);
    expect((bottone(tb, 'zoom').textContent ?? '').trim()).toBe('100% ▾');
    expect(tb.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });

  it('contenutoComando accetta i valori correnti e il pulsante emette il comando con la sua posizione', async () => {
    expect(contenutoComando('corpo', { corpo: '30' })).toBe('30');
    expect(contenutoComando('corpo')).toBe('11');
    const tb: any = document.createElement('docs-toolbar');
    document.body.appendChild(tb);
    await tb.updateComplete;
    let visto: any = null;
    tb.addEventListener('comando', (e: any) => { visto = e.detail; });
    bottone(tb, 'allineamento').click();
    expect(visto.id).toBe('allineamento');
    expect(visto.rect).not.toBeNull();
  });
});

describe('T044: menu a tendina', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  async function apri(id: string): Promise<any> {
    const p: any = document.createElement('docs-popup');
    p.popup = popupPerComando(id);
    p.x = 100; p.y = 50;
    document.body.appendChild(p);
    await p.updateComplete;
    return p;
  }

  it('lista: una voce per riga con la spunta sulla voce attiva; il clic avvisa con l\'azione scelta', async () => {
    const p = await apri('allineamento');
    const voci = Array.from(p.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[];
    expect(voci.map((v) => (v.textContent ?? '').trim())).toEqual(['✓Sinistra', 'Al centro', 'Destra', 'Giustificato']);
    expect(voci[0].getAttribute('aria-checked')).toBe('true');
    let scelta: any = null;
    p.addEventListener('scelta', (e: any) => { scelta = e.detail.azione; });
    voci[1].click();
    expect(scelta).toEqual({ tipo: 'allinea', valore: 'ce' });
    expect(p.style.left).toBe('100px');
    expect(p.style.top).toBe('50px');
  });

  it('tavolozza: la voce speciale in alto e venti campioni colorati', async () => {
    const p = await apri('colore-testo');
    expect(p.shadowRoot.querySelectorAll('button.voce').length).toBe(1);
    const colori = Array.from(p.shadowRoot.querySelectorAll('button.colore')) as HTMLButtonElement[];
    expect(colori.length).toBe(20);
    expect(colori.every((b) => b.style.backgroundColor !== '')).toBe(true);
    let scelta: any = null;
    p.addEventListener('scelta', (e: any) => { scelta = e.detail.azione; });
    colori[11].click();
    expect(scelta).toEqual({ tipo: 'attributo', chiave: 'k', valore: '#ff0000' });
  });

  it('si chiude con Esc (e restituisce la tastiera) o con un clic fuori, non con un clic dentro', async () => {
    const p = await apri('corpo');
    const visti: boolean[] = [];
    p.addEventListener('chiudi', (e: any) => visti.push(e.detail.tastiera));
    p.shadowRoot.querySelector('button.voce').dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(visti).toEqual([]);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(visti).toEqual([false]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(visti).toEqual([false, true]);
  });

  it('senza contenuto non disegna niente', async () => {
    const p: any = document.createElement('docs-popup');
    document.body.appendChild(p);
    await p.updateComplete;
    expect(p.shadowRoot.querySelectorAll('button').length).toBe(0);
  });
});

describe('T044: tutto insieme nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Allineamento dalla barra: si apre il menu, si sceglie, il paragrafo si allinea e il menu si chiude', async () => {
    const { g, ed, tb } = await guscio();
    scrivi(ed, 'ciao');
    bottone(tb, 'allineamento').click();
    await g.updateComplete;
    const popup: any = g.shadowRoot.querySelector('docs-popup');
    expect(popup).not.toBeNull();
    await popup.updateComplete;
    (Array.from(popup.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[]).find((b) => (b.textContent ?? '').includes('Al centro'))!.click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-popup')).toBeNull();
    expect(paragrafi(ed)[0].className).toBe('al-ce');
  });

  it('Carattere e corpo dalla barra: il testo cambia e le caselle mostrano il valore nuovo', async () => {
    const { g, ed, tb } = await guscio();
    scrivi(ed, 'ciao');
    tasto(ed, 'a', { ctrlKey: true });
    bottone(tb, 'carattere').click();
    await g.updateComplete;
    let popup: any = g.shadowRoot.querySelector('docs-popup');
    await popup.updateComplete;
    (Array.from(popup.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[]).find((b) => (b.textContent ?? '').includes('Georgia'))!.click();
    await aggiorna(g, tb);
    expect((ed.shadowRoot.querySelector('.testo span') as HTMLElement).style.fontFamily).toContain('Georgia');
    expect((bottone(tb, 'carattere').textContent ?? '').trim()).toBe('Georgia ▾');
    bottone(tb, 'corpo').click();
    await g.updateComplete;
    popup = g.shadowRoot.querySelector('docs-popup');
    await popup.updateComplete;
    (Array.from(popup.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[]).find((b) => (b.textContent ?? '').trim().endsWith('36'))!.click();
    await aggiorna(g, tb);
    expect((ed.shadowRoot.querySelector('.testo span') as HTMLElement).style.fontSize).toBe('36pt');
    expect((bottone(tb, 'corpo').textContent ?? '').trim()).toBe('36');
  });

  it('i pulsanti si accendono e si spengono con lo stato del testo; Esc chiude il menu', async () => {
    const { g, ed, tb } = await guscio();
    scrivi(ed, 'ciao');
    tasto(ed, 'a', { ctrlKey: true });
    bottone(tb, 'grassetto').click();
    await aggiorna(g, tb);
    expect(bottone(tb, 'grassetto').classList.contains('attivo')).toBe(true);
    bottone(tb, 'elenco-numerato').click();
    await aggiorna(g, tb);
    expect(bottone(tb, 'elenco-numerato').classList.contains('attivo')).toBe(true);
    bottone(tb, 'grassetto').click();
    await aggiorna(g, tb);
    expect(bottone(tb, 'grassetto').classList.contains('attivo')).toBe(false);
    bottone(tb, 'interlinea').click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-popup')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-popup')).toBeNull();
    expect(g.shadowRoot.querySelector('.pagina docs-editor')).not.toBeNull();
  });
});
