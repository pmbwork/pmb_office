# SPECIFICA SEMANTICA DEL MOTORE DI CALCOLO DI FOGLI (FREE_OFFICE)

Versione: 1.0.0  
Data: 2026-10-25  
Autore: pmb_office Core Team  
Ambiente di esecuzione: TypeScript puro (Node.js, Web Worker, Browser). Zero DOM, zero rete, zero I/O su filesystem.

---

## 1. Modello dei Dati e Indirizzamento

### 1.1 Cartella di Lavoro (Workbook) e Fogli (Sheets)
- Un `Workbook` contiene una collezione ordinata di `Sheet`.
- Ogni foglio possiede un nome univoco all'interno della cartella di lavoro.
- I nomi dei fogli vengono confrontati in modo **case-insensitive** (es. `Foglio1` e `FOGLIO1` identificano lo stesso foglio).
- Memorizzazione delle celle: **rigorosamente sparsa** (`Map` indicizzata). Le celle non valorizzate non occupano memoria né nodi nel grafo di calcolo.

### 1.2 Limiti Dimensionali della Griglia
- Righe: da `1` a `1.048.576` (1-based).
- Colonne: da `1` a `16.384` (corrispondente a `A` .. `XFD`).

### 1.3 Sintassi degli Indirizzi
- Cella singola: `A1`, `$A$1`, `$A1`, `A$1`.
- Intervallo rettangolare: `A1:B5`.
- Colonne intere: `A:A`, `A:C`, `$A:$B`.
- Righe intere: `1:1`, `1:10`, `$1:$5`.
- Riferimenti ad altri fogli:
  - Nome semplice: `Foglio2!A1`, `Dati!A1:B10`.
  - Nome con spazi o caratteri speciali (racchiuso tra apici singoli): `'Dati Vendite'!A1`, `'Foglio con ''apici'''!A1:C3`. Gli apici singoli all'interno del nome vengono raddoppiati (`''`).

---

## 2. Tipologia dei Valori ed Errori

### 2.1 Tipi di Valore
1. **Numero**: IEEE 754 float a 64 bit (`number`).
2. **Testo**: sequenza di caratteri UTF-16 (`string`).
3. **Booleano**: `true` o `false` (`boolean`).
4. **Vuoto**: assenza di valore (`kind: "empty"`).
5. **Errore**: codice di errore standard (`kind: "error"`).

### 2.2 Errori Canonici
- `#DIV/0!`: Divisione per zero o media su insieme privo di numeri.
- `#VALUE!`: Tipo di dato errato per l'operazione richiesta, testo non convertibile, o intervallo in contesto scalare.
- `#REF!`: Riferimento a cella fuori limiti o a foglio eliminato/inesistente.
- `#NAME?`: Nome di funzione o identificatore sconosciuto.
- `#N/A`: Valore non disponibile (es. `MATCH` o `VLOOKUP` senza corrispondenza).
- `#NUM!`: Calcolo numerico non valido (es. `SQRT(-1)`, overflow, o `MEDIAN` su insieme privo di numeri).
- `#CIRCULAR!`: Dipendenza circolare rilevata tra celle.
- `#ERROR!`: Errore sintattico nella formula (parentesi spaiate, operatore mancante, ecc.).

---

## 3. Grammatica, Operatori e Precedenze

### 3.1 Notazione Canonica Interna
- Formule: iniziano con il prefisso `=`.
- Separatore argomenti: `,` (virgola).
- Separatore decimale: `.` (punto).
- Nomi di funzione: maiuscoli in inglese nel motore (disaccoppiati dal parser tramite registro estraibile per localizzazione).

### 3.2 Tabella delle Precedenze (dalla più alta alla più bassa)
1. Riferimenti, parentesi e chiamate di funzione: `( ... )`, `A1`, `FOO(...)`
2. `%` postfisso (divide l'operando per 100)
3. Operatori unari: `-` (negazione) e `+` (identità unaria)
4. `^` potenza (associatività a sinistra). **Regola chiave**: la negazione unaria ha precedenza più alta rispetto a `^`. Pertanto: `-2^2` equivale a `(-2)^2 = 4`.
5. `*` e `/` (moltiplicazione e divisione)
6. `+` e `-` (addizione e sottrazione binarie)
7. `&` (concatenazione testuale)
8. Confronti: `=`, `<>`, `<`, `>`, `<=`, `>=` (producono sempre un booleano `TRUE` o `FALSE`)

---

## 4. Regole di Conversione e Confronto

### 4.1 Coercizione Aritmetica
- Stringhe numeriche: convertite automaticamente in numero (`"42"` -> `42`, `"3"+1` -> `4`).
- Stringhe non numeriche: generano `#VALUE!`.
- Cella vuota:
  - In contesto numerico / aritmetico vale `0`.
  - In contesto testuale (`&`) vale stringa vuota `""`.
- Booleani: `TRUE` vale `1`, `FALSE` vale `0`.
- Intervallo in contesto scalare (es. `=A1:A3 + 1`): genera `#VALUE!` (nessuna intersezione implicita).

### 4.2 Ordinamento Globale dei Confronti
Nei confronti `<`, `<=`, `>`, `>=` tra tipi eterogenei, l'ordinamento canonico è:
$$\text{Numero} < \text{Testo} < \text{Booleano}$$
- Qualsiasi numero è minore di qualsiasi stringa (es. `999999 < "a"` -> `TRUE`).
- Qualsiasi stringa è minore di qualsiasi booleano (es. `"zzz" < FALSE` -> `TRUE`).
- Confronti tra stringhe: **case-insensitive** (`"apple" = "APPLE"` -> `TRUE`).
- Confronto con vuoto: se confrontato con un numero vale `0`; se confrontato con un testo vale `""`; se confrontato con vuoto vale uguaglianza.

---

## 5. Funzioni di Aggregazione e Criteri

### 5.1 Regole di Aggregazione (SUM, AVERAGE, MIN, MAX, COUNT, PRODUCT, MEDIAN)
- **All'interno di intervalli o matrici**: celle vuote, testo e booleani vengono **completamente ignorati**.
- **Negli argomenti diretti**: valori booleani (`TRUE`/`FALSE`) e testi numerici (`"5"`) vengono convertiti e conteggiati (es. `SUM(1, TRUE, "4") = 6`).
- Casi limite senza elementi numerici:
  - `AVERAGE(...)`: restituisce `#DIV/0!`.
  - `MEDIAN(...)`: restituisce `#NUM!`.
  - `MIN(...)` e `MAX(...)`: restituiscono `0`.
  - `COUNT(...)`: restituisce `0`.

### 5.2 Arrotondamento Decimale Esatto (ROUND, ROUNDUP, ROUNDDOWN, CEILING, FLOOR)
- **Risoluzione delle anomalie di rappresentazione binaria IEEE 754**:
  L'arrotondamento opera sulla rappresentazione decimale scientifica del numero (`Number.toString()`), traslando il punto decimale prima di invocare le primitive intere (`Math.round`, `Math.ceil`, `Math.floor`) e ritraslandolo indietro.
- In questo modo il mezzo decimale si arrotonda sempre rigorosamente lontano da zero (*half-away-from-zero*), esattamente come atteso dal numero decimale inserito dall'utente:
  - `ROUND(1.005, 2)` = `1.01`
  - `ROUND(1.255, 2)` = `1.26`
  - `ROUND(0.285, 2)` = `0.29`
  - `ROUND(2.675, 2)` = `2.68`
  - `ROUND(8.345, 2)` = `8.35`
  - `ROUND(-1.005, 2)` = `-1.01`
  - `ROUND(1234.5678, -2)` = `1200`
  - `ROUND(0.5, 0)` = `1`, `ROUND(-0.5, 0)` = `-1`
- `ROUNDUP` e `ROUNDDOWN` applicano la medesima traslazione scientifica per difetto e per eccesso lontano dallo zero.
- `CEILING` e `FLOOR` normalizzano il quoziente `val / significance` con arrotondamento decimale esatto rispetto ai decimali del passo (`significance`), evitando anomalie come `1.2000000000000002`.
- **Limite di precisione**: oltre le 15 cifre significative opera il limite fisico dei registri IEEE 754 float64 (i numeri oltre $10^{15}$ sono già interi o soggetti a troncamento intrinseco).

### 5.3 Criteri Tipizzati per Ricerca e Aggregazione (SUMIF, COUNTIF, AVERAGEIF)
Nei predicati di filtro e aggregazione condizionale la corrispondenza è rigorosamente legata al **tipo del criterio**:
1. **Criteri numerici** (`>4`, `10`, `<=5`, `=10`):
   - Corrispondono **esclusivamente alle celle di tipo numerico**. Le celle di testo (anche se contengono stringhe che nel confronto globale risulterebbero maggiori, es. `"apple"`), i booleani e le celle vuote **non corrispondono mai**.
2. **Criteri testuali con operatore di disuguaglianza** (`"<b"`, `">=m"`):
   - Corrispondono **esclusivamente alle celle di tipo testo**. I numeri, i booleani e le celle vuote **non corrispondono mai**.
3. **Criteri di uguaglianza/disuguaglianza** (`=...`, `<>...` o valore semplice):
   - Seguono il tipo del valore cercato. Una stringa cerca solo stringhe (o rispetta i caratteri jolly `*`, `?`, `~`). Un numero cerca solo numeri.
4. **Celle vuote e operatori relazionali**:
   - Una cella vuota **non corrisponde mai** a criteri con operatori `>`, `<`, `>=`, `<=`.
5. Valido indistintamente per `COUNTIF`, `SUMIF` (con o senza intervallo somma esplicito) e `AVERAGEIF`.

---

## 6. Calendario e Date

- Rappresentazione interna: numero seriale float64.
- Epoca base (giorno seriale 0): `1899-12-30`.
- Seriale `1` corrisponde a `1899-12-31`. Seriale `2` corrisponde a `1900-01-01`.
- **Risoluzione del bug 1900**: l'anno 1900 NON è bisestile (calendario Gregoriano rigoroso). I calcoli sono esatti per qualsiasi data $\ge$ `1900-03-01`. Le date precedenti al `1900-03-01` sono calcolate matematicamente sul calendario gregoriano prolungato.

---

## 7. Grafo delle Dipendenze, Cicli e Ricalcolo

1. **Grafo Diretto A-ciclico (DAG)**:
   - Ogni cella con formula registra i propri predecessori (celle e intervalli da cui dipende).
2. **Indice Spaziale per Intervalli**:
   - Per non creare milioni di archi espliciti quando una formula riferisce `A1:A50000`, il grafo memorizza intervalli come bounding-box `(sheet, minR, minC, maxR, maxC)`.
   - La modifica di una cella interroga l'indice in tempo logaritmico/lineare rispetto al numero di intervalli registrati, non delle celle.
3. **Rilevamento Cicli**:
   - Algoritmo di Tarjan per componenti fortemente connesse (SCC) e ordinamento topologico iterativo (Kahn).
   - Se viene rilevato un ciclo, **tutte e sole le celle appartenenti al ciclo** assumono lo stato d'errore `#CIRCULAR!`. Le celle esterne che non dipendono dal ciclo mantengono il loro valore corretto.
   - Una formula che contiene se stessa in un intervallo di riga o colonna (es. `=SUM(1:1)` o `=SUM($1:$1)` inserita in una cella della riga 1) assume correttamente lo stato `#CIRCULAR!`. La stessa formula inserita in un'altra riga (es. `A2`) non è ciclica e viene valutata normalmente.
4. **Ricalcolo Minimale Incrementale e Prestazioni Lineari**:
   - Quando una cella cambia valore via `setCell`, vengono marcate come dirty solo le celle discendenti.
   - L'ordinamento topologico e la deduplicazione degli insiemi di propagazione utilizzano strutture `Set` a complessità $O(1)$, garantendo un tempo di calcolo rigorosamente lineare $O(N)$ anche su catene di 50.000 e 100.000 nodi.
   - Accesso a intervalli e funzioni di lookup (`VLOOKUP`, `HLOOKUP`, `MATCH`, `INDEX`) zero-copy: le matrici non vengono allocate ad ogni chiamata; l'accesso avviene direttamente sulle mappe sparse del foglio con ricerca esatta ottimizzata a livello assembly da V8.
5. **Rimozione e Rinomina di Fogli**:
   - Rimuovere un foglio (`removeSheet`) invalida le formule che vi facevano riferimento, propagando `#REF!` ai discendenti.
   - Ricreare o rinominare un foglio con lo stesso nome ripristina la risoluzione delle coordinate e il calcolo dei valori al successivo ricalcolo.
6. **Formato Notifiche `onChange`**:
   - I listener registrati con `wb.onChange((changes) => ...)` ricevono una lista di oggetti fortemente tipizzati:
     ```typescript
     export interface CellChange {
       sheet: string;    // Nome originale del foglio (es. "Foglio1")
       address: string;  // Indirizzo in notazione canonica A1 (es. "H1", "A2")
     }
     ```
   - Nessuna chiave interna o indice sparso viene esposto all'interfaccia utente.
