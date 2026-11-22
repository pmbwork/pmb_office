// Aiuti dei test: costruiscono in memoria file composti e file .xls (BIFF8) piccoli, per provare il lettore caso per caso.
// Non fanno parte del programma. Seguono le stesse specifiche pubbliche ([MS-CFB], [MS-XLS]) del lettore.

type Parte = number[] | Uint8Array;

export const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
export const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
export const f64 = (n: number): number[] => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, n, true); return [...b]; };
export const unisci = (...parti: Parte[]): Uint8Array => {
  const out = new Uint8Array(parti.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
};
const largo = (s: string): boolean => [...s].some((c) => c.charCodeAt(0) > 0xff);
/** I caratteri di un testo: da 1 byte se bastano, altrimenti da 2. */
export const caratteri = (s: string, alti = largo(s)): number[] => (alti ? [...s].flatMap((c) => u16(c.charCodeAt(0))) : [...s].map((c) => c.charCodeAt(0)));
/** XLUnicodeString: lunghezza da 2 byte, indicatore, caratteri. */
export const testo16 = (s: string): number[] => [...u16(s.length), largo(s) ? 1 : 0, ...caratteri(s)];
/** ShortXLUnicodeString: lunghezza da 1 byte. */
export const testo8 = (s: string): number[] => [s.length, largo(s) ? 1 : 0, ...caratteri(s)];

export const record = (tipo: number, ...parti: Parte[]): Uint8Array => { const d = unisci(...parti); return unisci(u16(tipo), u16(d.length), d); };
export const cella = (r: number, c: number, xf = 0): number[] => [...u16(r), ...u16(c), ...u16(xf)];

export const BOF_CARTELLA = record(0x0809, u16(0x0600), u16(0x0005), u16(0), u16(0), u32(0), u32(0));
export const BOF_FOGLIO = record(0x0809, u16(0x0600), u16(0x0010), u16(0), u16(0), u32(0), u32(0));
export const EOF = record(0x000a);

export interface FoglioProva { nome: string; record: Uint8Array[]; stato?: number; tipo?: number }

/** Un flusso Workbook: i record della cartella, i fogli (BOUNDSHEET con la posizione giusta) e i record di ogni foglio. */
export function flussoWorkbook(globali: Uint8Array[], fogli: FoglioProva[]): Uint8Array {
  const corpoFogli = fogli.map((f) => unisci(BOF_FOGLIO, ...f.record, EOF));
  const boundsheet = (f: FoglioProva, pos: number): Uint8Array => record(0x0085, u32(pos), [f.stato ?? 0, f.tipo ?? 0], testo8(f.nome));
  let lunghezza = BOF_CARTELLA.length + globali.reduce((t, g) => t + g.length, 0) + fogli.reduce((t, f) => t + boundsheet(f, 0).length, 0) + EOF.length;
  const posizioni = corpoFogli.map((c) => { const p = lunghezza; lunghezza += c.length; return p; });
  return unisci(BOF_CARTELLA, ...globali, ...fogli.map((f, i) => boundsheet(f, posizioni[i])), EOF, ...corpoFogli);
}

export { creaCfb } from '../../../../comune/tests/aiuti-cfb';
import { creaCfb } from '../../../../comune/tests/aiuti-cfb';

/** Un file .xls completo: un file composto con il flusso Workbook. */
export const creaXls = (globali: Uint8Array[], fogli: FoglioProva[], altri: Array<[string, Uint8Array]> = []): Uint8Array =>
  creaCfb([['Workbook', flussoWorkbook(globali, fogli)], ...altri]);
