// T545: cronologia delle versioni di pmb_docs legata al file (percorso) quando si conosce, non solo al titolo (analisi del 2026-11-18):
// prima due documenti con lo stesso nome in cartelle diverse, o tutti i «senza titolo», mescolavano le versioni. Le versioni salvate col solo
// titolo passano al file la prima volta. Se una versione non si salva (spazio pieno) lo si dice.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chiaveVersioni, leggiVersioni, migraVersioni, salvaNuovaVersione } from '../../src/formati/versioni';
import { daTesto } from '../../src/modello/documento';
import '../../src/guscio/docs-guscio';
import { manigliaNativa } from '@comune/file-nativi';

describe('T545: versioni legate al file', () => {
  beforeEach(() => { localStorage.clear(); });

  it('stesso titolo, file diversi: cronologie separate', () => {
    salvaNuovaVersione(localStorage, 'Relazione', daTesto('A'), 'prima', 1000, 'file:C:\\Lavoro\\Relazione.docx');
    salvaNuovaVersione(localStorage, 'Relazione', daTesto('B'), 'seconda', 2000, 'file:D:\\Casa\\Relazione.docx');
    expect(leggiVersioni(localStorage, 'file:C:\\Lavoro\\Relazione.docx').map((v) => v.nome)).toEqual(['prima']);
    expect(leggiVersioni(localStorage, 'file:D:\\Casa\\Relazione.docx').map((v) => v.nome)).toEqual(['seconda']);
    expect(leggiVersioni(localStorage, 'Relazione')).toEqual([]);
  });
  it('senza chiave si usa il titolo, come prima', () => {
    salvaNuovaVersione(localStorage, 'Nota', daTesto('x'), 'v1', 1000);
    expect(leggiVersioni(localStorage, 'Nota').map((v) => v.nome)).toEqual(['v1']);
  });
  it('le versioni salvate col solo titolo passano al file una volta sola', () => {
    salvaNuovaVersione(localStorage, 'Contratto', daTesto('vecchio'), 'vecchia', 1000);
    migraVersioni(localStorage, 'Contratto', 'file:C:\\Contratto.docx');
    expect(leggiVersioni(localStorage, 'file:C:\\Contratto.docx').map((v) => v.nome)).toEqual(['vecchia']);
    expect(localStorage.getItem(chiaveVersioni('Contratto'))).toBeNull();
    salvaNuovaVersione(localStorage, 'Contratto', daTesto('altro'), 'di un altro file', 2000);
    migraVersioni(localStorage, 'Contratto', 'file:C:\\Contratto.docx'); // il file ha già le sue: non si mescola
    expect(leggiVersioni(localStorage, 'file:C:\\Contratto.docx').map((v) => v.nome)).toEqual(['vecchia']);
  });
  it('nel programma: il documento aperto da un file usa il percorso; se la versione non si salva lo dice', async () => {
    document.body.innerHTML = '';
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    expect(g.idVersioni()).toBe(g.titolo);
    g.maniglia = manigliaNativa('C:\\Lavoro\\Relazione.docx');
    expect(g.idVersioni()).toBe('file:C:\\Lavoro\\Relazione.docx');
    const pieno = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('pieno', 'QuotaExceededError'); });
    try { g.suCreaVersione(new CustomEvent('crea', { detail: { nome: 'prova' } })); } finally { pieno.mockRestore(); }
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('spazio per le versioni è pieno');
  });
});
