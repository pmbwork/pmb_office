/**
 * Stili di cella pronti (Formato › Stili di cella), con gli stessi colori degli stili di Excel e di Calc: Buono, Cattivo, Neutro,
 * titoli, Totale, Nota, Input, Output, Calcolo... Si applicano come formato delle celle (carattere, riempimento, bordi): nei file restano
 * come formato, non come stile con il nome. «Normale» toglie tutto quello che gli stili mettono. Modulo puro.
 */
import type { BorderSet, CellStyle } from './styles';

export interface StileCella { id: string; nome: string; stile: Partial<CellStyle> }

const tutti = (style: 'thin' | 'medium', color: string): BorderSet => ({ top: { style, color }, bottom: { style, color }, left: { style, color }, right: { style, color } });
/** I bordi dati e gli altri lati senza bordo (i bordi si fondono con quelli che c'erano: i lati non detti si tolgono così). */
const bordi = (b: BorderSet): BorderSet => ({ top: { style: 'none', color: 'auto' }, bottom: { style: 'none', color: 'auto' }, left: { style: 'none', color: 'auto' }, right: { style: 'none', color: 'auto' }, ...b });
/** Le proprietà che ogni stile imposta: undefined le toglie (così uno stile ne sostituisce un altro invece di mescolarsi). */
const BASE: Partial<CellStyle> = { bold: undefined, italic: undefined, fontSize: undefined, color: undefined, fill: undefined, borders: undefined };

export const STILI_CELLA: StileCella[] = [
  { id: 'normale', nome: 'Normale', stile: { ...BASE } },
  { id: 'buono', nome: 'Buono', stile: { ...BASE, fill: '#c6efce', color: '#006100' } },
  { id: 'cattivo', nome: 'Cattivo', stile: { ...BASE, fill: '#ffc7ce', color: '#9c0006' } },
  { id: 'neutro', nome: 'Neutro', stile: { ...BASE, fill: '#ffeb9c', color: '#9c5700' } },
  { id: 'titolo', nome: 'Titolo', stile: { ...BASE, fontSize: 18, color: '#44546a' } },
  { id: 'titolo-1', nome: 'Titolo 1', stile: { ...BASE, bold: true, fontSize: 15, color: '#44546a', borders: bordi({ bottom: { style: 'medium', color: '#4472c4' } }) } },
  { id: 'titolo-2', nome: 'Titolo 2', stile: { ...BASE, bold: true, fontSize: 13, color: '#44546a', borders: bordi({ bottom: { style: 'medium', color: '#a2b8e1' } }) } },
  { id: 'titolo-3', nome: 'Titolo 3', stile: { ...BASE, bold: true, color: '#44546a', borders: bordi({ bottom: { style: 'thin', color: '#8ea9db' } }) } },
  { id: 'totale', nome: 'Totale', stile: { ...BASE, bold: true, borders: bordi({ top: { style: 'thin', color: '#4472c4' }, bottom: { style: 'medium', color: '#4472c4' } }) } },
  { id: 'nota', nome: 'Nota', stile: { ...BASE, fill: '#ffffcc', borders: tutti('thin', '#b2b2b2') } },
  { id: 'avviso', nome: 'Testo di avviso', stile: { ...BASE, color: '#ff0000' } },
  { id: 'esplicativo', nome: 'Testo esplicativo', stile: { ...BASE, italic: true, color: '#7f7f7f' } },
  { id: 'input', nome: 'Input', stile: { ...BASE, fill: '#ffcc99', color: '#3f3f76', borders: tutti('thin', '#7f7f7f') } },
  { id: 'output', nome: 'Output', stile: { ...BASE, bold: true, fill: '#f2f2f2', color: '#3f3f3f', borders: tutti('thin', '#3f3f3f') } },
  { id: 'calcolo', nome: 'Calcolo', stile: { ...BASE, bold: true, fill: '#f2f2f2', color: '#fa7d00', borders: tutti('thin', '#7f7f7f') } },
  { id: 'controllo', nome: 'Cella di controllo', stile: { ...BASE, bold: true, fill: '#a5a5a5', color: '#ffffff', borders: tutti('medium', '#3f3f3f') } },
];

export function stileCella(id: string): StileCella | undefined { return STILI_CELLA.find((s) => s.id === id); }
