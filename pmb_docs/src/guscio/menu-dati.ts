// elenco dei menu di pmb_docs. Regole precise: LAVORO/compiti/T021/compito.md.

import { LINGUE } from './preferenze';
import { COMPONENTI } from './componenti';
import { VOCI_BORDO } from './bordi-dati';
import { TIPI_GRAFICO } from './grafico';
import { FORMATI } from '../formati/file';
import { portatile, suMac } from '@comune/piattaforma';

export interface VoceMenu {
  etichetta: string;
  /** Scorciatoia da tastiera mostrata a destra, per esempio "Ctrl+O". */
  scorciatoia?: string;
  /** true se la voce apre un sottomenu (si mostra la freccia). */
  sottomenu?: boolean;
  /** Le voci del sottomenu, se ce l'ha: si aprono col clic o passando sopra con il mouse. */
  figli?: VoceMenu[];
  /** Il sottomenu c'è, ma le sue voci le dà il guscio al momento di aprirlo, perché dipendono dal punto del documento
   *  (lo stile del paragrafo, l'allineamento, la tabella in cui sta il cursore...): docs-menubar le chiede con `sottovoci`. */
  dinamico?: boolean;
  /** Se true la voce appare grigia e non è cliccabile */
  disabilitata?: boolean;
  /** Spiegazione mostrata all'utente come suggerimento */
  motivoDisabilitata?: string;
}

export interface MenuGuscio {
  /** identificativo in minuscolo senza spazi, per esempio "file" */
  id: string;
  etichetta: string;
  voci: VoceMenu[];
  /** true se il titolo non apre un pannello ma fa subito la sua azione (per esempio «Segnalazione bug») */
  diretto?: boolean;
}

export const MENU: MenuGuscio[] = [
  {
    id: 'file',
    etichetta: 'File',
    voci: [
      { etichetta: 'Nuovo' },
      { etichetta: 'Apri', scorciatoia: 'Ctrl+O' },
      { etichetta: 'Salva', scorciatoia: 'Ctrl+S' },
      { etichetta: 'Salva con nome', scorciatoia: 'Ctrl+Maiusc+S' },
      { etichetta: 'Scarica', sottomenu: true, figli: FORMATI.map((f) => ({ etichetta: f.etichetta })) },
      { etichetta: 'Rinomina' },
      { etichetta: 'Cronologia versioni' },
      { etichetta: 'Dettagli' },
      { etichetta: 'Password per aprire' },
      { etichetta: 'Correttore lingua', sottomenu: true, figli: LINGUE.map(([, nome]) => ({ etichetta: nome })) },
      { etichetta: 'Impostazione pagina' },
      { etichetta: 'Anteprima di stampa' },
      { etichetta: 'Stampa', scorciatoia: 'Ctrl+P' },
    ],
  },
  {
    id: 'modifica',
    etichetta: 'Modifica',
    voci: [
      { etichetta: 'Annulla', scorciatoia: 'Ctrl+Z' },
      { etichetta: 'Ripeti', scorciatoia: 'Ctrl+Y' },
      { etichetta: 'Taglia', scorciatoia: 'Ctrl+X' },
      { etichetta: 'Copia', scorciatoia: 'Ctrl+C' },
      { etichetta: 'Incolla', scorciatoia: 'Ctrl+V' },
      { etichetta: 'Incolla senza formattazione', scorciatoia: 'Ctrl+Maiusc+V' },
      { etichetta: 'Seleziona tutto', scorciatoia: 'Ctrl+A' },
      { etichetta: 'Elimina' },
      { etichetta: 'Trova e sostituisci', scorciatoia: 'Ctrl+H' },
    ],
  },
  {
    id: 'visualizza',
    etichetta: 'Visualizza',
    voci: [
      {
        etichetta: 'Modalità',
        sottomenu: true,
        figli: [
          { etichetta: 'Tema scuro' },
          { etichetta: 'Tema chiaro' },
          { etichetta: 'Tema di sistema' },
        ],
      },
      { etichetta: 'Mostra layout di stampa' },
      { etichetta: 'Mostra righello' },
      { etichetta: 'Mostra barra degli strumenti delle equazioni' },
      { etichetta: 'Mostra caratteri non stampabili', scorciatoia: 'Ctrl+Maiusc+P' },
      { etichetta: 'Mostra commenti e modifiche' },
      { etichetta: 'Mostra struttura del documento' },
      { etichetta: 'Schermo intero' },
      { etichetta: 'Nascondi i menu', scorciatoia: 'Ctrl+Maiusc+F' },
      { etichetta: 'Personalizza barra degli strumenti' },
    ],
  },
  {
    id: 'inserisci',
    etichetta: 'Inserisci',
    voci: [
      { etichetta: 'Immagine' },
      { etichetta: 'Codice QR' },
      { etichetta: 'Tabella' },
      { etichetta: 'Componenti di base', sottomenu: true, figli: COMPONENTI.map((c) => ({ etichetta: c.nome })) },
      { etichetta: 'Link', scorciatoia: 'Ctrl+K' },
      { etichetta: 'Commento', scorciatoia: 'Ctrl+Alt+M' },
      { etichetta: 'Disegno', sottomenu: true, figli: [{ etichetta: 'Nuovo' }] },
      { etichetta: 'Grafico', sottomenu: true, figli: TIPI_GRAFICO.map(([, nome]) => ({ etichetta: nome })) },
      { etichetta: 'Simboli' },
      { etichetta: 'Equazione' },
      { etichetta: 'Tab', scorciatoia: 'Maiusc+F11' },
      { etichetta: 'Linea orizzontale' },
      { etichetta: 'Data e ora', sottomenu: true, dinamico: true },
      { etichetta: 'Didascalia' },
      { etichetta: 'Riferimento incrociato' },
      {
        etichetta: 'Interruzione',
        sottomenu: true,
        figli: [
          { etichetta: 'Salto di pagina', scorciatoia: 'Ctrl+Invio' },
          { etichetta: 'Interruzione di colonna', scorciatoia: 'Ctrl+Maiusc+Invio' },
        ],
      },
      {
        etichetta: 'Caratteri speciali',
        sottomenu: true,
        figli: [
          { etichetta: 'Spazio non divisibile', scorciatoia: 'Ctrl+Maiusc+Spazio' },
          { etichetta: 'Trattino non divisibile', scorciatoia: 'Ctrl+Maiusc+-' },
          { etichetta: 'Trattino facoltativo', scorciatoia: 'Ctrl+-' },
        ],
      },
      { etichetta: 'Segnalibro' },
      { etichetta: 'Sommario' },
      { etichetta: 'Aggiorna sommario' },
      {
        etichetta: 'Elementi di pagina',
        sottomenu: true,
        figli: [
          { etichetta: 'Nota a piè di pagina', scorciatoia: 'Ctrl+Alt+F' },
        ],
      },
    ],
  },
  {
    id: 'formato',
    etichetta: 'Formato',
    voci: [
      {
        etichetta: 'Testo',
        sottomenu: true,
        figli: [
          { etichetta: 'Grassetto', scorciatoia: 'Ctrl+B' },
          { etichetta: 'Corsivo', scorciatoia: 'Ctrl+I' },
          { etichetta: 'Sottolineato', scorciatoia: 'Ctrl+U' },
          { etichetta: 'Barrato', scorciatoia: 'Alt+Maiusc+5' },
          { etichetta: 'Apice', scorciatoia: 'Ctrl+.' },
          { etichetta: 'Pedice', scorciatoia: 'Ctrl+,' },
          { etichetta: 'Sottolineato doppio', scorciatoia: 'Ctrl+Maiusc+D' },
          { etichetta: 'Maiuscoletto', scorciatoia: 'Ctrl+Maiusc+K' },
          { etichetta: 'MAIUSCOLO' },
          { etichetta: 'minuscolo' },
          { etichetta: 'Iniziali Maiuscole' },
          { etichetta: 'Frase' },
          { etichetta: 'iNVERTI' },
          { etichetta: 'Cambia (giro)', scorciatoia: 'Maiusc+F3' },
        ],
      },
      { etichetta: 'Stili paragrafo', sottomenu: true, dinamico: true },
      { etichetta: 'Allinea e applica rientro', sottomenu: true, dinamico: true },
      { etichetta: 'Interlinea e spaziatura paragrafo', sottomenu: true, dinamico: true },
      { etichetta: 'Colonne', sottomenu: true, figli: [{ etichetta: '1 colonna' }, { etichetta: '2 colonne' }, { etichetta: '3 colonne' }] },
      { etichetta: 'Elenchi puntati e numerati', sottomenu: true, dinamico: true },
      { etichetta: 'Intestazioni e piè di pagina' },
      { etichetta: 'Filigrana' },
      { etichetta: 'Numeri di pagina' },
      { etichetta: 'Orientamento pagina' },
      { etichetta: 'Passa al formato Senza pagine' },
      { etichetta: 'Tabella', sottomenu: true, dinamico: true },
      { etichetta: 'Immagine', sottomenu: true, dinamico: true },
      { etichetta: 'Bordi e linee', sottomenu: true, figli: VOCI_BORDO.map((v) => ({ etichetta: v.etichetta })) },
      { etichetta: 'Cancella formattazione', scorciatoia: 'Ctrl+' + '\\' },
    ],
  },
  {
    id: 'strumenti',
    etichetta: 'Strumenti',
    voci: [
      { etichetta: 'Ortografia e grammatica', sottomenu: true, figli: [{ etichetta: 'Controlla ortografia', scorciatoia: 'F7' }, { etichetta: 'Sottolinea gli errori mentre scrivi' }] },
      { etichetta: 'Conteggio parole', scorciatoia: 'Ctrl+Maiusc+C' },
      {
        etichetta: 'Revisioni',
        sottomenu: true,
        figli: [
          { etichetta: 'Registra modifiche' },
          { etichetta: 'Accetta modifica' },
          { etichetta: 'Rifiuta modifica' },
          { etichetta: 'Accetta tutte le modifiche' },
          { etichetta: 'Rifiuta tutte le modifiche' },
          { etichetta: 'Modifica successiva' },
          { etichetta: 'Modifica precedente' },
          { etichetta: 'Commenti e modifiche' },
        ],
      },
      { etichetta: 'Numeri di riga' },
      { etichetta: 'Proteggi documento' },
      { etichetta: 'Leggi ad alta voce', scorciatoia: 'Ctrl+Alt+Spazio' },
      { etichetta: 'Controlla accessibilità' },
      { etichetta: 'Stampa unione' },
      { etichetta: 'Dizionario', scorciatoia: 'Ctrl+Maiusc+Y' },
      { etichetta: 'Correzione automatica' },
      { etichetta: 'Caratteri personali' },
      { etichetta: 'Preferenze' },
      { etichetta: 'Accessibilità' },
    ],
  },
  {
    id: 'informazioni',
    etichetta: 'Informazioni',
    voci: [
      { etichetta: 'Informazioni su pmb_docs' },
      { etichetta: "Condizioni d'uso" },
      { etichetta: 'Licenze di terze parti' },
      // il pacchetto di aggiornamento contiene un installatore per Windows: sul Mac si scarica la versione nuova e la si mette in Applicazioni
      // e sul device portatile (AI_PRO) non si installa niente nel PC ospite: si sostituisce la cartella del programma
      ...(suMac() || portatile() ? [] : [{ etichetta: 'Installa un aggiornamento' }]),
      { etichetta: 'Segnala un bug o invia un feedback' },
    ],
  },
  // un clic apre subito la finestra per segnalare un bug o mandare un feedback (la stessa di Informazioni › Segnala un bug)
  { id: 'segnalazione', etichetta: 'Segnalazione bug', voci: [], diretto: true },
];
