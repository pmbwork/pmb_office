// @vitest-environment node
// Test di accettazione (scritto da Claude, NON modificare). Gli attesi vengono dalle regole del compito, non dal codice.
import { describe, it, expect } from 'vitest';
import { leggiCsv, scriviCsv } from '@comune/formati/csv';

describe('T012: scriviCsv', () => {


  it('scriviCsv', () => {
    expect(scriviCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2\r\n');
    expect(scriviCsv([['a,b', 'c']])).toBe('"a,b",c\r\n');
    expect(scriviCsv([['ha detto "ciao"']])).toBe('"ha detto ""ciao"""\r\n');
    expect(scriviCsv([['riga1\nriga2']], { fineRiga: '\n' })).toBe('"riga1\nriga2"\n');
    expect(scriviCsv([['1,5', '2']], { delimitatore: ';' })).toBe('1,5;2\r\n');
    expect(scriviCsv([['a;b']], { delimitatore: ';' })).toBe('"a;b"\r\n');
    expect(scriviCsv([['a', '']])).toBe('a,\r\n');
    expect(scriviCsv([])).toBe('');
  });

  it('andata e ritorno su 300 tabelle casuali', () => {
    let seme = 12345;
    const casuale = () => (seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const alfabeto = ['a', 'b', 'c', ' ', ',', ';', '\t', '|', '"', '\n', '\r', 'è', '1', '.'];
    const configurazioni: { d: string; f: '\n' | '\r\n' }[] = [{ d: ',', f: '\r\n' }, { d: ';', f: '\n' }, { d: '\t', f: '\r\n' }];
    for (let t = 0; t < 300; t++) {
      const righe: string[][] = [];
      const nr = 1 + Math.floor(casuale() * 5);
      for (let r = 0; r < nr; r++) {
        const nc = 1 + Math.floor(casuale() * 4);
        const riga: string[] = [];
        for (let c = 0; c < nc; c++) {
          let v = '';
          const len = Math.floor(casuale() * 6);
          for (let k = 0; k < len; k++) v += alfabeto[Math.floor(casuale() * alfabeto.length)];
          riga.push(v);
        }
        righe.push(riga);
      }
      const cfg = configurazioni[t % 3];
      const testo = scriviCsv(righe, { delimitatore: cfg.d, fineRiga: cfg.f });
      expect(leggiCsv(testo, { delimitatore: cfg.d }), JSON.stringify(righe)).toEqual(righe);
    }
  });

});
