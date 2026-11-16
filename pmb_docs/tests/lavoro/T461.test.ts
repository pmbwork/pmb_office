// T461: aggiornamento da file firmato: finestra, codici di errore, installazione; e la versione scritta uguale ovunque.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-aggiornamento';
import { motivoAggiornamento, noteNellaLingua } from '../../src/guscio/docs-aggiornamento';
import { impostaLingua } from '../../src/i18n/lingua';
import { VERSIONE_APP } from '../../src/guscio/docs-informazioni';

const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
const attendi = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));
const INFO = { versioneAttuale: '0.1.0', versioneNuova: '0.2.0', note: 'Novità:\n- tutto nuovo', piuNuova: true };

let chiamate: Array<{ comando: string; args: unknown }> = [];
function finto(risposte: Record<string, unknown>): void {
  chiamate = [];
  w.__TAURI_INTERNALS__ = {
    invoke: async (comando: string, args: unknown) => {
      chiamate.push({ comando, args });
      const r = risposte[comando];
      if (typeof r === 'function') return (r as () => unknown)();
      if (r instanceof Error) throw (r as Error).message;
      return r;
    },
  };
}
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
afterEach(() => { delete w.__TAURI_INTERNALS__; });

async function montaDialogo(prima: () => void = () => {}): Promise<any> {
  const d: any = document.createElement('docs-aggiornamento');
  d.prima = prima;
  document.body.appendChild(d);
  await d.updateComplete;
  return d;
}
async function scegli(d: any, nome = 'a.pmbup', byte = new Uint8Array([1, 2, 3])): Promise<void> {
  const campo = d.shadowRoot.querySelector('input[type=file]') as HTMLInputElement;
  expect(campo.accept).toBe('.pmbup');
  Object.defineProperty(campo, 'files', { value: [new File([byte], nome)], configurable: true });
  campo.dispatchEvent(new Event('change'));
  await attendi(60); await d.updateComplete;
}
const pulsante = (d: any, testo: string): HTMLButtonElement => (Array.from(d.shadowRoot.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent!.trim() === testo)!;
const stato = (d: any): string => d.shadowRoot.querySelector('.stato').textContent.trim();

describe('note degli aggiornamenti nella lingua del programma', () => {
  afterEach(() => impostaLingua('it'));
  it('in inglese mostra le note inglesi se il pacchetto le ha, altrimenti quelle italiane; in italiano sempre quelle italiane', () => {
    const conEn = { ...INFO, note: 'Nuovi loghi', noteEn: 'New logos' };
    impostaLingua('it');
    expect(noteNellaLingua(conEn)).toBe('Nuovi loghi');
    impostaLingua('en');
    expect(noteNellaLingua(conEn)).toBe('New logos');
    expect(noteNellaLingua({ ...INFO, note: 'Nuovi loghi' })).toBe('Nuovi loghi');
    expect(noteNellaLingua({ ...INFO, note: 'Nuovi loghi', noteEn: '  ' })).toBe('Nuovi loghi');
  });
  it('lo script dei pacchetti accetta --note-en e lo scrive come note_en', () => {
    const s = fs.readFileSync(path.join(__dirname, '../../scripts/crea-aggiornamento.mjs'), 'utf8');
    expect(s).toContain("arg('note-en')");
    expect(s).toContain('note_en: noteEn');
  });
});

describe('la voce di menu', () => {
  it('Informazioni › Installa un aggiornamento apre la finestra con la versione installata', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'informazioni', voce: 'Installa un aggiornamento' }, bubbles: true, composed: true }));
    await g.updateComplete;
    const d: any = g.shadowRoot.querySelector('docs-aggiornamento');
    expect(d).not.toBeNull();
    await d.updateComplete;
    expect(d.shadowRoot.textContent).toContain(VERSIONE_APP);
    pulsante(d, 'Annulla').click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-aggiornamento')).toBeNull();
  });
});

describe('scegliere il file', () => {
  it('nel browser (senza il programma nativo) lo dice e non fa niente', async () => {
    const d = await montaDialogo();
    await scegli(d);
    expect(stato(d)).toBe("L'aggiornamento funziona solo nel programma installato, non nel browser.");
  });
  it('un pacchetto valido e più nuovo: mostra versioni e novità e offre «Installa e riavvia»', async () => {
    finto({ aggiornamento_leggi: INFO });
    const d = await montaDialogo();
    await scegli(d, 'a.pmbup', new Uint8Array([9, 8, 7, 6]));
    expect(chiamate[0].comando).toBe('aggiornamento_leggi');
    expect(Array.from(chiamate[0].args as Uint8Array)).toEqual([9, 8, 7, 6]); // i byte del file arrivano come sono
    const testo = d.shadowRoot.textContent;
    expect(testo).toContain('0.1.0');
    expect(testo).toContain('0.2.0');
    expect(testo).toContain('tutto nuovo');
    expect(pulsante(d, 'Installa e riavvia')).toBeTruthy();
  });
  it('ogni codice di errore della parte nativa diventa una frase chiara', async () => {
    const attesi: Record<string, string> = {
      NON_PACCHETTO: 'Questo non è un file di aggiornamento di pmb_docs.',
      DANNEGGIATO: 'Il file di aggiornamento è danneggiato o incompleto: chiedine una copia nuova.',
      FIRMA_NON_VALIDA: 'Il file non è firmato da PMB: per sicurezza non lo installo.',
      ALTRO_PROGRAMMA: 'Questo aggiornamento è per un altro programma.',
      VERSIONE_NON_VALIDA: 'Il file di aggiornamento ha un numero di versione non valido.',
    };
    for (const [codice, frase] of Object.entries(attesi)) {
      document.body.innerHTML = '';
      finto({ aggiornamento_leggi: new Error(codice) });
      const d = await montaDialogo();
      await scegli(d);
      expect(stato(d)).toBe(frase);
      expect(d.shadowRoot.querySelector('.stato.errore')).not.toBeNull();
      expect(d.shadowRoot.textContent).not.toContain('Installa e riavvia');
    }
    expect(motivoAggiornamento('qualcosa')).toBe('Aggiornamento non riuscito.');
  });
  it('un aggiornamento che non è più nuovo della versione installata non si propone', async () => {
    finto({ aggiornamento_leggi: { ...INFO, versioneNuova: '0.1.0', piuNuova: false } });
    const d = await montaDialogo();
    await scegli(d);
    expect(stato(d)).toBe('Questo aggiornamento è la versione 0.1.0, ma hai già la 0.1.0: non serve installarlo.');
    expect(d.shadowRoot.textContent).not.toContain('Installa e riavvia');
  });
});

describe('installare', () => {
  it('mette al sicuro il lavoro (copia di emergenza) PRIMA di chiedere l\'installazione, poi la chiede', async () => {
    const ordine: string[] = [];
    finto({ aggiornamento_leggi: INFO, aggiornamento_installa: () => { ordine.push('installa'); return null; } });
    const d = await montaDialogo(() => { ordine.push('copia'); });
    await scegli(d);
    pulsante(d, 'Installa e riavvia').click();
    await attendi(60); await d.updateComplete;
    expect(ordine).toEqual(['copia', 'installa']);
    expect(stato(d)).toContain('si chiude e si riapre da solo');
    expect(pulsante(d, 'Installa e riavvia').disabled).toBe(true);
  });
  it('se l\'utente nega il permesso di amministratore resta tutto com\'è e può riprovare', async () => {
    finto({ aggiornamento_leggi: INFO, aggiornamento_installa: new Error('ANNULLATO') });
    const d = await montaDialogo();
    await scegli(d);
    pulsante(d, 'Installa e riavvia').click();
    await attendi(60); await d.updateComplete;
    expect(stato(d)).toBe('Installazione annullata: serve il permesso di amministratore di Windows.');
    expect(pulsante(d, 'Installa e riavvia').disabled).toBe(false);
  });
  it('anche se la copia di emergenza fallisce, l\'installazione parte', async () => {
    finto({ aggiornamento_leggi: INFO, aggiornamento_installa: null });
    const d = await montaDialogo(() => { throw new Error('disco pieno'); });
    await scegli(d);
    pulsante(d, 'Installa e riavvia').click();
    await attendi(60);
    expect(chiamate.map((c) => c.comando)).toEqual(['aggiornamento_leggi', 'aggiornamento_installa']);
  });
});

describe('la versione è la stessa dappertutto', () => {
  it('tauri.conf.json, Cargo.toml, package.json e la costante del programma coincidono', () => {
    const radice = path.resolve(__dirname, '../..');
    const conf = JSON.parse(fs.readFileSync(path.join(radice, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;
    const cargo = /^version\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(radice, 'src-tauri', 'Cargo.toml'), 'utf8'))![1];
    const pkg = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).version;
    expect([conf, cargo, pkg]).toEqual([VERSIONE_APP, VERSIONE_APP, VERSIONE_APP]);
  });
});
