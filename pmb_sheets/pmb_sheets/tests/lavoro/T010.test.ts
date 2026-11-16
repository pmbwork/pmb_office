// @vitest-environment node
// Test di accettazione (scritto da Claude, NON modificare). Gli attesi vengono dalle regole del compito, non dal codice.
import { describe, it, expect } from 'vitest';
import { rilevaDelimitatore } from '@comune/formati/csv';

describe('T010: rilevaDelimitatore', () => {


  it('rilevaDelimitatore', () => {
    const casi: [string, string][] = [
      ['a,b,c\n1,2,3', ','],
      ['a;b;c\n1;2;3', ';'],
      ['a\tb\n1\t2', '\t'],
      ['a|b|c\n1|2|3', '|'],
      ['a;b;c\n1,5;2,5;3,5', ';'],
      ['nome\nluca', ','],
      ['"a;b",c\n1,2', ','],
      ['', ','],
      ['a;b\r\n1;2\r\n3;4\r\n', ';'],
    ];
    for (const [testo, atteso] of casi) expect(rilevaDelimitatore(testo), JSON.stringify(testo)).toBe(atteso);
  });


  // Tabelle casuali (seme fisso) costruite a partire da una risposta nota: la risposta giusta è nota per costruzione.
  it('tabelle casuali con la risposta nota', () => {
    let seme = 20261029;
    const casuale = () => (seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const scegli = <T>(a: T[]): T => a[Math.floor(casuale() * a.length)];
    const candidati = [',', ';', '\t', '|'];
    const sicuri = ['a', 'b', '1', ' ', 'è'];
    for (let n = 0; n < 300; n++) {
      const d = scegli(candidati);
      const altri = candidati.filter((x) => x !== d);
      const k = 1 + Math.floor(casuale() * 3);          // separatori per riga, uguale in tutte le righe
      const nrighe = 2 + Math.floor(casuale() * 5);
      const righe: string[] = [];
      for (let r = 0; r < nrighe; r++) {
        const campi: string[] = [];
        for (let c = 0; c <= k; c++) {
          if (casuale() < 0.4) {
            let dentro = '';
            const len = 1 + Math.floor(casuale() * 6);
            for (let i = 0; i < len; i++) dentro += scegli([...altri, d, '"', '\n', '\r', 'a', 'b']);
            campi.push('"' + dentro.replace(/"/g, '""') + '"');
          } else {
            let f = '';
            const len = Math.floor(casuale() * 4);
            for (let i = 0; i < len; i++) f += scegli(sicuri);
            campi.push(f);
          }
        }
        righe.push(campi.join(d));
      }
      let testo = '';
      righe.forEach((r, i) => { testo += r + (i < righe.length - 1 || casuale() < 0.5 ? scegli(['\n', '\r\n', '\r']) : ''); });
      expect(rilevaDelimitatore(testo), JSON.stringify(testo)).toBe(d);
    }
  });});
