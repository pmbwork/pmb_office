// T436: disegno incrementale — i paragrafi non toccati riusano il loro nodo, il risultato è identico a un disegno da zero.
import { describe, it, expect, beforeEach } from 'vitest';
import { disegna } from '../../src/editor/render';
import { type Documento, type Paragrafo } from '../../src/modello/documento';

let box: HTMLElement;
beforeEach(() => { document.body.innerHTML = ''; box = document.createElement('div'); document.body.appendChild(box); });

const par = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => ({ runs: t === '' ? [] : [{ t, g: false, c: false, s: false }], ...extra });
const doc = (...p: Paragrafo[]): Documento => ({ paragrafi: p });
const daZero = (d: Documento): string => { const b = document.createElement('div'); document.body.appendChild(b); disegna(b, d); const h = b.innerHTML; b.remove(); return h; };

describe('T436: disegno incrementale', () => {
  it('un paragrafo invariato tiene lo stesso nodo, uno cambiato ne ha uno nuovo', () => {
    const a = par('uno'); const b = par('due'); const c = par('tre');
    disegna(box, doc(a, b, c));
    const [na, nb, nc] = Array.from(box.children);
    const b2 = par('DUE');
    disegna(box, doc(a, b2, c));
    expect(box.children[0]).toBe(na);
    expect(box.children[1]).not.toBe(nb);
    expect(box.children[2]).toBe(nc);
    expect(box.innerHTML).toBe(daZero(doc(a, b2, c)));
  });
  it('un paragrafo inserito in mezzo rinumera i successivi (data-p) senza ricrearli', () => {
    const a = par('uno'); const c = par('tre');
    disegna(box, doc(a, c));
    const nc = box.children[1];
    disegna(box, doc(a, par('nuovo'), c));
    expect(box.children.length).toBe(3);
    expect(box.children[2]).toBe(nc);
    expect(nc.getAttribute('data-p')).toBe('2');
    expect(box.innerHTML).toBe(daZero(doc(a, par('nuovo'), c)));
  });
  it('un paragrafo cancellato sparisce e gli altri scalano', () => {
    const a = par('uno'); const b = par('due'); const c = par('tre');
    disegna(box, doc(a, b, c));
    const nc = box.children[2];
    disegna(box, doc(a, c));
    expect(box.children.length).toBe(2);
    expect(box.children[1]).toBe(nc);
    expect(nc.getAttribute('data-p')).toBe('1');
  });
  it('due paragrafi vuoti con lo stesso oggetto restano due nodi distinti', () => {
    const v = par('');
    disegna(box, doc(v, v, par('x')));
    disegna(box, doc(v, v, par('x')));
    expect(box.children.length).toBe(3);
    expect(box.children[0]).not.toBe(box.children[1]);
    expect(box.children[0].getAttribute('data-p')).toBe('0');
    expect(box.children[1].getAttribute('data-p')).toBe('1');
  });
  it('gli spazi di impaginazione (salto, riempimento, testo spezzato) si tolgono dal nodo riusato', () => {
    const a = par('abcdef');
    disegna(box, doc(a, par('z')));
    const p = box.children[0] as HTMLElement;
    const run = p.firstElementChild as HTMLElement;
    const testo = run.firstChild as Text;
    const salto = document.createElement('span'); salto.className = 'salto';
    run.insertBefore(salto, testo.splitText(3));
    p.style.paddingTop = '40px';
    expect(run.childNodes.length).toBe(3);
    disegna(box, doc(a, par('z')));
    expect(box.children[0]).toBe(p);
    expect(box.querySelector('.salto')).toBeNull();
    expect(p.style.paddingTop).toBe('');
    expect(run.childNodes.length).toBe(1);
    expect(run.textContent).toBe('abcdef');
    expect(box.innerHTML).toBe(daZero(doc(a, par('z'))));
  });
  it('i numeri degli elenchi si aggiornano anche su paragrafi non cambiati', () => {
    const e1 = par('a', { el: 'n' }); const e2 = par('b', { el: 'n' });
    disegna(box, doc(e1, e2));
    expect(box.children[1].getAttribute('data-m')).toBe('2.');
    disegna(box, doc(par('prima'), e1, e2));
    expect(box.children[1].getAttribute('data-m')).toBe('1.');
    expect(box.children[2].getAttribute('data-m')).toBe('2.');
    disegna(box, doc(par('prima'), e1, par('x'), e2));
    expect(box.children[3].getAttribute('data-m')).toBe('1.');
    expect(box.innerHTML).toBe(daZero(doc(par('prima'), e1, par('x'), e2)));
  });
  it('prova casuale: dopo 300 modifiche il DOM coincide sempre con un disegno da zero', () => {
    let s = 12345; const rnd = (n: number): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
    let ps: Paragrafo[] = Array.from({ length: 12 }, (_, i) => par('p' + i, i % 4 === 0 ? { el: 'n' } : {}));
    for (let k = 0; k < 300; k++) {
      const op = rnd(4); const i = rnd(ps.length);
      if (op === 0) ps = [...ps.slice(0, i), par('n' + k, rnd(2) ? { el: 'n' } : {}), ...ps.slice(i)];
      else if (op === 1 && ps.length > 2) ps = [...ps.slice(0, i), ...ps.slice(i + 1)];
      else if (op === 2) ps = ps.map((x, j) => (j === i ? par('m' + k, x.el ? { el: x.el } : {}) : x));
      else { const j = rnd(ps.length); const c = [...ps]; [c[i], c[j]] = [c[j], c[i]]; ps = c; }
      disegna(box, doc(...ps));
      expect(box.innerHTML).toBe(daZero(doc(...ps)));
    }
  });
});
