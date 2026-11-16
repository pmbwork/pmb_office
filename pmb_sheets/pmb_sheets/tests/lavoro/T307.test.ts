import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import * as fileIo from '../../src/formati/file-io';
import '../../src/main';
import { CHIAVE_RECUPERO, INTERVALLO_CONTROLLO, Recupero, pacchettoRecupero, type Archivio } from '../../src/formati/recupero';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { serializeSheetDocumentData } from '../../src/sheet/document-data';
import { documentoDaScambio, foglioVuoto } from '../../src/formati/scambio';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';

const salva = fileIo.salvaSuDisco as unknown as ReturnType<typeof vi.fn>;
const scegli = fileIo.scegliFile as unknown as ReturnType<typeof vi.fn>;

/** un foglio .fsheet valido con una cella scritta */
const dati = (testo: string): string => serializeSheetDocumentData(documentoDaScambio({ foglioAttivo: 'Foglio1', fogli: [{ ...foglioVuoto('Foglio1'), celle: { A1: testo } }] }));
const copia = (schede: Array<{ titolo: string; dati: string }>, salvato = 7000): string => pacchettoRecupero(schede, salvato);

function archivioFinto(contenuto: string | null = null) {
  const a = {
    contenuto,
    scritture: [] as string[],
    cancellazioni: 0,
    leggi(): string | null { return a.contenuto; },
    scrivi(t: string): boolean { a.scritture.push(t); a.contenuto = t; return true; },
    cancella(): void { a.cancellazioni++; a.contenuto = null; },
  };
  return a as Archivio & typeof a;
}

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode; recupero: Recupero; controllaRecupero(): Promise<void> };
interface Dentro { tabs: Array<{ id: string; title: string; type: string }>; statusMessage: string; activeTabId: string; recuperabile: unknown }

async function avvia(contenuto: string | null = null) {
  const a = archivioFinto(contenuto);
  const app = document.createElement('free-app') as App;
  app.recupero = new Recupero(a, { ora: () => 5000 });
  document.body.appendChild(app);
  await app.updateComplete;
  return { app, a, dentro: app as unknown as Dentro };
}
const barra = (app: App): HTMLElement | null => app.renderRoot.querySelector('.recupero');
const pulsante = (app: App, nome: 'ripristina' | 'scarta'): HTMLButtonElement => app.renderRoot.querySelector(`.recupero button.${nome}`) as HTMLButtonElement;
async function nuovoFoglio(app: App, dentro: Dentro): Promise<SheetDocument & { title: string }> {
  await app.updateComplete;
  const tab = dentro.tabs.at(-1)!;
  const doc = defaultDocumentStore.getOrCreateDocument(tab.id);
  return Object.assign(doc, { title: tab.title });
}
const comanda = (app: App, action: string) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
const grezzo = async (doc: SheetDocument, riga: number, col: number, f = 'Foglio1'): Promise<string> => (await doc.client.getCell(f, riga, col)).raw;

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); salva.mockClear(); scegli.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

describe('T307: la copia di emergenza trovata all\'avvio', () => {
  it('senza copia, o con una copia rovinata, non c\'è nessuna barra', async () => {
    expect(barra((await avvia()).app)).toBeNull();
    document.body.innerHTML = '';
    expect(barra((await avvia('{rotto')).app)).toBeNull();
  });
  it('con una copia di un foglio compare la barra con titolo e ora e i pulsanti Ripristina e Scarta', async () => {
    const { app, dentro } = await avvia(copia([{ titolo: 'Conti', dati: dati('a') }], 7000));
    const prima = dentro.tabs.length;
    const b = barra(app)!;
    expect(b).not.toBeNull();
    expect(b.getAttribute('role')).toBe('alertdialog');
    expect(b.getAttribute('aria-label')).toBe('Fogli non salvati');
    expect(b.querySelector('.recupero-testo')!.textContent).toBe(`Foglio non salvato trovato: «Conti» (${new Date(7000).toLocaleString('it-IT')})`);
    expect(pulsante(app, 'ripristina').textContent).toBe('Ripristina');
    expect(pulsante(app, 'scarta').textContent).toBe('Scarta');
    expect(dentro.tabs.length).toBe(prima);
  });
  it('con più fogli la barra li elenca e ne dice il numero', async () => {
    const { app } = await avvia(copia([{ titolo: 'Uno', dati: dati('a') }, { titolo: 'Due', dati: dati('b') }], 7000));
    expect(barra(app)!.querySelector('.recupero-testo')!.textContent).toBe(`2 fogli non salvati trovati: «Uno», «Due» (${new Date(7000).toLocaleString('it-IT')})`);
  });
});

describe('T307: Ripristina e Scarta', () => {
  it('Ripristina rimette il foglio nella finestra, toglie la barra e lascia la copia', async () => {
    const { app, a, dentro } = await avvia(copia([{ titolo: 'Conti', dati: dati('dal passato') }]));
    pulsante(app, 'ripristina').click();
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Ripristinato "Conti"'));
    expect(dentro.tabs).toEqual([{ id: 'tab-1', title: 'Conti' }]);
    expect(await grezzo(defaultDocumentStore.getDocument('tab-1') as SheetDocument, 1, 1)).toBe('dal passato');
    await app.updateComplete;
    expect(barra(app)).toBeNull();
    expect(a.cancellazioni).toBe(0);
    expect(a.contenuto).not.toBeNull();
  });

  it('Ripristina con più documenti nella copia (versioni a schede) carica il primo e dice che gli altri no', async () => {
    const { app, dentro } = await avvia(copia([{ titolo: 'Uno', dati: dati('a') }, { titolo: 'Due', dati: dati('b') }]));
    pulsante(app, 'ripristina').click();
    await vi.waitFor(() => expect(dentro.statusMessage.startsWith('Ripristinato "Uno"')).toBe(true));
    expect(dentro.statusMessage).toContain('altri 1 fogli');
    expect(await grezzo(defaultDocumentStore.getDocument('tab-1') as SheetDocument, 1, 1)).toBe('a');
  });

  it('un foglio ripristinato resta "modificato": il controllo successivo riscrive la copia', async () => {
    const { app, a, dentro } = await avvia(copia([{ titolo: 'Conti', dati: dati('dal passato') }]));
    pulsante(app, 'ripristina').click();
    await vi.waitFor(() => expect(barra(app)).toBeNull());
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0]).schede[0].titolo).toBe('Conti');
    expect(dentro.tabs.at(-1)!.title).toBe('Conti');
  });
  it('se il foglio della copia non si legge la barra resta e la copia pure', async () => {
    const rotto = serializeSheetDocumentData({ ...JSON.parse(dati('x')), workbookJson: 'non è un libro' });
    const { app, a, dentro } = await avvia(copia([{ titolo: 'Rotto', dati: rotto }, { titolo: 'Buono', dati: dati('a') }]));
    pulsante(app, 'ripristina').click();
    await vi.waitFor(() => expect(dentro.statusMessage.startsWith('Impossibile ripristinare: ')).toBe(true));
    expect(dentro.tabs[0].title).not.toBe('Rotto');
    expect(barra(app)).not.toBeNull();
    expect(a.cancellazioni).toBe(0);
  });

  it('Scarta cancella la copia, toglie la barra e non tocca le schede', async () => {
    const { app, a, dentro } = await avvia(copia([{ titolo: 'Conti', dati: dati('a') }]));
    const prima = dentro.tabs.length;
    pulsante(app, 'scarta').click();
    await app.updateComplete;
    expect(a.cancellazioni).toBe(1);
    expect(a.contenuto).toBeNull();
    expect(barra(app)).toBeNull();
    expect(dentro.tabs.length).toBe(prima);
    expect(dentro.statusMessage).toBe('Copia di emergenza scartata');
  });
});

describe('T307: salvataggio automatico dei fogli', () => {
  it('finché la barra è aperta il controllo non fa niente: la vecchia copia resta', async () => {
    const vecchia = copia([{ titolo: 'Vecchio', dati: dati('da non perdere') }]);
    const { app, a, dentro } = await avvia(vecchia);
    await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    expect(a.cancellazioni).toBe(0);
    expect(a.scritture).toEqual([]);
    expect(a.contenuto).toBe(vecchia);
  });
  it('un foglio nuovo non modificato non produce copie; se si scrive in una cella la copia compare con titolo e contenuto', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    expect(a.scritture).toEqual([]);
    await doc.client.setCell('Foglio1', 1, 1, 'ciao');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
    const scheda = JSON.parse(a.scritture[0]).schede[0];
    expect(scheda.titolo).toBe(doc.title);
    expect(scheda.dati).toContain('ciao');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
  });
  it('anche rinominare il foglio modificato aggiorna la copia', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    await doc.client.setCell('Foglio1', 1, 1, 'x');
    await app.controllaRecupero();
    (dentro as unknown as { titolo: string }).titolo = 'Bilancio';
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(2);
    expect(JSON.parse(a.scritture[1]).schede[0].titolo).toBe('Bilancio');
  });
  it('salvare il foglio con successo lo fa tornare "non modificato" e cancella la copia', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    await doc.client.setCell('Foglio1', 1, 1, 'importante');
    await app.controllaRecupero();
    expect(a.contenuto).not.toBeNull();
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Salvato "'));
    await app.controllaRecupero();
    expect(a.contenuto).toBeNull();
    await doc.client.setCell('Foglio1', 1, 2, 'ancora');
    await app.controllaRecupero();
    expect(a.contenuto).not.toBeNull();
  });
  it('se il salvataggio viene annullato o fallisce la copia resta', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    await doc.client.setCell('Foglio1', 1, 1, 'importante');
    await app.controllaRecupero();
    salva.mockImplementationOnce(async () => false);
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Salvataggio annullato'));
    salva.mockImplementationOnce(async () => { throw new Error('disco pieno'); });
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Impossibile salvare: disco pieno'));
    await app.controllaRecupero();
    expect(a.contenuto).not.toBeNull();
    expect(a.cancellazioni).toBe(1);
  });
  const apriMagazzino = async (app: App, dentro: Dentro): Promise<SheetDocument> => {
    const byte = await scriviXlsx({ foglioAttivo: 'Dati', fogli: [{ ...foglioVuoto('Dati'), celle: { A1: 'dal file' } }] });
    scegli.mockResolvedValueOnce(new File([byte as BlobPart], 'Magazzino.xlsx'));
    comanda(app, 'open-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Aperto "Magazzino.xlsx"'));
    return defaultDocumentStore.getDocument('tab-1') as SheetDocument;
  };
  it('un file aperto e non toccato non è "modificato", nemmeno dopo più controlli', async () => {
    const { app, a, dentro } = await avvia();
    await apriMagazzino(app, dentro);
    await app.controllaRecupero();
    await app.controllaRecupero();
    expect(a.scritture).toEqual([]);
  });
  it('una modifica a un file appena aperto conta anche prima del primo controllo', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await apriMagazzino(app, dentro);
    await doc.client.setCell('Dati', 2, 1, 'aggiunta');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0]).schede[0].titolo).toBe('Magazzino');
  });
  it('se il foglio appena aperto non si riesce a fotografare il file si apre lo stesso', async () => {
    const { app, dentro } = await avvia();
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { InlineEngineClient } = await import('../../src/sheet/engine-client');
    // la prima lettura (controllo prima di sostituire il file aperto) funziona, la seconda (riferimento del file appena aperto) no
    const vera = InlineEngineClient.prototype.serialize;
    let n = 0;
    vi.spyOn(InlineEngineClient.prototype, 'serialize').mockImplementation(function (this: unknown) { return ++n === 2 ? Promise.reject(new Error('motore fermo')) : vera.call(this as never); });
    await apriMagazzino(app, dentro);
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Aperto "Magazzino.xlsx"'));
    expect(avviso).toHaveBeenCalled();
  });
  it('File > Nuovo su un foglio modificato chiede conferma; Non salvare lo sostituisce e toglie la copia', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    await doc.client.setCell('Foglio1', 1, 1, 'x');
    await app.controllaRecupero();
    expect(a.contenuto).not.toBeNull();
    comanda(app, 'new-sheet');
    await vi.waitFor(() => expect(app.renderRoot.querySelector('free-dialogo-conferma')).not.toBeNull());
    (app.renderRoot.querySelector('free-dialogo-conferma')!.shadowRoot!.querySelector('button[data-scelta="scarta"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Nuovo foglio di calcolo'));
    await app.controllaRecupero();
    expect(a.contenuto).toBeNull();
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('');
  });

  it('un errore nel leggere un foglio non rompe il controllo e il successivo riparte', async () => {
    const { app, a, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    const originale = doc.client.serialize.bind(doc.client);
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    doc.client.serialize = async () => { throw new Error('motore fermo'); };
    await expect(app.controllaRecupero()).resolves.toBeUndefined();
    expect(avviso).toHaveBeenCalled();
    doc.client.serialize = originale;
    await doc.client.setCell('Foglio1', 1, 1, 'x');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
  });
  it('due controlli sovrapposti: il secondo non fa niente', async () => {
    const { app, dentro } = await avvia();
    await nuovoFoglio(app, dentro);
    const controlla = vi.spyOn(app.recupero, 'controlla');
    await Promise.all([app.controllaRecupero(), app.controllaRecupero()]);
    expect(controlla).toHaveBeenCalledTimes(1);
  });
  it('il controllo scatta da solo ogni 3 secondi e smette quando l\'app viene tolta', async () => {
    vi.useFakeTimers();
    const { app } = await avvia();
    const controlla = vi.spyOn(app, 'controllaRecupero').mockResolvedValue();
    expect(INTERVALLO_CONTROLLO).toBe(3000);
    vi.advanceTimersByTime(2999);
    expect(controlla).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(controlla).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6000);
    expect(controlla).toHaveBeenCalledTimes(3);
    app.remove();
    vi.advanceTimersByTime(9000);
    expect(controlla).toHaveBeenCalledTimes(3);
  });
});

describe('T307: con il deposito vero del browser', () => {
  it('senza archivio finto la copia finisce in localStorage e un\'app nuova la ritrova', async () => {
    const app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
    const dentro = app as unknown as Dentro;
    const doc = await nuovoFoglio(app, dentro);
    await app.controllaRecupero();
    expect(localStorage.getItem(CHIAVE_RECUPERO)).toBeNull();
    await doc.client.setCell('Foglio1', 1, 1, 'testo importante');
    await app.controllaRecupero();
    expect(localStorage.getItem(CHIAVE_RECUPERO)).not.toBeNull();
    document.body.innerHTML = '';
    const app2 = document.createElement('free-app') as App;
    document.body.appendChild(app2);
    await app2.updateComplete;
    expect(barra(app2)).not.toBeNull();
    expect(barra(app2)!.textContent).toContain(doc.title);
  });
  it('se il browser non lascia usare localStorage l\'app parte lo stesso, senza barra e senza errori', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('dati del sito bloccati'); });
    const app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
    expect(barra(app)).toBeNull();
    const dentro = app as unknown as Dentro;
    await nuovoFoglio(app, dentro);
    await expect(app.controllaRecupero()).resolves.toBeUndefined();
  });
});

describe('T307: stile', () => {
  it('la barra è in basso al centro, scura, con i pulsanti azzurri', () => {
    const css = ((customElements.get('free-app') as unknown as { styles: { cssText: string } }).styles.cssText).replace(/\s+/g, ' ');
    expect(css).toContain('.recupero { position: fixed; left: 50%; bottom: 48px;');
    expect(css).toContain('background: #323232;');
    expect(css).toContain('.recupero button { height: 36px;');
    expect(css).toContain('color: #a8c7fa;');
  });
});
