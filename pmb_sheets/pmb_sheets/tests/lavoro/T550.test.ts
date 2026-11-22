// T550: file .xls delle versioni prima di Excel 97 (Excel 2.x, 3.0, 4.0, 5.0/95), file .xls protetti da password (RC4 e RC4 CryptoAPI),
// funzioni di hash della decifratura (comune/src/formati/cifratura-office.ts), «centra sulle colonne» che diventa un'unione.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chiaveRc4, flussoRc4, md5, sha1, PASSWORD_PREDEFINITA_EXCEL } from '@comune/formati/cifratura-office';
import { leggiXls, eFoglioExcelVecchio } from '../../src/formati/xls-leggi';
import { importa } from '../../src/formati/file';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { cellKey, createSheetStyles, resolveCellStyle } from '../../src/sheet/styles';
import { leggiCfb } from '@comune/formati/cfb';
import { creaCfb, creaXls, record, cella, u16, u32, f64, testo8, unisci } from './aiuti-xls';

const byte8 = (s: string): number[] => [...s].map((c) => (c === 'à' ? 0xe0 : c === '€' ? 0x80 : c.charCodeAt(0)));
const txt8 = (s: string): number[] => [s.length, ...byte8(s)];
const txt16b = (s: string): number[] => [...u16(s.length), ...byte8(s)];

describe('funzioni della decifratura', () => {
  test('MD5, SHA-1 e RC4 danno gli stessi risultati delle implementazioni di riferimento', () => {
    for (const s of ['', 'abc', 'VelvetSweatshop', 'x'.repeat(1000), 'àèìòù €']) {
      const b = new TextEncoder().encode(s);
      expect(Buffer.from(md5(b)).toString('hex')).toBe(createHash('md5').update(b).digest('hex'));
      expect(Buffer.from(sha1(b)).toString('hex')).toBe(createHash('sha1').update(b).digest('hex'));
    }
    // vettore classico di RC4: chiave «Key», testo «Plaintext»
    const testo = new TextEncoder().encode('Plaintext');
    const flusso = flussoRc4(new TextEncoder().encode('Key'), testo.length);
    expect(Buffer.from(testo.map((x, i) => x ^ flusso[i])).toString('hex')).toBe('bbf316e8d940af0ad3');
  });
});

describe('file .xls protetti', () => {
  test('un file protetto da LibreOffice con una password si apre con quella password e non con un\'altra', () => {
    const b = new Uint8Array(fs.readFileSync('tests/file-prova/xls/prova-password.xls'));
    const chiaro = leggiXls(new Uint8Array(fs.readFileSync('tests/file-prova/xls/prova.xls'))).scambio;
    const aperto = leggiXls(b, 'p.xls', 'segreta').scambio;
    expect(aperto.fogli.map((f) => f.celle)).toEqual(chiaro.fogli.map((f) => f.celle));
    expect(aperto.fogli[0].stili).toEqual(chiaro.fogli[0].stili);
    expect(() => leggiXls(b, 'p.xls', 'sbagliata')).toThrow(/protetto da password/);
    expect(() => leggiXls(b)).toThrow(/protetto da password/);
  });

  test('la password «di sola lettura» di Excel apre il file da sola', () => {
    // un file cifrato RC4 (Office 97/2000) con la password predefinita, costruito come lo scrive Excel
    const pw = new Uint8Array([...PASSWORD_PREDEFINITA_EXCEL].flatMap((c) => [c.charCodeAt(0), 0]));
    const sale = Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 3);
    const h0 = md5(pw).subarray(0, 5);
    const ripetuto = unisci(...Array.from({ length: 16 }, () => unisci(h0, sale)));
    const h1 = md5(ripetuto).subarray(0, 5);
    const chiave = (b: number): Uint8Array => md5(unisci(h1, u32(b)));
    const verificatore = Uint8Array.from({ length: 16 }, (_, i) => 200 - i);
    const k0 = flussoRc4(chiave(0), 32);
    const cifrati = unisci(verificatore, md5(verificatore)).map((x, i) => x ^ k0[i]);
    const filepassDati = unisci(u16(1), u16(1), u16(1), sale, cifrati);
    expect(chiaveRc4(filepassDati.subarray(2), PASSWORD_PREDEFINITA_EXCEL)).not.toBeNull();
    expect(chiaveRc4(filepassDati.subarray(2), 'altra')).toBeNull();
    // il flusso: BOF e FILEPASS in chiaro, poi i dati dei record cifrati a blocchi di 1024 byte dall'inizio del flusso
    const globali = [record(0x002f, filepassDati), record(0x0031, u16(200), u16(0), u16(0x7fff), u16(400), u16(0), [0, 0, 0, 0], testo8('Arial'))];
    const chiaro = creaXls(globali, [{ nome: 'Dati', record: [record(0x0203, cella(0, 0), f64(42)), record(0x0204, cella(1, 0), u16(5), [0], [...'segre'].map((c) => c.charCodeAt(0)))] }]);
    const w = leggiCfbFlusso(chiaro);
    const cifrato = w.slice();
    let p = 0, dopo = false;
    while (p + 4 <= w.length) {
      const tipo = w[p] | (w[p + 1] << 8), lun = w[p + 2] | (w[p + 3] << 8);
      if (dopo && tipo !== 0x0809) {
        for (let i = (tipo === 0x0085 ? p + 8 : p + 4); i < p + 4 + lun; i++) {
          const blocco = Math.floor(i / 1024);
          cifrato[i] = w[i] ^ flussoRc4(chiave(blocco), (i % 1024) + 1)[i % 1024];
        }
      }
      if (tipo === 0x002f) dopo = true;
      p += 4 + lun;
    }
    const f = leggiXls(creaCfb([['Workbook', cifrato]])).scambio.fogli[0];
    expect(f.nome).toBe('Dati');
    expect(f.celle).toEqual({ A1: '42', A2: 'segre' });
  });
});

/** Il flusso Workbook di un file composto creato dagli aiuti, riletto con il lettore vero. */
const leggiCfbFlusso = (b: Uint8Array): Uint8Array => leggiCfb(b).flusso('Workbook')!;

describe('Excel 5.0/95', () => {
  test('fogli, testi da un byte nella codifica del file, stili, formule con riferimenti di Excel 5, commenti', () => {
    const bof = record(0x0809, u16(0x0500), u16(0x0005), u16(0), u16(0));
    const bofFoglio = record(0x0809, u16(0x0500), u16(0x0010), u16(0), u16(0));
    const eof = record(0x000a);
    const font = (nome: string, peso: number): Uint8Array => record(0x0031, u16(200), u16(0), u16(0x7fff), u16(peso), u16(0), [0, 0, 0, 0], txt8(nome));
    const xf = (fontIdx: number, fmt: number, all = 0x20): Uint8Array => record(0x00e0, u16(fontIdx), u16(fmt), u16(1), u16(all), u32(0), u32(0));
    const formula = (r: number, c: number, valore: number, gettoni: number[]): Uint8Array => record(0x0006, cella(r, c), f64(valore), u16(0), u32(0), u16(gettoni.length), gettoni);
    const fogli = [
      unisci(bofFoglio,
        record(0x0204, cella(0, 0, 0), txt16b('Città €')), record(0x0203, cella(1, 0, 1), f64(10)), record(0x0203, cella(2, 0, 2), f64(2.5)),
        // A2*2 con il riferimento di Excel 5 (riga con i segni, colonna in un byte) e SUM su un altro foglio con il riferimento 3D di Excel 5
        formula(3, 0, 20, [0x44, ...u16(0xc000 | 1), 0, 0x1e, ...u16(2), 0x05]),
        formula(4, 0, 7, [0x3b, ...u16(0xffff), 0, 0, 0, 0, 0, 0, 0, 0, ...u16(1), ...u16(1), ...u16(0xc000), ...u16(0xc001), 0, 0, 0x42, 1, ...u16(4)]),
        record(0x001c, u16(0), u16(0), txt16b('nota vecchia')), eof),
      unisci(bofFoglio, record(0x0203, cella(0, 0, 1), f64(3)), record(0x0203, cella(1, 0, 1), f64(4)), eof),
    ];
    const bs = (nome: string, pos: number): Uint8Array => record(0x0085, u32(pos), [0, 0], txt8(nome));
    const globali = [record(0x0042, u16(1252)), font('Arial', 400), font('Arial', 700), font('Arial', 400), font('Arial', 400), record(0x041e, u16(164), txt8('0.0')), xf(0, 0), xf(1, 0), xf(0, 164)];
    let lunghezza = bof.length + globali.reduce((n, g) => n + g.length, 0) + bs('Uno', 0).length + bs('Secondo foglio', 0).length + eof.length;
    const pos = fogli.map((x) => { const p = lunghezza; lunghezza += x.length; return p; });
    const flusso = unisci(bof, ...globali, bs('Uno', pos[0]), bs('Secondo foglio', pos[1]), eof, ...fogli);
    const { scambio, avvisi } = leggiXls(creaCfb([['Book', flusso]]));
    expect(scambio.fogli.map((x) => x.nome)).toEqual(['Uno', 'Secondo foglio']);
    const f = scambio.fogli[0];
    expect(f.celle).toEqual({ A1: 'Città €', A2: '10', A3: '2.5', A4: '=A2*2', A5: "=SUM('Secondo foglio'!A1:A2)" });
    expect(f.stili.A2).toEqual({ bold: true });
    expect(f.stili.A3).toEqual({ numFmt: '0.0' });
    expect(f.commenti).toEqual([{ riga: 1, colonna: 1, testo: 'nota vecchia' }]);
    expect(avvisi[0]).toMatch(/vecchia versione di Excel/);
  });
});

describe('Excel 2.x, 3.0 e 4.0 (un foglio solo, senza contenitore)', () => {
  test('Excel 4.0: caratteri, stili, formati in ordine, formule con le funzioni da 2 byte, larghezze in proporzione al testo normale', () => {
    const font4 = (punti: number, ind: number): Uint8Array => record(0x0231, u16(punti * 20), u16(ind), u16(0x7fff), txt8('Arial'));
    const xf4 = (fontIdx: number, fmt: number, all = 0x20, area = 0): Uint8Array => record(0x0443, [fontIdx, fmt], u16(1), [all, area ? 0x40 : 0], u16(area), u32(0));
    const b = unisci(
      record(0x0409, u16(0), u16(0x0010), u16(0)),
      font4(12, 0), font4(12, 1), font4(12, 0), font4(12, 0), font4(10, 2),
      record(0x041e, u16(0), txt8('General')), record(0x041e, u16(0), txt8('0.00')),
      xf4(0, 0), xf4(1, 0, 0x22), xf4(5, 1), xf4(0, 0, 0x20, 1 | (13 << 6)),
      record(0x007d, u16(0), u16(0), u16(10 * 256), u16(0), u16(0), u16(0)),
      record(0x0204, cella(0, 0, 1), txt16b('Totale')),
      record(0x0203, cella(1, 0, 2), f64(1.5)), record(0x0203, cella(2, 0, 3), f64(2.5)),
      // SUM(A2:A3) con l'area di Excel 4 e la funzione variabile con l'indice da 2 byte
      record(0x0406, cella(3, 0, 0), f64(4), u16(0), u16(11), [0x25, ...u16(0xc000 | 1), ...u16(0xc000 | 2), 0, 0, 0x42, 1, ...u16(4)]),
      record(0x000a),
    );
    expect(eFoglioExcelVecchio(b)).toBe(true);
    const { scambio } = leggiXls(b, 'C:\\archivio\\Bilancio 1994.xls');
    const f = scambio.fogli[0];
    expect(f.nome).toBe('Bilancio 1994');
    expect(f.celle).toEqual({ A1: 'Totale', A2: '1.5', A3: '2.5', A4: '=SUM(A2:A3)' });
    expect(f.stili.A1).toEqual({ bold: true, hAlign: 'center' });
    expect(f.stili.A2).toEqual({ italic: true, fontSize: 10, numFmt: '0.00' });
    expect(f.stili.A3).toEqual({ fill: '#ffff00' });
    // 10 caratteri con il testo normale a 12 punti: 7 × 1,2 pixel per carattere
    expect(f.larghezze[1]).toBe(Math.round(10 * 7 * 1.2 + 5));
  });

  test('Excel 3.0: stili da 12 byte e funzioni con l\'indice da un byte', () => {
    const b = unisci(
      record(0x0209, u16(0), u16(0x0010)),
      record(0x0231, u16(200), u16(0), u16(0x7fff), txt8('Arial')),
      record(0x0243, [0, 0, 1, 0], u16(3), u16(0), u32(0)),
      record(0x0203, cella(0, 0, 0), f64(1.25)),
      record(0x0206, cella(1, 0, 0), f64(1), u16(0), u16(14), [0x44, ...u16(0xc000), 0, 0x1e, ...u16(0), 0x41, 27, 0x1e, ...u16(1), 0x03]),
      record(0x000a),
    );
    const f = leggiXls(b, 'vecchio.xls').scambio.fogli[0];
    expect(f.celle).toEqual({ A1: '1.25', A2: '=ROUND(A1,0)+1' });
    expect(f.stili.A1).toEqual({ hAlign: 'right' });
  });

  test('Excel 2.x: celle con gli attributi in 3 byte (carattere, allineamento, bordi)', () => {
    const attr = (font: number, all = 0, bordi = 0): number[] => [0, font << 6, all | bordi];
    const b = unisci(
      record(0x0009, u16(2), u16(0x0010)),
      record(0x0031, u16(200), u16(0), txt8('Helv')), record(0x0031, u16(200), u16(1), txt8('Helv')),
      record(0x0002, u16(0), u16(0), attr(1), u16(7)),
      record(0x0003, u16(1), u16(0), attr(0, 3, 0x40), f64(0.5)),
      record(0x0004, u16(2), u16(0), attr(0), txt8('ciao')),
      record(0x0006, u16(3), u16(0), attr(0), f64(7.5), [0], [9], [0x44, ...u16(0xc000), 0, 0x44, ...u16(0xc001), 0, 0x03]),
      record(0x000a),
    );
    const f = leggiXls(b, 'x.xls').scambio.fogli[0];
    expect(f.celle).toEqual({ A1: '7', A2: '0.5', A3: 'ciao', A4: '=A1+A2' });
    expect(f.stili.A1).toEqual({ bold: true });
    expect(f.stili.A2).toEqual({ hAlign: 'right', borders: { bottom: { style: 'thin', color: '#000000' } } });
  });

  test('un vero foglio di Excel 4.0 (tabella pubblica dell\'IRS, 99 formule): le stesse celle della conversione di LibreOffice', async () => {
    const b = new Uint8Array(fs.readFileSync('tests/file-prova/xls/irs-excel4.xls'));
    expect(eFoglioExcelVecchio(b)).toBe(true);
    const a = leggiXls(b, 'irs-excel4.xls').scambio.fogli[0];
    const g = (await leggiXlsx(new Uint8Array(fs.readFileSync('tests/file-prova/xls/irs-excel4.xlsx')))).scambio.fogli[0];
    expect(a.nome).toBe('irs-excel4');
    const chiavi = new Set([...Object.keys(a.celle), ...Object.keys(g.celle)]);
    let formule = 0;
    for (const k of chiavi) {
      const x = a.celle[k], y = g.celle[k];
      if (x?.startsWith('=')) formule++;
      if (x !== undefined && y !== undefined && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) expect(Number(x), k).toBeCloseTo(Number(y), 9);
      else expect(x?.replace(/^'/, ''), k).toBe(y);
    }
    expect(formule).toBe(99);
    // le larghezze sono in caratteri del testo normale (qui a 10 punti): come quelle di LibreOffice, al pixel
    for (const [k, w] of Object.entries(g.larghezze)) expect(Math.abs((a.larghezze[Number(k)] ?? 0) - w), `colonna ${k}`).toBeLessThanOrEqual(1);
  });

  test('si aprono da importa() anche senza l\'estensione giusta, e un file a caso non passa per un Excel vecchio', async () => {
    const b = unisci(record(0x0409, u16(0), u16(0x0010), u16(0)), record(0x0231, u16(200), u16(0), u16(0x7fff), txt8('Arial')), record(0x0203, cella(0, 0, 0), f64(9)), record(0x000a));
    const r = await importa(b, 'tabella.dat');
    expect(r.soloLettura).toBe(true);
    expect(r.dati.workbookJson).toContain('"A1": "9"');
    expect(eFoglioExcelVecchio(new TextEncoder().encode('\t\x04 testo qualunque'))).toBe(false);
  });
});

describe('lo stile composto di riga, colonna e cella', () => {
  test('si legge senza aggiungere stili al documento (un .xls appena aperto non risulta «modificato»)', () => {
    const st = createSheetStyles();
    st.rowStyles.set(2, st.registry.register({ fontSize: 7 }));
    st.colStyles.set(3, st.registry.register({ borders: { right: { style: 'thin', color: '#000000' } } }));
    st.cellStyles.set(cellKey(2, 3), st.registry.register({ vAlign: 'middle' }));
    const prima = st.registry.count;
    expect(resolveCellStyle(2, 3, st)).toEqual({ fontSize: 7, vAlign: 'middle', borders: { right: { style: 'thin', color: '#000000' } } });
    expect(resolveCellStyle(2, 4, st)).toEqual({ fontSize: 7 });
    expect(st.registry.count).toBe(prima);
  });
});

describe('centra sulle colonne', () => {
  test('una cella piena seguita da celle vuote «centrate sulle colonne» diventa un\'unione centrata', () => {
    const font = record(0x0031, u16(200), u16(0), u16(0x7fff), u16(400), u16(0), [0, 0, 0, 0], testo8('Arial'));
    const xf = (all: number): Uint8Array => record(0x00e0, u16(0), u16(0), u16(0), [all, 0, 0, 0], u32(0), u32(0), u16(64));
    const b = creaXls([font, xf(0x20), xf(0x26)], [{ nome: 'T', record: [record(0x0204, cella(0, 1, 1), u16(6), [0], [...'Titolo'].map((c) => c.charCodeAt(0))), record(0x00be, u16(0), u16(2), u16(1), u16(1), u16(1), u16(4)), record(0x0201, cella(0, 6, 1))] }]);
    const f = leggiXls(b).scambio.fogli[0];
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 1, startCol: 2, endCol: 5 }]);
    expect(f.stili.B1).toEqual({ hAlign: 'center' });
  });
});
