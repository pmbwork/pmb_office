# pmb_docs: specifica del guscio (parte 1)

Scopo: la finestra di `pmb_docs` deve avere lo stesso aspetto e la stessa struttura dell'editor di Google Documenti, senza condivisione, commenti, AI ed estensioni. Questa specifica contiene le misure vere (in pixel CSS, scala 100%) e le voci dei menu. I compiti T020-T024 la realizzano un pezzo alla volta.

## Struttura dall'alto verso il basso (finestra larga 1600 px)
| Zona | y | altezza | Note |
|---|---|---|---|
| Intestazione: titolo del documento (x=54, corpo 18) e stella | 10 | 24 | titolo "Documento senza titolo" |
| Barra dei menu (x=54, corpo 14) | 26 | 33 | File, Modifica, Visualizza, Inserisci, Formato, Strumenti |
| Barra strumenti a pillola (x=16, larga finestra-32, corpo 13) | 65 | 40 | sfondo #F0F4F9 |
| Righello (x=16) | 113 | 16 | |
| Area dell'editor | 129 | resto | foglio A4 centrato: 794 x 1123 px, a y=145 |

Colori: sfondo app #F8FAFD; barra strumenti #F0F4F9; testo #1F1F1F; pannelli dei menu bianchi con ombra `0 2px 6px 2px rgba(0,0,0,0.15)`, raggio `0 4px 4px 4px`, voci alte 32 px; finestre di dialogo raggio 28 px.
Font: Roboto (e Inter come ripiego). Niente Google Sans.

## Menu (6) e voci (nostre)
Barra: File · Modifica · Visualizza · Inserisci · Formato · Strumenti. Un `*` dopo la voce = ha un sottomenu (freccia ►).
- **File**: Nuovo · Apri (Ctrl+O) · Scarica* (sottomenu: .docx, .txt, .pdoc, .odt, .pdf) · Rinomina · Cronologia versioni* · Dettagli · Lingua* · Impostazione pagina · Anteprima di stampa · Stampa (Ctrl+P)
- **Modifica**: Annulla (Ctrl+Z) · Ripeti (Ctrl+Y) · Taglia (Ctrl+X) · Copia (Ctrl+C) · Incolla (Ctrl+V) · Incolla senza formattazione (Ctrl+Maiusc+V) · Seleziona tutto (Ctrl+A) · Elimina · Trova e sostituisci (Ctrl+H)
- **Visualizza**: Modalità* · Mostra layout di stampa · Mostra righello · Mostra barra degli strumenti delle equazioni · Mostra caratteri non stampabili (Ctrl+Maiusc+P) · Schermo intero
- **Inserisci**: Immagine* · Tabella* · Componenti di base* · Link (Ctrl+K) · Disegno* · Grafico* · Simboli* · Equazione · Tab (Maiusc+F11) · Linea orizzontale · Interruzione* · Segnalibro · Elementi di pagina*
- **Formato**: Testo* · Stili paragrafo* · Allinea e applica rientro* · Interlinea e spaziatura paragrafo* · Colonne* · Elenchi puntati e numerati* · Intestazioni e piè di pagina · Numeri di pagina · Orientamento pagina · Passa al formato Senza pagine · Tabella* · Immagine* · Bordi e linee* · Cancella formattazione (Ctrl+\)
- **Strumenti**: Ortografia e grammatica* · Conteggio parole (Ctrl+Maiusc+C) · Numeri di riga · Dizionario (Ctrl+Maiusc+Y) · Preferenze · Accessibilità

NON ci devono essere: Condividi, Email, Commenti, Suggerimenti, Gemini, Estensioni, Guida, firma elettronica, smart chip, Drive.

## Barra strumenti (27 comandi che si comprimono + la modalità fissa a destra)
cerca · annulla · ripeti · stampa · ortografia · copia-formato · zoom · stile-paragrafo · carattere · riduci-corpo · corpo · aumenta-corpo · grassetto · corsivo · sottolineato · colore-testo · evidenzia · link · immagine · allineamento · interlinea · elenco-attivita · elenco-puntato · elenco-numerato · riduci-rientro · aumenta-rientro · cancella-formattazione  (la modalità, la matita "Modifica", è sempre visibile a destra)

Comportamento a finestra stretta: a 1600 px ci sono tutti i comandi; più la finestra si stringe, più comandi spariscono dalla fine e finiscono sotto il pulsante "⋮" (altri comandi). Punti misurati: a 800 px restano i primi 9 (fino a carattere); a 1000 px i primi 17 (fino a evidenzia); a 1200 px i primi 19 (fino a immagine); a 1600 px tutti i 27.
