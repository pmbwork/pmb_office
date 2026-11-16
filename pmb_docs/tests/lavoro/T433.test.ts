// T433: Salva su un file aperto con Apri: il permesso di scrittura si chiede, e se manca non resta tutto fermo.
import { describe, it, expect } from 'vitest';
import { assicuraScrittura, scriviSuManiglia, type ManiglioFile } from '../../src/formati/file-io';

function maniglia(perm: string, dopoRichiesta: string, scritture: Uint8Array[] = []): ManiglioFile & { richieste: number } {
  let corrente = perm;
  const m: any = {
    richieste: 0,
    queryPermission: async () => corrente,
    requestPermission: async () => { m.richieste++; corrente = dopoRichiesta; return corrente; },
    createWritable: async () => ({ write: async (d: Uint8Array) => { scritture.push(d); }, close: async () => {} }),
  };
  return m;
}

describe('T433: permesso di scrittura (senza mai chiederlo: WebView2 non mostra la richiesta)', () => {
  it('già concesso: si scrive', async () => {
    const scritture: Uint8Array[] = [];
    const m = maniglia('granted', 'granted', scritture);
    await scriviSuManiglia(m, new Uint8Array([1, 2]));
    expect(scritture.length).toBe(1);
    expect(m.richieste).toBe(0);
  });
  it('sola lettura: NON chiede il permesso (resterebbe in sospeso) e rifiuta con un errore chiaro', async () => {
    const scritture: Uint8Array[] = [];
    const m = maniglia('prompt', 'granted', scritture);
    await expect(scriviSuManiglia(m, new Uint8Array([1]))).rejects.toThrow('permesso');
    expect(m.richieste).toBe(0);
    expect(scritture.length).toBe(0);
    expect(await assicuraScrittura(m)).toBe(false);
  });
  it('senza le funzioni dei permessi (altri ambienti) si scrive direttamente', async () => {
    const scritture: Uint8Array[] = [];
    const m: any = { createWritable: async () => ({ write: async (d: Uint8Array) => { scritture.push(d); }, close: async () => {} }) };
    await scriviSuManiglia(m, new Uint8Array([9]));
    expect(scritture.length).toBe(1);
  });
});

describe('T433: Salva su un file aperto di sola lettura', () => {
  it('Salva passa da Salva con nome partendo dal file aperto, poi i Salva successivi sono silenziosi', async () => {
    await import('../../src/guscio/docs-guscio');
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const letto = maniglia('prompt', 'prompt');
    let partenze: unknown[] = [];
    const scritture: Uint8Array[] = [];
    g.salva = async (_n: string, _b: Uint8Array, _m: string, da?: unknown) => { partenze.push(da); return maniglia('granted', 'granted', scritture); };
    g.maniglia = letto; // come dopo Apri: file collegato ma di sola lettura
    await g.salvaDocumento();
    expect(partenze).toEqual([letto]); // Salva con nome si apre sul file aperto
    await g.salvaDocumento();
    expect(partenze.length).toBe(1); // ora il file è scrivibile: nessun'altra finestra
    expect(scritture.length).toBe(1);
  });
});
