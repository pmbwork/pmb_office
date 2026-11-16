import { describe, it, expect } from 'vitest';
import {
  cursore, daTesto, deserializza, controllaTabelle, serializza, statoIniziale, testoParagrafo, inserisciTesto, cancella,
  type Documento, type Paragrafo, type Selezione, type Stato,
} from '../../src/modello/documento';
import {
  attraversaCelle, cancellaSuConfine, inserisciTabella, modificaTabella, svuotaSelezione, tabellaAl,
  type OperazioneTabella,
} from '../../src/editor/tabelle';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';

const sel = (p: number, da: number, p2: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p: p2, o: a } });
const testi = (d: Documento): string[] => d.paragrafi.map(testoParagrafo);
const celle = (d: Documento): string[] => d.paragrafi.map((p) => (p.tb ? `${p.tb.i}:${p.tb.r}${p.tb.c}` : '-'));
/** "ab" + tabella 2x2 (paragrafi 1-4) + paragrafo vuoto finale; cursore nel paragrafo 0 */
function conTabella(righe = 2, colonne = 2, testo = 'ab'): Stato {
  return inserisciTabella({ ...statoIniziale(daTesto(testo)), sel: cursore(0, 1) }, righe, colonne);
}
function scrivi(s: Stato, p: number, t: string): Stato {
  return inserisciTesto({ ...s, sel: cursore(p, 0) }, t);
}
const fai = (s: Stato, op: OperazioneTabella): Stato => modificaTabella(s, op);

describe('T110: inserire una tabella', () => {
  it('2x3 dopo il paragrafo del cursore: sei celle in ordine, un paragrafo dopo, cursore nella prima cella', () => {
    const s = conTabella(2, 3);
    expect(testi(s.doc).length).toBe(8);
    expect(celle(s.doc)).toEqual(['-', '0:00', '0:01', '0:02', '0:10', '0:11', '0:12', '-']);
    expect(s.doc.paragrafi[0].runs[0].t).toBe('ab');
    expect(s.sel).toEqual(cursore(1, 0));
    expect(controllaTabelle(s.doc)).toBeNull();
  });

  it('non si inserisce una tabella dentro una tabella; la seconda ha un altro numero', () => {
    const s = conTabella();
    expect(inserisciTabella(s, 2, 2)).toBe(s);
    const dopo = inserisciTabella({ ...s, sel: cursore(5, 0) }, 1, 1);
    expect(celle(dopo.doc)).toEqual(['-', '0:00', '0:01', '0:10', '0:11', '-', '1:00', '-']);
  });

  it('misure non ammesse non cambiano niente', () => {
    const s = statoIniziale(daTesto('x'));
    for (const [r, c] of [[0, 2], [2, 0], [51, 2], [2, 21], [1.5, 2], [2, NaN]]) expect(inserisciTabella(s, r, c), `${r}x${c}`).toBe(s);
    expect(inserisciTabella(s, 50, 20).doc.paragrafi.length).toBe(1 + 1000 + 1);
  });

  it('se dopo c\'è già un paragrafo normale non se ne aggiunge un altro; in fondo al documento sì', () => {
    const due = inserisciTabella({ ...statoIniziale(daTesto('a\nb')), sel: cursore(0, 0) }, 1, 1);
    expect(celle(due.doc)).toEqual(['-', '0:00', '-']);
    const fondo = inserisciTabella({ ...statoIniziale(daTesto('a\nb')), sel: cursore(1, 0) }, 1, 1);
    expect(celle(fondo.doc)).toEqual(['-', '-', '0:00', '-']);
  });

  it('una tabella inserita subito prima di un altra tabella ha il suo paragrafo in mezzo', () => {
    let s = conTabella(1, 1);
    s = { ...s, sel: cursore(0, 0) };
    const due = inserisciTabella(s, 1, 1);
    expect(celle(due.doc)).toEqual(['-', '1:00', '-', '0:00', '-']);
    expect(controllaTabelle(due.doc)).toBeNull();
  });

  it('tabellaAl legge la griglia e i paragrafi di ogni cella', () => {
    let s = conTabella(2, 2);
    s = inserisciTesto({ ...s, sel: cursore(2, 0) }, 'x\ny');
    const t = tabellaAl(s.doc, 2)!;
    expect([t.i, t.da, t.a, t.righe, t.colonne]).toEqual([0, 1, 5, 2, 2]);
    expect(t.celle[0][1].map(testoParagrafo)).toEqual(['x', 'y']);
    expect(tabellaAl(s.doc, 0)).toBeNull();
  });
});

describe('T110: righe e colonne', () => {
  it('riga sopra e sotto, colonna prima e dopo: la tabella cresce e il testo resta nella sua cella', () => {
    let s = conTabella(2, 2);
    s = scrivi(s, 2, 'B');
    s = { ...s, sel: cursore(2, 1) };
    const sopra = fai(s, 'rigaSopra');
    expect(celle(sopra.doc).slice(1, 7)).toEqual(['0:00', '0:01', '0:10', '0:11', '0:20', '0:21']);
    expect(testi(sopra.doc)[4]).toBe('B');
    expect(sopra.sel).toEqual({ ancora: { p: 4, o: 1 }, fuoco: { p: 4, o: 1 } });
    const sotto = fai(s, 'rigaSotto');
    expect(testi(sotto.doc)[2]).toBe('B');
    expect(celle(sotto.doc).length).toBe(8);
    const prima = fai(s, 'colonnaPrima');
    expect(testi(prima.doc).slice(1, 7)).toEqual(['', '', 'B', '', '', '']);
    expect(celle(prima.doc).slice(1, 7)).toEqual(['0:00', '0:01', '0:02', '0:10', '0:11', '0:12']);
    expect(prima.sel.fuoco).toEqual({ p: 3, o: 1 });
    const dopo = fai(s, 'colonnaDopo');
    expect(testi(dopo.doc).slice(1, 7)).toEqual(['', 'B', '', '', '', '']);
    for (const x of [sopra, sotto, prima, dopo]) expect(controllaTabelle(x.doc)).toBeNull();
  });

  it('eliminare una riga o una colonna toglie quella e porta il cursore nella cella vicina', () => {
    let s = conTabella(3, 3);
    s = { ...s, sel: cursore(5, 0) };
    const riga = fai(s, 'eliminaRiga');
    expect(celle(riga.doc).filter((c) => c !== '-').length).toBe(6);
    expect(riga.doc.paragrafi[riga.sel.fuoco.p].tb).toEqual({ i: 0, r: 1, c: 1 });
    const colonna = fai(s, 'eliminaColonna');
    expect(celle(colonna.doc).filter((c) => c !== '-').length).toBe(6);
    expect(colonna.doc.paragrafi[colonna.sel.fuoco.p].tb).toEqual({ i: 0, r: 1, c: 1 });
    const ultimaRiga = fai({ ...s, sel: cursore(8, 0) }, 'eliminaRiga');
    expect(ultimaRiga.doc.paragrafi[ultimaRiga.sel.fuoco.p].tb).toEqual({ i: 0, r: 1, c: 1 });
    const ultima = fai({ ...s, sel: cursore(9, 0) }, 'eliminaColonna');
    expect(ultima.doc.paragrafi[ultima.sel.fuoco.p].tb).toEqual({ i: 0, r: 2, c: 1 });
    expect(controllaTabelle(riga.doc)).toBeNull();
    expect(controllaTabelle(colonna.doc)).toBeNull();
  });

  it('togliere l\'unica riga o l\'unica colonna toglie la tabella; eliminaTabella la toglie sempre', () => {
    const una = conTabella(1, 2);
    expect(celle(fai({ ...una, sel: cursore(1, 0) }, 'eliminaRiga').doc)).toEqual(['-', '-']);
    const col = conTabella(2, 1);
    expect(celle(fai({ ...col, sel: cursore(1, 0) }, 'eliminaColonna').doc)).toEqual(['-', '-']);
    const t = conTabella(3, 3);
    const via = fai({ ...t, sel: cursore(4, 0) }, 'eliminaTabella');
    expect(testi(via.doc)).toEqual(['ab', '']);
    expect(via.sel).toEqual(cursore(1, 0));
    const tutto = fai(inserisciTabella(statoIniziale(), 1, 1), 'eliminaTabella');
    expect(tutto.doc.paragrafi.length).toBeGreaterThan(0);
  });

  it('fuori da una tabella le operazioni non fanno niente', () => {
    const s = conTabella();
    for (const op of ['rigaSopra', 'rigaSotto', 'colonnaPrima', 'colonnaDopo', 'eliminaRiga', 'eliminaColonna', 'eliminaTabella'] as OperazioneTabella[]) {
      expect(fai({ ...s, sel: cursore(0, 0) }, op), op).toEqual({ ...s, sel: cursore(0, 0) });
    }
  });

  it('A capo dentro una cella resta nella cella; il testo incollato su più righe pure', () => {
    let s = conTabella();
    s = inserisciTesto({ ...s, sel: cursore(2, 0) }, 'uno\ndue\ntre');
    expect(celle(s.doc)).toEqual(['-', '0:00', '0:01', '0:01', '0:01', '0:10', '0:11', '-']);
    expect(testi(s.doc).slice(2, 5)).toEqual(['uno', 'due', 'tre']);
  });
});

describe('T110: salvare e rileggere', () => {
  it('le tabelle si salvano e tornano uguali', () => {
    let s = conTabella(2, 2);
    s = scrivi(s, 3, 'x');
    const t = serializza(s.doc);
    expect(t).toContain('"tb":{"i":0,"r":1,"c":0}');
    expect(serializza(deserializza(t))).toBe(t);
    expect(celle(deserializza(t))).toEqual(celle(s.doc));
    expect(serializza(daTesto('niente'))).not.toContain('"tb"');
  });

  it('un file con una tabella rotta non si apre', () => {
    const f = (...cs: Array<[number, number, number]>) => JSON.stringify({ v: 1, p: cs.map(([i, r, c]) => ({ a: { tb: { i, r, c } }, r: [] })) });
    expect(() => deserializza(f([0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]))).not.toThrow();
    expect(() => deserializza(f([0, 0, 0], [0, 0, 1], [0, 1, 0]))).toThrow(/tabella/);
    expect(() => deserializza(f([0, 0, 1]))).toThrow(/tabella/);
    expect(() => deserializza(f([0, 0, 0], [0, 0, 2]))).toThrow(/tabella/);
    expect(() => deserializza(f([0, 0, 0], [0, 1, 1]))).toThrow(/tabella/);
    expect(() => deserializza(JSON.stringify({ v: 1, p: [{ a: { tb: { i: 0, r: 0, c: 0 } }, r: [] }, [], { a: { tb: { i: 0, r: 0, c: 1 } }, r: [] }] }))).toThrow(/tabella/);
    for (const tb of [{ i: -1, r: 0, c: 0 }, { i: 0, r: 0.5, c: 0 }, { i: 0, r: 0, c: 'a' }, { i: 0, r: 1000, c: 0 }, { i: 0, r: 0, c: 100 }, { i: 1e10, r: 0, c: 0 }, 'x', null]) {
      expect(() => deserializza(JSON.stringify({ v: 1, p: [{ a: { tb }, r: [] }] })), JSON.stringify(tb)).toThrow(/attributi del paragrafo/);
    }
  });

  it('controllaTabelle dice il motivo', () => {
    const p = (i: number, r: number, c: number): Paragrafo => ({ runs: [], tb: { i, r, c } });
    expect(controllaTabelle({ paragrafi: [p(0, 0, 0), p(0, 0, 1), p(0, 1, 0), p(0, 1, 1), { runs: [] }, p(3, 0, 0)] })).toBeNull();
    expect(controllaTabelle({ paragrafi: [p(0, 0, 0), { runs: [] }, p(0, 0, 1)] })).toBe('tabella spezzata');
    expect(controllaTabelle({ paragrafi: [p(0, 0, 0), p(0, 1, 0), p(0, 1, 1)] })).toBe('righe di lunghezza diversa');
    expect(controllaTabelle({ paragrafi: [p(0, 0, 0), p(0, 0, 1), p(0, 1, 0)] })).toBe('righe di lunghezza diversa');
    expect(controllaTabelle({ paragrafi: [p(0, 0, 0), p(0, 0, 1), p(0, 1, 0), p(0, 2, 0), p(0, 2, 1)] })).toBe('righe di lunghezza diversa');
  });
});

describe('T110: i bordi delle celle', () => {
  it('cancellare all\'inizio di una cella, alla fine di una cella o subito dopo la tabella non unisce niente', () => {
    let s = conTabella();
    s = scrivi(s, 2, 'B');
    s = scrivi(s, 5, 'dopo');
    const doc = s.doc;
    expect(cancellaSuConfine(doc, { p: 2, o: 0 }, 'indietro')).toBe(true);
    expect(cancellaSuConfine(doc, { p: 1, o: 0 }, 'indietro')).toBe(true);
    expect(cancellaSuConfine(doc, { p: 5, o: 0 }, 'indietro')).toBe(true);
    expect(cancellaSuConfine(doc, { p: 4, o: 0 }, 'avanti')).toBe(true);
    expect(cancellaSuConfine(doc, { p: 2, o: 1 }, 'indietro')).toBe(false);
    expect(cancellaSuConfine(doc, { p: 0, o: 2 }, 'avanti')).toBe(true);
    for (const [pos, dir] of [[{ p: 2, o: 0 }, 'indietro'], [{ p: 1, o: 0 }, 'indietro'], [{ p: 5, o: 0 }, 'indietro'], [{ p: 4, o: 0 }, 'avanti']] as const) {
      const ed = nuovoEditor({ ...s, sel: cursore(pos.p, pos.o) });
      const r = eseguiAzioneFormato(ed, { tipo: 'cancella', direzione: dir, parola: false }).ed;
      expect(r).toBe(ed);
      const parola = eseguiAzioneFormato(ed, { tipo: 'cancella', direzione: dir, parola: true }).ed;
      expect(parola).toBe(ed);
    }
    const dentro = eseguiAzioneFormato(nuovoEditor({ ...s, sel: cursore(2, 1) }), { tipo: 'cancella', direzione: 'indietro', parola: false }).ed;
    expect(testi(statoCorrente(dentro).doc)[2]).toBe('');
  });

  it('dentro la stessa cella i paragrafi si uniscono come sempre', () => {
    let s = conTabella();
    s = inserisciTesto({ ...s, sel: cursore(1, 0) }, 'a\nb');
    const c = cancella({ ...s, sel: cursore(2, 0) }, 'indietro');
    expect(testi(c.doc).slice(1, 3)).toEqual(['ab', '']);
    expect(celle(c.doc).slice(1, 3)).toEqual(['0:00', '0:01']);
  });

  it('una selezione su più celle, cancellata, svuota le celle senza unirle e con un solo annulla', () => {
    let s = conTabella();
    s = scrivi(scrivi(scrivi(s, 1, 'uno'), 2, 'due'), 3, 'tre');
    expect(attraversaCelle(s.doc, sel(1, 1, 3, 2))).toBe(true);
    expect(attraversaCelle(s.doc, sel(1, 0, 1, 2))).toBe(false);
    const ed = nuovoEditor({ ...s, sel: sel(1, 1, 3, 2) });
    const r = eseguiAzioneFormato(ed, { tipo: 'cancella', direzione: 'indietro', parola: false }).ed;
    const dopo = statoCorrente(r);
    expect(testi(dopo.doc).slice(1, 5)).toEqual(['u', '', 'e', '']);
    expect(celle(dopo.doc)).toEqual(celle(s.doc));
    expect(dopo.sel).toEqual(cursore(1, 1));
    expect(controllaTabelle(dopo.doc)).toBeNull();
    const indietro = eseguiAzioneFormato(r, { tipo: 'annulla' }).ed;
    expect(testi(statoCorrente(indietro).doc).slice(1, 4)).toEqual(['uno', 'due', 'tre']);
  });

  it('una selezione dal testo fuori alla tabella si svuota senza unire; digitare sopra scrive nel punto dove cominciava', () => {
    let s = conTabella(2, 2, 'ciao');
    s = scrivi(s, 1, 'x');
    const st = { ...s, sel: sel(0, 2, 1, 1) };
    expect(attraversaCelle(st.doc, st.sel)).toBe(true);
    const v = svuotaSelezione(st);
    expect(testi(v.doc).slice(0, 2)).toEqual(['ci', '']);
    expect(celle(v.doc)).toEqual(celle(st.doc));
    expect(v.sel).toEqual(cursore(0, 2));
    const ed = nuovoEditor(st);
    const r = eseguiAzioneFormato(ed, { tipo: 'testo', testo: 'Z' }).ed;
    expect(testi(statoCorrente(r).doc).slice(0, 2)).toEqual(['ciZ', '']);
    expect(celle(statoCorrente(r).doc)).toEqual(celle(st.doc));
    expect(r.storia.passato.length).toBe(ed.storia.passato.length + 1);
    expect(testi(statoCorrente(eseguiAzioneFormato(r, { tipo: 'annulla' }).ed).doc)[1]).toBe('x');
  });

  it('taglia su più celle restituisce il testo e lascia le celle; a capo e incolla sopra una selezione su più celle non le uniscono', () => {
    let s = conTabella();
    s = scrivi(scrivi(s, 1, 'uno'), 2, 'due');
    const ed = nuovoEditor({ ...s, sel: sel(1, 0, 2, 3) });
    const t = eseguiAzioneFormato(ed, { tipo: 'taglia' });
    expect(t.copiato).toBe('uno\ndue');
    expect(testi(statoCorrente(t.ed).doc).slice(1, 3)).toEqual(['', '']);
    for (const a of [{ tipo: 'invio' }, { tipo: 'incolla', testo: 'P' }] as const) {
      const r = statoCorrente(eseguiAzioneFormato(ed, a).ed);
      expect(controllaTabelle(r.doc), a.tipo).toBeNull();
      expect(celle(r.doc).filter((c) => c === '0:01').length).toBeGreaterThan(0);
    }
  });
});

describe('T110: le azioni tabella e modificaTabella', () => {
  it('passano da annulla e ripeti, un passo ciascuna; quelle senza effetto non registrano niente', () => {
    const ed0 = nuovoEditor({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    const ed1 = eseguiAzioneFormato(ed0, { tipo: 'tabella', righe: 2, colonne: 2 }).ed;
    expect(statoCorrente(ed1).doc.paragrafi.length).toBe(6);
    const ed2 = eseguiAzioneFormato(ed1, { tipo: 'modificaTabella', op: 'colonnaDopo' }).ed;
    expect(statoCorrente(ed2).doc.paragrafi.length).toBe(8);
    const ind = eseguiAzioneFormato(eseguiAzioneFormato(ed2, { tipo: 'annulla' }).ed, { tipo: 'annulla' }).ed;
    expect(statoCorrente(ind).doc.paragrafi.length).toBe(1);
    const avanti = eseguiAzioneFormato(ind, { tipo: 'ripeti' }).ed;
    expect(statoCorrente(avanti).doc.paragrafi.length).toBe(6);
    expect(eseguiAzioneFormato(ed0, { tipo: 'modificaTabella', op: 'eliminaRiga' }).ed).toBe(ed0);
    expect(eseguiAzioneFormato(ed1, { tipo: 'tabella', righe: 2, colonne: 2 }).ed).toBe(ed1);
    expect(eseguiAzioneFormato(ed0, { tipo: 'tabella', righe: 0, colonne: 2 }).ed).toBe(ed0);
  });
});
