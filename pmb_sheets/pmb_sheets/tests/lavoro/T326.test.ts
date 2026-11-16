import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/dialogo-regole';

async function monta(modo: 'condizionale' | 'convalida', intervallo = 'A1:A10'): Promise<any> {
  const el: any = document.createElement('free-dialogo-regole');
  el.modo = modo;
  el.intervallo = intervallo;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const campo = (el: any, nome: string): any => el.shadowRoot.querySelector(`[data-campo="${nome}"]`);
const riga = (el: any, nome: string): HTMLElement => el.shadowRoot.querySelector(`[data-riga="${nome}"]`);
const visibile = (el: any, nome: string): boolean => !riga(el, nome).classList.contains('nascosto');
const bottone = (el: any, nome: string): HTMLButtonElement => el.shadowRoot.querySelector(`button[data-azione="${nome}"]`);
async function scrivi(el: any, nome: string, valore: string): Promise<void> { campo(el, nome).value = valore; campo(el, nome).dispatchEvent(new Event('input', { bubbles: true })); await el.updateComplete; }
async function scegli(el: any, nome: string, valore: string): Promise<void> { campo(el, nome).value = valore; campo(el, nome).dispatchEvent(new Event('change', { bubbles: true })); await el.updateComplete; }
function ascolta(el: any, nome: string): any[] { const v: any[] = []; el.addEventListener(nome, (e: any) => v.push(e.detail)); return v; }
const errore = (el: any): string => (el.shadowRoot.querySelector('.errore')?.textContent ?? '').trim();

beforeEach(() => { document.body.innerHTML = ''; });

describe('T326: finestra della formattazione condizionale', () => {
  it('titolo, intervallo proposto e campi di partenza', async () => {
    const el = await monta('condizionale', 'B2:C5');
    expect(el.shadowRoot.querySelector('h2')!.textContent).toBe('Formattazione condizionale');
    expect(el.shadowRoot.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Formattazione condizionale');
    expect(campo(el, 'intervallo').value).toBe('B2:C5');
    expect(Array.from(campo(el, 'condizione').options).map((o: any) => o.textContent)).toHaveLength(19);
    expect(campo(el, 'condizione').value).toBe('maggiore');
    expect(visibile(el, 'valore1')).toBe(true);
    expect(visibile(el, 'valore2')).toBe(false);
    expect(campo(el, 'usa-sfondo').checked).toBe(true);
    expect(campo(el, 'usa-testo').checked).toBe(false);
    expect(campo(el, 'grassetto').checked).toBe(false);
    expect(errore(el)).toBe('');
  });

  it('il cursore parte nel campo dell\'intervallo', async () => {
    const el = await monta('condizionale');
    expect(el.shadowRoot.activeElement).toBe(campo(el, 'intervallo'));
  });

  it('i campi dei valori seguono la condizione: due per "tra", nessuno per "vuota"', async () => {
    const el = await monta('condizionale');
    await scegli(el, 'condizione', 'tra');
    expect(visibile(el, 'valore1')).toBe(true);
    expect(visibile(el, 'valore2')).toBe(true);
    await scegli(el, 'condizione', 'vuota');
    expect(visibile(el, 'valore1')).toBe(false);
    expect(visibile(el, 'valore2')).toBe(false);
    await scegli(el, 'condizione', 'contiene');
    expect(visibile(el, 'valore1')).toBe(true);
    expect(visibile(el, 'valore2')).toBe(false);
  });

  it('cambiare condizione non cancella quello che è già scritto', async () => {
    const el = await monta('condizionale', 'D4:D9');
    await scrivi(el, 'intervallo', 'E1:E3');
    await scrivi(el, 'valore1', '42');
    await scegli(el, 'condizione', 'minore');
    expect(campo(el, 'intervallo').value).toBe('E1:E3');
    expect(campo(el, 'valore1').value).toBe('42');
  });

  it('Fine con dati giusti manda applica-regola con la regola per il motore', async () => {
    const el = await monta('condizionale', 'A1:A10');
    const visti = ascolta(el, 'applica-regola');
    await scrivi(el, 'valore1', '5');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(visti).toHaveLength(1);
    expect(visti[0].modo).toBe('condizionale');
    expect(visti[0].regola).toMatchObject({ type: 'cell_value', operator: 'greater_than', value1: 5, range: { startRow: 1, endRow: 10, startCol: 1, endCol: 1 }, style: { backgroundColor: '#b7e1cd' } });
    expect(visti[0].regola.id.startsWith('cf-')).toBe(true);
    expect(visti[0].regola.style).toEqual({ backgroundColor: '#b7e1cd' });
    expect(errore(el)).toBe('');
  });

  it('colori e grassetto scelti finiscono nello stile; quelli non spuntati no', async () => {
    const el = await monta('condizionale');
    const visti = ascolta(el, 'applica-regola');
    await scrivi(el, 'valore1', '1');
    campo(el, 'usa-sfondo').checked = false;
    campo(el, 'usa-testo').checked = true;
    campo(el, 'colore-testo').value = '#0000ff';
    campo(el, 'grassetto').checked = true;
    bottone(el, 'fine').click();
    expect(visti[0].regola.style).toEqual({ textColor: '#0000ff', bold: true });
  });

  it('una condizione di testo e una a due valori arrivano giuste', async () => {
    const el = await monta('condizionale');
    const visti = ascolta(el, 'applica-regola');
    await scegli(el, 'condizione', 'contiene');
    await scrivi(el, 'valore1', 'ok');
    bottone(el, 'fine').click();
    expect(visti[0].regola).toMatchObject({ type: 'text', operator: 'contains', value1: 'ok' });
    await scegli(el, 'condizione', 'tra');
    await scrivi(el, 'valore1', '2');
    await scrivi(el, 'valore2', '8');
    bottone(el, 'fine').click();
    expect(visti[1].regola).toMatchObject({ type: 'cell_value', operator: 'between', value1: 2, value2: 8 });
  });

  it('dati sbagliati: il motivo si legge nella finestra e non parte niente', async () => {
    const el = await monta('condizionale', 'pippo');
    const visti = ascolta(el, 'applica-regola');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(visti).toHaveLength(0);
    expect(errore(el)).toContain('Intervallo non valido');
    await scrivi(el, 'intervallo', 'A1:A3');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(errore(el)).toContain('numero');
    await scrivi(el, 'valore1', '3');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(errore(el)).toBe('');
    expect(visti).toHaveLength(1);
  });
});

describe('T326: finestra della convalida dei dati', () => {
  it('titolo e campi di partenza: elenco, rifiuta, celle vuote ammesse', async () => {
    const el = await monta('convalida', 'B2:B9');
    expect(el.shadowRoot.querySelector('h2')!.textContent).toBe('Convalida dei dati');
    expect(campo(el, 'intervallo').value).toBe('B2:B9');
    expect(Array.from(campo(el, 'tipo').options).map((o: any) => o.value)).toEqual(['elenco', 'numero', 'lunghezza', 'casella']);
    expect(visibile(el, 'voci')).toBe(true);
    expect(visibile(el, 'operatore')).toBe(false);
    expect(visibile(el, 'valore1')).toBe(false);
    expect(campo(el, 'azione').value).toBe('rifiuta');
    expect(campo(el, 'vuote').checked).toBe(true);
  });

  it('i campi seguono il criterio: elenco, numero, lunghezza, casella', async () => {
    const el = await monta('convalida');
    await scegli(el, 'tipo', 'numero');
    expect([visibile(el, 'voci'), visibile(el, 'operatore'), visibile(el, 'valore1'), visibile(el, 'valore2')]).toEqual([false, true, true, true]);
    await scegli(el, 'operatore', 'greater_than');
    expect(visibile(el, 'valore2')).toBe(false);
    await scegli(el, 'tipo', 'lunghezza');
    expect([visibile(el, 'voci'), visibile(el, 'operatore'), visibile(el, 'valore1')]).toEqual([false, true, true]);
    await scegli(el, 'tipo', 'casella');
    expect([visibile(el, 'voci'), visibile(el, 'operatore'), visibile(el, 'valore1'), visibile(el, 'valore2')]).toEqual([false, false, false, false]);
    await scegli(el, 'tipo', 'elenco');
    expect(visibile(el, 'voci')).toBe(true);
  });

  it('Fine con un elenco manda applica-regola con intervallo e regola', async () => {
    const el = await monta('convalida', 'B2:B4');
    const visti = ascolta(el, 'applica-regola');
    await scrivi(el, 'voci', 'rosso, verde');
    bottone(el, 'fine').click();
    expect(visti).toHaveLength(1);
    expect(visti[0].modo).toBe('convalida');
    expect(visti[0].convalida.intervallo).toEqual({ startRow: 2, endRow: 4, startCol: 2, endCol: 2 });
    expect(visti[0].convalida.regola).toMatchObject({ type: 'list', listItems: ['rosso', 'verde'], action: 'reject', allowEmpty: true });
  });

  it('numero compreso tra, avviso, messaggio e celle vuote non ammesse', async () => {
    const el = await monta('convalida');
    const visti = ascolta(el, 'applica-regola');
    await scegli(el, 'tipo', 'numero');
    await scrivi(el, 'valore1', '1');
    await scrivi(el, 'valore2', '10');
    await scegli(el, 'azione', 'avvisa');
    await scrivi(el, 'messaggio', 'Da 1 a 10');
    campo(el, 'vuote').checked = false;
    bottone(el, 'fine').click();
    expect(visti[0].convalida.regola).toMatchObject({ type: 'number', operator: 'between', value1: 1, value2: 10, action: 'warn', helpText: 'Da 1 a 10', allowEmpty: false });
  });

  it('numero con una condizione a un solo valore e identificativo della regola', async () => {
    const el = await monta('convalida');
    const visti = ascolta(el, 'applica-regola');
    await scegli(el, 'tipo', 'numero');
    await scegli(el, 'operatore', 'greater_than');
    await scrivi(el, 'valore1', '5');
    bottone(el, 'fine').click();
    expect(visti[0].convalida.regola).toMatchObject({ type: 'number', operator: 'greater_than', value1: 5 });
    expect(visti[0].convalida.regola.value2).toBeUndefined();
    expect(visti[0].convalida.regola.id.startsWith('val-')).toBe(true);
  });

  it('casella di controllo: nessun altro dato richiesto', async () => {
    const el = await monta('convalida');
    const visti = ascolta(el, 'applica-regola');
    await scegli(el, 'tipo', 'casella');
    bottone(el, 'fine').click();
    expect(visti[0].convalida.regola.type).toBe('checkbox');
  });

  it('dati sbagliati: il motivo si legge nella finestra e non parte niente', async () => {
    const el = await monta('convalida');
    const visti = ascolta(el, 'applica-regola');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(visti).toHaveLength(0);
    expect(errore(el)).toContain('voce');
    await scrivi(el, 'intervallo', 'A1:A20000');
    await scrivi(el, 'voci', 'a');
    bottone(el, 'fine').click();
    await el.updateComplete;
    expect(errore(el)).toContain('troppo grande');
  });
});

describe('T326: chiudere la finestra', () => {
  it('Annulla, Esc e il clic fuori dalla finestra mandano chiudi-dialogo', async () => {
    const el = await monta('condizionale');
    const chiusure = ascolta(el, 'chiudi-dialogo');
    bottone(el, 'annulla').click();
    expect(chiusure).toHaveLength(1);
    campo(el, 'intervallo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(chiusure).toHaveLength(2);
    el.shadowRoot.querySelector('[data-velo]').click();
    expect(chiusure).toHaveLength(3);
  });

  it('un clic dentro la finestra non la chiude', async () => {
    const el = await monta('condizionale');
    const chiusure = ascolta(el, 'chiudi-dialogo');
    el.shadowRoot.querySelector('h2').click();
    el.shadowRoot.querySelector('[role="dialog"]').click();
    expect(chiusure).toHaveLength(0);
  });

  it('Invio in un campo di testo equivale a Fine; Fine e Annulla non partono due volte', async () => {
    const el = await monta('condizionale');
    const visti = ascolta(el, 'applica-regola');
    const chiusure = ascolta(el, 'chiudi-dialogo');
    await scrivi(el, 'valore1', '7');
    campo(el, 'valore1').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(visti).toHaveLength(1);
    expect(chiusure).toHaveLength(0);
    bottone(el, 'fine').click();
    expect(visti).toHaveLength(2);
  });

  it('applicare non chiude da sé: chiude chi riceve l\'evento', async () => {
    const el = await monta('convalida');
    const chiusure = ascolta(el, 'chiudi-dialogo');
    await scrivi(el, 'voci', 'a');
    bottone(el, 'fine').click();
    expect(chiusure).toHaveLength(0);
  });
});
