import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import { CHIAVE_RECUPERO, Recupero, pacchettoRecupero, type Archivio } from '../../src/formati/recupero';
import { daTesto, serializza, type Documento } from '../../src/modello/documento';

/** archivio finto: ricorda cosa gli è stato chiesto */
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

/** timer finto: le azioni in sospeso scattano a comando */
function timerFinto() {
  const t = {
    chiamate: [] as Array<{ azione: () => void; ms: number; id: number }>,
    annullati: [] as unknown[],
    prossimo: 1,
    imposta(azione: () => void, ms: number): unknown { const id = t.prossimo++; t.chiamate.push({ azione, ms, id }); return id; },
    annulla(id: unknown): void { t.annullati.push(id); },
    scatta(i = t.chiamate.length - 1): void { t.chiamate[i].azione(); },
  };
  return t;
}

async function guscio(contenuto: string | null = null): Promise<{ g: any; ed: any; a: ReturnType<typeof archivioFinto>; t: ReturnType<typeof timerFinto> }> {
  const a = archivioFinto(contenuto);
  const t = timerFinto();
  const g: any = document.createElement('docs-guscio');
  g.recupero = new Recupero(a, { imposta: t.imposta, annulla: t.annulla, ora: () => 5000 });
  g.salva = async () => {};
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  return { g, ed, a, t };
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
const barra = (g: any): HTMLElement | null => g.shadowRoot.querySelector('.recupero');
const pulsante = (g: any, nome: 'ripristina' | 'scarta'): HTMLButtonElement => g.shadowRoot.querySelector(`.recupero button.${nome}`);
function tasto(ed: any, key: string): void {
  casella(ed).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true }));
}
function cambiaTitolo(g: any, valore: string): void {
  titolo(g).value = valore;
  titolo(g).dispatchEvent(new Event('input', { bubbles: true }));
}
const copia = (titoloCopia: string, doc: Documento, salvato = 7000): string => pacchettoRecupero(titoloCopia, doc, salvato);

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('T305: la copia di emergenza trovata all\'avvio', () => {
  it('senza copia non c\'è nessuna barra', async () => {
    const { g } = await guscio();
    expect(barra(g)).toBeNull();
  });
  it('una copia rovinata o di un documento vuoto non fa comparire la barra', async () => {
    expect(barra((await guscio('{rotto')).g)).toBeNull();
    document.body.innerHTML = '';
    expect(barra((await guscio(copia('Vuoto', daTesto('')))).g)).toBeNull();
  });
  it('con una copia compare la barra con titolo e ora, e i pulsanti Ripristina e Scarta', async () => {
    const { g, ed } = await guscio(copia('La mia tesi', daTesto('testo perso'), 7000));
    const b = barra(g)!;
    expect(b).not.toBeNull();
    expect(b.getAttribute('role')).toBe('alertdialog');
    expect(b.getAttribute('aria-label')).toBe('Documento non salvato');
    const testo = b.querySelector('.recupero-testo')!.textContent!;
    expect(testo).toContain('Documento non salvato trovato');
    expect(testo).toContain('«La mia tesi»');
    expect(testo).toContain(new Date(7000).toLocaleString('it-IT'));
    expect(pulsante(g, 'ripristina').textContent).toBe('Ripristina');
    expect(pulsante(g, 'scarta').textContent).toBe('Scarta');
    // il documento attuale non viene toccato finché non si sceglie
    expect(testoPagina(ed)).toBe('');
    expect(titolo(g).value).toBe('Documento senza titolo');
  });
  it('una copia con titolo vuoto si presenta col titolo predefinito', async () => {
    const { g } = await guscio(copia('  ', daTesto('x')));
    expect(barra(g)!.querySelector('.recupero-testo')!.textContent).toContain('«Documento senza titolo»');
  });
});

describe('T305: Ripristina e Scarta', () => {
  it('Ripristina rimette testo e titolo, toglie la barra e porta il cursore nel testo; la copia resta', async () => {
    const { g, ed, a } = await guscio(copia('La mia tesi', daTesto('riga uno\nriga due')));
    pulsante(g, 'ripristina').click();
    await g.updateComplete;
    await ed.updateComplete;
    expect(testoPagina(ed)).toBe('riga uno\nriga due');
    expect(titolo(g).value).toBe('La mia tesi');
    expect(barra(g)).toBeNull();
    expect(ed.shadowRoot.activeElement?.className).toBe('ingresso');
    expect(a.cancellazioni).toBe(0);
    expect(a.contenuto).not.toBeNull();
  });
  it('Ripristina conserva la formattazione, l\'intestazione e il piè di pagina', async () => {
    const doc: Documento = {
      paragrafi: [{ runs: [{ t: 'Titolo', g: true, c: false, s: false, z: 24 }], al: 'ce' }],
      intestazione: [{ runs: [{ t: 'Testata', g: false, c: false, s: false }], al: 'dx' }],
      piede: [{ runs: [{ t: 'Piede', g: false, c: false, s: false }] }],
    };
    const { g, ed } = await guscio(copia('Bozza', doc));
    pulsante(g, 'ripristina').click();
    await g.updateComplete;
    expect(serializza(ed.stato.doc)).toBe(serializza(doc));
  });
  it('Ripristina con titolo vuoto o di soli spazi mette il titolo predefinito', async () => {
    for (const vuoto of ['', '   ']) {
      document.body.innerHTML = '';
      const { g } = await guscio(copia(vuoto, daTesto('x')));
      pulsante(g, 'ripristina').click();
      await g.updateComplete;
      expect(titolo(g).value).toBe('Documento senza titolo');
    }
  });
  it('un secondo clic sul pulsante Ripristina non rimette di nuovo il vecchio documento né dà errori', async () => {
    const errori: unknown[] = [];
    const ascolta = (e: ErrorEvent): void => { errori.push(e.error ?? e.message); };
    window.addEventListener('error', ascolta);
    try {
      const { g, ed } = await guscio(copia('Vecchio', daTesto('vecchio')));
      const p = pulsante(g, 'ripristina');
      p.click();
      await g.updateComplete;
      scrivi(ed, ' e nuovo');
      cambiaTitolo(g, 'Nuovo titolo');
      p.click();
      await g.updateComplete;
      expect(testoPagina(ed)).toBe(' e nuovovecchio');
      expect(titolo(g).value).toBe('Nuovo titolo');
      expect(errori).toEqual([]);
    } finally {
      window.removeEventListener('error', ascolta);
    }
  });
  it('Scarta cancella la copia, toglie la barra, lascia com\'è il documento e rimette il cursore nel testo', async () => {
    const { g, ed, a } = await guscio(copia('La mia tesi', daTesto('testo perso')));
    cambiaTitolo(g, 'Altro');
    pulsante(g, 'scarta').click();
    await g.updateComplete;
    expect(a.cancellazioni).toBe(1);
    expect(a.contenuto).toBeNull();
    expect(barra(g)).toBeNull();
    expect(testoPagina(ed)).toBe('');
    expect(titolo(g).value).toBe('Altro');
    expect(ed.shadowRoot.activeElement?.className).toBe('ingresso');
  });
  it('dopo Ripristina o Scarta il pulsante non c\'è più e un secondo clic non fa niente', async () => {
    const { g, a } = await guscio(copia('t', daTesto('x')));
    const p = pulsante(g, 'scarta');
    p.click();
    await g.updateComplete;
    p.click();
    expect(a.cancellazioni).toBe(1);
  });
});

describe('T305: salvataggio automatico mentre si scrive', () => {
  it('senza copia: scrivere mette un solo timer di 2000 ms e allo scatto si scrive titolo e documento', async () => {
    const { ed, a, t, g } = await guscio();
    scrivi(ed, 'ciao');
    scrivi(ed, ' a tutti');
    expect(t.chiamate.map((c) => c.ms)).toEqual([2000]);
    expect(a.scritture).toEqual([]);
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    const dati = JSON.parse(a.scritture[0]);
    expect(dati.titolo).toBe('Documento senza titolo');
    expect(dati.salvato).toBe(5000);
    expect(dati.doc).toBe(serializza(ed.stato.doc));
    expect(testoPagina(ed)).toBe('ciao a tutti');
    expect(barra(g)).toBeNull();
  });
  it('cambiare il titolo mette in coda la copia, col titolo nuovo', async () => {
    const { g, ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    cambiaTitolo(g, 'Relazione');
    expect(t.chiamate).toHaveLength(2);
    t.scatta();
    expect(JSON.parse(a.scritture[1]).titolo).toBe('Relazione');
  });
  it('un cambio che non tocca né documento né titolo (per esempio solo il cursore) non rimette in coda niente', async () => {
    const { ed, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    expect(t.chiamate).toHaveLength(1);
    for (let i = 0; i < 3; i++) ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    expect(t.chiamate).toHaveLength(1);
  });
  it('finché la barra è aperta non si scrive niente: la vecchia copia resta', async () => {
    const vecchia = copia('Vecchia', daTesto('da non perdere'));
    const { g, ed, a, t } = await guscio(vecchia);
    scrivi(ed, 'nuovo testo');
    cambiaTitolo(g, 'Nuovo');
    expect(t.chiamate).toHaveLength(0);
    expect(a.scritture).toEqual([]);
    expect(a.contenuto).toBe(vecchia);
    expect(barra(g)).not.toBeNull();
  });
  it('dopo Scarta il salvataggio riparte', async () => {
    const { g, ed, a, t } = await guscio(copia('Vecchia', daTesto('x')));
    pulsante(g, 'scarta').click();
    await g.updateComplete;
    scrivi(ed, 'nuovo');
    expect(t.chiamate).toHaveLength(1);
    t.scatta();
    expect(a.scritture).toHaveLength(1);
  });
  it('dopo Ripristina il salvataggio riparte e riscrive la copia', async () => {
    const { g, ed, a, t } = await guscio(copia('Bozza', daTesto('dal passato')));
    pulsante(g, 'ripristina').click();
    await g.updateComplete;
    t.scatta();
    expect(JSON.parse(a.scritture[a.scritture.length - 1]).titolo).toBe('Bozza');
    scrivi(ed, 'dal passato e dal presente');
    expect(t.chiamate.length).toBeGreaterThan(1);
  });
  it('cancellare tutto il testo cancella la copia', async () => {
    const { ed, a, t } = await guscio();
    scrivi(ed, 'qualcosa');
    t.scatta();
    expect(a.contenuto).not.toBeNull();
    for (let i = 0; i < 8; i++) tasto(ed, 'Backspace');
    expect(testoPagina(ed)).toBe('');
    t.scatta();
    expect(a.contenuto).toBeNull();
  });
});

describe('T305: quando la copia non serve più', () => {
  it('Scarica con successo cancella la copia e annulla la scrittura in sospeso', async () => {
    const { g, ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    scrivi(ed, 'ciao ciao');
    expect(a.contenuto).not.toBeNull();
    await g.scarica('txt');
    expect(a.contenuto).toBeNull();
    expect(t.annullati).toHaveLength(1);
  });
  it('se il salvataggio del file fallisce la copia resta', async () => {
    const { g, ed, a, t } = await guscio();
    g.salva = async () => { throw new Error('disco pieno'); };
    scrivi(ed, 'ciao');
    t.scatta();
    await g.scarica('docx');
    expect(a.contenuto).not.toBeNull();
    expect(a.cancellazioni).toBe(0);
  });
  it('File > Nuovo cancella la copia e annulla la scrittura in sospeso', async () => {
    const { g, ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    scrivi(ed, 'ciao ciao');
    g.nuovo();
    expect(a.contenuto).toBeNull();
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    expect(a.contenuto).toBeNull();
  });
  it('aprire un file cancella la copia e annulla la scrittura in sospeso; scrivere dopo la riscrive', async () => {
    const { g, ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    g.scegli = async () => new File([new TextEncoder().encode('dal file')], 'nota.txt');
    await g.apri();
    expect(testoPagina(ed)).toBe('dal file');
    expect(a.contenuto).toBeNull();
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    expect(a.contenuto).toBeNull();
    scrivi(ed, 'dal file e altro');
    t.scatta();
    expect(a.scritture).toHaveLength(2);
    expect(a.contenuto).not.toBeNull();
  });
  it('un file che non si riesce ad aprire lascia la copia com\'è', async () => {
    const { g, ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    t.scatta();
    g.scegli = async () => new File([new Uint8Array([1, 2, 0, 3])], 'strano.bin');
    await g.apri();
    expect(a.cancellazioni).toBe(0);
    expect(a.contenuto).not.toBeNull();
  });
});

describe('T305: chiusura della finestra', () => {
  it('quando la pagina si nasconde la copia in sospeso si scrive subito', async () => {
    const { ed, a, t } = await guscio();
    scrivi(ed, 'ciao');
    expect(a.scritture).toEqual([]);
    window.dispatchEvent(new Event('pagehide'));
    expect(a.scritture).toHaveLength(1);
    expect(t.annullati).toHaveLength(1);
  });
  it('togliere il guscio dalla pagina scrive la copia in sospeso e smette di ascoltare', async () => {
    const { g, ed, a } = await guscio();
    scrivi(ed, 'ciao');
    const scriviOra = vi.spyOn(g.recupero, 'scriviOra');
    g.remove();
    expect(a.scritture).toHaveLength(1);
    expect(scriviOra).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('pagehide'));
    expect(scriviOra).toHaveBeenCalledTimes(1);
  });
});

describe('T305: con il deposito vero del browser', () => {
  it('senza archivio finto la copia finisce in localStorage dopo 2000 ms e un guscio nuovo la ritrova', async () => {
    vi.useFakeTimers();
    const g: any = document.createElement('docs-guscio');
    g.salva = async () => {};
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    scrivi(ed, 'testo importante');
    vi.advanceTimersByTime(1999);
    expect(localStorage.getItem(CHIAVE_RECUPERO)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(localStorage.getItem(CHIAVE_RECUPERO)).not.toBeNull();
    document.body.innerHTML = '';
    const g2: any = document.createElement('docs-guscio');
    document.body.appendChild(g2);
    await g2.updateComplete;
    expect(barra(g2)).not.toBeNull();
    expect(barra(g2)!.textContent).toContain('Documento senza titolo');
  });
});

describe('T305: deposito del browser non utilizzabile', () => {
  it('se il browser non lascia usare localStorage il guscio parte lo stesso, senza barra e senza errori', async () => {
    const spia = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('dati del sito bloccati'); });
    try {
      const g: any = document.createElement('docs-guscio');
      g.salva = async () => {};
      document.body.appendChild(g);
      await g.updateComplete;
      const ed: any = g.shadowRoot.querySelector('docs-editor');
      await ed.updateComplete;
      expect(barra(g)).toBeNull();
      expect(() => scrivi(ed, 'ciao')).not.toThrow();
      expect(testoPagina(ed)).toBe('ciao');
    } finally {
      spia.mockRestore();
    }
  });
});

describe('T305: stampa e stile', () => {
  it('la barra non si stampa', () => {
    const css = (customElements.get('docs-guscio') as any).styles.cssText as string;
    const stampa = css.slice(css.indexOf('@media print'));
    expect(stampa).toMatch(/\.recupero \{ display: none; \}/);
  });
});
