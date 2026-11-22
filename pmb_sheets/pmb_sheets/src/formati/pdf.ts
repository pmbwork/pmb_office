// Esportazione di un foglio di pmb_sheets in PDF 1.4 vettoriale, scritta per pmb_office.
// Usa lo stesso piano della stampa (piano-stampa.ts): impostazione di pagina del foglio (carta, orientamento, margini, scala o adatta a pagine,
// area di stampa, righe e colonne ripetute, intestazione e piè di pagina, griglia, intestazioni di riga e colonna), più pagine,
// valori calcolati e formattati come si vedono nel foglio. Caratteri standard Helvetica (WinAnsi). Modulo puro.
import type { Scambio } from './scambio';
import { foglioVuoto, indirizzoCella } from './scambio';
import { stileEffettivo } from './stampa';
import { pianoDiStampa, testoDaStampare, valoreDaScambio, lettereColonne, type PaginaPiano, type PianoStampa } from './piano-stampa';
import { ALTEZZA_LETTERE_COLONNA, LARGHEZZA_NUMERI_RIGA } from '../sheet/pagina';

const PT_PER_MM = 72 / 25.4;
const PT_PER_PX = 0.75;
/** corpo del testo delle celle senza un corpo scelto (13 px come nel foglio) */
const CORPO_PREDEFINITO_PX = 13;
const CORPO_MARGINE_PT = 9;

function escapeTestoPdf(testo: string): string {
  let out = '';
  for (const c of testo) {
    const code = c.codePointAt(0) ?? 63;
    if (c === '(') out += '\\(';
    else if (c === ')') out += '\\)';
    else if (c === '\\') out += '\\\\';
    else if (code === 8364) out += '\\200'; // €
    else if (code === 8211) out += '\\226'; // –
    else if (code === 8212) out += '\\227'; // —
    else if (code === 8216) out += '\\221';
    else if (code === 8217) out += '\\222';
    else if (code === 8220) out += '\\223';
    else if (code === 8221) out += '\\224';
    else if (code === 8230) out += '\\205'; // …
    else if (code >= 32 && code < 127) out += c;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
    else if (code === 9 || code === 10) out += ' ';
    else out += '?';
  }
  return out;
}

function colore(css: string | undefined): [number, number, number] | null {
  if (!css) return null;
  const m = /#([0-9a-fA-F]{6})/.exec(css);
  if (!m) return null;
  const h = m[1];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
const n2 = (x: number): string => (Math.round(x * 100) / 100).toString();
const rgb = (c: [number, number, number]): string => c.map((x) => n2(x)).join(' ');
/** Larghezza stimata di un testo in Helvetica (media dei caratteri). */
const stimaLarghezza = (t: string, corpo: number): number => [...t].length * corpo * 0.52;

/** I comandi di disegno di una pagina. */
function disegnaPagina(piano: PianoStampa, pg: PaginaPiano): string[] {
  const H = piano.carta.altezza * PT_PER_MM;
  const W = piano.carta.larghezza * PT_PER_MM;
  const s = piano.scala;
  const m = piano.margini;
  const out: string[] = [];
  const conNumeri = piano.intestazioniRigheColonne;
  const extraL = conNumeri ? LARGHEZZA_NUMERI_RIGA * PT_PER_PX * s : 0;
  const extraH = conNumeri ? ALTEZZA_LETTERE_COLONNA * PT_PER_PX * s : 0;
  const larghezze = pg.larghezze.map((w) => w * PT_PER_PX * s);
  const altezze = pg.altezze.map((h) => h * PT_PER_PX * s);
  const totL = extraL + larghezze.reduce((a, b) => a + b, 0);
  const totH = extraH + altezze.reduce((a, b) => a + b, 0);
  const utileL = W - (m.sinistro + m.destro) * PT_PER_MM;
  const utileH = H - (m.alto + m.basso) * PT_PER_MM;
  const x0 = m.sinistro * PT_PER_MM + (piano.centraOrizzontale ? Math.max(0, (utileL - totL) / 2) : 0);
  const y0 = H - m.alto * PT_PER_MM - (piano.centraVerticale ? Math.max(0, (utileH - totH) / 2) : 0); // y del bordo alto della tabella
  const xs: number[] = [x0 + extraL];
  for (const w of larghezze) xs.push(xs[xs.length - 1] + w);
  const ys: number[] = [y0 - extraH];
  for (const h of altezze) ys.push(ys[ys.length - 1] - h);

  const testo = (t: string, x: number, y: number, corpo: number, font: string, c: [number, number, number] = [0, 0, 0]): void => {
    if (t === '') return;
    out.push(`BT /${font} ${n2(corpo)} Tf ${rgb(c)} rg 1 0 0 1 ${n2(x)} ${n2(y)} Tm (${escapeTestoPdf(t)}) Tj ET`);
  };

  // intestazioni di riga e colonna
  if (conNumeri) {
    const corpo = 8 * s + 1;
    lettereColonne(pg).forEach((l, j) => {
      out.push(`q 0.94 0.94 0.94 rg ${n2(xs[j])} ${n2(y0 - extraH)} ${n2(larghezze[j])} ${n2(extraH)} re f Q`);
      out.push(`q 0.5 w 0.75 0.75 0.75 RG ${n2(xs[j])} ${n2(y0 - extraH)} ${n2(larghezze[j])} ${n2(extraH)} re S Q`);
      testo(l, xs[j] + (larghezze[j] - stimaLarghezza(l, corpo)) / 2, y0 - extraH + (extraH - corpo) / 2 + 1, corpo, 'F1', [0.3, 0.3, 0.3]);
    });
    pg.righe.forEach((r, i) => {
      const h = altezze[i];
      out.push(`q 0.94 0.94 0.94 rg ${n2(x0)} ${n2(ys[i + 1])} ${n2(extraL)} ${n2(h)} re f Q`);
      out.push(`q 0.5 w 0.75 0.75 0.75 RG ${n2(x0)} ${n2(ys[i + 1])} ${n2(extraL)} ${n2(h)} re S Q`);
      const l = String(r);
      testo(l, x0 + (extraL - stimaLarghezza(l, corpo)) / 2, ys[i + 1] + (h - corpo) / 2 + 1, corpo, 'F1', [0.3, 0.3, 0.3]);
    });
  }

  // celle: prima gli sfondi, poi i bordi, poi i testi (un bordo non copre il testo della cella vicina)
  const posRiga = new Map(pg.righe.map((r, i) => [r, i] as const));
  const posCol = new Map(pg.colonne.map((c, j) => [c, j] as const));
  const scatole = pg.celle.flat().map((c) => {
    const i = posRiga.get(c.riga)!;
    const j = posCol.get(c.colonna)!;
    const x = xs[j], xd = xs[Math.min(j + c.colspan, xs.length - 1)];
    const yAlto = ys[i], yBasso = ys[Math.min(i + c.rowspan, ys.length - 1)];
    return { c, x, y: yBasso, w: xd - x, h: yAlto - yBasso };
  });
  for (const b of scatole) {
    const f = colore(b.c.stile.backgroundColor);
    if (f) out.push(`q ${rgb(f)} rg ${n2(b.x)} ${n2(b.y)} ${n2(b.w)} ${n2(b.h)} re f Q`);
  }
  for (const b of scatole) {
    const lati: Array<[string | undefined, number, number, number, number]> = [
      [b.c.stile.borderTop, b.x, b.y + b.h, b.x + b.w, b.y + b.h],
      [b.c.stile.borderBottom, b.x, b.y, b.x + b.w, b.y],
      [b.c.stile.borderLeft, b.x, b.y, b.x, b.y + b.h],
      [b.c.stile.borderRight, b.x + b.w, b.y, b.x + b.w, b.y + b.h],
    ];
    for (const [css, xa, ya, xb, yb] of lati) {
      if (!css) continue;
      const spessore = /^2px/.test(css) ? 1.5 : 0.5;
      const tratteggio = css.includes('dashed') ? '[3 2] 0 d ' : '';
      out.push(`q ${spessore} w ${tratteggio}${rgb(colore(css) ?? [0, 0, 0])} RG ${n2(xa)} ${n2(ya)} m ${n2(xb)} ${n2(yb)} l S Q`);
    }
  }
  for (const b of scatole) {
    const t = b.c.testo;
    if (t === '') continue;
    const st = b.c.stile;
    const corpoPx = st.fontSize ? parseFloat(st.fontSize) : CORPO_PREDEFINITO_PX;
    const corpo = Math.max(3, corpoPx * PT_PER_PX * s);
    const g = st.fontWeight === '700', it = st.fontStyle === 'italic';
    const font = g && it ? 'F4' : g ? 'F2' : it ? 'F3' : 'F1';
    const larghezza = stimaLarghezza(t, corpo);
    const pad = 3 * PT_PER_PX * s;
    let tx = b.x + pad;
    if (st.textAlign === 'right') tx = b.x + b.w - pad - larghezza;
    else if (st.textAlign === 'center') tx = b.x + (b.w - larghezza) / 2;
    let ty = b.y + (b.h - corpo) / 2 + corpo * 0.15;
    if (st.verticalAlign === 'top') ty = b.y + b.h - corpo - pad / 2;
    else if (st.verticalAlign === 'bottom') ty = b.y + pad / 2 + corpo * 0.15;
    // il testo resta dentro la sua cella, come nel foglio stampato
    out.push(`q ${n2(b.x)} ${n2(b.y)} ${n2(b.w)} ${n2(b.h)} re W n`);
    testo(t, tx, ty, corpo, font, colore(st.color) ?? [0, 0, 0]);
    out.push('Q');
  }

  // intestazione e piè di pagina, a metà dei margini alto e basso
  const margine = (tt: PaginaPiano['intestazione'], y: number): void => {
    const xl = m.sinistro * PT_PER_MM, xr = W - m.destro * PT_PER_MM;
    testo(tt.sinistra, xl, y, CORPO_MARGINE_PT, 'F1');
    testo(tt.centro, (xl + xr) / 2 - stimaLarghezza(tt.centro, CORPO_MARGINE_PT) / 2, y, CORPO_MARGINE_PT, 'F1');
    testo(tt.destra, xr - stimaLarghezza(tt.destra, CORPO_MARGINE_PT), y, CORPO_MARGINE_PT, 'F1');
  };
  margine(pg.intestazione, H - (m.alto * PT_PER_MM) / 2 - CORPO_MARGINE_PT / 2);
  margine(pg.pie, (m.basso * PT_PER_MM) / 2 - CORPO_MARGINE_PT / 2);
  return out;
}

/** I byte di un PDF con queste pagine (ognuna è l'elenco dei suoi comandi di disegno). */
export function scriviPdf(pagine: string[][], larghezzaPt: number, altezzaPt: number): Uint8Array {
  const enc = new TextEncoder();
  const parti: Uint8Array[] = [];
  let byte = 0;
  const scrivi = (b: Uint8Array): void => { parti.push(b); byte += b.length; };
  const testo = (s: string): void => scrivi(enc.encode(s));
  // la seconda riga, con quattro byte oltre 127, dice ai programmi che il file è binario; il resto è ASCII (WinAnsi in ottale)
  testo('%PDF-1.4\n');
  scrivi(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const xref: number[] = [];
  const oggetto = (id: number, corpo: string): void => { xref[id] = byte; testo(`${id} 0 obj\n${corpo}\nendobj\n`); };
  const nPag = Math.max(1, pagine.length);
  const idPagina = (k: number): number => 7 + k * 2;
  oggetto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  oggetto(2, `<< /Type /Pages /Kids [ ${Array.from({ length: nPag }, (_, k) => `${idPagina(k)} 0 R`).join(' ')} ] /Count ${nPag} >>`);
  oggetto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  oggetto(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  oggetto(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
  oggetto(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>');
  for (let k = 0; k < nPag; k++) {
    const contenuto = enc.encode((pagine[k] ?? []).join('\n'));
    oggetto(idPagina(k), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(larghezzaPt)} ${n2(altezzaPt)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${idPagina(k) + 1} 0 R >>`);
    xref[idPagina(k) + 1] = byte;
    testo(`${idPagina(k) + 1} 0 obj\n<< /Length ${contenuto.length} >>\nstream\n`);
    scrivi(contenuto);
    testo('\nendstream\nendobj\n');
  }
  const totale = idPagina(nPag - 1) + 2;
  const inizioXref = byte;
  testo(`xref\n0 ${totale}\n0000000000 65535 f \n`);
  for (let id = 1; id < totale; id++) testo(`${String(xref[id]).padStart(10, '0')} 00000 n \n`);
  testo(`trailer\n<< /Size ${totale} /Root 1 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`);
  const out = new Uint8Array(byte);
  let pos = 0;
  for (const p of parti) { out.set(p, pos); pos += p.length; }
  return out;
}

/** Il PDF del foglio attivo (o di quello scelto), con l'impostazione di pagina del foglio. Un foglio vuoto dà una pagina con la sola intestazione. */
export function esportaPdf(scambio: Scambio, opzioni?: { nomeFoglio?: string; file?: string; adesso?: Date; locale?: string }): Uint8Array {
  const nome = opzioni?.nomeFoglio || scambio.foglioAttivo || scambio.fogli[0]?.nome || 'Foglio1';
  const foglio = scambio.fogli.find((f) => f.nome === nome) ?? scambio.fogli[0] ?? foglioVuoto('Foglio1');
  const valore = (r: number, c: number) => {
    const ind = indirizzoCella(r, c);
    return testoDaStampare(valoreDaScambio(foglio, ind), stileEffettivo(foglio, r, c, ind).numFmt);
  };
  const ctx = { file: opzioni?.file ?? '', adesso: opzioni?.adesso ?? new Date(), locale: opzioni?.locale ?? 'it-IT' };
  const piano = pianoDiStampa(foglio, valore, ctx);
  if (!piano) {
    // niente da stampare: una pagina A4 con il nome del foglio, perché un PDF vuoto non si apre bene
    const W = 210 * PT_PER_MM, H = 297 * PT_PER_MM;
    return scriviPdf([[`BT /F2 12 Tf 0 0 0 rg 1 0 0 1 ${n2(18 * PT_PER_MM)} ${n2(H - 20 * PT_PER_MM)} Tm (${escapeTestoPdf(foglio.nome)}) Tj ET`]], W, H);
  }
  return scriviPdf(piano.pagine.map((pg) => disegnaPagina(piano, pg)), piano.carta.larghezza * PT_PER_MM, piano.carta.altezza * PT_PER_MM);
}
