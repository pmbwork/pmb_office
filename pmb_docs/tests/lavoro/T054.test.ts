import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { esporta, importa } from '../../src/formati/file';
import { testoDi, daTesto } from '../../src/modello/documento';

interface Salvato { nome: string; bytes: Uint8Array; mime: string }

async function guscio(): Promise<{ g: any; ed: any; salvati: Salvato[] }> {
  const g: any = document.createElement('docs-guscio');
  const salvati: Salvato[] = [];
  g.salva = async (nome: string, bytes: Uint8Array, mime: string) => { salvati.push({ nome, bytes, mime }); };
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  return { g, ed, salvati };
}
const casella = (ed: any): HTMLTextAreaElement => ed.shadowRoot.querySelector('textarea.ingresso');
function scrivi(ed: any, testo: string): void {
  const c = casella(ed);
  c.value = testo;
  c.dispatchEvent(new Event('input', { bubbles: true }));
}
const testoPagina = (ed: any): string => Array.from(ed.shadowRoot.querySelectorAll('.testo p')).map((p: any) => p.textContent).join('\n');
/** L'intestazione è fissa («PMB_Docs»): il titolo del documento (che dà il nome al file) è solo lo stato del guscio, e cambia aprendo un file. */
const titolo = (g: any): { value: string; dispatchEvent: (e?: Event) => boolean } => ({
  get value(): string { return g.titoloVisibile(g.titolo); },
  set value(v: string) { g.titolo = v; },
  dispatchEvent: () => { g.copiaDiEmergenza(); return true; },
});
const intestazione = (g: any): HTMLInputElement => g.shadowRoot.querySelector('input.titolo-documento');
async function finche(condizione: () => boolean, ms = 3000): Promise<void> {
  const fine = Date.now() + ms;
  while (!condizione() && Date.now() < fine) await new Promise((r) => setTimeout(r, 10));
}
async function voceMenu(g: any, menu: string, voce: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const v = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === voce)!;
  v.click();
  await new Promise((r) => setTimeout(r, 30));
  await g.updateComplete;
}
function tasto(g: any, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...extra });
  g.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('textarea').dispatchEvent(e);
  return e;
}

describe('T054: titolo, nuovo documento e avvisi', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it("intestazione come pmb_sheets: etichetta pmb_docs, nome del documento (clic, Invio conferma, Esc annulla), stato del salvataggio", async () => {
    const { g, ed } = await guscio();
    const r = g.shadowRoot;
    expect(r.querySelector('.logo-app').getAttribute('aria-label')).toBe('pmb_docs');
    const nome = (): HTMLElement => r.querySelector('.intestazione .titolo-documento');
    expect(nome().tagName).toBe('SPAN');
    expect(nome().textContent!.trim()).toBe('Documento senza titolo');
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Non salvato su disco (Ctrl+S)');
    // clic: diventa un campo; Invio conferma
    nome().click(); await g.updateComplete;
    const campo = r.querySelector('input.titolo-documento') as HTMLInputElement;
    expect(campo).not.toBeNull();
    campo.value = 'Relazione';
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await g.updateComplete;
    expect(nome().tagName).toBe('SPAN');
    expect(nome().textContent!.trim()).toBe('Relazione');
    expect(titolo(g).value).toBe('Relazione');
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Non salvato su disco (Ctrl+S)'); // senza un file su disco lo stato lo dice (rinominare apre il salvataggio)
    // Esc annulla
    nome().click(); await g.updateComplete;
    const campo2 = r.querySelector('input.titolo-documento') as HTMLInputElement;
    campo2.value = 'Altro';
    campo2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await g.updateComplete;
    expect(nome().textContent!.trim()).toBe('Relazione');
    // un nome vuoto non si accetta
    nome().click(); await g.updateComplete;
    const campo3 = r.querySelector('input.titolo-documento') as HTMLInputElement;
    campo3.value = '   ';
    campo3.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await g.updateComplete;
    expect(nome().textContent!.trim()).toBe('Relazione');
    // scrivendo nel documento lo stato diventa «Modifiche non salvate»
    scrivi(ed, 'qualcosa');
    await g.updateComplete;
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Non salvato su disco (Ctrl+S)');
    // nel browser il salvataggio è un download: senza un file aperto dal programma lo stato resta «Non salvato su disco»
    await g.scarica('docx');
    await g.updateComplete;
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Non salvato su disco (Ctrl+S)');
  });

  it('File > Nuovo svuota il documento e rimette il titolo di partenza; File > Rinomina rende modificabile il nome nell’intestazione', async () => {
    const { g, ed } = await guscio();
    scrivi(ed, 'testo da buttare');
    titolo(g).value = 'Vecchio';
    titolo(g).dispatchEvent(new Event('input', { bubbles: true }));
    await voceMenu(g, 'file', 'Nuovo');
    expect(testoPagina(ed)).toBe('');
    expect(titolo(g).value).toBe('Documento senza titolo');
    scrivi(ed, 'x');
    tasto(g, 'z', { ctrlKey: true });
    tasto(g, 'z', { ctrlKey: true });
    expect(testoPagina(ed)).toBe('');
    await voceMenu(g, 'file', 'Rinomina');
    await g.updateComplete;
    const campo = g.shadowRoot.querySelector('input.titolo-documento') as HTMLInputElement;
    expect(campo).not.toBeNull();
    expect(campo.value).toBe('Documento senza titolo');
  });
});

describe('T054: salvataggio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('File > Scarica ha un sottomenu con i formati; ogni voce salva un file col nome del titolo', async () => {
    const { g, ed, salvati } = await guscio();
    scrivi(ed, 'Ciao\nmondo');
    titolo(g).value = 'Lettera: bozza?';
    titolo(g).dispatchEvent(new Event('input', { bubbles: true }));
    const attesi = ['Documento (.docx)', 'Testo normale (.txt)', 'Documento pmb_docs (.pdoc)', 'OpenDocument (.odt)', 'Documento PDF (.pdf)'];
    for (let i = 0; i < attesi.length; i++) {
      // si apre passando sopra la voce (nessun clic), poi si sceglie il formato
      const barra: any = g.shadowRoot.querySelector('docs-menubar');
      (barra.shadowRoot.querySelector('button.titolo-menu[data-menu="file"]') as HTMLButtonElement).click();
      await barra.updateComplete;
      const scarica = (Array.from(barra.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Scarica')!;
      scarica.dispatchEvent(new MouseEvent('mouseenter'));
      await barra.updateComplete;
      const figli = Array.from(barra.shadowRoot.querySelectorAll('.sottopannello[data-sotto="Scarica"] .figlio')) as HTMLElement[];
      expect(figli.map((v) => (v.textContent ?? '').trim())).toEqual(attesi);
      figli[i].click();
      await finche(() => salvati.length === i + 1);
      await g.updateComplete;
      expect(barra.shadowRoot.querySelector('.pannello')).toBeNull();
    }
    expect(salvati.map((s) => s.nome)).toEqual(['Lettera bozza.docx', 'Lettera bozza.txt', 'Lettera bozza.pdoc', 'Lettera bozza.odt', 'Lettera bozza.pdf']);
    expect(salvati[0].mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(testoDi((await importa(salvati[0].bytes, salvati[0].nome)).doc)).toBe('Ciao\nmondo');
    expect(new TextDecoder().decode(salvati[1].bytes)).toBe('Ciao\r\nmondo');
    expect(testoDi((await importa(salvati[2].bytes, salvati[2].nome)).doc)).toBe('Ciao\nmondo');
  });

  it('Ctrl+S salva in .docx senza aprire menu; un errore di scrittura diventa un avviso', async () => {
    const { g, ed, salvati } = await guscio();
    scrivi(ed, 'uno');
    const e = tasto(g, 's', { ctrlKey: true });
    await finche(() => salvati.length === 1);
    expect(e.defaultPrevented).toBe(true);
    expect(salvati.map((s) => s.nome)).toEqual(['Documento senza titolo.docx']);
    expect(g.shadowRoot.querySelector('docs-popup')).toBeNull();
    g.salva = async () => { throw new Error('disco pieno'); };
    tasto(g, 's', { ctrlKey: true });
    await finche(() => g.shadowRoot.querySelector('.avviso') !== null, 3000);
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('disco pieno');
    expect(g.shadowRoot.querySelector('.avviso')?.getAttribute('role')).toBe('alert');
  });
});

describe('T054: apertura', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Ctrl+O e File > Apri: il documento scelto prende il posto di quello attuale, col suo titolo; annulla non torna al vecchio', async () => {
    const { g, ed } = await guscio();
    scrivi(ed, 'vecchio testo');
    const bytes = await esporta(daTesto('Primo\nSecondo'), 'docx');
    let scelte = 0;
    g.scegli = async () => { scelte++; return new File([bytes], 'Contratto di prova.docx'); };
    const e = tasto(g, 'o', { ctrlKey: true });
    await finche(() => testoPagina(ed) === 'Primo\nSecondo');
    await g.updateComplete;
    expect(e.defaultPrevented).toBe(true);
    expect(scelte).toBe(1);
    expect(testoPagina(ed)).toBe('Primo\nSecondo');
    expect(titolo(g).value).toBe('Contratto di prova');
    expect(g.shadowRoot.querySelector('.avviso')).toBeNull();
    tasto(g, 'z', { ctrlKey: true });
    expect(testoPagina(ed)).toBe('Primo\nSecondo');
    g.scegli = async () => { scelte++; return new File([new TextEncoder().encode('da testo')], 'nota.txt'); };
    await voceMenu(g, 'file', 'Apri');
    await finche(() => testoPagina(ed) === 'da testo');
    expect(scelte).toBe(2);
    expect(testoPagina(ed)).toBe('da testo');
    await g.updateComplete;
    expect(titolo(g).value).toBe('nota');
  });

  it('rinunciare o scegliere un file sbagliato lascia tutto com\'era e mostra l\'avviso', async () => {
    const { g, ed } = await guscio();
    scrivi(ed, 'resta');
    g.scegli = async () => null;
    await g.apri();
    expect(testoPagina(ed)).toBe('resta');
    expect(g.shadowRoot.querySelector('.avviso')).toBeNull();
    g.scegli = async () => new File([new Uint8Array([1, 2, 0, 3])], 'strano.bin');
    await g.apri();
    await g.updateComplete;
    expect(testoPagina(ed)).toBe('resta');
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('strano.bin');
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('non riconosciuto');
    expect(titolo(g).value).toBe('Documento senza titolo');
  });
});
