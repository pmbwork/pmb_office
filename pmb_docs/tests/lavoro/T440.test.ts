// T440: togliere tanti paragrafi in un colpo (Seleziona tutto + Canc) dà lo stesso disegno, riusando i nodi che restano.
import { describe, it, expect } from 'vitest';
import { disegna } from '../../src/editor/render';
import { daTesto, type Documento } from '../../src/modello/documento';

const righe = (n: number) => Array.from({ length: n }, (_, i) => `Riga ${i + 1}`).join('\n');
const testi = (z: HTMLElement) => Array.from(z.children).map((c) => c.textContent);

describe('T440: rimozione in blocco', () => {
  it('da 3000 paragrafi a uno: resta solo il paragrafo vuoto, numerato da 0', () => {
    const z = document.createElement('div');
    disegna(z, daTesto(righe(3000)));
    expect(z.children.length).toBe(3000);
    disegna(z, daTesto(''));
    expect(z.children.length).toBe(1);
    expect(z.children[0].getAttribute('data-p')).toBe('0');
    expect(testi(z)).toEqual(['']);
  });
  it('si tolgono 500 paragrafi in fondo: i primi restano gli stessi nodi', () => {
    const z = document.createElement('div');
    const doc: Documento = daTesto(righe(600));
    disegna(z, doc);
    const primi = Array.from(z.children).slice(0, 100);
    disegna(z, { ...doc, paragrafi: doc.paragrafi.slice(0, 100) });
    expect(z.children.length).toBe(100);
    primi.forEach((p, i) => expect(z.children[i]).toBe(p));
  });
  it('si tolgono 400 paragrafi all\'inizio: quelli rimasti si rinumerano e il disegno è uguale a uno da zero', () => {
    const z = document.createElement('div');
    const doc: Documento = daTesto(righe(500));
    disegna(z, doc);
    const resto: Documento = { ...doc, paragrafi: doc.paragrafi.slice(400) };
    disegna(z, resto);
    const z2 = document.createElement('div');
    disegna(z2, resto);
    expect(z.innerHTML).toBe(z2.innerHTML);
    expect(z.children[0].getAttribute('data-p')).toBe('0');
  });
  it('un elenco numerato e una tabella tra i paragrafi tolti non lasciano resti', () => {
    const z = document.createElement('div');
    const base = daTesto(righe(300));
    const conTab: Documento = { ...base, paragrafi: [...base.paragrafi.slice(0, 150), { tb: { i: 1, r: 0, c: 0 }, runs: [{ t: 'a', g: false, c: false, s: false }] }, ...base.paragrafi.slice(150)] };
    disegna(z, conTab);
    expect(z.querySelectorAll('table').length).toBe(1);
    disegna(z, daTesto('fine'));
    expect(z.querySelectorAll('table').length).toBe(0);
    expect(testi(z)).toEqual(['fine']);
  });
});

describe('T440: la selezione evidenziata con migliaia di rettangoli si toglie in blocco', () => {
  it('dopo aver messo molti rettangoli, aggiornare la sovrapposizione li elimina tutti e lascia il cursore', async () => {
    await import('../../src/editor/docs-editor');
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;
    const sov = ed.shadowRoot.querySelector('.sovrapposizione') as HTMLElement;
    for (let i = 0; i < 300; i++) { const d = document.createElement('div'); d.className = i % 2 ? 'selezione' : 'trovato'; sov.appendChild(d); }
    expect(sov.querySelectorAll('.selezione, .trovato').length).toBe(300);
    ed.aggiornaSovrapposizione();
    expect(sov.querySelectorAll('.selezione, .trovato').length).toBeLessThan(5);
    expect(sov.querySelector('.cursore')).not.toBeNull();
  });
  it('con pochi rettangoli (percorso uno a uno) il risultato è lo stesso', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;
    const sov = ed.shadowRoot.querySelector('.sovrapposizione') as HTMLElement;
    for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'selezione'; sov.appendChild(d); }
    ed.aggiornaSovrapposizione();
    expect(sov.querySelectorAll('.selezione').length).toBeLessThan(3);
    expect(sov.querySelector('.cursore')).not.toBeNull();
  });
});
