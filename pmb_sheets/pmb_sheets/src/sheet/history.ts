/**
 * Modulo puro Cronologia (Annulla / Ripeti):
 * - Gestione stack di undo e redo separati per scheda.
 * - Limite configurabile (predefinito 200 passi).
 * - Operazioni composte atomiche (es. cancellazione o incolla di 50.000 celle = 1 singolo passo).
 * - Registra per ogni cella modificata il contenuto grezzo prima e dopo.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import { CellRange } from './selection';

export interface CellChangeRecord {
  sheet: string;
  row: number;
  col: number;
  oldRaw: string;
  newRaw: string;
  oldStyleId?: number;
  newStyleId?: number;
}

export interface StyleChangeRecord {
  type: 'cell' | 'row' | 'col';
  target: string | number; // chiave "r,c" per cella, indice riga/colonna per row/col
  oldStyleId: number | undefined;
  newStyleId: number | undefined;
}

export interface HistoryStep {
  description: string;
  /** il foglio su cui si è fatta l'operazione: annullandola da un altro foglio ci si torna (lo mette la cronologia da sola) */
  sheet?: string;
  changes?: CellChangeRecord[];
  styleChanges?: StyleChangeRecord[];
  beforeSelection?: CellRange;
  afterSelection?: CellRange;
  undoAction?: () => Promise<void>;
  redoAction?: () => Promise<void>;
}

export class HistoryManager {
  private undoStack: HistoryStep[] = [];
  private redoStack: HistoryStep[] = [];
  private maxSteps: number;
  /** dice qual è il foglio attivo, per segnarlo su ogni passo */
  contesto?: () => string;
  /** controllo della protezione dei fogli: il motivo per cui il passo non è permesso, o null (vedi protezione.ts) */
  guardiano?: (step: HistoryStep) => string | null;
  /** chiamato con il motivo quando il guardiano rifiuta un passo: il passo è già nella cronologia e va annullato subito (respingi) */
  rifiutato?: (motivo: string) => void;

  constructor(maxSteps = 200) {
    this.maxSteps = maxSteps;
  }

  public pushStep(step: HistoryStep): void {
    const hasRaw = step.changes && step.changes.length > 0;
    const hasStyles = step.styleChanges && step.styleChanges.length > 0;
    const hasAction = !!step.undoAction;
    if (!hasRaw && !hasStyles && !hasAction) return;
    if (step.sheet === undefined && this.contesto) step.sheet = this.contesto();
    this.undoStack.push(step);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    // Una nuova azione azzera sempre il redo stack
    this.redoStack = [];
    const motivo = this.guardiano ? this.guardiano(step) : null;
    if (motivo !== null && this.rifiutato) this.rifiutato(motivo);
  }

  /** Toglie l'ultimo passo da ripetere (quello di un'operazione respinta dalla protezione, appena annullata: non si deve poter ripetere). */
  public scartaUltimoRipeti(): void { this.redoStack.pop(); }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Estrae il passo di annullamento e lo sposta nello stack di ripeti.
   * Restituisce le modifiche con il valore `oldRaw` da applicare al foglio.
   */
  public popUndo(): HistoryStep | null {
    if (this.undoStack.length === 0) return null;
    const step = this.undoStack.pop()!;
    this.redoStack.push(step);
    return step;
  }

  /**
   * Estrae il passo di ripetizione e lo risposta nello stack di annulla.
   * Restituisce le modifiche con il valore `newRaw` da riapplicare al foglio.
   */
  public popRedo(): HistoryStep | null {
    if (this.redoStack.length === 0) return null;
    const step = this.redoStack.pop()!;
    this.undoStack.push(step);
    return step;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
