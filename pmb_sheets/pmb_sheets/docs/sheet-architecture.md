# Architettura del Layer Fogli (pmb_office Sheet)

## 1. Principi e Obiettivi Architetturali

Il modulo Fogli di pmb_office è progettato seguendo una rigorosa separazione delle responsabilità a tre livelli:
1. **Motore di calcolo puro (`src/engine/`)**: motore in TypeScript puro, reattivo con grafo delle dipendenze, valutazione iterativa non ricorsiva, zero dipendenze dal DOM, dalla rete o da storage esterno.
2. **Layer applicativo puro (`src/sheet/`)**: moduli funzionali puri senza DOM e senza Lit, responsabili delle regole logiche (viewport, selezioni, navigazione da tastiera, appunti TSV/formule, cronologia annulla/ripeti, formattazione di visualizzazione e gestione isolata dei documenti per scheda).
3. **Interfaccia utente sottile (`src/components/sheet-grid.ts`)**: web component Lit virtualizzato che consuma esclusivamente il layer applicativo e il contratto `EngineClient`, proiettando nel DOM solo le celle effettivamente visibili a schermo.

```
+-------------------------------------------------------------------+
|               Interfaccia Utente (src/components/)                |
|  free-sheet-grid, free-statusbar, free-tabs, free-menubar         |
+---------------------------------+---------------------------------+
                                  | Consuma solo EngineClient e moduli puri
                                  v
+---------------------------------+---------------------------------+
|               Layer Applicativo Fogli (src/sheet/)                |
|  - viewport.ts        - selection.ts      - navigation.ts         |
|  - clipboard.ts       - history.ts        - format-display.ts     |
|  - document-store.ts  - engine-client.ts                          |
+---------------------------------+---------------------------------+
                                  | EngineClient (astrazione asincrona)
                                  v
+---------------------------------+---------------------------------+
|               Motore di Calcolo (src/engine/)                     |
|  - Workbook           - Sheet             - DependencyGraph       |
|  - Evaluator          - Functions         - shiftFormula / printAst|
+-------------------------------------------------------------------+
```

---

## 2. Contratto Asincrono `EngineClient`

Nessun componente della UI o del layer di visualizzazione importa direttamente le classi del motore (`Workbook`, `Evaluator`, ecc.). Tutte le operazioni transitano attraverso l'interfaccia asincrona `EngineClient`:

```typescript
export interface EngineClient {
  setCell(sheet: string, row: number, col: number, raw: string): Promise<void>;
  getCell(sheet: string, row: number, col: number): Promise<CellData>;
  getRange(
    sheet: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<CellValue[][]>;
  clearCell(sheet: string, row: number, col: number): Promise<void>;
  applyBatch(operations: BatchOp[]): Promise<void>;
  onChange(callback: (changes: CellChange[]) => void): () => void;
  serialize(): Promise<any>;
  recalculate(): Promise<void>;
  renameSheet(oldName: string, newName: string): Promise<void>;
  addSheet(name: string): Promise<void>;
  removeSheet(name: string): Promise<void>;
  listSheets(): Promise<string[]>;
}
```

### Implementazioni
- **`InlineEngineClient` (attuale)**: implementazione diretta in-process che esegue il motore sul thread principale, garantendo batch atomici tramite `Workbook.applyBatch()` per elaborare 50.000 celle senza bloccare il thread.
- **`WorkerEngineClient` (predisposizione futura)**: spostando il motore in un Web Worker, sarà sufficiente implementare questo client tramite messaggi postMessage/transferable, senza dover modificare alcuna riga nei componenti visivi.

---

## 3. Moduli Puri (`src/sheet/`)

Tutti i moduli in `src/sheet/` sono completamente indipendenti dal browser, non contengono riferimenti a `window`, `document`, o `HTMLElement`, e sono testabili al 100% in Node.js standard.

### 3.1 `viewport.ts`
Calcola in modo deterministico l'intervallo di righe e colonne visibili a partire dallo scroll (`scrollTop`, `scrollLeft`), dalle dimensioni del contenitore (`viewportWidth`, `viewportHeight`), dallo zoom e dalla mappa delle larghezze colonna:
- Dimensioni logiche complete: **1.048.576 righe x 16.384 colonne**.
- Altezza riga predefinita fissa: **22 px**.
- Larghezza colonna predefinita: **90 px** con sovrascritture per colonna.
- Margine di overscan (buffer per scroll fluido): 5 righe e 2 colonne.
- **Garanzia di virtualizzazione**: il numero di elementi cella generati nel DOM rimane rigorosamente **sotto 1.500 nodi** anche su scroll estremo a riga 1.048.576 o colonna XFD.

### 3.2 `selection.ts`
Gestisce la semantica delle selezioni di fogli di calcolo:
- Selezione a cella singola.
- Selezione di intervallo rettangolare con punto di ancoraggio (`anchor`) e testa attiva (`active`).
- Selezione di intera riga (`1:1`) o intera colonna (`A:A`).
- Selezione globale (`A1:XFD1048576`).
- Parsing e formattazione per la **Casella del nome**: es. digitando `B20`, `A1:C5`, `D:D` la selezione salta alla destinazione, segnalando errori di sintassi nella barra di stato senza alterare la selezione attiva.

### 3.3 `navigation.ts`
Implementa le regole di navigazione della tastiera:
- Frecce: movimento cella per cella; con `Shift` estende la selezione.
- `Ctrl+Freccia`: salto rapido al bordo del blocco dati seguendo l'euristica Excel (se la cella corrente e la successiva sono piene, salta all'ultima piena della sequenza continua; altrimenti salta alla successiva cella piena o al confine del foglio).
- `Home` (colonna A), `Ctrl+Home` (cella A1), `Ctrl+End` (ultima cella con dati), `PageUp` / `PageDown` (salto di un viewport verticale).

### 3.4 `clipboard.ts`
Gestione trasparente degli appunti:
- **TSV di sistema**: scrive e analizza stringhe TSV con gestione di apici, virgolette e caratteri speciali per l'interoperabilità con applicazioni esterne.
- **Formule interne**: all'interno di pmb_office, conserva le formule grezze e le sposta applicando la funzione pura `shiftFormula(formula, deltaRows, deltaCols)`.
- **Tiling**: incollare su un intervallo selezionato più grande della sorgente ripete il blocco solo se le dimensioni sono multipli esatti; altrimenti incolla una singola volta a partire dall'angolo superiore sinistro.
- **Atomicità**: l'intera operazione di incolla viene registrata come un unico passo nella cronologia.

### 3.5 `history.ts`
Gestore della cronologia annulla/ripeti (`HistoryManager`):
- Pila atomica con limite a 200 passi separata per ogni documento/scheda.
- Ogni passo conserva lo snapshot prima/dopo (`oldRaw`, `newRaw`) di tutte le celle toccate dall'operazione (inclusi blocchi massivi da 50.000 celle).
- L'annullamento applica il ripristino delle formule/valori grezzi tramite `applyBatch`, propagando automaticamente il ricalcolo a tutti i discendenti del grafo.

### 3.6 `document-store.ts`
Mantiene il ciclo di vita e l'isolamento dei documenti aperti nelle schede:
- Ogni scheda possiede una propria istanza di `SheetDocument` (con workbook dedicato, stato di selezione, posizione di scroll, larghezze colonne e cronologia `HistoryManager`).
- Il cambio di scheda in `main.ts` conserva gli elementi vivi (tramite stile `display: flex` / `display: none`), evitando perdite di stato, scroll o dati.

### 3.7 `format-display.ts`
Regole di proiezione dei valori calcolati sullo schermo:
- Numeri: allineati a destra, con formattazione a massimo 10 cifre significative.
- Testo: allineato a sinistra.
- Booleani: centrati (`TRUE` / `FALSE`).
- Errori: centrati con classe CSS dedicata `cell-error` e colore del tema `--color-error`.
- Celle vuote: stringa vuota.

---

## 4. Componente Griglia Virtualizzata (`src/components/sheet-grid.ts`)

- **Editor sovrapposto**: l'editing avviene tramite un elemento `<input class="cell-editor-overlay">` posizionato esattamente sopra la cella attiva. Nessun `contenteditable` sulle celle della tabella.
- **Sincronizzazione formula bar**: digitare nella barra formule o nell'editor di cella aggiorna contemporaneamente entrambi gli elementi; la barra mostra la formula grezza `=SUM(A1:A2)`, la cella mostra il valore calcolato.
- **Evidenziazione riferimenti formula**: mentre si digita una formula, i riferimenti a celle (`A1`, `B2:C5`) vengono evidenziati da riquadri colorati (`.ref-highlight-box`) posizionati sulle celle corrispondenti. Cliccare su una cella dopo un operatore (`+`, `-`, `*`, `/`, `,`, `(`) inserisce automaticamente l'indirizzo.
- **Resize Colonne**: trascinando il divisore `.col-resizer` si ridimensiona la colonna; facendo doppio clic sul bordo viene eseguito l'auto-fit in base alla larghezza massima dei dati visibili.
- **Reattività incrementale**: tramite `doc.client.onChange`, le celle dipendenti modificate vengono aggiornate a schermo senza ridisegnare l'intera griglia.
