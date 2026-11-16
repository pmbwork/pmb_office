import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-versioni';
import {
  leggiVersioni,
  salvaNuovaVersione,
  rinominaVersione,
  eliminaVersione,
  svuotaVersioni,
} from '../../src/formati/versioni';
import { daTesto, testoDi } from '../../src/modello/documento';

class DepositoFinto implements Storage {
  private mappa = new Map<string, string>();
  get length(): number { return this.mappa.size; }
  clear(): void { this.mappa.clear(); }
  getItem(key: string): string | null { return this.mappa.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.mappa.keys())[index] ?? null; }
  removeItem(key: string): void { this.mappa.delete(key); }
  setItem(key: string, value: string): void { this.mappa.set(key, value); }
}

async function montaGuscio(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T408: Cronologia versioni locale', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear();
  });

  it('funzioni versioni.ts salvano, leggono, rinominano ed eliminano le versioni', () => {
    const dep = new DepositoFinto();
    const doc1 = daTesto('Prima bozza del testo.');
    const v1 = salvaNuovaVersione(dep, 'MioDoc', doc1, 'Bozza 1', 1000);
    expect(v1).not.toBeNull();
    expect(v1?.nome).toBe('Bozza 1');
    expect(v1?.parole).toBe(4);

    const doc2 = daTesto('Seconda bozza con piu testo per prova.');
    const v2 = salvaNuovaVersione(dep, 'MioDoc', doc2, 'Revisione', 2000);
    expect(v2).not.toBeNull();

    const lette = leggiVersioni(dep, 'MioDoc');
    expect(lette.length).toBe(2);
    // Più recente prima
    expect(lette[0].id).toBe(v2?.id);
    expect(lette[1].id).toBe(v1?.id);

    // Rinomina v1
    expect(rinominaVersione(dep, 'MioDoc', v1!.id, 'Bozza Iniziale')).toBe(true);
    const dopoRinomina = leggiVersioni(dep, 'MioDoc');
    expect(dopoRinomina.find((x) => x.id === v1!.id)?.nome).toBe('Bozza Iniziale');

    // Elimina v2
    expect(eliminaVersione(dep, 'MioDoc', v2!.id)).toBe(true);
    const dopoElimina = leggiVersioni(dep, 'MioDoc');
    expect(dopoElimina.length).toBe(1);
    expect(dopoElimina[0].id).toBe(v1!.id);

    // Svuota
    svuotaVersioni(dep, 'MioDoc');
    expect(leggiVersioni(dep, 'MioDoc').length).toBe(0);
  });

  it('DocsVersioni renderizza le versioni ed emette eventi crea, ripristina, elimina', async () => {
    const dialog: any = document.createElement('docs-versioni');
    const doc = daTesto('Testo di prova per la versione');
    dialog.versioni = [
      {
        id: 'v1',
        titolo: 'Doc',
        salvato: Date.now(),
        nome: 'Capitolo 1',
        doc,
        parole: 6,
        caratteri: 31,
      },
    ];
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    const lista = q(dialog, '.lista-versioni');
    expect(lista).not.toBeNull();
    expect(lista?.querySelectorAll('.elemento-versione').length).toBe(1);

    let eventoCrea: any = null;
    let eventoRipristina: any = null;
    let eventoElimina: any = null;
    let eventoChiudi = false;

    dialog.addEventListener('crea', (e: CustomEvent) => { eventoCrea = e.detail; });
    dialog.addEventListener('ripristina', (e: CustomEvent) => { eventoRipristina = e.detail; });
    dialog.addEventListener('elimina', (e: CustomEvent) => { eventoElimina = e.detail; });
    dialog.addEventListener('chiudi', () => { eventoChiudi = true; });

    // Salva nuova versione
    const campoNome = q(dialog, '.campo-nome') as HTMLInputElement;
    campoNome.value = 'Nuova versione manuale';
    campoNome.dispatchEvent(new Event('input', { bubbles: true }));
    const btnSalva = q(dialog, '.bottone-salva') as HTMLButtonElement;
    btnSalva.click();

    expect(eventoCrea?.nome).toBe('Nuova versione manuale');

    // Ripristina
    const btnRipristina = q(dialog, 'button.ripristina') as HTMLButtonElement;
    btnRipristina.click();
    expect(eventoRipristina?.versione?.id).toBe('v1');

    // Elimina
    const btnElimina = q(dialog, 'button.elimina') as HTMLButtonElement;
    btnElimina.click();
    expect(eventoElimina?.id).toBe('v1');

    // Chiudi
    const btnChiudi = q(dialog, 'button.chiudi') as HTMLButtonElement;
    btnChiudi.click();
    expect(eventoChiudi).toBe(true);
  });

  it('DocsGuscio: Menu File > Cronologia versioni permette salvataggio e ripristino', async () => {
    const el = await montaGuscio();
    const editor: any = q(el, 'docs-editor');

    // Scrivi qualcosa nel documento
    editor.applicaAzione({ tipo: 'testo', testo: 'Versione originale di partenza' });
    await el.updateComplete;

    // Apri Cronologia versioni
    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'file', voce: 'Cronologia versioni' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    const dialog = q(el, 'docs-versioni');
    expect(dialog).not.toBeNull();

    // Crea snapshot
    dialog?.dispatchEvent(new CustomEvent('crea', {
      detail: { nome: 'Snapshot 1' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    // Modifica il documento
    editor.applicaAzione({ tipo: 'testo', testo: ' - testo aggiunto dopo la versione' });
    expect(testoDi(editor.stato.doc)).toContain('testo aggiunto');

    // Ripristina la versione salvata
    const lette = leggiVersioni(window.localStorage, el.titolo);
    expect(lette.length).toBeGreaterThanOrEqual(1);

    dialog?.dispatchEvent(new CustomEvent('ripristina', {
      detail: { versione: lette[0] },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    // Il documento è tornato allo stato della versione precedente
    expect(testoDi(editor.stato.doc)).toBe('Versione originale di partenza');
    // Il dialogo si chiude automaticamente dopo il ripristino
    expect(q(el, 'docs-versioni')).toBeNull();
  });

  it('nessun elemento in DocsGuscio ha stili in linea (CSP compliant)', async () => {
    const el = await montaGuscio();
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.apriVersioni();
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
