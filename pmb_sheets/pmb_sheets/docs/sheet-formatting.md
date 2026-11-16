# Formattazione delle Celle di Fogli (pmb_office)

Questo documento descrive l'architettura, le regole di formattazione, la sintassi dei codici di formato numerico, la risoluzione degli strati e i vincoli operativi implementati nella Fase 3 di **pmb_office**.

---

## 1. Architettura dei Formati e Disaccoppiamento dal Motore

La formattazione delle celle è gestita da moduli TypeScript puri, completamente disaccoppiati dal motore di calcolo matriciale (`engine/`):

1. **Il motore non conosce gli stili**: Il motore esegue tokenizzazione, parsing, grafo delle dipendenze, valutazione delle formule e propagazione ricalcoli gestendo solo valori scalari o di matrice (`CellValue`: numero, stringa, booleano, errore).
2. **Archiviazione sparsa**:
   - `cellStyles: Record<string, number>` mappa coordinate canonica `col,row` a uno `styleId` numerico.
   - `rowStyles: Record<number, number>` mappa indici di riga (1-indexed) a uno `styleId`.
   - `colStyles: Record<number, number>` mappa indici di colonna (0-indexed) a uno `styleId`.
3. **Registro stili deduplicato (`StyleRegistry`)**:
   - Deduplica ogni oggetto `CellStyle` in base alla sua firma strutturale canonica (`stableStringify`).
   - Lo stile ID `0` rappresenta lo stile predefinito (nessuna formattazione esplicita).
   - Operazioni su intervalli estesi riutilizzano gli ID esistenti, minimizzando l'occupazione di memoria.

---

## 2. Risoluzione degli Strati di Stile e Precedenza

Quando una cella visibile viene renderizzata nella griglia, il suo stile effettivo è determinato valutando quattro strati gerarchici con la seguente precedenza:

$$\text{Cella} > \text{Colonna} > \text{Riga} > \text{Predefinito}$$

La funzione pura `resolveCellStyle(styles, col, row, defaultStyle)`:
- Recupera `cellStyle` dalla mappa sparsa delle celle.
- Recupera `colStyle` dalla mappa delle colonne.
- Recupera `rowStyle` dalla mappa delle righe.
- Fonde le singole proprietà (`bold`, `italic`, `underline`, `strike`, `fontFamily`, `fontSize`, `color`, `fill`, `hAlign`, `vAlign`, `wrap`, `numFmt`, `borders`) assegnando priorità alla cella, poi alla colonna, poi alla riga e infine ai valori predefiniti.

### Applicazione su Intere Colonne o Righe
Selezionando l'intestazione di colonna o riga:
- Viene aggiornato `colStyles[col]` o `rowStyles[row]` in **tempo costante $O(1)$** (< 1 ms).
- Le celle già valorizzate o formattate della colonna/riga ricevono la proprietà aggiornata nel proprio stile di cella.
- Non vengono mai istanziate 1.048.576 celle in memoria.

---

## 3. Codici di Formato Numerico (`src/sheet/number-format.ts`)

Il modulo puro `formatCellValue` gestisce la formattazione visuale dei valori numerici.

### Formati Predefiniti
| Nome Formato | Codice Interno | Esempio Valore | Visualizzazione Resa |
| :--- | :--- | :--- | :--- |
| **Automatico** | `general` | `1234.56` / `0.256` | `1234.56` / `0.256` |
| **Testo normale** | `@` | `1234.5` / `"test"` | `"1234.5"` / `"test"` |
| **Numero intero** | `#,##0` | `1234.56` | `1,235` |
| **Numero standard** | `#,##0.00` | `1234.5` | `1,234.50` |
| **Percentuale intera** | `0%` | `0.256` | `26%` |
| **Percentuale 1 dec** | `0.0%` | `0.256` | `25.6%` |
| **Percentuale 2 dec** | `0.00%` | `0.256` | `25.60%` |
| **Valuta Euro** | `€#,##0.00` | `1234.5` / `-1234.5` | `€1,234.50` / `-€1,234.50` |
| **Scientifico** | `0.00E+00` | `1234.5` | `1.23E+03` |
| **Data canonica** | `dd/mm/yyyy` | `45351` | `29/02/2024` |
| **Ora canonica** | `hh:mm:ss` | `0.75` | `18:00:00` |
| **Data e Ora** | `dd/mm/yyyy hh:mm:ss` | `45351.75` | `29/02/2024 18:00:00` |

### Regole Sintattiche dei Codici Personalizzati
La sottosezione supportata include:
- `0`: segnaposto cifra obbligatoria (mostra zero se non presente).
- `#`: segnaposto cifra opzionale (omesso se zero non significativo).
- `.`: separatore decimale canonico.
- `,`: separatore delle migliaia canonico (raggruppamento a 3 cifre).
- `%`: moltiplicatore percentuale per 100 con aggiunta del simbolo `%`.
- `E+` / `E-`: notazione scientifica con mantissa ed esponente a 2 cifre.
- `dd`: giorno del mese a 2 cifre (`01`–`31`).
- `mm`: mese a 2 cifre (`01`–`12`) in contesto data, oppure minuti in contesto orario.
- `yyyy`: anno a 4 cifre.
- `hh`: ore a 2 cifre in formato 24 ore (`00`–`23`).
- `ss`: secondi a 2 cifre (`00`–`59`).
- `@`: segnaposto testo.
- Letterali tra virgolette doppie o simboli canonici (es. `€`).
- **Resilienza**: Qualsiasi codice sconosciuto o non valido ricade automaticamente su **Automatico** (`general`) senza lanciare eccezioni né rompere l'interfaccia.

### Epoca Seriale Date
In conformità con il motore di calcolo, l'epoca di riferimento è fissata al **1899-12-30 UTC**:
- Seriale `1` = `31/12/1899`
- Seriale `45351` = `29/02/2024` (anno bisestile)
- La frazione decimale rappresenta la porzione del giorno (es. `0.5` = `12:00:00`).

---

## 4. Regole Visive dei Bordi (Spessore Singolo Senza Raddoppi)

Per garantire la massima leggibilità grafica con `border-collapse: separate`:
1. Ogni cella standard disegna il bordo grigio della griglia su destra (`border-right`) e fondo (`border-bottom`).
2. Quando viene applicato un bordo a un intervallo (es. `all`, `outer`, `top`, `bottom`, `left`, `right`):
   - I bordi interni condividono il tratto da 1px assegnato alle celle corrispondenti.
   - I bordi superiori e sinistri vengono disegnati esclusivamente sul perimetro superiore e sinistro della selezione.
   - Non si verificano mai raddoppi di spessore (2px) tra celle adiacenti.

---

## 5. Vincoli di Sicurezza CSP (Tauri WebView2)

In ossequio alla Content-Security-Policy di Tauri:
- **Nessun attributo `style=""` in linea** viene inserito nel markup HTML generato.
- **Nessuna chiamata a `setAttribute('style', ...)`**.
- Non viene utilizzata la direttiva `styleMap` nativa di LitHtml (che genera attributi stringa inline).
- Viene utilizzata esclusivamente la direttiva proprietaria CSSOM `styleMap` definita in `src/utils/style-map.ts`, che opera direttamente sulle proprietà dell'oggetto `element.style` (CSSOM), garantendo la totale assenza di violazioni o warning CSP.

---

## 6. Formato Dati Versionato (`SheetDocumentData` v1)

Il modulo puro `src/sheet/document-data.ts` definisce la struttura versionata per il salvataggio e scambio dei fogli di calcolo:
```typescript
interface SheetDocumentData {
  version: 1;
  engineWorkbook: SerializedWorkbook;
  styleRegistry: StyleRegistryData;
  cellStyles: Record<string, number>;
  rowStyles: Record<number, number>;
  colStyles: Record<number, number>;
  columnWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
}
```
Le funzioni pure `serializeSheetDocumentData` e `deserializeSheetDocumentData` garantiscono la conservazione identica al 100% dell'intero stato visuale e di calcolo.

---

## 7. Limiti Noti e Fasi Future

1. **Separatori numerici**: Attualmente i separatori sono canonici internazionali (`.` per decimali, `,` per migliaia). La localizzazione italiana (`virgola` decimale e `punto` migliaia) è prevista in una fase successiva.
2. **Altezza riga con testo a capo**: L'opzione `wrapText` spezza il testo all'interno della cella, ma l'altezza della riga rimane a 22px con overflow nascosto (limite esplicito di Fase 3).
3. **Funzionalità non previste in Fase 3**: Unione celle, formattazione condizionale, pennello copia formato, inserimento/eliminazione righe/colonne e filtri restano disabilitati o segnaposto per le fasi future.
