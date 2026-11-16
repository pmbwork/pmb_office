import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../src/components/sheet-grid";
import { FreeSheetGrid } from "../../src/components/sheet-grid";
import { defaultDocumentStore } from "../../src/sheet/index";

describe("SheetGrid Component Tests (happy-dom)", () => {
  let grid: FreeSheetGrid;
  const testTabId = "test-tab-grid";

  beforeEach(async () => {
    document.body.innerHTML = "";
    defaultDocumentStore.removeDocument(testTabId);
    grid = document.createElement("free-sheet-grid") as FreeSheetGrid;
    grid.tabId = testTabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
  });

  afterEach(() => {
    grid.remove();
    defaultDocumentStore.removeDocument(testTabId);
    document.body.innerHTML = "";
  });

  it("1. Inizia a scrivere digitando un carattere (sostituisce) e l'editor overlay compare", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;
    expect(container).not.toBeNull();

    // Simula digitazione tasto '5'
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }));
    await grid.updateComplete;

    const editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    expect(editor).not.toBeNull();
    expect(editor.value).toBe("5");

    // Premi Invio per confermare
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    const doc = defaultDocumentStore.getDocument(testTabId);
    const cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("5");
    expect(cellA1.value).toEqual({ kind: "number", value: 5 });

    // La cella attiva scende a A2 (riga 2, col 1)
    expect(doc.selection.active.row).toBe(2);
    expect(doc.selection.active.col).toBe(1);
  });

  it("2. F2 avvia la modifica preservando il valore esistente; Esc annulla", async () => {
    const doc = defaultDocumentStore.getDocument(testTabId);
    await doc.client.setCell("Foglio1", 1, 1, "ValoreIniziale");
    await grid.updateComplete;

    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;

    // Premi F2 su A1
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    let editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    expect(editor).not.toBeNull();
    expect(editor.value).toBe("ValoreIniziale");

    // Digita testo aggiuntivo
    editor.value = "ValoreInizialeModificato";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    // Premi Esc per annullare
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    // Editor chiuso e valore inalterato
    editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    expect(editor).toBeNull();

    const cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("ValoreIniziale");
  });

  it("3. Tab conferma e si sposta a destra; Shift+Tab conferma e si sposta a sinistra; Shift+Invio sale", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;

    // Digita su A1 e premi Tab
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "A", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;
    let editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    const doc = defaultDocumentStore.getDocument(testTabId);
    expect(doc.selection.active.row).toBe(1);
    expect(doc.selection.active.col).toBe(2); // Spostato a B1

    // Da B1, premi Shift+Tab
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;
    expect(doc.selection.active.row).toBe(1);
    expect(doc.selection.active.col).toBe(1); // Tornato ad A1

    // Sposta a riga 3
    doc.selection.active.row = 3;
    doc.selection.anchor.row = 3;
    // Da riga 3, premi Shift+Enter
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;
    editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    expect(doc.selection.active.row).toBe(2); // Salito a riga 2
  });

  it("4. Barra formule sincronizzata con l'editor di cella e mostra la formula grezza", async () => {
    const doc = defaultDocumentStore.getDocument(testTabId);
    await doc.client.setCell("Foglio1", 1, 1, "=10+20");
    await grid.updateComplete;

    // Naviga a A1
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await grid.updateComplete;

    const formulaInput = grid.renderRoot.querySelector(".formula-input") as HTMLInputElement;
    expect(formulaInput).not.toBeNull();

    // La barra formule mostra la formula grezza =10+20
    expect(formulaInput.value).toBe("=10+20");

    // Modifica nella formula bar
    formulaInput.value = "=SUM(1, 2, 3)";
    formulaInput.dispatchEvent(new Event("input", { bubbles: true }));
    await grid.updateComplete;

    // Se apriamo l'editor di cella o committiamo
    formulaInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    const cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("=SUM(1, 2, 3)");
    expect(cellA1.value).toEqual({ kind: "number", value: 6 });
  });

  it("5. Annulla (Ctrl+Z) e Ripeti (Ctrl+Y)", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;

    // Digita "100" in A1
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;
    const editor = grid.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    editor.value = "100";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    const doc = defaultDocumentStore.getDocument(testTabId);
    let cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("100");

    // Esegui Undo da tastiera
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("");

    // Esegui Redo da tastiera
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await grid.updateComplete;

    cellA1 = await doc.client.getCell("Foglio1", 1, 1);
    expect(cellA1.raw).toBe("100");
  });

  it("6. Copia e incolla interni con traslazione formula", async () => {
    const doc = defaultDocumentStore.getDocument(testTabId);
    await doc.client.setCell("Foglio1", 1, 1, "10"); // A1
    await doc.client.setCell("Foglio1", 2, 1, "20"); // A2
    await doc.client.setCell("Foglio1", 3, 1, "=SUM(A1:A2)"); // A3
    await grid.updateComplete;

    // Seleziona A3 (riga 3, col 1)
    doc.selection.active = { row: 3, col: 1 };
    doc.selection.anchor = { row: 3, col: 1 };
    doc.selection.range = { startRow: 3, startCol: 1, endRow: 3, endCol: 1 };

    // Copia A3
    await grid.copy();

    // Seleziona B3 (riga 3, col 2)
    doc.selection.active = { row: 3, col: 2 };
    doc.selection.anchor = { row: 3, col: 2 };
    doc.selection.range = { startRow: 3, startCol: 2, endRow: 3, endCol: 2 };

    // Incolla in B3
    await grid.paste();
    await grid.updateComplete;

    const cellB3 = await doc.client.getCell("Foglio1", 3, 2);
    // La formula deve essersi traslata da =SUM(A1:A2) a =SUM(B1:B2)
    expect(cellB3.raw).toBe("=SUM(B1:B2)");
  });

  it("7. Navigazione con le frecce della tastiera", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;
    const doc = defaultDocumentStore.getDocument(testTabId);

    expect(doc.selection.active.row).toBe(1);
    expect(doc.selection.active.col).toBe(1);

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await grid.updateComplete;
    expect(doc.selection.active.row).toBe(2);
    expect(doc.selection.active.col).toBe(1);

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await grid.updateComplete;
    expect(doc.selection.active.row).toBe(2);
    expect(doc.selection.active.col).toBe(2);

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await grid.updateComplete;
    expect(doc.selection.active.row).toBe(1);
    expect(doc.selection.active.col).toBe(2);

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await grid.updateComplete;
    expect(doc.selection.active.row).toBe(1);
    expect(doc.selection.active.col).toBe(1);
  });

  it("8. Numero massimo di celle nel DOM dopo scroll lungo rimane rigorosamente sotto 1.500", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;

    // Simula scroll profondo
    container.scrollTop = 50000;
    container.scrollLeft = 5000;
    container.dispatchEvent(new Event("scroll"));
    await grid.updateComplete;

    const renderedCells = grid.renderRoot.querySelectorAll("td.sheet-cell");
    expect(renderedCells.length).toBeGreaterThan(0);
    // Criterio C.1: sotto 1.500 elementi cella in qualsiasi posizione di scroll
    expect(renderedCells.length).toBeLessThan(1500);
  });

  it("9. Test negativo: tasti modificatori o scorciatoie non intenzionali non avviano l'editor", async () => {
    const container = grid.renderRoot.querySelector(".grid-container") as HTMLElement;

    // Premi Alt+Z o Ctrl+K
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    await grid.updateComplete;

    let editor = grid.renderRoot.querySelector(".cell-editor-overlay");
    expect(editor).toBeNull();

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
    await grid.updateComplete;
    editor = grid.renderRoot.querySelector(".cell-editor-overlay");
    expect(editor).toBeNull();
  });
});
