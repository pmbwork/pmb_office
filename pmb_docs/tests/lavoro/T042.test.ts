import { describe, it, expect, beforeEach } from 'vitest';
import { disegna, marcatore, classiParagrafo, domDaPosizione, posizioneDaDom } from '../../src/editor/render';
import {
  daTesto, applicaAttributo, applicaParagrafo, cambiaRientro, applicaSegno, testoParagrafo, type Documento, type Selezione,
} from '../../src/modello/documento';

let box: HTMLElement;
beforeEach(() => { document.body.innerHTML = ''; box = document.createElement('div'); document.body.appendChild(box); });
function sel(p1: number, o1: number, p2 = p1, o2 = o1): Selezione { return { ancora: { p: p1, o: o1 }, fuoco: { p: p2, o: o2 } }; }

describe('T042: disegno con carattere, corpo e colori', () => {
  it('i tratti con corpo, carattere, colore ed evidenziazione ricevono lo stile dal codice', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 2), 'z', 18);
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'f', 'Times New Roman');
    d = applicaAttributo(d, sel(0, 4, 0, 6), 'k', '#ff0000');
    d = applicaAttributo(d, sel(0, 4, 0, 5), 'h', '#ffff00');
    d = applicaSegno(d, sel(0, 0, 0, 1), 'g', true);
    disegna(box, d);
    const s = Array.from(box.querySelectorAll('span')) as HTMLElement[];
    expect(s.map((x) => x.textContent)).toEqual(['a', 'b', 'cd', 'e', 'f']);
    expect(s[0].style.fontSize).toBe('18pt');
    expect(s[0].className).toBe('g');
    expect(s[1].style.fontSize).toBe('18pt');
    expect(s[2].style.fontFamily).toContain('Times New Roman');
    expect(s[3].style.color).not.toBe('');
    expect(s[3].style.backgroundColor).not.toBe('');
    expect(s[4].style.color).not.toBe('');
    expect(s[4].style.backgroundColor).toBe('');
  });

  it('un documento senza attributi non ha né stili né classi né marcatori', () => {
    disegna(box, daTesto('uno\ndue\n'));
    expect(box.querySelectorAll('[style]').length).toBe(0);
    expect(box.querySelectorAll('[data-m]').length).toBe(0);
    for (const p of Array.from(box.children)) expect(p.getAttribute('class')).toBeNull();
  });
});

describe('T042: disegno dei paragrafi', () => {
  it('classi di allineamento, interlinea, stile, rientro ed elenco; i valori normali non lasciano classi', () => {
    let d = daTesto('uno\ndue\ntre\nquattro');
    d = applicaParagrafo(d, sel(0, 0), 'al', 'ce');
    d = applicaParagrafo(d, sel(0, 0), 'st', '1');
    d = applicaParagrafo(d, sel(1, 0), 'al', 'dx');
    d = applicaParagrafo(d, sel(1, 0), 'ls', 1.5);
    d = applicaParagrafo(d, sel(2, 0), 'al', 'gi');
    d = applicaParagrafo(d, sel(2, 0), 'ls', 2);
    d = applicaParagrafo(d, sel(2, 0), 'st', 't');
    d = applicaParagrafo(d, sel(3, 0), 'ls', 1.15);
    d = applicaParagrafo(d, sel(3, 0), 'st', 'n');
    d = applicaParagrafo(d, sel(3, 0), 'al', 'sx');
    d = cambiaRientro(d, sel(3, 0), 3);
    disegna(box, d);
    const classi = Array.from(box.children).map((p) => p.getAttribute('class'));
    expect(classi).toEqual(['al-ce st-1', 'al-dx ls-150', 'al-gi ls-200 st-t', 'ri-3']);
    expect(classiParagrafo(d.paragrafi[0])).toBe('al-ce st-1');
    expect(classiParagrafo({ runs: [] })).toBe('');
    expect(classiParagrafo({ runs: [], ls: 1.08 })).toBe('ls-108');
  });

  it('elenchi: punti per livello, numeri, lettere e numeri romani; data-m non entra nel testo', () => {
    let d = daTesto('a\nb\nc\nd\ne\nf\ng');
    d = applicaParagrafo(d, sel(0, 0, 6, 0), 'el', 'n');
    d = cambiaRientro(d, sel(1, 0, 2, 0), 1);
    d = cambiaRientro(d, sel(2, 0), 1);
    disegna(box, d);
    const m = Array.from(box.children).map((p) => p.getAttribute('data-m'));
    expect(m).toEqual(['1.', 'a.', 'i.', '2.', '3.', '4.', '5.']);
    expect(Array.from(box.children).map((p) => p.getAttribute('class'))).toEqual(['el', 'ri-1 el', 'ri-2 el', 'el', 'el', 'el', 'el']);
    expect(box.textContent).toBe('abcdefg');
    const puntati = applicaParagrafo(daTesto('x\ny\nz'), sel(0, 0, 2, 0), 'el', 'p');
    disegna(box, cambiaRientro(cambiaRientro(puntati, sel(1, 0, 2, 0), 1), sel(2, 0), 1));
    expect(Array.from(box.children).map((p) => p.getAttribute('data-m'))).toEqual(['•', '◦', '▪']);
  });

  it('marcatore: lettere e numeri romani oltre il primo giro', () => {
    const n = (numero: number, ri: number) => marcatore({ runs: [], el: 'n', ri }, numero);
    expect(n(1, 0)).toBe('1.');
    expect(n(12, 0)).toBe('12.');
    expect(n(1, 1)).toBe('a.');
    expect(n(26, 1)).toBe('z.');
    expect(n(27, 1)).toBe('aa.');
    expect(n(52, 1)).toBe('az.');
    expect(n(53, 1)).toBe('ba.');
    expect([1, 4, 9, 14, 40, 90, 400, 1994].map((x) => n(x, 2))).toEqual(['i.', 'iv.', 'ix.', 'xiv.', 'xl.', 'xc.', 'cd.', 'mcmxciv.']);
    expect(n(1, 3)).toBe('1.');
    expect(n(2, 4)).toBe('b.');
    expect(marcatore({ runs: [], el: 'n' }, null)).toBe('');
    expect(marcatore({ runs: [] }, 3)).toBe('');
    expect(marcatore({ runs: [], el: 'p', ri: 5 }, null)).toBe('▪');
  });
});

describe('T042: la corrispondenza DOM-posizione resta valida', () => {
  it('andata e ritorno su un documento con attributi e elenchi', () => {
    let d: Documento = applicaAttributo(daTesto('abcdef\n\nxyz'), sel(0, 1, 0, 4), 'z', 20);
    d = applicaParagrafo(d, sel(2, 0), 'el', 'n');
    disegna(box, d);
    for (let p = 0; p < d.paragrafi.length; p++) {
      const lung = testoParagrafo(d.paragrafi[p]).length;
      for (let o = 0; o <= lung; o++) {
        const dom = domDaPosizione(box, { p, o })!;
        expect(dom, `${p}:${o}`).not.toBeNull();
        expect(posizioneDaDom(box, dom.nodo, dom.offset), `${p}:${o}`).toEqual({ p, o });
      }
    }
  });
});
