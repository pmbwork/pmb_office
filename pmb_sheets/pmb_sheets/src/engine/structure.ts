/**
 * Modulo per le operazioni strutturali sul motore di calcolo:
 * - Inserimento ed eliminazione di righe e colonne con riscrittura formule
 * - Espansione e riduzione corretta degli intervalli
 * - Conversione a #REF! per celle eliminate o fuori dai limiti (1..1048576, 1..16384)
 * - Riscrittura nomi foglio in tutte le formule della cartella di lavoro
 * - Funzioni pure senza stato, testabili deterministicamente
 */

import { ASTNode, Parser } from './parser';
import { tokenize } from './tokenizer';
import { printAst } from './ast-printer';
import {
  CellCoord,
  RangeCoord,
  formatCellAddress,
  formatRangeAddress,
  normalizeSheetName,
  MAX_ROWS,
  MAX_COLS,
} from './address';

export type StructureOpType = 'insert_rows' | 'delete_rows' | 'insert_cols' | 'delete_cols';

export interface StructureChangeOptions {
  type: StructureOpType;
  targetSheet: string;
  formulaSheet: string;
  startIndex: number; // 1-based
  count: number;
}

/**
 * Riscrive una formula testuale a fronte di un inserimento o eliminazione di righe/colonne.
 * Se la formula non contiene riferimenti o non è valida, restituisce la formula originale o l'errore.
 */
export function rewriteFormulaOnStructureChange(
  formula: string,
  options: StructureChangeOptions
): string {
  if (typeof formula !== 'string') return formula;
  const trimmed = formula.trim();
  const hasEqual = trimmed.startsWith('=');
  const rawExpr = hasEqual ? trimmed.substring(1).trim() : trimmed;
  if (!rawExpr) return formula;

  const { tokens, error: tokErr } = tokenize(rawExpr);
  if (tokErr || !tokens) return formula;

  const parser = new Parser(tokens);
  const { ast, error: parseErr } = parser.parse();
  if (parseErr || !ast) return formula;

  const rewrittenAst = transformAstStructure(ast, options);
  const printed = printAst(rewrittenAst);
  return hasEqual ? `=${printed}` : printed;
}

/**
 * Riscrive una formula testuale sostituendo i riferimenti a un foglio rinominato.
 */
export function rewriteFormulaOnSheetRename(
  formula: string,
  oldName: string,
  newName: string
): string {
  if (typeof formula !== 'string') return formula;
  const trimmed = formula.trim();
  const hasEqual = trimmed.startsWith('=');
  const rawExpr = hasEqual ? trimmed.substring(1).trim() : trimmed;
  if (!rawExpr) return formula;

  const { tokens, error: tokErr } = tokenize(rawExpr);
  if (tokErr || !tokens) return formula;

  const parser = new Parser(tokens);
  const { ast, error: parseErr } = parser.parse();
  if (parseErr || !ast) return formula;

  const normOld = normalizeSheetName(oldName);
  const rewrittenAst = transformAstRename(ast, normOld, newName);
  const printed = printAst(rewrittenAst);
  return hasEqual ? `=${printed}` : printed;
}

function transformAstRename(node: ASTNode, normOld: string, newName: string): ASTNode {
  switch (node.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
    case 'Error':
      return node;

    case 'Cell': {
      if (node.coord.sheet && normalizeSheetName(node.coord.sheet) === normOld) {
        const coord: CellCoord = { ...node.coord, sheet: newName };
        return {
          type: 'Cell',
          raw: formatCellAddress(coord, true),
          coord,
        };
      }
      return node;
    }

    case 'Range': {
      if (node.coord.sheet && normalizeSheetName(node.coord.sheet) === normOld) {
        const coord: RangeCoord = { ...node.coord, sheet: newName };
        return {
          type: 'Range',
          raw: formatRangeAddress(coord, true),
          coord,
        };
      }
      return node;
    }

    case 'Unary':
      return {
        ...node,
        expr: transformAstRename(node.expr, normOld, newName),
      };

    case 'Postfix':
      return {
        ...node,
        expr: transformAstRename(node.expr, normOld, newName),
      };

    case 'Binary':
      return {
        ...node,
        left: transformAstRename(node.left, normOld, newName),
        right: transformAstRename(node.right, normOld, newName),
      };

    case 'Call':
      return {
        ...node,
        args: node.args.map((a) => transformAstRename(a, normOld, newName)),
      };

    default:
      return node;
  }
}

function transformAstStructure(node: ASTNode, opt: StructureChangeOptions): ASTNode {
  switch (node.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
    case 'Error':
      return node;

    case 'Cell':
      return rewriteCellNode(node, opt);

    case 'Range':
      return rewriteRangeNode(node, opt);

    case 'Unary':
      return {
        ...node,
        expr: transformAstStructure(node.expr, opt),
      };

    case 'Postfix':
      return {
        ...node,
        expr: transformAstStructure(node.expr, opt),
      };

    case 'Binary':
      return {
        ...node,
        left: transformAstStructure(node.left, opt),
        right: transformAstStructure(node.right, opt),
      };

    case 'Call':
      return {
        ...node,
        args: node.args.map((a) => transformAstStructure(a, opt)),
      };

    default:
      return node;
  }
}

function matchesTargetSheet(nodeSheet: string | undefined, opt: StructureChangeOptions): boolean {
  const targetNorm = normalizeSheetName(opt.targetSheet);
  if (nodeSheet !== undefined) {
    return normalizeSheetName(nodeSheet) === targetNorm;
  }
  return normalizeSheetName(opt.formulaSheet) === targetNorm;
}

function rewriteCellNode(node: ASTNode & { type: 'Cell' }, opt: StructureChangeOptions): ASTNode {
  if (!matchesTargetSheet(node.coord.sheet, opt)) {
    return node;
  }

  const coord: CellCoord = { ...node.coord };
  const { type, startIndex, count } = opt;

  if (type === 'insert_rows') {
    if (coord.row >= startIndex) {
      coord.row += count;
      if (coord.row > MAX_ROWS) {
        return { type: 'Error', error: '#REF!' };
      }
    }
  } else if (type === 'delete_rows') {
    const endIndex = startIndex + count - 1;
    if (coord.row >= startIndex && coord.row <= endIndex) {
      return { type: 'Error', error: '#REF!' };
    }
    if (coord.row > endIndex) {
      coord.row -= count;
    }
  } else if (type === 'insert_cols') {
    if (coord.col >= startIndex) {
      coord.col += count;
      if (coord.col > MAX_COLS) {
        return { type: 'Error', error: '#REF!' };
      }
    }
  } else if (type === 'delete_cols') {
    const endIndex = startIndex + count - 1;
    if (coord.col >= startIndex && coord.col <= endIndex) {
      return { type: 'Error', error: '#REF!' };
    }
    if (coord.col > endIndex) {
      coord.col -= count;
    }
  }

  return {
    type: 'Cell',
    raw: formatCellAddress(coord, Boolean(coord.sheet)),
    coord,
  };
}

function rewriteRangeNode(node: ASTNode & { type: 'Range' }, opt: StructureChangeOptions): ASTNode {
  if (!matchesTargetSheet(node.coord.sheet, opt)) {
    return node;
  }

  const coord: RangeCoord = { ...node.coord };
  const { type, startIndex, count } = opt;

  if (type === 'insert_rows') {
    if (coord.isFullCol) {
      // Le colonne intere (es. A:B) coprono tutte le righe, non cambiano su inserimento righe
      return node;
    }

    if (startIndex <= coord.startRow) {
      // Inserimento prima dell'intervallo: trasla l'intero intervallo verso il basso
      coord.startRow += count;
      coord.endRow += count;
    } else if (startIndex > coord.startRow && startIndex <= coord.endRow) {
      // Inserimento all'interno dell'intervallo: espansione
      coord.endRow += count;
    }

    if (coord.startRow > MAX_ROWS || coord.endRow > MAX_ROWS) {
      return { type: 'Error', error: '#REF!' };
    }
  } else if (type === 'delete_rows') {
    if (coord.isFullCol) {
      return node;
    }

    const delStart = startIndex;
    const delEnd = startIndex + count - 1;

    // Caso 1: L'intervallo è interamente all'interno dell'eliminazione -> #REF!
    if (delStart <= coord.startRow && delEnd >= coord.endRow) {
      return { type: 'Error', error: '#REF!' };
    }

    // Caso 2: Eliminazione interamente prima dell'intervallo -> trasla verso l'alto
    if (delEnd < coord.startRow) {
      coord.startRow -= count;
      coord.endRow -= count;
    }
    // Caso 3: Eliminazione a cavallo dell'inizio dell'intervallo
    else if (delStart <= coord.startRow && delEnd < coord.endRow) {
      coord.startRow = delStart;
      coord.endRow -= count;
    }
    // Caso 4: Eliminazione interamente all'interno dell'intervallo -> contrazione
    else if (delStart > coord.startRow && delEnd < coord.endRow) {
      coord.endRow -= count;
    }
    // Caso 5: Eliminazione a cavallo della fine dell'intervallo
    else if (delStart > coord.startRow && delStart <= coord.endRow && delEnd >= coord.endRow) {
      coord.endRow = delStart - 1;
    }

    if (coord.startRow > coord.endRow) {
      return { type: 'Error', error: '#REF!' };
    }
  } else if (type === 'insert_cols') {
    if (coord.isFullRow) {
      return node;
    }

    if (startIndex <= coord.startCol) {
      coord.startCol += count;
      coord.endCol += count;
    } else if (startIndex > coord.startCol && startIndex <= coord.endCol) {
      coord.endCol += count;
    }

    if (coord.startCol > MAX_COLS || coord.endCol > MAX_COLS) {
      return { type: 'Error', error: '#REF!' };
    }
  } else if (type === 'delete_cols') {
    if (coord.isFullRow) {
      return node;
    }

    const delStart = startIndex;
    const delEnd = startIndex + count - 1;

    if (delStart <= coord.startCol && delEnd >= coord.endCol) {
      return { type: 'Error', error: '#REF!' };
    }

    if (delEnd < coord.startCol) {
      coord.startCol -= count;
      coord.endCol -= count;
    } else if (delStart <= coord.startCol && delEnd < coord.endCol) {
      coord.startCol = delStart;
      coord.endCol -= count;
    } else if (delStart > coord.startCol && delEnd < coord.endCol) {
      coord.endCol -= count;
    } else if (delStart > coord.startCol && delStart <= coord.endCol && delEnd >= coord.endCol) {
      coord.endCol = delStart - 1;
    }

    if (coord.startCol > coord.endCol) {
      return { type: 'Error', error: '#REF!' };
    }
  }

  return {
    type: 'Range',
    raw: formatRangeAddress(coord, Boolean(coord.sheet)),
    coord,
  };
}
