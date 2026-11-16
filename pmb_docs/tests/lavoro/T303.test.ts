import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import '../../src/guscio/docs-margini';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import {
  CAMPO_PAGINA, CAMPO_PAGINE, cursore, daTesto, impostaIntestazione, impostaPiede, statoIniziale, testoDi,
  type Documento, type Paragrafo, type Run, type Stato,
} from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const par = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [run(t)] });
function conMargini(i?: Paragrafo[], p?: Paragrafo[]): Documento { return impostaPiede(impostaIntestazione(daTesto('abc'), i), p); }
const stato = (d: Documento = daTesto('abc')): Stato => ({ ...statoIniziale(d), sel: cursore(0, 1) });

describe('T303 l\'azione che cambia intestazione e piè di pagina', () => {
  it('mette intestazione e piè di pagina, lasciando corpo e cursore com\'erano', () => {
    const ed = nuovoEditor(stato());
    const r = eseguiAzioneFormato(ed, { tipo: 'margini', intestazione: [par('Testata', { al: 'ce' })], piede: [par(`Pag. ${CAMPO_PAGINA}`, { al: 'dx' })] });
    const s = statoCorrente(r.ed);
    expect(s.doc.intestazione).toEqual([par('Testata', { al: 'ce' })]);
    expect(s.doc.piede).toEqual([par(`Pag. ${CAMPO_PAGINA}`, { al: 'dx' })]);
    expect(testoDi(s.doc)).toBe('abc');
    expect(s.sel).toEqual(cursore(0, 1));
    expect(r.copiato).toBeNull();
  });

  it('annulla e ripeti: una sola voce di storia, e annullando tornano come prima', () => {
    const ed = nuovoEditor(stato(conMargini([par('Vecchia')], [par('Vecchio')])));
    const r = eseguiAzioneFormato(ed, { tipo: 'margini', intestazione: [par('Nuova')], piede: undefined });
    expect(r.ed.storia.passato.length).toBe(ed.storia.passato.length + 1);
    expect(statoCorrente(r.ed).doc.intestazione).toEqual([par('Nuova')]);
    expect('piede' in statoCorrente(r.ed).doc).toBe(false);
    const annullato = eseguiAzioneFormato(r.ed, { tipo: 'annulla' }).ed;
    expect(statoCorrente(annullato).doc.intestazione).toEqual([par('Vecchia')]);
    expect(statoCorrente(annullato).doc.piede).toEqual([par('Vecchio')]);
    const ripetuto = eseguiAzioneFormato(annullato, { tipo: 'ripeti' }).ed;
    expect(statoCorrente(ripetuto).doc.intestazione).toEqual([par('Nuova')]);
    expect('piede' in statoCorrente(ripetuto).doc).toBe(false);
  });

  it('senza intestazione né piè di pagina nell\'azione li toglie tutti e due', () => {
    const r = eseguiAzioneFormato(nuovoEditor(stato(conMargini([par('A')], [par('B')]))), { tipo: 'margini' });
    expect('intestazione' in statoCorrente(r.ed).doc).toBe(false);
    expect('piede' in statoCorrente(r.ed).doc).toBe(false);
    expect(testoDi(statoCorrente(r.ed).doc)).toBe('abc');
  });

  it('un\'intestazione o un piè di pagina non ammessi non cambiano niente', () => {
    const ed = nuovoEditor(stato(conMargini([par('A')], [par('B')])));
    const quattro = [par('a'), par('b'), par('c'), par('d')];
    expect(eseguiAzioneFormato(ed, { tipo: 'margini', intestazione: quattro, piede: [par('x')] }).ed).toBe(ed);
    expect(eseguiAzioneFormato(ed, { tipo: 'margini', intestazione: [par('x')], piede: [par('z'.repeat(301))] }).ed).toBe(ed);
    expect(eseguiAzioneFormato(ed, { tipo: 'margini', piede: [par('x', { el: 'p' })] }).ed).toBe(ed);
  });

  it('applicare le stesse cose di prima non aggiunge una voce di storia, e azzera i formati in attesa', () => {
    const ed = nuovoEditor(stato(conMargini([par('A')], [par('B')])));
    const uguale = eseguiAzioneFormato(ed, { tipo: 'margini', intestazione: [par('A')], piede: [par('B')] });
    expect(uguale.ed.storia.passato.length).toBe(ed.storia.passato.length);
    const conPendenti = nuovoEditor({ ...stato(), pendenti: { g: true, c: false, s: false } });
    const r = eseguiAzioneFormato(conPendenti, { tipo: 'margini', intestazione: [par('A')] });
    expect(statoCorrente(r.ed).pendenti).toBeNull();
  });
});

// ---------------------------------------------------------------- il dialogo
async function dialogo(proprieta: Record<string, unknown> = {}): Promise<any> {
  const d: any = document.createElement('docs-margini');
  Object.assign(d, proprieta);
  document.body.appendChild(d);
  await d.updateComplete;
  return d;
}
const area = (d: any, z: 'intestazione' | 'piede'): HTMLTextAreaElement => d.shadowRoot.querySelector(`textarea.${z}`);
const bottone = (d: any, classe: string): HTMLButtonElement => d.shadowRoot.querySelector(`button.${classe}`);
const errore = (d: any): string => d.shadowRoot.querySelector('.errore').textContent.trim();
function scrivi(a: HTMLTextAreaElement, t: string): void { a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }
function tasto(c: HTMLElement, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  c.dispatchEvent(e);
  return e;
}
function ascolta(d: any, nome: string): Array<any> {
  const visti: any[] = [];
  d.addEventListener(nome, (e: Event) => visti.push((e as CustomEvent).detail));
  return visti;
}
const premuti = (d: any, z: 'intestazione' | 'piede'): string[] => Array.from(d.shadowRoot.querySelectorAll(`textarea.${z} + .allineamento button`) as NodeListOf<HTMLElement>)
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.className);

describe('T303 il dialogo di intestazione e piè di pagina', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mostra i testi e gli allineamenti di partenza', async () => {
    const d = await dialogo({ intestazioneIniziale: 'Relazione', piedeIniziale: 'Pag. {pagina} di {pagine}', allineamentoIntestazione: 'ce', allineamentoPiede: 'dx' });
    expect(area(d, 'intestazione').value).toBe('Relazione');
    expect(area(d, 'piede').value).toBe('Pag. {pagina} di {pagine}');
    expect(premuti(d, 'intestazione')).toEqual(['allinea-ce']);
    expect(premuti(d, 'piede')).toEqual(['allinea-dx']);
    expect(d.shadowRoot.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Intestazioni e piè di pagina');
    expect(Array.from(d.shadowRoot.querySelectorAll('label')).map((l: any) => l.textContent)).toEqual(['Intestazione', 'Piè di pagina']);
    const vuoto = await dialogo();
    expect(area(vuoto, 'intestazione').value).toBe('');
    expect(premuti(vuoto, 'intestazione')).toEqual(['allinea-sx']);
  });

  it('i pulsanti di allineamento sono Sinistra, Centro e Destra, in quest\'ordine, per tutte e due le caselle', async () => {
    const d = await dialogo();
    for (const z of ['intestazione', 'piede'] as const) {
      const nomi = Array.from(d.shadowRoot.querySelectorAll(`textarea.${z} + .allineamento button`) as NodeListOf<HTMLElement>).map((b) => [b.className, b.textContent]);
      expect(nomi, z).toEqual([['allinea-sx', 'Sinistra'], ['allinea-ce', 'Centro'], ['allinea-dx', 'Destra']]);
    }
    expect(d.shadowRoot.querySelector('textarea.intestazione + .allineamento').getAttribute('aria-label')).toBe('Allineamento: intestazione');
    expect(d.shadowRoot.querySelector('textarea.piede + .allineamento').getAttribute('aria-label')).toBe('Allineamento: piè di pagina');
  });

  it('un allineamento cambia solo la sua casella', async () => {
    const d = await dialogo({ intestazioneIniziale: 'a', piedeIniziale: 'b', allineamentoPiede: 'dx' });
    d.shadowRoot.querySelector('textarea.intestazione + .allineamento .allinea-ce').click();
    await d.updateComplete;
    expect(premuti(d, 'intestazione')).toEqual(['allinea-ce']);
    expect(premuti(d, 'piede')).toEqual(['allinea-dx']);
    d.shadowRoot.querySelector('textarea.piede + .allineamento .allinea-sx').click();
    await d.updateComplete;
    expect(premuti(d, 'intestazione')).toEqual(['allinea-ce']);
    expect(premuti(d, 'piede')).toEqual(['allinea-sx']);
    const visti = ascolta(d, 'applica');
    bottone(d, 'applica').click();
    expect(visti[0].intestazione[0].al).toBe('ce');
    expect(visti[0].piede[0].al).toBeUndefined();
  });

  it('i valori dati dopo la creazione aggiornano le caselle', async () => {
    const d = await dialogo();
    d.intestazioneIniziale = 'Nuova';
    d.allineamentoPiede = 'ce';
    await d.updateComplete;
    expect(area(d, 'intestazione').value).toBe('Nuova');
    expect(premuti(d, 'piede')).toEqual(['allinea-ce']);
  });

  it('il cursore parte nella casella scelta, in fondo al testo', async () => {
    const d = await dialogo({ intestazioneIniziale: 'abc', piedeIniziale: 'defg', zona: 'piede' });
    d.focalizza();
    expect(d.shadowRoot.activeElement).toBe(area(d, 'piede'));
    expect(area(d, 'piede').selectionStart).toBe(4);
    const primo = await dialogo({ intestazioneIniziale: 'abc', zona: 'intestazione' });
    primo.focalizza();
    expect(primo.shadowRoot.activeElement).toBe(area(primo, 'intestazione'));
  });

  it('Applica dà i paragrafi con l\'allineamento scelto; la casella vuota toglie', async () => {
    const d = await dialogo({ intestazioneIniziale: 'Titolo' });
    const visti = ascolta(d, 'applica');
    bottone(d, 'allinea-ce').click();
    await d.updateComplete;
    bottone(d, 'applica').click();
    expect(visti).toEqual([{ intestazione: [par('Titolo', { al: 'ce' })], piede: undefined }]);
    const due = await dialogo({ piedeIniziale: 'a\nb' });
    const vistiDue = ascolta(due, 'applica');
    due.shadowRoot.querySelector('textarea.piede + .allineamento .allinea-dx').click();
    await due.updateComplete;
    bottone(due, 'applica').click();
    expect(vistiDue).toEqual([{ intestazione: undefined, piede: [par('a', { al: 'dx' }), par('b', { al: 'dx' })] }]);
    const sx = await dialogo({ intestazioneIniziale: 'x', allineamentoIntestazione: 'ce' });
    const vistiSx = ascolta(sx, 'applica');
    sx.shadowRoot.querySelector('textarea.intestazione + .allineamento .allinea-sx').click();
    await sx.updateComplete;
    bottone(sx, 'applica').click();
    expect(Object.keys(vistiSx[0].intestazione[0])).toEqual(['runs']);
  });

  it('un allineamento giustificato arrivato da un file resta se non si tocca', async () => {
    const d = await dialogo({ intestazioneIniziale: 'x', allineamentoIntestazione: 'gi' });
    expect(premuti(d, 'intestazione')).toEqual([]);
    const visti = ascolta(d, 'applica');
    bottone(d, 'applica').click();
    expect(visti[0].intestazione[0].al).toBe('gi');
  });

  it('i campi {pagina} e {pagine} diventano i campi del numero di pagina', async () => {
    const d = await dialogo({ piedeIniziale: 'Pag. {pagina} di {pagine}' });
    const visti = ascolta(d, 'applica');
    bottone(d, 'applica').click();
    expect(visti[0].piede).toEqual([par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`)]);
  });

  it('i pulsanti dei campi scrivono nella casella dove si stava, nel punto del cursore o al posto della selezione', async () => {
    const d = await dialogo({ intestazioneIniziale: 'ab', piedeIniziale: 'cdef', zona: 'intestazione' });
    const i = area(d, 'intestazione');
    i.setSelectionRange(1, 1);
    bottone(d, 'campo-pagina').click();
    await d.updateComplete;
    expect(i.value).toBe('a{pagina}b');
    expect(area(d, 'piede').value).toBe('cdef');
    const p = area(d, 'piede');
    p.dispatchEvent(new Event('focus'));
    p.setSelectionRange(1, 3);
    bottone(d, 'campo-pagine').click();
    await d.updateComplete;
    expect(p.value).toBe('c{pagine}f');
    expect(i.value).toBe('a{pagina}b');
    const visti = ascolta(d, 'applica');
    bottone(d, 'applica').click();
    expect(visti[0].intestazione).toEqual([par(`a${CAMPO_PAGINA}b`)]);
    expect(visti[0].piede).toEqual([par(`c${CAMPO_PAGINE}f`)]);
  });

  it('senza aver toccato nessuna casella, i pulsanti dei campi scrivono in quella di partenza, e il cursore va dopo il campo', async () => {
    const d = await dialogo({ intestazioneIniziale: 'ab', piedeIniziale: 'cd', zona: 'piede' });
    area(d, 'piede').setSelectionRange(2, 2);
    bottone(d, 'campo-pagina').click();
    await d.updateComplete;
    expect(area(d, 'piede').value).toBe('cd{pagina}');
    expect(area(d, 'intestazione').value).toBe('ab');
    expect(d.shadowRoot.activeElement).toBe(area(d, 'piede'));
    expect(area(d, 'piede').selectionStart).toBe(10);
    expect(area(d, 'piede').selectionEnd).toBe(10);
    const primo = await dialogo({ intestazioneIniziale: 'ab' });
    area(primo, 'intestazione').setSelectionRange(1, 1);
    bottone(primo, 'campo-pagine').click();
    await primo.updateComplete;
    expect(area(primo, 'intestazione').value).toBe('a{pagine}b');
    expect(primo.shadowRoot.activeElement).toBe(area(primo, 'intestazione'));
    expect(area(primo, 'intestazione').selectionStart).toBe(9);
  });

  it('più di tre righe o una riga troppo lunga: un avviso e niente applicato; l\'avviso sparisce scrivendo', async () => {
    const d = await dialogo();
    const visti = ascolta(d, 'applica');
    scrivi(area(d, 'intestazione'), 'a\nb\nc\nd');
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).toBe("L'intestazione: al massimo 3 righe");
    expect(visti.length).toBe(0);
    scrivi(area(d, 'intestazione'), 'a\nb\nc');
    await d.updateComplete;
    expect(errore(d)).toBe('');
    scrivi(area(d, 'piede'), 'x'.repeat(301));
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).toBe('Il piè di pagina: una riga supera i 300 caratteri');
    expect(visti.length).toBe(0);
    scrivi(area(d, 'piede'), 'a\nb\nc\nd');
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).toBe('Il piè di pagina: al massimo 3 righe');
    scrivi(area(d, 'intestazione'), 'y'.repeat(301));
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).toBe("L'intestazione: una riga supera i 300 caratteri");
    scrivi(area(d, 'intestazione'), 'y'.repeat(300));
    scrivi(area(d, 'piede'), 'z'.repeat(300));
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).toBe('');
    expect(visti.length).toBe(1);
  });

  it('i campi contano un carattere solo nel limite delle 300 lettere, e gli errori spariscono scegliendo un campo', async () => {
    const d = await dialogo();
    const visti = ascolta(d, 'applica');
    scrivi(area(d, 'intestazione'), `${'x'.repeat(290)}{pagina}{pagine}`);
    bottone(d, 'applica').click();
    expect(visti.length).toBe(1);
    scrivi(area(d, 'piede'), 'a\nb\nc\nd');
    bottone(d, 'applica').click();
    await d.updateComplete;
    expect(errore(d)).not.toBe('');
    bottone(d, 'campo-pagina').click();
    await d.updateComplete;
    expect(errore(d)).toBe('');
  });

  it('Annulla, Esc e Ctrl+Invio; l\'Invio da solo va a capo e non applica', async () => {
    const d = await dialogo({ intestazioneIniziale: 'x' });
    const chiusure = ascolta(d, 'chiudi');
    const applicazioni = ascolta(d, 'applica');
    bottone(d, 'annulla').click();
    expect(chiusure.length).toBe(1);
    const esc = tasto(area(d, 'intestazione'), 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(chiusure.length).toBe(2);
    const invio = tasto(area(d, 'piede'), 'Enter');
    expect(invio.defaultPrevented).toBe(false);
    expect(applicazioni.length).toBe(0);
    const ctrl = tasto(area(d, 'intestazione'), 'Enter', { ctrlKey: true });
    expect(ctrl.defaultPrevented).toBe(true);
    expect(applicazioni.length).toBe(1);
    tasto(area(d, 'piede'), 'Enter', { metaKey: true });
    expect(applicazioni.length).toBe(2);
    tasto(area(d, 'piede'), 'a');
    expect(chiusure.length).toBe(2);
  });
});

// ---------------------------------------------------------------- nel guscio
async function guscio(s: Stato): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato(s);
  return { g, ed };
}
async function vociMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  (barraMenu.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await attendi();
  await g.updateComplete;
  const d = g.shadowRoot.querySelector('docs-margini');
  if (d) await d.updateComplete;
}
const dialogoDi = (g: any): any => g.shadowRoot.querySelector('docs-margini');
const zonaDi = (ed: any, classe: string): string[] => Array.from(ed.shadowRoot.querySelectorAll(`.margini .${classe} p`) as NodeListOf<HTMLElement>).map((x) => x.textContent ?? '');

describe('T303 nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Formato > Intestazioni e piè di pagina apre il dialogo con quello che c\'è, e Applica li mette nel documento e nei fogli', async () => {
    const { g, ed } = await guscio(stato(conMargini([par('Testata', { al: 'ce' })], [par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`, { al: 'dx' })])));
    expect(dialogoDi(g)).toBeNull();
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    const d = dialogoDi(g);
    expect(d).not.toBeNull();
    expect(d.shadowRoot.activeElement).toBe(area(d, 'intestazione'));
    expect(area(d, 'intestazione').value).toBe('Testata');
    expect(area(d, 'piede').value).toBe('Pag. {pagina} di {pagine}');
    expect(premuti(d, 'intestazione')).toEqual(['allinea-ce']);
    expect(premuti(d, 'piede')).toEqual(['allinea-dx']);
    scrivi(area(d, 'intestazione'), 'Nuova testata');
    bottone(d, 'applica').click();
    await attendi();
    await g.updateComplete;
    expect(dialogoDi(g)).toBeNull();
    expect(ed.stato.doc.intestazione).toEqual([par('Nuova testata', { al: 'ce' })]);
    expect(zonaDi(ed, 'intestazione')).toEqual(['Nuova testata']);
    expect(zonaDi(ed, 'piede')).toEqual(['Pag. 1 di 1']);
    expect(testoDi(ed.stato.doc)).toBe('abc');
  });

  it('con un documento senza intestazione né piè di pagina le caselle sono vuote; scrivere e applicare le crea, annullare le toglie', async () => {
    const { g, ed } = await guscio(stato());
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    const d = dialogoDi(g);
    expect(area(d, 'intestazione').value).toBe('');
    expect(area(d, 'piede').value).toBe('');
    scrivi(area(d, 'intestazione'), 'Riga uno\nRiga due');
    scrivi(area(d, 'piede'), 'Fine');
    bottone(d, 'applica').click();
    await attendi();
    expect(zonaDi(ed, 'intestazione')).toEqual(['Riga uno', 'Riga due']);
    expect(zonaDi(ed, 'piede')).toEqual(['Fine']);
    ed.applicaAzione({ tipo: 'annulla' });
    expect(zonaDi(ed, 'intestazione')).toEqual([]);
    expect(zonaDi(ed, 'piede')).toEqual([]);
    expect('intestazione' in ed.stato.doc).toBe(false);
  });

  it('svuotare le caselle toglie intestazione e piè di pagina', async () => {
    const { g, ed } = await guscio(stato(conMargini([par('A')], [par('B')])));
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    const d = dialogoDi(g);
    scrivi(area(d, 'intestazione'), '');
    scrivi(area(d, 'piede'), '');
    bottone(d, 'applica').click();
    await attendi();
    expect('intestazione' in ed.stato.doc).toBe(false);
    expect('piede' in ed.stato.doc).toBe(false);
    expect(zonaDi(ed, 'intestazione')).toEqual([]);
  });

  it('Formato > Numeri di pagina: con il piè di pagina vuoto lo prepara col numero a destra e il cursore lì', async () => {
    const { g, ed } = await guscio(stato());
    await vociMenu(g, 'formato', 'Numeri di pagina');
    const d = dialogoDi(g);
    expect(d.shadowRoot.activeElement).toBe(area(d, 'piede'));
    expect(area(d, 'piede').value).toBe('{pagina}');
    expect(premuti(d, 'piede')).toEqual(['allinea-dx']);
    expect(area(d, 'intestazione').value).toBe('');
    bottone(d, 'applica').click();
    await attendi();
    expect(ed.stato.doc.piede).toEqual([par(CAMPO_PAGINA, { al: 'dx' })]);
    expect(zonaDi(ed, 'piede')).toEqual(['1']);
    expect('intestazione' in ed.stato.doc).toBe(false);
  });

  it('Numeri di pagina con un piè di pagina già scritto lo lascia com\'è', async () => {
    const { g } = await guscio(stato(conMargini(undefined, [par('Ufficio', { al: 'ce' })])));
    await vociMenu(g, 'formato', 'Numeri di pagina');
    const d = dialogoDi(g);
    expect(area(d, 'piede').value).toBe('Ufficio');
    expect(premuti(d, 'piede')).toEqual(['allinea-ce']);
  });

  it('un testo non ammesso lascia il dialogo aperto con l\'avviso e il documento com\'era', async () => {
    const { g, ed } = await guscio(stato(conMargini([par('A')])));
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    const d = dialogoDi(g);
    scrivi(area(d, 'intestazione'), 'a\nb\nc\nd');
    bottone(d, 'applica').click();
    await attendi();
    await g.updateComplete;
    expect(dialogoDi(g)).not.toBeNull();
    expect(errore(dialogoDi(g))).toBe("L'intestazione: al massimo 3 righe");
    expect(ed.stato.doc.intestazione).toEqual([par('A')]);
  });

  it('Annulla ed Esc chiudono il dialogo senza cambiare niente', async () => {
    const { g, ed } = await guscio(stato(conMargini([par('A')])));
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    scrivi(area(dialogoDi(g), 'intestazione'), 'Altra');
    bottone(dialogoDi(g), 'annulla').click();
    await attendi();
    expect(dialogoDi(g)).toBeNull();
    expect(ed.stato.doc.intestazione).toEqual([par('A')]);
    expect(ed.shadowRoot.activeElement?.className).toBe('ingresso');
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    expect(dialogoDi(g)).not.toBeNull();
    tasto(area(dialogoDi(g), 'intestazione'), 'Escape');
    await attendi();
    expect(dialogoDi(g)).toBeNull();
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await attendi();
    expect(dialogoDi(g)).toBeNull();
    expect(ed.stato.doc.intestazione).toEqual([par('A')]);
  });

  it('riaprendo il dialogo si trovano i testi appena applicati', async () => {
    const { g } = await guscio(stato());
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    scrivi(area(dialogoDi(g), 'piede'), 'Pag. {pagina} di {pagine}');
    bottone(dialogoDi(g), 'applica').click();
    await attendi();
    await vociMenu(g, 'formato', 'Intestazioni e piè di pagina');
    expect(area(dialogoDi(g), 'piede').value).toBe('Pag. {pagina} di {pagine}');
  });
});
