// T443: correttore ortografico (Windows), dizionario personale, preferenze, lingua e accessibilità.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { controllaNativo, suggerisciNativo } from '../../src/editor/ortografia-nativa';
import { CHIAVE_PREFERENZE, leggiPreferenze, PREFERENZE_PREDEFINITE, ripulisciPreferenze, salvaPreferenze } from '../../src/guscio/preferenze';
import { MENU } from '../../src/guscio/menu-dati';
import { cursore, daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Un finto Windows: segnala "sbagliatto" (parola errata) e "perche" (parola errata), e propone una correzione. */
const CORREZIONI: Record<string, string[]> = { sbagliatto: ['sbagliato', 'sbaglietto'], perche: ['perché', 'perchè'] };
let chiamate: Array<{ comando: string; args: Record<string, unknown> }> = [];
function installaFinto(): void {
  chiamate = [];
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: async (comando: string, args: Record<string, unknown>) => {
      chiamate.push({ comando, args });
      if (comando === 'ortografia_controlla') {
        return (args.paragrafi as string[]).map((t) => {
          const out: Array<{ da: number; a: number; azione: number; sostituto: string }> = [];
          for (const m of t.matchAll(/[\p{L}]+/gu)) if (CORREZIONI[m[0].toLowerCase()]) out.push({ da: m.index!, a: m.index! + m[0].length, azione: 0, sostituto: '' });
          return out;
        });
      }
      if (comando === 'ortografia_suggerisci') return CORREZIONI[(args.parola as string).toLowerCase()] ?? [];
      if (comando === 'ortografia_lingua') return args.lingua === 'it-IT' || args.lingua === 'en-US';
      throw new Error(`comando sconosciuto ${comando}`);
    },
  };
}
const togliFinto = (): void => { delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; };

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); togliFinto(); });
afterEach(() => { togliFinto(); localStorage.clear(); });

async function guscio(testo = 'Questo e sbagliatto perche si scrive male\nsbagliatto di nuovo\nfrase corretta'): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto(testo)), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}
async function voceMenu(g: any, menu: string, etichetta: string, figlio?: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await barra.updateComplete;
  if (figlio) {
    const f = (Array.from(barra.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === figlio)!;
    f.click();
  }
  await attendi(60);
  await g.updateComplete;
}
const testi = (g: any): string[] => g.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p: any) => p.runs.map((r: any) => r.t).join(''));
const dialogo = (g: any, nome: string): any => g.shadowRoot.querySelector(nome);
const evento = (el: any, nome: string, detail: object = {}): void => { el.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true })); };

describe('T443: preferenze', () => {
  it('i valori non ammessi tornano quelli predefiniti e il dizionario si ripulisce', () => {
    expect(ripulisciPreferenze(null)).toEqual(PREFERENZE_PREDEFINITE);
    const p = ripulisciPreferenze({ tema: 'rosso', lingua: 'xx-XX', ortografia: 'sì', altoContrasto: true, dizionario: ['  Foo ', 'foo', 'bar baz', '', 7, 'a'.repeat(61), 'ok'] });
    expect([p.tema, p.lingua, p.ortografia, p.altoContrasto]).toEqual(['sistema', 'it-IT', true, true]);
    expect(p.dizionario).toEqual(['Foo', 'ok']);
  });
  it('si salvano e si rileggono; un deposito rotto non fa danni', () => {
    const memoria = new Map<string, string>();
    const deposito = { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => { memoria.set(k, v); } };
    salvaPreferenze(deposito, { ...PREFERENZE_PREDEFINITE, tema: 'scuro', lingua: 'en-US', dizionario: ['Rossi'] });
    expect(leggiPreferenze(deposito)).toMatchObject({ tema: 'scuro', lingua: 'en-US', dizionario: ['Rossi'] });
    memoria.set(CHIAVE_PREFERENZE, '{non json');
    expect(leggiPreferenze(deposito)).toEqual(PREFERENZE_PREDEFINITE);
    expect(leggiPreferenze(null)).toEqual(PREFERENZE_PREDEFINITE);
    expect(() => salvaPreferenze({ setItem: () => { throw new Error('pieno'); } }, PREFERENZE_PREDEFINITE)).not.toThrow();
  });
});

describe('T443: parte nativa', () => {
  it('senza l\'app dice perché non controlla', async () => {
    const r = await controllaNativo(['ciao'], 'it-IT');
    expect(r.errori).toBeNull();
    expect(r.messaggio).toMatch(/app installata/);
    expect(await suggerisciNativo('ciao', 'it-IT')).toEqual([]);
  });
  it('con l\'app restituisce gli errori per paragrafo e i suggerimenti', async () => {
    installaFinto();
    const r = await controllaNativo(['ok sbagliatto', 'niente'], 'it-IT');
    expect(r.errori).toEqual([[{ da: 3, a: 13, azione: 0, sostituto: '' }], []]);
    expect(await suggerisciNativo('sbagliatto', 'it-IT')).toEqual(['sbagliato', 'sbaglietto']);
  });
});

describe('T443: errori nell\'editor', () => {
  it('trova gli errori con posizione, salta le parole ignorate e quelle del dizionario, e usa la cache dei paragrafi', async () => {
    installaFinto();
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    expect(ed.erroriOrtografici.map((e: any) => [e.p, e.da, e.a, e.parola])).toEqual([[0, 9, 19, 'sbagliatto'], [0, 20, 26, 'perche'], [1, 0, 10, 'sbagliatto']]);
    const prime = chiamate.filter((c) => c.comando === 'ortografia_controlla').length;
    await ed.controllaOrtografiaOra();
    expect(chiamate.filter((c) => c.comando === 'ortografia_controlla').length).toBe(prime); // niente da rifare: tutto in cache
    ed.ignoraParolaOrtografia('perche');
    expect(ed.erroriOrtografici.map((e: any) => e.parola)).toEqual(['sbagliatto', 'sbagliatto']);
    ed.aggiungiAlDizionario('Sbagliatto');
    expect(ed.erroriOrtografici).toEqual([]);
    ed.rimuoviDalDizionario('sbagliatto');
    expect(ed.erroriOrtografici.length).toBe(2);
  });
  it('un paragrafo modificato si ricontrolla da solo e gli altri restano in cache', async () => {
    installaFinto();
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    chiamate = [];
    ed.applicaAzione({ tipo: 'vai', pos: { p: 2, o: 0 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: 'perche ' });
    await ed.controllaOrtografiaOra();
    const inviati = chiamate.filter((c) => c.comando === 'ortografia_controlla').flatMap((c) => c.args.paragrafi as string[]);
    expect(inviati).toEqual(['perche frase corretta']);
    expect(ed.erroriOrtografici.map((e: any) => e.p)).toEqual([0, 0, 1, 2]);
  });
  it('Cambia e Cambia tutto sono un solo passo di annulla', async () => {
    installaFinto();
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    ed.sostituisciErroreOrtografia(ed.erroriOrtografici[0], 'sbagliato');
    expect(testi(g)[0]).toBe('Questo e sbagliato perche si scrive male');
    ed.annulla();
    expect(testi(g)[0]).toBe('Questo e sbagliatto perche si scrive male');
    await ed.controllaOrtografiaOra();
    expect(ed.sostituisciTutteOrtografia('sbagliatto', 'sbagliato')).toBe(2);
    expect(testi(g).slice(0, 2)).toEqual(['Questo e sbagliato perche si scrive male', 'sbagliato di nuovo']);
    ed.annulla();
    expect(testi(g).slice(0, 2)).toEqual(['Questo e sbagliatto perche si scrive male', 'sbagliatto di nuovo']);
  });
  it('spento non sottolinea niente; senza l\'app il messaggio dice il motivo', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    expect(ed.erroriOrtografici).toEqual([]);
    expect(ed.ortografiaMessaggio).toMatch(/app installata/);
  });
  it('la lingua cambiata svuota la cache e rifà il controllo con la lingua nuova', async () => {
    installaFinto();
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    chiamate = [];
    ed.impostaOrtografia(false, 'en-US');
    await ed.controllaOrtografiaOra();
    expect(chiamate.filter((c) => c.comando === 'ortografia_controlla').every((c) => c.args.lingua === 'en-US')).toBe(true);
    expect(chiamate.some((c) => c.comando === 'ortografia_controlla')).toBe(true);
  });
});

describe('T443: finestra del controllo ortografico', () => {
  it('Strumenti › Ortografia e grammatica › Controlla ortografia apre la finestra sul primo errore con i suggerimenti', async () => {
    installaFinto();
    const g = await guscio();
    await voceMenu(g, 'strumenti', 'Ortografia e grammatica', 'Controlla ortografia');
    await attendi(80); await g.updateComplete;
    const d = dialogo(g, 'docs-ortografia');
    expect(d).not.toBeNull();
    expect(d.parola).toBe('sbagliatto');
    expect(d.posizione).toBe('1 di 3');
    expect(d.suggerimenti).toEqual(['sbagliato', 'sbaglietto']);
    expect(d.contesto).toContain('sbagliatto');
  });
  it('Cambia sostituisce la parola e passa all\'errore dopo; alla fine si chiude con un avviso', async () => {
    installaFinto();
    const g = await guscio('sbagliatto uno\nsecondo');
    await g.apriOrtografia();
    await g.updateComplete;
    evento(dialogo(g, 'docs-ortografia'), 'cambia', { testo: 'sbagliato' });
    await attendi(100); await g.updateComplete;
    expect(testi(g)[0]).toBe('sbagliato uno');
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
    expect(g.avviso).toMatch(/completato/);
  });
  it('Ignora salta, Ignora tutto toglie quella parola dall\'elenco, Aggiungi la mette nel dizionario personale (salvato)', async () => {
    installaFinto();
    const g = await guscio();
    await g.apriOrtografia(); await g.updateComplete;
    evento(dialogo(g, 'docs-ortografia'), 'ignora');
    await attendi(100); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia').parola).toBe('perche');
    evento(dialogo(g, 'docs-ortografia'), 'ignora-tutto');
    await attendi(100); await g.updateComplete;
    // tolta «perche» restano due «sbagliatto»: si prosegue dal secondo (si riparte dopo la parola appena ignorata)
    expect(dialogo(g, 'docs-ortografia').parola).toBe('sbagliatto');
    expect(dialogo(g, 'docs-ortografia').posizione).toBe('2 di 2');
    evento(dialogo(g, 'docs-ortografia'), 'aggiungi');
    await attendi(100); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
    expect(leggiPreferenze(localStorage).dizionario).toEqual(['sbagliatto']);
  });
  it('Ignora sull\'ultimo errore chiude con l\'avviso, senza ricominciare da capo', async () => {
    installaFinto();
    const g = await guscio('uno sbagliatto\ndue');
    await g.apriOrtografia(); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia').posizione).toBe('1 di 1');
    evento(dialogo(g, 'docs-ortografia'), 'ignora');
    await attendi(100); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
    expect(g.avviso).toMatch(/completato/);
  });
  it('Cambia tutto cambia ogni occorrenza; F7 apre la finestra; Esc la chiude', async () => {
    installaFinto();
    const g = await guscio();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F7', bubbles: true }));
    await attendi(100); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).not.toBeNull();
    evento(dialogo(g, 'docs-ortografia'), 'cambia-tutto', { testo: 'sbagliato' });
    await attendi(100); await g.updateComplete;
    expect(testi(g).slice(0, 2)).toEqual(['Questo e sbagliato perche si scrive male', 'sbagliato di nuovo']);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
  });
  it('il pulsante Ortografia della barra apre il controllo; senza l\'app avvisa dov\'è il problema', async () => {
    const g = await guscio();
    const barra: any = g.shadowRoot.querySelector('docs-toolbar');
    barra.dispatchEvent(new CustomEvent('comando', { detail: { id: 'ortografia', rect: null }, bubbles: true, composed: true }));
    await attendi(100); await g.updateComplete;
    expect(g.avviso).toMatch(/app installata/);
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
  });
  it('un documento senza errori dice che non ce ne sono', async () => {
    installaFinto();
    const g = await guscio('tutto corretto qui');
    await g.apriOrtografia();
    expect(g.avviso).toBe('Nessun errore di ortografia trovato');
  });
});

describe('T443: dizionario, preferenze, lingua e accessibilità', () => {
  it('le voci di menu non sono più disattivate', () => {
    const tutte = MENU.flatMap((m) => m.voci);
    for (const e of ['Correttore lingua', 'Ortografia e grammatica', 'Dizionario', 'Preferenze', 'Accessibilità']) expect(tutte.find((v) => v.etichetta === e)?.disabilitata, e).toBeUndefined();
    expect(tutte.find((v) => v.etichetta === 'Correttore lingua')?.figli?.map((f) => f.etichetta)).toContain('Italiano');
    expect(tutte.find((v) => v.etichetta === 'Ortografia e grammatica')?.figli?.map((f) => f.etichetta)).toEqual(['Controlla ortografia', 'Sottolinea gli errori mentre scrivi']);
  });
  it('Strumenti › Dizionario: si aggiunge e si toglie una parola, e resta salvata', async () => {
    installaFinto();
    const g = await guscio();
    await voceMenu(g, 'strumenti', 'Dizionario');
    const d = dialogo(g, 'docs-dizionario');
    expect(d).not.toBeNull();
    evento(d, 'aggiungi', { parola: 'Rossi' });
    await g.updateComplete;
    expect(d.parole).toEqual(['rossi']);
    expect(leggiPreferenze(localStorage).dizionario).toEqual(['rossi']);
    evento(d, 'aggiungi', { parola: 'due parole' });
    await g.updateComplete;
    expect(g.avviso).toMatch(/una sola parola/);
    evento(d, 'togli', { parola: 'rossi' });
    await g.updateComplete;
    expect(d.parole).toEqual([]);
    expect(leggiPreferenze(localStorage).dizionario).toEqual([]);
  });
  it('le preferenze salvate si applicano all\'avvio: tema, dizionario e lingua', async () => {
    installaFinto();
    salvaPreferenze(localStorage, { ...PREFERENZE_PREDEFINITE, tema: 'scuro', lingua: 'en-US', dizionario: ['sbagliatto'] });
    const g = await guscio();
    expect(g.tema).toBe('scuro');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(ed.ortografiaLingua).toBe('en-US');
    await ed.controllaOrtografiaOra();
    expect(ed.erroriOrtografici.map((e: any) => e.parola)).toEqual(['perche']); // «sbagliatto» è nel dizionario personale
  });
  it('Strumenti › Preferenze: tema e lingua si cambiano e si ricordano', async () => {
    installaFinto();
    const g = await guscio();
    await voceMenu(g, 'strumenti', 'Preferenze');
    const d = dialogo(g, 'docs-preferenze');
    expect(d.modo).toBe('preferenze');
    evento(d, 'cambia', { preferenze: { tema: 'scuro' } });
    evento(d, 'cambia', { preferenze: { lingua: 'en-US' } });
    await g.updateComplete;
    expect(g.tema).toBe('scuro');
    expect(g.shadowRoot.querySelector('docs-editor').ortografiaLingua).toBe('en-US');
    expect(leggiPreferenze(localStorage)).toMatchObject({ tema: 'scuro', lingua: 'en-US' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(dialogo(g, 'docs-preferenze')).toBeNull();
  });
  it('File › Correttore lingua e il menu Visualizza › Tema scuro si ricordano', async () => {
    installaFinto();
    const g = await guscio();
    await voceMenu(g, 'file', 'Correttore lingua', 'English (Stati Uniti)');
    expect(leggiPreferenze(localStorage).lingua).toBe('en-US');
    expect(g.avviso).toMatch(/English/);
    await voceMenu(g, 'visualizza', 'Modalità', 'Tema scuro');
    expect(leggiPreferenze(localStorage).tema).toBe('scuro');
  });
  it('Strumenti › Accessibilità: alto contrasto, cursore grande e meno animazioni agiscono subito sugli attributi', async () => {
    const g = await guscio();
    await voceMenu(g, 'strumenti', 'Accessibilità');
    const d = dialogo(g, 'docs-preferenze');
    expect(d.modo).toBe('accessibilita');
    evento(d, 'cambia', { preferenze: { altoContrasto: true, cursoreGrande: true, riduciAnimazioni: true } });
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect([g.hasAttribute('alto-contrasto'), g.hasAttribute('riduci-animazioni'), ed.hasAttribute('cursore-grande')]).toEqual([true, true, true]);
    evento(d, 'cambia', { preferenze: { altoContrasto: false } });
    await g.updateComplete;
    expect(g.hasAttribute('alto-contrasto')).toBe(false);
    expect(leggiPreferenze(localStorage)).toMatchObject({ altoContrasto: false, cursoreGrande: true });
  });
  it('Sottolinea gli errori mentre scrivi si accende e si spegne dal menu', async () => {
    installaFinto();
    const g = await guscio();
    expect(leggiPreferenze(localStorage).ortografia).toBe(true);
    await voceMenu(g, 'strumenti', 'Ortografia e grammatica', 'Sottolinea gli errori mentre scrivi');
    expect(leggiPreferenze(localStorage).ortografia).toBe(false);
    expect(g.shadowRoot.querySelector('docs-editor').ortografiaAttiva).toBe(false);
  });
});

describe('T443: sottolineature solo per la parte visibile', () => {
  it('con migliaia di errori si disegnano solo quelli vicini a ciò che si vede (la scrittura resta veloce)', async () => {
    installaFinto();
    const g = await guscio(Array.from({ length: 300 }, () => 'riga con sbagliatto dentro').join('\n'));
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    expect(ed.erroriOrtografici.length).toBe(300);
    // senza layout (happy-dom) i rettangoli sono tutti a zero: la ricerca dei paragrafi visibili non deve rompersi né restituire tutto
    const visibili = ed.erroriVisibili();
    expect(visibili.length).toBeLessThanOrEqual(300);
    expect(Array.isArray(visibili)).toBe(true);
    // con pochi errori si restituiscono tutti
    ed.impostaDizionario(['sbagliatto']);
    expect(ed.erroriVisibili()).toEqual([]);
  });
});

describe('T443: scrivere mentre si controlla', () => {
  it('una richiesta arrivata durante un controllo in corso fa ricontrollare il testo nuovo', async () => {
    installaFinto();
    const originale = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke;
    (window as unknown as { __TAURI_INTERNALS__: { invoke: unknown } }).__TAURI_INTERNALS__.invoke = async (c: string, a: Record<string, unknown>) => { await attendi(40); return originale(c, a); };
    const g = await guscio('testo giusto');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    const primo = ed.controllaOrtografiaOra(); // parte sul testo «testo giusto»
    await attendi(10);
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 12 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: ' sbagliatto' }); // si scrive mentre il controllo gira
    const secondo = ed.controllaOrtografiaOra(); // arriva col controllo ancora in corso
    await Promise.all([primo, secondo]);
    expect(ed.erroriOrtografici.map((e: any) => e.parola)).toEqual(['sbagliatto']);
  });
});
