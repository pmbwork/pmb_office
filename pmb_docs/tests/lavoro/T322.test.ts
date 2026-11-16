import { describe, it, expect, beforeEach } from 'vitest';
import { disegna } from '../../src/editor/render';
import {
  daTesto, applicaAttributo, impostaAttributo, formatoSelezione, inserisciTesto, serializza, deserializza, cursore, statoIniziale,
  type Documento, type Selezione,
} from '../../src/modello/documento';

let box: HTMLElement;
beforeEach(() => { document.body.innerHTML = ''; box = document.createElement('div'); document.body.appendChild(box); });
function sel(p1: number, o1: number, p2 = p1, o2 = o1): Selezione { return { ancora: { p: p1, o: o1 }, fuoco: { p: p2, o: o2 } }; }
const testi = (d: Documento): Array<[string, string | undefined, string | undefined]> => d.paragrafi[0].runs.map((r) => [r.t, r.x, r.v]);

describe('T322: barrato, apice e pedice nel modello', () => {
  it('barrato sulla selezione: il tratto si divide e solo quel pezzo è barrato', () => {
    const d = applicaAttributo(daTesto('abcdef'), sel(0, 1, 0, 4), 'x', 'b');
    expect(testi(d)).toEqual([['a', undefined, undefined], ['bcd', 'b', undefined], ['ef', undefined, undefined]]);
  });

  it('apice e pedice sono due valori dello stesso attributo', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 2), 'v', 'p');
    d = applicaAttributo(d, sel(0, 4, 0, 6), 'v', 'd');
    expect(testi(d)).toEqual([['ab', undefined, 'p'], ['cd', undefined, undefined], ['ef', undefined, 'd']]);
  });

  it('togliere l\'attributo (valore undefined) unisce di nuovo i tratti', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 1, 0, 4), 'x', 'b');
    d = applicaAttributo(d, sel(0, 0, 0, 6), 'x', undefined);
    expect(d.paragrafi[0].runs).toHaveLength(1);
    expect(d.paragrafi[0].runs[0].x).toBeUndefined();
  });

  it('due tratti vicini con lo stesso barrato si uniscono, con valori diversi no', () => {
    let d = applicaAttributo(daTesto('abcd'), sel(0, 0, 0, 2), 'v', 'p');
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'v', 'p');
    expect(d.paragrafi[0].runs).toHaveLength(1);
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'v', 'd');
    expect(d.paragrafi[0].runs).toHaveLength(2);
  });

  it('formatoSelezione: l\'attributo c\'è solo se è uguale in tutta la selezione', () => {
    const d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 3), 'x', 'b');
    expect(formatoSelezione(d, sel(0, 0, 0, 3)).x).toBe('b');
    expect(formatoSelezione(d, sel(0, 0, 0, 5)).x).toBeUndefined();
    expect(formatoSelezione(d, sel(0, 4, 0, 6)).x).toBeUndefined();
    expect(formatoSelezione(d, sel(0, 1, 0, 2)).x).toBe('b');
  });

  it('formatoSelezione riconosce anche apice e pedice', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 3), 'v', 'p');
    d = applicaAttributo(d, sel(0, 3, 0, 6), 'v', 'd');
    expect(formatoSelezione(d, sel(0, 0, 0, 3)).v).toBe('p');
    expect(formatoSelezione(d, sel(0, 3, 0, 6)).v).toBe('d');
    expect(formatoSelezione(d, sel(0, 1, 0, 5)).v).toBeUndefined();
  });

  it('andando a capo in fondo a un tratto barrato o in apice, il formato resta per il paragrafo nuovo', () => {
    const barrato = applicaAttributo(daTesto('ab'), sel(0, 0, 0, 2), 'x', 'b');
    expect(inserisciTesto({ ...statoIniziale(barrato), sel: cursore(0, 2) }, '\n').pendenti?.x).toBe('b');
    const apice = applicaAttributo(daTesto('ab'), sel(0, 0, 0, 2), 'v', 'p');
    expect(inserisciTesto({ ...statoIniziale(apice), sel: cursore(0, 2) }, '\n').pendenti?.v).toBe('p');
    expect(inserisciTesto({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 2) }, '\n').pendenti).toBeNull();
  });

  it('con il cursore fermo l\'attributo vale per il testo scritto dopo', () => {
    let s = impostaAttributo(statoIniziale(daTesto('ab')), 'v', 'p');
    s = inserisciTesto({ ...s, sel: cursore(0, 2) }, 'XY');
    expect(testi(s.doc)).toEqual([['ab', undefined, undefined], ['XY', undefined, 'p']]);
  });

  it('barrato e pedice insieme sullo stesso tratto', () => {
    let d = applicaAttributo(daTesto('abc'), sel(0, 0, 0, 3), 'x', 'b');
    d = applicaAttributo(d, sel(0, 0, 0, 3), 'v', 'd');
    const r = d.paragrafi[0].runs[0];
    expect([r.x, r.v]).toEqual(['b', 'd']);
  });
});

describe('T322: salvataggio', () => {
  it('andata e ritorno con barrato, apice e pedice', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 2), 'x', 'b');
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'v', 'p');
    d = applicaAttributo(d, sel(0, 4, 0, 6), 'v', 'd');
    const letto = deserializza(serializza(d));
    expect(testi(letto)).toEqual(testi(d));
  });

  it('un tratto normale non scrive i due campi', () => {
    const tratto = JSON.parse(serializza(daTesto('ciao'))).p[0][0];
    expect(Object.keys(tratto)).not.toContain('x');
    expect(Object.keys(tratto)).not.toContain('v');
  });

  it('un documento con valori sbagliati è rifiutato', () => {
    const base = JSON.parse(serializza(daTesto('ciao')));
    const con = (campi: Record<string, unknown>): string => JSON.stringify({ ...base, p: [[{ t: 'ciao', ...campi }]] });
    expect(() => deserializza(con({ x: 'b' }))).not.toThrow();
    expect(() => deserializza(con({ v: 'p' }))).not.toThrow();
    expect(() => deserializza(con({ v: 'd' }))).not.toThrow();
    expect(() => deserializza(con({ x: 'q' }))).toThrow();
    expect(() => deserializza(con({ x: 1 }))).toThrow();
    expect(() => deserializza(con({ v: 'z' }))).toThrow();
    expect(() => deserializza(con({ v: true }))).toThrow();
  });
});

describe('T322: disegno', () => {
  it('le classi dei tratti: x per il barrato, ap per l\'apice, pe per il pedice', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 2), 'x', 'b');
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'v', 'p');
    d = applicaAttributo(d, sel(0, 4, 0, 6), 'v', 'd');
    disegna(box, d);
    const s = Array.from(box.querySelectorAll('span')) as HTMLElement[];
    expect(s.map((x) => x.className)).toEqual(['x', 'ap', 'pe']);
    expect(s.map((x) => x.textContent)).toEqual(['ab', 'cd', 'ef']);
  });

  it('barrato insieme a grassetto e sottolineato: le classi si sommano', () => {
    let d = applicaAttributo(daTesto('abc'), sel(0, 0, 0, 3), 'x', 'b');
    d = applicaAttributo(d, sel(0, 0, 0, 3), 'v', 'p');
    disegna(box, d);
    expect((box.querySelector('span') as HTMLElement).className).toBe('x ap');
  });

  it('apice e pedice con un corpo scelto: il corpo si riduce a 58 centesimi, il barrato no', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 6), 'z', 20);
    d = applicaAttributo(d, sel(0, 0, 0, 2), 'v', 'p');
    d = applicaAttributo(d, sel(0, 2, 0, 4), 'v', 'd');
    d = applicaAttributo(d, sel(0, 4, 0, 6), 'x', 'b');
    disegna(box, d);
    const s = Array.from(box.querySelectorAll('span')) as HTMLElement[];
    expect(s.map((x) => x.style.fontSize)).toEqual(['11.6pt', '11.6pt', '20pt']);
  });

  it('senza corpo scelto non c\'è corpo in linea e la riduzione la fa il foglio di stile', () => {
    const d = applicaAttributo(daTesto('abc'), sel(0, 0, 0, 3), 'v', 'p');
    disegna(box, d);
    expect((box.querySelector('span') as HTMLElement).style.fontSize).toBe('');
  });

  it('le posizioni nel testo restano quelle di prima: il testo disegnato è lo stesso', () => {
    const d = applicaAttributo(daTesto('abcdef'), sel(0, 1, 0, 5), 'x', 'b');
    disegna(box, d);
    expect(box.textContent).toBe('abcdef');
  });
});
