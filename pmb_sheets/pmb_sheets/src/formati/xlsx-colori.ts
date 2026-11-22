// Colori dei file di Excel: oltre al colore scritto (rgb="FFRRGGBB") Excel usa quasi sempre i COLORI DEL TEMA (theme="6", con una sfumatura
// tint="0.4" = «accento 3, più chiaro 40%») e, nei file più vecchi, i COLORI A INDICE (indexed="22", la tavolozza classica di 64 colori).
// Prima del 0.2.16 pmb_sheets leggeva solo il colore scritto: le celle colorate con il tema risultavano bianche (segnalazione del 2026-11-22).
// Regole (ECMA-376 Office Open XML): il tema è l'elenco clrScheme di xl/theme/theme1.xml; l'indice del tema 0..3 scambia chiari e scuri
// (0 = lt1, 1 = dk1, 2 = lt2, 3 = dk2), poi 4..9 = accent1..6, 10 = hlink, 11 = folHlink. La sfumatura cambia solo la luminosità:
// tint < 0 scurisce (L × (1 + tint)), tint > 0 schiarisce (L × (1 − tint) + tint).
import type { NodoXml } from '@comune/formati/xml';

export interface Tavolozza { tema: string[]; indici: string[] }

/** La tavolozza classica di Excel (colori a indice 0..63). */
export const INDICI_EXCEL: readonly string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
].map((c) => `#${c.toLowerCase()}`);

/** Il tema di Office di serie (usato se il file non ha il suo). */
const TEMA_PREDEFINITO = ['#ffffff', '#000000', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646', '#0000ff', '#800080'];

const locale = (nome: string): string => nome.slice(nome.indexOf(':') + 1);
const figli = (n: NodoXml | undefined): NodoXml[] => (n ? n.figli.filter((f): f is NodoXml => typeof f !== 'string') : []);
function cerca(n: NodoXml | undefined, nome: string, profondita = 6): NodoXml | undefined {
  if (!n || profondita < 0) return undefined;
  for (const f of figli(n)) { if (locale(f.nome) === nome) return f; const t = cerca(f, nome, profondita - 1); if (t) return t; }
  return undefined;
}
const esadecimale = (v: string | undefined): string | undefined => (v && /^[0-9a-fA-F]{6}$/.test(v) ? `#${v.toLowerCase()}` : undefined);

/** La tavolozza di un file: il tema (xl/theme/theme1.xml) e i colori a indice (eventualmente cambiati in styles.xml, <colors><indexedColors>). */
export function leggiTavolozza(tema: NodoXml | undefined, stili: NodoXml | undefined): Tavolozza {
  const schema = cerca(tema, 'clrScheme');
  const colore = (nome: string, predefinito: string): string => {
    const voce = figli(schema).find((f) => locale(f.nome) === nome);
    const c = figli(voce)[0];
    return (c && (locale(c.nome) === 'srgbClr' ? esadecimale(c.attributi.val) : locale(c.nome) === 'sysClr' ? esadecimale(c.attributi.lastClr) : undefined)) ?? predefinito;
  };
  const nomi = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const temaColori = schema ? nomi.map((n, i) => colore(n, TEMA_PREDEFINITO[i]!)) : [...TEMA_PREDEFINITO];
  const indici = [...INDICI_EXCEL];
  const personali = figli(cerca(stili, 'indexedColors', 3)).filter((f) => locale(f.nome) === 'rgbColor');
  personali.slice(0, 64).forEach((r, i) => { const rgb = r.attributi.rgb; const c = rgb && /^[0-9a-fA-F]{8}$/.test(rgb) ? `#${rgb.slice(2).toLowerCase()}` : esadecimale(rgb); if (c) indici[i] = c; });
  return { tema: temaColori, indici };
}

/** Un colore con la sfumatura di Excel applicata alla luminosità (HSL). */
export function applicaTinta(colore: string, tinta: number): string {
  if (!Number.isFinite(tinta) || tinta === 0) return colore;
  const t = Math.max(-1, Math.min(1, tinta));
  const r = parseInt(colore.slice(1, 3), 16) / 255, g = parseInt(colore.slice(3, 5), 16) / 255, b = parseInt(colore.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = t < 0 ? l * (1 + t) : l * (1 - t) + t;
  const daTonalita = (p: number, q: number, x: number): number => { let k = x; if (k < 0) k += 1; if (k > 1) k -= 1; if (k < 1 / 6) return p + (q - p) * 6 * k; if (k < 1 / 2) return q; if (k < 2 / 3) return p + (q - p) * (2 / 3 - k) * 6; return p; };
  let rr = l, gg = l, bb = l;
  if (s !== 0) { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; rr = daTonalita(p, q, h + 1 / 3); gg = daTonalita(p, q, h); bb = daTonalita(p, q, h - 1 / 3); }
  const hex = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${hex(rr)}${hex(gg)}${hex(bb)}`;
}

/** Il colore di un elemento <color>, <fgColor>, <bgColor> di un file di Excel come "#rrggbb"; undefined se è «automatico» o sconosciuto. */
export function coloreExcel(n: NodoXml | undefined, tavolozza?: Tavolozza): string | undefined {
  if (!n) return undefined;
  const a = n.attributi;
  let base: string | undefined;
  if (a.rgb !== undefined && /^[0-9a-fA-F]{8}$/.test(a.rgb)) base = `#${a.rgb.slice(2).toLowerCase()}`;
  else if (a.rgb !== undefined && /^[0-9a-fA-F]{6}$/.test(a.rgb)) base = `#${a.rgb.toLowerCase()}`;
  else if (a.theme !== undefined && tavolozza) base = tavolozza.tema[Number(a.theme)];
  else if (a.indexed !== undefined && tavolozza) base = tavolozza.indici[Number(a.indexed)]; // 64 e 65 = colori di sistema «automatici»
  if (!base) return undefined;
  return a.tint !== undefined ? applicaTinta(base, Number(a.tint)) : base;
}
