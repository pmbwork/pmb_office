// T549: apertura dei file .xls (Excel 97-2003). Lettore dei file composti (comune/src/formati/cfb.ts), formule (xls-formule.ts),
// celle, stili, pagina, commenti, collegamenti e nomi (xls-leggi.ts), e un file vero creato da LibreOffice (tests/file-prova/xls),
// confrontato con lo stesso file salvato in .xlsx e con i risultati calcolati da LibreOffice.
import fs from 'node:fs';
import { eFileComposto, leggiCfb } from '@comune/formati/cfb';
import { leggiXls } from '../../src/formati/xls-leggi';
import { testoFormula, type CartellaFormule } from '../../src/formati/xls-formule';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { ESTENSIONI_APRI, eSoloLettura, importa, scambioConValoriCalcolati, titoloDaNome } from '../../src/formati/file';
import { documentoDaScambio } from '../../src/formati/scambio';
import { creaCfb, creaXls, record, cella, u16, u32, f64, testo16, testo8, caratteri, unisci } from './aiuti-xls';

const CARTELLA_PROVA = 'tests/file-prova/xls';

describe('file composti (CFB)', () => {
  test('flussi piccoli (mini flusso) e grandi, cartelle interne, nomi senza badare alle maiuscole', () => {
    const grande = Uint8Array.from({ length: 10000 }, (_, i) => i % 251);
    const piccolo = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
    const b = creaCfb([['Workbook', grande], ['\u0005SummaryInformation', piccolo], ['Cartella/Dentro', Uint8Array.from([1, 2, 3])]]);
    expect(eFileComposto(b)).toBe(true);
    const a = leggiCfb(b);
    expect(a.flusso('workbook')).toEqual(grande);
    expect(a.flusso('\u0005SummaryInformation')).toEqual(piccolo);
    expect(a.flusso('cartella/dentro')).toEqual(Uint8Array.from([1, 2, 3]));
    expect(a.cartelle).toEqual(['Cartella']);
    expect(a.esiste('CARTELLA')).toBe(true);
    expect(a.flusso('manca')).toBeUndefined();
  });

  test('file non composto o rovinato: errore chiaro, nessun blocco', () => {
    expect(eFileComposto(new Uint8Array(600))).toBe(false);
    expect(() => leggiCfb(new Uint8Array(600))).toThrow(/firma/);
    const b = creaCfb([['Workbook', new Uint8Array(5000)]]);
    // la FAT punta il settore dei dati a se stesso: catena circolare
    const rotto = b.slice();
    const dv = new DataView(rotto.buffer);
    const primoDati = 2; // FAT nel settore 0, cartella nel settore 1
    dv.setUint32(512 + primoDati * 4, primoDati, true);
    // il flusso con la catena circolare resta vuoto; il file non blocca il programma
    expect(leggiCfb(rotto).flusso('Workbook')).toEqual(new Uint8Array(0));
  });
});

/** Cartella per le formule di prova: Foglio1 e «Il mio foglio», due nomi, una funzione aggiuntiva. */
const CARTELLA: CartellaFormule = {
  fogli: (ixti) => (ixti === 0 ? { primo: 'Foglio1', ultimo: 'Foglio1' } : ixti === 1 ? { primo: 'Il mio foglio', ultimo: 'Il mio foglio' } : ixti === 2 ? { primo: 'Foglio1', ultimo: 'Il mio foglio' } : null),
  nome: (n) => ['Prezzo', '_xlfn.IFERROR'][n - 1],
  nomeEsterno: (ixti, n) => (ixti === 4 ? ['EOMONTH', 'NETWORKDAYS'][n - 1] : undefined),
};
const ref = (r: number, c: number, rRel = true, cRel = true): number[] => [...u16(r), ...u16(c | (cRel ? 0x4000 : 0) | (rRel ? 0x8000 : 0))];
const formula = (gettoni: number[], extra: number[] = [], dove = { riga: 0, colonna: 0, condivisa: false }): string => {
  const e = testoFormula(Uint8Array.from(gettoni), Uint8Array.from(extra), dove, CARTELLA);
  return 'testo' in e ? e.testo : `MOTIVO: ${e.motivo}`;
};

describe('formule dei .xls', () => {
  test('operatori, precedenze e parentesi', () => {
    // (A1+B1)*2 con la parentesi scritta nel file
    expect(formula([0x44, ...ref(0, 0), 0x44, ...ref(0, 1), 0x03, 0x15, 0x1e, ...u16(2), 0x05])).toBe('(A1+B1)*2');
    // senza la parentesi nel file la precedenza si conserva lo stesso
    expect(formula([0x44, ...ref(0, 0), 0x44, ...ref(0, 1), 0x03, 0x1e, ...u16(2), 0x05])).toBe('(A1+B1)*2');
    expect(formula([0x1e, ...u16(1), 0x1e, ...u16(2), 0x1e, ...u16(3), 0x04, 0x04])).toBe('1-(2-3)');
    expect(formula([0x44, ...ref(0, 0), 0x13, 0x1e, ...u16(2), 0x07])).toBe('-A1^2');
    expect(formula([0x44, ...ref(0, 0), 0x14])).toBe('A1%');
    expect(formula([0x17, ...testo8('a"b'), 0x17, 3, 1, ...caratteri('€ok', true), 0x08])).toBe('"a""b"&"€ok"');
    expect(formula([0x44, ...ref(0, 0), 0x1f, ...f64(1.5e-10), 0x0d, 0x1d, 1, 0x0b])).toBe('A1>1.5E-10=TRUE');
    expect(formula([0x1c, 0x07])).toBe('#DIV/0!');
  });

  test('riferimenti assoluti, colonne e righe intere, altri fogli, intervalli 3D', () => {
    expect(formula([0x44, ...ref(4, 2, false, false)])).toBe('$C$5');
    expect(formula([0x44, ...ref(4, 2, true, false)])).toBe('$C5');
    expect(formula([0x25, ...u16(0), ...u16(0xffff), ...u16(0x4000 | 0x8000), ...u16(0x4001 | 0x8000)])).toBe('A:B');
    expect(formula([0x25, ...u16(1), ...u16(2), ...u16(0), ...u16(0xff)])).toBe('$2:$3');
    expect(formula([0x5a, ...u16(0), ...ref(0, 0)])).toBe('Foglio1!A1');
    expect(formula([0x3b, ...u16(1), ...u16(0), ...u16(9), ...u16(0xc000), ...u16(0xc001)])).toBe("'Il mio foglio'!A1:B10");
    expect(formula([0x3a, ...u16(2), ...ref(0, 0)])).toBe("'Foglio1:Il mio foglio'!A1");
    expect(formula([0x3a, ...u16(3), ...ref(0, 0)])).toMatch(/^MOTIVO: riferimento a un altro file/);
    expect(formula([0x2a, 0, 0, 0, 0])).toBe('#REF!');
  });

  test('formule condivise: i riferimenti relativi sono spostamenti dalla cella', () => {
    // nella cella C3 (riga 2, colonna 2): A(-2) e B(-1) della stessa riga
    const gettoni = [0x4c, ...u16(0), ...u16(0xc000 | 0xfe), 0x4c, ...u16(0), ...u16(0xc000 | 0xff), 0x03];
    expect(formula(gettoni, [], { riga: 2, colonna: 2, condivisa: true })).toBe('A3+B3');
    // una riga sopra (-1) con colonna assoluta
    expect(formula([0x4c, ...u16(0xffff), ...u16(0x8000 | 3)], [], { riga: 5, colonna: 0, condivisa: true })).toBe('$D5');
  });

  test('funzioni: fisse, variabili, SUM veloce, CHOOSE, argomenti vuoti, funzioni aggiuntive e recenti', () => {
    expect(formula([0x41, ...u16(19)])).toBe('PI()');
    expect(formula([0x1f, ...f64(2.5), 0x41, ...u16(25)])).toBe('INT(2.5)');
    expect(formula([0x25, ...u16(0), ...u16(4), ...u16(0xc000), ...u16(0xc000), 0x19, 0x10, 0, 0])).toBe('SUM(A1:A5)');
    expect(formula([0x1e, ...u16(1), 0x19, 0x04, ...u16(1), ...u16(4), ...u16(8), 0x17, ...testo8('a'), 0x19, 0x08, ...u16(3), 0x42, 2, ...u16(100)])).toBe('CHOOSE(1,"a")');
    expect(formula([0x44, ...ref(0, 0), 0x16, 0x1e, ...u16(1), 0x42, 3, ...u16(1)])).toBe('IF(A1,,1)');
    // EOMONTH come funzione aggiuntiva (nome esterno) e IFERROR come funzione recente (nome nascosto _xlfn.)
    expect(formula([0x59, ...u16(4), ...u32(1), 0x1e, ...u16(45000), 0x1e, ...u16(1), 0x42, 3, ...u16(255)])).toBe('EOMONTH(45000,1)');
    expect(formula([0x43, ...u32(2), 0x44, ...ref(0, 0), 0x17, ...testo8('x'), 0x42, 3, ...u16(255)])).toBe('IFERROR(A1,"x")');
    expect(formula([0x43, ...u32(1), 0x1e, ...u16(2), 0x05])).toBe('Prezzo*2');
    // unione dentro una funzione: tra parentesi
    expect(formula([0x25, ...u16(0), ...u16(1), ...u16(0xc000), ...u16(0xc000), 0x25, ...u16(3), ...u16(4), ...u16(0xc000), ...u16(0xc000), 0x10, 0x42, 1, ...u16(4)])).toBe('SUM((A1:A2,A4:A5))');
    expect(formula([0x42, 1, ...u16(0x8000 | 5)])).toMatch(/^MOTIVO: comando delle macro/);
    expect(formula([0x41, ...u16(9999)])).toMatch(/^MOTIVO: funzione 9999/);
  });

  test('matrici costanti (dati dopo la formula)', () => {
    const extra = [1, ...u16(1), 0x01, ...f64(1), 0x02, ...u16(2), 0, ...caratteri('ab'), 0x04, 1, 0, 0, 0, 0, 0, 0, 0, 0x10, 0x2a, 0, 0, 0, 0, 0, 0, 0];
    expect(formula([0x60, 0, 0, 0, 0, 0, 0, 0], extra)).toBe('{1,"ab";TRUE,#N/A}');
  });
});

/** Caratteri, formati e stili minimi: carattere 0 = Arial 10, carattere 1 = grassetto rosso. */
const FONT = (nome: string, punti: number, grassetto = false, colore = 0x7fff, corsivo = false): Uint8Array =>
  record(0x0031, u16(punti * 20), u16(corsivo ? 2 : 0), u16(colore), u16(grassetto ? 700 : 400), u16(0), [0, 0, 0, 0], testo8(nome));
/** XF da 20 byte: carattere, formato, allineamento, bordi (sinistra, destra, sopra, sotto), riempimento. */
function XF(o: { font?: number; formato?: number; orizzontale?: number; verticale?: number; aCapo?: boolean; bordo?: [number, number]; riempimento?: number } = {}): Uint8Array {
  const all = (o.orizzontale ?? 0) | (o.aCapo ? 8 : 0) | ((o.verticale ?? 2) << 4);
  const [stile, colore] = o.bordo ?? [0, 0];
  const b1 = (stile | (stile << 4) | (stile << 8) | (stile << 12) | (colore << 16) | (colore << 23)) >>> 0;
  const b2 = (colore | (colore << 7) | ((o.riempimento !== undefined ? 1 : 0) << 26)) >>> 0;
  return record(0x00e0, u16(o.font ?? 0), u16(o.formato ?? 0), u16(0), [all, 0, 0, 0], u32(b1), u32(b2), u16(o.riempimento ?? 64));
}
const BASE = [FONT('Arial', 10), FONT('Arial', 10, true, 10), FONT('Arial', 10), FONT('Arial', 10), FONT('Courier New', 14, false, 0x7fff, true)];

describe('celle dei .xls', () => {
  test('numeri RK e MULRK, testi condivisi spezzati, booleani, errori, testi lunghi da 2 byte, celle vuote con stile', () => {
    // testi condivisi: «abc», «Ciao mondo €» spezzato a metà con il seguito in caratteri da 2 byte, un testo con formattazione e pronuncia
    const sst = record(0x00fc, u32(3), u32(3), testo16('abc'), u16(12), [0], caratteri('Ciao '));
    const seguito = record(0x003c, [1], caratteri('mondo €', true), u16(5), [0x0c], u16(1), u32(4), caratteri('ricco'), u32(0), [9, 9, 9, 9]);
    const rk = (n: number, cento = false): number => (((n << 2) | 2 | (cento ? 1 : 0)) >>> 0);
    const b = creaXls([...BASE, XF(), XF({ riempimento: 13 }), sst, seguito], [{
      nome: 'Dati', record: [
        record(0x027e, cella(0, 0), u32(rk(42))),
        record(0x027e, cella(1, 0), u32(rk(1234, true))),
        record(0x00bd, u16(2), u16(0), u16(0), u32(rk(1)), u16(0), u32(rk(2)), u16(0), u32(rk(-3)), u16(2)),
        record(0x0203, cella(3, 0), f64(3.14159)),
        record(0x00fd, cella(4, 0), u32(0)), record(0x00fd, cella(4, 1), u32(1)), record(0x00fd, cella(4, 2), u32(2)),
        record(0x0205, cella(5, 0), [1, 0]), record(0x0205, cella(5, 1), [0x07, 1]),
        record(0x0204, cella(6, 0), testo16('Città 漢字')),
        record(0x00fd, cella(7, 0), u32(0)),
        record(0x0201, cella(8, 0, 1)),
        record(0x00be, u16(9), u16(0), u16(1), u16(1), u16(1)),
      ],
    }]);
    const { scambio, avvisi } = leggiXls(b);
    const f = scambio.fogli[0];
    expect(f.nome).toBe('Dati');
    expect(f.celle).toMatchObject({ A1: '42', A2: '12.34', A3: '1', B3: '2', C3: '-3', A4: '3.14159', A5: 'abc', B5: 'Ciao mondo €', C5: 'ricco', A6: 'TRUE', B6: '#DIV/0!', A7: 'Città 漢字' });
    expect(f.stili.A9).toEqual({ fill: '#ffff00' });
    expect(f.stili.B10).toEqual({ fill: '#ffff00' });
    expect(f.celle.A9).toBeUndefined();
    expect(avvisi[0]).toMatch(/vecchia versione di Excel/);
  });

  test('formule: risultato di testo, formula condivisa, formula matrice, formula non leggibile con il suo valore', () => {
    const formulaRec = (r: number, c: number, valore: number[], gettoni: number[]): Uint8Array => record(0x0006, cella(r, c), valore, u16(0), u32(0), u16(gettoni.length), gettoni);
    const testoCalcolato = [0, 0, 0, 0, 0, 0, 0xff, 0xff];
    const b = creaXls([...BASE, XF(),
      record(0x01ae, u16(1), u16(0x0401)), record(0x01ae, u16(1), u16(10), [0], caratteri('\u0001altro.xls')), record(0x0017, u16(2), u16(0), u16(0), u16(0), u16(1), u16(0), u16(0))], [{
      nome: 'Foglio1', record: [
        record(0x0203, cella(0, 0), f64(10)), record(0x0203, cella(1, 0), f64(20)),
        formulaRec(0, 1, testoCalcolato, [0x17, ...testo8('ciao')]), record(0x0207, testo16('ciao')),
        // condivisa in C1:C2: =A1*2 (riga relativa)
        formulaRec(0, 2, f64(20), [0x01, ...u16(0), ...u16(2)]),
        record(0x04bc, u16(0), u16(1), [2, 2], [0, 2], u16(9), [0x4c, ...u16(0), ...u16(0xc000 | 0xfe), 0x1e, ...u16(2), 0x05]),
        formulaRec(1, 2, f64(40), [0x01, ...u16(0), ...u16(2)]),
        // matrice in D1:D2: =A1:A2*3
        formulaRec(0, 3, f64(30), [0x01, ...u16(0), ...u16(3)]),
        record(0x0221, u16(0), u16(1), [3, 3], u16(0), u32(0), u16(13), [0x65, ...u16(0), ...u16(1), ...u16(0xc000), ...u16(0xc000), 0x1e, ...u16(3), 0x05]),
        formulaRec(1, 3, f64(60), [0x01, ...u16(0), ...u16(3)]),
        // riferimento a un altro file: resta il valore, testo dal record STRING
        formulaRec(2, 0, testoCalcolato, [0x5a, ...u16(1), ...ref(0, 0)]), record(0x0207, testo16('da fuori')),
        formulaRec(3, 0, f64(7), [0x5a, ...u16(1), ...ref(0, 0)]),
      ],
    }]);
    const { scambio, avvisi } = leggiXls(b);
    const f = scambio.fogli[0];
    expect(f.celle).toMatchObject({ B1: '="ciao"', C1: '=A1*2', C2: '=A2*2', D1: '=A1:A2*3', A3: 'da fuori', A4: '7' });
    expect(f.celle.D2).toBeUndefined();
    expect(avvisi.join(' ')).toMatch(/2 formule del file usano qualcosa/);
    // i valori si ricalcolano come nel file
    const calcolato = scambioConValoriCalcolati(documentoDaScambio(scambio)).fogli[0].celle;
    // (la formula matrice si allarga da sola su D2 nel foglio: qui si vede la sua prima cella)
    expect([calcolato.C1, calcolato.C2, calcolato.D1]).toEqual(['20', '40', '30']);
  });

  test('calendario 1904: le date si spostano, gli altri numeri no', () => {
    const b = creaXls([...BASE, XF(), XF({ formato: 14 }), record(0x0022, u16(1))], [{ nome: 'D', record: [record(0x0203, cella(0, 0, 1), f64(100)), record(0x0203, cella(1, 0, 0), f64(100))] }]);
    const f = leggiXls(b).scambio.fogli[0];
    expect(f.celle.A1).toBe('1562');
    expect(f.celle.A2).toBe('100');
    expect(f.stili.A1).toEqual({ numFmt: 'dd/mm/yyyy' });
  });

  test('stili: caratteri, colori della tavolozza del file, bordi, allineamento, formati numerici personalizzati', () => {
    const tavolozza = record(0x0092, u16(56), ...Array.from({ length: 56 }, (_, i) => (i === 2 ? [0x12, 0x34, 0x56, 0] : [0, 0, 0, 0])));
    const b = creaXls([...BASE, tavolozza, record(0x041e, u16(164), testo16('#,##0.000')),
      XF(), XF({ font: 1 }), XF({ font: 5, orizzontale: 3, verticale: 0, aCapo: true }), XF({ bordo: [2, 10], riempimento: 10 }), XF({ formato: 164, orizzontale: 2, verticale: 1 })], [{
      nome: 'S', record: [record(0x0201, cella(0, 0, 1)), record(0x0201, cella(0, 1, 2)), record(0x0201, cella(0, 2, 3)), record(0x0203, cella(0, 3, 4), f64(1))],
    }]);
    const f = leggiXls(b).scambio.fogli[0];
    expect(f.stili.A1).toEqual({ bold: true, color: '#123456' });
    expect(f.stili.B1).toEqual({ italic: true, fontFamily: 'Courier New', fontSize: 14, hAlign: 'right', vAlign: 'top', wrap: true });
    const lato = { style: 'medium', color: '#123456' };
    expect(f.stili.C1).toEqual({ fill: '#123456', borders: { left: lato, right: lato, top: lato, bottom: lato } });
    expect(f.stili.D1).toEqual({ numFmt: '#,##0.000', hAlign: 'center', vAlign: 'middle' });
  });

  test('righe, colonne, celle unite, righe e colonne bloccate, colore della scheda, foglio nascosto', () => {
    const b = creaXls([...BASE, XF()], [{
      nome: 'Misure', stato: 1, record: [
        record(0x0208, u16(1), u16(0), u16(1), u16(600), u16(0), u16(0), u16(0x0140), u16(15)),
        record(0x0208, u16(2), u16(0), u16(1), u16(255), u16(0), u16(0), u16(0x0120), u16(15)),
        record(0x007d, u16(1), u16(2), u16(20 * 256), u16(15), u16(0), u16(0)),
        record(0x007d, u16(3), u16(3), u16(2340), u16(15), u16(1), u16(0)),
        record(0x007d, u16(4), u16(255), u16(2340), u16(15), u16(0), u16(0)),
        record(0x00e5, u16(1), u16(0), u16(1), u16(0), u16(2)),
        record(0x023e, u16(0x06be), u16(0), u16(0), u32(0), u16(0), u16(0)),
        record(0x0041, u16(1), u16(2), u16(2), u16(1), u16(0)),
        record(0x0862, u16(0x0862), u16(0), u32(0), u32(0), u32(0x14), u32(10), u32(0)),
      ],
    }, { nome: 'Altro', record: [] }]);
    const { scambio, avvisi } = leggiXls(b);
    const f = scambio.fogli[0];
    expect(f.altezze).toEqual({ 2: 40 });
    expect(f.righeNascoste).toEqual([3]);
    expect(f.larghezze).toEqual({ 2: 145, 3: 145 });
    expect(f.colonneNascoste).toEqual([4]);
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 3 }]);
    expect([f.righeCongelate, f.colonneCongelate]).toEqual([2, 1]);
    expect(f.colore).toBe('#ff0000');
    expect(f.nascosto).toBe(true);
    expect(avvisi.join(' ')).not.toMatch(/era nascosto/); // dal 0.2.14 il foglio resta nascosto, senza avviso (T567)
  });

  test('commenti, collegamenti, nomi definiti, area di stampa e pagina', () => {
    const clsidUrl = [0xe0, 0xc9, 0xea, 0x79, 0xf9, 0xba, 0xce, 0x11, 0x8c, 0x82, 0x00, 0xaa, 0x00, 0x4b, 0xa9, 0x0b];
    const url = 'https://esempio.it/a?b=1';
    const hlink = (r: number, indirizzo: number[], ind: number): Uint8Array => record(0x01b8, u16(r), u16(r), u16(0), u16(0), new Array(16).fill(0), u32(2), u32(ind), indirizzo);
    const urlMoniker = [...clsidUrl, ...u32((url.length + 1) * 2), ...caratteri(url + '\0', true)];
    const interno = [...u32(4), ...caratteri('B2\0', true)];
    const nome = (testo: string, gettoni: number[], foglio = 0, incorporato = false): Uint8Array =>
      record(0x0018, u16(incorporato ? 0x20 : 0), [0, incorporato ? 1 : testo.length], u16(gettoni.length), u16(0), u16(foglio), [0, 0, 0, 0], [0], incorporato ? [testo.charCodeAt(0)] : caratteri(testo), gettoni);
    const b = creaXls([...BASE, XF(),
      record(0x01ae, u16(1), u16(0x0401)), record(0x0017, u16(1), u16(0), u16(0), u16(0)),
      nome('Totale', [0x3b, ...u16(0), ...u16(0), ...u16(4), ...u16(1), ...u16(1)]),
      nome('Strano', [0x1e, ...u16(1)]),
      nome('\u0006', [0x3b, ...u16(0), ...u16(0), ...u16(9), ...u16(0), ...u16(3)], 1, true),
    ], [{
      nome: 'Foglio1', record: [
        record(0x0204, cella(0, 0), testo16('nota qui')),
        record(0x005d, u16(0x15), u16(0x12), u16(0x19), u16(7), u16(0), new Array(12).fill(0), u16(0), u16(0)),
        record(0x01b6, u16(0x12), u16(0), u16(0), u16(0), u16(0), u16(9), u16(16), u16(0), u32(0)),
        record(0x003c, [0], caratteri('Riga 1\nok')), record(0x003c, new Array(16).fill(0)),
        record(0x001c, u16(0), u16(0), u16(0), u16(7), testo16('Anna'), [0]),
        hlink(1, urlMoniker, 0x03), hlink(2, interno, 0x08),
        record(0x0026, f64(1)), record(0x00a1, u16(9), u16(80), u16(1), u16(1), u16(1), u16(0), u16(300), u16(300), f64(0.5), f64(0.5), u16(1)),
        record(0x0014, testo16('&CPagina &P')),
      ],
    }]);
    const { scambio, avvisi } = leggiXls(b);
    const f = scambio.fogli[0];
    expect(f.commenti).toEqual([{ riga: 1, colonna: 1, testo: 'Riga 1\nok', autore: 'Anna' }]);
    expect(f.stili.A2).toEqual({ link: url });
    expect(f.stili.A3).toBeUndefined();
    expect(avvisi.join(' ')).toMatch(/collegamenti ipertestuali/);
    expect(scambio.nomi).toEqual([{ nome: 'Totale', foglio: 'Foglio1', riferimento: 'B1:B5' }]);
    expect(avvisi.join(' ')).toMatch(/Un nome definito del file non è stato importato/);
    expect(f.pagina).toMatchObject({ formato: 'A4', orientamento: 'orizzontale', scala: 80, adatta: null, area: { startRow: 1, endRow: 10, startCol: 1, endCol: 4 }, intestazione: { centro: 'Pagina &[Pagina]' } });
    expect(f.pagina!.margini.sinistro).toBe(25.4);
  });

  test('file che non si aprono: errori chiari', () => {
    expect(() => leggiXls(creaXls([record(0x002f, u16(1)), ...BASE], [{ nome: 'x', record: [] }]))).toThrow(/protetto da password/);
    expect(() => leggiXls(creaCfb([['EncryptedPackage', new Uint8Array(100)]]))).toThrow(/protetto da password/);
    expect(() => leggiXls(creaCfb([['WordDocument', new Uint8Array(100)]]))).toThrow(/^È un documento di Word: si apre con pmb_docs\.$/);
    expect(() => leggiXls(creaCfb([['Book', new Uint8Array(100)]]))).toThrow(/^File \.xls non valido: manca l'inizio della cartella$/);
    expect(() => leggiXls(creaCfb([['Altro', new Uint8Array(100)]]))).toThrow(/^File \.xls non valido: manca la cartella di lavoro$/);
    // un .xls troncato non fa cadere il programma: dà un errore o apre quello che c'è
    const buono = creaXls([...BASE, XF()], [{ nome: 'T', record: [record(0x0203, cella(0, 0), f64(1))] }]);
    for (const n of [600, 1100, 1500]) {
      try { leggiXls(buono.subarray(0, n)); } catch (e) { expect(String(e)).toMatch(/xls|composto/); }
    }
  });

  test('si apre da importa(): sola lettura, salvataggio in .xlsx, nella finestra Apri', async () => {
    const b = creaXls([...BASE, XF()], [{ nome: 'Uno', record: [record(0x0203, cella(0, 0), f64(5))] }]);
    const r = await importa(b, 'Bilancio 2003.xls');
    expect(r.formato).toBe('xlsx');
    expect(r.soloLettura).toBe(true);
    expect(r.avvisi[0]).toMatch(/Salva lo salva in \.xlsx/);
    expect(titoloDaNome('Bilancio 2003.xls')).toBe('Bilancio 2003');
    expect(eSoloLettura('modello.xlt')).toBe(true);
    expect(ESTENSIONI_APRI.split(',')).toEqual(expect.arrayContaining(['.xls', '.xlt']));
    // un documento di Word con l'estensione sbagliata non si apre come foglio
    await expect(importa(creaCfb([['WordDocument', new Uint8Array(100)]]), 'lettera.xls')).rejects.toThrow(/documento di Word/);
  });
});

describe('un file vero creato da LibreOffice (tests/file-prova/xls)', () => {
  const xls = () => leggiXls(new Uint8Array(fs.readFileSync(`${CARTELLA_PROVA}/prova.xls`)));
  /** lo stile come lo legge il lettore .xlsx, senza l'allineamento in basso che LibreOffice scrive sempre e che è quello normale */
  const senzaBasso = (s: object | undefined): object | undefined => {
    if (!s) return s;
    const { vAlign, ...resto } = s as { vAlign?: string };
    const x = vAlign === 'bottom' ? resto : s;
    return Object.keys(x).length === 0 ? undefined : x;
  };

  test('stesse celle, formule, stili, misure, nomi e commenti del lettore .xlsx', async () => {
    const a = xls().scambio;
    const b = (await leggiXlsx(new Uint8Array(fs.readFileSync(`${CARTELLA_PROVA}/prova.xlsx`)))).scambio;
    expect(a.fogli.map((f) => f.nome)).toEqual(b.fogli.map((f) => f.nome));
    expect(a.nomi).toEqual(b.nomi);
    expect(a.foglioAttivo).toBe(b.foglioAttivo);
    // differenze attese: LibreOffice scrive TRUE() come costante nel .xls, i testi che sembrano numeri o formule restano testo con l'apice
    const attese: Record<string, string> = { 'Dati!A7': '=TRUE', 'Dati!A8': "'00123", 'Dati!A9': "'=non formula", 'Formule e calcoli!F17': '=AND(TRUE,NOT(FALSE))', 'Formule e calcoli!F26': '=#N/A', 'Formule e calcoli!F62': '=#N/A' };
    for (const f of a.fogli) {
      const g = b.fogli.find((x) => x.nome === f.nome)!;
      for (const k of new Set([...Object.keys(f.celle), ...Object.keys(g.celle)])) expect(f.celle[k], `${f.nome}!${k}`).toBe(attese[`${f.nome}!${k}`] ?? g.celle[k]);
      for (const k of new Set([...Object.keys(f.stili), ...Object.keys(g.stili)])) expect(senzaBasso(f.stili[k]), `stile ${f.nome}!${k}`).toEqual(senzaBasso(g.stili[k]));
      for (const campo of ['larghezze', 'altezze', 'unioni', 'righeNascoste', 'colonneNascoste', 'colore', 'nascosto', 'pagina'] as const) expect(f[campo], `${f.nome} ${campo}`).toEqual(g[campo]);
      expect(f.commenti?.map((c) => [c.riga, c.colonna, c.testo])).toEqual(g.commenti?.map((c) => [c.riga, c.colonna, c.testo]));
    }
    expect(a.fogli[0].colore).toBe('#3366ff');
    expect(a.fogli[0].stili.C1?.link).toBe('https://www.example.com/pagina?a=1');
  });

  test('le formule importate danno gli stessi risultati di LibreOffice', () => {
    const calcolato = scambioConValoriCalcolati(documentoDaScambio(xls().scambio)).fogli.find((f) => f.nome === 'Formule e calcoli')!;
    // tipo del risultato in LibreOffice: 1 numero (anche vero/falso), 2 testo, 4 errore
    const lo = JSON.parse(fs.readFileSync(`${CARTELLA_PROVA}/risultati-libreoffice.json`, 'utf8')) as Record<string, { formula: string; valore: number; testo: string; tipo: number }>;
    // NORMDIST (vecchio nome di Excel) e l'unione di intervalli il motore non li conosce ancora; F26 e F62 LibreOffice li scrive già come errore; F41 dipende dall'ora
    const escluse = new Set(['F26', 'F41', 'F57', 'F62', 'F63']);
    let controllate = 0;
    for (const [k, v] of Object.entries(lo)) {
      if (escluse.has(k)) continue;
      const mio = calcolato.celle[k] ?? '';
      // LibreOffice formatta i testi alla maniera italiana (10,00): si confrontano con il punto
      if (v.tipo === 4) expect(mio, `${k} ${v.formula}`).toMatch(/^#/);
      else if (v.tipo === 2) expect(mio.replace(/,/g, '.'), `${k} ${v.formula}`).toBe(v.testo.replace(/,/g, '.'));
      else if (mio === 'TRUE' || mio === 'FALSE') expect(mio === 'TRUE' ? 1 : 0, `${k} ${v.formula}`).toBe(v.valore);
      else expect(Number(mio), `${k} ${v.formula}`).toBeCloseTo(v.valore, 9);
      controllate++;
    }
    expect(controllate).toBeGreaterThan(60);
  });
});

// i pezzi degli aiuti che servono solo qui
void unisci;
