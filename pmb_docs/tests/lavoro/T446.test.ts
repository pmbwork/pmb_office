// T446: difese contro file ostili (zip bomb, XML troppo annidato, entità inventate, PNG enormi, testo non valido verso la parte nativa).
import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, profonditaXml } from '@comune/formati/xml';
import { dimensioniPngRagionevoli, esportaDocx, importaDocx, PROFONDITA_XML_MASSIMA } from '../../src/formati/docx';
import { daTesto } from '../../src/modello/documento';
import { senzaSurrogatiSpaiati } from '../../src/editor/ortografia-nativa';

describe('T446: ZIP', () => {
  it('un archivio normale si legge ancora (compresso e non)', async () => {
    const dati = new TextEncoder().encode('ciao '.repeat(2000));
    const z = await scriviZip([{ nome: 'a.txt', dati }, { nome: 'b.txt', dati: new Uint8Array([1, 2, 3]), senzaCompressione: true }]);
    const letto = await leggiZip(z);
    expect(letto.get('a.txt')).toEqual(dati);
    expect(Array.from(letto.get('b.txt')!)).toEqual([1, 2, 3]);
  });
  it('un file che si espande più di quanto dichiarato viene rifiutato prima di riempire la memoria', async () => {
    const z = await scriviZip([{ nome: 'grande.bin', dati: new Uint8Array(2_000_000) }]); // compresso: poche migliaia di byte
    const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
    let centrale = -1;
    for (let i = 0; i + 4 <= z.length; i++) if (v.getUint32(i, true) === 0x02014b50) { centrale = i; break; }
    expect(centrale).toBeGreaterThan(0);
    v.setUint32(centrale + 24, 100, true); // la dimensione dichiarata diventa 100 byte
    await expect(leggiZip(z)).rejects.toThrow(/si espande più di quanto dichiarato/);
  });
  it('dimensione dichiarata giusta: nessun problema anche al limite', async () => {
    const dati = new Uint8Array(100_000);
    const letto = await leggiZip(await scriviZip([{ nome: 'x', dati }]));
    expect(letto.get('x')!.length).toBe(100_000);
  });
});

describe('T446: XML', () => {
  it('le entità sono solo le cinque proprie: nomi come constructor o toString non diventano testo', () => {
    expect(analizzaXml('<a>&amp;&lt;&gt;&quot;&apos;</a>').figli).toEqual(['&<>"\'']);
    for (const nome of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) expect(() => analizzaXml(`<a>&${nome};</a>`), nome).toThrow(/entità sconosciuta|carattere & non valido/);
  });
  it('il lettore XML regge annidamenti enormi (è iterativo) e la profondità si misura senza ricorsione', () => {
    const annida = (n: number): string => '<a>'.repeat(n) + 'x' + '</a>'.repeat(n);
    expect(profonditaXml(analizzaXml(annida(20_000)))).toBe(20_000);
    expect(profonditaXml(analizzaXml('<a><b/><b><c/></b></a>'))).toBe(3);
  });
  it('un .docx con elementi annidati oltre il limite viene rifiutato con un messaggio chiaro', async () => {
    const voci = await leggiZip(await esportaDocx(daTesto('x')));
    const niente = new TextDecoder().decode(voci.get('word/document.xml')!);
    const annida = (n: number): string => '<w:sdt>'.repeat(n) + '<w:p/>' + '</w:sdt>'.repeat(n);
    const ricostruisci = async (n: number): Promise<Uint8Array> => {
      const nuovo = new Map(voci);
      nuovo.set('word/document.xml', new TextEncoder().encode(niente.replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${annida(n)}$1`)));
      return scriviZip(Array.from(nuovo, ([nome, dati]) => ({ nome, dati })));
    };
    await expect(importaDocx(await ricostruisci(PROFONDITA_XML_MASSIMA + 10))).rejects.toThrow(/annidati troppo in profondità/);
    await expect(importaDocx(await ricostruisci(30))).resolves.toBeDefined();
  });
});

describe('T446: PNG e testo', () => {
  const png = (w: number, h: number): Uint8Array => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  it('misure dichiarate nell\'intestazione: ragionevoli sì, enormi o nulle no', () => {
    expect(dimensioniPngRagionevoli(png(800, 600))).toBe(true);
    expect(dimensioniPngRagionevoli(png(20000, 5000))).toBe(true);
    expect(dimensioniPngRagionevoli(png(60000, 60000))).toBe(false);
    expect(dimensioniPngRagionevoli(png(0, 10))).toBe(false);
    expect(dimensioniPngRagionevoli(png(20001, 1))).toBe(false);
    expect(dimensioniPngRagionevoli(png(15000, 15000))).toBe(false); // 225 milioni di punti
    expect(dimensioniPngRagionevoli(new Uint8Array(10))).toBe(false);
  });
  it('senzaSurrogatiSpaiati tiene la lunghezza e i caratteri validi, sostituisce solo i mezzi caratteri spaiati', () => {
    expect(senzaSurrogatiSpaiati('ciao')).toBe('ciao');
    expect(senzaSurrogatiSpaiati('a😀b')).toBe('a😀b'); // emoji intera: resta
    expect(senzaSurrogatiSpaiati('a\ud800b')).toBe('a�b');
    expect(senzaSurrogatiSpaiati('a\udc00b')).toBe('a�b');
    expect(senzaSurrogatiSpaiati('\ud800𐀀')).toBe('�𐀀');
    const s = 'x\ud800y\udfffz';
    expect(senzaSurrogatiSpaiati(s).length).toBe(s.length);
    expect(() => JSON.stringify(senzaSurrogatiSpaiati(s))).not.toThrow();
  });
});
