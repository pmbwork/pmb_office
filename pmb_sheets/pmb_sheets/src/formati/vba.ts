// Macro dei file di Excel (.xlsm): si legge il testo dei moduli VBA e lo si traduce in poche AZIONI SICURE che pmb_sheets sa eseguire.
// Non c'è un interprete VBA: una macro si può eseguire solo se ogni sua istruzione è una di queste (scelta di sicurezza, 2026-11-22):
//   vai a un foglio            Sheets("Nome").Select / .Activate  (anche Worksheets)
//   seleziona una cella        Range("N1").Select / .Activate
//   apri il link della cella   Selection.Hyperlinks(1).Follow ...  /  Range("N1").Hyperlinks(1).Follow ...
// Qualsiasi altra istruzione rende la macro non eseguibile, con il motivo (la riga). Il codice VBA non si conserva nel documento.
//
// Formato (specifica pubblica Microsoft [MS-OVBA]): xl/vbaProject.bin è un file composto; il flusso VBA/dir, compresso, elenca i moduli
// (nome, flusso, posizione del testo); il testo di ogni modulo è compresso dalla posizione indicata in poi.
import { leggiCfb } from '@comune/formati/cfb';
import type { AzioneMacro } from '../sheet/pulsanti';

export type { AzioneMacro };

export interface MacroLetta {
  /** nome della macro come scritto nel modulo */
  nome: string;
  /** le azioni da eseguire, oppure null se la macro contiene altro (vedi motivo) */
  azioni: AzioneMacro[] | null;
  motivo?: string;
}

const LIMITE_FLUSSO = 8 * 1024 * 1024;

/** Decompressione di un «CompressedContainer» ([MS-OVBA] 2.4.1). Lancia un errore se i dati non sono validi. */
export function decomprimiVba(dati: Uint8Array, inizio = 0): Uint8Array {
  if (dati[inizio] !== 0x01) throw new Error('contenitore VBA non valido');
  const uscita: number[] = [];
  let p = inizio + 1;
  while (p + 2 <= dati.length) {
    const intestazione = dati[p]! | (dati[p + 1]! << 8);
    const fineBlocco = Math.min(dati.length, p + (intestazione & 0x0fff) + 3);
    const compresso = (intestazione & 0x8000) !== 0;
    p += 2;
    const inizioBlocco = uscita.length;
    if (!compresso) {
      for (let k = 0; k < 4096 && p < dati.length; k++) uscita.push(dati[p++]!);
    } else {
      while (p < fineBlocco) {
        const bandiere = dati[p++]!;
        for (let bit = 0; bit < 8 && p < fineBlocco; bit++) {
          if ((bandiere & (1 << bit)) === 0) { uscita.push(dati[p++]!); continue; }
          if (p + 2 > fineBlocco) throw new Error('contenitore VBA troncato');
          const segno = dati[p]! | (dati[p + 1]! << 8);
          p += 2;
          const distanza = uscita.length - inizioBlocco;
          let bitConteggio = 4;
          while ((1 << bitConteggio) < distanza) bitConteggio++;
          bitConteggio = Math.min(bitConteggio, 12);
          const mascheraLunghezza = 0xffff >> bitConteggio;
          const lunghezza = (segno & mascheraLunghezza) + 3;
          const scostamento = (segno >> (16 - bitConteggio)) + 1;
          const da = uscita.length - scostamento;
          if (da < inizioBlocco) throw new Error('contenitore VBA non valido');
          for (let k = 0; k < lunghezza; k++) uscita.push(uscita[da + k]!);
        }
      }
    }
    p = fineBlocco;
    if (uscita.length > LIMITE_FLUSSO) throw new Error('modulo VBA troppo grande');
  }
  return Uint8Array.from(uscita);
}

interface ModuloVba { nome: string; flusso: string; posizione: number }

/** I moduli elencati nel flusso dir già decompresso, e la tabella dei caratteri del progetto. */
function leggiDir(dir: Uint8Array): { moduli: ModuloVba[]; codepage: number } {
  const vista = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  const moduli: ModuloVba[] = [];
  let codepage = 1252;
  let corrente: Partial<ModuloVba> | null = null;
  let p = 0;
  const latino = new TextDecoder('windows-1252');
  while (p + 6 <= dir.length) {
    const id = vista.getUint16(p, true);
    const misura = vista.getUint32(p + 2, true);
    const dati = p + 6;
    // PROJECTVERSION: la misura dice 4 ma i dati sono 6 byte ([MS-OVBA] 2.3.4.2.1.11)
    const salta = id === 0x0009 ? 6 : misura;
    if (dati + salta > dir.length) break;
    const pezzo = dir.subarray(dati, dati + salta);
    if (id === 0x0003 && salta >= 2) codepage = vista.getUint16(dati, true);
    else if (id === 0x0019) corrente = { nome: latino.decode(pezzo) };
    else if (id === 0x0047 && corrente) corrente.nome = new TextDecoder('utf-16le').decode(pezzo);
    else if (id === 0x001a && corrente) corrente.flusso = latino.decode(pezzo);
    else if (id === 0x0032 && corrente) corrente.flusso = new TextDecoder('utf-16le').decode(pezzo);
    else if (id === 0x0031 && corrente && salta >= 4) corrente.posizione = vista.getUint32(dati, true);
    else if (id === 0x002b && corrente) {
      if (corrente.flusso && corrente.posizione !== undefined) moduli.push({ nome: corrente.nome ?? corrente.flusso, flusso: corrente.flusso, posizione: corrente.posizione });
      corrente = null;
    }
    p = dati + salta;
  }
  return { moduli, codepage };
}

/** Il testo di tutti i moduli VBA di un vbaProject.bin: nome del modulo → codice. */
export function leggiModuliVba(bin: Uint8Array): Map<string, string> {
  const cfb = leggiCfb(bin);
  const dirCompresso = cfb.flusso('VBA/dir');
  if (!dirCompresso) throw new Error('progetto VBA senza elenco dei moduli');
  const { moduli, codepage } = leggiDir(decomprimiVba(dirCompresso));
  let decodifica: TextDecoder;
  try { decodifica = new TextDecoder(codepage === 65001 ? 'utf-8' : `windows-${codepage}`); } catch { decodifica = new TextDecoder('windows-1252'); }
  const testi = new Map<string, string>();
  for (const m of moduli) {
    const flusso = cfb.flusso(`VBA/${m.flusso}`);
    if (!flusso || m.posizione >= flusso.length) continue;
    try { testi.set(m.nome, decodifica.decode(decomprimiVba(flusso, m.posizione))); } catch { /* modulo rovinato: si salta */ }
  }
  return testi;
}

const CELLA = '([A-Za-z]{1,3}\\$?\\d{1,7})';
const ISTRUZIONI: Array<[RegExp, (m: RegExpMatchArray) => AzioneMacro[]]> = [
  [/^(?:Application\.)?(?:ActiveWorkbook\.)?(?:Sheets|Worksheets)\(\s*"([^"]{1,31})"\s*\)\.(?:Select|Activate)$/i, (m) => [{ tipo: 'foglio', nome: m[1]! }]],
  [new RegExp(`^Range\\(\\s*"\\$?${CELLA}"\\s*\\)\\.(?:Select|Activate)$`, 'i'), (m) => [{ tipo: 'cella', indirizzo: m[1]!.replace(/\$/g, '').toUpperCase() }]],
  [/^(?:Selection|ActiveCell)\.Hyperlinks\(\s*1\s*\)\.Follow\b.*$/i, () => [{ tipo: 'link' }]],
  [new RegExp(`^Range\\(\\s*"\\$?${CELLA}"\\s*\\)\\.Hyperlinks\\(\\s*1\\s*\\)\\.Follow\\b.*$`, 'i'), (m) => [{ tipo: 'cella', indirizzo: m[1]!.replace(/\$/g, '').toUpperCase() }, { tipo: 'link' }]],
];

/** Le macro (Sub senza parametri) di un modulo, con le azioni sicure o il motivo per cui non si possono eseguire. */
export function macroDelModulo(codice: string): MacroLetta[] {
  // righe logiche: le righe che finiscono con « _» continuano sotto; via i commenti e le righe Attribute
  const righe = codice.replace(/\r\n?/g, '\n').replace(/ _\n/g, ' ').split('\n')
    .map((r) => r.replace(/(^|\s)(?:'|Rem\s).*$/i, '').trim())
    .filter((r) => r !== '' && !/^Attribute\s/i.test(r) && !/^Option\s/i.test(r));
  const macro: MacroLetta[] = [];
  let corrente: { nome: string; azioni: AzioneMacro[]; motivo?: string } | null = null;
  for (const riga of righe) {
    const inizio = riga.match(/^(?:Public\s+|Private\s+)?Sub\s+([A-Za-z_][A-Za-z0-9_]{0,254})\s*\(\s*\)$/i);
    if (inizio) { corrente = { nome: inizio[1]!, azioni: [] }; continue; }
    if (/^End\s+Sub$/i.test(riga)) {
      if (corrente) macro.push(corrente.motivo ? { nome: corrente.nome, azioni: null, motivo: corrente.motivo } : { nome: corrente.nome, azioni: corrente.azioni });
      corrente = null;
      continue;
    }
    if (!corrente || corrente.motivo) continue;
    const trovata = ISTRUZIONI.find(([re]) => re.test(riga));
    if (trovata) corrente.azioni.push(...trovata[1](riga.match(trovata[0])!));
    else corrente.motivo = riga.slice(0, 120);
  }
  return macro;
}

/** Tutte le macro di un vbaProject.bin, per nome in minuscolo (in VBA i nomi non badano alle maiuscole). */
export function leggiMacro(bin: Uint8Array): Map<string, MacroLetta> {
  const tutte = new Map<string, MacroLetta>();
  for (const codice of leggiModuliVba(bin).values()) for (const m of macroDelModulo(codice)) if (!tutte.has(m.nome.toLowerCase())) tutte.set(m.nome.toLowerCase(), m);
  return tutte;
}

/** Il nome della macro da un riferimento di Excel: «[0]!schedasocieta», «Modulo10.schedasocieta», «'file.xlsm'!macro». */
export function nomeMacro(riferimento: string): string {
  const r = riferimento.trim();
  const dopo = r.slice(Math.max(r.lastIndexOf('!'), r.lastIndexOf('.')) + 1);
  return dopo.replace(/^'+|'+$/g, '');
}
