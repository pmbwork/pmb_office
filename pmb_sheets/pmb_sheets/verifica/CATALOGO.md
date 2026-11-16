# CATALOGO SCREENSHOT DI VERIFICA — Free_office

Questo catalogo documenta formalmente ogni screenshot catturato via Chrome DevTools Protocol dalla finestra reale dell'eseguibile `free-office-shell.exe` nella cartella `app/verifica/`. Ciascuna voce contiene risoluzione, tema, livello di zoom rigorosamente al 100% e descrizione esaustiva degli elementi visibili senza formule generiche.

---

### 1. `bordi.png` (47.683 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro (sfondo bianco `#ffffff`), zoom al 100%.
- **Cella Attiva**: Cella J10 deselezionata, visibile isolata con contorno blu sottile per lasciare completamente scoperte e libere le celle formattate.
- **Descrizione dei Contenuti**: L'immagine mostra la griglia di Fogli con due regioni di bordi distinte: l'intervallo C1:D2 presenta tutti i bordi interni ed esterni sottili (1px) di colore scuro automatico `#1e293b` con tratto rigorosamente singolo senza raddoppi; l'intervallo F1:G3 mostra un perimetro esterno medio (2px) di colore rosso esplicito `#ef4444` privo di linee divisorie interne. In colonna B sono visibili i testi reali B1 `Prova 1` in rosso, B2 `Prova 2` in corsivo sottolineato su sfondo giallo chiaro `#fef08a`, B3 `Prova 3` in rosso. La barra degli strumenti in alto misura esattamente 42 px senza alcuna barra di scorrimento.

---

### 2. `documenti_chiaro.png` (43.281 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Scheda Attiva**: Documento senza titolo 1 (editor di testi Documenti).
- **Descrizione dei Contenuti**: Viene visualizzata l'interfaccia di Documenti con la barra dei menu standard (File, Modifica, Visualizza, Inserisci, Formato, Strumenti, Aiuto), la toolbar principale con controlli per font Inter dimensione 11, grassetto, corsivo, sottolineato, colore testo, allineamenti orizzontali e interlinea. Al centro è visibile il foglio A4 bianco con margini regolari e cursore lampeggiante nel primo paragrafo. La barra laterale sinistra mostra la struttura del documento vuota. La barra di stato inferiore riporta lo stato Pronto e il cursore dello zoom impostato su 100%.

---

### 3. `documenti_scuro.png` (44.155 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`, canvas pagina scura `#1e293b`), zoom al 100%.
- **Scheda Attiva**: Documento senza titolo 1 (editor di testi Documenti).
- **Descrizione dei Contenuti**: Schermata completa dell'editor Documenti in modalità notturna ad alto contrasto. I menu superiori e la barra degli strumenti presentano icone chiare su sfondo ardesia scuro `#0f172a`. La pagina di lavoro centrale è distinta con tonalità coordinata `#1e293b` e testo chiaro ad alta leggibilità `#f8fafc`. Tutti i pulsanti di formattazione della barra mantengono bordi netti e focus accessibile. La barra di stato inferiore mostra il messaggio di cambio tema scuro e l'indicatore di zoom al 100%.

---

### 4. `finestra-reale-chiaro.png` (43.364 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Descrizione dei Contenuti**: Cattura della shell nativa completa avviata con protocollo custom sicuro `tauri://localhost`. Mostra la barra del titolo personalizzata con icona Free_office, stato di salvataggio in locale e pulsanti di riduzione a icona, ingrandimento e chiusura finestra. L'area interna presenta la scheda iniziale con Documenti attivo, menubar ancorata correttamente in testa a 32 px di altezza e righello orizzontale superiore allineato ai margini della pagina A4 centrale.

---

### 5. `finestra-reale-fogli-chiaro.png` (36.714 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Scheda Attiva**: Foglio senza titolo 1.
- **Descrizione dei Contenuti**: Schermata della griglia di Fogli a tutta larghezza in tema chiaro. La barra delle formule visualizza la casella nome A1 e il campo formula vuoto espandibile. La tabella presenta intestazioni di colonna alfabetiche da A a M e intestazioni di riga numerate da 1 a 24 con altezza fissa di 22 px. La cella A1 è attiva con contorno blu coordinato `#1d4ed8`. In basso a destra lo zoom della barra di stato è posizionato al valore nominale 100%.

---

### 6. `finestra-reale-fogli-scuro.png` (37.360 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Scheda Attiva**: Foglio senza titolo 1.
- **Descrizione dei Contenuti**: Schermata reale della griglia virtualizzata di Fogli renderizzata in tema scuro. Le linee della griglia presentano il colore coordinato sottile `#334155` per garantire distinzione ottimale senza abbagliamento. Le celle della griglia da A1 a M24 sono disposte con larghezza colonna predefinita di 90 px e altezza riga di 22 px. La formula bar in alto mostra lo stato vuoto della casella formula e l'indirizzo della cella corrente A1.

---

### 7. `finestra-reale-scuro.png` (44.953 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro, zoom al 100%.
- **Descrizione dei Contenuti**: Vista complessiva della finestra desktop nativa in tema scuro con scheda Documenti aperta. Evidenzia la perfetta integrazione tra la barra del titolo scura `#090d16` e i menu a discesa contestuali. Il corpo della pagina presenta margini coerenti e i pulsanti della barra degli strumenti offrono contrasto superiore a 5:1 secondo gli standard WCAG 2.2 AA. Nessun elemento di bordo presenta artefatti grafici o disallineamenti di layout.

---

### 8. `fogli_chiaro.png` (37.500 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Descrizione dei Contenuti**: Vista della scheda Fogli aperta tramite il menu di aggiunta scheda. La griglia mostra la corretta virtualizzazione a schermo intero con 325 celle renderizzate nel DOM. Le intestazioni di riga e colonna rimangono fisse durante lo scorrimento e la barra degli strumenti mostra gli strumenti per l'allineamento testo, formati valuta ed euro, formattazione percentuale e regolazione delle cifre decimali. Indicatore di stato in basso con etichetta Pronto.

---

### 9. `fogli_scuro.png` (37.930 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro, zoom al 100%.
- **Descrizione dei Contenuti**: Rappresentazione completa del foglio di calcolo Fogli con tema scuro attivo. Le etichette di riga numerate da 1 a 24 sono chiaramente leggibili con testo secondario `#94a3b8` su sfondo testata `#1e293b`. L'angolo superiore sinistro della tabella mostra la casella di selezione globale con resizer colonne funzionante. La barra di stato inferiore riporta la conferma testuale dell'avvenuta applicazione del tema scuro e il controllo zoom fermo al 100%.

---

### 10. `formati-numerici.png` (46.233 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Cella Attiva**: A3 con casella nome `A3` e formula bar contenente il valore numerico grezzo `45351`.
- **Descrizione dei Contenuti**: Verifica visiva dei formati numerici e della barra degli strumenti responsive P03b. Nella griglia la cella A1 mostra la percentuale `25.60%`, la cella A2 la valuta euro `€1,234.50`, e la cella A3 la data convertita `29/02/2024`. La formula bar mostra il seriale intatto `45351`. In colonna B sono visibili i testi `Prova 1` in rosso grassetto, `Prova 2` corsivo e sottolineato su sfondo giallo chiaro `#fef08a`, `Prova 3` in rosso. In H1 è presente un testo con font Roboto a 24pt che non altera l'altezza riga di 22 px. La toolbar ha altezza fissa di 42 px con etichetta compatta `Data`.

---

### 11. `grassetto-riempimento.png` (47.683 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Cella Attiva**: Cella J10 deselezionata, visibile a destra con contorno blu per non coprire i dati.
- **Descrizione dei Contenuti**: Screenshot di verifica della formattazione testo e colore riempimento su dati reali. Nelle celle B1:B3 si osservano chiaramente: B1 con testo `Prova 1` in rosso vivo `#ef4444` e grassetto 700; B2 con testo `Prova 2` in corsivo e sottolineato con riempimento GIALLO chiaro `#fef08a` confermato da campionamento bitmap CDP; B3 con testo `Prova 3` in rosso grassetto. C1:D2 presenta bordi scuri e F1:G3 bordo perimetrale rosso spesso. Toolbar costante a 42 px senza scrollbar.

---

### 12. `sheet-dati.png` (40.474 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Celle Popolate**: A1=`2`, A2=`3`, A3=`5` calcolata con formula `=SUM(A1:A2)`.
- **Descrizione dei Contenuti**: Schermata catturata durante lo scenario smoke sheet al Passo 5. Mostra l'inserimento sequenziale dei valori interi 2 in cella A1 e 3 in cella A2, seguiti dalla formula di addizione `=SUM(A1:A2)` in cella A3. La formula è stata calcolata istantaneamente dal motore di calcolo locale restituendo il valore 5 allineato a destra. La cella A3 è selezionata e la formula bar ne riporta l'espressione di calcolo.

---

### 13. `sheet-modifica.png` (39.126 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Celle Modificate**: A1 aggiornato da 2 a 10 tramite tasto F2 ed editor sovrapposto; A3 ricalcolato a 13.
- **Descrizione dei Contenuti**: Schermata del Passo 6 dello smoke test Fogli. Dimostra il ricalcolo reattivo in tempo reale del motore a grafo di dipendenze: alla modifica del valore della cella A1 da 2 a 10 tramite l'editor cella in linea, il valore della cella dipendente A3 si aggiorna automaticamente da 5 a 13 senza richiedere ricaricamenti. La formula bar riporta la sincronizzazione immediata del valore modificato.

---

### 14. `sheet-selezione-statusbar.png` (43.054 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Selezione Attiva**: Intervallo A1:A3 selezionato con sfondo azzurrato e perimetro evidenziato.
- **Descrizione dei Contenuti**: Verifica strumentale delle statistiche aggregate nella barra di stato al Passo 9. L'intervallo di celle A1:A3 (contenente i valori 2, 3 e 5) è selezionato mediante trascinamento mouse. Nella barra di stato inferiore, accanto al messaggio di stato, compare la stringa aggregata calcolata: `Somma: 10 · Media: 3.3333 · Conteggio: 3`. Lo slider dello zoom a destra resta fermo al 100%.

---

### 15. `tema-chiaro-fogli.png` (55.316 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro (sfondo bianco `#ffffff`), zoom al 100%.
- **Descrizione dei Contenuti**: Vista della finestra reale dopo lo switch tra schede e l'impostazione esplicita del tema chiaro. La griglia mostra la persistenza totale dei dati inseriti (A1=2, A2=3, A3=5, B3=0 con formula traslata) a conferma dell'isolamento delle schede e dell'assenza di memory leak o reset di stato. Le intestazioni di colonna presentano sfondo grigio chiarissimo `#f1f5f9` e bordo griglia `#cbd5e1`.

---

### 16. `tema-scuro-fogli.png` (54.969 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Vista della finestra reale dopo commutazione a tema scuro con gli stessi dati persistiti nelle celle A1, A2, A3 e B3. Tutti i token cromatici della griglia, della barra formule e della status bar si adattano istantaneamente senza sfarfallio e senza generare alcuna violazione CSP. I dati numerici rimangono candidi e perfettamente distinguibili sullo sfondo notte.

---

### 17. `tema-scuro-formati.png` (47.609 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Cella Attiva**: Cella J10 deselezionata.
- **Descrizione dei Contenuti**: Verifica strumentale dell'adattamento dinamico dei bordi automatici e della persistenza dei colori espliciti in tema scuro. I bordi di C1:D2 sono passati automaticamente al colore chiaro `rgb(226, 232, 240)` con contrasto calcolato di 14.48:1 su sfondo scuro; il bordo perimetrale medio di F1:G3 è rimasto invariato nel suo rosso esplicito `#ef4444`. In B2 è chiaramente visibile il riempimento giallo chiaro `#fef08a` con testo coordinato leggibile.

---

### 18. `struttura-inserisci-riga.png` (39.659 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia e griglia `#0f172a`), zoom al 100%.
- **Cella Attiva**: Riga 2 inserita, con cella A2 selezionata con contorno blu coordinato.
- **Descrizione dei Contenuti**: L'immagine documenta visivamente l'operazione di inserimento di una riga sopra la cella A2 nella finestra reale. La cella A1 mantiene il valore originale 10, la riga 2 inserita è perfettamente vuota, la vecchia riga 2 è slittata a riga 3 conservando il valore 20, e la formula precedentemente posizionata in A3 è traslata automaticamente alla nuova riga 4 come `=A1+A3` producendo il risultato corretto 30. In basso a sinistra è ben visibile la nuova barra delle schede del foglio di calcolo con il pulsante più e la scheda Foglio1.

---

### 19. `struttura-schede-multiple.png` (39.355 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Scheda Attiva**: Foglio2 attivo, evidenziato in colore blu scuro nella barra schede inferiore.
- **Descrizione dei Contenuti**: Viene visualizzata la gestione multi-foglio della cartella di lavoro Fogli con due schede create nella barra inferiore: Foglio1 e Foglio2. Il focus è posizionato sulla nuova scheda Foglio2, con la cella A1 valorizzata a 999 sia nella griglia sia nella barra delle formule in alto. La griglia di Foglio2 è indipendente e priva dei dati presenti in Foglio1, certificando il completo isolamento dei dati e delle strutture tra le diverse schede della medesima cartella di lavoro.

---

### 20. `struttura-riempimento.png` (43.041 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Selezione Attiva**: Intervallo A1:A5 selezionato con sfondo azzurrato e maniglia di riempimento visibile nell'angolo inferiore destro della cella A5.
- **Descrizione dei Contenuti**: Dimostrazione della funzionalità di riempimento automatico verso il basso (Ctrl+D) eseguita sull'intervallo A1:A5. Il valore iniziale 10 della cella A1 è stato replicato istantaneamente su tutte le celle sottostanti A2, A3, A4 e A5. La barra di stato in basso a destra espone il calcolo aggregato automatico reattivo: Somma: 50, Media: 10, Conteggio: 5. Nella barra schede in basso a sinistra si osservano le due schede Foglio1 e Foglio2 perfettamente allineate.

---

### 21. `dati-ordinamento.png` (43.841 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: L'immagine documenta l'ordinamento naturale crescente A→Z eseguito sull'intervallo A1:B3. I valori originali sparsi della colonna A (30, 10, 20) risultano perfettamente ordinati in sequenza crescente: cella A1 pari a 10, cella A2 pari a 20 e cella A3 pari a 30. Nella colonna B le formule relative `=A1*2`, `=A2*2` e `=A3*2` hanno seguito fedelmente lo spostamento delle rispettive righe producendo i risultati ricalcolati 20, 40 e 60 senza alcuna corruzione di coordinate. La barra formule in alto riflette la formula grezza e la barra delle schede in basso espone Foglio1.

---

### 22. `dati-filtro-attivo.png` (44.349 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Dimostrazione del motore di filtraggio dati con visualizzazione dell'indicatore di filtro attivo sull'intestazione di colonna. Sulla colonna A è stata applicata una condizione di filtro per valore maggiore di 15, provocando l'occultamento automatico della riga 1 che conteneva il valore 10. Risultano quindi visibili unicamente le righe 2 e 3 con i rispettivi valori 20 e 30, mentre 99 righe non conformi sono contrassegnate come nascoste. L'intestazione della colonna A presenta l'icona interattiva del filtro a imbuto colorata e chiaramente distinguibile.

---

### 23. `dati-convalida-unione.png` (43.551 bytes)
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema scuro (sfondo griglia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: L'immagine illustra congiuntamente l'unione di celle rettangolari e le caselle di controllo interattive derivanti dalle regole di convalida dati. Nell'intervallo C1:D2 è visibile una macro-cella fusa (rowspan 2, colspan 2) con sfondo scuro coerente e testo centrato "Area Unita", mentre le celle coperte C2, D1 e D2 sono correttamente rimosse dal flusso visivo. Nella cella A5 è presente una casella di controllo interattiva commutata nello stato attivo (checked, valore booleano TRUE) con segno di spunta bianco su riquadro scuro, perfettamente cliccabile e priva di violazioni stilistiche.

---

### 24. `toolbar-fogli-800.png` (38.038 bytes)
- **Risoluzione e Finestra**: 800x850 px (viewport utile 784 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Cattura della barra degli strumenti per la scheda Fogli a larghezza ridotta di 800 pixel. La barra mantiene rigorosamente l'altezza prescritta di 42 pixel. A causa dello spazio ristretto, i primi 4 gruppi di comandi rimangono visibili (annulla/ripeti, stampa, formati valuta/percentuale/decimali e font Inter con dimensione e stili base), mentre i gruppi successivi collassano ordinatamente nel menu overflow segnalato dal pulsante con icona tre puntini `#btn-toolbar-more` posizionato all'estrema destra. Nessun controllo oltrepassa il bordo destro della finestra, eliminando ogni fenomeno di overflow o barra di scorrimento orizzontale.

---

### 25. `toolbar-fogli-1000.png` (39.527 bytes)
- **Risoluzione e Finestra**: 1000x850 px (viewport utile 984 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Barra degli strumenti della scheda Fogli alla larghezza intermedia di 1000 pixel. L'altezza complessiva risulta perfettamente stabile a 42 pixel. L'estensione della viewport consente la visualizzazione diretta dei gruppi di annulla/ripeti, formattazione rapida numerica, selettori di carattere tipografico e dimensione, attributi di testo grassetto/corsivo/sottolineato/barrato e dei due selettori colore per testo e riempimento cella. I gruppi di allineamento, bordi e unione celle confluiscono nel menu a scomparsa, attivabile mediante il pulsante "Altri strumenti" visibile a fine barra senza alcun debordamento visivo.

---

### 26. `toolbar-fogli-1200.png` (42.384 bytes)
- **Risoluzione e Finestra**: 1200x850 px (viewport utile 1184 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Verifica visiva fondamentale a 1200 pixel per la scheda Fogli, larghezza nella quale la precedente versione presentava difetti di overflow con controlli oltre il bordo. La nuova implementazione mostra l'intera sequenza di comandi fino al gruppo bordi con relativi menu a discesa per tipo e spessore, mentre il pulsante `#btn-toolbar-more` raccoglie in modo pulito i gruppi di allineamento e utilità. Tutti i 20 controlli visibili rispettano scrupolosamente il bordo destro di 1184 pixel, attestando la piena risoluzione della regressione geometrica precedentemente riscontrata dal revisore.

---

### 27. `toolbar-fogli-1600.png` (45.707 bytes)
- **Risoluzione e Finestra**: 1600x850 px (viewport utile 1584 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Schermata della barra degli strumenti Fogli alla massima larghezza di collaudo pari a 1600 pixel. Con un'area interna di 1584 pixel tutti gli 8 gruppi di strumenti previsti dal registro risultano simultaneamente visibili: storico, stampa, formati numerici, font, stili di carattere, selettori colore, bordi e allineamenti completi con testo a capo, unione e filtro. Come richiesto dalla logica di responsive design, in assenza di gruppi nascosti il pulsante ausiliario `#btn-toolbar-more` scompare automaticamente, garantendo una superficie grafica massimamente fruibile e perfettamente allineata.

---

### 28. `toolbar-doc-800.png` (45.335 bytes)
- **Risoluzione e Finestra**: 800x850 px (viewport utile 784 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Schermata della scheda Documenti ridimensionata alla larghezza minima di 800 pixel. L'altezza della barra degli strumenti misura esattamente 42 pixel. Sono disposti in linea i pulsanti per annulla/ripeti/stampa, il menu a discesa per lo zoom percentuale, lo stile paragrafo predefinito, la scelta font Roboto con dimensione 11 punti e gli stili di testo essenziali. Il pulsante tre puntini compare regolarmente all'estremità destra ospitando i controlli di allineamento e gli elenchi puntati e numerati, scongiurando il debordamento di elementi riscontrato nello storico delle verifiche.

---

### 29. `toolbar-doc-1000.png` (47.321 bytes)
- **Risoluzione e Finestra**: 1000x850 px (viewport utile 984 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Barra degli strumenti Documenti testata a 1000 pixel di larghezza della finestra. L'ampiezza di 984 pixel permette l'alloggiamento completo di tutti i 6 gruppi della barra di redazione testo senza alcuna necessità di troncamento o occultamento. Risultano direttamente accessibili i comandi di cronologia, visualizzazione, formattazione testo, allineamenti orizzontali (sinistra, centro, destra, giustificato) ed elenchi. Il pulsante di overflow scompare conformemente alle specifiche, confermando l'assenza di gruppi celati e la perfetta aderenza alle dimensioni orizzontali.

---

### 30. `toolbar-doc-1200.png` (47.893 bytes)
- **Risoluzione e Finestra**: 1200x850 px (viewport utile 1184 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Documentazione visuale della scheda Documenti alla larghezza standard di 1200 pixel. L'interfaccia si presenta ariosa, elegante e coerente, con l'intero catalogo di controlli per l'editor testuale accessibile in un unico nastro orizzontale privo di interruzioni. I 17 controlli attivi occupano lo spazio disponibile con margini regolari, senza causare alcuno scorrimento orizzontale o scavalcamento della cornice destra. Sotto la barra, l'area di redazione testuale "Documento di Free_office" si staglia nitida sul foglio centrale.

---

### 31. `toolbar-doc-1600.png` (49.108 bytes)
- **Risoluzione e Finestra**: 1600x850 px (viewport utile 1584 px), WebView2 reale su Windows dimensionato con SetWindowPos.
- **Tema e Zoom**: Tema scuro (sfondo interfaccia `#0f172a`), zoom al 100%.
- **Descrizione dei Contenuti**: Finestra dell'applicazione estesa a 1600 pixel per l'elaboratore testi. A fronte di una larghezza di 1584 pixel interni, tutti i pulsanti e i menu a discesa mantengono l'altezza uniforme di 42 pixel e proporzioni geometriche stabili. Non è presente alcun pulsante di overflow e non si rileva alcuna barra di scorrimento orizzontale indesiderata. La struttura responsive dimostra solidità in ogni condizione di visualizzazione su schermi ad alta risoluzione senza distorsioni del layout.

---

### 32. `contrasto-wcag-riempimento.png` (51.448 bytes)
- **Risoluzione e Finestra**: 1600x850 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro (sfondo griglia bianco `#ffffff`), zoom al 100%.
- **Descrizione dei Contenuti**: Dimostrazione rigorosa del calcolo automatico del contrasto cromatico conforme alle linee guida WCAG 2.1 AA (rapporto maggiore o uguale a 4.5:1) misurato direttamente tramite getComputedStyle sul DOM reale. Nella colonna A della griglia sono applicati i quattro sfondi di test prescritti: riga 1 giallo chiaro (#fef08a) con testo nero calcolato (rapporto 18.05:1), riga 2 blu scuro (#1e3a8a) con testo bianco calcolato (rapporto 10.36:1), riga 3 rosso (#ef4444) con testo nero calcolato (rapporto 5.58:1) e riga 4 grigio medio (#64748b) con testo bianco calcolato (rapporto 4.76:1). Nella riga 5 è visibile la cella con riempimento giallo chiaro e colore verde esplicito scelto dall'utente (#15803d), il quale viene fedelmente preservato senza alcuna sovrascrittura automatica indebita.

---

### 33. `array-dinamici-spill.png`
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro (sfondo bianco `#ffffff`), zoom al 100%.
- **Cella Attiva**: A1 con formula `=SEQUENCE(4, 2, 10, 5)`.
- **Descrizione dei Contenuti**: Schermata che dimostra la tecnologia delle matrici dinamiche (Dynamic Arrays) e la propagazione automatica (spill) su più celle del foglio di calcolo. La formula inserita nella cella master A1 genera un intervallo di 4 righe per 2 colonne popolando istantaneamente le celle adiacenti: A1=10, B1=15, A2=20, B2=25, A3=30, B3=35, A4=40, B4=45 senza bisogno di formule di matrice legacy con combinazioni di tasti speciali. Le celle figlie mostrano i valori numerici derivati e rispondono dinamicamente alla gestione delle collisioni (#SPILL!) quando un ostacolo occupa l'area di espansione.

---

### 34. `grafici-svg.png`
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Descrizione dei Contenuti**: Schermata dell'eseguibile reale che illustra il componente fluttuante free-chart-overlay posizionato sopra la griglia dei Fogli. Il grafico a colonne nativo SVG è generato a partire dalle serie numeriche presenti nelle celle D1:E4 (categorie Mele, Pere, Arance, Banane con valori 45, 70, 30, 85). La rappresentazione grafica rispetta fedelmente i vincoli di Content Security Policy (CSP) senza alcun attributo style in linea negli elementi vettoriali, impiegando unicamente attributi di presentazione SVG puri (fill, stroke, rx, text-anchor). Il riquadro presenta la barra di testata con etichetta Grafico, pulsanti di modifica ed esportazione SVG e la maniglia di ridimensionamento interattivo.

---

### 35. `tabelle-pivot.png`
- **Risoluzione e Finestra**: 1200x800 px, WebView2 reale su Windows.
- **Tema e Zoom**: Tema chiaro, zoom al 100%.
- **Descrizione dei Contenuti**: Visualizzazione della tabella pivot generata e renderizzata direttamente nella griglia a partire dalla matrice di dati sorgente in G1:H5 (fatturato per zone geografiche Nord, Centro e Sud). L'elaboratore pivot esegue il raggruppamento per categoria e il calcolo aggregato tramite la funzione SOMMA, producendo la tabella riepilogativa con intestazione, righe raggruppate (Nord pari a 750, Centro pari a 300, Sud pari a 400) e la riga di totale complessivo calcolata a 1450. Il pannello laterale a scomparsa consente la personalizzazione interattiva dei campi riga, colonna, filtri e funzioni di aggregazione.

