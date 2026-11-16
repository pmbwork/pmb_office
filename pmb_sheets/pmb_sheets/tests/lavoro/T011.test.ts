// @vitest-environment node
// Test di accettazione (scritto da Claude, NON modificare). Gli attesi vengono dalle regole del compito, non dal codice.
import { describe, it, expect } from 'vitest';
import { leggiCsv } from '@comune/formati/csv';

describe('T011: leggiCsv', () => {


  it('leggiCsv', () => {
    const casi: [string, string[][]][] = [
      ['a,b\n1,2\n', [['a', 'b'], ['1', '2']]],
      ['a,b\r\n1,2', [['a', 'b'], ['1', '2']]],
      ['a,b\r1,2', [['a', 'b'], ['1', '2']]],
      ['"a,b",c', [['a,b', 'c']]],
      ['"ha detto ""ciao""",x', [['ha detto "ciao"', 'x']]],
      ['"riga1\nriga2",x\ny,z', [['riga1\nriga2', 'x'], ['y', 'z']]],
      [',,\n', [['', '', '']]],
      ['a,b\n\nc,d', [['a', 'b'], [''], ['c', 'd']]],
      ['﻿a,b', [['a', 'b']]],
      ['', []],
      ['   ', [['   ']]],
      ['""', [['']]],
      ['a;b\n1,5;2', [['a', 'b'], ['1,5', '2']]],
      ['a,b', [['a', 'b']]],
      ['\n', [['']]],
      ['x"y,z', [['x"y', 'z']]],
      ['città,perché', [['città', 'perché']]],
      ['a,b\n1', [['a', 'b'], ['1']]],
      ['"",x', [['', 'x']]],
    ];
    for (const [testo, atteso] of casi) expect(leggiCsv(testo), JSON.stringify(testo)).toEqual(atteso);
    expect(leggiCsv('a;b,c', { delimitatore: ',' })).toEqual([['a;b', 'c']]);
    expect(leggiCsv('a,b;c', { delimitatore: ';' })).toEqual([['a,b', 'c']]);
  });


  // Tabelle casuali (seme fisso): il testo si costruisce da una tabella nota, quindi la risposta giusta è nota per costruzione.
  it('tabelle casuali con la risposta nota', () => {
    let seme = 77031;
    const casuale = () => (seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const scegli = <T>(a: T[]): T => a[Math.floor(casuale() * a.length)];
    const alfabeto = ['a', 'b', '1', ' ', ',', ';', '\t', '|', '"', '\n', '\r', 'è', '.'];
    for (let n = 0; n < 400; n++) {
      const d = scegli([',', ';', '\t']);
      const nrighe = 1 + Math.floor(casuale() * 5);
      const tabella: string[][] = [];
      for (let r = 0; r < nrighe; r++) {
        const nc = 1 + Math.floor(casuale() * 4);
        const riga: string[] = [];
        for (let c = 0; c < nc; c++) {
          let v = '';
          const len = Math.floor(casuale() * 6);
          for (let i = 0; i < len; i++) v += scegli(alfabeto);
          riga.push(v);
        }
        tabella.push(riga);
      }
      const ultima = tabella[tabella.length - 1];
      if (ultima.length === 1 && ultima[0] === '') ultima[0] = 'x';   // evita il caso ambiguo "ultima riga con un solo campo vuoto"
      const righeTesto = tabella.map((riga) => riga.map((v) => {
        const serve = v.includes(d) || v.includes('\n') || v.includes('\r') || v.startsWith('"');
        const aVolte = v.includes('"') && !serve && casuale() < 0.5;   // x"y senza virgolette resta x"y
        if (serve || (!aVolte && casuale() < 0.3)) return '"' + v.replace(/"/g, '""') + '"';
        return v;
      }).join(d));
      let testo = '';
      righeTesto.forEach((r, i) => { testo += r + (i < righeTesto.length - 1 || casuale() < 0.5 ? scegli(['\n', '\r\n', '\r']) : ''); });
      if (casuale() < 0.2) testo = '\uFEFF' + testo;
      expect(leggiCsv(testo, { delimitatore: d }), JSON.stringify(testo)).toEqual(tabella);
    }
  });});
