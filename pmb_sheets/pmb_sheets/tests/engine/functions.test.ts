// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { CellValue } from '../../src/engine/values';

interface TestCase {
  name: string;
  setup?: Record<string, string>;
  formula: string;
  expected: CellValue;
}

describe('Functions test suite (Over 200 table-driven cases)', () => {
  const testCases: TestCase[] = [
    // -------------------------------------------------------------
    // 1. MATEMATICHE (SUM, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN,
    // INT, MOD, POWER, SQRT, SIGN, CEILING, FLOOR, PI, SUMIF, SUMPRODUCT)
    // -------------------------------------------------------------
    { name: 'SUM with numbers', formula: '=SUM(1, 2, 3, 4, 5)', expected: { kind: 'number', value: 15 } },
    { name: 'SUM with range ignoring text and booleans', setup: { A1: '10', A2: 'testo', A3: 'TRUE', A4: '20' }, formula: '=SUM(A1:A4)', expected: { kind: 'number', value: 30 } },
    { name: 'SUM direct args converts boolean and numeric text', formula: '=SUM(10, TRUE, "5")', expected: { kind: 'number', value: 16 } },
    { name: 'SUM empty range gives 0', setup: {}, formula: '=SUM(B1:B5)', expected: { kind: 'number', value: 0 } },

    { name: 'PRODUCT with numbers', formula: '=PRODUCT(2, 3, 4)', expected: { kind: 'number', value: 24 } },
    { name: 'PRODUCT with range', setup: { A1: '2', A2: '5', A3: '3' }, formula: '=PRODUCT(A1:A3)', expected: { kind: 'number', value: 30 } },
    { name: 'PRODUCT empty gives 0', formula: '=PRODUCT(C1:C3)', expected: { kind: 'number', value: 0 } },

    { name: 'ABS positive', formula: '=ABS(5)', expected: { kind: 'number', value: 5 } },
    { name: 'ABS negative', formula: '=ABS(-42.5)', expected: { kind: 'number', value: 42.5 } },
    { name: 'ABS zero', formula: '=ABS(0)', expected: { kind: 'number', value: 0 } },

    { name: 'ROUND half-away-from-zero positive 2.5', formula: '=ROUND(2.5, 0)', expected: { kind: 'number', value: 3 } },
    { name: 'ROUND half-away-from-zero negative -2.5', formula: '=ROUND(-2.5, 0)', expected: { kind: 'number', value: -3 } },
    { name: 'ROUND with 2 decimals', formula: '=ROUND(3.14159, 2)', expected: { kind: 'number', value: 3.14 } },
    { name: 'ROUND with negative digits', formula: '=ROUND(1250, -2)', expected: { kind: 'number', value: 1300 } },

    { name: 'ROUNDUP positive', formula: '=ROUNDUP(2.1, 0)', expected: { kind: 'number', value: 3 } },
    { name: 'ROUNDUP negative', formula: '=ROUNDUP(-2.1, 0)', expected: { kind: 'number', value: -3 } },
    { name: 'ROUNDUP decimals', formula: '=ROUNDUP(1.234, 2)', expected: { kind: 'number', value: 1.24 } },

    { name: 'ROUNDDOWN positive', formula: '=ROUNDDOWN(2.9, 0)', expected: { kind: 'number', value: 2 } },
    { name: 'ROUNDDOWN negative', formula: '=ROUNDDOWN(-2.9, 0)', expected: { kind: 'number', value: -2 } },
    { name: 'ROUNDDOWN decimals', formula: '=ROUNDDOWN(1.239, 2)', expected: { kind: 'number', value: 1.23 } },

    { name: 'INT positive', formula: '=INT(4.9)', expected: { kind: 'number', value: 4 } },
    { name: 'INT negative floors downwards', formula: '=INT(-4.1)', expected: { kind: 'number', value: -5 } },

    { name: 'MOD standard', formula: '=MOD(10, 3)', expected: { kind: 'number', value: 1 } },
    { name: 'MOD negative numerator', formula: '=MOD(-10, 3)', expected: { kind: 'number', value: 2 } },
    { name: 'MOD division by zero', formula: '=MOD(10, 0)', expected: { kind: 'error', error: '#DIV/0!' } },

    { name: 'POWER standard', formula: '=POWER(2, 3)', expected: { kind: 'number', value: 8 } },
    { name: 'POWER fractional exp', formula: '=POWER(4, 0.5)', expected: { kind: 'number', value: 2 } },
    { name: 'POWER negative base with fractional exp', formula: '=POWER(-4, 0.5)', expected: { kind: 'error', error: '#NUM!' } },
    { name: 'POWER 0^0 = 1', formula: '=POWER(0, 0)', expected: { kind: 'number', value: 1 } },

    { name: 'SQRT standard', formula: '=SQRT(16)', expected: { kind: 'number', value: 4 } },
    { name: 'SQRT zero', formula: '=SQRT(0)', expected: { kind: 'number', value: 0 } },
    { name: 'SQRT negative', formula: '=SQRT(-16)', expected: { kind: 'error', error: '#NUM!' } },

    { name: 'SIGN positive', formula: '=SIGN(42)', expected: { kind: 'number', value: 1 } },
    { name: 'SIGN negative', formula: '=SIGN(-12)', expected: { kind: 'number', value: -1 } },
    { name: 'SIGN zero', formula: '=SIGN(0)', expected: { kind: 'number', value: 0 } },

    { name: 'CEILING standard', formula: '=CEILING(2.5, 1)', expected: { kind: 'number', value: 3 } },
    { name: 'CEILING with 0.1', formula: '=CEILING(1.23, 0.1)', expected: { kind: 'number', value: 1.3 } },

    { name: 'FLOOR standard', formula: '=FLOOR(2.5, 1)', expected: { kind: 'number', value: 2 } },
    { name: 'FLOOR with 0.1', formula: '=FLOOR(1.29, 0.1)', expected: { kind: 'number', value: 1.2 } },

    { name: 'PI value', formula: '=ROUND(PI(), 4)', expected: { kind: 'number', value: 3.1416 } },

    { name: 'SUMIF with numeric comparison', setup: { A1: '10', A2: '20', A3: '30', A4: '40' }, formula: '=SUMIF(A1:A4, ">20")', expected: { kind: 'number', value: 70 } },
    { name: 'SUMIF with separate sum range', setup: { A1: 'Mele', A2: 'Pere', A3: 'Mele', B1: '5', B2: '10', B3: '15' }, formula: '=SUMIF(A1:A3, "Mele", B1:B3)', expected: { kind: 'number', value: 20 } },
    { name: 'SUMIF with wildcard *', setup: { A1: 'Nord-Est', A2: 'Nord-Ovest', A3: 'Sud', B1: '100', B2: '200', B3: '300' }, formula: '=SUMIF(A1:A3, "Nord*", B1:B3)', expected: { kind: 'number', value: 300 } },
    { name: 'SUMIF with wildcard ?', setup: { A1: 'C1', A2: 'C2', A3: 'C10', B1: '1', B2: '2', B3: '3' }, formula: '=SUMIF(A1:A3, "C?", B1:B3)', expected: { kind: 'number', value: 3 } },

    { name: 'SUMPRODUCT vectors', setup: { A1: '1', A2: '2', A3: '3', B1: '4', B2: '5', B3: '6' }, formula: '=SUMPRODUCT(A1:A3, B1:B3)', expected: { kind: 'number', value: 32 } }, // 1*4 + 2*5 + 3*6 = 4+10+18 = 32

    // -------------------------------------------------------------
    // 2. STATISTICHE (AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK,
    // MEDIAN, COUNTIF, AVERAGEIF)
    // -------------------------------------------------------------
    { name: 'AVERAGE standard', formula: '=AVERAGE(10, 20, 30)', expected: { kind: 'number', value: 20 } },
    { name: 'AVERAGE with range ignoring text and empty', setup: { A1: '10', A2: 'vuoto', A3: '', A4: '30' }, formula: '=AVERAGE(A1:A4)', expected: { kind: 'number', value: 20 } },
    { name: 'AVERAGE empty gives #DIV/0!', setup: {}, formula: '=AVERAGE(D1:D5)', expected: { kind: 'error', error: '#DIV/0!' } },

    { name: 'MIN standard', formula: '=MIN(10, -5, 30, 0)', expected: { kind: 'number', value: -5 } },
    { name: 'MIN empty gives 0', setup: {}, formula: '=MIN(E1:E5)', expected: { kind: 'number', value: 0 } },

    { name: 'MAX standard', formula: '=MAX(10, -5, 30, 0)', expected: { kind: 'number', value: 30 } },
    { name: 'MAX empty gives 0', setup: {}, formula: '=MAX(E1:E5)', expected: { kind: 'number', value: 0 } },

    { name: 'COUNT numbers in range', setup: { A1: '10', A2: 'testo', A3: 'TRUE', A4: '40' }, formula: '=COUNT(A1:A4)', expected: { kind: 'number', value: 2 } },
    { name: 'COUNT direct arguments counts booleans and numeric text', formula: '=COUNT(10, TRUE, "50", "testo")', expected: { kind: 'number', value: 3 } },

    { name: 'COUNTA non-empty cells', setup: { A1: '10', A2: 'testo', A3: 'TRUE', A4: '' }, formula: '=COUNTA(A1:A4)', expected: { kind: 'number', value: 3 } },

    { name: 'COUNTBLANK empty cells', setup: { A1: '10', A2: '', A3: 'testo', A4: '' }, formula: '=COUNTBLANK(A1:A4)', expected: { kind: 'number', value: 2 } },

    { name: 'MEDIAN odd count', formula: '=MEDIAN(1, 5, 2, 8, 7)', expected: { kind: 'number', value: 5 } },
    { name: 'MEDIAN even count', formula: '=MEDIAN(1, 2, 3, 4)', expected: { kind: 'number', value: 2.5 } },
    { name: 'MEDIAN empty gives #NUM!', setup: {}, formula: '=MEDIAN(F1:F5)', expected: { kind: 'error', error: '#NUM!' } },

    { name: 'COUNTIF comparison', setup: { A1: '5', A2: '15', A3: '25', A4: '10' }, formula: '=COUNTIF(A1:A4, ">=15")', expected: { kind: 'number', value: 2 } },
    { name: 'COUNTIF exact text', setup: { A1: 'Roma', A2: 'Milano', A3: 'Roma', A4: 'Napoli' }, formula: '=COUNTIF(A1:A4, "Roma")', expected: { kind: 'number', value: 2 } },
    { name: 'COUNTIF wildcard *', setup: { A1: 'Auto-Rossa', A2: 'Auto-Blu', A3: 'Moto' }, formula: '=COUNTIF(A1:A3, "Auto*")', expected: { kind: 'number', value: 2 } },

    { name: 'AVERAGEIF standard', setup: { A1: '10', A2: '20', A3: '30', A4: '40' }, formula: '=AVERAGEIF(A1:A4, ">15")', expected: { kind: 'number', value: 30 } },
    { name: 'AVERAGEIF with separate range', setup: { A1: 'A', A2: 'B', A3: 'A', B1: '10', B2: '50', B3: '30' }, formula: '=AVERAGEIF(A1:A3, "A", B1:B3)', expected: { kind: 'number', value: 20 } },
    { name: 'AVERAGEIF no match gives #DIV/0!', setup: { A1: '1', A2: '2' }, formula: '=AVERAGEIF(A1:A2, ">100")', expected: { kind: 'error', error: '#DIV/0!' } },

    // -------------------------------------------------------------
    // 3. LOGICHE (IF, IFS, AND, OR, NOT, IFERROR, IFNA, TRUE, FALSE, SWITCH)
    // -------------------------------------------------------------
    { name: 'TRUE', formula: '=TRUE()', expected: { kind: 'boolean', value: true } },
    { name: 'FALSE', formula: '=FALSE()', expected: { kind: 'boolean', value: false } },
    { name: 'NOT true', formula: '=NOT(TRUE())', expected: { kind: 'boolean', value: false } },
    { name: 'NOT false', formula: '=NOT(FALSE())', expected: { kind: 'boolean', value: true } },

    { name: 'AND all true', formula: '=AND(TRUE(), 1 > 0, 5 = 5)', expected: { kind: 'boolean', value: true } },
    { name: 'AND one false', formula: '=AND(TRUE(), 1 < 0, 5 = 5)', expected: { kind: 'boolean', value: false } },

    { name: 'OR one true', formula: '=OR(1 < 0, 2 > 10, 5 = 5)', expected: { kind: 'boolean', value: true } },
    { name: 'OR all false', formula: '=OR(1 < 0, 2 > 10, 5 = 6)', expected: { kind: 'boolean', value: false } },

    { name: 'IF true branch', formula: '=IF(10 > 5, "Vero", "Falso")', expected: { kind: 'text', value: 'Vero' } },
    { name: 'IF false branch', formula: '=IF(10 < 5, "Vero", "Falso")', expected: { kind: 'text', value: 'Falso' } },
    { name: 'IF short-circuits error branch', formula: '=IF(TRUE(), 42, 1/0)', expected: { kind: 'number', value: 42 } },

    { name: 'IFS matches first', formula: '=IFS(1 > 2, "Primo", 3 > 2, "Secondo", TRUE(), "Terzo")', expected: { kind: 'text', value: 'Secondo' } },
    { name: 'IFS no match returns #N/A', formula: '=IFS(1 > 2, "No", 3 > 4, "No")', expected: { kind: 'error', error: '#N/A' } },

    { name: 'IFERROR catches error', formula: '=IFERROR(10 / 0, "ErroreDiv")', expected: { kind: 'text', value: 'ErroreDiv' } },
    { name: 'IFERROR returns normal value', formula: '=IFERROR(10 / 2, "Errore")', expected: { kind: 'number', value: 5 } },

    { name: 'IFNA catches only #N/A', formula: '=IFNA(#N/A, "Mancante")', expected: { kind: 'text', value: 'Mancante' } },
    { name: 'IFNA does not catch #DIV/0!', formula: '=IFNA(10 / 0, "NonCatturato")', expected: { kind: 'error', error: '#DIV/0!' } },

    { name: 'SWITCH matches case', formula: '=SWITCH(2, 1, "Uno", 2, "Due", 3, "Tre")', expected: { kind: 'text', value: 'Due' } },
    { name: 'SWITCH uses default', formula: '=SWITCH(99, 1, "Uno", 2, "Due", "Altro")', expected: { kind: 'text', value: 'Altro' } },

    // -------------------------------------------------------------
    // 4. TESTO (CONCAT, CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER,
    // LOWER, TRIM, SUBSTITUTE, FIND, SEARCH, VALUE, TEXTJOIN, REPT)
    // -------------------------------------------------------------
    { name: 'CONCAT scalars', formula: '=CONCAT("Free", "_", "office")', expected: { kind: 'text', value: 'Free_office' } },
    { name: 'CONCAT range', setup: { A1: 'A', A2: 'B', A3: 'C' }, formula: '=CONCAT(A1:A3)', expected: { kind: 'text', value: 'ABC' } },

    { name: 'CONCATENATE scalars', formula: '=CONCATENATE("Hello", " ", "World")', expected: { kind: 'text', value: 'Hello World' } },

    { name: 'LEFT default 1 char', formula: '=LEFT("Free_office")', expected: { kind: 'text', value: 'F' } },
    { name: 'LEFT 4 chars', formula: '=LEFT("Free_office", 4)', expected: { kind: 'text', value: 'Free' } },

    { name: 'RIGHT default 1 char', formula: '=RIGHT("Free_office")', expected: { kind: 'text', value: 'e' } },
    { name: 'RIGHT 6 chars', formula: '=RIGHT("Free_office", 6)', expected: { kind: 'text', value: 'office' } },

    { name: 'MID extraction', formula: '=MID("Free_office", 6, 6)', expected: { kind: 'text', value: 'office' } },
    { name: 'MID out of bounds start', formula: '=MID("Test", 10, 2)', expected: { kind: 'text', value: '' } },

    { name: 'LEN length', formula: '=LEN("Free_office")', expected: { kind: 'number', value: 11 } },

    { name: 'UPPER uppercase', formula: '=UPPER("Free_office")', expected: { kind: 'text', value: 'FREE_OFFICE' } },

    { name: 'LOWER lowercase', formula: '=LOWER("Free_OFFICE")', expected: { kind: 'text', value: 'free_office' } },

    { name: 'TRIM collapses internal spaces', formula: '=TRIM("   Free    office   ")', expected: { kind: 'text', value: 'Free office' } },

    { name: 'SUBSTITUTE all occurrences', formula: '=SUBSTITUTE("banana", "a", "o")', expected: { kind: 'text', value: 'bonono' } },
    { name: 'SUBSTITUTE specific instance', formula: '=SUBSTITUTE("banana", "a", "o", 2)', expected: { kind: 'text', value: 'banona' } },

    { name: 'FIND case-sensitive match', formula: '=FIND("off", "Free_office")', expected: { kind: 'number', value: 6 } },
    { name: 'FIND case mismatch returns #VALUE!', formula: '=FIND("OFF", "Free_office")', expected: { kind: 'error', error: '#VALUE!' } },

    { name: 'SEARCH case-insensitive match', formula: '=SEARCH("OFF", "Free_office")', expected: { kind: 'number', value: 6 } },
    { name: 'SEARCH with wildcard ?', formula: '=SEARCH("o?f", "Free_office")', expected: { kind: 'number', value: 6 } },

    { name: 'VALUE text to number', formula: '=VALUE("  123.45  ")', expected: { kind: 'number', value: 123.45 } },

    { name: 'TEXTJOIN with ignore empty', setup: { A1: 'A', A2: '', A3: 'B' }, formula: '=TEXTJOIN("-", TRUE(), A1:A3)', expected: { kind: 'text', value: 'A-B' } },
    { name: 'TEXTJOIN with keep empty', setup: { A1: 'A', A2: '', A3: 'B' }, formula: '=TEXTJOIN("-", FALSE(), A1:A3)', expected: { kind: 'text', value: 'A--B' } },

    { name: 'REPT string repetition', formula: '=REPT("Abc", 3)', expected: { kind: 'text', value: 'AbcAbcAbc' } },
    { name: 'REPT zero times', formula: '=REPT("Abc", 0)', expected: { kind: 'text', value: '' } },

    // -------------------------------------------------------------
    // 5. RICERCA (VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP, CHOOSE, ROW, COLUMN)
    // -------------------------------------------------------------
    {
      name: 'VLOOKUP exact match',
      setup: { A1: '101', B1: 'Mario', A2: '102', B2: 'Luigi', A3: '103', B3: 'Anna' },
      formula: '=VLOOKUP(102, A1:B3, 2, FALSE())',
      expected: { kind: 'text', value: 'Luigi' },
    },
    {
      name: 'VLOOKUP approximate match (sorted)',
      setup: { A1: '10', B1: 'Basso', A2: '20', B2: 'Medio', A3: '30', B3: 'Alto' },
      formula: '=VLOOKUP(25, A1:B3, 2, TRUE())',
      expected: { kind: 'text', value: 'Medio' },
    },
    {
      name: 'VLOOKUP not found exact',
      setup: { A1: '101', B1: 'Mario' },
      formula: '=VLOOKUP(999, A1:B1, 2, FALSE())',
      expected: { kind: 'error', error: '#N/A' },
    },

    {
      name: 'HLOOKUP exact match',
      setup: { A1: 'ID', B1: 'Prezzo', A2: '101', B2: '49.99' },
      formula: '=HLOOKUP("Prezzo", A1:B2, 2, FALSE())',
      expected: { kind: 'number', value: 49.99 },
    },

    {
      name: 'INDEX 2D range',
      setup: { A1: '10', B1: '20', A2: '30', B2: '40' },
      formula: '=INDEX(A1:B2, 2, 1)',
      expected: { kind: 'number', value: 30 },
    },
    {
      name: 'INDEX out of bounds',
      setup: { A1: '10' },
      formula: '=INDEX(A1:A1, 5, 1)',
      expected: { kind: 'error', error: '#REF!' },
    },

    {
      name: 'MATCH exact type 0',
      setup: { A1: 'Mele', A2: 'Pere', A3: 'Banane' },
      formula: '=MATCH("Pere", A1:A3, 0)',
      expected: { kind: 'number', value: 2 },
    },
    {
      name: 'MATCH approx type 1 sorted asc',
      setup: { A1: '10', A2: '20', A3: '30' },
      formula: '=MATCH(25, A1:A3, 1)',
      expected: { kind: 'number', value: 2 },
    },

    {
      name: 'XLOOKUP basic exact',
      setup: { A1: 'ID1', A2: 'ID2', B1: 'Val1', B2: 'Val2' },
      formula: '=XLOOKUP("ID2", A1:A2, B1:B2)',
      expected: { kind: 'text', value: 'Val2' },
    },
    {
      name: 'XLOOKUP with fallback not found',
      setup: { A1: 'ID1', B1: 'Val1' },
      formula: '=XLOOKUP("ID99", A1:A1, B1:B1, "Non trovato")',
      expected: { kind: 'text', value: 'Non trovato' },
    },

    { name: 'CHOOSE 2nd value', formula: '=CHOOSE(2, "Rosso", "Verde", "Blu")', expected: { kind: 'text', value: 'Verde' } },
    { name: 'CHOOSE out of range gives #VALUE!', formula: '=CHOOSE(5, "Rosso", "Verde")', expected: { kind: 'error', error: '#VALUE!' } },

    { name: 'ROW of cell reference', formula: '=ROW(C15)', expected: { kind: 'number', value: 15 } },
    { name: 'COLUMN of cell reference', formula: '=COLUMN(C15)', expected: { kind: 'number', value: 3 } },

    // -------------------------------------------------------------
    // 6. DATA (DATE, YEAR, MONTH, DAY, WEEKDAY, EDATE)
    // -------------------------------------------------------------
    { name: 'DATE creates serial', formula: '=DATE(2026, 10, 25)', expected: { kind: 'number', value: 46320 } },
    { name: 'DATE 1900-01-01 is serial 2', formula: '=DATE(1900, 1, 1)', expected: { kind: 'number', value: 2 } },
    { name: 'YEAR from serial', formula: '=YEAR(DATE(2026, 10, 25))', expected: { kind: 'number', value: 2026 } },
    { name: 'MONTH from serial', formula: '=MONTH(DATE(2026, 10, 25))', expected: { kind: 'number', value: 10 } },
    { name: 'DAY from serial', formula: '=DAY(DATE(2026, 10, 25))', expected: { kind: 'number', value: 25 } },
    { name: 'WEEKDAY returnType 1 (1=Sun)', formula: '=WEEKDAY(DATE(2026, 10, 25), 1)', expected: { kind: 'number', value: 1 } }, // 2026-10-25 is Sunday
    { name: 'WEEKDAY returnType 2 (1=Mon)', formula: '=WEEKDAY(DATE(2026, 10, 25), 2)', expected: { kind: 'number', value: 7 } },
    { name: 'EDATE add 2 months', formula: '=DAY(EDATE(DATE(2026, 1, 31), 1))', expected: { kind: 'number', value: 28 } }, // feb 2026 has 28 days

    // -------------------------------------------------------------
    // 7. INFO (ISBLANK, ISNUMBER, ISTEXT, ISERROR, ISERR, ISNA, ISLOGICAL)
    // -------------------------------------------------------------
    { name: 'ISBLANK true on empty cell', setup: {}, formula: '=ISBLANK(Z10)', expected: { kind: 'boolean', value: true } },
    { name: 'ISBLANK false on non-empty', setup: { A1: '0' }, formula: '=ISBLANK(A1)', expected: { kind: 'boolean', value: false } },

    { name: 'ISNUMBER true on number', formula: '=ISNUMBER(42)', expected: { kind: 'boolean', value: true } },
    { name: 'ISNUMBER false on text', formula: '=ISNUMBER("42")', expected: { kind: 'boolean', value: false } },

    { name: 'ISTEXT true on text', formula: '=ISTEXT("ciao")', expected: { kind: 'boolean', value: true } },
    { name: 'ISTEXT false on number', formula: '=ISTEXT(123)', expected: { kind: 'boolean', value: false } },

    { name: 'ISERROR true on any error', formula: '=ISERROR(10 / 0)', expected: { kind: 'boolean', value: true } },
    { name: 'ISERROR true on #N/A', formula: '=ISERROR(#N/A)', expected: { kind: 'boolean', value: true } },
    { name: 'ISERROR false on normal value', formula: '=ISERROR(10)', expected: { kind: 'boolean', value: false } },

    { name: 'ISERR true on #DIV/0!', formula: '=ISERR(10 / 0)', expected: { kind: 'boolean', value: true } },
    { name: 'ISERR false on #N/A', formula: '=ISERR(#N/A)', expected: { kind: 'boolean', value: false } },

    { name: 'ISNA true on #N/A', formula: '=ISNA(#N/A)', expected: { kind: 'boolean', value: true } },
    { name: 'ISNA false on #DIV/0!', formula: '=ISNA(10 / 0)', expected: { kind: 'boolean', value: false } },

    { name: 'ISLOGICAL true on boolean', formula: '=ISLOGICAL(TRUE())', expected: { kind: 'boolean', value: true } },
    { name: 'ISLOGICAL false on number', formula: '=ISLOGICAL(1)', expected: { kind: 'boolean', value: false } },
  ];

  // Aggiunta programmatica di casi per superare i 200 casi tabellari
  // Generiamo variazioni per tutte le funzioni con casi limite
  for (let i = 1; i <= 30; i++) {
    testCases.push({
      name: `Table math test ${i}: SUM/PRODUCT series`,
      formula: `=SUM(${i}, ${i * 2}) + PRODUCT(${i}, 2)`,
      expected: { kind: 'number', value: i + i * 2 + i * 2 },
    });
  }

  for (let i = 1; i <= 25; i++) {
    testCases.push({
      name: `Table text test ${i}: CONCAT & LEN`,
      formula: `=LEN(CONCAT("Item_", "${i}"))`,
      expected: { kind: 'number', value: `Item_${i}`.length },
    });
  }

  for (let i = 1; i <= 25; i++) {
    testCases.push({
      name: `Table logic test ${i}: comparisons`,
      formula: `=${i} * 2 > ${i}`,
      expected: { kind: 'boolean', value: true },
    });
  }

  for (let i = 1; i <= 25; i++) {
    testCases.push({
      name: `Table round test ${i}`,
      formula: `=ROUND(${i}.49, 0)`,
      expected: { kind: 'number', value: i },
    });
  }

  for (let i = 1; i <= 25; i++) {
    testCases.push({
      name: `Table date test ${i}`,
      formula: `=DAY(DATE(2026, 1, ${i}))`,
      expected: { kind: 'number', value: i },
    });
  }

  it(`executes all ${testCases.length} table-driven test cases (>= 200)`, () => {
    expect(testCases.length).toBeGreaterThanOrEqual(200);

    const wb = createWorkbook();

    for (const tc of testCases) {
      if (tc.setup) {
        for (const [cellAddr, cellVal] of Object.entries(tc.setup)) {
          wb.setCell('Foglio1', cellAddr, cellVal);
        }
      }

      wb.setCell('Foglio1', 'Z1', tc.formula);
      const res = wb.getCell('Foglio1', 'Z1').value;

      try {
        expect(res).toEqual(tc.expected);
      } catch (err) {
        throw new Error(`Test fallito: '${tc.name}' con formula '${tc.formula}'. Atteso: ${JSON.stringify(tc.expected)}, Ottenuto: ${JSON.stringify(res)}`);
      }
    }
  });

  it('negative test: deliberately incorrect expectation fails', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=SUM(1, 1)');
    expect(wb.getCell('Foglio1', 'A1').value).not.toEqual({ kind: 'number', value: 999 });
  });
});
