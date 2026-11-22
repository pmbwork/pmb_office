// T537: in pmb_sheets «Salva» riscrive il file sul posto, come in pmb_docs (T536; segnalazione dell'utente, 2026-11-18). Apri usa la finestra di
// Windows dalla parte nativa (comune/src/file-nativi.ts), il file di avvio porta il suo percorso; la parte nativa qui è finta.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/main';
import { installaFinestreNative } from '@comune/file-nativi';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { documentoDaScambio, foglioVuoto } from '../../src/formati/scambio';
import { serializeSheetDocumentData } from '../../src/sheet/document-data';

const attendi = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));
interface Chiamata { comando: string; argomenti: unknown; opzioni: unknown }
let chiamate: Chiamata[];
let risposte: Record<string, (a: unknown) => unknown>;
const finestraVera = { open: (window as any).showOpenFilePicker, save: (window as any).showSaveFilePicker };
const fatte = (c: string): Chiamata[] => chiamate.filter((x) => x.comando === c);
const fileDiProva = (testo: string): ArrayBuffer => {
  const b = new TextEncoder().encode(serializeSheetDocumentData(documentoDaScambio({ fogli: [{ ...foglioVuoto('Foglio1'), celle: { A1: testo } }], foglioAttivo: 'Foglio1' })));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

let app: any;
beforeEach(async () => {
  chiamate = [];
  risposte = {};
  (window as any).__TAURI__ = { core: { invoke: async (comando: string, argomenti?: unknown, opzioni?: unknown) => {
    chiamate.push({ comando, argomenti, opzioni });
    const r = risposte[comando];
    return r ? r(argomenti) : null;
  } }, event: { listen: async () => () => {} } };
  document.body.innerHTML = '';
  localStorage.clear();
  defaultDocumentStore.clear();
  app = document.createElement('free-app');
  document.body.appendChild(app);
  await app.updateComplete;
  await attendi();
});
afterEach(() => {
  delete (window as any).__TAURI__;
  (window as any).showOpenFilePicker = finestraVera.open;
  (window as any).showSaveFilePicker = finestraVera.save;
});
const menu = async (action: string): Promise<void> => {
  app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
  await attendi(); await app.updateComplete;
};
const doc = (): any => defaultDocumentStore.getOrCreateDocument(app.activeTabId);

describe('T537: pmb_sheets, Salva sul file aperto', () => {
  it('un file aperto con Apri (finestra di Windows) si risalva sul posto, senza «Salva con nome»', async () => {
    risposte.file_apri_finestra = () => 'C:\\Conti\\bilancio.psheet';
    risposte.file_leggi = () => fileDiProva('dal file');
    installaFinestreNative({ t: (s) => s });
    await menu('open-file');
    await attendi(100);
    expect((await doc().client.getCell(doc().activeSheetName, 1, 1)).raw).toBe('dal file');
    await doc().client.setCell(doc().activeSheetName, 1, 1, 'cambiato');
    await menu('save-file');
    await attendi(100);
    expect(fatte('file_salva_finestra')).toHaveLength(0);
    expect(fatte('file_scrivi').map((c) => (c.opzioni as any).headers.percorso)).toEqual([encodeURIComponent('C:\\Conti\\bilancio.psheet')]);
  });
  it('un file aperto con doppio clic porta il suo percorso e si risalva sul posto', async () => {
    // dal 2026-11-18: nome, percorso ed eventuale problema; i byte si leggono grezzi con file_leggi (come in pmb_docs)
    risposte.file_di_avvio = () => ({ nome: 'avvio.psheet', percorso: 'D:\\Lavoro\\avvio.psheet', problema: null });
    risposte.file_leggi = () => fileDiProva('avvio');
    await app.apriDaAvvio();
    await attendi(100);
    expect((await doc().client.getCell(doc().activeSheetName, 1, 1)).raw).toBe('avvio');
    await doc().client.setCell(doc().activeSheetName, 1, 1, 'altro');
    await menu('save-file');
    await attendi(100);
    expect(fatte('file_scrivi').map((c) => (c.opzioni as any).headers.percorso)).toEqual([encodeURIComponent('D:\\Lavoro\\avvio.psheet')]);
  });
  it('un file di avvio che non si apre (troppo grande, formato, sparito) si dice nella barra di stato, senza leggerlo', async () => {
    const stato = (): string => (app as any).statusMessage;
    risposte.file_di_avvio = () => ({ nome: 'enorme.xlsx', percorso: 'D:\\enorme.xlsx', problema: 'TROPPO_GRANDE' });
    await app.apriDaAvvio();
    expect(stato()).toContain('enorme.xlsx');
    expect(stato()).toContain('100 MB');
    risposte.file_di_avvio = () => ({ nome: 'lettera.docx', percorso: 'D:\\lettera.docx', problema: 'FORMATO_NON_SUPPORTATO' });
    await app.apriDaAvvio();
    expect(stato()).toContain('lettera.docx');
    expect(stato()).toContain('pmb_sheets');
    risposte.file_di_avvio = () => ({ nome: 'sparito.csv', percorso: 'D:\\sparito.csv', problema: 'NON_TROVATO' });
    await app.apriDaAvvio();
    expect(stato()).toContain('sparito.csv');
    expect(fatte('file_leggi')).toHaveLength(0);
  });
});
