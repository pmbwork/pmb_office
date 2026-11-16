// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  cerca, espandiSostituto, sostituisciUna, sostituisciTutte, indiceDopo, indicePrima, vicina, OPZIONI_PREDEFINITE, MASSIMO_CORRISPONDENZE,
  type Corrispondenza, type OpzioniRicerca,
} from '../../src/editor/ricerca';
import { daTesto, testoDi, cursore, applicaSegno, applicaAttributo, type Documento, type Stato } from '../../src/modello/documento';

const opz = (extra: Partial<OpzioniRicerca> = {}): OpzioniRicerca => ({ ...OPZIONI_PREDEFINITE, ...extra });
const trovati = (d: Documento, q: string, o: Partial<OpzioniRicerca> = {}): Array<[number, number, number]> => cerca(d, q, opz(o)).corrispondenze.map((c) => [c.p, c.da, c.a]);
const stato = (d: Documento): Stato => ({ doc: d, sel: cursore(0, 0), pendenti: null });
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

describe('T080: cercare', () => {
  it('trova ogni occorrenza in ogni paragrafo, nell\'ordine di lettura, senza sovrapposizioni', () => {
    const d = daTesto('uno due uno\ntre\nuno');
    expect(trovati(d, 'uno')).toEqual([[0, 0, 3], [0, 8, 11], [2, 0, 3]]);
    expect(trovati(d, 'xyz')).toEqual([]);
    expect(trovati(daTesto('aaaa'), 'aa')).toEqual([[0, 0, 2], [0, 2, 4]]);
    expect(cerca(d, 'uno').corrispondenze[1]).toEqual({ p: 0, da: 8, a: 11, trovato: 'uno', gruppi: [] });
  });

  it('una ricerca vuota non trova niente; le maiuscole contano solo se richiesto', () => {
    const d = daTesto('Casa casa CASA');
    expect(cerca(d, '')).toEqual({ corrispondenze: [], errore: null, troncato: false });
    expect(trovati(d, 'casa')).toEqual([[0, 0, 4], [0, 5, 9], [0, 10, 14]]);
    expect(trovati(d, 'casa', { maiuscole: true })).toEqual([[0, 5, 9]]);
    expect(trovati(daTesto('ÈÉè'), 'è')).toEqual([[0, 0, 1], [0, 2, 3]]);
  });

  it('i caratteri speciali si cercano come sono, finché non è attiva l\'espressione regolare', () => {
    const d = daTesto('a.b (x) [y] $5 a|b ^ \\ * + ?');
    for (const q of ['.', '(x)', '[y]', '$5', 'a|b', '^', '\\', '*', '+', '?']) expect(cerca(d, q).errore, q).toBeNull();
    expect(trovati(d, '.')).toEqual([[0, 1, 2]]);
    expect(trovati(d, '(x)')).toEqual([[0, 4, 7]]);
    expect(trovati(d, 'a|b')).toEqual([[0, 15, 18]]);
    expect(trovati(d, '.', { regex: true }).length).toBe(d.paragrafi[0].runs[0].t.length);
  });

  it('parola intera: non dentro un\'altra parola, con lettere accentate, cifre e trattino basso', () => {
    const d = daTesto('casa casale La casa. caso_1 casa1 città cit');
    expect(trovati(d, 'casa', { parolaIntera: true })).toEqual([[0, 0, 4], [0, 15, 19]]);
    expect(trovati(d, 'cit', { parolaIntera: true })).toEqual([[0, 40, 43]]);
    expect(trovati(d, 'caso', { parolaIntera: true })).toEqual([]);
    expect(trovati(daTesto('è èra à'), 'è', { parolaIntera: true })).toEqual([[0, 0, 1]]);
  });

  it('espressioni regolari: gruppi, alternative, errori e corrispondenze vuote', () => {
    const d = daTesto('Rossi 12, Bianchi 7\nVerdi 100');
    const r = cerca(d, '([A-Z][a-z]+) (\\d+)', opz({ regex: true }));
    expect(r.errore).toBeNull();
    expect(r.corrispondenze.map((c) => c.gruppi)).toEqual([['Rossi', '12'], ['Bianchi', '7'], ['Verdi', '100']]);
    expect(trovati(d, 'Rossi|Verdi', { regex: true })).toEqual([[0, 0, 5], [1, 0, 5]]);
    expect(cerca(d, '(', opz({ regex: true })).errore).toBe('Espressione regolare non valida');
    expect(cerca(d, '[', opz({ regex: true })).corrispondenze).toEqual([]);
    expect(trovati(daTesto('ab'), 'x*', { regex: true })).toEqual([]);
    expect(trovati(daTesto('aXb'), 'x', { regex: true })).toEqual([[0, 1, 2]]);
    expect(cerca(daTesto('a'), '(a)|(b)', opz({ regex: true })).corrispondenze[0].gruppi).toEqual(['a', '']);
  });

  it('le emoji si trovano per intero e le posizioni restano in unità UTF-16', () => {
    const d = daTesto('a😀b😀');
    expect(trovati(d, '😀')).toEqual([[0, 1, 3], [0, 4, 6]]);
  });

  it('un numero enorme di risultati viene troncato', () => {
    const r = cerca(daTesto('a'.repeat(MASSIMO_CORRISPONDENZE + 500)), 'a');
    expect(r.corrispondenze.length).toBe(MASSIMO_CORRISPONDENZE);
    expect(r.troncato).toBe(true);
    expect(cerca(daTesto('aaa'), 'a').troncato).toBe(false);
  });
});

describe('T080: spostarsi tra i risultati', () => {
  const corr = (...c: Array<[number, number]>): Corrispondenza[] => c.map(([p, da]) => ({ p, da, a: da + 1, trovato: 'x', gruppi: [] }));
  it('indiceDopo, indicePrima e vicina, con ritorno dall\'altra parte', () => {
    const c = corr([0, 2], [0, 8], [2, 1]);
    expect(indiceDopo(c, { p: 0, o: 0 })).toBe(0);
    expect(indiceDopo(c, { p: 0, o: 2 })).toBe(0);
    expect(indiceDopo(c, { p: 0, o: 3 })).toBe(1);
    expect(indiceDopo(c, { p: 1, o: 0 })).toBe(2);
    expect(indiceDopo(c, { p: 2, o: 2 })).toBe(0);
    expect(indiceDopo([], { p: 0, o: 0 })).toBe(-1);
    expect(indicePrima(c, { p: 2, o: 1 })).toBe(1);
    expect(indicePrima(c, { p: 0, o: 2 })).toBe(2);
    expect(indicePrima(c, { p: 0, o: 0 })).toBe(2);
    expect(indicePrima([], { p: 0, o: 0 })).toBe(-1);
    expect(vicina(3, 0, 1)).toBe(1);
    expect(vicina(3, 2, 1)).toBe(0);
    expect(vicina(3, 0, -1)).toBe(2);
    expect(vicina(1, 0, 1)).toBe(0);
    expect(vicina(0, 0, 1)).toBe(-1);
  });
});

describe('T080: sostituire', () => {
  it('espandiSostituto: con le espressioni regolari valgono $&, $1 e $$, altrimenti il testo è letterale', () => {
    const c: Corrispondenza = { p: 0, da: 0, a: 5, trovato: 'Rossi', gruppi: ['Ro', 'ssi'] };
    expect(espandiSostituto('$2-$1 ($&) $$ $3 $0', c, true)).toBe('ssi-Ro (Rossi) $ $3 $0');
    expect(espandiSostituto('$2-$1 ($&) $$', c, false)).toBe('$2-$1 ($&) $$');
  });

  it('una sostituzione: il testo cambia, il cursore resta dopo, il formato è quello del primo carattere', () => {
    let d = daTesto('Il gatto nero');
    d = applicaSegno(d, { ancora: { p: 0, o: 3 }, fuoco: { p: 0, o: 8 } }, 'g', true);
    d = applicaAttributo(d, { ancora: { p: 0, o: 3 }, fuoco: { p: 0, o: 8 } }, 'z', 20);
    const c = cerca(d, 'gatto').corrispondenze[0];
    const s = sostituisciUna(stato(d), c, 'cane');
    expect(testoDi(s.doc)).toBe('Il cane nero');
    expect(s.sel).toEqual(cursore(0, 7));
    expect(s.doc.paragrafi[0].runs.map((r) => [r.t, r.g, r.z])).toEqual([['Il ', false, undefined], ['cane', true, 20], [' nero', false, undefined]]);
    expect(testoDi(d)).toBe('Il gatto nero');
  });

  it('sostituire con niente cancella; con un a capo divide il paragrafo', () => {
    const d = daTesto('uno due tre');
    const c = cerca(d, 'due').corrispondenze[0];
    expect(testoDi(sostituisciUna(stato(d), c, '').doc)).toBe('uno  tre');
    expect(sostituisciUna(stato(d), c, 'x\ny').doc.paragrafi.map((p) => p.runs.map((r) => r.t).join(''))).toEqual(['uno x', 'y tre']);
  });

  it('sostituisci tutto: tutte le occorrenze, anche più per paragrafo e a capo nel sostituto; il documento di partenza non cambia', () => {
    const d = daTesto('a a a\nb a\na');
    const r = cerca(d, 'a', opz({ maiuscole: true })).corrispondenze;
    const t = sostituisciTutte(stato(d), r, 'XY');
    expect(t.conteggio).toBe(5);
    expect(testoDi(t.stato.doc)).toBe('XY XY XY\nb XY\nXY');
    const n = sostituisciTutte(stato(d), r, '1\n2');
    expect(testoDi(n.stato.doc)).toBe('1\n2 1\n2 1\n2\nb 1\n2\n1\n2');
    expect(testoDi(d)).toBe('a a a\nb a\na');
    const v = sostituisciTutte(stato(d), [], 'q');
    expect(v.conteggio).toBe(0);
    expect(v.stato.doc).toBe(d);
  });

  it('con le espressioni regolari i gruppi si riusano nel sostituto', () => {
    const d = daTesto('Rossi 12, Bianchi 7');
    const o = opz({ regex: true });
    const r = cerca(d, '([A-Z][a-z]+) (\\d+)', o).corrispondenze;
    expect(testoDi(sostituisciTutte(stato(d), r, '$2: $1', o).stato.doc)).toBe('12: Rossi, 7: Bianchi');
    expect(testoDi(sostituisciTutte(stato(d), r, '<$&>', o).stato.doc)).toBe('<Rossi 12>, <Bianchi 7>');
    expect(testoDi(sostituisciTutte(stato(d), r, '<$&>').stato.doc)).toBe('<$&>, <$&>');
  });

  it('prova casuale: 300 documenti, sostituisci tutto coincide con il metodo split/join di JavaScript', () => {
    for (let seme = 1; seme <= 300; seme++) {
      const r = generatore(seme * 13);
      const alfabeto = ['a', 'b', 'ab', ' ', 'è', '😀', 'A'];
      const rnd = (): string => { let s = ''; for (let k = Math.floor(r() * 12); k > 0; k--) s += alfabeto[Math.floor(r() * alfabeto.length)]; return s; };
      const righe = Array.from({ length: 1 + Math.floor(r() * 5) }, rnd);
      let query = '';
      for (let k = 1 + Math.floor(r() * 2); k > 0; k--) query += alfabeto[Math.floor(r() * alfabeto.length)];
      const sostituto = ['', 'x', 'yy', 'z\nw', query + query][Math.floor(r() * 5)];
      const d = daTesto(righe.join('\n'));
      const trovate = cerca(d, query, opz({ maiuscole: true })).corrispondenze;
      const t = sostituisciTutte(stato(d), trovate, sostituto);
      const atteso = righe.map((l) => l.split(query).join(sostituto)).join('\n');
      expect(testoDi(t.stato.doc), `seme ${seme} cerco "${query}"`).toBe(atteso);
      expect(t.conteggio).toBe(righe.reduce((n, l) => n + l.split(query).length - 1, 0));
      for (const p of t.stato.doc.paragrafi) expect(p.runs.every((x) => x.t !== ''), `seme ${seme}`).toBe(true);
    }
  });
});
