// T445: schede (Tab) del documento.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { leggiZip } from '@comune/formati/zip';
import { MENU } from '../../src/guscio/menu-dati';
import { esportaSchede, importa } from '../../src/formati/file';
import { importaDocx } from '../../src/formati/docx';
import { cursore, daTesto, statoIniziale, type Documento } from '../../src/modello/documento';
import { SCHEDE_MASSIME, leggiSchede, serializzaSchede, titoloNuovaScheda, titoloSchedaValido, unisciSchede, type Scheda } from '../../src/modello/schede';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
const testi = (d: Documento): string[] => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const scheda = (titolo: string, testo: string): Scheda => ({ titolo, doc: daTesto(testo) });

describe('T445: modello delle schede', () => {
  it('titoloSchedaValido ripulisce gli spazi e rifiuta vuoti, troppo lunghi e caratteri di controllo', () => {
    expect(titoloSchedaValido('  Capitolo   uno ')).toBe('Capitolo uno');
    expect(titoloSchedaValido('   ')).toBeNull();
    expect(titoloSchedaValido('a'.repeat(81))).toBeNull();
    expect(titoloSchedaValido('a\u0007')).toBeNull();
  });
  it('titoloNuovaScheda non ripete un nome già usato', () => {
    expect(titoloNuovaScheda(['Scheda 1'])).toBe('Scheda 2');
    expect(titoloNuovaScheda(['Scheda 1', 'Scheda 2'])).toBe('Scheda 3');
    expect(titoloNuovaScheda(['Scheda 2'])).toBe('Scheda 3');
    expect(titoloNuovaScheda(['Altro', 'scheda 2'])).toBe('Scheda 3');
  });
  it('unisciSchede: una sola scheda resta com\'è; con più, ognuna ha il suo titolo e comincia su un foglio nuovo', () => {
    const a = scheda('Uno', 'testo a'); const b = scheda('Due', 'testo b\nriga 2');
    expect(unisciSchede([a])).toBe(a.doc);
    const m = unisciSchede([a, b]);
    expect(testi(m)).toEqual(['Uno', 'testo a', 'Due', 'testo b', 'riga 2']);
    expect(m.paragrafi.map((p) => [p.st, p.sp === true])).toEqual([['1', false], [undefined, false], ['1', true], [undefined, false], [undefined, false]]);
  });
  it('unisciSchede rinumera le tabelle perché due schede non ne abbiano di uguali', () => {
    const tab = (i: number): Documento => ({ paragrafi: [{ tb: { i, r: 0, c: 0 }, runs: [] }, { tb: { i, r: 0, c: 1 }, runs: [] }, { runs: [] }] });
    const m = unisciSchede([{ titolo: 'A', doc: tab(0) }, { titolo: 'B', doc: tab(0) }]);
    expect([...new Set(m.paragrafi.filter((p) => p.tb).map((p) => p.tb!.i))]).toEqual([0, 1]);
  });
  it('serializza e rilegge le schede (.fdoc); un documento normale non è un file a schede', () => {
    const s = [scheda('Uno', 'a'), scheda('Due', 'b')];
    const letto = leggiSchede(serializzaSchede(s))!;
    expect(letto.map((x) => [x.titolo, testi(x.doc)])).toEqual([['Uno', ['a']], ['Due', ['b']]]);
    expect(leggiSchede('{"v":1,"p":[[]]}')).toBeNull();
    expect(leggiSchede('non json')).toBeNull();
  });
  it('un file a schede rotto dà un errore chiaro', () => {
    expect(() => leggiSchede('{"v":1,"schede":[]}')).toThrow(/da 1 a/);
    expect(() => leggiSchede(`{"v":1,"schede":${JSON.stringify(Array(SCHEDE_MASSIME + 1).fill({ t: 'x', d: '{}' }))}}`)).toThrow(/da 1 a/);
    expect(() => leggiSchede('{"v":1,"schede":[{"t":"x"}]}')).toThrow(/scheda/);
    expect(() => leggiSchede('{"v":1,"schede":[{"t":"x","d":"{}"}]}')).toThrow();
  });
  it('un titolo mancante o non valido nel file diventa "Scheda N"', () => {
    const s = serializzaSchede([scheda('', 'a'), scheda('Due', 'b')]).replace('"t":""', '"t":"   "');
    expect(leggiSchede(s)!.map((x) => x.titolo)).toEqual(['Scheda 1', 'Due']);
  });
});

describe('T445: salvataggio e apertura', () => {
  it('.fdoc con più schede si riapre con le schede; con una sola è il formato di sempre', async () => {
    const bytes = await esportaSchede([scheda('Uno', 'a'), scheda('Due', 'b')], 'fdoc');
    const r = await importa(bytes, 'prova.fdoc');
    expect(r.schede?.map((s) => s.titolo)).toEqual(['Uno', 'Due']);
    expect(testi(r.doc)).toEqual(['a']);
    const una = await importa(await esportaSchede([scheda('Uno', 'a')], 'fdoc'), 'prova.fdoc');
    expect(una.schede).toBeUndefined();
  });
  it('.docx con più schede: una dopo l\'altra, con i titoli e l\'interruzione di pagina', async () => {
    const letto = await importaDocx(await esportaSchede([scheda('Uno', 'a'), scheda('Due', 'b')], 'docx'));
    expect(testi(letto)).toEqual(['Uno', 'a', 'Due', 'b']);
    expect(letto.paragrafi.map((p) => p.sp === true)).toEqual([false, false, true, false]);
    expect(letto.paragrafi[0].st).toBe('1');
  });
  it('.txt, .odt e PDF si producono con tutte le schede', async () => {
    const s = [scheda('Uno', 'primo'), scheda('Due', 'secondo')];
    const txt = new TextDecoder().decode(await esportaSchede(s, 'txt'));
    expect(txt).toContain('Uno');
    expect(txt).toContain('secondo');
    const odt = new TextDecoder().decode((await leggiZip(await esportaSchede(s, 'odt'))).get('content.xml')!);
    expect(odt).toContain('Due');
    expect(new TextDecoder('latin1').decode(await esportaSchede(s, 'pdf'))).toContain('(secondo)');
  });
});

async function guscio(): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('prima scheda')), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}
async function voceMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await barra.updateComplete;
  await attendi(60);
  await g.updateComplete;
}
const lato = (g: any): any => g.shadowRoot.querySelector('docs-schede');
const evento = (el: any, nome: string, detail: object = {}): void => { el.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true })); };

describe('T445: schede nel guscio', () => {
  it('nessuna voce di menu è più grigia', () => {
    expect(MENU.flatMap((m) => m.voci).filter((v) => v.disabilitata)).toEqual([]);
  });
  it('con una scheda sola l\'elenco non c\'è; Inserisci › Tab (e Maiusc+F11) ne aggiunge una e mostra l\'elenco', async () => {
    const g = await guscio();
    expect(lato(g)).toBeNull();
    await voceMenu(g, 'inserisci', 'Tab');
    expect(lato(g)).not.toBeNull();
    expect(lato(g).titoli).toEqual(['Scheda 1', 'Scheda 2']);
    expect(lato(g).attiva).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', shiftKey: true, bubbles: true }));
    await g.updateComplete;
    expect(lato(g).titoli).toEqual(['Scheda 1', 'Scheda 2', 'Scheda 3']);
  });
  it('si passa da una scheda all\'altra senza perdere testo né storia di annulla', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 12 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: '!' });
    g.nuovaScheda();
    await g.updateComplete;
    expect(testi(ed.stato.doc)).toEqual(['']);
    ed.applicaAzione({ tipo: 'testo', testo: 'seconda' });
    evento(lato(g), 'seleziona', { i: 0 });
    await g.updateComplete;
    expect(testi(ed.stato.doc)).toEqual(['prima scheda!']);
    ed.annulla();
    expect(testi(ed.stato.doc)).toEqual(['prima scheda']);
    ed.ripeti();
    evento(lato(g), 'seleziona', { i: 1 });
    await g.updateComplete;
    expect(testi(ed.stato.doc)).toEqual(['seconda']);
    ed.annulla();
    expect(testi(ed.stato.doc)).toEqual(['']);
  });
  it('rinomina (anche rifiutando un nome vuoto) ed elimina, con la scheda attiva che si sposta', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.nuovaScheda(); ed.applicaAzione({ tipo: 'testo', testo: 'due' });
    g.nuovaScheda(); ed.applicaAzione({ tipo: 'testo', testo: 'tre' });
    await g.updateComplete;
    evento(lato(g), 'rinomina', { i: 1, titolo: '  Capitolo  due ' });
    await g.updateComplete;
    expect(lato(g).titoli).toEqual(['Scheda 1', 'Capitolo due', 'Scheda 3']);
    evento(lato(g), 'rinomina', { i: 1, titolo: '   ' });
    await g.updateComplete;
    expect(lato(g).titoli[1]).toBe('Capitolo due');
    expect(g.avviso).toMatch(/non può essere vuoto/);
    evento(lato(g), 'elimina', { i: 2 }); // la scheda attiva: si passa alla precedente
    await g.updateComplete;
    expect(lato(g).titoli).toEqual(['Scheda 1', 'Capitolo due']);
    expect(lato(g).attiva).toBe(1);
    expect(testi(ed.stato.doc)).toEqual(['due']);
    evento(lato(g), 'elimina', { i: 0 }); // una non attiva davanti: l'indice si aggiorna
    await g.updateComplete;
    expect(lato(g)).toBeNull(); // resta una scheda sola: l'elenco sparisce
    expect(testi(ed.stato.doc)).toEqual(['due']);
    g.eliminaScheda(0);
    expect(testi(ed.stato.doc)).toEqual(['due']); // l'ultima scheda non si elimina
  });
  it('al massimo 20 schede', async () => {
    const g = await guscio();
    for (let i = 0; i < SCHEDE_MASSIME + 3; i++) g.nuovaScheda();
    await g.updateComplete;
    expect(lato(g).titoli.length).toBe(SCHEDE_MASSIME);
    expect(g.avviso).toMatch(/Al massimo 20/);
  });
  it('Salva in .fdoc scrive tutte le schede; Apri le riporta; Nuovo torna a una scheda sola', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.nuovaScheda(); ed.applicaAzione({ tipo: 'testo', testo: 'seconda' });
    await g.updateComplete;
    evento(lato(g), 'rinomina', { i: 1, titolo: 'Seconda' });
    let scritto: Uint8Array | null = null;
    g.salva = async (_n: string, b: Uint8Array) => { scritto = b; return null; };
    await g.scarica('fdoc');
    expect(scritto).not.toBeNull();
    const letto = await importa(scritto!, 'x.fdoc');
    expect(letto.schede?.map((s) => [s.titolo, testi(s.doc)])).toEqual([['Scheda 1', ['prima scheda']], ['Seconda', ['seconda']]]);
    g.nuovo();
    await g.updateComplete;
    expect(lato(g)).toBeNull();
    expect(testi(ed.stato.doc)).toEqual(['']);
    g.scegli = async () => new File([scritto!], 'x.fdoc');
    await g.apri();
    await g.updateComplete;
    expect(lato(g).titoli).toEqual(['Scheda 1', 'Seconda']);
    expect(testi(ed.stato.doc)).toEqual(['prima scheda']);
    evento(lato(g), 'seleziona', { i: 1 });
    await g.updateComplete;
    expect(testi(ed.stato.doc)).toEqual(['seconda']);
  });
  it('Salva in .docx mette le schede una dopo l\'altra con il titolo', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.nuovaScheda(); ed.applicaAzione({ tipo: 'testo', testo: 'contenuto due' });
    let scritto: Uint8Array | null = null;
    g.salva = async (_n: string, b: Uint8Array) => { scritto = b; return null; };
    await g.scarica('docx');
    expect(testi(await importaDocx(scritto!))).toEqual(['Scheda 1', 'prima scheda', 'Scheda 2', 'contenuto due']);
  });
  it('la copia di emergenza tiene il testo di tutte le schede', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.nuovaScheda(); ed.applicaAzione({ tipo: 'testo', testo: 'seconda' });
    await g.updateComplete;
    g.recupero.scriviOra();
    const copia = g.recupero.trova();
    expect(copia).not.toBeNull();
    expect(testi(copia.doc)).toEqual(['Scheda 1', 'prima scheda', 'Scheda 2', 'seconda']);
  });
});
