/**
 * Serializzatore AST -> formula testuale per il motore di calcolo.
 * Rispetta le precedenze degli operatori, gestisce le parentesi minime necessarie,
 * preserva stringhe, booleani, nomi foglio (con escape se necessario) e costanti di errore.
 */

import { ASTNode } from './parser';
import { formatCellAddress, formatRangeAddress, MAX_ROWS, MAX_COLS } from './address';

function getOperatorPrecedence(op: string): number {
  switch (op) {
    case '=':
    case '<>':
    case '<':
    case '<=':
    case '>':
    case '>=':
      return 20;
    case '&':
      return 30;
    case '+':
    case '-':
      return 40;
    case '*':
    case '/':
      return 50;
    case '^':
      return 70;
    default:
      return 0;
  }
}

export function printAst(node: ASTNode, parentPrecedence = 0, isRightChild = false): string {
  switch (node.type) {
    case 'Number':
      return node.value.toString();

    case 'String':
      return `"${node.value.replace(/"/g, '""')}"`;

    case 'Boolean':
      return node.value ? 'TRUE' : 'FALSE';

    case 'Error':
      return node.error;

    case 'Cell': {
      const coord = node.coord;
      if (coord.row < 1 || coord.row > MAX_ROWS || coord.col < 1 || coord.col > MAX_COLS) {
        return '#REF!';
      }
      return formatCellAddress(coord, Boolean(coord.sheet));
    }

    case 'Range': {
      const coord = node.coord;
      if (
        coord.startRow < 1 || coord.startRow > MAX_ROWS ||
        coord.endRow < 1 || coord.endRow > MAX_ROWS ||
        coord.startCol < 1 || coord.startCol > MAX_COLS ||
        coord.endCol < 1 || coord.endCol > MAX_COLS
      ) {
        return '#REF!';
      }
      return formatRangeAddress(coord, Boolean(coord.sheet));
    }

    case 'Unary': {
      const inner = printAst(node.expr, 80);
      const res = `${node.op}${inner}`;
      if (parentPrecedence > 80) {
        return `(${res})`;
      }
      return res;
    }

    case 'Postfix': {
      const inner = printAst(node.expr, 85);
      const res = `${inner}%`;
      if (parentPrecedence > 85) {
        return `(${res})`;
      }
      return res;
    }

    case 'Binary': {
      const prec = getOperatorPrecedence(node.op);
      const leftStr = printAst(node.left, prec, false);
      const rightStr = printAst(node.right, prec, true);
      const res = `${leftStr}${node.op}${rightStr}`;

      if (prec < parentPrecedence || (prec === parentPrecedence && isRightChild && node.op !== '^')) {
        return `(${res})`;
      }
      return res;
    }

    case 'Empty':
      return '';

    case 'Name':
      return node.name;

    case 'Array':
      return `{${node.rows.map((riga) => riga.map((e) => printAst(e, 0)).join(',')).join(';')}}`;

    case 'Call': {
      // LAMBDA(x,x*2)(5): la chiamata subito dopo la definizione si scrive come l'ha scritta l'utente
      if (node.name === '__INVOCA__' && node.args.length >= 1) return `${printAst(node.args[0], 0)}(${node.args.slice(1).map((arg) => printAst(arg, 0)).join(',')})`;
      const argsStr = node.args.map((arg) => printAst(arg, 0)).join(',');
      return `${node.name.toUpperCase()}(${argsStr})`;
    }
  }
}
