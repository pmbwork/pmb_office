/**
 * Funzioni di Data:
 * DATE, YEAR, MONTH, DAY, WEEKDAY, EDATE
 * Rappresentazione seriale con epoca base 1899-12-30.
 */

import { CellValue, numberVal, errorVal, coerceToNumber } from '../values';
import { EvalArg, isRangeArg, dateToSerial, serialToDate, serialToWeekday, addMonthsToSerial } from './utils';

/** Testo che rappresenta una data (AAAA-MM-GG, GG/MM/AAAA) come numero seriale; null se non lo è. */
export function testoADataSeriale(str: string): number | null {
  const t = str.trim();
  const mIso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (mIso) return dateToSerial(parseInt(mIso[1], 10), parseInt(mIso[2], 10), parseInt(mIso[3], 10));
  const mIt = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
  if (mIt) return dateToSerial(parseInt(mIt[3], 10), parseInt(mIt[2], 10), parseInt(mIt[1], 10));
  return null;
}

/** Come coerceToNumber, ma un testo che è una data diventa il suo numero seriale. */
function coerceDate(v: CellValue): { value?: number; error?: ReturnType<typeof coerceToNumber>['error'] } {
  const c = coerceToNumber(v);
  if (!c.error || v.kind !== 'text') return c;
  const d = testoADataSeriale(v.value);
  return d === null ? c : { value: d };
}

export function fnDATE(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const [a0, a1, a2] = args;
  if (isRangeArg(a0) || isRangeArg(a1) || isRangeArg(a2)) return errorVal('#VALUE!');

  const yC = coerceDate(a0);
  if (yC.error) return errorVal(yC.error);
  const mC = coerceDate(a1);
  if (mC.error) return errorVal(mC.error);
  const dC = coerceDate(a2);
  if (dC.error) return errorVal(dC.error);

  let year = Math.trunc(yC.value!);
  const month = Math.trunc(mC.value!);
  const day = Math.trunc(dC.value!);

  // Supporto per anni a due cifre 00..99
  if (year >= 0 && year < 100) {
    year += 1900;
  }

  if (year < 1899 || year > 9999) return errorVal('#NUM!');

  const serial = dateToSerial(year, month, day);
  return numberVal(serial);
}

export function fnYEAR(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]);
  if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const dt = serialToDate(serial);
  return numberVal(dt.year);
}

export function fnMONTH(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]);
  if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const dt = serialToDate(serial);
  return numberVal(dt.month);
}

export function fnDAY(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]);
  if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const dt = serialToDate(serial);
  return numberVal(dt.day);
}

export function fnWEEKDAY(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]);
  if (c.error) return errorVal(c.error);
  let returnType = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const rt = coerceDate(args[1]);
    if (rt.error) return errorVal(rt.error);
    returnType = Math.trunc(rt.value!);
  }
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  return numberVal(serialToWeekday(serial, returnType));
}

export function fnEDATE(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const sC = coerceDate(args[0]);
  if (sC.error) return errorVal(sC.error);
  const mC = coerceDate(args[1]);
  if (mC.error) return errorVal(mC.error);

  const startSerial = sC.value!;
  const months = Math.trunc(mC.value!);
  if (startSerial < 0) return errorVal('#NUM!');

  const newSerial = addMonthsToSerial(startSerial, months);
  return numberVal(newSerial);
}

// ---------------------------------------------------------------------------
// FUNZIONI DATA E ORA AVANZATE (M3)
// ---------------------------------------------------------------------------

const EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function fnTODAY(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const serial = Math.round((todayUtc - EPOCH_MS) / MS_PER_DAY);
  return numberVal(serial);
}

export function fnNOW(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()
  );
  const serial = (nowUtc - EPOCH_MS) / MS_PER_DAY;
  return numberVal(serial);
}

export function fnTIME(args: EvalArg[]): CellValue {
  if (args.length !== 3 || isRangeArg(args[0]) || isRangeArg(args[1]) || isRangeArg(args[2])) return errorVal('#VALUE!');
  const hC = coerceDate(args[0]); if (hC.error) return errorVal(hC.error);
  const mC = coerceDate(args[1]); if (mC.error) return errorVal(mC.error);
  const sC = coerceDate(args[2]); if (sC.error) return errorVal(sC.error);
  const totalSecs = (hC.value! * 3600 + mC.value! * 60 + sC.value!) % 86400;
  const normalizedSecs = totalSecs < 0 ? totalSecs + 86400 : totalSecs;
  return numberVal(normalizedSecs / 86400);
}

export function fnHOUR(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]); if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const frac = serial - Math.floor(serial);
  const totalSecs = Math.round(frac * 86400);
  const hour = Math.floor(totalSecs / 3600) % 24;
  return numberVal(hour);
}

export function fnMINUTE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]); if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const frac = serial - Math.floor(serial);
  const totalSecs = Math.round(frac * 86400);
  const min = Math.floor((totalSecs % 3600) / 60);
  return numberVal(min);
}

export function fnSECOND(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]); if (c.error) return errorVal(c.error);
  const serial = c.value!;
  if (serial < 0) return errorVal('#NUM!');
  const frac = serial - Math.floor(serial);
  const totalSecs = Math.round(frac * 86400);
  const sec = totalSecs % 60;
  return numberVal(sec);
}

export function fnEOMONTH(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const sC = coerceDate(args[0]); if (sC.error) return errorVal(sC.error);
  const mC = coerceDate(args[1]); if (mC.error) return errorVal(mC.error);

  const startSerial = sC.value!;
  const months = Math.trunc(mC.value!);
  if (startSerial < 0) return errorVal('#NUM!');

  const dt = serialToDate(startSerial);
  const targetYearMonth = new Date(Date.UTC(dt.year, dt.month + months, 0));
  const resSerial = dateToSerial(
    targetYearMonth.getUTCFullYear(),
    targetYearMonth.getUTCMonth() + 1,
    targetYearMonth.getUTCDate()
  );
  return numberVal(resSerial);
}

export function fnDAYS(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const endC = coerceDate(args[0]); if (endC.error) return errorVal(endC.error);
  const startC = coerceDate(args[1]); if (startC.error) return errorVal(startC.error);
  return numberVal(Math.trunc(endC.value!) - Math.trunc(startC.value!));
}

export function fnDAYS360(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const sC = coerceDate(args[0]); if (sC.error) return errorVal(sC.error);
  const eC = coerceDate(args[1]); if (eC.error) return errorVal(eC.error);
  let method = false; // false = NASD, true = European
  if (args.length === 3) {
    if (isRangeArg(args[2])) return errorVal('#VALUE!');
    const m = coerceDate(args[2]); if (m.error) return errorVal(m.error);
    method = m.value! !== 0;
  }

  const d1 = serialToDate(sC.value!);
  const d2 = serialToDate(eC.value!);

  let day1 = d1.day;
  let day2 = d2.day;

  if (!method) {
    // Metodo NASD
    if (day1 === 31) day1 = 30;
    if (day2 === 31 && day1 >= 30) day2 = 30;
  } else {
    // Metodo Europeo
    if (day1 === 31) day1 = 30;
    if (day2 === 31) day2 = 30;
  }

  const result = (d2.year - d1.year) * 360 + (d2.month - d1.month) * 30 + (day2 - day1);
  return numberVal(result);
}

export function fnDATEDIF(args: EvalArg[]): CellValue {
  if (args.length !== 3 || isRangeArg(args[0]) || isRangeArg(args[1]) || isRangeArg(args[2])) return errorVal('#VALUE!');
  const sC = coerceDate(args[0]); if (sC.error) return errorVal(sC.error);
  const eC = coerceDate(args[1]); if (eC.error) return errorVal(eC.error);
  const start = Math.trunc(sC.value!);
  const end = Math.trunc(eC.value!);
  if (start > end) return errorVal('#NUM!');

  if (args[2].kind === 'error') return args[2];
  const u = (args[2] as any).value?.toString().trim().toUpperCase();
  const dStart = serialToDate(start);
  const dEnd = serialToDate(end);

  if (u === 'Y') {
    let years = dEnd.year - dStart.year;
    if (dEnd.month < dStart.month || (dEnd.month === dStart.month && dEnd.day < dStart.day)) {
      years--;
    }
    return numberVal(Math.max(0, years));
  }
  if (u === 'M') {
    let months = (dEnd.year - dStart.year) * 12 + (dEnd.month - dStart.month);
    if (dEnd.day < dStart.day) {
      months--;
    }
    return numberVal(Math.max(0, months));
  }
  if (u === 'D') {
    return numberVal(end - start);
  }
  if (u === 'MD') {
    if (dEnd.day >= dStart.day) {
      return numberVal(dEnd.day - dStart.day);
    }
    const prevMonthDays = new Date(Date.UTC(dEnd.year, dEnd.month - 1, 0)).getUTCDate();
    return numberVal(prevMonthDays - dStart.day + dEnd.day);
  }
  if (u === 'YM') {
    let months = dEnd.month - dStart.month;
    if (dEnd.day < dStart.day) months--;
    if (months < 0) months += 12;
    return numberVal(months);
  }
  if (u === 'YD') {
    const startInEndYear = dateToSerial(dEnd.year, dStart.month, dStart.day);
    if (end >= startInEndYear) {
      return numberVal(end - startInEndYear);
    }
    const startInPrevYear = dateToSerial(dEnd.year - 1, dStart.month, dStart.day);
    return numberVal(end - startInPrevYear);
  }

  return errorVal('#NUM!');
}

function extractHolidays(arg?: EvalArg): Set<number> {
  const set = new Set<number>();
  if (!arg) return set;
  if (isRangeArg(arg)) {
    for (const row of arg.values) {
      for (const cell of row) {
        if (cell.kind === 'number') set.add(Math.trunc(cell.value));
      }
    }
  } else if (arg.kind === 'number') {
    set.add(Math.trunc(arg.value));
  }
  return set;
}

export function fnNETWORKDAYS(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const sC = coerceDate(args[0] as CellValue); if (sC.error) return errorVal(sC.error);
  const eC = coerceDate(args[1] as CellValue); if (eC.error) return errorVal(eC.error);
  let start = Math.trunc(sC.value!);
  let end = Math.trunc(eC.value!);
  const holidays = extractHolidays(args[2]);

  let sign = 1;
  if (start > end) {
    sign = -1;
    const temp = start;
    start = end;
    end = temp;
  }

  let workdays = 0;
  for (let s = start; s <= end; s++) {
    const wd = serialToWeekday(s, 2); // 1 = Monday .. 7 = Sunday
    if (wd <= 5 && !holidays.has(s)) {
      workdays++;
    }
  }
  return numberVal(sign * workdays);
}

export function fnWORKDAY(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const sC = coerceDate(args[0] as CellValue); if (sC.error) return errorVal(sC.error);
  const dC = coerceDate(args[1] as CellValue); if (dC.error) return errorVal(dC.error);
  let curr = Math.trunc(sC.value!);
  let days = Math.trunc(dC.value!);
  const holidays = extractHolidays(args[2]);

  const step = days >= 0 ? 1 : -1;
  days = Math.abs(days);

  while (days > 0) {
    curr += step;
    const wd = serialToWeekday(curr, 2);
    if (wd <= 5 && !holidays.has(curr)) {
      days--;
    }
  }
  return numberVal(curr);
}

export function fnISOWEEKNUM(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]); if (c.error) return errorVal(c.error);
  const serial = c.value!;
  const dtInfo = serialToDate(serial);
  const dt = new Date(Date.UTC(dtInfo.year, dtInfo.month - 1, dtInfo.day));

  // Giovedì nella settimana corrente determina l'anno ISO
  const dayNr = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNr + 3);
  const firstThursday = dt.getTime();
  dt.setUTCMonth(0, 1);
  if (dt.getUTCDay() !== 4) {
    dt.setUTCMonth(0, 1 + ((4 - dt.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - dt.getTime()) / 604800000);
  return numberVal(weekNum);
}

export function fnWEEKNUM(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceDate(args[0]); if (c.error) return errorVal(c.error);
  let returnType = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const rt = coerceDate(args[1]); if (rt.error) return errorVal(rt.error);
    returnType = Math.trunc(rt.value!);
  }

  if (returnType === 21) {
    return fnISOWEEKNUM([args[0]]);
  }

  const dtInfo = serialToDate(c.value!);
  const dt = new Date(Date.UTC(dtInfo.year, dtInfo.month - 1, dtInfo.day));
  const startOfYear = new Date(Date.UTC(dtInfo.year, 0, 1));
  const diffDays = Math.floor((dt.getTime() - startOfYear.getTime()) / MS_PER_DAY);
  const startDay = startOfYear.getUTCDay(); // 0 = Sun, 1 = Mon
  const weekNum = Math.floor((diffDays + (returnType === 2 ? (startDay === 0 ? 6 : startDay - 1) : startDay)) / 7) + 1;
  return numberVal(weekNum);
}

export function fnDATEVALUE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const str = (args[0] as any).value?.toString().trim();
  if (!str) return errorVal('#VALUE!');

  // Formati supportati: YYYY-MM-DD, DD/MM/YYYY
  const mIso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(str);
  if (mIso) {
    const y = parseInt(mIso[1], 10);
    const m = parseInt(mIso[2], 10);
    const d = parseInt(mIso[3], 10);
    return numberVal(dateToSerial(y, m, d));
  }
  const mIt = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (mIt) {
    const d = parseInt(mIt[1], 10);
    const m = parseInt(mIt[2], 10);
    const y = parseInt(mIt[3], 10);
    return numberVal(dateToSerial(y, m, d));
  }

  const parsed = Date.parse(str);
  if (Number.isNaN(parsed)) return errorVal('#VALUE!');
  const dt = new Date(parsed);
  return numberVal(dateToSerial(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
}

export function fnTIMEVALUE(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const str = (args[0] as any).value?.toString().trim();
  if (!str) return errorVal('#VALUE!');

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (!match) return errorVal('#VALUE!');
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return errorVal('#VALUE!');
  return numberVal((h * 3600 + m * 60 + s) / 86400);
}

export function fnYEARFRAC(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const sC = coerceDate(args[0]); if (sC.error) return errorVal(sC.error);
  const eC = coerceDate(args[1]); if (eC.error) return errorVal(eC.error);
  let basis = 0; // 0 = US 30/360, 1 = actual/actual, 2 = actual/360, 3 = actual/365, 4 = European 30/360
  if (args.length === 3) {
    if (isRangeArg(args[2])) return errorVal('#VALUE!');
    const bC = coerceDate(args[2]); if (bC.error) return errorVal(bC.error);
    basis = Math.trunc(bC.value!);
  }

  const start = Math.min(sC.value!, eC.value!);
  const end = Math.max(sC.value!, eC.value!);

  if (basis === 0 || basis === 4) {
    const days360 = fnDAYS360([numberVal(start), numberVal(end), numberVal(basis === 4 ? 1 : 0)]);
    return numberVal((days360 as any).value / 360);
  }
  if (basis === 2) {
    return numberVal((end - start) / 360);
  }
  if (basis === 3) {
    return numberVal((end - start) / 365);
  }
  // basis === 1 (Actual/actual)
  const dStart = serialToDate(start);
  const dEnd = serialToDate(end);
  const avgYearDays = (dStart.year === dEnd.year)
    ? (new Date(Date.UTC(dStart.year, 1, 29)).getUTCDate() === 29 ? 366 : 365)
    : 365.25;
  return numberVal((end - start) / avgYearDays);
}

