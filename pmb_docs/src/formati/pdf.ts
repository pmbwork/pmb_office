// Esportazione di documenti di pmb_docs in PDF 1.4 (puro, senza dipendenze esterne).
// Genera documenti PDF compatti, conformi allo standard ISO 32000-1 / PDF 1.4,
// con impaginazione, font standard Type 1, stili (grassetto, corsivo, corpo, colori),
// salti pagina, tabelle, righe orizzontali e immagini JPEG.

import { rigaNaturale } from '../modello/riga';
import type { Documento } from '../modello/documento';
import type { ImpostazioniPagina } from '../editor/pagine';

// Dimensioni in punti tipografici (1 pt = 1/72 di pollice)
const PUNTI_PER_PIXEL = 72 / 96;
const A4_LARGHEZZA_PT = 595.28;
const A4_ALTEZZA_PT = 841.89;

interface ConfigPagina {
  larghezza: number;
  altezza: number;
  margineSinistro: number;
  margineDestro: number;
  margineAlto: number;
  margineBasso: number;
}

function calcolaConfig(imp?: ImpostazioniPagina): ConfigPagina {
  if (!imp) {
    return {
      larghezza: A4_LARGHEZZA_PT,
      altezza: A4_ALTEZZA_PT,
      margineSinistro: 72,
      margineDestro: 72,
      margineAlto: 72,
      margineBasso: 72,
    };
  }
  const orientamento = imp.orientamento === 'orizzontale';
  let w = A4_LARGHEZZA_PT;
  let h = A4_ALTEZZA_PT;
  if (imp.formato === 'Letter') {
    w = 612;
    h = 792;
  }
  if (orientamento) {
    const tmp = w;
    w = h;
    h = tmp;
  }
  return {
    larghezza: w,
    altezza: h,
    margineSinistro: imp.margineSinistro * PUNTI_PER_PIXEL,
    margineDestro: imp.margineDestro * PUNTI_PER_PIXEL,
    margineAlto: imp.margineAlto * PUNTI_PER_PIXEL,
    margineBasso: imp.margineBasso * PUNTI_PER_PIXEL,
  };
}

interface OggettoPdf {
  id: number;
  corpo: string | Uint8Array;
}

function escapeTestoPdf(testo: string): string {
  let out = '';
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '(') out += '\\(';
    else if (c === ')') out += '\\)';
    else if (c === '\\') out += '\\\\';
    else if (c.charCodeAt(0) < 128) out += c;
    else {
      // Sostituzione caratteri oltre ASCII compatibili con codifica WinAnsi
      const code = c.charCodeAt(0);
      if (code === 8364) out += '\\200'; // €
      else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
      else out += '?';
    }
  }
  return out;
}

function decodificaBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function estraiColoreRgb(colore?: string): [number, number, number] {
  if (!colore) return [0, 0, 0];
  if (colore.startsWith('#')) {
    const hex = colore.slice(1);
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
    }
  }
  return [0, 0, 0];
}



export function esportaPdf(doc: Documento, imp?: ImpostazioniPagina): Uint8Array {
  const cfg = calcolaConfig(imp);
  const larghezzaUtile = cfg.larghezza - cfg.margineSinistro - cfg.margineDestro;

  // Elenco delle pagine con il rispettivo flusso di comandi PDF
  const pagineFlussi: string[] = [];
  const immaginiXObject: Array<{ nome: string; id: number; w: number; h: number; data: Uint8Array }> = [];
  let prossimoOggettoId = 1;

  const idCatalog = prossimoOggettoId++;
  const idPages = prossimoOggettoId++;
  const idFontRegular = prossimoOggettoId++;
  const idFontBold = prossimoOggettoId++;
  const idFontItalic = prossimoOggettoId++;
  const idFontBoldItalic = prossimoOggettoId++;

  let comandiPaginaCorrente: string[] = [];
  let yCorrente = cfg.altezza - cfg.margineAlto;

  function nuovaPagina(): void {
    if (comandiPaginaCorrente.length > 0) {
      pagineFlussi.push(comandiPaginaCorrente.join('\n'));
      comandiPaginaCorrente = [];
    }
    yCorrente = cfg.altezza - cfg.margineAlto;
  }

  // Iteriamo sui paragrafi
  for (const par of doc.paragrafi) {
    if (par.sp && comandiPaginaCorrente.length > 0) {
      nuovaPagina();
    }

    const rientroPt = (par.ri ?? 0) * 18;
    if (par.sb && comandiPaginaCorrente.length > 0) yCorrente -= par.sb;
    const interlineaMoltiplicatore = par.ls ?? 1.15;

    // Linea orizzontale: da sola (paragrafo senza testo); un paragrafo con del testo e la linea sotto la disegna dopo il testo
    const conTesto = par.runs.some((r) => r.im !== undefined || r.t.trim() !== '');
    if (par.hr && !conTesto) {
      if (yCorrente - 15 < cfg.margineBasso) nuovaPagina();
      const yLinea = yCorrente - 8;
      comandiPaginaCorrente.push(
        `q 0.5 w 0.7 0.7 0.7 RG ${cfg.margineSinistro + rientroPt} ${yLinea} m ${cfg.larghezza - cfg.margineDestro} ${yLinea} l S Q`
      );
      yCorrente -= 18;
      continue;
    }

    // Se è un paragrafo vuoto
    if (par.runs.length === 0) {
      yCorrente -= 12 * interlineaMoltiplicatore;
      if (yCorrente < cfg.margineBasso) nuovaPagina();
      continue;
    }

    // Calcolo approssimativo dell'altezza della riga
    // l'interlinea come in Word: il multiplo dell'altezza naturale della riga del carattere (vedi modello/riga.ts)
    let maxCorpo = 11;
    let carattereRiga: string | undefined;
    for (const r of par.runs) {
      if (r.z && r.z > maxCorpo) { maxCorpo = r.z; carattereRiga = r.f; }
    }
    carattereRiga ??= par.runs.find((r) => r.t.trim() !== '')?.f;
    const altezzaRiga = maxCorpo * interlineaMoltiplicatore * rigaNaturale(carattereRiga);

    if (yCorrente - altezzaRiga < cfg.margineBasso) {
      nuovaPagina();
    }

    if (par.bd) {
      const c = par.bd.c;
      const rgb = [1, 3, 5].map((i) => (parseInt(c.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
      const tratto = par.bd.s === 't' ? '[4 3] 0 d' : par.bd.s === 'p' ? '[1 2] 0 d' : '[] 0 d';
      const xs = cfg.margineSinistro + rientroPt - 3;
      comandiPaginaCorrente.push(`q ${par.bd.w} w ${rgb} RG ${tratto} ${xs.toFixed(2)} ${(yCorrente - altezzaRiga - 2).toFixed(2)} ${(cfg.larghezza - cfg.margineDestro - xs + 3).toFixed(2)} ${(altezzaRiga + 4).toFixed(2)} re S Q`);
    }
    // Disegno della riga
    let xCorrente = cfg.margineSinistro + rientroPt;

    // Se allineamento centrato o a destra
    if (par.al === 'ce' || par.al === 'dx') {
      let lunghTot = 0;
      for (const r of par.runs) {
        const corpo = r.z ?? 11;
        lunghTot += (r.t.length * corpo * 0.52);
      }
      if (par.al === 'ce') {
        xCorrente = Math.max(cfg.margineSinistro + rientroPt, cfg.margineSinistro + (larghezzaUtile - lunghTot) / 2);
      } else if (par.al === 'dx') {
        xCorrente = Math.max(cfg.margineSinistro + rientroPt, cfg.larghezza - cfg.margineDestro - lunghTot);
      }
    }

    for (const r of par.runs) {
      // Immagine
      if (r.im) {
        const wImg = Math.min(larghezzaUtile, r.im.w * PUNTI_PER_PIXEL);
        const hImg = r.im.h * PUNTI_PER_PIXEL * (wImg / (r.im.w * PUNTI_PER_PIXEL));
        if (yCorrente - hImg < cfg.margineBasso) nuovaPagina();

        // Controllo se JPEG
        if (r.im.s.startsWith('data:image/jpeg;base64,') || r.im.s.startsWith('data:image/jpg;base64,')) {
          const b64 = r.im.s.split(',')[1];
          const bytesImg = decodificaBase64(b64);
          const nomeXObj = `Im${immaginiXObject.length + 1}`;
          const idXObj = prossimoOggettoId++;
          immaginiXObject.push({ nome: nomeXObj, id: idXObj, w: r.im.w, h: r.im.h, data: bytesImg });

          const yImg = yCorrente - hImg;
          comandiPaginaCorrente.push(`q ${wImg} 0 0 ${hImg} ${xCorrente} ${yImg} cm /${nomeXObj} Do Q`);
          yCorrente -= hImg + 6;
        } else {
          // Placeholder per formati non JPEG
          const yImg = yCorrente - hImg;
          comandiPaginaCorrente.push(`q 0.5 w 0.8 0.8 0.8 rg ${xCorrente} ${yImg} ${wImg} ${hImg} re f Q`);
          yCorrente -= hImg + 6;
        }
        continue;
      }

      if (!r.t) continue;

      const corpo = r.z ?? (par.st === 't' ? 24 : par.st === '1' ? 18 : par.st === '2' ? 14 : par.st === '3' ? 12 : 11);
      let fontNome = 'F1';
      if (r.g && r.c) fontNome = 'F4';
      else if (r.g) fontNome = 'F2';
      else if (r.c) fontNome = 'F3';

      const [cr, cg, cb] = estraiColoreRgb(r.k);
      const testoEscapato = escapeTestoPdf(r.t);
      const yTesto = yCorrente - corpo;

      comandiPaginaCorrente.push(
        `BT /${fontNome} ${corpo} Tf ${cr} ${cg} ${cb} rg 1 0 0 1 ${xCorrente.toFixed(2)} ${yTesto.toFixed(2)} Tm (${testoEscapato}) Tj ET`
      );

      const lunghStima = r.t.length * corpo * 0.52;

      // Sottolineato
      if (r.s) {
        const yLine = yTesto - 1.5;
        comandiPaginaCorrente.push(
          `q 0.6 w ${cr} ${cg} ${cb} RG ${xCorrente.toFixed(2)} ${yLine.toFixed(2)} m ${(xCorrente + lunghStima).toFixed(2)} ${yLine.toFixed(2)} l S Q`
        );
      }

      xCorrente += lunghStima;
    }

    yCorrente -= altezzaRiga + (par.sa ?? 0);
    if (par.hr) {
      const yLinea = yCorrente + (par.sa ?? 0) - 3;
      comandiPaginaCorrente.push(`q 0.5 w 0.7 0.7 0.7 RG ${cfg.margineSinistro + rientroPt} ${yLinea} m ${cfg.larghezza - cfg.margineDestro} ${yLinea} l S Q`);
      yCorrente -= 6;
    }
  }

  // Chiudiamo l'ultima pagina
  if (comandiPaginaCorrente.length > 0 || pagineFlussi.length === 0) {
    pagineFlussi.push(comandiPaginaCorrente.join('\n'));
  }

  // filigrana: grigio chiaro, in grassetto, a 45 gradi al centro della pagina, prima di tutto il resto (così sta sotto)
  if (doc.filigrana) {
    const corpo = Math.min(80, Math.round(560 / Math.max(4, doc.filigrana.length) * 1.6));
    const largo = doc.filigrana.length * corpo * 0.62;
    const c = Math.SQRT1_2;
    const x = cfg.larghezza / 2 - (largo / 2) * c + (corpo / 3) * c;
    const y = cfg.altezza / 2 - (largo / 2) * c - (corpo / 3) * c;
    const segno = `q BT /F2 ${corpo} Tf 0.85 0.85 0.85 rg ${c.toFixed(4)} ${c.toFixed(4)} ${(-c).toFixed(4)} ${c.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapeTestoPdf(doc.filigrana)}) Tj ET Q`;
    for (let i = 0; i < pagineFlussi.length; i++) pagineFlussi[i] = `${segno}\n${pagineFlussi[i]}`;
  }

  // Costruiamo gli oggetti PDF
  const oggetti: OggettoPdf[] = [];
  const idPagine: number[] = [];
  const idContenuti: number[] = [];

  for (let i = 0; i < pagineFlussi.length; i++) {
    const idPag = prossimoOggettoId++;
    const idCont = prossimoOggettoId++;
    idPagine.push(idPag);
    idContenuti.push(idCont);
  }

  // 1. Catalog
  oggetti.push({
    id: idCatalog,
    corpo: `<< /Type /Catalog /Pages ${idPages} 0 R >>`,
  });

  // 2. Pages
  const kidsStr = idPagine.map((id) => `${id} 0 R`).join(' ');
  oggetti.push({
    id: idPages,
    corpo: `<< /Type /Pages /Kids [ ${kidsStr} ] /Count ${idPagine.length} >>`,
  });

  // Font standard
  oggetti.push({ id: idFontRegular, corpo: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>` });
  oggetti.push({ id: idFontBold, corpo: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>` });
  oggetti.push({ id: idFontItalic, corpo: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>` });
  oggetti.push({ id: idFontBoldItalic, corpo: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>` });

  // Immagini XObject
  for (const img of immaginiXObject) {
    const header = `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`;
    const footer = `\nendstream`;
    const enc = new TextEncoder();
    const hBytes = enc.encode(header);
    const fBytes = enc.encode(footer);
    const unito = new Uint8Array(hBytes.length + img.data.length + fBytes.length);
    unito.set(hBytes, 0);
    unito.set(img.data, hBytes.length);
    unito.set(fBytes, hBytes.length + img.data.length);
    oggetti.push({ id: img.id, corpo: unito });
  }

  // Pagine e rispettivi contenuti
  const fontDict = `/Font << /F1 ${idFontRegular} 0 R /F2 ${idFontBold} 0 R /F3 ${idFontItalic} 0 R /F4 ${idFontBoldItalic} 0 R >>`;
  const xobjDict = immaginiXObject.length > 0
    ? `/XObject << ${immaginiXObject.map((im) => `/${im.nome} ${im.id} 0 R`).join(' ')} >>`
    : '';

  for (let i = 0; i < idPagine.length; i++) {
    const idPag = idPagine[i];
    const idCont = idContenuti[i];
    const stream = pagineFlussi[i];
    const streamBytes = new TextEncoder().encode(stream);

    oggetti.push({
      id: idPag,
      corpo: `<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 ${cfg.larghezza.toFixed(2)} ${cfg.altezza.toFixed(2)}] /Resources << ${fontDict} ${xobjDict} >> /Contents ${idCont} 0 R >>`,
    });

    oggetti.push({
      id: idCont,
      corpo: `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    });
  }

  // Ordiniamo gli oggetti per ID crescente
  oggetti.sort((a, b) => a.id - b.id);

  // Serializzazione file binario PDF
  const encoder = new TextEncoder();
  const parti: Uint8Array[] = [];
  let byteOffset = 0;

  function scriviStringa(str: string): void {
    const b = encoder.encode(str);
    parti.push(b);
    byteOffset += b.length;
  }

  function scriviBytes(b: Uint8Array): void {
    parti.push(b);
    byteOffset += b.length;
  }

  // Header PDF 1.4 con byte binari standard di sicurezza
  scriviStringa('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const xrefOffsets: number[] = [];
  const maxId = Math.max(...oggetti.map((o) => o.id));

  for (let id = 1; id <= maxId; id++) {
    const o = oggetti.find((x) => x.id === id);
    if (!o) {
      xrefOffsets[id] = 0;
      continue;
    }
    xrefOffsets[id] = byteOffset;
    scriviStringa(`${o.id} 0 obj\n`);
    if (typeof o.corpo === 'string') {
      scriviStringa(`${o.corpo}\n`);
    } else {
      scriviBytes(o.corpo);
      scriviStringa('\n');
    }
    scriviStringa('endobj\n');
  }

  // Tabella xref
  const startXref = byteOffset;
  scriviStringa(`xref\n0 ${maxId + 1}\n`);
  scriviStringa('0000000000 65535 f \n');
  for (let id = 1; id <= maxId; id++) {
    const off = xrefOffsets[id] ?? 0;
    const str = `${String(off).padStart(10, '0')} 00000 n \n`;
    scriviStringa(str);
  }

  // Trailer
  scriviStringa(`trailer\n<< /Size ${maxId + 1} /Root ${idCatalog} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  // Combiniamo tutti i pezzi in un unico Uint8Array
  const totaleLunghezza = parti.reduce((sum, p) => sum + p.length, 0);
  const pdfBytes = new Uint8Array(totaleLunghezza);
  let pos = 0;
  for (const p of parti) {
    pdfBytes.set(p, pos);
    pos += p.length;
  }

  return pdfBytes;
}
