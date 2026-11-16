import { describe, it, expect, beforeEach } from 'vitest';
import { disegna, posizioneDaDom, domDaPosizione } from '../../src/editor/render';
import { daTesto, testoParagrafo, type Documento } from '../../src/modello/documento';

let box: HTMLElement;
beforeEach(() => { document.body.innerHTML = ''; box = document.createElement('div'); document.body.appendChild(box); });

const mista: Documento = {
  paragrafi: [
    { runs: [{ t: 'ab', g: true, c: false, s: false }, { t: 'cd', g: false, c: true, s: true }, { t: 'e', g: false, c: false, s: false }] },
    { runs: [] },
    { runs: [{ t: 'xyz', g: false, c: false, s: false }] },
  ],
};

describe('T033: disegno del documento', () => {
  it('un paragrafo per <p data-p>, un tratto per <span> con le classi dei segni', () => {
    disegna(box, mista);
    expect(box.children.length).toBe(3);
    const p0 = box.children[0];
    expect(p0.tagName).toBe('P');
    expect(p0.getAttribute('data-p')).toBe('0');
    expect(Array.from(p0.children).map((s) => [s.tagName, s.textContent, s.className])).toEqual([
      ['SPAN', 'ab', 'g'], ['SPAN', 'cd', 'c s'], ['SPAN', 'e', ''],
    ]);
    expect(box.children[2].getAttribute('data-p')).toBe('2');
  });

  it('un paragrafo vuoto contiene solo un <br>', () => {
    disegna(box, mista);
    const p1 = box.children[1];
    expect(p1.children.length).toBe(1);
    expect(p1.children[0].tagName).toBe('BR');
    expect(p1.textContent).toBe('');
  });

  it('ridisegnare sostituisce tutto e non lascia resti; nel DOM non ci sono stili in linea', () => {
    disegna(box, daTesto('uno\ndue\ntre'));
    disegna(box, daTesto('solo'));
    expect(box.children.length).toBe(1);
    expect(box.textContent).toBe('solo');
    disegna(box, mista);
    expect(box.querySelectorAll('[style]').length).toBe(0);
  });

  it('il testo dei paragrafi nel DOM coincide con quello del documento', () => {
    disegna(box, mista);
    mista.paragrafi.forEach((par, i) => expect(box.children[i].textContent).toBe(testoParagrafo(par)));
  });
});

describe('T033: dal DOM alla posizione e ritorno', () => {
  it('da un testo, da un elemento e dal contenitore', () => {
    disegna(box, mista);
    const p0 = box.children[0];
    const s1 = p0.children[1];
    expect(posizioneDaDom(box, s1.firstChild!, 1)).toEqual({ p: 0, o: 3 });
    expect(posizioneDaDom(box, p0.children[2].firstChild!, 1)).toEqual({ p: 0, o: 5 });
    expect(posizioneDaDom(box, p0.children[0].firstChild!, 0)).toEqual({ p: 0, o: 0 });
    expect(posizioneDaDom(box, p0, 0)).toEqual({ p: 0, o: 0 });
    expect(posizioneDaDom(box, p0, 2)).toEqual({ p: 0, o: 4 });
    expect(posizioneDaDom(box, p0, 3)).toEqual({ p: 0, o: 5 });
    expect(posizioneDaDom(box, s1, 1)).toEqual({ p: 0, o: 4 });
    expect(posizioneDaDom(box, box.children[1], 0)).toEqual({ p: 1, o: 0 });
    expect(posizioneDaDom(box, box.children[2].firstChild!.firstChild!, 2)).toEqual({ p: 2, o: 2 });
    expect(posizioneDaDom(box, box, 2)).toEqual({ p: 2, o: 0 });
    expect(posizioneDaDom(box, box, 9)).toEqual({ p: 2, o: 3 });
  });

  it('un punto fuori dalla pagina non ha posizione', () => {
    disegna(box, mista);
    const fuori = document.createElement('div');
    fuori.textContent = 'altro';
    document.body.appendChild(fuori);
    expect(posizioneDaDom(box, fuori.firstChild!, 1)).toBeNull();
    expect(posizioneDaDom(box, fuori, 0)).toBeNull();
    const vuoto = document.createElement('div');
    expect(posizioneDaDom(vuoto, vuoto, 0)).toBeNull();
  });

  it('domDaPosizione: nei tratti, ai confini tra tratti, nei paragrafi vuoti, fuori', () => {
    disegna(box, mista);
    const t = (p: number, o: number): [string | null, number] | null => {
      const r = domDaPosizione(box, { p, o });
      return r ? [r.nodo.nodeType === 3 ? (r.nodo.nodeValue as string) : null, r.offset] : null;
    };
    expect(t(0, 0)).toEqual(['ab', 0]);
    expect(t(0, 1)).toEqual(['ab', 1]);
    expect(t(0, 2)).toEqual(['ab', 2]);
    expect(t(0, 3)).toEqual(['cd', 1]);
    expect(t(0, 5)).toEqual(['e', 1]);
    expect(t(2, 3)).toEqual(['xyz', 3]);
    const vuoto = domDaPosizione(box, { p: 1, o: 0 })!;
    expect(vuoto.nodo).toBe(box.children[1]);
    expect(vuoto.offset).toBe(0);
    expect(t(0, 6)).toBeNull();
    expect(t(3, 0)).toBeNull();
    expect(t(-1, 0)).toBeNull();
  });

  it('andata e ritorno su ogni posizione di un documento con segni diversi', () => {
    disegna(box, mista);
    for (let p = 0; p < mista.paragrafi.length; p++) {
      const lung = testoParagrafo(mista.paragrafi[p]).length;
      for (let o = 0; o <= lung; o++) {
        const dom = domDaPosizione(box, { p, o })!;
        expect(dom, `${p}:${o}`).not.toBeNull();
        expect(posizioneDaDom(box, dom.nodo, dom.offset), `${p}:${o}`).toEqual({ p, o });
      }
    }
  });
});
