// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  daTesto, testoDi, statoIniziale, cursore, inserisciTesto, cancella, applicaSegno, alternaSegno, applicaAttributo,
  impostaAttributo, formatoIn, formatoSelezione, applicaParagrafo, attributiParagrafo, cambiaRientro, alternaElenco,
  pulisciFormato, numeriElenco, corpoSuccessivo, serializza, deserializza, documentiUguali, testoParagrafo,
  PASSI_CORPO, CORPO_NORMALE, CARATTERE_NORMALE,
  type Documento, type Stato, type Selezione, type Run,
} from '../../src/modello/documento';

function sel(p1: number, o1: number, p2 = p1, o2 = o1): Selezione { return { ancora: { p: p1, o: o1 }, fuoco: { p: p2, o: o2 } }; }
function con(doc: Documento, s: Selezione): Stato { return { doc, sel: s, pendenti: null }; }

describe('T040: attributi del testo (carattere, corpo, colori)', () => {
  it('costanti', () => {
    expect(CORPO_NORMALE).toBe(11);
    expect(CARATTERE_NORMALE).toBe('Arial');
    expect(PASSI_CORPO).toEqual([8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96]);
  });

  it('applicaAttributo spezza i tratti, non scrive chiavi vuote e riunisce quando tornano uguali', () => {
    const d = daTesto('abcdef');
    const copia = serializza(d);
    const b = applicaAttributo(d, sel(0, 2, 0, 4), 'z', 18);
    expect(serializza(d)).toBe(copia);
    expect(b.paragrafi[0].runs).toEqual([
      { t: 'ab', g: false, c: false, s: false }, { t: 'cd', g: false, c: false, s: false, z: 18 }, { t: 'ef', g: false, c: false, s: false },
    ]);
    expect(Object.keys(b.paragrafi[0].runs[0]).sort()).toEqual(['c', 'g', 's', 't']);
    const tolto = applicaAttributo(b, sel(0, 0, 0, 6), 'z', undefined);
    expect(tolto.paragrafi[0].runs).toEqual([{ t: 'abcdef', g: false, c: false, s: false }]);
    expect(Object.keys(tolto.paragrafi[0].runs[0]).sort()).toEqual(['c', 'g', 's', 't']);
    const col = applicaAttributo(applicaAttributo(d, sel(0, 0, 0, 3), 'k', '#ff0000'), sel(0, 0, 0, 6), 'f', 'Roboto');
    expect(col.paragrafi[0].runs).toEqual([
      { t: 'abc', g: false, c: false, s: false, f: 'Roboto', k: '#ff0000' }, { t: 'def', g: false, c: false, s: false, f: 'Roboto' },
    ]);
    expect(applicaAttributo(d, sel(0, 2), 'z', 18)).toBe(d);
  });

  it('il testo nuovo eredita carattere, corpo e colori del carattere prima del cursore', () => {
    let d = applicaAttributo(daTesto('ab'), sel(0, 0, 0, 2), 'z', 24);
    d = applicaAttributo(d, sel(0, 0, 0, 2), 'h', '#ffff00');
    const s = inserisciTesto(con(d, sel(0, 2)), 'Z');
    expect(s.doc.paragrafi[0].runs).toEqual([{ t: 'abZ', g: false, c: false, s: false, z: 24, h: '#ffff00' }]);
    expect(formatoIn(d, { p: 0, o: 1 })).toEqual({ g: false, c: false, s: false, z: 24, h: '#ffff00' });
    expect(formatoIn(daTesto(''), { p: 0, o: 0 })).toEqual({ g: false, c: false, s: false });
  });

  it('impostaAttributo col cursore prepara il testo che si scriverà; con la selezione cambia il testo', () => {
    const base = con(daTesto('ab'), sel(0, 2));
    const p = impostaAttributo(base, 'z', 30);
    expect(p.doc).toBe(base.doc);
    expect(p.pendenti).toEqual({ g: false, c: false, s: false, z: 30 });
    const scritto = inserisciTesto(p, 'X');
    expect(scritto.doc.paragrafi[0].runs.map((r) => [r.t, r.z])).toEqual([['ab', undefined], ['X', 30]]);
    const senza = impostaAttributo(p, 'z', undefined);
    expect(senza.pendenti).toEqual({ g: false, c: false, s: false });
    expect(Object.keys(senza.pendenti!).sort()).toEqual(['c', 'g', 's']);
    const g = alternaSegno(p, 'g');
    expect(g.pendenti).toEqual({ g: true, c: false, s: false, z: 30 });
    const r = impostaAttributo(con(daTesto('abcd'), sel(0, 1, 0, 3)), 'f', 'Georgia');
    expect(r.doc.paragrafi[0].runs.map((x) => [x.t, x.f])).toEqual([['a', undefined], ['bc', 'Georgia'], ['d', undefined]]);
    expect(r.pendenti).toBeNull();
  });

  it('formatoSelezione: un attributo c\'è solo se è uguale su tutto il testo scelto', () => {
    let d = applicaAttributo(daTesto('abcdef'), sel(0, 0, 0, 3), 'z', 14);
    d = applicaAttributo(d, sel(0, 3, 0, 6), 'z', 18);
    d = applicaAttributo(d, sel(0, 0, 0, 6), 'f', 'Georgia');
    expect(formatoSelezione(d, sel(0, 0, 0, 3))).toEqual({ g: false, c: false, s: false, z: 14, f: 'Georgia' });
    expect(formatoSelezione(d, sel(0, 1, 0, 5))).toEqual({ g: false, c: false, s: false, f: 'Georgia' });
    expect(formatoSelezione(d, sel(0, 4))).toEqual({ g: false, c: false, s: false, z: 18, f: 'Georgia' });
  });

  it('corpoSuccessivo segue i passi di Google Documenti', () => {
    expect(corpoSuccessivo(11, 1)).toBe(12);
    expect(corpoSuccessivo(12, 1)).toBe(14);
    expect(corpoSuccessivo(11, -1)).toBe(10);
    expect(corpoSuccessivo(8, -1)).toBe(8);
    expect(corpoSuccessivo(96, 1)).toBe(96);
    expect(corpoSuccessivo(13, 1)).toBe(14);
    expect(corpoSuccessivo(13, -1)).toBe(12);
    expect(corpoSuccessivo(200, -1)).toBe(96);
  });
});

describe('T040: attributi dei paragrafi', () => {
  it('applicaParagrafo agisce solo sui paragrafi toccati e non scrive chiavi vuote', () => {
    const d = daTesto('uno\ndue\ntre\nquattro');
    const a = applicaParagrafo(d, sel(1, 1, 2, 0), 'al', 'ce');
    expect(a.paragrafi.map((p) => p.al)).toEqual([undefined, 'ce', 'ce', undefined]);
    expect(Object.keys(a.paragrafi[0]).sort()).toEqual(['runs']);
    const b = applicaParagrafo(a, sel(1, 0), 'al', undefined);
    expect(b.paragrafi.map((p) => p.al)).toEqual([undefined, undefined, 'ce', undefined]);
    expect(Object.keys(b.paragrafi[1]).sort()).toEqual(['runs']);
    expect(attributiParagrafo(a, { p: 2, o: 0 })).toEqual({ al: 'ce' });
    expect(applicaParagrafo(d, sel(0, 0), 'ls', 1.5).paragrafi[0].ls).toBe(1.5);
    expect(applicaParagrafo(d, sel(0, 0), 'st', '1').paragrafi[0].st).toBe('1');
  });

  it('i paragrafi nuovi ereditano gli attributi di quello da cui nascono; unendo vale il primo', () => {
    let d = applicaParagrafo(daTesto('abcd'), sel(0, 0), 'al', 'dx');
    d = applicaParagrafo(d, sel(0, 0), 'el', 'p');
    const s = inserisciTesto(con(d, sel(0, 2)), '\n');
    expect(s.doc.paragrafi.map((p) => [testoParagrafo(p), p.al, p.el])).toEqual([['ab', 'dx', 'p'], ['cd', 'dx', 'p']]);
    const m = cancella(con(s.doc, sel(1, 0)), 'indietro');
    expect(m.doc.paragrafi.map((p) => [testoParagrafo(p), p.al, p.el])).toEqual([['abcd', 'dx', 'p']]);
    const due = applicaParagrafo(daTesto('uno\ndue'), sel(1, 0), 'al', 'ce');
    const u = cancella(con(due, sel(1, 0)), 'indietro');
    expect(u.doc.paragrafi.map((p) => p.al)).toEqual([undefined]);
    const r = inserisciTesto(con(applicaParagrafo(daTesto('abc\nxyz'), sel(0, 0), 'al', 'ce'), sel(0, 1, 1, 1)), 'Q');
    expect(r.doc.paragrafi.map((p) => [testoParagrafo(p), p.al])).toEqual([['aQyz', 'ce']]);
  });

  it('cambiaRientro va da 0 a 8 e il livello 0 non lascia traccia', () => {
    let d = daTesto('uno\ndue');
    d = cambiaRientro(d, sel(0, 0, 1, 0), 1);
    d = cambiaRientro(d, sel(1, 0), 1);
    expect(d.paragrafi.map((p) => p.ri)).toEqual([1, 2]);
    for (let i = 0; i < 12; i++) d = cambiaRientro(d, sel(1, 0), 1);
    expect(d.paragrafi[1].ri).toBe(8);
    for (let i = 0; i < 12; i++) d = cambiaRientro(d, sel(0, 0, 1, 0), -1);
    expect(d.paragrafi.map((p) => p.ri)).toEqual([undefined, undefined]);
    expect(Object.keys(d.paragrafi[0])).toEqual(['runs']);
  });

  it('alternaElenco: mette l\'elenco a tutti, lo toglie se tutti lo hanno, cambia tipo altrimenti', () => {
    const d = daTesto('a\nb\nc');
    const p = alternaElenco(d, sel(0, 0, 2, 0), 'p');
    expect(p.paragrafi.map((x) => x.el)).toEqual(['p', 'p', 'p']);
    expect(alternaElenco(p, sel(0, 0, 2, 0), 'p').paragrafi.map((x) => x.el)).toEqual([undefined, undefined, undefined]);
    expect(alternaElenco(p, sel(0, 0, 2, 0), 'n').paragrafi.map((x) => x.el)).toEqual(['n', 'n', 'n']);
    const misto = alternaElenco(p, sel(1, 0), 'n');
    expect(misto.paragrafi.map((x) => x.el)).toEqual(['p', 'n', 'p']);
    expect(alternaElenco(misto, sel(0, 0, 2, 0), 'p').paragrafi.map((x) => x.el)).toEqual(['p', 'p', 'p']);
  });

  it('numeriElenco conta le voci numerate per livello e ricomincia dopo un paragrafo normale', () => {
    let d = daTesto('a\nb\nc\nd\ne\nf\ng\nh');
    d = applicaParagrafo(d, sel(0, 0, 2, 0), 'el', 'n');
    d = applicaParagrafo(d, sel(3, 0), 'el', 'p');
    d = applicaParagrafo(d, sel(5, 0, 6, 0), 'el', 'n');
    d = cambiaRientro(d, sel(6, 0), 1);
    d = applicaParagrafo(d, sel(7, 0), 'el', 'n');
    expect(numeriElenco(d)).toEqual([1, 2, 3, null, null, 1, 1, 2]);
    const e = applicaParagrafo(daTesto('x\ny\nz'), sel(0, 0, 2, 0), 'el', 'n');
    expect(numeriElenco(e)).toEqual([1, 2, 3]);
    expect(numeriElenco(daTesto('x\ny'))).toEqual([null, null]);
    const g = applicaParagrafo(applicaParagrafo(daTesto('x\ny\nz'), sel(0, 0, 2, 0), 'el', 'n'), sel(1, 0), 'el', undefined);
    expect(numeriElenco(g)).toEqual([1, null, 1]);
    const h = applicaParagrafo(applicaParagrafo(daTesto('x\ny\nz'), sel(0, 0, 2, 0), 'el', 'n'), sel(1, 0), 'el', 'p');
    expect(numeriElenco(h)).toEqual([1, null, 1]);
  });

  it('pulisciFormato toglie segni, attributi e stile ma non allineamento ed elenchi', () => {
    let d = applicaSegno(daTesto('abcd'), sel(0, 0, 0, 4), 'g', true);
    d = applicaAttributo(d, sel(0, 0, 0, 4), 'z', 20);
    d = applicaAttributo(d, sel(0, 1, 0, 3), 'k', '#ff0000');
    d = applicaParagrafo(d, sel(0, 0), 'st', '1');
    d = applicaParagrafo(d, sel(0, 0), 'al', 'ce');
    const p = pulisciFormato(d, sel(0, 0, 0, 4));
    expect(p.paragrafi[0]).toEqual({ al: 'ce', runs: [{ t: 'abcd', g: false, c: false, s: false }] });
    const solo = pulisciFormato(d, sel(0, 1, 0, 3));
    expect(solo.paragrafi[0].runs.map((r: Run) => [r.t, r.g, r.z, r.k])).toEqual([['a', true, 20, undefined], ['bc', false, undefined, undefined], ['d', true, 20, undefined]]);
    expect(solo.paragrafi[0].st).toBeUndefined();
  });
});

describe('T040: salvataggio con i nuovi attributi', () => {
  it('andata e ritorno e forma del file', () => {
    let d = applicaAttributo(applicaAttributo(daTesto('ab\ncd\nef'), sel(0, 0, 0, 2), 'z', 18), sel(0, 0, 0, 1), 'k', '#112233');
    d = applicaParagrafo(d, sel(1, 0), 'al', 'gi');
    d = applicaParagrafo(d, sel(1, 0), 'el', 'n');
    d = cambiaRientro(d, sel(1, 0), 2);
    d = applicaParagrafo(d, sel(2, 0), 'ls', 1.5);
    d = applicaParagrafo(d, sel(2, 0), 'st', 't');
    const testo = serializza(d);
    expect(JSON.parse(testo)).toEqual({
      v: 1,
      p: [
        [{ t: 'a', z: 18, k: '#112233' }, { t: 'b', z: 18 }],
        { a: { al: 'gi', el: 'n', ri: 2 }, r: [{ t: 'cd' }] },
        { a: { ls: 1.5, st: 't' }, r: [{ t: 'ef' }] },
      ],
    });
    const r = deserializza(testo);
    expect(documentiUguali(r, d)).toBe(true);
    expect(r).toEqual(d);
    expect(testoDi(r)).toBe('ab\ncd\nef');
  });

  it('i file vecchi (solo grassetto, corsivo, sottolineato) si leggono ancora', () => {
    const r = deserializza('{"v":1,"p":[[{"t":"ab","g":true}],[]]}');
    expect(r.paragrafi).toEqual([{ runs: [{ t: 'ab', g: true, c: false, s: false }] }, { runs: [] }]);
  });

  it('valori sbagliati vengono rifiutati', () => {
    const p = (x: string): string => `{"v":1,"p":[${x}]}`;
    const male = [
      p('[{"t":"a","z":0}]'), p('[{"t":"a","z":"11"}]'), p('[{"t":"a","z":401}]'), p('[{"t":"a","f":""}]'), p('[{"t":"a","f":5}]'),
      p('[{"t":"a","k":"rosso"}]'), p('[{"t":"a","h":"#12"}]'), p('{"a":{"al":"zz"},"r":[]}'), p('{"a":{"ls":0},"r":[]}'),
      p('{"a":{"el":"x"},"r":[]}'), p('{"a":{"ri":9},"r":[]}'), p('{"a":{"ri":0},"r":[]}'), p('{"a":{"st":"9"},"r":[]}'),
      p('{"a":[],"r":[]}'), p('{"r":5}'), p('{"a":{"al":"ce"}}'), p('"testo"'),
    ];
    for (const m of male) expect(() => deserializza(m), m).toThrow(/Documento non valido/);
  });
});

// ---- prova casuale con tutti gli attributi ------------------------------------------------------------
interface Cella { ch: string; g: boolean; c: boolean; s: boolean; f?: string; z?: number; k?: string; h?: string }
interface Par { a: Record<string, unknown>; celle: Cella[] }

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
function pulita(c: Cella): Cella {
  const o: Cella = { ch: c.ch, g: c.g, c: c.c, s: c.s };
  if (c.f !== undefined) o.f = c.f;
  if (c.z !== undefined) o.z = c.z;
  if (c.k !== undefined) o.k = c.k;
  if (c.h !== undefined) o.h = c.h;
  return o;
}
function daDoc(doc: Documento): Par[] {
  return doc.paragrafi.map((p) => {
    const { runs, ...a } = p;
    const celle: Cella[] = [];
    for (const r of runs) for (const ch of r.t) celle.push(pulita({ ch, g: r.g, c: r.c, s: r.s, f: r.f, z: r.z, k: r.k, h: r.h }));
    return { a: a as Record<string, unknown>, celle };
  });
}
function formatoModello(m: Par[], p: number, o: number): Omit<Cella, 'ch'> {
  const c = o > 0 ? m[p].celle[o - 1] : m[p].celle[0];
  if (!c) return { g: false, c: false, s: false };
  const { ch, ...resto } = pulita(c);
  void ch;
  return resto;
}

describe('T040: prova casuale contro un modello a celle con tutti gli attributi', () => {
  it('500 sequenze da 40 operazioni: testo, formato dei caratteri e attributi dei paragrafi coincidono sempre', () => {
    const FONT = ['Roboto', 'Georgia', 'Verdana'];
    const COLORI = ['#ff0000', '#00ff00', '#0000ff'];
    for (let seme = 1; seme <= 500; seme++) {
      const rnd = generatore(seme * 7919);
      const intero = (n: number): number => Math.floor(rnd() * n);
      let stato = statoIniziale();
      let m: Par[] = [{ a: {}, celle: [] }];
      for (let passo = 0; passo < 40; passo++) {
        const pos = (): { p: number; o: number } => { const p = intero(m.length); return { p, o: intero(m[p].celle.length + 1) }; };
        const A = pos();
        const B = rnd() < 0.5 ? A : pos();
        const [i, f] = (A.p < B.p || (A.p === B.p && A.o <= B.o)) ? [A, B] : [B, A];
        stato = { ...stato, sel: { ancora: A, fuoco: B }, pendenti: null };
        const op = rnd();
        const etichetta = `seme ${seme} passo ${passo}`;
        if (op < 0.35) {
          let testo = '';
          for (let n = intero(6); n > 0; n--) testo += 'ab c\n'[intero(5)];
          const fmt = formatoModello(m, i.p, i.o);
          const righe = testo.split('\n');
          const head = m[i.p].celle.slice(0, i.o);
          const tail = m[f.p].celle.slice(f.o);
          const nuove = righe.map((r) => [...r].map((ch) => pulita({ ch, ...fmt })));
          const blocchi = nuove.length === 1 ? [[...head, ...nuove[0], ...tail]]
            : [[...head, ...nuove[0]], ...nuove.slice(1, -1), [...nuove[nuove.length - 1], ...tail]];
          const a = m[i.p].a;
          m = [...m.slice(0, i.p), ...blocchi.map((celle) => ({ a: { ...a }, celle })), ...m.slice(f.p + 1)];
          stato = inserisciTesto(stato, testo);
        } else if (op < 0.5) {
          const dir = rnd() < 0.5 ? 'indietro' : 'avanti';
          let da = i; let a = f;
          if (i.p === f.p && i.o === f.o) {
            if (dir === 'indietro') { if (i.o > 0) da = { p: i.p, o: i.o - 1 }; else if (i.p > 0) da = { p: i.p - 1, o: m[i.p - 1].celle.length }; }
            else if (i.o < m[i.p].celle.length) a = { p: i.p, o: i.o + 1 }; else if (i.p < m.length - 1) a = { p: i.p + 1, o: 0 };
          }
          if (da.p !== a.p || da.o !== a.o) {
            const celle = [...m[da.p].celle.slice(0, da.o), ...m[a.p].celle.slice(a.o)];
            m = [...m.slice(0, da.p), { a: { ...m[da.p].a }, celle }, ...m.slice(a.p + 1)];
          }
          stato = cancella(stato, dir);
        } else if (op < 0.7) {
          const chiave = (['f', 'z', 'k', 'h'] as const)[intero(4)];
          const valore = rnd() < 0.25 ? undefined : chiave === 'f' ? FONT[intero(3)] : chiave === 'z' ? PASSI_CORPO[intero(PASSI_CORPO.length)] : COLORI[intero(3)];
          for (let p = i.p; p <= f.p; p++) {
            const da = p === i.p ? i.o : 0; const a = p === f.p ? f.o : m[p].celle.length;
            for (let k = da; k < a; k++) { const c = { ...m[p].celle[k] }; if (valore === undefined) delete c[chiave]; else (c as Record<string, unknown>)[chiave] = valore; m[p].celle[k] = pulita(c); }
          }
          stato = { ...stato, doc: applicaAttributo(stato.doc, stato.sel, chiave, valore) };
        } else if (op < 0.8) {
          const nome = (['g', 'c', 's'] as const)[intero(3)]; const v = rnd() < 0.5;
          for (let p = i.p; p <= f.p; p++) {
            const da = p === i.p ? i.o : 0; const a = p === f.p ? f.o : m[p].celle.length;
            for (let k = da; k < a; k++) m[p].celle[k] = { ...m[p].celle[k], [nome]: v };
          }
          stato = { ...stato, doc: applicaSegno(stato.doc, stato.sel, nome, v) };
        } else {
          const tipo = intero(3);
          for (let p = i.p; p <= f.p; p++) {
            if (tipo === 0) { m[p].a = { ...m[p].a, al: 'ce' }; }
            else if (tipo === 1) { const n = Math.min(8, ((m[p].a.ri as number) ?? 0) + 1); m[p].a = { ...m[p].a, ri: n }; }
            else { const a = { ...m[p].a }; delete a.al; m[p].a = a; }
          }
          if (tipo === 0) stato = { ...stato, doc: applicaParagrafo(stato.doc, stato.sel, 'al', 'ce') };
          else if (tipo === 1) stato = { ...stato, doc: cambiaRientro(stato.doc, stato.sel, 1) };
          else stato = { ...stato, doc: applicaParagrafo(stato.doc, stato.sel, 'al', undefined) };
        }
        const visto = daDoc(stato.doc);
        expect(visto, etichetta).toEqual(m.map((p) => ({ a: p.a, celle: p.celle.map(pulita) })));
        for (const par of stato.doc.paragrafi) {
          for (let k = 0; k < par.runs.length; k++) {
            expect(par.runs[k].t, etichetta).not.toBe('');
            for (const [chiave, v] of Object.entries(par.runs[k])) expect(v, `${etichetta} ${chiave}`).not.toBeUndefined();
            if (k > 0) expect(JSON.stringify({ ...par.runs[k - 1], t: '' }), etichetta).not.toBe(JSON.stringify({ ...par.runs[k], t: '' }));
          }
          for (const [chiave, v] of Object.entries(par)) expect(v, `${etichetta} ${chiave}`).not.toBeUndefined();
        }
        if (passo % 10 === 9) expect(deserializza(serializza(stato.doc))).toEqual(stato.doc);
      }
    }
  });
});
