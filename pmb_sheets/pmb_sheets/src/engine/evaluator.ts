/**
 * Valutatore di espressioni AST per formule di Fogli.
 * Gestione rigorosa dei tipi, errori canonici, coercizioni e short-circuiting.
 * Nessuna dipendenza esterna.
 */

import { ASTNode } from './parser';
import {
  CellValue,
  numberVal,
  textVal,
  boolVal,
  emptyVal,
  errorVal,
  arrayVal,
  coerceToNumber,
  coerceToText,
  compareValues,
} from './values';
import { RangeCoord, parseCellAddress, parseRangeAddress } from './address';
import { EvalArg, RangeArg, isRangeArg } from './functions/utils';
import { defaultFunctionRegistry } from './functions/registry';

export interface EvalContext {
  currentSheet: string;
  currentRow: number;
  currentCol: number;
  getCellValue: (sheet: string, row: number, col: number) => CellValue;
  getRangeArg: (range: RangeCoord) => RangeArg;
  getRangeValues?: (range: RangeCoord) => CellValue[][];
  /** la formula scritta in una cella, se ne ha una (serve a ISFORMULA, FORMULATEXT) */
  getCellFormula?: (sheet: string, row: number, col: number) => string | undefined;
  /** la riga è nascosta a mano o da un filtro? (SUBTOTAL e AGGREGATE le ignorano come in Excel) */
  rigaNascosta?: (sheet: string, row: number) => 'manuale' | 'filtro' | undefined;
}

/** Funzioni che lavorano su un valore alla volta: se ricevono un intervallo o una matrice si applicano a ogni elemento (come ABS(A1:A5) negli altri fogli di calcolo). */
const FUNZIONI_ELEMENTO_PER_ELEMENTO = new Set([
  'ABS', 'SIGN', 'SQRT', 'INT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'TRUNC', 'CEILING', 'FLOOR', 'MOD', 'POWER', 'EXP', 'LN', 'LOG', 'LOG10',
  'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'DEGREES', 'RADIANS', 'FACT',
  'UPPER', 'LOWER', 'PROPER', 'TRIM', 'LEN', 'LEFT', 'RIGHT', 'MID', 'VALUE', 'TEXT', 'SUBSTITUTE', 'REPLACE', 'REPT', 'EXACT', 'FIND', 'SEARCH', 'CODE', 'CHAR',
  'ISNUMBER', 'ISTEXT', 'ISBLANK', 'ISERROR', 'ISERR', 'ISNA', 'ISLOGICAL', 'ISEVEN', 'ISODD', 'NOT', 'N',
  'YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'HOUR', 'MINUTE', 'SECOND', 'DATE',
]);

/** Una funzione LAMBDA con l'ambiente in cui è nata (i nomi di LET e i parametri visibili in quel punto). */
interface Chiusura {
  parametri: string[];
  corpo: ASTNode;
  scope: Map<string, EvalArg>;
  chiusure: Map<string, Chiusura>;
}

/** Funzioni il cui ultimo argomento è una LAMBDA. */
const FUNZIONI_CON_LAMBDA = new Set(['MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY']);
/** Quante LAMBDA si possono annidare una dentro l'altra (si chiamano passando una funzione a se stessa): oltre, #NUM!. */
const PROFONDITA_MASSIMA_LAMBDA = 100;
/** Quante celle al massimo produce MAKEARRAY. */
const CELLE_MASSIME_MAKEARRAY = 250_000;

export class Evaluator {
  private context: EvalContext;
  /** Gli operatori e le funzioni lavorano sempre su intervalli e matrici elemento per elemento (matrici dinamiche). */
  private inArrayFormula = true;
  /** Nomi dati con LET */
  private scope = new Map<string, EvalArg>();
  /** Funzioni LAMBDA che hanno un nome (date con LET o passate come parametro a un'altra LAMBDA) */
  private chiusure = new Map<string, Chiusura>();
  private profonditaLambda = 0;

  constructor(context: EvalContext) {
    this.context = context;
  }

  public evaluate(ast: ASTNode): CellValue {
    const res = this.evalNode(ast);
    if (isRangeArg(res)) {
      // Un intervallo come risultato finale: una cella sola vale il suo contenuto, più celle si espandono
      const m = this.rangeArgToMatrix(res);
      return m.length === 1 && m[0].length === 1 ? m[0][0] : arrayVal(m);
    }
    return res;
  }

  private evalNode(node: ASTNode): EvalArg {
    switch (node.type) {
      case 'Number':
        return numberVal(node.value);

      case 'String':
        return textVal(node.value);

      case 'Boolean':
        return boolVal(node.value);

      case 'Error':
        return errorVal(node.error);

      case 'Empty':
        return emptyVal();

      case 'Name': {
        const nome = node.name.toUpperCase();
        if (this.chiusure.has(nome)) return errorVal('#VALUE!');   // una funzione LAMBDA non è un valore: si chiama, f(3)
        const v = this.scope.get(nome);
        return v ?? errorVal('#NAME?');
      }

      case 'Array':
        return arrayVal(node.rows.map((riga) => riga.map((e) => {
          const v = this.evalNode(e);
          return isRangeArg(v) ? errorVal('#VALUE!') : v;
        })));

      case 'Cell': {
        const sheet = node.coord.sheet || this.context.currentSheet;
        return this.context.getCellValue(sheet, node.coord.row, node.coord.col);
      }

      case 'Range': {
        const sheet = node.coord.sheet || this.context.currentSheet;
        const targetRange: RangeCoord = { ...node.coord, sheet };
        if (this.context.getRangeArg) {
          return this.context.getRangeArg(targetRange);
        }
        const matrix = this.context.getRangeValues ? this.context.getRangeValues(targetRange) : [];
        const rows = matrix.length;
        const cols = rows > 0 ? matrix[0].length : 0;
        const rangeArg: RangeArg = {
          kind: 'range',
          rowCount: rows,
          colCount: cols,
          values: matrix,
          coord: targetRange,
          get: (r, c) => (matrix[r] && matrix[r][c]) ? matrix[r][c] : emptyVal(),
        };
        return rangeArg;
      }

      case 'Unary': {
        const val = this.evalNode(node.expr);
        if (isRangeArg(val) || val.kind === 'array') {
          if (!this.inArrayFormula) return errorVal('#VALUE!');
          const m = isRangeArg(val) ? this.rangeArgToMatrix(val) : val.values;
          const res = m.map((row) =>
            row.map((item) => {
              if (item.kind === 'error') return item;
              if (node.op === '+') return item;
              const c = coerceToNumber(item);
              if (c.error) return errorVal(c.error);
              return numberVal(-c.value!);
            })
          );
          return arrayVal(res);
        }
        if (val.kind === 'error') return val;
        if (node.op === '+') return val; // +"x" vale "x": il più davanti non cambia niente

        const c = coerceToNumber(val);
        if (c.error) return errorVal(c.error);
        const n = c.value!;
        return numberVal(-n);
      }

      case 'Postfix': {
        const val = this.evalNode(node.expr);
        if (isRangeArg(val)) return errorVal('#VALUE!');
        if (val.kind === 'error') return val;

        const c = coerceToNumber(val);
        if (c.error) return errorVal(c.error);
        return numberVal(c.value! / 100);
      }

      case 'Binary':
        return this.evalBinary(node.op, node.left, node.right);

      case 'Call':
        return this.evalCall(node.name, node.args);

      default:
        return errorVal('#ERROR!');
    }
  }

  // ---- LAMBDA, MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY

  /** Un risultato qualunque come valore da restituire: un intervallo di una cella vale il suo contenuto, più celle diventano una matrice. */
  private comeValore(r: EvalArg): CellValue {
    if (!isRangeArg(r)) return r;
    const m = this.rangeArgToMatrix(r);
    return m.length === 1 && m[0].length === 1 ? m[0][0] : arrayVal(m);
  }

  /** Il risultato di una LAMBDA dentro MAP, SCAN, BYROW...: deve essere un valore solo (una matrice dà #VALUE!). */
  private scalare(r: EvalArg): CellValue {
    const m = this.comeMatrice(r);
    if (m === null) return r as CellValue;
    return m.length === 1 && m[0].length === 1 ? m[0][0] : errorVal('#VALUE!');
  }

  /** Un argomento che è una funzione LAMBDA, scritta lì o con un nome: la sua chiusura (null se non lo è). */
  private comeChiusura(nodo: ASTNode): Chiusura | null {
    if (nodo.type === 'Name') return this.chiusure.get(nodo.name.toUpperCase()) ?? null;
    if (nodo.type === 'Call' && nodo.name.toUpperCase() === 'LAMBDA') return this.creaChiusura(nodo.args);
    return null;
  }

  /** LAMBDA(parametro1, ..., calcolo): ricorda i nomi visibili adesso. Nomi dei parametri doppi o non validi: null. */
  private creaChiusura(argNodes: ASTNode[]): Chiusura | null {
    if (argNodes.length < 1) return null;
    const parametri: string[] = [];
    for (const p of argNodes.slice(0, -1)) {
      if (p.type !== 'Name') return null;
      const n = p.name.toUpperCase();
      if (parametri.includes(n)) return null;
      parametri.push(n);
    }
    return { parametri, corpo: argNodes[argNodes.length - 1], scope: new Map(this.scope), chiusure: new Map(this.chiusure) };
  }

  /** Chiama una LAMBDA: i parametri valgono i valori dati (una funzione LAMBDA passata come argomento resta una funzione). */
  private invoca(ch: Chiusura, valori: Array<EvalArg | Chiusura>): EvalArg {
    if (valori.length !== ch.parametri.length) return errorVal('#VALUE!');
    if (this.profonditaLambda >= PROFONDITA_MASSIMA_LAMBDA) return errorVal('#NUM!');
    const scopePrima = this.scope;
    const chiusurePrima = this.chiusure;
    this.scope = new Map(ch.scope);
    this.chiusure = new Map(ch.chiusure);
    this.profonditaLambda++;
    try {
      ch.parametri.forEach((nome, i) => {
        const v = valori[i];
        if ('corpo' in v) { this.chiusure.set(nome, v); this.scope.delete(nome); }
        else { this.scope.set(nome, v); this.chiusure.delete(nome); }
      });
      return this.evalNode(ch.corpo);
    } finally {
      this.profonditaLambda--;
      this.scope = scopePrima;
      this.chiusure = chiusurePrima;
    }
  }

  /** Chiama una LAMBDA con argomenti scritti come formule (calcolati qui, nell'ambiente di chi chiama). */
  private invocaDaNodi(ch: Chiusura, argNodes: ASTNode[]): EvalArg {
    const valori = argNodes.map((n) => this.comeChiusura(n) ?? this.evalNode(n));
    return this.invoca(ch, valori);
  }

  /** Una matrice di valori a partire da un argomento (un valore solo diventa una matrice 1×1). */
  private matriceDi(nodo: ASTNode): CellValue[][] {
    const v = this.evalNode(nodo);
    return this.comeMatrice(v) ?? [[v as CellValue]];
  }

  /** Il risultato di MAP, SCAN... : una cella sola vale il suo contenuto. */
  private matriceComeRisultato(m: CellValue[][]): CellValue {
    return m.length === 1 && m[0].length === 1 ? m[0][0] : arrayVal(m);
  }

  /** MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY: l'ultimo argomento è la LAMBDA da applicare. */
  private funzioneConLambda(fn: string, argNodes: ASTNode[]): CellValue {
    if (argNodes.length < 2) return errorVal('#VALUE!');
    const ch = this.comeChiusura(argNodes[argNodes.length - 1]);
    if (!ch) return errorVal('#VALUE!');
    const dati = argNodes.slice(0, -1);

    if (fn === 'MAP') {
      if (ch.parametri.length !== dati.length) return errorVal('#VALUE!');
      const matrici = dati.map((n) => this.matriceDi(n));
      const righe = Math.max(...matrici.map((m) => m.length));
      const colonne = Math.max(...matrici.map((m) => (m[0] ? m[0].length : 0)));
      if (righe * colonne > 1_000_000) return errorVal('#NUM!');
      const risultato: CellValue[][] = [];
      for (let r = 0; r < righe; r++) {
        const riga: CellValue[] = [];
        for (let c = 0; c < colonne; c++) {
          const valori = matrici.map((m) => (r < m.length && c < m[r].length ? m[r][c] : errorVal('#N/A')));
          riga.push(this.scalare(this.invoca(ch, valori)));
        }
        risultato.push(riga);
      }
      return this.matriceComeRisultato(risultato);
    }

    if (fn === 'REDUCE' || fn === 'SCAN') {
      if (dati.length < 1 || dati.length > 2 || ch.parametri.length !== 2) return errorVal('#VALUE!');
      const conIniziale = dati.length === 2;
      const matrice = this.matriceDi(dati[conIniziale ? 1 : 0]);
      let acc: EvalArg | undefined = conIniziale ? this.evalNode(dati[0]) : undefined;
      const percorso: CellValue[][] = [];
      for (const riga of matrice) {
        const rigaAcc: CellValue[] = [];
        for (const x of riga) {
          acc = acc === undefined ? x : this.invoca(ch, [acc, x]);
          if (fn === 'SCAN') rigaAcc.push(this.scalare(acc));
          else if (!isRangeArg(acc) && acc.kind === 'error') return acc;
        }
        percorso.push(rigaAcc);
      }
      if (fn === 'SCAN') return this.matriceComeRisultato(percorso);
      return acc === undefined ? errorVal('#VALUE!') : this.comeValore(acc);
    }

    if (fn === 'BYROW' || fn === 'BYCOL') {
      if (dati.length !== 1 || ch.parametri.length !== 1) return errorVal('#VALUE!');
      const matrice = this.matriceDi(dati[0]);
      if (fn === 'BYROW') {
        return this.matriceComeRisultato(matrice.map((riga) => [this.scalare(this.invoca(ch, [arrayVal([riga])]))]));
      }
      const colonne = matrice[0] ? matrice[0].length : 0;
      const risultati: CellValue[] = [];
      for (let c = 0; c < colonne; c++) risultati.push(this.scalare(this.invoca(ch, [arrayVal(matrice.map((riga) => [riga[c]]))])));
      return this.matriceComeRisultato([risultati]);
    }

    // MAKEARRAY(righe, colonne, LAMBDA(r, c, ...))
    if (dati.length !== 2 || ch.parametri.length !== 2) return errorVal('#VALUE!');
    const intero = (n: ASTNode): number | CellValue => {
      const v = this.evalNode(n);
      if (isRangeArg(v)) return errorVal('#VALUE!');
      if (v.kind === 'error') return v;
      const c = coerceToNumber(v);
      return c.error ? errorVal(c.error) : Math.trunc(c.value!);
    };
    const righe = intero(dati[0]);
    if (typeof righe !== 'number') return righe;
    const colonne = intero(dati[1]);
    if (typeof colonne !== 'number') return colonne;
    if (righe < 1 || colonne < 1 || righe * colonne > CELLE_MASSIME_MAKEARRAY) return errorVal('#NUM!');
    const risultato: CellValue[][] = [];
    for (let r = 1; r <= righe; r++) {
      const riga: CellValue[] = [];
      for (let c = 1; c <= colonne; c++) riga.push(this.scalare(this.invoca(ch, [numberVal(r), numberVal(c)])));
      risultato.push(riga);
    }
    return this.matriceComeRisultato(risultato);
  }

  /** Un valore come matrice, se lo è (intervallo o matrice); null se è un valore singolo. */
  private comeMatrice(v: EvalArg): CellValue[][] | null {
    if (isRangeArg(v)) return this.rangeArgToMatrix(v);
    if (v.kind === 'array') return v.values;
    return null;
  }

  /** Applica `f` a ogni posizione quando almeno un argomento è una matrice; i valori singoli e le matrici di una riga o colonna si estendono. null se nessuno è una matrice. */
  private perElemento(args: EvalArg[], f: (valori: CellValue[]) => CellValue): CellValue | null {
    const mats = args.map((a) => this.comeMatrice(a));
    if (mats.every((m) => m === null)) return null;
    const righe = Math.max(...mats.map((m) => (m ? m.length : 1)));
    const colonne = Math.max(...mats.map((m) => (m ? (m[0]?.length ?? 1) : 1)));
    const out: CellValue[][] = [];
    for (let r = 0; r < righe; r++) {
      const riga: CellValue[] = [];
      for (let c = 0; c < colonne; c++) {
        const valori = args.map((a, i) => {
          const m = mats[i];
          if (!m) return a as CellValue;
          const rr = m.length === 1 ? 0 : r;
          const cc = (m[0]?.length ?? 1) === 1 ? 0 : c;
          return m[rr]?.[cc] ?? errorVal('#N/A');
        });
        riga.push(f(valori));
      }
      out.push(riga);
    }
    return arrayVal(out);
  }

  /** Una matrice di valori come argomento di funzione (intervallo virtuale). */
  private matriceComeIntervallo(values: CellValue[][]): RangeArg {
    return {
      kind: 'range',
      rowCount: values.length,
      colCount: values[0]?.length ?? 0,
      values,
      get: (r, c) => values[r]?.[c] ?? emptyVal(),
    };
  }

  private rangeArgToMatrix(arg: RangeArg): CellValue[][] {
    const rows: CellValue[][] = [];
    for (let r = 0; r < arg.rowCount; r++) {
      const row: CellValue[] = [];
      for (let c = 0; c < arg.colCount; c++) {
        row.push(arg.get(r, c));
      }
      rows.push(row);
    }
    return rows;
  }

  private evalBinary(op: string, leftNode: ASTNode, rightNode: ASTNode): CellValue {
    const leftVal = this.evalNode(leftNode);
    if (leftVal.kind === 'error') return leftVal;

    const rightVal = this.evalNode(rightNode);
    if (rightVal.kind === 'error') return rightVal;

    const isLeftMatrix = isRangeArg(leftVal) || leftVal.kind === 'array';
    const isRightMatrix = isRangeArg(rightVal) || rightVal.kind === 'array';

    if (isLeftMatrix || isRightMatrix) {
      if (!this.inArrayFormula) return errorVal('#VALUE!');

      const mLeft = isLeftMatrix ? (isRangeArg(leftVal) ? this.rangeArgToMatrix(leftVal) : leftVal.values) : [[leftVal]];
      const mRight = isRightMatrix ? (isRangeArg(rightVal) ? this.rangeArgToMatrix(rightVal) : rightVal.values) : [[rightVal]];

      const rows = Math.max(mLeft.length, mRight.length);
      const cols = Math.max(mLeft[0]?.length || 1, mRight[0]?.length || 1);

      const resMatrix: CellValue[][] = [];
      for (let r = 0; r < rows; r++) {
        const rowArr: CellValue[] = [];
        for (let c = 0; c < cols; c++) {
          const vLeft = mLeft.length === 1 && mLeft[0].length === 1
            ? mLeft[0][0]
            : (mLeft[r] ? (mLeft[r][c] ?? (mLeft[r].length === 1 ? mLeft[r][0] : emptyVal())) : emptyVal());
          const vRight = mRight.length === 1 && mRight[0].length === 1
            ? mRight[0][0]
            : (mRight[r] ? (mRight[r][c] ?? (mRight[r].length === 1 ? mRight[r][0] : emptyVal())) : emptyVal());

          rowArr.push(this.evalScalarBinary(op, vLeft, vRight));
        }
        resMatrix.push(rowArr);
      }
      return arrayVal(resMatrix);
    }

    return this.evalScalarBinary(op, leftVal, rightVal);
  }

  private evalScalarBinary(op: string, leftVal: CellValue, rightVal: CellValue): CellValue {
    // Concatenazione &
    if (op === '&') {
      const leftText = coerceToText(leftVal);
      if (leftText.error) return errorVal(leftText.error);
      const rightText = coerceToText(rightVal);
      if (rightText.error) return errorVal(rightText.error);
      return textVal(leftText.value! + rightText.value!);
    }

    // Confronti (=, <>, <, <=, >, >=)
    if (op === '=' || op === '<>' || op === '<' || op === '<=' || op === '>' || op === '>=') {
      const cmp = compareValues(leftVal, rightVal);
      if (cmp.error) return errorVal(cmp.error);
      const diff = cmp.result!;
      switch (op) {
        case '=':
          return boolVal(diff === 0);
        case '<>':
          return boolVal(diff !== 0);
        case '<':
          return boolVal(diff < 0);
        case '<=':
          return boolVal(diff <= 0);
        case '>':
          return boolVal(diff > 0);
        case '>=':
          return boolVal(diff >= 0);
      }
    }

    // Operazioni aritmetiche (+, -, *, /, ^)
    const c1 = coerceToNumber(leftVal);
    if (c1.error) return errorVal(c1.error);
    const c2 = coerceToNumber(rightVal);
    if (c2.error) return errorVal(c2.error);

    const a = c1.value!;
    const b = c2.value!;

    switch (op) {
      case '+':
        return numberVal(a + b);
      case '-':
        return numberVal(a - b);
      case '*':
        return numberVal(a * b);
      case '/':
        if (b === 0) return errorVal('#DIV/0!');
        return numberVal(a / b);
      case '^': {
        if (a === 0 && b === 0) return numberVal(1);
        if (a === 0 && b < 0) return errorVal('#DIV/0!');
        if (a < 0 && !Number.isInteger(b)) return errorVal('#NUM!');
        const res = Math.pow(a, b);
        if (!Number.isFinite(res) || Number.isNaN(res)) return errorVal('#NUM!');
        return numberVal(res);
      }
      default:
        return errorVal('#ERROR!');
    }
  }

  private evalCall(name: string, argNodes: ASTNode[]): CellValue {
    const fnName = name.toUpperCase();

    // una LAMBDA con un nome (da LET o da un parametro) si chiama come una funzione: f(3)
    const chiamata = this.chiusure.get(fnName);
    if (chiamata) return this.comeValore(this.invocaDaNodi(chiamata, argNodes));
    // LAMBDA(x, x*2)(5): la chiamata subito dopo la definizione
    if (fnName === '__INVOCA__') {
      const ch = argNodes.length >= 1 ? this.comeChiusura(argNodes[0]) : null;
      return ch ? this.comeValore(this.invocaDaNodi(ch, argNodes.slice(1))) : errorVal('#VALUE!');
    }
    // una LAMBDA da sola, senza chiamarla, non è un valore
    if (fnName === 'LAMBDA') return errorVal('#VALUE!');
    if (FUNZIONI_CON_LAMBDA.has(fnName)) return this.funzioneConLambda(fnName, argNodes);

    if (fnName === 'ARRAYFORMULA' || fnName === 'FORMULA.MATRICIALE') {
      if (argNodes.length !== 1) return errorVal('#VALUE!');
      const prev = this.inArrayFormula;
      this.inArrayFormula = true;
      try {
        const res = this.evalNode(argNodes[0]);
        if (res.kind === 'error') return res;
        if (isRangeArg(res)) {
          return arrayVal(this.rangeArgToMatrix(res));
        }
        if (res.kind === 'array') {
          return res;
        }
        return arrayVal([[res]]);
      } finally {
        this.inArrayFormula = prev;
      }
    }

    if (fnName === 'ROW') {
      if (argNodes.length === 0) return numberVal(this.context.currentRow);
      if (argNodes.length > 1) return errorVal('#VALUE!');
      const arg0 = argNodes[0];
      if (arg0.type === 'Cell') return numberVal(arg0.coord.row);
      if (arg0.type === 'Range') return numberVal(arg0.coord.startRow);
      const evaluated = this.evalNode(arg0);
      if (isRangeArg(evaluated) && evaluated.coord) return numberVal(evaluated.coord.startRow);
      return errorVal('#VALUE!');
    }

    if (fnName === 'COLUMN') {
      if (argNodes.length === 0) return numberVal(this.context.currentCol);
      if (argNodes.length > 1) return errorVal('#VALUE!');
      const arg0 = argNodes[0];
      if (arg0.type === 'Cell') return numberVal(arg0.coord.col);
      if (arg0.type === 'Range') return numberVal(arg0.coord.startCol);
      const evaluated = this.evalNode(arg0);
      if (isRangeArg(evaluated) && evaluated.coord) return numberVal(evaluated.coord.startCol);
      return errorVal('#VALUE!');
    }

    // 1. Short-circuiting per funzioni condizionali
    if (fnName === 'IF') {
      if (argNodes.length < 2 || argNodes.length > 3) return errorVal('#VALUE!');
      const condVal = this.evalNode(argNodes[0]);
      // condizione su un intervallo o una matrice: si sceglie elemento per elemento
      if (this.comeMatrice(condVal) !== null) {
        const sceltaVero = this.evalNode(argNodes[1]);
        const sceltaFalso = argNodes.length === 3 ? this.evalNode(argNodes[2]) : boolVal(false);
        const risultato = this.perElemento([condVal, sceltaVero, sceltaFalso], ([c, v, f]) => {
          if (c.kind === 'error') return c;
          const n = coerceToNumber(c);
          if (n.error) return errorVal(n.error);
          return n.value !== 0 ? v : f;
        });
        return risultato ?? errorVal('#VALUE!');
      }
      if (isRangeArg(condVal)) return errorVal('#VALUE!');
      if (condVal.kind === 'error') return condVal;

      const cond = coerceToNumber(condVal);
      if (cond.error) return errorVal(cond.error);

      if (cond.value !== 0) {
        if (argNodes[1].type === 'Empty') return numberVal(0);
        const res = this.evalNode(argNodes[1]);
        return isRangeArg(res) ? errorVal('#VALUE!') : res;
      } else {
        if (argNodes.length === 3 && argNodes[2].type === 'Empty') return numberVal(0);
        if (argNodes.length === 3) {
          const res = this.evalNode(argNodes[2]);
          return isRangeArg(res) ? errorVal('#VALUE!') : res;
        }
        return boolVal(false);
      }
    }

    if (fnName === 'IFS') {
      if (argNodes.length === 0 || argNodes.length % 2 !== 0) return errorVal('#VALUE!');
      for (let i = 0; i < argNodes.length; i += 2) {
        const condVal = this.evalNode(argNodes[i]);
        if (isRangeArg(condVal)) return errorVal('#VALUE!');
        if (condVal.kind === 'error') return condVal;

        const cond = coerceToNumber(condVal);
        if (cond.error) return errorVal(cond.error);

        if (cond.value !== 0) {
          const res = this.evalNode(argNodes[i + 1]);
          return isRangeArg(res) ? errorVal('#VALUE!') : res;
        }
      }
      return errorVal('#N/A');
    }

    if (fnName === 'IFERROR') {
      if (argNodes.length !== 2) return errorVal('#VALUE!');
      const val = this.evalNode(argNodes[0]);
      if (this.comeMatrice(val) !== null) {
        const fallback = this.evalNode(argNodes[1]);
        return this.perElemento([val, fallback], ([v, f]) => (v.kind === 'error' ? f : v)) ?? errorVal('#VALUE!');
      }
      if (!isRangeArg(val) && val.kind === 'error') {
        const fallback = this.evalNode(argNodes[1]);
        return isRangeArg(fallback) ? errorVal('#VALUE!') : fallback;
      }
      return isRangeArg(val) ? errorVal('#VALUE!') : val;
    }

    if (fnName === 'IFNA') {
      if (argNodes.length !== 2) return errorVal('#VALUE!');
      const val = this.evalNode(argNodes[0]);
      if (!isRangeArg(val) && val.kind === 'error' && val.error === '#N/A') {
        const fallback = this.evalNode(argNodes[1]);
        return isRangeArg(fallback) ? errorVal('#VALUE!') : fallback;
      }
      return isRangeArg(val) ? errorVal('#VALUE!') : val;
    }

    if (fnName === 'CHOOSE') {
      if (argNodes.length < 2) return errorVal('#VALUE!');
      const idxVal = this.evalNode(argNodes[0]);
      if (isRangeArg(idxVal)) return errorVal('#VALUE!');
      if (idxVal.kind === 'error') return idxVal;

      const idxNum = coerceToNumber(idxVal);
      if (idxNum.error) return errorVal(idxNum.error);
      const idx = Math.trunc(idxNum.value!);
      if (idx < 1 || idx >= argNodes.length) return errorVal('#VALUE!');

      const chosen = this.evalNode(argNodes[idx]);
      return isRangeArg(chosen) ? errorVal('#VALUE!') : chosen;
    }

    if (fnName === 'SWITCH') {
      if (argNodes.length < 3) return errorVal('#VALUE!');
      const targetVal = this.evalNode(argNodes[0]);
      if (isRangeArg(targetVal)) return errorVal('#VALUE!');
      if (targetVal.kind === 'error') return targetVal;

      let i = 1;
      while (i + 1 < argNodes.length) {
        const caseVal = this.evalNode(argNodes[i]);
        if (!isRangeArg(caseVal)) {
          const cmp = compareValues(targetVal, caseVal);
          if (cmp.result === 0) {
            const resVal = this.evalNode(argNodes[i + 1]);
            return isRangeArg(resVal) ? errorVal('#VALUE!') : resVal;
          }
        }
        i += 2;
      }

      if (i < argNodes.length) {
        const defVal = this.evalNode(argNodes[i]);
        return isRangeArg(defVal) ? errorVal('#VALUE!') : defVal;
      }

      return errorVal('#N/A');
    }

    // Funzioni che guardano la cella indicata e non il suo valore: ISFORMULA, FORMULATEXT, CELL
    if (fnName === 'ISFORMULA' || fnName === 'FORMULATEXT' || fnName === 'CELL') {
      const nodoRif = fnName === 'CELL' ? argNodes[1] : argNodes[0];
      if (fnName === 'CELL' ? argNodes.length < 1 || argNodes.length > 2 : argNodes.length !== 1) return errorVal('#VALUE!');
      let foglio = this.context.currentSheet;
      let riga = this.context.currentRow;
      let col = this.context.currentCol;
      if (nodoRif) {
        if (nodoRif.type === 'Cell') { foglio = nodoRif.coord.sheet ?? foglio; riga = nodoRif.coord.row; col = nodoRif.coord.col; }
        else if (nodoRif.type === 'Range') { foglio = nodoRif.coord.sheet ?? foglio; riga = nodoRif.coord.startRow; col = nodoRif.coord.startCol; }
        else return errorVal('#VALUE!');
      } else if (fnName !== 'CELL') return errorVal('#VALUE!');
      const formula = this.context.getCellFormula?.(foglio, riga, col);
      if (fnName === 'ISFORMULA') return boolVal(formula !== undefined);
      if (fnName === 'FORMULATEXT') return formula === undefined ? errorVal('#N/A') : textVal(formula);
      const tipoV = this.evalNode(argNodes[0]);
      if (isRangeArg(tipoV) || tipoV.kind === 'error') return isRangeArg(tipoV) ? errorVal('#VALUE!') : tipoV;
      const tipo = (coerceToText(tipoV).value ?? '').toLowerCase();
      const valore = this.context.getCellValue(foglio, riga, col);
      const lettere = (n: number) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
      switch (tipo) {
        case 'row': return numberVal(riga);
        case 'col': case 'column': return numberVal(col);
        case 'address': return textVal(`$${lettere(col)}$${riga}`);
        case 'contents': return valore;
        case 'type': return textVal(valore.kind === 'empty' ? 'b' : valore.kind === 'text' ? 'l' : 'v');
        case 'filename': return textVal('');
        default: return errorVal('#VALUE!');
      }
    }

    // LET(nome, valore, ..., calcolo): dà nomi a dei valori dentro la formula
    if (fnName === 'LET') {
      if (argNodes.length < 3 || argNodes.length % 2 === 0) return errorVal('#VALUE!');
      const precedente = new Map(this.scope);
      const chiusurePrecedenti = new Map(this.chiusure);
      try {
        for (let i = 0; i < argNodes.length - 1; i += 2) {
          const nodoNome = argNodes[i];
          if (nodoNome.type !== 'Name') return errorVal('#VALUE!');
          const nome = nodoNome.name.toUpperCase();
          // un nome dato a una LAMBDA diventa una funzione richiamabile
          const funzione = this.comeChiusura(argNodes[i + 1]);
          if (funzione) { this.chiusure.set(nome, funzione); this.scope.delete(nome); continue; }
          if (argNodes[i + 1].type === 'Call' && (argNodes[i + 1] as { name: string }).name.toUpperCase() === 'LAMBDA') return errorVal('#VALUE!');   // LAMBDA scritta male
          const valore = this.evalNode(argNodes[i + 1]);
          if (!isRangeArg(valore) && valore.kind === 'error') return valore;
          this.chiusure.delete(nome);
          this.scope.set(nome, valore);
        }
        const risultato = this.evalNode(argNodes[argNodes.length - 1]);
        if (isRangeArg(risultato)) {
          const m = this.rangeArgToMatrix(risultato);
          return m.length === 1 && m[0].length === 1 ? m[0][0] : arrayVal(m);
        }
        return risultato;
      } finally {
        this.scope = precedente;
        this.chiusure = chiusurePrecedenti;
      }
    }

    // INDIRECT("A2") e INDIRECT("A1:B3"): il riferimento scritto come testo diventa il riferimento vero
    if (fnName === 'INDIRECT') {
      if (argNodes.length < 1 || argNodes.length > 2) return errorVal('#VALUE!');
      const t = this.evalNode(argNodes[0]);
      if (isRangeArg(t)) return errorVal('#VALUE!');
      if (t.kind === 'error') return t;
      const testo = coerceToText(t);
      if (testo.error) return errorVal(testo.error);
      const rif = testo.value!.trim();
      const comeCella = rif.includes(':') ? null : parseCellAddress(rif, this.context.currentSheet);
      const comeIntervallo = comeCella ? null : parseRangeAddress(rif, this.context.currentSheet);
      let risolto: EvalArg;
      if (comeCella) risolto = this.evalNode({ type: 'Cell', raw: rif, coord: comeCella });
      else if (comeIntervallo) risolto = this.evalNode({ type: 'Range', raw: rif, coord: comeIntervallo });
      else return errorVal('#REF!');
      if (isRangeArg(risolto)) {
        const m = this.rangeArgToMatrix(risolto);
        return m.length === 1 && m[0].length === 1 ? m[0][0] : arrayVal(m);
      }
      return risolto;
    }

    // 2. Chiamata regolare a registro funzioni
    const impl = defaultFunctionRegistry.get(fnName);
    if (!impl) {
      return errorVal('#NAME?');
    }

    // Valuta tutti gli argomenti (per OFFSET il primo, anche una cella sola, è un riferimento)
    const evaluatedArgs: EvalArg[] = [];
    for (let i = 0; i < argNodes.length; i++) {
      const argNode = argNodes[i];
      if (fnName === 'OFFSET' && i === 0 && argNode.type === 'Cell') {
        const c = argNode.coord;
        evaluatedArgs.push(this.evalNode({
          type: 'Range',
          raw: argNode.raw,
          coord: { sheet: c.sheet, startRow: c.row, endRow: c.row, startCol: c.col, endCol: c.col, startRowAbs: c.rowAbs, endRowAbs: c.rowAbs, startColAbs: c.colAbs, endColAbs: c.colAbs },
        }));
      } else {
        evaluatedArgs.push(this.evalNode(argNode));
      }
    }

    // Funzioni a un valore alla volta applicate a un intervallo o a una matrice: si applicano a ogni elemento
    const nomeCanonico = fnName;
    if (FUNZIONI_ELEMENTO_PER_ELEMENTO.has(nomeCanonico) && evaluatedArgs.some((a) => this.comeMatrice(a) !== null)) {
      const contestoElemento = { currentSheet: this.context.currentSheet, currentRow: this.context.currentRow, currentCol: this.context.currentCol };
      const risultato = this.perElemento(evaluatedArgs, (valori) => impl(valori, contestoElemento));
      if (risultato) return risultato;
    }
    // Le matrici passano alle funzioni come intervalli virtuali, così tutte le funzioni le leggono come un intervallo
    for (let i = 0; i < evaluatedArgs.length; i++) {
      const a = evaluatedArgs[i];
      if (!isRangeArg(a) && a.kind === 'array') evaluatedArgs[i] = this.matriceComeIntervallo(a.values);
    }

    const contextObj = {
      currentSheet: this.context.currentSheet,
      currentRow: this.context.currentRow,
      currentCol: this.context.currentCol,
      getCellValue: this.context.getCellValue,
      getCellFormula: this.context.getCellFormula,
      rigaNascosta: this.context.rigaNascosta,
    };

    return impl(evaluatedArgs, contextObj);
  }
}
