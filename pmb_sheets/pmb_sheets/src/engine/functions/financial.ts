/**
 * Funzioni Finanziarie per pmb_office Fogli:
 * PMT, FV, PV, NPV, IRR, RATE, NPER, IPMT, PPMT, SLN, SYD, DB, DDB
 * Zero dipendenze esterne.
 */

import { CellValue, numberVal, errorVal, coerceToNumber } from '../values';
import { EvalArg, isRangeArg, extractAggregationNumbers } from './utils';

function getArgNum(arg: EvalArg): { val?: number; error?: string } {
  if (isRangeArg(arg)) return { error: '#VALUE!' };
  if (arg.kind === 'error') return { error: arg.error };
  const c = coerceToNumber(arg);
  if (c.error) return { error: c.error };
  return { val: c.value };
}

/**
 * PMT(rate, nper, pv, [fv], [type])
 */
export function fnPMT(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 5) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const n = getArgNum(args[1]); if (n.error) return errorVal(n.error as any);
  const p = getArgNum(args[2]); if (p.error) return errorVal(p.error as any);
  const rate = r.val!;
  const nper = n.val!;
  const pv = p.val!;
  let fv = 0;
  let type = 0;
  if (args.length >= 4) {
    const f = getArgNum(args[3]); if (f.error) return errorVal(f.error as any);
    fv = f.val!;
  }
  if (args.length === 5) {
    const t = getArgNum(args[4]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }

  if (nper === 0) return errorVal('#DIV/0!');

  if (rate === 0) {
    return numberVal(-(pv + fv) / nper);
  }

  const pvif = Math.pow(1 + rate, nper);
  if (!Number.isFinite(pvif)) return errorVal('#NUM!');
  const pmt = (-rate * (pv * pvif + fv)) / ((1 + rate * type) * (pvif - 1));
  if (!Number.isFinite(pmt) || Number.isNaN(pmt)) return errorVal('#NUM!');
  return numberVal(pmt);
}

/**
 * FV(rate, nper, pmt, [pv], [type])
 */
export function fnFV(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 5) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const n = getArgNum(args[1]); if (n.error) return errorVal(n.error as any);
  const pm = getArgNum(args[2]); if (pm.error) return errorVal(pm.error as any);
  const rate = r.val!;
  const nper = n.val!;
  const pmt = pm.val!;
  let pv = 0;
  let type = 0;
  if (args.length >= 4) {
    const p = getArgNum(args[3]); if (p.error) return errorVal(p.error as any);
    pv = p.val!;
  }
  if (args.length === 5) {
    const t = getArgNum(args[4]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }

  if (rate === 0) {
    return numberVal(-(pv + pmt * nper));
  }

  const pvif = Math.pow(1 + rate, nper);
  if (!Number.isFinite(pvif)) return errorVal('#NUM!');
  const fv = -(pv * pvif + (pmt * (1 + rate * type) * (pvif - 1)) / rate);
  if (!Number.isFinite(fv) || Number.isNaN(fv)) return errorVal('#NUM!');
  return numberVal(fv);
}

/**
 * PV(rate, nper, pmt, [fv], [type])
 */
export function fnPV(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 5) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const n = getArgNum(args[1]); if (n.error) return errorVal(n.error as any);
  const pm = getArgNum(args[2]); if (pm.error) return errorVal(pm.error as any);
  const rate = r.val!;
  const nper = n.val!;
  const pmt = pm.val!;
  let fv = 0;
  let type = 0;
  if (args.length >= 4) {
    const f = getArgNum(args[3]); if (f.error) return errorVal(f.error as any);
    fv = f.val!;
  }
  if (args.length === 5) {
    const t = getArgNum(args[4]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }

  if (rate === 0) {
    return numberVal(-(fv + pmt * nper));
  }

  const pvif = Math.pow(1 + rate, nper);
  if (!Number.isFinite(pvif) || pvif === 0) return errorVal('#NUM!');
  const pv = -(fv + (pmt * (1 + rate * type) * (pvif - 1)) / rate) / pvif;
  if (!Number.isFinite(pv) || Number.isNaN(pv)) return errorVal('#NUM!');
  return numberVal(pv);
}

/**
 * NPER(rate, pmt, pv, [fv], [type])
 */
export function fnNPER(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 5) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const pm = getArgNum(args[1]); if (pm.error) return errorVal(pm.error as any);
  const p = getArgNum(args[2]); if (p.error) return errorVal(p.error as any);
  const rate = r.val!;
  const pmt = pm.val!;
  const pv = p.val!;
  let fv = 0;
  let type = 0;
  if (args.length >= 4) {
    const f = getArgNum(args[3]); if (f.error) return errorVal(f.error as any);
    fv = f.val!;
  }
  if (args.length === 5) {
    const t = getArgNum(args[4]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }

  if (rate === 0) {
    if (pmt === 0) return errorVal('#DIV/0!');
    return numberVal(-(pv + fv) / pmt);
  }

  const num = pmt * (1 + rate * type) - fv * rate;
  const den = pv * rate + pmt * (1 + rate * type);
  if (den === 0 || num / den <= 0) return errorVal('#NUM!');

  const nper = Math.log(num / den) / Math.log(1 + rate);
  if (!Number.isFinite(nper) || Number.isNaN(nper)) return errorVal('#NUM!');
  return numberVal(nper);
}

/**
 * IPMT(rate, per, nper, pv, [fv], [type])
 */
export function fnIPMT(args: EvalArg[]): CellValue {
  if (args.length < 4 || args.length > 6) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const pr = getArgNum(args[1]); if (pr.error) return errorVal(pr.error as any);
  const n = getArgNum(args[2]); if (n.error) return errorVal(n.error as any);
  const p = getArgNum(args[3]); if (p.error) return errorVal(p.error as any);
  const rate = r.val!;
  const per = pr.val!;
  const nper = n.val!;
  const pv = p.val!;
  let type = 0;
  if (args.length >= 5) {
    const f = getArgNum(args[4]); if (f.error) return errorVal(f.error as any);
  }
  if (args.length === 6) {
    const t = getArgNum(args[5]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }

  if (per < 1 || per > nper) return errorVal('#NUM!');
  if (type === 1 && per === 1) return numberVal(0);

  // Calcola PMT
  const pmtVal = fnPMT([args[0], args[2], args[3], ...(args.length >= 5 ? [args[4]] : []), ...(args.length === 6 ? [args[5]] : [])]);
  if (pmtVal.kind === 'error') return pmtVal;
  const pmt = (pmtVal as any).value as number;

  // Interesse del periodo = saldo a inizio periodo (nel segno di FV: opposto al debito) per il tasso.
  // Con i pagamenti anticipati (type 1) è quello dei pagamenti posticipati diviso (1 + tasso).
  if (rate === 0) return numberVal(0);
  const k = per - 1;
  const saldo = -(pv * Math.pow(1 + rate, k) + (pmt * (Math.pow(1 + rate, k) - 1)) / rate);
  const ipmt = (saldo * rate) / (type === 1 ? 1 + rate : 1);
  return numberVal(ipmt);
}

/**
 * PPMT(rate, per, nper, pv, [fv], [type])
 */
export function fnPPMT(args: EvalArg[]): CellValue {
  if (args.length < 4 || args.length > 6) return errorVal('#VALUE!');
  const pmtRes = fnPMT([args[0], args[2], args[3], ...(args.length >= 5 ? [args[4]] : []), ...(args.length === 6 ? [args[5]] : [])]);
  if (pmtRes.kind === 'error') return pmtRes;
  const ipmtRes = fnIPMT(args);
  if (ipmtRes.kind === 'error') return ipmtRes;

  const pmt = (pmtRes as any).value as number;
  const ipmt = (ipmtRes as any).value as number;
  return numberVal(pmt - ipmt);
}

/**
 * NPV(rate, val1, [val2], ...)
 */
export function fnNPV(args: EvalArg[]): CellValue {
  if (args.length < 2) return errorVal('#VALUE!');
  const r = getArgNum(args[0]); if (r.error) return errorVal(r.error as any);
  const rate = r.val!;
  if (rate === -1) return errorVal('#DIV/0!');

  const valArgs = args.slice(1);
  const { numbers, error } = extractAggregationNumbers(valArgs);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#VALUE!');

  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    const factor = Math.pow(1 + rate, i + 1);
    if (!Number.isFinite(factor) || factor === 0) return errorVal('#NUM!');
    total += numbers[i] / factor;
  }
  return numberVal(total);
}

/**
 * IRR(values, [guess])
 */
export function fnIRR(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  if (numbers.length < 2) return errorVal('#NUM!');

  let hasPos = false;
  let hasNeg = false;
  for (const n of numbers) {
    if (n > 0) hasPos = true;
    if (n < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return errorVal('#NUM!');

  let guess = 0.1;
  if (args.length === 2) {
    const g = getArgNum(args[1]);
    if (g.error) return errorVal(g.error as any);
    guess = g.val!;
  }

  // Metodo di Newton-Raphson
  let rate = guess;
  const maxIter = 100;
  const eps = 1e-7;

  for (let iter = 0; iter < maxIter; iter++) {
    let fValue = 0;
    let fDerivative = 0;

    for (let i = 0; i < numbers.length; i++) {
      const val = numbers[i];
      const p = Math.pow(1 + rate, i);
      fValue += val / p;
      fDerivative -= (i * val) / (p * (1 + rate));
    }

    if (Math.abs(fValue) < eps) {
      return numberVal(rate);
    }

    if (Math.abs(fDerivative) < 1e-12) {
      break;
    }

    const nextRate = rate - fValue / fDerivative;
    if (Math.abs(nextRate - rate) < eps) {
      return numberVal(nextRate);
    }
    rate = nextRate;
  }

  // Fallback con bisezione [-0.9999, 10.0]
  let low = -0.9999;
  let high = 10.0;
  const npvLow = calcNpv(low, numbers);
  const npvHigh = calcNpv(high, numbers);

  if (npvLow * npvHigh <= 0) {
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const npvMid = calcNpv(mid, numbers);
      if (Math.abs(npvMid) < eps || (high - low) < eps) {
        return numberVal(mid);
      }
      if (npvLow * npvMid < 0) {
        high = mid;
      } else {
        low = mid;
      }
    }
  }

  return errorVal('#NUM!');
}

function calcNpv(rate: number, cfs: number[]): number {
  let sum = 0;
  for (let i = 0; i < cfs.length; i++) {
    sum += cfs[i] / Math.pow(1 + rate, i);
  }
  return sum;
}

/**
 * RATE(nper, pmt, pv, [fv], [type], [guess])
 */
export function fnRATE(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 6) return errorVal('#VALUE!');
  const n = getArgNum(args[0]); if (n.error) return errorVal(n.error as any);
  const pm = getArgNum(args[1]); if (pm.error) return errorVal(pm.error as any);
  const p = getArgNum(args[2]); if (p.error) return errorVal(p.error as any);
  const nper = n.val!;
  const pmt = pm.val!;
  const pv = p.val!;
  let fv = 0;
  let type = 0;
  let guess = 0.1;
  if (args.length >= 4) {
    const f = getArgNum(args[3]); if (f.error) return errorVal(f.error as any);
    fv = f.val!;
  }
  if (args.length >= 5) {
    const t = getArgNum(args[4]); if (t.error) return errorVal(t.error as any);
    type = t.val! !== 0 ? 1 : 0;
  }
  if (args.length === 6) {
    const g = getArgNum(args[5]); if (g.error) return errorVal(g.error as any);
    guess = g.val!;
  }

  let rate = guess;
  const eps = 1e-7;
  for (let iter = 0; iter < 100; iter++) {
    const y0 = Math.pow(1 + rate, nper);
    const y1 = Math.pow(1 + rate, nper - 1);
    const f = pv * y0 + pmt * (1 + rate * type) * (y0 - 1) / (rate === 0 ? 1 : rate) + fv;
    const df = nper * pv * y1 + (pmt * type * (y0 - 1) + pmt * (1 + rate * type) * (nper * y1 * rate - (y0 - 1))) / (rate * rate);
    if (Math.abs(f) < eps) return numberVal(rate);
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < eps) return numberVal(newRate);
    rate = newRate;
  }
  return errorVal('#NUM!');
}

/**
 * SLN(cost, salvage, life)
 */
export function fnSLN(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const c = getArgNum(args[0]); if (c.error) return errorVal(c.error as any);
  const s = getArgNum(args[1]); if (s.error) return errorVal(s.error as any);
  const l = getArgNum(args[2]); if (l.error) return errorVal(l.error as any);
  const cost = c.val!;
  const salvage = s.val!;
  const life = l.val!;
  if (life <= 0) return errorVal('#DIV/0!');
  return numberVal((cost - salvage) / life);
}

/**
 * SYD(cost, salvage, life, per)
 */
export function fnSYD(args: EvalArg[]): CellValue {
  if (args.length !== 4) return errorVal('#VALUE!');
  const c = getArgNum(args[0]); if (c.error) return errorVal(c.error as any);
  const s = getArgNum(args[1]); if (s.error) return errorVal(s.error as any);
  const l = getArgNum(args[2]); if (l.error) return errorVal(l.error as any);
  const p = getArgNum(args[3]); if (p.error) return errorVal(p.error as any);
  const cost = c.val!;
  const salvage = s.val!;
  const life = l.val!;
  const per = p.val!;
  if (life <= 0 || per < 1 || per > life) return errorVal('#NUM!');
  const syd = ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
  return numberVal(syd);
}

/**
 * DB(cost, salvage, life, period, [month])
 */
export function fnDB(args: EvalArg[]): CellValue {
  if (args.length < 4 || args.length > 5) return errorVal('#VALUE!');
  const c = getArgNum(args[0]); if (c.error) return errorVal(c.error as any);
  const s = getArgNum(args[1]); if (s.error) return errorVal(s.error as any);
  const l = getArgNum(args[2]); if (l.error) return errorVal(l.error as any);
  const p = getArgNum(args[3]); if (p.error) return errorVal(p.error as any);
  const cost = c.val!;
  const salvage = s.val!;
  const life = l.val!;
  const period = p.val!;
  let month = 12;
  if (args.length === 5) {
    const m = getArgNum(args[4]); if (m.error) return errorVal(m.error as any);
    month = m.val!;
  }
  if (cost < 0 || salvage < 0 || life <= 0 || period <= 0 || period > life + 1 || month < 1 || month > 12) {
    return errorVal('#NUM!');
  }

  // Tasso fisso di ammortamento
  const rate = Math.round((1 - Math.pow(salvage / cost, 1 / life)) * 1000) / 1000;
  if (rate < 0 || !Number.isFinite(rate)) return errorVal('#NUM!');

  let totalDep = 0;
  for (let i = 1; i <= period; i++) {
    let dep = 0;
    if (i === 1) {
      dep = (cost * rate * month) / 12;
    } else if (i === life + 1) {
      dep = ((cost - totalDep) * rate * (12 - month)) / 12;
    } else {
      dep = (cost - totalDep) * rate;
    }
    if (i === period) return numberVal(dep);
    totalDep += dep;
  }
  return errorVal('#NUM!');
}

/**
 * DDB(cost, salvage, life, period, [factor])
 */
export function fnDDB(args: EvalArg[]): CellValue {
  if (args.length < 4 || args.length > 5) return errorVal('#VALUE!');
  const c = getArgNum(args[0]); if (c.error) return errorVal(c.error as any);
  const s = getArgNum(args[1]); if (s.error) return errorVal(s.error as any);
  const l = getArgNum(args[2]); if (l.error) return errorVal(l.error as any);
  const p = getArgNum(args[3]); if (p.error) return errorVal(p.error as any);
  const cost = c.val!;
  const salvage = s.val!;
  const life = l.val!;
  const period = p.val!;
  let factor = 2;
  if (args.length === 5) {
    const f = getArgNum(args[4]); if (f.error) return errorVal(f.error as any);
    factor = f.val!;
  }
  if (cost < 0 || salvage < 0 || life <= 0 || period <= 0 || period > life || factor <= 0) {
    return errorVal('#NUM!');
  }

  let totalDep = 0;
  for (let i = 1; i <= period; i++) {
    const remaining = cost - totalDep;
    let dep = remaining * (factor / life);
    if (remaining - dep < salvage) {
      dep = Math.max(0, remaining - salvage);
    }
    if (i === period) return numberVal(dep);
    totalDep += dep;
  }
  return errorVal('#NUM!');
}
