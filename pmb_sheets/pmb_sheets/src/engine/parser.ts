/**
 * Parser Pratt per formule di Fogli.
 * Produce un Abstract Syntax Tree (AST) fortemente tipizzato.
 * Precedenze e associatività rigorosamente conformi alla specifica:
 * - Unario precede potenza: -2^2 = (-2)^2 = 4
 * - ^ associa a sinistra
 * - Nessuna ricorsione profonda
 */

import { Token, TokenType, tokenize } from './tokenizer';
import { CellError } from './values';
import { CellCoord, RangeCoord, parseCellAddress, parseRangeAddress } from './address';

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | ErrorNode
  | CellNode
  | RangeNode
  | UnaryNode
  | PostfixNode
  | BinaryNode
  | CallNode
  | EmptyNode
  | ArrayNode
  | NameNode;

/** Argomento lasciato vuoto: IF(a,,b), INDEX(r,,c) */
export interface EmptyNode {
  type: 'Empty';
}

/** Costante matrice: {1,2;3,4} (virgola tra le colonne, punto e virgola tra le righe) */
export interface ArrayNode {
  type: 'Array';
  rows: ASTNode[][];
}

/** Nome che non è né una cella né un intervallo denominato: serve a LET (valore dato a un nome dentro la formula). Fuori da LET vale #NAME?. */
export interface NameNode {
  type: 'Name';
  name: string;
}

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface ErrorNode {
  type: 'Error';
  error: CellError;
}

export interface CellNode {
  type: 'Cell';
  raw: string;
  coord: CellCoord;
}

export interface RangeNode {
  type: 'Range';
  raw: string;
  coord: RangeCoord;
}

export interface UnaryNode {
  type: 'Unary';
  op: '+' | '-';
  expr: ASTNode;
}

export interface PostfixNode {
  type: 'Postfix';
  op: '%';
  expr: ASTNode;
}

export interface BinaryNode {
  type: 'Binary';
  op: '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=';
  left: ASTNode;
  right: ASTNode;
}

export interface CallNode {
  type: 'Call';
  name: string;
  args: ASTNode[];
}

export interface ParseResult {
  ast?: ASTNode;
  error?: string;
}

export class Parser {
  private tokens: Token[];
  private pos = 0;
  private defaultSheet?: string;
  /** Dato il nome di un intervallo denominato, ne restituisce il riferimento ("Foglio1!A1:B10"); undefined se il nome non esiste. */
  private risolviNome?: (nome: string) => string | undefined;

  constructor(tokens: Token[], defaultSheet?: string, risolviNome?: (nome: string) => string | undefined) {
    this.tokens = tokens;
    this.defaultSheet = defaultSheet;
    this.risolviNome = risolviNome;
  }

  private current(): Token {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const t = this.current();
    this.pos++;
    return t;
  }

  private match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  public parse(): ParseResult {
    if (this.tokens.length === 0 || this.current().type === 'EOF') {
      return { error: 'Formula vuota' };
    }

    try {
      const ast = this.parseExpression(0);
      if (this.current().type !== 'EOF') {
        return { error: `Token inatteso a fine formula: ${this.current().value}` };
      }
      return { ast };
    } catch (e: any) {
      return { error: e.message || 'Errore di parsing della formula' };
    }
  }

  /**
   * Precedenze operatori binari (left binding power, right binding power):
   * Comparisons: 20, 21 (left-assoc)
   * Ampersand (&): 30, 31 (left-assoc)
   * Plus/Minus (+, -): 40, 41 (left-assoc)
   * Star/Slash (*, /): 50, 51 (left-assoc)
   * Caret (^): 70, 71 (left-assoc, come richiesto: ^ associa a sinistra)
   * Unario (+, -): binding power 80
   * Postfisso (%): binding power 85
   */
  private parseExpression(rbp: number): ASTNode {
    let left = this.parsePrefix();

    while (true) {
      // Controllo operatore postfisso (%)
      if (this.current().type === 'PERCENT') {
        const percentLbp = 85;
        if (percentLbp <= rbp) break;
        this.advance();
        left = {
          type: 'Postfix',
          op: '%',
          expr: left,
        };
        continue;
      }

      // Controllo operatore binario
      const tok = this.current();
      const info = this.getInfixInfo(tok.type);
      if (!info) break;

      if (info.lbp <= rbp) break;

      this.advance(); // consuma operatore binario
      const right = this.parseExpression(info.rbp);
      left = {
        type: 'Binary',
        op: info.op,
        left,
        right,
      };
    }

    return left;
  }

  private parsePrefix(): ASTNode {
    const tok = this.current();

    // 1. Unario + o -
    if (tok.type === 'PLUS' || tok.type === 'MINUS') {
      this.advance();
      // Binding power 80 per unari (superiore a 70 di ^ per garantire -2^2 = (-2)^2)
      const expr = this.parseExpression(80);
      return {
        type: 'Unary',
        op: tok.type === 'PLUS' ? '+' : '-',
        expr,
      };
    }

    // 2. Parentesi tonde aperte
    if (tok.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression(0);
      if (!this.match('RPAREN')) {
        throw new Error('Parentesi chiusa mancante');
      }
      return expr;
    }

    // 2b. Costante matrice {1,2;3,4}
    if (tok.type === 'LBRACE') {
      this.advance();
      const rows: ASTNode[][] = [[]];
      while (true) {
        rows[rows.length - 1].push(this.parseExpression(0));
        if (this.match('COMMA')) continue;
        if (this.match('SEMICOLON')) { rows.push([]); continue; }
        if (this.match('RBRACE')) break;
        throw new Error('Costante matrice non valida: attesi virgola, punto e virgola o }');
      }
      const larghezza = rows[0].length;
      if (rows.some((r) => r.length !== larghezza)) throw new Error('Le righe della costante matrice devono avere lo stesso numero di colonne');
      return { type: 'Array', rows };
    }

    // 3. Numeri
    if (tok.type === 'NUMBER') {
      this.advance();
      return {
        type: 'Number',
        value: tok.numValue !== undefined ? tok.numValue : Number(tok.value),
      };
    }

    // 4. Stringhe
    if (tok.type === 'STRING') {
      this.advance();
      return {
        type: 'String',
        value: tok.value,
      };
    }

    // 5. Booleani
    if (tok.type === 'BOOLEAN') {
      this.advance();
      return {
        type: 'Boolean',
        value: tok.boolValue !== undefined ? tok.boolValue : tok.value.toUpperCase() === 'TRUE',
      };
    }

    // 6. Costanti di errore letterali
    if (tok.type === 'ERROR') {
      this.advance();
      return {
        type: 'Error',
        error: tok.errorValue || (tok.value as CellError),
      };
    }

    // 7. Cella o Intervallo
    if (tok.type === 'CELL') {
      this.advance();
      const coord = parseCellAddress(tok.value, this.defaultSheet);
      if (!coord) throw new Error(`Indirizzo cella non valido: ${tok.value}`);
      return {
        type: 'Cell',
        raw: tok.value,
        coord,
      };
    }

    if (tok.type === 'RANGE') {
      this.advance();
      const coord = parseRangeAddress(tok.value, this.defaultSheet);
      if (!coord) throw new Error(`Intervallo non valido: ${tok.value}`);
      return {
        type: 'Range',
        raw: tok.value,
        coord,
      };
    }

    // 8. Chiamata di funzione (IDENTIFIER seguito da LPAREN) o riferimento cella/range non tokenizzato
    if (tok.type === 'IDENTIFIER') {
      const name = tok.value;
      this.advance();

      if (this.current().type === 'LPAREN') {
        this.advance(); // consuma (
        const args: ASTNode[] = [];
        if (this.current().type !== 'RPAREN') {
          while (true) {
            // un argomento vuoto: due virgole di fila, o virgola e parentesi chiusa
            if (this.current().type === 'COMMA' || this.current().type === 'RPAREN') args.push({ type: 'Empty' });
            else args.push(this.parseExpression(0));
            if (this.match('COMMA')) {
              continue;
            } else if (this.current().type === 'RPAREN') {
              break;
            } else {
              throw new Error(`Prevista virgola o parentesi chiusa negli argomenti di ${name}`);
            }
          }
        }
        if (!this.match('RPAREN')) {
          throw new Error(`Parentesi chiusa mancante per funzione ${name}`);
        }
        let chiamata: ASTNode = {
          type: 'Call',
          name: name.toUpperCase(),
          args,
        };
        // LAMBDA(x, x*2)(5): una LAMBDA seguita subito da parentesi si chiama con quegli argomenti
        let puoChiamare = name.toUpperCase() === 'LAMBDA';
        while (puoChiamare && this.current().type === 'LPAREN') {
          this.advance();
          const argsChiamata: ASTNode[] = [];
          if (this.current().type !== 'RPAREN') {
            while (true) {
              if (this.current().type === 'COMMA' || this.current().type === 'RPAREN') argsChiamata.push({ type: 'Empty' });
              else argsChiamata.push(this.parseExpression(0));
              if (this.match('COMMA')) continue;
              else if (this.current().type === 'RPAREN') break;
              else throw new Error('Prevista virgola o parentesi chiusa negli argomenti della chiamata a LAMBDA');
            }
          }
          if (!this.match('RPAREN')) throw new Error('Parentesi chiusa mancante nella chiamata a LAMBDA');
          chiamata = { type: 'Call', name: '__INVOCA__', args: [chiamata, ...argsChiamata] };
          puoChiamare = false;   // una sola chiamata immediata
        }
        return chiamata;
      }

      // Se non è chiamata di funzione, potrebbe essere cella (es. colonna singola)
      const c = parseCellAddress(name, this.defaultSheet);
      if (c) {
        return { type: 'Cell', raw: name, coord: c };
      }
      const r = parseRangeAddress(name, this.defaultSheet);
      if (r) {
        return { type: 'Range', raw: name, coord: r };
      }

      // Intervallo denominato: il nome vale il riferimento a cui è stato associato.
      const riferimento = this.risolviNome?.(name);
      if (riferimento) {
        const comeIntervallo = riferimento.includes(':') ? parseRangeAddress(riferimento, this.defaultSheet) : null;
        if (comeIntervallo) return { type: 'Range', raw: name, coord: comeIntervallo };
        const comeCella = parseCellAddress(riferimento, this.defaultSheet);
        if (comeCella) return { type: 'Cell', raw: name, coord: comeCella };
      }

      // Un nome qualunque: vale solo dentro LET; altrove dà #NAME? quando si calcola
      if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return { type: 'Name', name: tok.originale ?? name };

      throw new Error(`Identificatore sconosciuto o non valido: ${name}`);
    }

    throw new Error(`Token inatteso all'inizio dell'espressione: '${tok.value}'`);
  }

  private getInfixInfo(type: TokenType): { lbp: number; rbp: number; op: BinaryNode['op'] } | null {
    switch (type) {
      case 'EQUAL':
        return { lbp: 20, rbp: 21, op: '=' };
      case 'NOT_EQUAL':
        return { lbp: 20, rbp: 21, op: '<>' };
      case 'LT':
        return { lbp: 20, rbp: 21, op: '<' };
      case 'LTE':
        return { lbp: 20, rbp: 21, op: '<=' };
      case 'GT':
        return { lbp: 20, rbp: 21, op: '>' };
      case 'GTE':
        return { lbp: 20, rbp: 21, op: '>=' };
      case 'AMPERSAND':
        return { lbp: 30, rbp: 31, op: '&' };
      case 'PLUS':
        return { lbp: 40, rbp: 41, op: '+' };
      case 'MINUS':
        return { lbp: 40, rbp: 41, op: '-' };
      case 'STAR':
        return { lbp: 50, rbp: 51, op: '*' };
      case 'SLASH':
        return { lbp: 50, rbp: 51, op: '/' };
      case 'CARET':
        // Left-associative: lbp 70, rbp 71
        return { lbp: 70, rbp: 71, op: '^' };
      default:
        return null;
    }
  }
}

export function parseFormula(formulaText: string, defaultSheet?: string, risolviNome?: (nome: string) => string | undefined): ParseResult {
  const { tokens, error } = tokenize(formulaText);
  if (error) return { error };
  const parser = new Parser(tokens, defaultSheet, risolviNome);
  return parser.parse();
}
