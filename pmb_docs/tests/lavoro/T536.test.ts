// T536: «Salva» riscrive il file sul posto (segnalazione dell'utente, 2026-11-18: «salva non ti salva direttamente sul file ma ti apre la
// finestra come se fosse salva con nome»). Il browser integrato apriva i file in sola lettura; ora Apri e Salva con nome usano le finestre
// di Windows dalla parte nativa (comune/src/file-nativi.ts, src-tauri/src/file_nativi.rs), che conosce il percorso. Qui la parte nativa è finta.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { cartellaDi, filtriDaTipi, installaFinestreNative, manigliaNativa } from '@comune/file-nativi';
import { esportaSchede } from '../../src/formati/file';
import { daTesto, testoDi } from '../../src/modello/documento';

const attendi = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));
interface Chiamata { comando: string; argomenti: unknown; opzioni: unknown }
let chiamate: Chiamata[];
let risposte: Record<string, (a: unknown) => unknown>;
const finestraVera = { open: (window as any).showOpenFilePicker, save: (window as any).showSaveFilePicker };

beforeEach(() => {
  chiamate = [];
  risposte = {};
  (window as any).__TAURI__ = { core: { invoke: async (comando: string, argomenti?: unknown, opzioni?: unknown) => {
    chiamate.push({ comando, argomenti, opzioni });
    const r = risposte[comando];
    if (!r) return null;
    return r(argomenti);
  } } };
});
afterEach(() => {
  delete (window as any).__TAURI__;
  (window as any).showOpenFilePicker = finestraVera.open;
  (window as any).showSaveFilePicker = finestraVera.save;
});
const fatte = (c: string): Chiamata[] => chiamate.filter((x) => x.comando === c);

describe('T536: le finestre di Windows al posto di quelle del browser', () => {
  it('filtri e cartella', () => {
    expect(filtriDaTipi([{ description: 'Documenti', accept: { 'application/octet-stream': ['.docx', '.ODT', '.pdoc'] } }])).toEqual([{ nome: 'Documenti', estensioni: ['docx', 'odt', 'pdoc'] }]);
    expect(filtriDaTipi([{ description: 'x', accept: { a: '.docx,.txt' } }])[0].estensioni).toEqual(['docx', 'txt']);
    expect(filtriDaTipi([{ description: 'nulla', accept: {} }])).toEqual([]);
    expect(cartellaDi('C:\\Documenti\\lettera.docx')).toBe('C:\\Documenti');
    expect(cartellaDi('lettera.docx')).toBe('');
  });
  it('Apri dà una maniglia che si legge e si riscrive tramite la parte nativa, con il percorso', async () => {
    risposte.file_apri_finestra = () => 'C:\\Documenti\\lettera.docx';
    risposte.file_leggi = () => new Uint8Array([1, 2, 3]).buffer;
    expect(installaFinestreNative({ t: (s) => s })).toBe(true);
    const [m] = await (window as any).showOpenFilePicker({ types: [{ description: 'Documenti', accept: { x: ['.docx'] } }] });
    expect(fatte('file_apri_finestra')[0].argomenti).toEqual({ titolo: 'Apri', filtri: [{ nome: 'Documenti', estensioni: ['docx'] }] });
    expect(m.name).toBe('lettera.docx');
    expect(await m.queryPermission({ mode: 'readwrite' })).toBe('granted');
    expect(new Uint8Array(await (await m.getFile()).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const w = await m.createWritable();
    await w.write(new Uint8Array([9, 8]));
    await w.close();
    const s = fatte('file_scrivi')[0];
    expect(s.argomenti).toEqual(new Uint8Array([9, 8]));
    expect((s.opzioni as any).headers.percorso).toBe(encodeURIComponent('C:\\Documenti\\lettera.docx'));
  });
  it('annullare la finestra è un AbortError, come nel browser', async () => {
    installaFinestreNative({ t: (s) => s });
    await expect((window as any).showOpenFilePicker({})).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('Salva con nome parte dalla cartella del file attuale', async () => {
    risposte.file_salva_finestra = () => 'C:\\Documenti\\copia.docx';
    installaFinestreNative({ t: (s) => s });
    const m = await (window as any).showSaveFilePicker({ suggestedName: 'copia.docx', startIn: manigliaNativa('C:\\Documenti\\lettera.docx') });
    expect(fatte('file_salva_finestra')[0].argomenti).toMatchObject({ titolo: 'Salva con nome', nome: 'copia.docx', cartella: 'C:\\Documenti' });
    expect(m.percorso).toBe('C:\\Documenti\\copia.docx');
  });
  it('se la parte nativa non le ha (Mac, programma vecchio) si torna alle finestre di prima', async () => {
    let usataPrima = 0;
    (window as any).showOpenFilePicker = async () => { usataPrima++; return []; };
    risposte.file_apri_finestra = () => { throw new Error('NON_DISPONIBILE'); };
    installaFinestreNative({ t: (s) => s });
    await (window as any).showOpenFilePicker({});
    await (window as any).showOpenFilePicker({});
    expect(usataPrima).toBe(2);
    expect(fatte('file_apri_finestra')).toHaveLength(1); // la seconda volta non si riprova
  });
  it('nel browser (senza la parte nativa) non si installa niente', () => {
    delete (window as any).__TAURI__;
    expect(installaFinestreNative({ t: (s) => s })).toBe(false);
  });
});

describe('T536: pmb_docs, Apri e poi Salva', () => {
  let g: any;
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    g = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
  });

  it('un file aperto con Apri si risalva sul posto: niente finestra «Salva con nome»', async () => {
    const originale = await esportaSchede([{ titolo: 'Scheda 1', doc: daTesto('Primo testo') }] as any, 'fdoc');
    risposte.file_apri_finestra = () => 'C:\\Documenti\\nota.pdoc';
    risposte.file_leggi = () => originale.buffer.slice(originale.byteOffset, originale.byteOffset + originale.byteLength);
    installaFinestreNative({ t: (s) => s });
    await g.apri();
    await attendi(); await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(testoDi(ed.stato.doc)).toBe('Primo testo');
    ed.impostaStato({ doc: daTesto('Testo cambiato'), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
    ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    await g.updateComplete;
    expect(g.modificato()).toBe(true);
    await g.salvaDocumento();
    expect(fatte('file_salva_finestra')).toHaveLength(0);
    const scritte = fatte('file_scrivi');
    expect(scritte).toHaveLength(1);
    expect((scritte[0].opzioni as any).headers.percorso).toBe(encodeURIComponent('C:\\Documenti\\nota.pdoc'));
    expect(g.modificato()).toBe(false);
  });
  it('un file aperto con doppio clic («Apri con») si risalva sul posto', async () => {
    const originale = await esportaSchede([{ titolo: 'Scheda 1', doc: daTesto('Dal doppio clic') }] as any, 'fdoc');
    risposte.file_di_avvio = () => ({ nome: 'avvio.pdoc', percorso: 'D:\\Lavoro\\avvio.pdoc', problema: null });
    risposte.file_leggi = () => originale.buffer.slice(originale.byteOffset, originale.byteOffset + originale.byteLength);
    await g.apriDaAvvio();
    await attendi(); await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(testoDi(ed.stato.doc)).toBe('Dal doppio clic');
    ed.impostaStato({ doc: daTesto('Cambiato'), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
    ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    await g.updateComplete;
    await g.salvaDocumento();
    expect(fatte('file_scrivi').map((c) => (c.opzioni as any).headers.percorso)).toEqual([encodeURIComponent('D:\\Lavoro\\avvio.pdoc')]);
  });
});
