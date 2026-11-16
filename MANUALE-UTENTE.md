# MANUALE UTENTE — pmb_office Suite

Benvenuto in **pmb_office**, la suite per ufficio desktop locale, veloce e rispettosa della privacy per Windows (10/11 a 64 bit).

---

## 1. Applicazioni della Suite

- **pmb_sheets (`pmb_sheets`)**:
  - Foglio di calcolo con 275+ funzioni matematiche, statistiche, finanziarie, database e logiche.
  - Formule matriciali dinamiche con `ARRAYFORMULA` (alias italiano `FORMULA.MATRICIALE`) e spill dinamico `#SPILL!`.
  - Tabelle pivot, grafici SVG nativi, formattazione condizionale, filtri e ordinamenti avanzati.
  - Formati supportati: **Microsoft Excel (.xlsx)**, **OpenDocument (.ods)**, **CSV (.csv)**, **PDF vettoriale (.pdf)**, **pmb_sheets (.psheet)**.

- **pmb_docs (`pmb_docs`)** (aggiornato il 2026-11-04):
  - Elaboratore di testi con foglio A4 (anche Letter, A3, A5; verticale e orizzontale), righello orizzontale e verticale in centimetri con indicatori dei margini trascinabili, stili di paragrafo, elenchi, rientri, interlinea, colonne (1-3).
  - Tabelle con bordi e colori, immagini incorporate, link, note a piè di pagina, intestazioni e piè di pagina con numero di pagina, salto di pagina, linea orizzontale, simboli.
  - Trova e sostituisci (anche con espressioni regolari), conteggio parole (Strumenti), cronologia versioni locale, modalità senza pagine, schermo intero, tema chiaro/scuro, zoom 50-200%.
  - Salvataggio: **Salva** (Ctrl+S) riscrive il file aperto o scelto; **Salva con nome** (Ctrl+Maiusc+S) chiede dove. Formati: documento (.docx, si apre anche in Word), OpenDocument (.odt), testo (.txt), pmb_docs (.pdoc), PDF (.pdf, solo scrittura). Si aprono .docx, .odt, .txt, .md, .pdoc. Il PDF si può avere anche da Stampa › Salva come PDF.
  - **Primo salvataggio dopo "Apri":** il browser integrato non permette di scrivere su un file solo aperto. La prima volta che premi Ctrl+S su un documento aperto compare "Salva con nome" già posizionato sullo stesso file e cartella: conferma e sovrascrivi. Da quel momento Ctrl+S salva in silenzio. Le finestre di scelta file hanno il titolo in inglese (lo decide Windows/WebView2).
  - **Documenti molto lunghi:** fino a circa 300 righe (6 pagine) la scrittura è istantanea; a 1000 righe (circa 19 pagine) ogni tasto impiega circa 0,2 secondi, a 3000 righe circa mezzo secondo o più.
  - **Elenco di attività**: pulsante nella barra (visibile da 1400 px di larghezza) o menu Formato › Elenchi › Elenco di attività. Un clic sulla casella ☐ spunta la voce (☑, testo barrato e grigio), un secondo clic toglie la spunta; Ctrl+Z la annulla. A capo su una voce spuntata crea una voce nuova non spuntata; a capo su una voce vuota esce dall'elenco. Si salva in .pdoc e in .docx (caselle ☐/☑ come simboli dell'elenco); in .odt, .txt e PDF diventa un normale elenco di paragrafi.
  - **Spazio prima e dopo il paragrafo**: nel menu Interlinea (pulsante nella barra o Formato › Interlinea e spaziatura paragrafo), sotto le interlinee, le voci "Aggiungi spazio prima/dopo il paragrafo (10 pt)" e "Togli lo spazio...". Si salva in .pdoc, .docx (w:before/w:after) e .odt (margini); nel PDF lo spazio dopo sposta il paragrafo seguente. Aprendo un .docx di Word si leggono lo spazio e l'interlinea dello stile (per esempio i 6-8 pt dopo e l'interlinea 1,08 dello stile Normale) e la spaziatura contestuale degli elenchi; nei titoli restano i margini propri di pmb_docs. Da 0 a 200 pt; due paragrafi vicini si distanziano del valore maggiore tra "dopo" del primo e "prima" del secondo (non la somma, come invece fa Word).
  - **Note di Word**: aprendo un .docx con note a piè di pagina o di chiusura, pmb_docs mette un numero in apice nel testo e le note in fondo al documento ("1. testo"), come le note che inserisce lui; salvando di nuovo in .docx restano come testo normale.
  - **Correttore ortografico**: usa il correttore di Windows (nessun dizionario è incluso nel programma), quindi funziona offline e nelle lingue installate in Windows. Gli errori si sottolineano in rosso mentre scrivi (Strumenti › Ortografia e grammatica › Sottolinea gli errori mentre scrivi, o Preferenze). Strumenti › Ortografia e grammatica › Controlla ortografia, il pulsante della barra o F7 aprono la finestra: parola sbagliata col contesto, suggerimenti di Windows, Cambia, Cambia tutto, Ignora, Ignora tutto, Aggiungi al dizionario. Cambia e Cambia tutto sono un solo passo di annulla. Solo ortografia, non grammatica. Nel browser (fuori dall'app) il controllo non c'è e lo dice.
  - **Dizionario personale** (Strumenti › Dizionario, Ctrl+Maiusc+Y): parole che il correttore non segnala; si aggiungono e si tolgono qui o dalla finestra del controllo. Salvato sul computer.
  - **Lingua** (File › Lingua) e **Preferenze** (Strumenti › Preferenze): lingua del correttore (solo quelle che Windows ha), tema chiaro/scuro, sottolineatura degli errori. Le scelte si ricordano al riavvio.
  - **Accessibilità** (Strumenti › Accessibilità): alto contrasto (bordi e focus ben marcati, foglio con bordo nero), cursore grande, meno animazioni (il cursore non lampeggia).
  - **Bordi e linee** (Formato › Bordi e linee): bordo attorno al paragrafo con spessore (da 0,5 a 4,5 pt), linea continua, tratteggiata o puntinata e cinque colori; si salva in .pdoc, .docx (w:pBdr), .odt e PDF. Un solo bordo sotto il paragrafo, da Word, resta la linea orizzontale.
  - **Componenti di base** (Inserisci › Componenti di base): appunti di riunione, bozza di email, elenco di controllo, pianificazione settimanale, tabella delle attività, data di oggi. Un solo passo di annulla; non si inseriscono con il cursore dentro una tabella.
  - **Equazione** (Inserisci › Equazione): si scrive con la notazione tipo LaTeX (rac{a}{b}, \sqrt{x}, x^{2}, x_{i}, \sum, \int, lettere greche, ±, ≤, ≠...) con barra di modelli e simboli (Visualizza › Mostra barra degli strumenti delle equazioni la nasconde) e anteprima. Entra nel documento come immagine: per cambiarla se ne inserisce una nuova.
  - **Grafico** (Inserisci › Grafico: a colonne, a barre, a linee, a torta): dati come righe "Etichetta; valore; valore" (la prima riga può dare i nomi delle serie), titolo e anteprima. Entra nel documento come immagine.
  - **Disegno** (Inserisci › Disegno › Nuovo): tavola con penna, linea, freccia, rettangolo, ellisse, gomma, colori, spessore, pieno, Annulla e Cancella tutto; entra nel documento come immagine.
  - **Tab, le schede del documento** (Inserisci › Tab, Maiusc+F11): più testi nello stesso documento, con un elenco a sinistra (compare dalla seconda scheda): clic per passare, doppio clic o ✎ per rinominare, ✕ per eliminare (con conferma), + per aggiungere (fino a 20). Ogni scheda ha la sua storia di annulla. In .pdoc le schede restano separate; in .docx, .odt, PDF e .txt si salvano una dopo l'altra, ognuna con il titolo (Titolo 1) e su un foglio nuovo; la copia di emergenza tiene tutto il testo. Si stampa la scheda aperta.
  - **Modifiche non salvate**: Nuovo e Apri (menu e Ctrl+O) chiedono conferma se nel documento c'è qualcosa che nessun file contiene (sono scritti da una versione che il salvataggio non ha ancora visto). Se rispondi No resta tutto com'è; dopo aver salvato (o appena aperto) non chiedono niente. La copia di emergenza si cancella solo se, mentre salvavi, non hai scritto altro.
  - **Privacy**: la copia di emergenza (il testo del documento aperto, salvato ogni pochi secondi nell'archivio locale del programma) e le preferenze (compreso il dizionario personale) stanno sul computer in chiaro, nel profilo di WebView2 dell'utente di Windows; sparisce con Nuovo, Apri o un salvataggio riuscito.
  - **Segnalibri**: menu Inserisci › Segnalibro. Scrivi un nome (al massimo 60 caratteri) e premi Aggiungi (o Invio): il segnalibro si lega al paragrafo dove sta il cursore, che mostra una barra azzurra a sinistra. Un paragrafo ha un solo segnalibro; riusando un nome lo si sposta. La finestra elenca i segnalibri con un'anteprima: Vai porta il cursore all'inizio del paragrafo, Togli lo elimina (Ctrl+Z lo rimette). Si salvano in .pdoc e in .docx (in .docx il nome diventa quello ammesso da Word: lettere, cifre e trattino basso, al massimo 40 caratteri, e se non comincia con una lettera si antepone S_); in .odt, .txt e PDF non ci sono.
  - **Numeri di riga**: menu Strumenti › Numeri di riga (si accendono e si spengono). Un numero per ogni riga del testo, nel margine sinistro, continuo per tutto il documento; le righe delle tabelle non si contano. Solo a schermo: non si stampano e non si salvano.
  - **Copia formato** (pennello nella barra): metti il cursore o seleziona il testo di cui vuoi il formato, clic sul pennello, poi seleziona con il mouse il testo di destinazione: ci si applicano grassetto, corsivo, sottolineato, barrato, apice/pedice, carattere, corpo, colori, evidenziazione e allineamento, interlinea e stile del paragrafo (non il link). Un solo passo di annulla. Esc o un secondo clic sul pennello annullano.
  - **Non disponibili** (voci grigie nei menu, o avviso al clic): controllo ortografico, bordi e linee, equazioni, disegni, grafici, segnalibri, lingua, preferenze, accessibilità, numeri di riga, dizionario. Non esistono RTF, commenti e modalità Suggerimenti.

---

## 2. Esecuzione Desktop Standalone (.exe)

Gli eseguibili nativi compilati sono disponibili in:
1. **pmb_sheets**: `pmb_sheets/src-tauri/target/release/free-office-shell.exe`
2. **pmb_docs**: `pmb_docs/src-tauri/target/release/pmb-docs-shell.exe`

Per avviare in modalità sviluppo o da browser:
- `cd pmb_sheets && npm run dev` (porta locale 1420)
- `cd pmb_docs && npm run dev` (porta locale 1421)

---

## 3. Principali Scorciatoie da Tastiera

| Azione | Scorciatoia |
|---|---|
| **Salva** | `Ctrl + S` |
| **Salva con nome** | `Ctrl + Maiusc + S` |
| **Apri file** | `Ctrl + O` |
| **Stampa / Salva come PDF** | `Ctrl + P` |
| **Nuovo documento** | `Ctrl + N` |
| **Annulla / Ripeti** | `Ctrl + Z` / `Ctrl + Y` |
| **Trova e sostituisci** | `Ctrl + H` (solo Trova: `Ctrl + F`) |
| **Inserisci Link** | `Ctrl + K` |
| **Grassetto / Corsivo / Sottolineato** | `Ctrl + B` / `Ctrl + I` / `Ctrl + U` |
| **Barrato** | `Alt + Maiusc + 5` |
| **Apice / Pedice** | `Ctrl + .` / `Ctrl + ,` |
| **Salto di pagina** | `Ctrl + Invio` |
| **Conteggio parole** | `Ctrl + Maiusc + C` |
| **Zoom del documento** | `Ctrl + rotella`, oppure `Ctrl + =` / `Ctrl + -`; `Ctrl + 0` torna al 100% |
| **Nota a piè di pagina** | `Ctrl + Alt + F` |
| **Mostra caratteri non stampabili** | `Ctrl + Maiusc + P` |
| **Schermo intero** | `F11` (uscita con `Escape`) |

---

## 4. Protezione e Salvataggio Automatico
- **Ripristino di emergenza (Crash Recovery)**: Se l'applicazione viene chiusa accidentalmente o si verifica un'interruzione di corrente, alla riapertura comparirà una barra in alto con il titolo e l'ora dell'ultima copia, consentendo di ripristinare il lavoro con un solo clic.
- **Sicurezza Crittografica**: La suite include il modulo `@comune/sicurezza/cifratura` basato su AES-256-GCM con PBKDF2 a 100.000 iterazioni per la cifratura protetta da password.

---

## 5. Menu «Informazioni» (condizioni d'uso e licenze)

L'ultima voce del menu in alto, in **pmb_docs** e in **pmb_sheets**, si chiama **Informazioni** e ha tre voci:

- **Informazioni su pmb_docs / pmb_sheets**: che cos'è il programma, versione, nome e logo PMB.
- **Condizioni d'uso**: software gratuito, offerto senza scopo di lucro; non si può vendere, noleggiare o includere in prodotti a pagamento senza il consenso scritto di PMB; si può condividere gratuitamente, integro; le donazioni a PMB sono volontarie e non danno diritti; nessuna garanzia; marchi di terzi (Windows, Microsoft, Word, Excel, Google) citati solo per compatibilità; privacy (tutto resta sul computer).
- **Licenze di terze parti**: tabella con tutti i 253 componenti usati (nome, versione, licenza, titolare del copyright, tipo) con ricerca, e i testi completi delle licenze (MIT, Apache-2.0, BSD-3-Clause, MPL-2.0, OFL-1.1, ecc.).

Si chiude con **Chiudi** o con **Esc**. I testi sono informativi e non sostituiscono una consulenza legale.

## 6. Nomi e file

- La suite si chiama **pmb_office**: **pmb_docs** (documenti) e **pmb_sheets** (fogli). Logo PMB bianco su sfondo blu (docs) o verde (sheets).
- Nuovi formati: documenti **.pdoc**, fogli **.psheet**. I vecchi **.fdoc** e **.fsheet** si aprono ancora.
- Le preferenze e i dati locali del vecchio nome si riportano da soli al primo avvio (`free_docs.*` → `pmb_docs.*`, `free_sheets.*` → `pmb_sheets.*`).

## 7. Segnalare un bug o inviare un feedback

Menu **Informazioni › Segnala un bug o invia un feedback** (pmb_docs e pmb_sheets): si apre una finestra in cui si scrive il messaggio (da 10 a 4000 caratteri), si può indicare un'email per ricevere risposta (facoltativa) e lasciare o togliere la spunta «Includi nome e versione del programma e il sistema». Premendo **Invia** il messaggio parte via Internet verso un piccolo servizio di Google Apps Script gestito da PMB, che lo inoltra per email a `foraicreator@gmail.com`. Non parte nulla prima del clic su Invia e non c'è mai il contenuto dei documenti.

- Se non c'è Internet o il servizio non risponde, la finestra resta aperta con il testo intatto, spiega il motivo e offre **Apri la posta**: apre il programma di posta con il messaggio già compilato (se la posta non si apre il programma mostra l'indirizzo).
- Il servizio è `comune/apps-script/segnalazioni.gs`, pubblicato dall'account `foraicreator@gmail.com` come applicazione web (esegue come lui, accesso «Chiunque», permesso «Inviare email come»). Limiti: 4000 caratteri, 30 messaggi all'ora in tutto, nessun doppione negli ultimi 10 minuti, campo trappola contro i robot. Indirizzo del servizio e note nel vault (`credenziali_vault.md`) e nella costante `URL_SERVIZIO_SEGNALAZIONI` di `comune/src/informazioni/segnalazioni.ts`; l'indirizzo email destinatario è `EMAIL_SEGNALAZIONI` nello stesso file (in realtà il destinatario lo decide l'account che ha pubblicato il servizio).
- Per aggiornare il servizio: modificare il codice nell'editor di Apps Script, poi «Esegui il deployment › Gestisci deployment › matita › Nuova versione» (l'indirizzo resta lo stesso). Per togliere il permesso: myaccount.google.com › Sicurezza › Collegamenti con app di terze parti.
- Le app possono collegarsi solo a `script.google.com` e `script.googleusercontent.com` (CSP `connect-src` in `tauri.conf.json`).

## 8. Installazione e «Apri con»

- **Installer di pmb_docs (un solo file, italiano e inglese)**: `pmb_docs\src-tauri	argeteleaseundle
sis\pmb_docs_0.1.0_x64-setup.exe`. Al primo avvio chiede la lingua (Italiano o English, già scelta quella di Windows) e la ricorda; installa per tutti gli utenti (serve l'amministratore) in `C:\Program Files\pmb_office\pmb_docs`, crea i collegamenti, registra pmb_docs in «Apri con» per `.docx .odt .txt .md` senza cambiare i programmi predefiniti, associa `.pdoc` e `.fdoc`, riconosce e aggiorna una vecchia installazione. Installazione silenziosa in un percorso scelto: `pmb_docs_0.1.0_x64-setup.exe /S /D=C:\percorso\pmb_docs` (`/D` va per ultimo, senza virgolette). Disinstallazione: Impostazioni › App, oppure `uninstall.exe` nella cartella del programma; toglie anche le voci «Apri con», le associazioni e la cartella `pmb_office` se rimasta vuota. File di configurazione: `pmb_docs/src-tauri/nsis/installer.nsi` (modello di Tauri con la sola cartella `pmb_office` cambiata) e `nsis/hooks.nsh`; lingue in `tauri.conf.json` (`bundle.windows.nsis.languages`).
- **Pacchetti .msi di pmb_docs** (alternativa per installazioni aziendali, un file per lingua): `pmb_docs_0.1.0_x64_it-IT.msi` e `pmb_docs_0.1.0_x64_en-US.msi` con `npx tauri build --bundles msi`; stessi testi propri in `wix/it-IT.wxl` e `wix/en-US.wxl`.
- **Altri computer**: i file `.msi` installano con le regole normali di Windows (installazione per tutti gli utenti, richiede l'amministratore, voce in Impostazioni › App, collegamento nel menu Start), nella cartella `C:\Program Files\pmb_office\pmb_docs` e `C:\Program Files\pmb_office\pmb_sheets`: le due app stanno insieme sotto la cartella `pmb_office`. I file `.msi` sono in `pmb_docs\src-tauri	arget
eleaseundle\msi\` e `pmb_sheets\src-tauri	arget
eleaseundle\msi\`.
- **Questo computer** (regola del vault: i programmi installati da noi stanno sotto `C:\AI_system`): `C:\AI_system\pmb_office\pmb_docs\pmb-docs-shell.exe` e `C:\AI_system\pmb_office\pmb_sheets\pmb-sheets-shell.exe`, installati con lo script `install-pmb-office.ps1` (stessi `.msi`, con `INSTALLDIR` indicato).
- pmb_docs compare nell'elenco **Apri con** (tasto destro sul file) per `.docx`, `.odt`, `.txt`, `.md`, `.pdoc`, `.fdoc`, senza diventare il programma predefinito (Word, WPS e Blocco note restano come prima). Solo `.pdoc` e `.fdoc`, formati propri, hanno pmb_docs come predefinito.
- Un file aperto così si carica all'avvio; per salvarlo si usa Salva con nome (il programma non riceve dal sistema il permesso di riscriverlo).

## 9. Caratteri

- Il menu a tendina del carattere scrive ogni nome con il proprio carattere e li divide in sezioni: **Personali** (quelli che importi), **Windows** (Arial, Courier New, Georgia, Times New Roman, Trebuchet MS, Verdana, più Calibri, Cambria, Consolas, Segoe UI e altri di Windows/Office, solo se installati sul computer) e quelli **inclusi nel programma** (34 famiglie con licenza libera: Open Sans, Lato, Montserrat, Poppins, Merriweather, Playfair Display, Lora, Inconsolata, Source Code Pro, Pacifico, Dancing Script…, divise in Sans serif, Serif, Monospazio e Decorativo). Le licenze sono in Informazioni › Licenze di terze parti.
- **Caratteri personali** (voce in fondo alla tendina, oppure Strumenti › Caratteri personali): si importano uno o più file `.ttf`, `.otf`, `.woff`, `.woff2` (fino a 10 MB l'uno, 60 file in tutto). Il nome, il peso (normale, grassetto…) e il corsivo si leggono dal file; più file con lo stesso nome (Regular, Bold, Italic) formano una sola famiglia. I caratteri restano salvati sul computer, compaiono in «Personali» e si tolgono da «Rimuovi». Non si importa un carattere con il nome di uno già esistente.
- **Limiti da sapere**: il programma non controlla la licenza del carattere importato (lo si importa solo se si ha il diritto di usarlo); un documento mostra un carattere personale solo dove quel carattere è installato o importato; i file `.docx` e `.odt` ne scrivono il nome ma non lo includono; il PDF che si scarica usa sempre il carattere standard (Helvetica), mentre la stampa e «Stampa › Salva come PDF» usano i caratteri scelti.
- Come si aggiungono altri caratteri inclusi: elenco in `scripts/genera-caratteri.mjs`, `npm install @fontsource/<nome>`, `node scripts/genera-caratteri.mjs`, poi rigenerare le licenze (`comune/scripts/genera-licenze.mjs`).

## 10. Aggiornare il programma senza reinstallarlo

**Per chi usa il programma**: Informazioni › **Installa un aggiornamento**, si sceglie il file `.pmbup` ricevuto, si leggono versione e novità, si preme **Installa e riavvia**. Windows chiede il permesso di amministratore, il programma si chiude, si aggiorna e si riapre da solo. Documenti salvati, preferenze, caratteri personali e dizionario non si toccano; un documento non salvato viene proposto per il ripristino al riavvio. Il programma installa solo file firmati da PMB e solo versioni più nuove di quella installata.

**Per chi prepara l'aggiornamento** (dalla cartella `pmb_docs`):
1. fare le modifiche e controllare i test (`npx vitest run`);
2. `node scripts/cambia-versione.mjs 0.2.0` (scrive la versione in `tauri.conf.json`, `Cargo.toml`, `package.json` e `docs-informazioni.ts`);
3. `npm run build`, poi `npx tauri build --bundles nsis`;
4. `node scripts/crea-aggiornamento.mjs --note "che cosa cambia"`: scrive in `RILASCI\pmb_docs\<versione>\` l'**installer completo** (per chi non ha ancora il programma) e il file **`.pmbup`** firmato (per chi ce l'ha già). Il `.pmbup` pesa quanto l'installer: contiene la versione intera, non una differenza.
- La **chiave privata di firma** sta nel vault delle credenziali (voce «pmb_docs — firma degli aggiornamenti»); la chiave pubblica è dentro il programma (`src-tauri/src/chiave_pubblica.rs`). Non si rigenera: se la chiave pubblica cambiasse, i programmi già installati non riconoscerebbero più gli aggiornamenti. Lo script rifiuta di firmare se le due chiavi non corrispondono.
- Le versioni già rilasciate restano in `RILASCI\pmb_docs\<versione>\`. Prima versione: **0.1.0**.
- Chi ha una versione installata prima dell'arrivo di questa funzione (nessuna, per ora) dovrebbe reinstallare una volta dall'installer completo.

## 11. Lingua del programma (dalla versione 0.2.0)
- Il programma è in **italiano e inglese**. In **Strumenti › Preferenze › Lingua del programma** si sceglie *Automatica (come Windows)*, *Italiano* o *English*: il cambio è immediato, senza riavviare, e la scelta viene ricordata.
- Cambia tutto ciò che è del programma (menu, finestre, avvisi, Informazioni, condizioni d'uso, modelli di «Componenti di base», formato delle date). **Non cambia** il testo dei documenti né i nomi scelti dall'utente.
- Il correttore ortografico ha una lingua propria, scelta nella stessa finestra.
- Chi ha la 0.1.0 passa alla 0.2.0 con **Informazioni › Installa un aggiornamento** e il file `pmb_docs-aggiornamento-0.2.0.pmbup`.
- I menu in alto (File, Modifica, …) si aprono **passandoci sopra con il mouse**; si chiudono allontanandosi.
- Per chi sviluppa: ogni testo nuovo va scritto in italiano e tradotto in `src/i18n/en*.ts`; i test T463 (copertura) e T464 (schermata in inglese senza italiano) lo verificano.

## 12. Barra degli strumenti personalizzabile (dalla versione 0.3)
- **Pulsante «Funzioni»** (il pezzo di puzzle in fondo a destra, come le estensioni di Firefox): elenca tutte le funzioni del programma, sia quelle della barra sia ogni voce dei menu. Un clic sul nome la esegue subito; la **puntina** la mette o la toglie dalla barra. In alto si può cercare per nome.
- **Personalizza barra degli strumenti…** (in fondo al pannello Funzioni, nel menu Visualizza o col tasto destro sulla barra): in alto c'è la barra com'è, sotto tutte le funzioni. Si trascina una funzione nella barra per aggiungerla, dentro la barra per spostarla, fuori per toglierla; in alternativa ci sono i pulsanti ◀ ▶ ✕ e «Aggiungi». «Aggiungi separatore» mette una lineetta tra i gruppi, «Ripristina predefinita» rimette la barra di partenza. Le modifiche si vedono subito e restano dopo la chiusura.
- **Tasto destro su un pulsante:** «Togli dalla barra» o «Personalizza barra degli strumenti…».
- Le voci dei menu messe nella barra compaiono come pulsanti con il loro nome (per esempio «Tabella», «Conteggio parole»). Se la finestra è stretta, quelle che non ci stanno finiscono sotto «⋮».
- **Freccia ^ in fondo a destra** (o Ctrl+Maiusc+F, o Visualizza › Nascondi i menu): nasconde titolo e menu e lascia più spazio al testo; la freccia verso il basso li rimostra.
- Il pulsante «Modifica» di prima e l'icona grigia «aggiungi commento» sono stati tolti: erano solo disegnati (il programma ha soltanto la modalità di modifica e non ha i commenti).
- Nei menu, le voci accese hanno la spunta ✓ (layout di stampa, righello, caratteri non stampabili, numeri di riga, tema, colonne, lingua del correttore…). «Mostra layout di stampa» ora accende e spegne davvero le pagine; nascondere il righello toglie anche la sua striscia.
- Dalla 0.3.2 la barra predefinita ha anche il pulsante **Barrato**, subito dopo Sottolineato (stessa funzione di Formato › Testo › Barrato e di Alt+Maiusc+5): si accende quando il testo selezionato è barrato e un secondo clic toglie il barrato. La stella ☆ accanto al nome è stata tolta: non faceva niente.

## 13. Intestazione (dalla versione 0.3.5)
- In alto a sinistra c'è il **logo di pmb_docs**, grande abbastanza da leggere «Sistema professionale di videoscrittura». Alla sua destra il **nome del documento** con lo **stato del salvataggio**; **sotto il logo** i menu (dalla versione 0.3.9).
- Con la finestra bassa (per esempio su un portatile, fino a 740 punti di altezza) il logo si rimpicciolisce da solo e il foglio sale, per lasciare più spazio al documento (dalla versione 0.4.1). Per avere ancora più spazio: Visualizza › Nascondi i menu (Ctrl+Maiusc+F).
- L'ultimo menu, dopo Informazioni, è **Segnalazione bug**, evidenziato in azzurro (dalla versione 0.4.2): un clic apre subito la finestra per segnalare un problema o mandare un suggerimento (la stessa di Informazioni › Segnala un bug o invia un feedback).
- Un clic sul nome (o File › Rinomina) lo rende modificabile: Invio o un clic fuori conferma, Esc annulla, un nome vuoto non si accetta. Il nome è quello che il programma propone quando salvi il file.
- Lo stato dice «✓ Salvato in locale» quando non c'è niente da salvare e «● Modifiche non salvate» quando hai scritto o rinominato qualcosa che non è ancora in un file; dopo File › Salva torna «Salvato in locale».
