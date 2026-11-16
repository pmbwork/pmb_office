// La finestra «Apri / Salva con nome» interna della versione pocket (comune/src/file-portatile.ts), con la parte nativa finta.
// Lo stesso file c'è in pmb_docs/tests/file-portatile.test.ts: tenerli uguali.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installaFinestraFilePortatile, scegliFilePortatili } from '@comune/file-portatile';

const attendi = (ms = 10): Promise<void> => new Promise((r) => setTimeout(r, ms));
type Voce = { nome: string; cartella: boolean; dimensione: number; modificato: number };
// un piccolo disco finto: cartella → voci; file → byte
let disco: Record<string, Voce[]>;
let contenuti: Record<string, Uint8Array>;
let chiamate: Array<{ comando: string; argomenti: unknown; opzioni: unknown }>;
const w = window as unknown as Record<string, unknown>;

beforeEach(() => {
  document.body.innerHTML = '';
  disco = {
    'F:\\': [{ nome: 'Documenti', cartella: true, dimensione: 0, modificato: 0 }, { nome: 'lettera.docx', cartella: false, dimensione: 2048, modificato: Date.UTC(2026, 10, 14) }, { nome: 'foto.png', cartella: false, dimensione: 10, modificato: 0 }],
    'F:\\Documenti': [{ nome: 'relazione.docx', cartella: false, dimensione: 5, modificato: 0 }],
  };
  contenuti = { 'F:\\Documenti\\relazione.docx': new Uint8Array([1, 2, 3]) };
  chiamate = [];
  w.__PMB_PORTATILE__ = true;
  w.__TAURI__ = { core: { invoke: async (comando: string, argomenti?: any, opzioni?: any) => {
    chiamate.push({ comando, argomenti, opzioni });
    switch (comando) {
      case 'portatile_unita': return ['C:\\', 'F:\\'];
      case 'portatile_cartella_iniziale': return 'F:\\';
      case 'portatile_ricorda_cartella': return null;
      case 'portatile_elenca': {
        const c = argomenti.cartella as string;
        if (!disco[c]) throw 'CARTELLA: non trovata';
        return { cartella: c, sopra: c === 'F:\\' ? '' : 'F:\\', voci: disco[c], troncato: false };
      }
      case 'portatile_leggi': return contenuti[argomenti.percorsoFile].buffer;
      case 'portatile_scrivi': contenuti[decodeURIComponent(opzioni.headers.percorso)] = argomenti; return null;
      case 'portatile_nuova_cartella': { const n = (argomenti.cartella.endsWith('\\') ? argomenti.cartella : `${argomenti.cartella}\\`) + argomenti.nome; disco[n] = []; disco[argomenti.cartella].push({ nome: argomenti.nome, cartella: true, dimensione: 0, modificato: 0 }); return n; }
      default: throw new Error('comando sconosciuto ' + comando);
    }
  } } };
});
/** Una scelta lasciata aperta di proposito: quando la si chiude (Esc del test dopo, fine del test) non deve risultare un errore. */
const ignora = (p: Promise<unknown>): void => { p.catch(() => undefined); };
afterEach(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); delete w.__PMB_PORTATILE__; delete w.__TAURI__; delete w.showOpenFilePicker; delete w.showSaveFilePicker; vi.restoreAllMocks(); });

const radice = (): ShadowRoot => document.querySelector('[data-pmb-finestra-file]')!.shadowRoot!;
const righe = (): HTMLElement[] => Array.from(radice().querySelectorAll('.riga[role="option"]')) as HTMLElement[];
const nomi = (): string[] => righe().map((r) => r.dataset.nome!);
const pulsante = (testo: string): HTMLButtonElement => (Array.from(radice().querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent === testo)!;
const campoNome = (): HTMLInputElement => radice().querySelector('input[aria-label="Nome file:"]') as HTMLInputElement;
const t = (s: string, ...v: Array<string | number>): string => { let i = 0; return s.replace(/\{\}/g, () => String(v[i++])); };

describe('finestra «Apri / Salva» della versione pocket', () => {
  it('fuori dalla pocket non cambia niente', () => {
    delete w.__PMB_PORTATILE__;
    expect(installaFinestraFilePortatile({ t, locale: () => 'it-IT' })).toBe(false);
    expect(w.showSaveFilePicker).toBeUndefined();
  });

  it('Salva con nome: parte dall\'ultima cartella, propone il nome, mostra solo le cartelle e i file del tipo giusto, aggiunge l\'estensione e scrive tramite la parte nativa', async () => {
    expect(installaFinestraFilePortatile({ t, locale: () => 'it-IT' })).toBe(true);
    const scelta = (w.showSaveFilePicker as any)({ suggestedName: 'Documento senza titolo.docx', types: [{ description: 'DOCX', accept: { 'application/vnd': ['.docx'] } }] });
    await attendi();
    expect(campoNome().value).toBe('Documento senza titolo.docx');
    expect(nomi()).toEqual(['Documenti', 'lettera.docx']); // foto.png non è del tipo scelto
    campoNome().value = 'verbale';
    pulsante('Salva').click();
    const maniglia = await scelta;
    expect(maniglia.name).toBe('verbale.docx');
    expect(maniglia.percorso).toBe('F:\\verbale.docx');
    const scrivi = await maniglia.createWritable();
    await scrivi.write(new Uint8Array([7, 8]));
    await scrivi.write(new Uint8Array([9]));
    await scrivi.close();
    expect(Array.from(contenuti['F:\\verbale.docx'])).toEqual([7, 8, 9]);
    expect(chiamate.some((c) => c.comando === 'portatile_ricorda_cartella')).toBe(true);
    expect(document.querySelector('[data-pmb-finestra-file]')).toBeNull();
  });

  it('se il file esiste già chiede se sostituirlo; rispondendo no la finestra resta aperta', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    const domanda = vi.spyOn(window, 'confirm').mockReturnValue(false);
    ignora((w.showSaveFilePicker as any)({ suggestedName: 'lettera.docx', types: [{ description: 'DOCX', accept: { x: ['.docx'] } }] }));
    await attendi();
    pulsante('Salva').click();
    await attendi();
    expect(domanda).toHaveBeenCalledWith('«lettera.docx» esiste già. Vuoi sostituirlo?');
    expect(document.querySelector('[data-pmb-finestra-file]')).not.toBeNull();
  });

  it('un nome con caratteri non ammessi non si accetta', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    ignora((w.showSaveFilePicker as any)({ suggestedName: 'a', types: [] }));
    await attendi();
    campoNome().value = 'a:b?';
    pulsante('Salva').click();
    await attendi();
    expect(radice().querySelector('.avviso')!.textContent).toContain('non può contenere');
    expect(document.querySelector('[data-pmb-finestra-file]')).not.toBeNull();
  });

  it('Apri: con un doppio clic si entra nella cartella, si sceglie il file e lo si legge dalla parte nativa', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    const scelta = (w.showOpenFilePicker as any)({ types: [{ description: 'Documenti', accept: { x: ['.docx'] } }] });
    await attendi();
    righe().find((r) => r.dataset.nome === 'Documenti')!.dispatchEvent(new MouseEvent('dblclick'));
    await attendi();
    expect(nomi()).toEqual(['relazione.docx']);
    righe()[0].click();
    pulsante('Apri').click();
    const [maniglia] = await scelta;
    const file: File = await maniglia.getFile();
    expect(file.name).toBe('relazione.docx');
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it('Esc o Annulla: la scelta è annullata come con la finestra di Windows (AbortError)', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    const scelta = (w.showOpenFilePicker as any)({});
    await attendi();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(scelta).rejects.toMatchObject({ name: 'AbortError' });
    const scelta2 = (w.showSaveFilePicker as any)({ suggestedName: 'x' });
    await attendi();
    pulsante('Annulla').click();
    await expect(scelta2).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('una cartella che non si apre lo dice, senza chiudere la finestra', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    ignora((w.showOpenFilePicker as any)({}));
    await attendi();
    const campo = radice().querySelector('input[aria-label="Cartella"]') as HTMLInputElement;
    campo.value = 'F:\\non-esiste';
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    await attendi();
    expect(radice().querySelector('.avviso')!.textContent).toContain('Non riesco ad aprire la cartella');
  });

  it('Nuova cartella crea la cartella e ci entra', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    vi.spyOn(window, 'prompt').mockReturnValue('Lavoro');
    ignora((w.showSaveFilePicker as any)({ suggestedName: 'x.docx' }));
    await attendi();
    pulsante('Nuova cartella').click();
    await attendi();
    expect((radice().querySelector('input[aria-label="Cartella"]') as HTMLInputElement).value).toBe('F:\\Lavoro');
  });

  it('al posto di un campo «scegli file»: annullare dà un elenco vuoto', async () => {
    installaFinestraFilePortatile({ t, locale: () => 'it-IT' });
    const scelta = scegliFilePortatili('.png,.jpg');
    await attendi();
    expect(nomi()).toEqual(['Documenti', 'foto.png']);
    pulsante('Annulla').click();
    expect(await scelta).toEqual([]);
  });
});
