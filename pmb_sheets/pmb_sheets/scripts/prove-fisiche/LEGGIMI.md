# Prove fisiche di pmb_sheets

Script Python che provano il programma **installato** come lo userebbe una persona: avviano `C:\AI_system\pmb_office\pmb_sheets\pmb-sheets-shell.exe`, lo guardano con Playwright (collegato al componente web WebView2) e lo comandano con mouse e tastiera **veri** di Windows (`SetCursorPos`, `mouse_event`, `SendInput`). Servono perché i test automatici (`npm test`) girano in un finto browser e non vedono i difetti di tastiera, focus, mouse, regole di sicurezza della finestra e disegno.

## Come si lancia
```powershell
.\costruisci-installa-e-prova.ps1 -Prova giro_16_immagine.py                    # compila, installa e prova
.\costruisci-installa-e-prova.ps1 -Prova giro_16_immagine.py -SenzaCompilare    # solo la prova
```
Servono: Windows, Python con `playwright`, `pillow` e `openpyxl`, e Rust sotto `C:\AI_system\rust` (per compilare). Durante una prova **non muovere il mouse né coprire la finestra**: le prove usano il puntatore vero.

## Cosa copre ogni script
| Script | Prova |
|---|---|
| `giro_01_input` | scrittura nelle celle, tasti, formati inseriti a mano |
| `giro_02_file`, `giro_08_file` | menu File, salvare e riaprire (.psheet, .xlsx, .ods), CSV, file rotti, 20.000 righe |
| `giro_03_menu`, `giro_04_formato` | tutte le voci dei menu Modifica, Visualizza, Inserisci, Formato, Dati, Strumenti |
| `giro_05_barra` | barra strumenti |
| `giro_06_mouse` | mouse su celle, intestazioni, schede, barra del titolo e di stato |
| `giro_07_formule` | 63 formule scritte all'italiana e come si vedono |
| `giro_09_intest` | trascinare sulle intestazioni di riga e colonna |
| `giro_10_multi` | selezione multipla con Ctrl+clic |
| `giro_11_link` | link (Ctrl+K, Alt+clic, menu, annulla) |
| `giro_12_arresto` | recupero dopo un arresto brusco (processo ucciso) |
| `giro_13_grande` | avviso se la copia di emergenza non si può scrivere |
| `giro_14_tabella` | Inserisci > Tabella |
| `giro_15_ortografia` | F7, correttore e dizionario |
| `giro_16_immagine` | immagini: inserire, spostare, ridimensionare, eliminare, salvare |
| `giro_17_xlsx_immagini` | immagini in .xlsx, verificate con openpyxl nei due sensi |
| `giro_18_filtro` | filtro di colonna: valori da spuntare, ricerca, condizioni, più colonne insieme, Ctrl+Z, Esc, rimozione |
| `giro_19_taglia` | Ctrl+X / Ctrl+V: commenti, convalide, celle unite e nomi vanno con le celle; Ctrl+Z e Ctrl+Y |
| `giro_20_copia` | Ctrl+C / Ctrl+V: una copia di commenti, convalide e celle unite; Ctrl+Z e Ctrl+Y; Incolla speciale non porta niente |
| `giro_21_lambda` | LAMBDA, MAP, REDUCE, SCAN, MAKEARRAY, TEST.T e distribuzione t scritte a mano all'italiana; errori a video |
| `giro_22_query` | QUERY: select/where, group by + order by + aggregati, limit/offset, uso dentro SOMMA, ricalcolo dopo una modifica, errori a video |
| `giro_23_grafici` | grafici vivi e che seguono taglio, righe e colonne inserite o eliminate (con Annulla); pivot che segue e si ricalcola |
| `giro_24_formati` | formati numerici: contabilità, durata, frazione, negativi rossi (colore misurato), finestra del formato personalizzato con anteprima, formato non valido |
| `giro_25_pivot_viva` | pivot che si riscrive da sola; grafico e pivot dopo rinomina, duplicazione ed eliminazione di un foglio (con Ctrl+Z) |
| `giro_26_subtotale` | SUBTOTALE e AGGREGA con righe nascoste a mano (tasto destro) e da un filtro, insieme, con Ctrl+Z |
| `giro_27_tempo` | ADESSO e OGGI avanzano da soli (aspetta 75 s); CASUALE no; il file non risulta modificato |
| `giro_28_blocco_riquadri` | il blocco dei riquadri segue righe e colonne inserite o eliminate (dentro la zona, fuori, annulla e ripeti) |
| `giro_29_copia_condizionale` | copia e incolla portano le formattazioni condizionali (colore vero, annulla, parte sola, taglio) |
| `giro_30_incolla_formato` | Incolla speciale > Solo formato porta le formattazioni condizionali; Solo valori no |
| `giro_31_incolla_sostituisce_regole` | incollare sostituisce le formattazioni condizionali sotto l'area incollata (anche con sorgente senza regole); annulla e ripeti; Solo valori no |
| `giro_32_regole_formula_e_trasposto` | regole con formula a video e copiate (riferimenti spostati); Incolla speciale > Trasposto porta le regole |
| `giro_33_filtro_colore_data_ordina` | finestrella del filtro: per colore di sfondo, per data (anno e mese), Ordina Z → A con i formati che seguono la riga e annulla |
| `giro_34_regole_grafiche_e_formula_dal_dialogo` | dialogo Formattazione condizionale: regola con formula, scala di colore a tre toni, barre dati (0/50/100 %), icone a frecce e Annulla |
| `giro_35_elenco_regole_e_soglie` | elenco delle regole nel dialogo: soglia del massimo, sfondo e barra insieme, ↓ priorità, ✎ modifica, ✕ elimina e Ctrl+Z |
| `giro_36_viste_filtro_e_ordina_per_colore` | finestrella del filtro: Ordina per colore con i formati che seguono; Dati > Viste filtro...: salva, Rimuovi filtri, applica, elimina e Ctrl+Z |
| `giro_37_convalida_incolla_riempi_elenco` | convalida: Ctrl+V e maniglia di riempimento non scrivono i valori rifiutati (con il messaggio), elenco delle convalide con ✎ su due aree, ✕ e Ctrl+Z |
| `giro_38_regole_formula_righe_e_taglio` | regola con formula: Inserisci > Riga sopra, Modifica > Elimina riga e Ctrl+X/Ctrl+V la riscrivono e i colori restano giusti; Ctrl+Z |
| `giro_39_filtro_su_tabella` | filtro su una tabella con l'intestazione in riga 4: frecce solo sulle sue colonne, valori, Applica, Ordina A → Z senza muovere titolo e blocco sotto, Rimuovi filtri e Ctrl+Z |
| `giro_40_logo` | il logo orizzontale nella barra del titolo (100 pixel, motto leggibile, su pannello bianco, senza la scritta pmb_sheets; bottoni della finestra 38 pixel in alto) e nella finestra Informazioni, caricati e non bloccati dalla CSP |
| `giro_41_bottone_segnalazione` | il bottone «Segnalazione bug» dopo il menu Informazioni: un clic vero apre la finestra di segnalazione |
| `giro_42_finestra_stretta` | finestra di 760 pixel: bottone Segnalazione bug su una riga, menu «Altri strumenti» fisso e cliccabile, tavolozza dei colori dentro il menu |
| `giro_43_contabilita` | formato Contabilità: simbolo a sinistra e numero a destra (positivo, negativo, zero) |
| `giro_44_toolbar_personalizzata` | barra strumenti personalizzabile, menu contestuale tasto destro, frecce filtro in cella, bottone verde |

`giro_lib.py` è la libreria comune (classe `Banco`). Ogni script stampa `OK` / `FAIL` / `MANCA` / `NOTA` e un riepilogo finale. Ogni script usa una porta e una cartella dati proprie, così non si disturbano.

## Trucchi imparati (evitano ore di strada sbagliata)
- **Le celle selezionate non mostrano il loro sfondo** ma il colore di selezione: per misurare uno stile bisogna prima spostare la selezione altrove.
- **Il puntatore può essere spostato da fuori** (anche dall'utente). Per i clic che devono cadere su una cella si ripete il clic finché la selezione è quella giusta (vedi `clic_giusto` negli script 10, 11, 14).
- **I clic del mouse sui menu** possono chiudere un menu aperto dal solo passaggio del puntatore: dopo `hover` si aspetta che il menu sia attivo prima di cliccare (già gestito in `Banco.menu`).
- **Gli stili scritti come testo (`style="..."`) vengono bloccati** dalla regola di sicurezza (CSP) della finestra: nel codice si usa `styleMap`.
- **Il correttore ortografico** si vede solo con parole sbagliate della lingua di cui Windows ha il dizionario (qui l'inglese); l'italiano richiede la lingua Italiano in Windows.
- **Le finestre di Salva e Apri del sistema** non si possono comandare: le prove le sostituiscono con funzioni finte (`window.__salvati`, `window.__aprire`).
- Un `FAIL` può essere un errore dello script e non del programma: confrontare sempre con i dati stampati.
- **Il lanciatore deve dire la verità sull'installazione.** Se una prova fallisce in modo strano (per esempio "il metodo non esiste"), prima controllare che il programma installato sia quello nuovo: il lanciatore ora lo verifica, ma in passato l'installazione non partiva (percorso con spazio non tra virgolette) e il log vecchio faceva credere il contrario. PowerShell 5.1: niente `$ErrorActionPreference='Stop'` con `npx` (stderr diventa errore), niente `2>&1` diretto sui programmi (si usa `cmd /c "... 2>&1"`), script con BOM UTF-8 se hanno accenti.
- **Subito dopo l'installazione** la prima prova può fallire in blocco (il mouse non arriva alla finestra): il lanciatore aspetta cinque secondi; se succede ancora, rilanciare con `-SenzaCompilare`.
- **Le voci di sottomenu** si danno a `Banco.menu` con tutto il percorso: `b.menu('Modifica', 'Incolla speciale', 'Solo valori')`.
- **Un grafico sopra le celle blocca il trascinamento del mouse**: la selezione si ferma a metà e il test sembra fallire per altro. Prima si sposta il grafico con un oggetto nuovo (`{...c, x, y}`: cambiarlo sul posto non ridisegna).
- **Un solo clic mancato fa fallire a cascata le prove dopo**: dopo un `FAIL` su `clic_giusto` guardare il primo e rilanciare con `-SenzaCompilare` prima di cercare un difetto nel programma (il puntatore può essere spostato da fuori).
- **Ctrl+Z dopo un menu del tasto destro**: il fuoco non è sulla griglia e il tasto non arriva. Prima di ogni Ctrl+Z un clic su una cella lontana (vedi `annulla` in `giro_26_subtotale.py`).
