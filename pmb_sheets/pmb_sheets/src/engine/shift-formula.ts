/**
 * Funzione pura per lo spostamento dei riferimenti nelle formule (incolla e riempimento).
 * Sposta i soli riferimenti relativi (es. A1 -> B2 per delta=1,1).
 * Preserva i riferimenti assoluti ($A$1 non cambia, $A1 sposta solo riga, A$1 sposta solo colonna).
 * Preserva i nomi dei fogli e le costanti stringa letterali.
 * Se un riferimento esce dai limiti (riga < 1 o > 1.048.576, colonna < 1 o > 16.384), diventa #REF!.
 */

import { tokenize } from './tokenizer';
import { Parser, ASTNode } from './parser';
import { printAst } from './ast-printer';
import { formatCellAddress, formatRangeAddress, MAX_ROWS, MAX_COLS } from './address';

export function shiftFormula(formula: string, deltaRows: number, deltaCols: number): string {
  if (typeof formula !== 'string') {
    throw new Error('La formula deve essere una stringa');
  }

  const trimmed = formula.trim();
  const hasEqual = trimmed.startsWith('=');
  const rawExpr = hasEqual ? trimmed.substring(1).trim() : trimmed;

  if (rawExpr === '') {
    throw new Error('Formula vuota');
  }

  const { tokens, error: tokError } = tokenize(rawExpr);
  if (tokError) {
    throw new Error(`Errore di tokenizzazione: ${tokError}`);
  }

  const parser = new Parser(tokens);
  const { ast, error: parseError } = parser.parse();
  if (parseError || !ast) {
    throw new Error(`Errore di sintassi formula: ${parseError || 'AST nullo'}`);
  }

  if (deltaRows === 0 && deltaCols === 0) {
    return hasEqual ? `=${printAst(ast)}` : printAst(ast);
  }

  const shiftedAst = shiftNode(ast, deltaRows, deltaCols);
  const printed = printAst(shiftedAst);
  return hasEqual ? `=${printed}` : printed;
}

function shiftNode(node: ASTNode, deltaRows: number, deltaCols: number): ASTNode {
  switch (node.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
    case 'Error':
    case 'Empty':
    case 'Name':
    case 'Array':
      return node;

    case 'Cell': {
      const coord = { ...node.coord };
      let col = coord.col;
      let row = coord.row;

      if (!coord.colAbs) {
        col += deltaCols;
      }
      if (!coord.rowAbs) {
        row += deltaRows;
      }

      if (col < 1 || col > MAX_COLS || row < 1 || row > MAX_ROWS) {
        return {
          type: 'Error',
          error: '#REF!',
        };
      }

      coord.col = col;
      coord.row = row;
      return {
        type: 'Cell',
        raw: formatCellAddress(coord, Boolean(coord.sheet)),
        coord,
      };
    }

    case 'Range': {
      const coord = { ...node.coord };

      if (coord.isFullCol) {
        let c1 = coord.startCol;
        let c2 = coord.endCol;
        if (!coord.startColAbs) c1 += deltaCols;
        if (!coord.endColAbs) c2 += deltaCols;

        if (c1 < 1 || c1 > MAX_COLS || c2 < 1 || c2 > MAX_COLS) {
          return { type: 'Error', error: '#REF!' };
        }
        coord.startCol = Math.min(c1, c2);
        coord.endCol = Math.max(c1, c2);
      } else if (coord.isFullRow) {
        let r1 = coord.startRow;
        let r2 = coord.endRow;
        if (!coord.startRowAbs) r1 += deltaRows;
        if (!coord.endRowAbs) r2 += deltaRows;

        if (r1 < 1 || r1 > MAX_ROWS || r2 < 1 || r2 > MAX_ROWS) {
          return { type: 'Error', error: '#REF!' };
        }
        coord.startRow = Math.min(r1, r2);
        coord.endRow = Math.max(r1, r2);
      } else {
        let r1 = coord.startRow;
        let c1 = coord.startCol;
        let r2 = coord.endRow;
        let c2 = coord.endCol;

        if (!coord.startRowAbs) r1 += deltaRows;
        if (!coord.startColAbs) c1 += deltaCols;
        if (!coord.endRowAbs) r2 += deltaRows;
        if (!coord.endColAbs) c2 += deltaCols;

        if (
          r1 < 1 || r1 > MAX_ROWS ||
          r2 < 1 || r2 > MAX_ROWS ||
          c1 < 1 || c1 > MAX_COLS ||
          c2 < 1 || c2 > MAX_COLS
        ) {
          return { type: 'Error', error: '#REF!' };
        }

        coord.startRow = r1;
        coord.startCol = c1;
        coord.endRow = r2;
        coord.endCol = c2;
      }

      return {
        type: 'Range',
        raw: formatRangeAddress(coord, Boolean(coord.sheet)),
        coord,
      };
    }

    case 'Unary':
      return {
        type: 'Unary',
        op: node.op,
        expr: shiftNode(node.expr, deltaRows, deltaCols),
      };

    case 'Postfix':
      return {
        type: 'Postfix',
        op: node.op,
        expr: shiftNode(node.expr, deltaRows, deltaCols),
      };

    case 'Binary':
      return {
        type: 'Binary',
        op: node.op,
        left: shiftNode(node.left, deltaRows, deltaCols),
        right: shiftNode(node.right, deltaRows, deltaCols),
      };

    case 'Call':
      return {
        type: 'Call',
        name: node.name,
        args: node.args.map((arg) => shiftNode(arg, deltaRows, deltaCols)),
      };
  }
}
