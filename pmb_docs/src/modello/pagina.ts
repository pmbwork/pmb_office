// La pagina del documento nei file: dalle misure scritte nel .docx (w:pgSz, w:pgMar) e nell'.odt (style:page-layout-properties) al formato,
// orientamento e margini di pmb_docs, e ritorno. Le misure sono in millimetri; i margini del modello in pixel a 96 punti per pollice. Modulo puro.
import { paginaPredefinita, type FormatoPagina, type PaginaDocumento } from './documento';

/** Larghezza e altezza della carta in verticale, in millimetri. */
export const CARTA_MM: Record<FormatoPagina, { w: number; h: number }> = {
  A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 }, A3: { w: 297, h: 420 }, A5: { w: 148, h: 210 },
};
const PX_PER_MM = 96 / 25.4;

/** La pagina da larghezza, altezza e margini in millimetri (il formato è quello più vicino); undefined se è quella predefinita o le misure non vanno. */
export function paginaDaMisure(wMm: number, hMm: number, alto: number, basso: number, sinistro: number, destro: number): PaginaDocumento | undefined {
  if (![wMm, hMm, alto, basso, sinistro, destro].every((x) => Number.isFinite(x) && x >= 0) || wMm < 50 || hMm < 50) return undefined;
  const o = wMm > hMm ? 'o' : 'v';
  const [cw, ch] = o === 'o' ? [hMm, wMm] : [wMm, hMm];
  let f: FormatoPagina = 'A4';
  let migliore = Infinity;
  for (const [nome, c] of Object.entries(CARTA_MM) as Array<[FormatoPagina, { w: number; h: number }]>) {
    const d = Math.abs(c.w - cw) + Math.abs(c.h - ch);
    if (d < migliore) { migliore = d; f = nome; }
  }
  const px = (mm: number): number => Math.min(600, Math.round(mm * PX_PER_MM));
  const p: PaginaDocumento = { f, o, ma: px(alto), mb: px(basso), ms: px(sinistro), md: px(destro) };
  return paginaPredefinita(p) ? undefined : p;
}

/** Le misure della pagina in millimetri (larghezza e altezza come stanno, cioè girate se orizzontale) e i margini. */
export function misurePagina(p: PaginaDocumento | undefined): { w: number; h: number; alto: number; basso: number; sinistro: number; destro: number } {
  const q = p ?? { f: 'A4', o: 'v', ma: 96, mb: 96, ms: 96, md: 96 };
  const c = CARTA_MM[q.f];
  const [w, h] = q.o === 'o' ? [c.h, c.w] : [c.w, c.h];
  const mm = (px: number): number => Math.round(px / PX_PER_MM * 100) / 100;
  return { w, h, alto: mm(q.ma), basso: mm(q.mb), sinistro: mm(q.ms), destro: mm(q.md) };
}
