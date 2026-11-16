/**
 * Funzioni di Testo:
 * CONCAT, CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM,
 * SUBSTITUTE, FIND, SEARCH, VALUE, TEXTJOIN, REPT
 */

import { CellValue, textVal, numberVal, errorVal, coerceToText, coerceToNumber, coerceToBoolean } from '../values';
import { EvalArg, isRangeArg } from './utils';
import { formattaNumero, formattaTesto } from '../format-testo';

export function fnCONCAT(args: EvalArg[]): CellValue {
  let result = '';
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          const t = coerceToText(cell);
          if (t.error) return errorVal(t.error);
          result += t.value!;
        }
      }
    } else {
      const t = coerceToText(arg);
      if (t.error) return errorVal(t.error);
      result += t.value!;
    }
  }
  return textVal(result);
}

export function fnCONCATENATE(args: EvalArg[]): CellValue {
  let result = '';
  for (const arg of args) {
    if (isRangeArg(arg)) return errorVal('#VALUE!');
    const t = coerceToText(arg);
    if (t.error) return errorVal(t.error);
    result += t.value!;
  }
  return textVal(result);
}

export function fnLEFT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  let count = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const n = coerceToNumber(args[1]);
    if (n.error) return errorVal(n.error);
    count = Math.trunc(n.value!);
    if (count < 0) return errorVal('#VALUE!');
  }
  return textVal(t.value!.substring(0, count));
}

export function fnRIGHT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  let count = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const n = coerceToNumber(args[1]);
    if (n.error) return errorVal(n.error);
    count = Math.trunc(n.value!);
    if (count < 0) return errorVal('#VALUE!');
  }
  const str = t.value!;
  const start = Math.max(0, str.length - count);
  return textVal(str.substring(start));
}

export function fnMID(args: EvalArg[]): CellValue {
  if (args.length !== 3 || isRangeArg(args[0]) || isRangeArg(args[1]) || isRangeArg(args[2])) {
    return errorVal('#VALUE!');
  }
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const startN = coerceToNumber(args[1]);
  if (startN.error) return errorVal(startN.error);
  const countN = coerceToNumber(args[2]);
  if (countN.error) return errorVal(countN.error);

  const start = Math.trunc(startN.value!);
  const count = Math.trunc(countN.value!);
  if (start < 1 || count < 0) return errorVal('#VALUE!');

  return textVal(t.value!.substring(start - 1, start - 1 + count));
}

export function fnLEN(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  return numberVal(t.value!.length);
}

export function fnUPPER(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  return textVal(t.value!.toUpperCase());
}

export function fnLOWER(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  return textVal(t.value!.toLowerCase());
}

export function fnTRIM(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  // TRIM collassa anche le sequenze di spazi interni in uno spazio singolo
  const trimmed = t.value!.trim().replace(/\s+/g, ' ');
  return textVal(trimmed);
}

export function fnSUBSTITUTE(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 4) return errorVal('#VALUE!');
  const a0 = args[0];
  const a1 = args[1];
  const a2 = args[2];
  const a3 = args[3];
  if (isRangeArg(a0) || isRangeArg(a1) || isRangeArg(a2) || (a3 !== undefined && isRangeArg(a3))) {
    return errorVal('#VALUE!');
  }

  const textC = coerceToText(a0);
  if (textC.error) return errorVal(textC.error);
  const oldC = coerceToText(a1);
  if (oldC.error) return errorVal(oldC.error);
  const newC = coerceToText(a2);
  if (newC.error) return errorVal(newC.error);

  const src = textC.value!;
  const target = oldC.value!;
  const replacement = newC.value!;

  if (target === '') return textVal(src);

  if (args.length === 3) {
    return textVal(src.split(target).join(replacement));
  } else {
    const instN = coerceToNumber(a3);
    if (instN.error) return errorVal(instN.error);
    const inst = Math.trunc(instN.value!);
    if (inst < 1) return errorVal('#VALUE!');

    let count = 0;
    let idx = 0;
    let foundIdx = -1;
    while ((foundIdx = src.indexOf(target, idx)) !== -1) {
      count++;
      if (count === inst) {
        const res = src.substring(0, foundIdx) + replacement + src.substring(foundIdx + target.length);
        return textVal(res);
      }
      idx = foundIdx + target.length;
    }
    return textVal(src);
  }
}

export function fnFIND(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const a0 = args[0];
  const a1 = args[1];
  const a2 = args[2];
  if (isRangeArg(a0) || isRangeArg(a1) || (a2 !== undefined && isRangeArg(a2))) {
    return errorVal('#VALUE!');
  }

  const findC = coerceToText(a0);
  if (findC.error) return errorVal(findC.error);
  const withinC = coerceToText(a1);
  if (withinC.error) return errorVal(withinC.error);

  let startNum = 1;
  if (args.length === 3) {
    const sC = coerceToNumber(a2);
    if (sC.error) return errorVal(sC.error);
    startNum = Math.trunc(sC.value!);
    if (startNum < 1) return errorVal('#VALUE!');
  }

  // FIND è case-sensitive e NON supporta caratteri jolly
  const target = findC.value!;
  const src = withinC.value!;
  if (startNum > src.length + 1) return errorVal('#VALUE!');

  const idx = src.indexOf(target, startNum - 1);
  if (idx === -1) return errorVal('#VALUE!');
  return numberVal(idx + 1);
}

export function fnSEARCH(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const a0 = args[0];
  const a1 = args[1];
  const a2 = args[2];
  if (isRangeArg(a0) || isRangeArg(a1) || (a2 !== undefined && isRangeArg(a2))) {
    return errorVal('#VALUE!');
  }

  const findC = coerceToText(a0);
  if (findC.error) return errorVal(findC.error);
  const withinC = coerceToText(a1);
  if (withinC.error) return errorVal(withinC.error);

  let startNum = 1;
  if (args.length === 3) {
    const sC = coerceToNumber(a2);
    if (sC.error) return errorVal(sC.error);
    startNum = Math.trunc(sC.value!);
    if (startNum < 1) return errorVal('#VALUE!');
  }

  const target = findC.value!;
  const src = withinC.value!;
  if (startNum > src.length + 1) return errorVal('#VALUE!');

  // SEARCH è case-insensitive e supporta wildcards * e ?
  let regexPattern = '';
  let i = 0;
  while (i < target.length) {
    const ch = target[i];
    if (ch === '~' && i + 1 < target.length) {
      regexPattern += target[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 2;
      continue;
    }
    if (ch === '*') regexPattern += '.*?';
    else if (ch === '?') regexPattern += '.';
    else regexPattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i++;
  }

  const sub = src.substring(startNum - 1);
  const re = new RegExp(regexPattern, 'i');
  const match = re.exec(sub);
  if (!match) return errorVal('#VALUE!');

  return numberVal(startNum + match.index);
}

export function fnVALUE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  return numberVal(c.value!);
}

export function fnTEXTJOIN(args: EvalArg[]): CellValue {
  if (args.length < 3) return errorVal('#VALUE!');
  if (isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');

  const delimC = coerceToText(args[0]);
  if (delimC.error) return errorVal(delimC.error);
  const delim = delimC.value!;

  const ignC = coerceToBoolean(args[1]);
  if (ignC.error) return errorVal(ignC.error);
  const ignoreEmpty = ignC.value!;

  const pieces: string[] = [];

  for (let i = 2; i < args.length; i++) {
    const item = args[i];
    if (isRangeArg(item)) {
      for (const row of item.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'empty' || (cell.kind === 'text' && cell.value === '')) {
            if (!ignoreEmpty) pieces.push('');
          } else {
            const t = coerceToText(cell);
            if (t.error) return errorVal(t.error);
            pieces.push(t.value!);
          }
        }
      }
    } else {
      if (item.kind === 'error') return errorVal(item.error);
      if (item.kind === 'empty' || (item.kind === 'text' && item.value === '')) {
        if (!ignoreEmpty) pieces.push('');
      } else {
        const t = coerceToText(item);
        if (t.error) return errorVal(t.error);
        pieces.push(t.value!);
      }
    }
  }

  return textVal(pieces.join(delim));
}

export function fnREPT(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const n = coerceToNumber(args[1]);
  if (n.error) return errorVal(n.error);
  const times = Math.trunc(n.value!);
  if (times < 0) return errorVal('#VALUE!');
  if (times === 0) return textVal('');
  // Protezione contro allocazioni eccessive
  if (t.value!.length * times > 1_000_000) return errorVal('#NUM!');
  return textVal(t.value!.repeat(times));
}

// ---------------------------------------------------------------------------
// FUNZIONI TESTO AVANZATE E REGEX
// ---------------------------------------------------------------------------

export function fnPROPER(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const str = t.value!;
  const res = str.replace(/\b\w+/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  return textVal(res);
}

export function fnCLEAN(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  // Rimuove caratteri non stampabili ASCII 0..31
  const cleaned = t.value!.replace(/[\x00-\x1F]/g, '');
  return textVal(cleaned);
}

export function fnEXACT(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const t1 = coerceToText(args[0]);
  if (t1.error) return errorVal(t1.error);
  const t2 = coerceToText(args[1]);
  if (t2.error) return errorVal(t2.error);
  return { kind: 'boolean', value: t1.value === t2.value };
}

export function fnSPLIT(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 4 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const d = coerceToText(args[1]);
  if (d.error) return errorVal(d.error);
  const delim = d.value!;
  if (delim === '') return errorVal('#VALUE!');

  const parts = t.value!.split(delim);
  const row: CellValue[] = parts.map((p) => textVal(p));
  return { kind: 'array', values: [row] };
}

export function fnREGEXMATCH(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const p = coerceToText(args[1]);
  if (p.error) return errorVal(p.error);

  try {
    const re = new RegExp(p.value!);
    return { kind: 'boolean', value: re.test(t.value!) };
  } catch {
    return errorVal('#VALUE!');
  }
}

export function fnREGEXEXTRACT(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const p = coerceToText(args[1]);
  if (p.error) return errorVal(p.error);

  try {
    const re = new RegExp(p.value!);
    const match = re.exec(t.value!);
    if (!match) return errorVal('#N/A');
    if (match.length > 1) {
      // Se ci sono gruppi di cattura, ritorna il primo gruppo
      return textVal(match[1]);
    }
    return textVal(match[0]);
  } catch {
    return errorVal('#VALUE!');
  }
}

export function fnREGEXREPLACE(args: EvalArg[]): CellValue {
  if (args.length !== 3 || isRangeArg(args[0]) || isRangeArg(args[1]) || isRangeArg(args[2])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  const p = coerceToText(args[1]);
  if (p.error) return errorVal(p.error);
  const r = coerceToText(args[2]);
  if (r.error) return errorVal(r.error);

  try {
    const re = new RegExp(p.value!, 'g');
    return textVal(t.value!.replace(re, r.value!));
  } catch {
    return errorVal('#VALUE!');
  }
}

export function fnCHAR(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  const code = Math.trunc(c.value!);
  if (code < 1 || code > 255) return errorVal('#VALUE!');
  return textVal(String.fromCharCode(code));
}

export function fnCODE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  if (t.value!.length === 0) return errorVal('#VALUE!');
  return numberVal(t.value!.charCodeAt(0));
}

export function fnUNICHAR(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  const code = Math.trunc(c.value!);
  if (code < 1 || code > 0x10FFFF) return errorVal('#VALUE!');
  return textVal(String.fromCodePoint(code));
}

export function fnUNICODE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const t = coerceToText(args[0]);
  if (t.error) return errorVal(t.error);
  if (t.value!.length === 0) return errorVal('#VALUE!');
  return numberVal(t.value!.codePointAt(0)!);
}

export function fnT(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = isRangeArg(args[0]) ? args[0].get(0, 0) : args[0];
  if (val.kind === 'error') return val;
  return val.kind === 'text' ? val : textVal('');
}

export function fnREPLACE(args: EvalArg[]): CellValue {
  if (args.length !== 4) return errorVal('#VALUE!');
  const oldText = coerceToText(args[0] as CellValue);
  if (oldText.error) return errorVal(oldText.error);
  const startNum = coerceToNumber(args[1] as CellValue);
  if (startNum.error) return errorVal(startNum.error);
  const numChars = coerceToNumber(args[2] as CellValue);
  if (numChars.error) return errorVal(numChars.error);
  const newText = coerceToText(args[3] as CellValue);
  if (newText.error) return errorVal(newText.error);

  const start = Math.trunc(startNum.value!);
  const count = Math.trunc(numChars.value!);
  if (start < 1 || count < 0) return errorVal('#VALUE!');

  const str = oldText.value!;
  const before = str.substring(0, start - 1);
  const after = str.substring(start - 1 + count);
  return textVal(before + newText.value! + after);
}

export function fnTEXT(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const val = args[0];
  if (val.kind === 'error') return val;
  const fmtC = coerceToText(args[1]);
  if (fmtC.error) return errorVal(fmtC.error);
  const fmt = fmtC.value!;

  // un testo che non è un numero: si scrive com'è (o secondo la parte dei testi del formato, "@")
  if (val.kind === 'text') {
    const comeNumero = coerceToNumber(val);
    if (comeNumero.error) return textVal(formattaTesto(val.value, fmt) ?? val.value);
  }
  if (val.kind === 'boolean') return textVal(val.value ? 'TRUE' : 'FALSE');

  const nC = coerceToNumber(val);
  if (nC.error) return errorVal(nC.error);
  const risultato = formattaNumero(nC.value!, fmt);
  return risultato === null ? errorVal('#VALUE!') : textVal(risultato);
}

export function fnFIXED(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  const nC = coerceToNumber(args[0] as CellValue);
  if (nC.error) return errorVal(nC.error);
  let decimals = 2;
  let noCommas = false;

  if (args.length >= 2) {
    const dC = coerceToNumber(args[1] as CellValue);
    if (dC.error) return errorVal(dC.error);
    decimals = Math.trunc(dC.value!);
  }
  if (args.length === 3) {
    const ncC = coerceToBoolean(args[2] as CellValue);
    if (ncC.error) return errorVal(ncC.error);
    noCommas = ncC.value!;
  }

  const rounded = nC.value!.toFixed(Math.max(0, decimals));
  if (noCommas) return textVal(rounded);

  const parts = rounded.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return textVal(parts.join('.'));
}

export function fnDOLLAR(args: EvalArg[]): CellValue {
  const fixed = fnFIXED(args);
  if (fixed.kind === 'error') return fixed;
  return textVal(`$${(fixed as any).value}`);
}

export function fnNUMBERVALUE(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  const tC = coerceToText(args[0] as CellValue);
  if (tC.error) return errorVal(tC.error);
  let decSep = '.';
  let grpSep = ',';

  if (args.length >= 2) {
    const d = coerceToText(args[1] as CellValue);
    if (d.error) return errorVal(d.error);
    if (d.value!) decSep = d.value!;
  }
  if (args.length === 3) {
    const g = coerceToText(args[2] as CellValue);
    if (g.error) return errorVal(g.error);
    if (g.value!) grpSep = g.value!;
  }

  let cleanStr = tC.value!.trim();
  // Rimuovi separatore gruppi
  cleanStr = cleanStr.split(grpSep).join('');
  // Sostituisci separatore decimale con '.'
  if (decSep !== '.') {
    cleanStr = cleanStr.split(decSep).join('.');
  }

  const num = Number(cleanStr);
  if (Number.isNaN(num) || !Number.isFinite(num)) return errorVal('#VALUE!');
  return numberVal(num);
}

export function fnLENB(args: EvalArg[]): CellValue {
  return fnLEN(args);
}

export function fnLEFTB(args: EvalArg[]): CellValue {
  return fnLEFT(args);
}

export function fnRIGHTB(args: EvalArg[]): CellValue {
  return fnRIGHT(args);
}

export function fnMIDB(args: EvalArg[]): CellValue {
  return fnMID(args);
}

