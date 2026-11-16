/**
 * Funzione pura per "taglia e incolla": quando delle celle vengono spostate (non copiate), le formule che le citano devono seguirle,
 * e le formule spostate restano com'erano (non si traslano come in una copia).
 * Regola, uguale a quella dei fogli di calcolo più diffusi:
 *  - un riferimento a una cella dentro il blocco spostato segue il blocco (anche se è assoluto, $A$1);
 *  - un intervallo segue il blocco solo se sta tutto dentro; se è solo in parte dentro, resta com'è;
 *  - un riferimento a una cella fuori dal blocco non cambia;
 *  - se il blocco passa a un altro foglio, i riferimenti aggiornati portano il nome del nuovo foglio, e nelle formule spostate i
 *    riferimenti senza foglio (che indicavano il foglio di partenza) lo indicano esplicitamente.
 * Se la formula non si legge si restituisce com'è.
 */
import { tokenize } from './tokenizer';
import { Parser, ASTNode } from './parser';
import { printAst } from './ast-printer';
import { formatCellAddress, formatRangeAddress } from './address';

export interface BloccoSpostato {
  /** foglio da cui le celle partono */
  foglio: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  deltaRows: number;
  deltaCols: number;
  /** foglio in cui arrivano */
  foglioDestinazione: string;
}

const stesso = (a: string | undefined, b: string): boolean => a !== undefined && a.toLowerCase() === b.toLowerCase();

/** La formula dopo lo spostamento del blocco. `eSpostata`: la formula è una delle celle spostate. */
export function aggiornaPerSpostamento(formula: string, foglioFormula: string, blocco: BloccoSpostato, eSpostata: boolean): string {
  const trimmed = formula.trim();
  if (!trimmed.startsWith('=')) return formula;
  const { tokens, error } = tokenize(trimmed.slice(1).trim());
  if (error) return formula;
  const { ast, error: erroreSintassi } = new Parser(tokens).parse();
  if (erroreSintassi || !ast) return formula;

  let cambiato = false;
  const cambiaFoglio = !stesso(blocco.foglioDestinazione, blocco.foglio);

  const dentroCella = (riga: number, colonna: number) =>
    riga >= blocco.startRow && riga <= blocco.endRow && colonna >= blocco.startCol && colonna <= blocco.endCol;

  const visita = (node: ASTNode): ASTNode => {
    switch (node.type) {
      case 'Cell': {
        const foglioRif = node.coord.sheet ?? foglioFormula;
        const coord = { ...node.coord };
        if (stesso(foglioRif, blocco.foglio) && dentroCella(coord.row, coord.col)) {
          coord.row += blocco.deltaRows;
          coord.col += blocco.deltaCols;
          if (cambiaFoglio) coord.sheet = blocco.foglioDestinazione;
          cambiato = true;
        } else if (eSpostata && cambiaFoglio && coord.sheet === undefined && stesso(foglioFormula, blocco.foglio)) {
          coord.sheet = blocco.foglio;
          cambiato = true;
        } else return node;
        return { type: 'Cell', raw: formatCellAddress(coord, Boolean(coord.sheet)), coord };
      }
      case 'Range': {
        const foglioRif = node.coord.sheet ?? foglioFormula;
        const coord = { ...node.coord };
        const tuttoDentro = !coord.isFullCol && !coord.isFullRow
          && dentroCella(coord.startRow, coord.startCol) && dentroCella(coord.endRow, coord.endCol);
        if (stesso(foglioRif, blocco.foglio) && tuttoDentro) {
          coord.startRow += blocco.deltaRows;
          coord.endRow += blocco.deltaRows;
          coord.startCol += blocco.deltaCols;
          coord.endCol += blocco.deltaCols;
          if (cambiaFoglio) coord.sheet = blocco.foglioDestinazione;
          cambiato = true;
        } else if (eSpostata && cambiaFoglio && coord.sheet === undefined && stesso(foglioFormula, blocco.foglio)) {
          coord.sheet = blocco.foglio;
          cambiato = true;
        } else return node;
        return { type: 'Range', raw: formatRangeAddress(coord, Boolean(coord.sheet)), coord };
      }
      case 'Unary': return { ...node, expr: visita(node.expr) };
      case 'Postfix': return { ...node, expr: visita(node.expr) };
      case 'Binary': return { ...node, left: visita(node.left), right: visita(node.right) };
      case 'Call': return { ...node, args: node.args.map(visita) };
      default: return node;
    }
  };

  const nuovo = visita(ast);
  return cambiato ? `=${printAst(nuovo)}` : formula;
}
