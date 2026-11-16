/**
 * Analizzatore lessicale (tokenizer) per formule di Fogli.
 * Converte la stringa della formula in una sequenza di token.
 * Nessuna dipendenza esterna.
 */

import { CELL_ERRORS, CellError } from './values';
import { parseCellAddress, parseRangeAddress } from './address';

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'ERROR'
  | 'IDENTIFIER' // Nome di funzione o variabile
  | 'CELL'       // Riferimento a singola cella (es. A1, $A$1, Foglio1!A1)
  | 'RANGE'      // Riferimento a intervallo (es. A1:B5, A:A, 1:1, Foglio1!A1:B5)
  | 'PLUS'       // +
  | 'MINUS'      // -
  | 'STAR'       // *
  | 'SLASH'      // /
  | 'CARET'      // ^
  | 'PERCENT'    // %
  | 'AMPERSAND'  // &
  | 'EQUAL'      // =
  | 'NOT_EQUAL'  // <>
  | 'LT'         // <
  | 'LTE'        // <=
  | 'GT'         // >
  | 'GTE'        // >=
  | 'LPAREN'     // (
  | 'RPAREN'     // )
  | 'COMMA'      // ,
  | 'SEMICOLON'  // ;  (separatore di riga nelle costanti matrice)
  | 'LBRACE'     // {
  | 'RBRACE'     // }
  | 'COLON'      // :
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  numValue?: number;
  errorValue?: CellError;
  boolValue?: boolean;
  /** per gli identificatori: com'è scritto (value è in maiuscolo) */
  originale?: string;
  start: number;
  end: number;
}

export function tokenize(formulaText: string): { tokens: Token[]; error?: string } {
  // Rimuove l'eventuale '=' iniziale
  let src = formulaText.trim();
  let offset = 0;
  if (src.startsWith('=')) {
    src = src.substring(1);
    offset = 1;
  }

  const tokens: Token[] = [];
  const len = src.length;
  let i = 0;

  while (i < len) {
    const ch = src[i];

    // Spazi bianchi
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    const startPos = i + offset;

    // 1. Stringhe con doppi apici e escape raddoppiato ""
    if (ch === '"') {
      let strVal = '';
      i++; // salta apertura "
      let closed = false;
      while (i < len) {
        if (src[i] === '"') {
          if (i + 1 < len && src[i + 1] === '"') {
            strVal += '"';
            i += 2;
          } else {
            closed = true;
            i++; // salta chiusura "
            break;
          }
        } else {
          strVal += src[i];
          i++;
        }
      }
      if (!closed) {
        return { tokens, error: 'Stringa letterale non chiusa con virgolette' };
      }
      tokens.push({
        type: 'STRING',
        value: strVal,
        start: startPos,
        end: i + offset,
      });
      continue;
    }

    // 2. Costanti di errore letterali (#DIV/0!, #NAME?, ecc.)
    if (ch === '#') {
      let errStr = '#';
      i++;
      while (i < len && /[A-Za-z0-9_/?!]/.test(src[i])) {
        errStr += src[i];
        i++;
        if (src[i - 1] === '!' || src[i - 1] === '?') break;
      }
      const upperErr = errStr.toUpperCase() as CellError;
      if (CELL_ERRORS.has(upperErr)) {
        tokens.push({
          type: 'ERROR',
          value: upperErr,
          errorValue: upperErr,
          start: startPos,
          end: i + offset,
        });
        continue;
      } else {
        return { tokens, error: `Costante di errore non riconosciuta: ${errStr}` };
      }
    }

    // 2b. Intervalli di righe intere (es. 1:1, 1:2, $1:$1, $1:5, 1:$10)
    if (/\d/.test(ch) || ch === '$') {
      const remaining = src.substring(i);
      const rowRangeMatch = /^(\$?[1-9][0-9]{0,6}):(\$?[1-9][0-9]{0,6})/.exec(remaining);
      if (rowRangeMatch && parseRangeAddress(rowRangeMatch[0])) {
        tokens.push({
          type: 'RANGE',
          value: rowRangeMatch[0],
          start: startPos,
          end: startPos + rowRangeMatch[0].length,
        });
        i += rowRangeMatch[0].length;
        continue;
      }
    }

    // 3. Numeri
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(src[i + 1]))) {
      const numStart = i;
      while (i < len && /\d/.test(src[i])) i++;
      if (i < len && src[i] === '.') {
        i++;
        while (i < len && /\d/.test(src[i])) i++;
      }
      if (i < len && (src[i] === 'e' || src[i] === 'E')) {
        let eIdx = i + 1;
        if (eIdx < len && (src[eIdx] === '+' || src[eIdx] === '-')) eIdx++;
        if (eIdx < len && /\d/.test(src[eIdx])) {
          i = eIdx;
          while (i < len && /\d/.test(src[i])) i++;
        }
      }
      const numStr = src.substring(numStart, i);
      const parsedNum = Number(numStr);
      tokens.push({
        type: 'NUMBER',
        value: numStr,
        numValue: parsedNum,
        start: startPos,
        end: i + offset,
      });
      continue;
    }

    // 4. Riferimento con nome foglio quotato con apici: 'Nome Foglio'!A1 o 'Nome Foglio'!A1:B5
    if (ch === "'") {
      let sheetQuoted = "'";
      i++;
      let closed = false;
      while (i < len) {
        if (src[i] === "'") {
          sheetQuoted += "'";
          if (i + 1 < len && src[i + 1] === "'") {
            sheetQuoted += "'";
            i += 2;
          } else {
            closed = true;
            i++;
            break;
          }
        } else {
          sheetQuoted += src[i];
          i++;
        }
      }
      if (!closed || i >= len || src[i] !== '!') {
        return { tokens, error: 'Riferimento a foglio quotato non valido' };
      }
      sheetQuoted += '!';
      i++; // salta !

      // Legge il resto del riferimento (es. A1 o A1:B5)
      const refStart = i;
      while (i < len && /[A-Za-z0-9_$:.]/.test(src[i])) i++;
      const fullRef = sheetQuoted + src.substring(refStart, i);

      if (parseRangeAddress(fullRef)) {
        tokens.push({
          type: fullRef.includes(':') ? 'RANGE' : 'CELL',
          value: fullRef,
          start: startPos,
          end: i + offset,
        });
        continue;
      } else {
        return { tokens, error: `Riferimento non valido: ${fullRef}` };
      }
    }

    // 5. Identificatori, riferimenti cella/intervallo, booleani
    if (/[A-Za-z_]/.test(ch) || ch === '$') {
      const idStart = i;
      while (i < len && /[A-Za-z0-9_$.]/.test(src[i])) i++;
      let candidate = src.substring(idStart, i);

      // Controllo se è seguito da '!' per riferimento a foglio non quotato (es. Foglio1!A1 o Foglio1!A1:B2)
      if (i < len && src[i] === '!') {
        i++; // consuma !
        const localStart = i;
        while (i < len && /[A-Za-z0-9_$:]/.test(src[i])) i++;
        candidate = candidate + '!' + src.substring(localStart, i);
      } else if (i < len && src[i] === ':') {
        // Possibile intervallo A1:B2 o A:B o 1:1
        const saveI = i;
        i++; // consuma :
        const secondStart = i;
        while (i < len && /[A-Za-z0-9_$]/.test(src[i])) i++;
        const secondPart = src.substring(secondStart, i);
        const combined = candidate + ':' + secondPart;
        if (parseRangeAddress(combined)) {
          candidate = combined;
        } else {
          // ripristina e lascia che : sia processato a parte
          i = saveI;
        }
      }

      // Verifica se è una chiamata di funzione (se subito seguito da '(')
      let nextNonSpace = i;
      while (nextNonSpace < len && (src[nextNonSpace] === ' ' || src[nextNonSpace] === '\t')) {
        nextNonSpace++;
      }
      const isCall = nextNonSpace < len && src[nextNonSpace] === '(';

      if (!isCall) {
        // Controllo booleani
        const upper = candidate.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') {
          tokens.push({
            type: 'BOOLEAN',
            value: upper,
            boolValue: upper === 'TRUE',
            start: startPos,
            end: i + offset,
          });
          continue;
        }

        // Controllo se è un intervallo o una cella valida
        if (candidate.includes(':') && parseRangeAddress(candidate)) {
          tokens.push({
            type: 'RANGE',
            value: candidate,
            start: startPos,
            end: i + offset,
          });
          continue;
        }
        if (parseCellAddress(candidate)) {
          tokens.push({
            type: 'CELL',
            value: candidate,
            start: startPos,
            end: i + offset,
          });
          continue;
        }
      }

      // Altrimenti è un IDENTIFIER (nome funzione o simbolo)
      tokens.push({
        type: 'IDENTIFIER',
        value: candidate.toUpperCase(),
        originale: candidate,   // com'è scritto: serve a ricopiare i nomi (LET, LAMBDA) senza cambiarne le maiuscole
        start: startPos,
        end: i + offset,
      });
      continue;
    }

    // 6. Operatori e simboli di punteggiatura
    const twoChar = src.substring(i, i + 2);
    if (twoChar === '<>') {
      tokens.push({ type: 'NOT_EQUAL', value: '<>', start: startPos, end: startPos + 2 });
      i += 2;
      continue;
    }
    if (twoChar === '<=') {
      tokens.push({ type: 'LTE', value: '<=', start: startPos, end: startPos + 2 });
      i += 2;
      continue;
    }
    if (twoChar === '>=') {
      tokens.push({ type: 'GTE', value: '>=', start: startPos, end: startPos + 2 });
      i += 2;
      continue;
    }

    switch (ch) {
      case '+':
        tokens.push({ type: 'PLUS', value: '+', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '-':
        tokens.push({ type: 'MINUS', value: '-', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '*':
        tokens.push({ type: 'STAR', value: '*', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '/':
        tokens.push({ type: 'SLASH', value: '/', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '^':
        tokens.push({ type: 'CARET', value: '^', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '%':
        tokens.push({ type: 'PERCENT', value: '%', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '&':
        tokens.push({ type: 'AMPERSAND', value: '&', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '=':
        tokens.push({ type: 'EQUAL', value: '=', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '<':
        tokens.push({ type: 'LT', value: '<', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '>':
        tokens.push({ type: 'GT', value: '>', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '(':
        tokens.push({ type: 'LPAREN', value: '(', start: startPos, end: startPos + 1 });
        i++;
        break;
      case ')':
        tokens.push({ type: 'RPAREN', value: ')', start: startPos, end: startPos + 1 });
        i++;
        break;
      case ',':
        tokens.push({ type: 'COMMA', value: ',', start: startPos, end: startPos + 1 });
        i++;
        break;
      case ';':
        tokens.push({ type: 'SEMICOLON', value: ';', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '{':
        tokens.push({ type: 'LBRACE', value: '{', start: startPos, end: startPos + 1 });
        i++;
        break;
      case '}':
        tokens.push({ type: 'RBRACE', value: '}', start: startPos, end: startPos + 1 });
        i++;
        break;
      case ':':
        tokens.push({ type: 'COLON', value: ':', start: startPos, end: startPos + 1 });
        i++;
        break;
      default:
        return { tokens, error: `Carattere non consentito: '${ch}' a posizione ${startPos}` };
    }
  }

  tokens.push({
    type: 'EOF',
    value: '',
    start: len + offset,
    end: len + offset,
  });

  return { tokens };
}
