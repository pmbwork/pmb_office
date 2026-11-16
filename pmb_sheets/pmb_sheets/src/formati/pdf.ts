// Esportazione pura di cartelle di calcolo di pmb_sheets in formato PDF 1.4 vettoriale.
// Disegna la griglia del foglio attivo (o selezionato), le intestazioni di colonna (A, B, C...)
// e di riga (1, 2, 3...), i valori formattati delle celle, gli allineamenti, i bordi e gli sfondi.

import type { FoglioScambio, Scambio } from './scambio';
import { foglioVuoto } from './scambio';
import { columnIndexToLetters } from '../engine/address';
import type { CellStyle } from '../sheet/styles';

const A4_W = 841.89; // Orientamento orizzontale predefinito per fogli di calcolo
const A4_H = 595.28;
const MARGINE = 36; // 0.5 pollice

function escapeTestoPdf(testo: string): string {
  let out = '';
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '(') out += '\\(';
    else if (c === ')') out += '\\)';
    else if (c === '\\') out += '\\\\';
    else if (c.charCodeAt(0) < 128) out += c;
    else {
      const code = c.charCodeAt(0);
      if (code === 8364) out += '\\200'; // €
      else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
      else out += '?';
    }
  }
  return out;
}

function parseHexColor(hex?: string): [number, number, number] | null {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return null;
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function esportaPdf(scambio: Scambio, opzioni?: { nomeFoglio?: string }): Uint8Array {
  const nomeFoglio = opzioni?.nomeFoglio || scambio.foglioAttivo || scambio.fogli[0]?.nome || 'Foglio1';
  const foglio: FoglioScambio = scambio.fogli.find((f) => f.nome === nomeFoglio) || scambio.fogli[0] || foglioVuoto('Foglio1');

  // Determina l'area occupata dalle celle
  let maxR = 1;
  let maxC = 1;
  for (const k of Object.keys(foglio.celle)) {
    const match = /^([A-Z]+)(\d+)$/.exec(k);
    if (match) {
      const cStr = match[1];
      const r = parseInt(match[2], 10);
      let c = 0;
      for (let i = 0; i < cStr.length; i++) c = c * 26 + (cStr.charCodeAt(i) - 64);
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }

  // Limiti ragionevoli per l'export della prima pagina/tabella
  const righeTotali = Math.min(maxR, 60);
  const colonneTotali = Math.min(maxC, 20);

  const larghezzaHeaderRiga = 32;
  const altezzaHeaderColonna = 18;
  const larghezzaDisponibile = A4_W - MARGINE * 2 - larghezzaHeaderRiga;
  const altezzaDisponibile = A4_H - MARGINE * 2 - altezzaHeaderColonna - 24; // 24 pt per titolo foglio

  // Calcolo larghezze colonne
  const colWidths: number[] = [];
  const colWDef = Math.max(50, larghezzaDisponibile / Math.max(1, colonneTotali));
  for (let c = 1; c <= colonneTotali; c++) {
    const customW = foglio.larghezze?.[c];
    colWidths[c] = customW ? Math.min(200, customW * 0.75) : colWDef;
  }

  // Calcolo altezze righe
  const rowHeights: number[] = [];
  const rowHDef = Math.max(16, Math.min(22, altezzaDisponibile / Math.max(1, righeTotali)));
  for (let r = 1; r <= righeTotali; r++) {
    const customH = foglio.altezze?.[r];
    rowHeights[r] = customH ? Math.min(100, customH * 0.75) : rowHDef;
  }

  const comandi: string[] = [];

  // 1. Titolo del foglio
  comandi.push(`BT /F2 14 Tf 0.1 0.1 0.1 rg 1 0 0 1 ${MARGINE} ${(A4_H - MARGINE - 14).toFixed(2)} Tm (${escapeTestoPdf(foglio.nome)}) Tj ET`);

  const topGriglia = A4_H - MARGINE - 24;

  // 2. Intestazioni colonne (A, B, C...)
  let curX = MARGINE + larghezzaHeaderRiga;
  for (let c = 1; c <= colonneTotali; c++) {
    const w = colWidths[c];
    const yHeader = topGriglia - altezzaHeaderColonna;
    // Sfondo header colonna
    comandi.push(`q 0.94 0.94 0.94 rg ${curX.toFixed(2)} ${yHeader.toFixed(2)} ${w.toFixed(2)} ${altezzaHeaderColonna} re f Q`);
    // Bordo header
    comandi.push(`q 0.5 w 0.8 0.8 0.8 RG ${curX.toFixed(2)} ${yHeader.toFixed(2)} ${w.toFixed(2)} ${altezzaHeaderColonna} re S Q`);
    // Testo lettera colonna centrato
    const label = columnIndexToLetters(c);
    const textX = curX + (w - label.length * 6) / 2;
    comandi.push(`BT /F2 9 Tf 0.3 0.3 0.3 rg 1 0 0 1 ${textX.toFixed(2)} ${(yHeader + 5).toFixed(2)} Tm (${label}) Tj ET`);
    curX += w;
  }

  // 3. Celle della griglia e intestazioni riga
  let curY = topGriglia - altezzaHeaderColonna;

  for (let r = 1; r <= righeTotali; r++) {
    const h = rowHeights[r];
    const yRow = curY - h;

    // Intestazione riga (1, 2, 3...)
    comandi.push(`q 0.94 0.94 0.94 rg ${MARGINE} ${yRow.toFixed(2)} ${larghezzaHeaderRiga} ${h.toFixed(2)} re f Q`);
    comandi.push(`q 0.5 w 0.8 0.8 0.8 RG ${MARGINE} ${yRow.toFixed(2)} ${larghezzaHeaderRiga} ${h.toFixed(2)} re S Q`);
    const rLabel = String(r);
    const rTextX = MARGINE + (larghezzaHeaderRiga - rLabel.length * 5.5) / 2;
    comandi.push(`BT /F2 9 Tf 0.3 0.3 0.3 rg 1 0 0 1 ${rTextX.toFixed(2)} ${(yRow + h / 2 - 3).toFixed(2)} Tm (${rLabel}) Tj ET`);

    // Celle della riga
    let cellX = MARGINE + larghezzaHeaderRiga;
    for (let c = 1; c <= colonneTotali; c++) {
      const w = colWidths[c];
      const coord = `${columnIndexToLetters(c)}${r}`;
      const rawVal = foglio.celle[coord] || '';
      const stile: CellStyle | undefined = foglio.stili?.[coord];

      // Sfondo cella se presente
      if (stile?.fill) {
        const rgb = parseHexColor(stile.fill);
        if (rgb) {
          comandi.push(`q ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${cellX.toFixed(2)} ${yRow.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
        }
      }

      // Bordo cella
      comandi.push(`q 0.5 w 0.85 0.85 0.85 RG ${cellX.toFixed(2)} ${yRow.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`);

      // Testo della cella
      if (rawVal) {
        const isNum = !isNaN(Number(rawVal)) && !rawVal.startsWith('=');
        const align = stile?.hAlign || (isNum ? 'right' : 'left');
        const isBold = !!stile?.bold;
        const isItalic = !!stile?.italic;
        const fontName = isBold && isItalic ? 'F4' : isBold ? 'F2' : isItalic ? 'F3' : 'F1';
        const fontSize = stile?.fontSize || 9;

        const textColor = parseHexColor(stile?.color) || [0, 0, 0];
        const valEscapato = escapeTestoPdf(rawVal.startsWith('=') ? rawVal : rawVal);
        const stimaL = rawVal.length * fontSize * 0.52;

        let tx = cellX + 4;
        if (align === 'right') {
          tx = Math.max(cellX + 2, cellX + w - stimaL - 4);
        } else if (align === 'center') {
          tx = Math.max(cellX + 2, cellX + (w - stimaL) / 2);
        }

        const ty = yRow + (h - fontSize) / 2;
        comandi.push(`BT /${fontName} ${fontSize} Tf ${textColor[0]} ${textColor[1]} ${textColor[2]} rg 1 0 0 1 ${tx.toFixed(2)} ${ty.toFixed(2)} Tm (${valEscapato}) Tj ET`);
      }

      cellX += w;
    }

    curY -= h;
  }

  const streamContent = comandi.join('\n');
  const streamBytes = new TextEncoder().encode(streamContent);

  // Costruzione PDF 1.4 pura
  const enc = new TextEncoder();
  const parti: Uint8Array[] = [];
  let byteOffset = 0;

  function scriviStringa(str: string): void {
    const b = enc.encode(str);
    parti.push(b);
    byteOffset += b.length;
  }

  function scriviBytes(b: Uint8Array): void {
    parti.push(b);
    byteOffset += b.length;
  }

  scriviStringa('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const xref: number[] = [];

  // 1. Catalog
  xref[1] = byteOffset;
  scriviStringa('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2. Pages
  xref[2] = byteOffset;
  scriviStringa('2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n');

  // 3. Page
  xref[3] = byteOffset;
  scriviStringa(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>\nendobj\n`
  );

  // 4-7. Font standard
  xref[4] = byteOffset;
  scriviStringa('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  xref[5] = byteOffset;
  scriviStringa('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  xref[6] = byteOffset;
  scriviStringa('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj\n');
  xref[7] = byteOffset;
  scriviStringa('7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>\nendobj\n');

  // 8. Stream di contenuto
  xref[8] = byteOffset;
  scriviStringa(`8 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
  scriviBytes(streamBytes);
  scriviStringa('\nendstream\nendobj\n');

  // Tabella xref
  const startXref = byteOffset;
  scriviStringa('xref\n0 9\n');
  scriviStringa('0000000000 65535 f \n');
  for (let id = 1; id <= 8; id++) {
    scriviStringa(`${String(xref[id]).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer
  scriviStringa(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  const totale = parti.reduce((acc, p) => acc + p.length, 0);
  const risultato = new Uint8Array(totale);
  let pos = 0;
  for (const p of parti) {
    risultato.set(p, pos);
    pos += p.length;
  }

  return risultato;
}
