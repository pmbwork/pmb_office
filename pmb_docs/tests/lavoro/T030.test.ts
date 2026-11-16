// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  daTesto, testoDi, documentoVuoto, statoIniziale, cursore, inserisciTesto, cancella, applicaSegno, alternaSegno,
  segniIn, segniSelezione, estraiTesto, muovi, sposta, estendi, selezionaTutto, contaParole, contaCaratteri,
  serializza, deserializza, documentiUguali, testoParagrafo, segniVuoti,
  type Documento, type Stato, type Selezione, type NomeSegno,
} from '../../src/modello/documento';

const G = { g: true, c: false, s: false };
const C = { g: false, c: true, s: false };

function sel(p1: number, o1: number, p2 = p1, o2 = o1): Selezione { return { ancora: { p: p1, o: o1 }, fuoco: { p: p2, o: o2 } }; }
function con(doc: Documento, s: Selezione): Stato { return { doc, sel: s, pendenti: null }; }
function inv(doc: Documento): void {
  expect(doc.paragrafi.length).toBeGreaterThanOrEqual(1);
  for (const p of doc.paragrafi) {
    for (let i = 0; i < p.runs.length; i++) {
      expect(p.runs[i].t).not.toBe('');
      expect(p.runs[i].t.includes('\n')).toBe(false);
      if (i > 0) {
        const a = p.runs[i - 1]; const b = p.runs[i];
        expect(a.g === b.g && a.c === b.c && a.s === b.s).toBe(false);
      }
    }
  }
}

describe('T030: modello del documento', () => {
  it('daTesto e testoDi: paragrafi, fine riga di Windows, testo vuoto', () => {
    expect(testoDi(daTesto('uno\ndue\n\ntre'))).toBe('uno\ndue\n\ntre');
    expect(daTesto('a\r\nb\rc').paragrafi.length).toBe(3);
    expect(daTesto('').paragrafi).toEqual([{ runs: [] }]);
    expect(documentoVuoto().paragrafi).toEqual([{ runs: [] }]);
    expect(daTesto('x\n\ny').paragrafi[1].runs).toEqual([]);
  });

  it('inserimento semplice, in mezzo, con a capo e con la selezione sostituita', () => {
    let s = inserisciTesto(statoIniziale(), 'Ciao');
    expect(testoDi(s.doc)).toBe('Ciao');
    expect(s.sel).toEqual(cursore(0, 4));
    s = inserisciTesto(con(s.doc, sel(0, 2)), 'XY');
    expect(testoDi(s.doc)).toBe('CiXYao');
    expect(s.sel).toEqual(cursore(0, 4));
    s = inserisciTesto(con(s.doc, sel(0, 1)), 'a\nb\nc');
    expect(testoDi(s.doc)).toBe('Ca\nb\nciXYao');
    expect(s.sel).toEqual(cursore(2, 1));
    const r = inserisciTesto(con(daTesto('abcdef\nghi'), sel(0, 2, 1, 1)), '--');
    expect(testoDi(r.doc)).toBe('ab--hi');
    expect(r.sel).toEqual(cursore(0, 4));
    inv(r.doc);
  });

  it('la selezione al contrario (ancora dopo il fuoco) vale come quella dritta', () => {
    const d = daTesto('abcdef');
    const a = inserisciTesto(con(d, sel(0, 4, 0, 1)), '_');
    const b = inserisciTesto(con(d, sel(0, 1, 0, 4)), '_');
    expect(testoDi(a.doc)).toBe('a_ef');
    expect(a).toEqual(b);
  });

  it('i segni si ereditano dal carattere prima del cursore, o dal primo a inizio paragrafo', () => {
    const d = { paragrafi: [{ runs: [{ t: 'ab', ...G, c: false, s: false }, { t: 'cd', g: false, c: true, s: false }] }] } as Documento;
    expect(segniIn(d, { p: 0, o: 2 })).toEqual(G);
    expect(segniIn(d, { p: 0, o: 3 })).toEqual(C);
    expect(segniIn(d, { p: 0, o: 0 })).toEqual(G);
    expect(segniIn(documentoVuoto(), { p: 0, o: 0 })).toEqual(segniVuoti());
    const s = inserisciTesto(con(d, sel(0, 2)), 'Z');
    expect(s.doc.paragrafi[0].runs).toEqual([{ t: 'abZ', g: true, c: false, s: false }, { t: 'cd', g: false, c: true, s: false }]);
    const s2 = inserisciTesto(con(d, sel(0, 2)), 'Z', segniVuoti());
    expect(s2.doc.paragrafi[0].runs.length).toBe(3);
  });

  it('cancella indietro e avanti: dentro il paragrafo, unendo paragrafi, ai limiti, con selezione', () => {
    const d = daTesto('abc\ndef');
    expect(testoDi(cancella(con(d, sel(0, 2)), 'indietro').doc)).toBe('ac\ndef');
    expect(testoDi(cancella(con(d, sel(0, 2)), 'avanti').doc)).toBe('ab\ndef');
    const u = cancella(con(d, sel(1, 0)), 'indietro');
    expect(testoDi(u.doc)).toBe('abcdef');
    expect(u.sel).toEqual(cursore(0, 3));
    const v = cancella(con(d, sel(0, 3)), 'avanti');
    expect(testoDi(v.doc)).toBe('abcdef');
    expect(v.sel).toEqual(cursore(0, 3));
    const inizio = con(d, sel(0, 0));
    expect(cancella(inizio, 'indietro')).toEqual(inizio);
    const fine = con(d, sel(1, 3));
    expect(cancella(fine, 'avanti')).toEqual(fine);
    const r = cancella(con(d, sel(0, 1, 1, 2)), 'indietro');
    expect(testoDi(r.doc)).toBe('af');
    expect(r.sel).toEqual(cursore(0, 1));
    inv(r.doc);
  });

  it('cancellare una lettera con le emoji non spezza le coppie surrogate', () => {
    const d = daTesto('a😀b');
    expect(d.paragrafi[0].runs[0].t.length).toBe(4);
    expect(testoDi(cancella(con(d, sel(0, 3)), 'indietro').doc)).toBe('ab');
    expect(testoDi(cancella(con(d, sel(0, 1)), 'avanti').doc)).toBe('ab');
    expect(muovi(d, { p: 0, o: 1 }, 'destra')).toEqual({ p: 0, o: 3 });
    expect(muovi(d, { p: 0, o: 3 }, 'sinistra')).toEqual({ p: 0, o: 1 });
  });

  it('applicaSegno spezza e riunisce i tratti, su più paragrafi, e non cambia l\'ingresso', () => {
    const d = daTesto('abcdef\nghijkl');
    const copia = serializza(d);
    const b = applicaSegno(d, sel(0, 2, 1, 3), 'g', true);
    expect(serializza(d)).toBe(copia);
    expect(b.paragrafi[0].runs.map((r) => [r.t, r.g])).toEqual([['ab', false], ['cdef', true]]);
    expect(b.paragrafi[1].runs.map((r) => [r.t, r.g])).toEqual([['ghi', true], ['jkl', false]]);
    const tolto = applicaSegno(b, sel(0, 0, 1, 6), 'g', false);
    expect(tolto.paragrafi[0].runs.length).toBe(1);
    expect(tolto.paragrafi[1].runs.length).toBe(1);
    expect(applicaSegno(d, sel(0, 2), 'g', true)).toBe(d);
    inv(b);
  });

  it('alternaSegno: con selezione vale se non tutto lo ha; col cursore prepara i segni per il prossimo testo', () => {
    const d = daTesto('abcdef');
    const uno = alternaSegno(con(d, sel(0, 0, 0, 3)), 'g');
    expect(segniSelezione(uno.doc, uno.sel).g).toBe(true);
    const due = alternaSegno(uno, 'g');
    expect(segniSelezione(due.doc, due.sel).g).toBe(false);
    const misto = alternaSegno(con(uno.doc, sel(0, 0, 0, 6)), 'g');
    expect(segniSelezione(misto.doc, misto.sel).g).toBe(true);
    const p = alternaSegno(con(d, sel(0, 6)), 'c');
    expect(p.pendenti).toEqual(C);
    expect(p.doc).toBe(d);
    const scritto = inserisciTesto(p, 'xyz');
    expect(scritto.doc.paragrafi[0].runs.map((r) => [r.t, r.c])).toEqual([['abcdef', false], ['xyz', true]]);
    expect(scritto.pendenti).toBeNull();
    expect(alternaSegno(alternaSegno(con(d, sel(0, 6)), 'c'), 'c').pendenti).toEqual(segniVuoti());
  });

  it('dopo un a capo in grassetto si continua in grassetto; dopo uno spostamento no', () => {
    const d = { paragrafi: [{ runs: [{ t: 'ab', ...G }] }] } as Documento;
    const s = inserisciTesto(con(d, sel(0, 2)), '\n');
    expect(s.doc.paragrafi.length).toBe(2);
    expect(s.pendenti).toEqual(G);
    const t = inserisciTesto(s, 'x');
    expect(t.doc.paragrafi[1].runs).toEqual([{ t: 'x', ...G }]);
    expect(sposta(s, 'sinistra').pendenti).toBeNull();
  });

  it('estraiTesto copia anche su più paragrafi', () => {
    const d = daTesto('abc\ndef\nghi');
    expect(estraiTesto(d, sel(0, 1, 2, 2))).toBe('bc\ndef\ngh');
    expect(estraiTesto(d, sel(2, 2, 0, 1))).toBe('bc\ndef\ngh');
    expect(estraiTesto(d, sel(1, 1))).toBe('');
  });

  it('movimenti: caratteri, paragrafi, documento, parole', () => {
    const d = daTesto('uno due  tre\n  fine');
    expect(muovi(d, { p: 0, o: 12 }, 'destra')).toEqual({ p: 1, o: 0 });
    expect(muovi(d, { p: 1, o: 0 }, 'sinistra')).toEqual({ p: 0, o: 12 });
    expect(muovi(d, { p: 0, o: 0 }, 'sinistra')).toEqual({ p: 0, o: 0 });
    expect(muovi(d, { p: 1, o: 6 }, 'destra')).toEqual({ p: 1, o: 6 });
    expect(muovi(d, { p: 0, o: 5 }, 'inizioParagrafo')).toEqual({ p: 0, o: 0 });
    expect(muovi(d, { p: 0, o: 5 }, 'fineParagrafo')).toEqual({ p: 0, o: 12 });
    expect(muovi(d, { p: 0, o: 5 }, 'inizioDocumento')).toEqual({ p: 0, o: 0 });
    expect(muovi(d, { p: 0, o: 5 }, 'fineDocumento')).toEqual({ p: 1, o: 6 });
    expect(muovi(d, { p: 0, o: 0 }, 'parolaDestra')).toEqual({ p: 0, o: 4 });
    expect(muovi(d, { p: 0, o: 4 }, 'parolaDestra')).toEqual({ p: 0, o: 9 });
    expect(muovi(d, { p: 0, o: 9 }, 'parolaDestra')).toEqual({ p: 0, o: 12 });
    expect(muovi(d, { p: 0, o: 12 }, 'parolaDestra')).toEqual({ p: 1, o: 0 });
    expect(muovi(d, { p: 0, o: 12 }, 'parolaSinistra')).toEqual({ p: 0, o: 9 });
    expect(muovi(d, { p: 0, o: 9 }, 'parolaSinistra')).toEqual({ p: 0, o: 4 });
    expect(muovi(d, { p: 0, o: 6 }, 'parolaSinistra')).toEqual({ p: 0, o: 4 });
    expect(muovi(d, { p: 0, o: 0 }, 'parolaSinistra')).toEqual({ p: 0, o: 0 });
    expect(muovi(d, { p: 1, o: 0 }, 'parolaSinistra')).toEqual({ p: 0, o: 12 });
  });

  it('sposta, estendi e selezionaTutto', () => {
    const d = daTesto('abc\ndef');
    const a = estendi(estendi(con(d, sel(0, 1)), 'destra'), 'destra');
    expect(a.sel).toEqual(sel(0, 1, 0, 3));
    expect(sposta(a, 'sinistra').sel).toEqual(cursore(0, 1));
    expect(sposta(a, 'destra').sel).toEqual(cursore(0, 3));
    expect(sposta(a, 'fineParagrafo').sel).toEqual(cursore(0, 3));
    expect(estendi(a, 'sinistra').sel).toEqual(sel(0, 1, 0, 2));
    const t = selezionaTutto(con(d, sel(0, 0)));
    expect(estraiTesto(d, t.sel)).toBe('abc\ndef');
  });

  it('posizioni fuori dal documento vengono riportate dentro', () => {
    const d = daTesto('abc');
    const s = inserisciTesto(con(d, sel(9, 99)), 'Z');
    expect(testoDi(s.doc)).toBe('abcZ');
    expect(testoDi(inserisciTesto(con(d, sel(-3, -1)), 'Z').doc)).toBe('Zabc');
  });

  it('conteggi di parole e caratteri', () => {
    const d = daTesto('uno  due\n\n tre quattro ');
    expect(contaParole(d)).toBe(4);
    expect(contaParole(documentoVuoto())).toBe(0);
    expect(contaCaratteri(daTesto('a b\nc'))).toBe(4);
    expect(contaCaratteri(daTesto('a b\nc'), true)).toBe(3);
    expect(contaCaratteri(daTesto('a😀'))).toBe(2);
  });

  it('serializza e deserializza: andata e ritorno, forma compatta, ingressi sbagliati', () => {
    let s = inserisciTesto(statoIniziale(), 'Titolo\nTesto normale');
    s = con(s.doc, sel(0, 0, 0, 6));
    s = alternaSegno(s, 'g');
    const testo = serializza(s.doc);
    expect(JSON.parse(testo)).toEqual({ v: 1, p: [[{ t: 'Titolo', g: true }], [{ t: 'Testo normale' }]] });
    expect(documentiUguali(deserializza(testo), s.doc)).toBe(true);
    expect(deserializza('{"v":1,"p":[]}').paragrafi).toEqual([{ runs: [] }]);
    const n = deserializza('{"v":1,"p":[[{"t":"a"},{"t":"","g":true},{"t":"b"}]]}');
    expect(n.paragrafi[0].runs).toEqual([{ t: 'ab', g: false, c: false, s: false }]);
    for (const male of ['', 'non json', '[]', '{"v":2,"p":[]}', '{"v":1}', '{"v":1,"p":[1]}', '{"v":1,"p":[[{"x":1}]]}', '{"v":1,"p":[[{"t":5}]]}']) {
      expect(() => deserializza(male), male).toThrow(/Documento non valido/);
    }
  });
});

// ---- prova casuale contro un modello semplice: una cella per carattere --------------------------------
interface Cella { ch: string; g: boolean; c: boolean; s: boolean }

function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function indice(doc: Documento, p: { p: number; o: number }): number {
  let n = 0;
  for (let i = 0; i < p.p; i++) n += testoParagrafo(doc.paragrafi[i]).length + 1;
  return n + p.o;
}
function appiattisci(doc: Documento): Cella[] {
  const out: Cella[] = [];
  doc.paragrafi.forEach((par, i) => {
    if (i > 0) out.push({ ch: '\n', g: false, c: false, s: false });
    for (const r of par.runs) for (const ch of r.t) out.push({ ch, g: r.g, c: r.c, s: r.s });
  });
  return out;
}
function segniModello(m: Cella[], k: number): Segni3 {
  const inizioPar = k === 0 || m[k - 1].ch === '\n';
  if (!inizioPar) return { g: m[k - 1].g, c: m[k - 1].c, s: m[k - 1].s };
  if (k < m.length && m[k].ch !== '\n') return { g: m[k].g, c: m[k].c, s: m[k].s };
  return { g: false, c: false, s: false };
}
type Segni3 = { g: boolean; c: boolean; s: boolean };

describe('T030: prova casuale contro un modello a una cella per carattere', () => {
  it('600 sequenze da 40 operazioni: testo, segni e regole interne coincidono sempre', () => {
    const NOMI: NomeSegno[] = ['g', 'c', 's'];
    for (let seme = 1; seme <= 600; seme++) {
      const rnd = generatore(seme);
      const intero = (n: number): number => Math.floor(rnd() * n);
      let stato = statoIniziale();
      let m: Cella[] = [];
      for (let passo = 0; passo < 40; passo++) {
        const lungTot = m.length;
        const posA = intero(lungTot + 1);
        const posF = rnd() < 0.5 ? posA : intero(lungTot + 1);
        const daIndice = (k: number): { p: number; o: number } => {
          let p = 0; let resto = k;
          for (; p < stato.doc.paragrafi.length; p++) {
            const l = testoParagrafo(stato.doc.paragrafi[p]).length;
            if (resto <= l) return { p, o: resto };
            resto -= l + 1;
          }
          throw new Error('indice fuori');
        };
        stato = { ...stato, sel: { ancora: daIndice(posA), fuoco: daIndice(posF) }, pendenti: null };
        const i = Math.min(posA, posF); const f = Math.max(posA, posF);
        const copiaPrima = serializza(stato.doc);
        const op = rnd();
        if (op < 0.45) {
          const alfabeto = 'ab c\n';
          let testo = '';
          for (let n = intero(7); n > 0; n--) testo += alfabeto[intero(alfabeto.length)];
          const esplicito = rnd() < 0.4 ? { g: rnd() < 0.5, c: rnd() < 0.5, s: rnd() < 0.5 } : undefined;
          const sg = esplicito ?? segniModello(m, i);
          const nuove: Cella[] = [...testo].map((ch) => ch === '\n' ? { ch, g: false, c: false, s: false } : { ch, ...sg });
          if (testo === '' && i === f) { stato = inserisciTesto(stato, testo, esplicito); }
          else { m = [...m.slice(0, i), ...nuove, ...m.slice(f)]; stato = inserisciTesto(stato, testo, esplicito); }
        } else if (op < 0.65) {
          const dir = rnd() < 0.5 ? 'indietro' : 'avanti';
          if (f > i) m = [...m.slice(0, i), ...m.slice(f)];
          else if (dir === 'indietro' && i > 0) m = [...m.slice(0, i - 1), ...m.slice(i)];
          else if (dir === 'avanti' && i < m.length) m = [...m.slice(0, i), ...m.slice(i + 1)];
          stato = cancella(stato, dir);
        } else if (op < 0.9) {
          const nome = NOMI[intero(3)]; const valore = rnd() < 0.5;
          for (let k = i; k < f; k++) if (m[k].ch !== '\n') m[k] = { ...m[k], [nome]: valore };
          stato = { ...stato, doc: applicaSegno(stato.doc, stato.sel, nome, valore) };
        } else {
          const tutti = m.slice(i, f).filter((c) => c.ch !== '\n');
          const atteso = tutti.length === 0 ? segniModello(m, i)
            : { g: tutti.every((c) => c.g), c: tutti.every((c) => c.c), s: tutti.every((c) => c.s) };
          expect(segniSelezione(stato.doc, stato.sel), `seme ${seme} passo ${passo}`).toEqual(atteso);
          expect(estraiTesto(stato.doc, stato.sel)).toBe(m.slice(i, f).map((c) => c.ch).join(''));
        }
        const piatto = appiattisci(stato.doc);
        expect(piatto.map((c) => c.ch).join(''), `seme ${seme} passo ${passo}`).toBe(m.map((c) => c.ch).join(''));
        expect(piatto, `seme ${seme} passo ${passo}`).toEqual(m);
        inv(stato.doc);
        const c = stato.sel.fuoco;
        expect(indice(stato.doc, c)).toBeLessThanOrEqual(m.length);
        if (op >= 0.9) expect(serializza(stato.doc)).toBe(copiaPrima);
        if (passo % 10 === 9) expect(documentiUguali(deserializza(serializza(stato.doc)), stato.doc)).toBe(true);
      }
    }
  });
});
