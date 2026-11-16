import { describe, it, expect } from 'vitest';
import {
  OGGETTO, alternaSegno, applicaAttributo, cancella, cancellaSelezione, cursore, daTesto, deserializza, dimensioniIniziali, estraiTesto,
  immagineSelezionata, immagineValida, impostaLarghezzaImmagine, inserisciImmagine, inserisciTesto, pulisciFormato, serializza, statoIniziale,
  testoDi, testoParagrafo,
  type Documento, type Immagine, type Selezione, type Stato,
} from '../../src/modello/documento';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const img = (w = 200, h = 100, s = PNG): Immagine => ({ s, w, h });
const sel = (p: number, da: number, p2: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p: p2, o: a } });
const tratti = (d: Documento) => d.paragrafi[0].runs.map((r) => [r.t === OGGETTO ? '[img]' : r.t, r.im ? [r.im.w, r.im.h] : null]);
/** "ab" + immagine + "cd", cursore a fine testo */
function conImmagine(w = 200, h = 100): Stato {
  const s = inserisciImmagine({ ...statoIniziale(daTesto('abcd')), sel: cursore(0, 2) }, img(w, h));
  return s;
}

describe('T120: quali immagini si accettano', () => {
  it('png, jpeg, gif e webp incorporati, con misure da 1 a 10000', () => {
    for (const tipo of ['png', 'jpeg', 'gif', 'webp']) expect(immagineValida(img(10, 10, `data:image/${tipo};base64,AAAA`)), tipo).toBe(true);
    expect(immagineValida(img(1, 10000))).toBe(true);
  });

  it('niente svg, altri tipi, indirizzi esterni, base64 rotto, misure sbagliate, immagini enormi', () => {
    const no: unknown[] = [
      img(10, 10, 'data:image/svg+xml;base64,AAAA'), img(10, 10, 'data:text/html;base64,AAAA'), img(10, 10, 'https://esempio.it/a.png'),
      img(10, 10, 'javascript:alert(1)'), img(10, 10, 'data:image/png;base64,'), img(10, 10, 'data:image/png;base64,AA AA'), img(10, 10, 'data:image/png,AAAA'),
      img(0, 10), img(10, 0), img(10001, 10), img(NaN, 10), img(10, Infinity), { s: PNG, w: 10 }, null, 'x', 5,
      img(10, 10, 'data:image/png;base64,' + 'A'.repeat(7_000_000)),
    ];
    for (const x of no) expect(immagineValida(x), JSON.stringify(x)?.slice(0, 60)).toBe(false);
  });

  it('dimensioniIniziali sta dentro il testo (602 px) e l\'altezza massima (900 px), senza mai ingrandire', () => {
    expect(dimensioniIniziali(300, 200)).toEqual({ w: 300, h: 200 });
    expect(dimensioniIniziali(1204, 400)).toEqual({ w: 602, h: 200 });
    expect(dimensioniIniziali(400, 1800)).toEqual({ w: 200, h: 900 });
    expect(dimensioniIniziali(1204, 802)).toEqual({ w: 602, h: 401 });
    expect(dimensioniIniziali(1, 1)).toEqual({ w: 1, h: 1 });
    expect(dimensioniIniziali(0, 5)).toEqual({ w: 1, h: 1 });
  });
});

describe('T120: l\'immagine nel testo', () => {
  it('si inserisce come un carattere solo, in un tratto a parte, e il cursore va dopo', () => {
    const s = conImmagine();
    expect(tratti(s.doc)).toEqual([['ab', null], ['[img]', [200, 100]], ['cd', null]]);
    expect(s.sel).toEqual(cursore(0, 3));
    expect(testoParagrafo(s.doc.paragrafi[0]).length).toBe(5);
  });

  it('sostituisce la selezione; un\'immagine non ammessa non cambia niente', () => {
    const s = inserisciImmagine({ ...statoIniziale(daTesto('abcd')), sel: sel(0, 1, 0, 3) }, img());
    expect(tratti(s.doc)).toEqual([['a', null], ['[img]', [200, 100]], ['d', null]]);
    const base = { ...statoIniziale(daTesto('abcd')), sel: cursore(0, 2) };
    expect(inserisciImmagine(base, img(10, 10, 'data:image/svg+xml;base64,AAAA'))).toBe(base);
    expect(inserisciImmagine(base, img(0, 10))).toBe(base);
  });

  it('due immagini vicine, anche uguali, restano due tratti; il testo scritto dopo un\'immagine non diventa un\'immagine', () => {
    let s = conImmagine();
    s = inserisciImmagine(s, img(200, 100));
    expect(tratti(s.doc).filter((t) => t[0] === '[img]').length).toBe(2);
    expect(s.doc.paragrafi[0].runs.length).toBe(4);
    const x = inserisciTesto(s, 'X');
    expect(tratti(x.doc)).toEqual([['ab', null], ['[img]', [200, 100]], ['[img]', [200, 100]], ['Xcd', null]]);
    const prima = inserisciTesto({ ...conImmagine(), sel: cursore(0, 2) }, 'Y');
    expect(tratti(prima.doc)[0]).toEqual(['abYcd'.slice(0, 3), null]);
  });

  it('il carattere dell\'immagine non si può scrivere né incollare né mettere in un documento nuovo', () => {
    const s = inserisciTesto(statoIniziale(), `a${OGGETTO}b`);
    expect(testoDi(s.doc)).toBe('ab');
    expect(s.doc.paragrafi[0].runs.every((r) => r.im === undefined)).toBe(true);
    expect(testoDi(daTesto(`x${OGGETTO}y`))).toBe('xy');
  });

  it('Backspace dopo l\'immagine la cancella; una selezione che la contiene pure; il testo intorno si riunisce', () => {
    const s = conImmagine();
    expect(tratti(cancella(s, 'indietro').doc)).toEqual([['abcd', null]]);
    expect(tratti(cancella({ ...s, sel: cursore(0, 2) }, 'avanti').doc)).toEqual([['abcd', null]]);
    expect(tratti(cancellaSelezione({ ...s, sel: sel(0, 1, 0, 4) }).doc)).toEqual([['ad', null]]);
  });

  it('grassetto e cancella formattazione lasciano l\'immagine; il testo copiato non contiene il carattere', () => {
    const s = conImmagine();
    const grassetto = alternaSegno({ ...s, sel: sel(0, 0, 0, 5) }, 'g');
    expect(tratti(grassetto.doc).filter((t) => t[0] === '[img]').length).toBe(1);
    expect(grassetto.doc.paragrafi[0].runs[1].g).toBe(true);
    const pulito = pulisciFormato(grassetto.doc, sel(0, 0, 0, 5));
    expect(tratti(pulito)).toEqual([['ab', null], ['[img]', [200, 100]], ['cd', null]]);
    expect(pulito.paragrafi[0].runs[1].g).toBe(false);
    expect(estraiTesto(s.doc, sel(0, 0, 0, 5))).toBe('abcd');
    const link = applicaAttributo(s.doc, sel(0, 0, 0, 5), 'u', 'https://esempio.it');
    expect(tratti(link).filter((t) => t[0] === '[img]').length).toBe(1);
  });
});

describe('T120: selezionare e ridimensionare', () => {
  it('immagineSelezionata c\'è solo se la selezione è esattamente un\'immagine', () => {
    const s = conImmagine();
    expect(immagineSelezionata(s.doc, sel(0, 2, 0, 3))).toEqual({ p: 0, o: 2, im: img() });
    expect(immagineSelezionata(s.doc, sel(0, 3, 0, 2))).toEqual({ p: 0, o: 2, im: img() });
    expect(immagineSelezionata(s.doc, cursore(0, 2))).toBeNull();
    expect(immagineSelezionata(s.doc, sel(0, 1, 0, 3))).toBeNull();
    expect(immagineSelezionata(s.doc, sel(0, 0, 0, 1))).toBeNull();
    expect(immagineSelezionata(s.doc, sel(0, 2, 0, 4))).toBeNull();
  });

  it('impostaLarghezzaImmagine tiene le proporzioni, resta selezionata e limita da 20 a 2000', () => {
    const s = { ...conImmagine(200, 100), sel: sel(0, 2, 0, 3) };
    const m = impostaLarghezzaImmagine(s, 100);
    expect(tratti(m.doc)[1]).toEqual(['[img]', [100, 50]]);
    expect(m.sel).toEqual(sel(0, 2, 0, 3));
    expect(tratti(impostaLarghezzaImmagine(s, 301).doc)[1][1]).toEqual([301, 151]);
    expect(tratti(impostaLarghezzaImmagine(s, 1).doc)[1][1]).toEqual([20, 10]);
    expect(tratti(impostaLarghezzaImmagine(s, 99999).doc)[1][1]).toEqual([2000, 1000]);
    expect(impostaLarghezzaImmagine({ ...s, sel: cursore(0, 2) }, 100)).toEqual({ ...s, sel: cursore(0, 2) });
    expect(impostaLarghezzaImmagine(s, NaN)).toBe(s);
  });
});

describe('T120: salvare e rileggere', () => {
  it('le immagini si salvano e tornano uguali', () => {
    const s = conImmagine(321, 123);
    const t = serializza(s.doc);
    expect(t).toContain('"im":{"s":"data:image/png;base64,');
    expect(serializza(deserializza(t))).toBe(t);
    expect(tratti(deserializza(t))).toEqual(tratti(s.doc));
    expect(serializza(daTesto('niente'))).not.toContain('"im"');
  });

  it('un file con un\'immagine non ammessa, o con il carattere senza immagine, non si apre', () => {
    const f = (r: unknown) => JSON.stringify({ v: 1, p: [[r]] });
    expect(() => deserializza(f({ t: OGGETTO, im: img() }))).not.toThrow();
    for (const r of [
      { t: OGGETTO, im: img(10, 10, 'data:image/svg+xml;base64,AAAA') }, { t: OGGETTO, im: { s: PNG, w: 0, h: 5 } }, { t: OGGETTO, im: 'x' },
      { t: 'a', im: img() }, { t: OGGETTO + OGGETTO, im: img() }, { t: `a${OGGETTO}` },
    ]) expect(() => deserializza(f(r)), JSON.stringify(r).slice(0, 60)).toThrow(/immagine/);
  });
});

describe('T120: le azioni immagine e larghezzaImmagine', () => {
  it('passano da annulla e ripeti, un passo ciascuna; quelle senza effetto non registrano niente', () => {
    const ed0 = nuovoEditor({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    const ed1 = eseguiAzioneFormato(ed0, { tipo: 'immagine', immagine: img() }).ed;
    expect(tratti(statoCorrente(ed1).doc).filter((t) => t[0] === '[img]').length).toBe(1);
    expect(ed1.storia.passato.length).toBe(1);
    const ed2 = eseguiAzioneFormato(ed1, { tipo: 'vai', pos: { p: 0, o: 1 }, estendi: false }).ed;
    const ed3 = eseguiAzioneFormato(ed2, { tipo: 'vai', pos: { p: 0, o: 2 }, estendi: true }).ed;
    const ed4 = eseguiAzioneFormato(ed3, { tipo: 'larghezzaImmagine', larghezza: 50 }).ed;
    expect(tratti(statoCorrente(ed4).doc)[1]).toEqual(['[img]', [50, 25]]);
    expect(tratti(statoCorrente(eseguiAzioneFormato(ed4, { tipo: 'annulla' }).ed).doc)[1]).toEqual(['[img]', [200, 100]]);
    expect(eseguiAzioneFormato(ed0, { tipo: 'immagine', immagine: img(0, 1) }).ed).toBe(ed0);
    expect(eseguiAzioneFormato(ed0, { tipo: 'larghezzaImmagine', larghezza: 50 }).ed).toBe(ed0);
  });
});
