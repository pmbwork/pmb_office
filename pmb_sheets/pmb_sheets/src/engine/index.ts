/**
 * Entry point del motore di calcolo di Fogli (pmb_office).
 * Libreria pura in TypeScript, zero DOM, zero rete, zero I/O.
 */

export { createWorkbook, Workbook, Sheet } from './workbook';
export type { PublicCellInfo, ChangeListener, CellChange } from './workbook';
export type {
  CellValue,
  CellError,
  ValueKind,
  NumberValue,
  TextValue,
  BooleanValue,
  EmptyValue,
  ErrorValue,
  ArrayValue,
} from './values';
export {
  numberVal,
  textVal,
  boolVal,
  emptyVal,
  errorVal,
  arrayVal,
  isNumber,
  isText,
  isBoolean,
  isEmpty,
  isError,
  isArray,
  coerceToNumber,
  coerceToText,
  coerceToBoolean,
  compareValues,
} from './values';
export type { CellCoord, RangeCoord } from './address';
export {
  parseCellAddress,
  parseRangeAddress,
  formatCellAddress,
  formatRangeAddress,
  columnLettersToIndex,
  columnIndexToLetters,
  MAX_ROWS,
  MAX_COLS,
} from './address';
export { tokenize } from './tokenizer';
export type { Token, TokenType } from './tokenizer';
export { parseFormula, Parser } from './parser';
export type { ASTNode } from './parser';
export { Evaluator } from './evaluator';
export type { EvalContext } from './evaluator';
export { DependencyGraph } from './graph';
export { defaultFunctionRegistry } from './functions/registry';
export { printAst } from './ast-printer';
export { shiftFormula } from './shift-formula';
export {
  translateFormula,
  EN_TO_IT_FUNCTIONS,
  IT_TO_EN_FUNCTIONS,
  EN_LOCALE,
  IT_LOCALE,
} from './i18n';
export type { LocaleConfig } from './i18n';
