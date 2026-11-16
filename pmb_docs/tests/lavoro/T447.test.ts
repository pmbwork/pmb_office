// T447: correzioni dalla revisione del codice: correttore (doppio clic, posizioni), modifiche non salvate, Esc, copia di emergenza, schede.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import { Recupero, type Archivio } from '../../src/formati/recupero';
import { inserisciBlocco } from '../../src/editor/blocchi';
import { cursore, daTesto, statoIniziale, type Documento } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const CORREZIONI: Record<string, string[]> = { sbagliatto: ['sbagliato'], perche: ['perché'] };
let chiamate: Array<{ comando: string; args: Record<string, unknown> }> = [];
function installaFinto(ritardo = 0): void {
  chiamate = [];
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: async (comando: string, args: Record<string, unknown>) => {
      chiamate.push({ comando, args });
      if (ritardo) await attendi(ritardo);
      if (comando === 'ortografia_controlla') {
        return (args.paragrafi as string[]).map((t) => {
          const out: Array<{ da: number; a: number; azione: number; sostituto: string }> = [];
          for (const m of t.matchAll(/[\p{L}]+/gu)) if (CORREZIONI[m[0].toLowerCase()]) out.push({ da: m.index!, a: m.index! + m[0].length, azione: 0, sostituto: '' });
          return out;
        });
      }
      if (comando === 'ortografia_suggerisci') return CORREZIONI[(args.parola as string).toLowerCase()] ?? [];
      if (comando === 'ortografia_lingua') return true;
      throw new Error(`comando sconosciuto ${comando}`);
    },
  };
}
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
afterEach(() => { delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; localStorage.clear(); vi.restoreAllMocks(); });

async function guscio(testo = 'uno sbagliatto\ndue sbagliatto\ntre'): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto(testo)), sel: cursore(0, 0) });
  await g.updateComplete;
  g.nuovo(); // parte da un documento "salvato"
  ed.impostaStato({ ...statoIniziale(daTesto(testo)), sel: cursore(0, 0) });
  g.ricordaSalvato(g.schedeComplete());
  await g.updateComplete;
  return g;
}
const testi = (d: Documento): string[] => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const dialogo = (g: any, n: string): any => g.shadowRoot.querySelector(n);
const evento = (el: any, nome: string, detail: object = {}): void => { el.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true })); };

describe('T447: correttore, azioni una alla volta e per posizione', () => {
  it('un doppio clic su Cambia non sostituisce due volte né tocca un altro punto', async () => {
    installaFinto(15);
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await g.apriOrtografia(); await g.updateComplete;
    evento(dialogo(g, 'docs-ortografia'), 'cambia', { testo: 'sbagliato' });
    evento(dialogo(g, 'docs-ortografia'), 'cambia', { testo: 'sbagliato' }); // secondo clic mentre il primo lavora
    await attendi(250); await g.updateComplete;
    expect(testi(ed.stato.doc).slice(0, 2)).toEqual(['uno sbagliato', 'due sbagliatto']); // solo il primo è cambiato
  });
  it('la sostituzione non avviene se il testo non è più quello trovato dal controllo', async () => {
    installaFinto();
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.controllaOrtografiaOra();
    const err = ed.erroriOrtografici[0];
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 0 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: 'XX' }); // le posizioni dell'errore ora sono sfasate
    expect(ed.sostituisciErroreOrtografia(err, 'sbagliato')).toBe(false);
    expect(testi(ed.stato.doc)[0]).toBe('XXuno sbagliatto');
  });
  it('Ignora tutto non salta gli errori che non si sono ancora visti', async () => {
    installaFinto();
    const g = await guscio('perche uno\nsbagliatto a\nperche due\nsbagliatto b');
    await g.apriOrtografia(); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia').parola).toBe('perche');
    evento(dialogo(g, 'docs-ortografia'), 'ignora'); // salta il primo «perche»
    await attendi(120); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia').parola).toBe('sbagliatto');
    evento(dialogo(g, 'docs-ortografia'), 'ignora-tutto'); // toglie tutti i «sbagliatto»
    await attendi(120); await g.updateComplete;
    // restano «perche» (già saltato, prima) e «perche» (terzo paragrafo, mai visto): si deve mostrare quello mai visto
    expect(dialogo(g, 'docs-ortografia')).not.toBeNull();
    expect(dialogo(g, 'docs-ortografia').parola).toBe('perche');
    expect(dialogo(g, 'docs-ortografia').contesto).toContain('due');
  });
  it('cambiando scheda o aprendo un documento la finestra del correttore si chiude', async () => {
    installaFinto();
    const g = await guscio();
    await g.apriOrtografia(); await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).not.toBeNull();
    g.nuovaScheda();
    await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
    await g.apriOrtografia().catch(() => {});
    g.cambiaScheda(0); g.nuovo();
    await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
  });
});

describe('T447: modifiche non salvate', () => {
  it('modificato() è falso appena aperto o salvato e vero dopo aver scritto; Annulla non lo riporta a falso (oggetto diverso)', async () => {
    const g = await guscio('testo');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(g.modificato()).toBe(false);
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 5 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: '!' });
    expect(g.modificato()).toBe(true);
    g.ricordaSalvato(g.schedeComplete());
    expect(g.modificato()).toBe(false);
  });
  it('Nuovo e Apri chiedono conferma solo se c\'è qualcosa da perdere; se si dice no non cambia niente', async () => {
    const g = await guscio('testo');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);
    g.nuovoConConferma();
    expect(conferma).not.toHaveBeenCalled(); // niente di modificato: nessuna domanda, e il documento nuovo è subito pronto
    expect(testi(ed.stato.doc)).toEqual(['']);
    ed.impostaStato({ ...statoIniziale(daTesto('testo')), sel: cursore(0, 0) });
    g.ricordaSalvato(g.schedeComplete());
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 5 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: '!' });
    g.nuovoConConferma();
    expect(conferma).toHaveBeenCalledTimes(1);
    expect(testi(ed.stato.doc)).toEqual(['testo!']); // risposto no: il documento resta
    conferma.mockReturnValue(true);
    g.nuovoConConferma();
    expect(testi(ed.stato.doc)).toEqual(['']); // risposto sì: documento nuovo
    expect(g.modificato()).toBe(false);
  });
  it('Apri (menu e Ctrl+O) chiede conferma prima di mostrare il selettore dei file', async () => {
    const g = await guscio('testo');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 5 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: '!' });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    let selettori = 0;
    g.scegli = async () => { selettori++; return null; };
    await g.apriConConferma();
    expect(selettori).toBe(0);
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    await g.apriConConferma();
    expect(selettori).toBe(1);
  });
  it('salvare mentre si scrive: la copia di emergenza resta se il documento è cambiato durante il salvataggio', async () => {
    const g = await guscio('testo');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 5 }, estendi: false });
    ed.applicaAzione({ tipo: 'testo', testo: 'A' });
    let scartata = 0;
    g.recupero.scarta = () => { scartata++; };
    g.salva = async () => { ed.applicaAzione({ tipo: 'testo', testo: 'B' }); return null; }; // si scrive mentre si salva
    await g.scarica('txt');
    expect(scartata).toBe(0);
    expect(g.modificato()).toBe(true);
    g.salva = async () => null; // questa volta niente nel frattempo
    await g.scarica('txt');
    expect(scartata).toBe(1);
    expect(g.modificato()).toBe(false);
  });
});

describe('T447: Esc chiude la finestra aperta per ultima', () => {
  it('con ortografia sopra Equazione, il primo Esc chiude l\'ortografia e il secondo l\'equazione', async () => {
    installaFinto();
    const g = await guscio();
    g.apriFinestraImmagine('equazione');
    await g.updateComplete;
    await g.apriOrtografia(); await g.updateComplete;
    expect(dialogo(g, 'docs-equazione')).not.toBeNull();
    expect(dialogo(g, 'docs-ortografia')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(dialogo(g, 'docs-ortografia')).toBeNull();
    expect(dialogo(g, 'docs-equazione')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(dialogo(g, 'docs-equazione')).toBeNull();
  });
});

describe('T447: copia di emergenza e blocchi', () => {
  it('il documento "pigro" si calcola solo quando si scrive davvero, e una sola volta', () => {
    let scritto = ''; let calcoli = 0;
    const archivio: Archivio = { leggi: () => null, scrivi: (t) => { scritto = t; return true; }, cancella: () => {} };
    let ora = 0;
    const r = new Recupero(archivio, { ritardo: 1000, ora: () => ora, imposta: () => 1, annulla: () => {} });
    const doc = daTesto('ciao');
    for (let i = 0; i < 50; i++) r.segnala('t', () => { calcoli++; return doc; });
    expect(calcoli).toBe(0);
    r.scriviOra();
    expect(calcoli).toBe(1);
    expect(scritto).toContain('ciao');
  });
  it('inserire un componente su un paragrafo con linea orizzontale, salto di pagina o segnalibro non lo cancella', () => {
    for (const attr of [{ hr: true }, { sp: true }, { sg: 'Qui' }, { bd: { w: 1, c: '#000000', s: 'c' as const } }]) {
      const st = { doc: { paragrafi: [{ ...attr, runs: [] }] } as Documento, sel: cursore(0, 0), pendenti: null };
      const n = inserisciBlocco(st, [{ runs: [{ t: 'X', g: false, c: false, s: false }] }]);
      expect(n.doc.paragrafi.length).toBe(3); // il paragrafo originale resta, poi il blocco e il paragrafo vuoto
      expect(Object.keys(n.doc.paragrafi[0])).toContain(Object.keys(attr)[0]);
    }
    const vuoto = inserisciBlocco({ doc: daTesto(''), sel: cursore(0, 0), pendenti: null }, [{ runs: [{ t: 'X', g: false, c: false, s: false }] }]);
    expect(vuoto.doc.paragrafi.length).toBe(2); // un paragrafo davvero vuoto invece si sostituisce
  });
});

describe('T447: lingua cambiata durante un controllo', () => {
  it('i risultati della lingua vecchia non finiscono nella cache della lingua nuova', async () => {
    installaFinto(40);
    const g = await guscio('testo giusto');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    const primo = ed.controllaOrtografiaOra();
    await attendi(10);
    ed.impostaOrtografia(false, 'en-US'); // cambia lingua mentre il controllo gira
    const secondo = ed.controllaOrtografiaOra();
    await Promise.all([primo, secondo]);
    const lingue = chiamate.filter((c) => c.comando === 'ortografia_controlla').map((c) => c.args.lingua);
    expect(lingue[lingue.length - 1]).toBe('en-US'); // alla fine si è ricontrollato nella lingua nuova
  });
});
