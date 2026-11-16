// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { crc32, scriviZip, leggiZip, type VoceZip } from '@comune/formati/zip';

const enc = new TextEncoder();
const dec = new TextDecoder();
const FIXTURE = 'UEsDBBQAAAAIAEB3XV0CpVbCEwAAACYCAAAJAAAAaGVsbG8udHh0S85MzFfIzc9LyVdIHmWOMrEzAVBLAwQUAAAAAAAAACEAAAAAAAAAAAAAAAAABAAAAGRpci9QSwMEFAAAAAAAQHddXXOMBSkAAQAAAAEAAAsAAABkaXIvYmluLmRhdAABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v9QSwMEFAAACAgAQHddXTNzWUISAAAA3AAAAAkAAADDqC/DvC50eHQ7vODwisNrDm86vFPh8HBjAgBQSwMEFAAAAAgAQHddXQAAAAACAAAAAAAAAAkAAAB2dW90by50eHQDAFBLAQIUABQAAAAIAEB3XV0CpVbCEwAAACYCAAAJAAAAAAAAAAAAAACAAQAAAABoZWxsby50eHRQSwECFAAUAAAAAAAAACEAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAgAE6AAAAZGlyL1BLAQIUABQAAAAAAEB3XV1zjAUpAAEAAAABAAALAAAAAAAAAAAAAACAAVwAAABkaXIvYmluLmRhdFBLAQIUABQAAAgIAEB3XV0zc1lCEgAAANwAAAAJAAAAAAAAAAAAAACAAYUBAADDqC/DvC50eHRQSwECFAAUAAAACABAd11dAAAAAAIAAAAAAAAACQAAAAAAAAAAAAAAgAG+AQAAdnVvdG8udHh0UEsFBgAAAAAFAAUAEAEAAOcBAAAAAA=='; // archivio creato con il modulo zipfile di Python: deflate, memorizzato, cartella, nome con accenti, file vuoto

function daBase64(s: string): Uint8Array { return new Uint8Array(Buffer.from(s, 'base64')); }
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
const uguali = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

describe('T050: crc32', () => {
  it('valori noti', () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(enc.encode('a'))).toBe(0xe8b7be43);
    expect(crc32(enc.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('T050: leggere archivi fatti da altri programmi', () => {
  it('archivio di Python: file compressi, file memorizzati, nome con accenti, file vuoto, cartelle ignorate', async () => {
    const m = await leggiZip(daBase64(FIXTURE));
    expect(Array.from(m.keys())).toEqual(['hello.txt', 'dir/bin.dat', 'è/ü.txt', 'vuoto.txt']);
    expect(dec.decode(m.get('hello.txt')!)).toBe('ciao mondo '.repeat(50));
    expect(uguali(m.get('dir/bin.dat')!, new Uint8Array(Array.from({ length: 256 }, (_, i) => i)))).toBe(true);
    expect(dec.decode(m.get('è/ü.txt')!)).toBe('àèìòù '.repeat(20));
    expect(m.get('vuoto.txt')!.length).toBe(0);
  });

  it('i dati letti non dipendono dall\'archivio d\'ingresso', async () => {
    const z = daBase64(FIXTURE);
    const m = await leggiZip(z);
    const copia = Uint8Array.from(m.get('dir/bin.dat')!);
    z.fill(0);
    expect(uguali(m.get('dir/bin.dat')!, copia)).toBe(true);
  });
});

describe('T050: scrivere e rileggere', () => {
  it('andata e ritorno: testo, binari, file vuoto, nomi con accenti e cartelle di percorso', async () => {
    const binario = new Uint8Array(70000);
    const r = generatore(5);
    for (let i = 0; i < binario.length; i++) binario[i] = Math.floor(r() * 256);
    const voci: VoceZip[] = [
      { nome: '[Content_Types].xml', dati: enc.encode('<x>' + 'abc'.repeat(1000) + '</x>') },
      { nome: 'word/document.xml', dati: enc.encode('<w:document>è€😀</w:document>') },
      { nome: 'bin/casuale.dat', dati: binario },
      { nome: 'vuoto', dati: new Uint8Array(0) },
      { nome: 'città/ü.txt', dati: enc.encode('ciao') },
    ];
    const z = await scriviZip(voci);
    const m = await leggiZip(z);
    expect(Array.from(m.keys())).toEqual(voci.map((v) => v.nome));
    for (const v of voci) expect(uguali(m.get(v.nome)!, v.dati), v.nome).toBe(true);
  });

  it('il testo ripetuto viene davvero compresso, i dati casuali no (restano memorizzati)', async () => {
    const testo = enc.encode('abcdefgh'.repeat(5000));
    const z = await scriviZip([{ nome: 'a.txt', dati: testo }]);
    expect(z.length).toBeLessThan(testo.length / 5);
    const r = generatore(9);
    const caso = new Uint8Array(5000).map(() => Math.floor(r() * 256));
    const z2 = await scriviZip([{ nome: 'b.dat', dati: caso }]);
    expect(z2.length).toBeLessThan(caso.length + 200);
    expect(z2.length).toBeGreaterThanOrEqual(caso.length);
  });

  it('stesso contenuto, stessi byte; gli ingressi non vengono toccati', async () => {
    const dati = enc.encode('ciao '.repeat(100));
    const copia = Uint8Array.from(dati);
    const a = await scriviZip([{ nome: 'x.txt', dati }]);
    const b = await scriviZip([{ nome: 'x.txt', dati }]);
    expect(uguali(a, b)).toBe(true);
    expect(uguali(dati, copia)).toBe(true);
  });

  it('archivio vuoto', async () => {
    const z = await scriviZip([]);
    expect(z.length).toBe(22);
    expect((await leggiZip(z)).size).toBe(0);
  });

  it('nomi ripetuti o vuoti vengono rifiutati', async () => {
    await expect(scriviZip([{ nome: 'a', dati: enc.encode('1') }, { nome: 'a', dati: enc.encode('2') }])).rejects.toThrow(/ZIP/);
    await expect(scriviZip([{ nome: '', dati: enc.encode('1') }])).rejects.toThrow(/ZIP/);
  });

  it('prova casuale: 120 archivi con file di tipo e dimensione diversi tornano uguali', async () => {
    for (let seme = 1; seme <= 120; seme++) {
      const r = generatore(seme * 31);
      const n = 1 + Math.floor(r() * 6);
      const voci: VoceZip[] = [];
      for (let i = 0; i < n; i++) {
        const lung = Math.floor(r() * (r() < 0.2 ? 20000 : 300));
        const modo = Math.floor(r() * 3);
        const dati = new Uint8Array(lung);
        for (let k = 0; k < lung; k++) dati[k] = modo === 0 ? Math.floor(r() * 256) : modo === 1 ? 65 + (k % 7) : 32 + Math.floor(r() * 4);
        voci.push({ nome: `d${Math.floor(r() * 3)}/f${i}.${modo}`, dati });
      }
      const m = await leggiZip(await scriviZip(voci));
      expect(m.size, `seme ${seme}`).toBe(voci.length);
      for (const v of voci) expect(uguali(m.get(v.nome)!, v.dati), `seme ${seme} ${v.nome}`).toBe(true);
    }
  });
});

describe('T050: archivi sbagliati', () => {
  it('non è uno ZIP, è troncato o vuoto', async () => {
    await expect(leggiZip(new Uint8Array(0))).rejects.toThrow(/ZIP/);
    await expect(leggiZip(enc.encode('questo non è un archivio, ma è abbastanza lungo'))).rejects.toThrow(/ZIP/);
    const z = await scriviZip([{ nome: 'a.txt', dati: enc.encode('ciao '.repeat(100)) }]);
    await expect(leggiZip(z.subarray(0, z.length - 10))).rejects.toThrow(/ZIP/);
    await expect(leggiZip(z.subarray(0, 40))).rejects.toThrow(/ZIP/);
  });

  it('dati danneggiati: il controllo CRC li scopre sia memorizzati sia compressi', async () => {
    const r = generatore(2);
    const caso = new Uint8Array(300).map(() => Math.floor(r() * 256));
    const memo = await scriviZip([{ nome: 'm.dat', dati: caso }]);
    const rotto = Uint8Array.from(memo);
    rotto[30 + 5 + 100] ^= 0xff;
    await expect(leggiZip(rotto)).rejects.toThrow(/ZIP/);
    const comp = await scriviZip([{ nome: 'c.txt', dati: enc.encode('ciao mondo '.repeat(200)) }]);
    const rotto2 = Uint8Array.from(comp);
    rotto2[30 + 5 + 4] ^= 0x55;
    await expect(leggiZip(rotto2)).rejects.toThrow(/ZIP/);
  });

  it('cifrato, metodo non supportato, ZIP64 e archivio troppo grande', async () => {
    const z = await scriviZip([{ nome: 'a.txt', dati: enc.encode('ciao') }]);
    const v = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
    const centrale = z.length - 22 - (46 + 5);
    const cifrato = Uint8Array.from(z);
    v(cifrato).setUint16(centrale + 8, 0x0801, true);
    await expect(leggiZip(cifrato)).rejects.toThrow(/cifrato/);
    const metodo = Uint8Array.from(z);
    v(metodo).setUint16(centrale + 10, 12, true);
    await expect(leggiZip(metodo)).rejects.toThrow(/metodo/);
    const z64 = Uint8Array.from(z);
    v(z64).setUint16(z.length - 22 + 10, 0xffff, true);
    await expect(leggiZip(z64)).rejects.toThrow(/ZIP64/);
    await expect(leggiZip(z, { massimo: 3 })).rejects.toThrow(/troppo grande/);
  });
});
