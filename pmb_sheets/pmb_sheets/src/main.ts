import { css } from "lit";
import { html } from "./i18n/html";
import { LinguaElement } from "./i18n/lingua-element";
import { suMac, tastoPrimario } from "@comune/piattaforma";
import { installaFinestraFilePortatile } from "@comune/file-portatile";
import { installaFinestreNative, manigliaNativa } from "@comune/file-nativi";
import { customElement, state } from "lit/decorators.js";

// Import CSS
import "./assets/fonts/fonts.css";
import "./theme/tokens.css";
import "./theme/light.css";
import "./theme/dark.css";

// Import Components
import "./components/titlebar";
import "./components/menubar";
import "./components/toolbar";
import "./components/tabs";
import "./components/sidebar";
import "./components/statusbar";
import "./components/sheet-grid";
import "./components/menu-search";
import "./components/dialogo-regole";
import "./components/dialogo-preferenze";
import "./components/dialogo-personalizza-barra";
import "./components/dialogo-viste-filtro";
import "./components/dialogo-nomi";
import "./components/dialogo-duplicati";
import "./components/dialogo-testo-colonne";
import "./components/dialogo-imposta-pagina";
import type { ImpostaPagina } from "./sheet/pagina";
import { dividiRighe, type OpzioniDivisione } from "./sheet/testo-in-colonne";
import type { AreaFiltro } from "./sheet/filter";
import "./components/dialogo-conferma";
import type { SceltaConferma } from "./components/dialogo-conferma";
import "./components/dialogo-commento";
import "./components/dialogo-link";
import "./components/dialogo-protezione";
import "./components/dialogo-obiettivo";
import "./components/dialogo-subtotali";
import "./components/dialogo-qr";
import "./components/dialogo-password-file";
import "./components/dialogo-serie";
import { stileCella } from "./sheet/stili-cella";
import { PasswordRichiesta } from "@comune/protezione/password-file";
import "./components/dialogo-valuta";
import { ferma as fermaLettura, leggi as leggiAdAltaVoce, staLeggendo } from "@comune/voce";
import type { ModoProtezione } from "./components/dialogo-protezione";
import "./components/dialogo-formato";
import { urlAmmesso } from "./sheet/link";
import { LIMITE_BYTE_IMMAGINE, dataUrlDaByte, rilevaTipoImmagine } from "./sheet/immagini";
import { elencaCommenti } from "./sheet/commenti";
import type { NamedRange } from "./sheet/named-ranges";
import "./components/dialogo-informazioni";
import "./components/dialogo-segnala";
import { VERSIONE_APP } from "./components/dialogo-informazioni";
import { avvisoSegnalazione, urlSegnalazione } from "@comune/informazioni/segnalazioni";
import type { PaginaInformazioni } from "@comune/informazioni/condizioni";

import { DocumentTab } from "./components/tabs";
import { defaultDocumentStore, CellStyle } from "./sheet/index";
import { ESTENSIONI_APRI, type FormatoId } from "./formati/file";
import { apriInScheda, preparaSalvataggio } from "./formati/documento";
import { salvaSuDisco, scegliFile, type ManiglioFile } from "./formati/file-io";
import { impostaLocaleNumeri } from "./sheet/locale-numeri";
import { impostaLinguaNomi } from "./engine/format-testo";
import { applicaDati, estraiDati } from "./formati/documento";
import { deserializeSheetDocumentData, serializeSheetDocumentData } from "./sheet/document-data";
import { DocumentStore } from "./sheet/document-store";
import type { CellValue } from "./engine/values";
import { styleMap } from "./utils/style-map";
import { indirizzoCella, scambioDaDocumento } from "./formati/scambio";
import { stileEffettivo, type ValoreStampa } from "./formati/stampa";
import { pianoDiStampa, lettereColonne, type PianoStampa, type PaginaPiano } from "./formati/piano-stampa";
import { ALTEZZA_LETTERE_COLONNA, LARGHEZZA_NUMERI_RIGA } from "./sheet/pagina";
import { formatCellValue } from "./sheet/number-format";
import { formatDisplayValue } from "./sheet/format-display";
import { scriviIntervallo } from "./sheet/regole-dialogo";
import "./theme/stampa.css";
import { INTERVALLO_CONTROLLO, Recupero, archivioDa, type Recuperato, type SchedaViva } from "./formati/recupero";
import { migraChiavi } from "./formati/migrazione";
import { t, impostaLingua, risolviLingua, localeCorrente, linguaCorrente, NOMI_LINGUA, type ScelteLingua } from './i18n/lingua';
import { barraPredefinita } from "./sheet/barra-personalizzata";

/** La lingua scelta l'ultima volta, letta subito (prima delle impostazioni, che arrivano dopo) per non mostrare l'italiano per un attimo. */
const CHIAVE_LINGUA = "pmb_sheets.lingua";
function linguaRicordata(): ScelteLingua {
  try { const v = localStorage.getItem(CHIAVE_LINGUA); return v === "it" || v === "en" ? v : "auto"; } catch { return "auto"; }
}
impostaLingua(risolviLingua(linguaRicordata()));

/** Il deposito del browser per la copia di emergenza; null se non si può usare (per esempio con i dati del sito bloccati). */
function depositoLocale(): Storage | null {
  try { const d = window.localStorage; migraChiavi(d, 'free_sheets.', 'pmb_sheets.'); return d; } catch { return null; }
}

// Tauri invoke wrapper (failsafe se aperto in browser normale o test)
async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T | null> {
  try {
    if ((window as any).__TAURI__?.core?.invoke) {
      return await (window as any).__TAURI__.core.invoke(cmd, args);
    }
    if ((window as any).__TAURI_INTERNALS__?.invoke) {
      return await (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
    }
  } catch (err) {
    console.warn(`[Tauri invoke fallito su '${cmd}']:`, err);
  }
  return null;
}

/** L'unico documento della finestra: ogni sezione di pmb_sheets lavora su un solo file (le schede in alto sono i suoi fogli). */
const DOC_ID = "tab-1";
const TITOLO_NUOVO = "Foglio senza titolo";

/** Azioni di menu e barra strumenti che la griglia sa eseguire da sola: ordinamento, filtri, celle unite, trova e sostituisci, casella di controllo. */
const AZIONI_GRIGLIA = new Set([
  "sort-asc", "sort-desc", "create-filter", "toggle-filter", "clear-filter",
  "merge-all", "merge-horizontal", "merge-vertical", "unmerge", "find-replace", "insert-checkbox",
]);
export interface AppSettings {
  theme: "light" | "dark" | "system";
  windowWidth: number;
  windowHeight: number;
  /** lingua dell'interfaccia (manca nelle impostazioni scritte dalle versioni precedenti: vale «auto») */
  language?: ScelteLingua;
}

/** Una copia delle regole per la finestra: l'elenco mostrato non cambia finché non lo si aggiorna. */
function copiaRegole(regole: readonly unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(regole));
}

// versione pocket (device come AI_PRO): Apri e Salva con la finestra interna, così Windows non annota niente nel PC ospite
installaFinestraFilePortatile({ t, locale: localeCorrente });
// versione installata su Windows: Apri e Salva con le finestre di Windows, così «Salva» riscrive il file sul posto (file_nativi.rs)
installaFinestreNative({ t });

@customElement("free-app")
export class FreeApp extends LinguaElement {
  /** il titolo del file aperto */
  @state() private titolo = TITOLO_NUOVO;
  /** i fogli del file (le schede in alto) e quello attivo: li comunica la griglia */
  @state() private fogli: string[] = ["Foglio1"];
  @state() private foglioAttivo = "Foglio1";
  /** il colore della scheda di ogni foglio che ne ha uno ("#rrggbb") */
  @state() private coloriSchede: Record<string, string> = {};
  /** il documento della finestra come elenco di una scheda (per il salvataggio automatico e i controlli di chiusura) */
  private get tabs(): DocumentTab[] { return [{ id: DOC_ID, title: this.titolo }]; }
  /** l'identificativo del documento della finestra (l'unico) */
  readonly activeTabId: string = DOC_ID;
  @state() private sidebarOpen = false;
  @state() private zoom = 100;
  @state() private statusMessage = "Pronto";
  @state() private statsMessage = "";
  @state() private currentTheme: "light" | "dark" | "system" = "system";
  @state() private linguaScelta: ScelteLingua = linguaRicordata();
  @state() private activeCellFormat: CellStyle = {};
  @state() private sidebarTab: "comments" | "chart" | "pivot" = "comments";
  @state() private activeChartConfig?: any;
  @state() private activePivotConfig?: any;
  /** la copia di emergenza trovata all'avvio, in attesa che si scelga se ripristinarla: finché c'è, il salvataggio automatico non scrive */
  @state() private recuperabile: Recuperato | null = null;
  /** il salvataggio automatico dei fogli: sostituibile (nei test e in altri ambienti) */
  recupero = new Recupero(archivioDa(depositoLocale()));
  private timerRecupero = 0;
  /** da dove viene il foglio di ogni scheda (file aperto o già salvato): serve a "Salva" per riscrivere lo stesso file nello stesso formato */
  private origini = new Map<string, { maniglia: ManiglioFile | null; formato: FormatoId; nome: string }>();
  /** la domanda in corso ("Salvare le modifiche?"), con la funzione che ne raccoglie la risposta */
  @state() private conferma: { titolo: string; messaggio: string; scelte: SceltaConferma[]; risolvi: (id: string) => void } | null = null;
  private controlloInCorso = false;
  /** la tabella del foglio da stampare, presente solo mentre si stampa */
  /** le pagine da stampare, mentre la stampa di sistema è aperta (poi null) */
  @state() private tabellaStampa: PianoStampa | null = null;
  /** File › Imposta pagina: l'impostazione del foglio attivo mentre la finestra è aperta */
  @state() private dialogoPagina: { pagina: ImpostaPagina; foglio: string; selezione: string } | null = null;
  /** File › Anteprima di stampa: le pagine come usciranno */
  @state() private anteprima: PianoStampa | null = null;
  @state() private informazioniAperte: PaginaInformazioni | null = null;
  @state() private segnalaAperta = false;
  @state() private preferenzeAperte = false;
  @state() private personalizzaBarraAperto = false;
  /** menu in alto nascosti (barra del titolo e barra dei menu), come «Nascondi i menu» di pmb_docs; si ricorda tra un avvio e l'altro */
  @state() private menuNascosti = (() => { try { return localStorage.getItem("pmb_sheets.menu_nascosti") === "1"; } catch { return false; } })();

  /** Nasconde o mostra i menu in alto (freccia della barra, Visualizza › Nascondi i menu, Ctrl+Maiusc+F). */
  private alternaMenuNascosti(): void {
    this.menuNascosti = !this.menuNascosti;
    try { localStorage.setItem("pmb_sheets.menu_nascosti", this.menuNascosti ? "1" : "0"); } catch { /* il deposito può mancare: la scelta vale solo per questa sessione */ }
  }
  @state() private barraPersonalizzata: string[] | null = null;
  @state() private dialogoFormato: { codice: string; valore: CellValue } | null = null;
  @state() private dialogoLink: { riga: number; colonna: number; cella: string; url: string; testo: string } | null = null;
  @state() private dialogoProtezione: { modo: ModoProtezione; foglio: string; errore: string } | null = null;
  @state() private dialogoObiettivo: { cella: string; errore: string } | null = null;
  @state() private dialogoQr = false;
  @state() private dialogoSerie: { direzione: "colonne" | "righe"; data: boolean; errore: string } | null = null;
  /** la finestra della password per aprire: chiederla per un file cifrato («apri») o impostarla per il foglio («imposta») */
  @state() private dialogoPasswordFile: { modo: "apri" | "imposta"; nome: string; errore: string; haPassword?: boolean; bytes?: Uint8Array; maniglia?: ManiglioFile | null } | null = null;
  @state() private dialogoValuta: { cella: string; formula: string; passi: Array<{ testo: string; valore: string }> } | null = null;
  @state() private controlloAperto = false;
  @state() private celleControllo: Array<{ foglio: string; cella: string; valore: string; formula: string }> = [];
  private osservate: Array<{ foglio: string; riga: number; colonna: number }> = [];
  private timerControllo: number | undefined;
  @state() private dialogoSubtotali: { colonne: Array<{ col: number; nome: string }>; errore: string } | null = null;
  @state() private dialogoCommento: { riga: number; colonna: number; cella: string; testo: string; data: string } | null = null;
  @state() private dialogoNomi: { intervallo: string; foglio: string } | null = null;
  /** Dati › Rimuovi duplicati e Dati › Testo in colonne: l'area su cui lavorano e ciò che le finestre mostrano */
  @state() private dialogoDuplicati: { area: AreaFiltro; intestazioni: string[] } | null = null;
  @state() private dialogoTestoColonne: { area: AreaFiltro; testi: string[]; sovrascritte: number } | null = null;
  @state() private dialogoViste: { viste: unknown[]; filtriAttivi: boolean; errore: string } | null = null;
  @state() private dialogoRegole: { modo: "condizionale" | "convalida"; intervallo: string; regole?: unknown[]; convalide?: unknown[] } | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--color-bg);
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      box-sizing: border-box;
    }

    .main-workspace {
      display: flex;
      flex: 1;
      width: 100%;
      height: calc(100vh - var(--titlebar-height) - var(--menubar-height) - var(--toolbar-height) - var(--tabbar-height) - var(--statusbar-height));
      overflow: hidden;
      position: relative;
    }

    .content-area {
      flex: 1;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    .content-area > * {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .content-area > [hidden] {
      display: none !important;
    }

    .recupero {
      position: fixed;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 80%;
      padding: 8px 8px 8px 24px;
      border-radius: 4px;
      background: #323232;
      color: #ffffff;
      font-size: 14px;
    }

    .recupero button {
      height: 36px;
      padding: 0 12px;
      border: 0;
      border-radius: 4px;
      background: none;
      color: #a8c7fa;
      font: inherit;
      font-weight: 500;
      cursor: default;
    }

    .recupero button:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .stampa {
      display: none;
    }

    /* una pagina di carta per ogni pagina del piano: la @page ha margine zero, i margini li fa la pagina */
    .stampa-pagina {
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }
    .stampa-pagina:last-child { break-after: auto; page-break-after: auto; }
    .stampa-margine { display: flex; justify-content: space-between; font-size: 9pt; color: #000000; }
    .stampa-margine span { flex: 1; white-space: nowrap; overflow: hidden; }
    .stampa-margine span:nth-child(2) { text-align: center; }
    .stampa-margine span:nth-child(3) { text-align: right; }
    .stampa-tabella th { background: #f1f3f4; border: 1px solid #c0c0c0; font-weight: 400; font-size: 11px; color: #444444; text-align: center; padding: 0 2px; }
    .stampa-tabella { border-collapse: collapse; table-layout: fixed; }
    .stampa-tabella td { padding: 0 3px; overflow: hidden; text-overflow: clip; line-height: 1.3; }
    .anteprima { position: fixed; inset: 0; z-index: 900; display: flex; flex-direction: column; background: #5f6368; }
    .anteprima-barra { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--color-bg, #ffffff); color: var(--color-text, #202124); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
    .anteprima-barra h2 { margin: 0; font-size: 15px; font-weight: 500; }
    .anteprima-barra .spazio { flex: 1; }
    .anteprima-barra button { padding: 6px 14px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #ffffff); color: inherit; font: inherit; cursor: pointer; }
    .anteprima-barra button.primario { background: #1a73e8; border-color: #1a73e8; color: #ffffff; }
    .anteprima-pagine { flex: 1; overflow: auto; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px; zoom: 0.6; }
    .anteprima-pagine .stampa-pagina { background: #ffffff; color: #000000; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); flex: none; font-family: var(--font-family-base); font-size: 13px; }

    @media print {
      :host {
        height: auto;
        overflow: visible;
        background: #ffffff;
      }

      .app-theme-wrapper > :not(.stampa) {
        display: none !important;
      }

      .stampa {
        display: block;
        color: #000000;
        background: #ffffff;
        font-family: var(--font-family-base);
        font-size: 13px;
      }

      .stampa-tabella {
        border-collapse: collapse;
        table-layout: fixed;
      }

      .stampa-tabella td {
        padding: 0 3px;
        overflow: hidden;
        text-overflow: clip;
        line-height: 1.3;
      }


    }
    .app-theme-wrapper {
      display: contents;
    }
  ` as any;

  async connectedCallback() {
    super.connectedCallback();
    impostaLocaleNumeri("it"); // numeri mostrati all'italiana: virgola decimale, punto per le migliaia
    impostaLinguaNomi("it"); // nomi di mesi e giorni in italiano (TEXT con "mmmm", "dddd")
    // Alt premuto e rilasciato da solo: Windows entrerebbe nella "modalità menu" della finestra (che qui non ha una barra dei menu di sistema)
    // e la pagina smette di rispondere finché non si preme un altro tasto. Impedendo l'azione predefinita sul rilascio di Alt resta tutto com'è.
    window.addEventListener("keyup", (e: KeyboardEvent) => { if (e.key === "Alt") e.preventDefault(); }, true);
    // niente menu predefinito del motore web (navigazione, strumenti di sviluppo): i campi di testo lo tengono per copia e incolla, le celle hanno il loro
    document.addEventListener("contextmenu", (e) => {
      const t = e.composedPath()[0];
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      e.preventDefault();
    });
    this.recuperabile = this.recupero.trova();
    defaultDocumentStore.removeDocument(DOC_ID); // si parte sempre da un foglio pulito
    this.segnaVuoto(DOC_ID); // il foglio di partenza: vuoto finché non ci si scrive
    this.timerRecupero = window.setInterval(() => { void this.controllaRecupero(); }, INTERVALLO_CONTROLLO);
    // la chiusura della finestra (X, Alt+F4, barra delle applicazioni) passa da qui: si controlla se ci sono fogli non salvati
    void invokeTauri("proteggi_chiusura", { attiva: true });
    window.addEventListener("chiusura-richiesta", this.suChiusuraRichiesta); // lo manda la shell Tauri quando la finestra viene chiusa dal sistema
    // tema «Come il sistema»: se Windows o il Mac passano dal chiaro allo scuro (o viceversa) mentre il programma è aperto, lo si segue subito
    try { window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", this.suTemaSistema); } catch { /* senza matchMedia resta il tema letto all'avvio */ }
    await this.loadInitialSettings();
    void this.updateComplete.then(() => this.apriDaAvvio());
    // su Mac, un file aperto dal Finder mentre il programma è già acceso: prima si chiede che cosa fare delle modifiche non salvate
    window.addEventListener("file-dal-finder", async () => { if (await this.confermaSeModificato()) await this.apriDaAvvio(); });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      // Cmd su Mac, Ctrl su Windows; «altro» è il tasto che su quel sistema non fa da principale
      const mod = tastoPrimario(e), altro = suMac() ? e.ctrlKey : e.metaKey;
      // Ctrl+S salva, Ctrl+O apre
      if (mod && !e.altKey && !altro && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void this.salva(e.shiftKey);
        return;
      }
      if (mod && !e.altKey && !altro && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void this.apriFile();
        return;
      }
      if (mod && !e.altKey && !altro && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void this.stampa();
        return;
      }
      if (e.key === "F7" && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.toggleOrtografia === "function") this.statusMessage = grid.toggleOrtografia();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        this.applicaSchermoIntero(!this.schermoIntero);
        return;
      }
      // Esc ferma la lettura ad alta voce
      if (e.key === "Escape" && staLeggendo() && !mod && !e.altKey) { fermaLettura(); this.statusMessage = t("Lettura fermata"); }
      // Esc esce dallo schermo intero, come in pmb_docs
      if (e.key === "Escape" && this.schermoIntero && !mod && !e.altKey) {
        e.preventDefault();
        this.applicaSchermoIntero(false);
        return;
      }
      if (mod && !e.altKey && !altro && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.apriDialogoLink();
        return;
      }
      if (mod && e.altKey && !altro && (e.key.toLowerCase() === "m" || e.code === "KeyM")) {
        e.preventDefault();
        this.apriCommento();
        return;
      }
      // Ctrl+Maiusc+F: nasconde o mostra i menu (come in pmb_docs)
      if (mod && e.shiftKey && !e.altKey && !altro && (e.key.toLowerCase() === "f" || e.code === "KeyF")) {
        e.preventDefault();
        this.alternaMenuNascosti();
        return;
      }
      // Scorciatoia Ctrl+Alt+S per sidebar
      // Raggruppa (Alt+Maiusc+→) e Separa (Alt+Maiusc+←), come Excel e LibreOffice
      if (!mod && e.altKey && e.shiftKey && !altro && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const grid: any = this.getActiveGrid();
        const metodo = e.key === "ArrowRight" ? "raggruppaSelezione" : "separaSelezione";
        if (grid && typeof grid[metodo] === "function") this.statusMessage = grid[metodo]();
        return;
      }
      if (mod && e.altKey && (e.key.toLowerCase() === "s" || e.code === "KeyS")) {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  }

  private suChiusuraRichiesta = () => { void this.richiediChiusuraApp(); };
  /** Schermo intero della finestra (F11, Visualizza › Schermo intero; Esc ne esce). Come in pmb_docs lo stato lo tiene la pagina e la parte
   *  nativa lo applica (imposta_schermo_intero), così pagina e finestra non perdono il passo. */
  private schermoIntero = false;
  private applicaSchermoIntero(attivo: boolean): void {
    this.schermoIntero = attivo;
    void invokeTauri("imposta_schermo_intero", { attivo });
  }
  private suTemaSistema = () => { if (this.currentTheme === "system") void this.setTheme("system", false); };

  disconnectedCallback() {
    window.removeEventListener("chiusura-richiesta", this.suChiusuraRichiesta);
    try { window.matchMedia?.("(prefers-color-scheme: dark)").removeEventListener("change", this.suTemaSistema); } catch { /* vedi connectedCallback */ }
    window.clearInterval(this.timerRecupero);
    super.disconnectedCallback();
  }
  private async loadInitialSettings() {
    try {
      const b = localStorage.getItem("pmb_sheets.barra_personalizzata");
      if (b) {
        this.barraPersonalizzata = JSON.parse(b);
      }
    } catch {
      // ignora errore localStorage
    }
    const saved = await invokeTauri<AppSettings>("get_settings");
    const lingua = saved?.language;
    void this.applicaLingua(lingua === "it" || lingua === "en" || lingua === "auto" ? lingua : linguaRicordata(), false);
    if (saved && saved.theme) {
      this.setTheme(saved.theme, false);
    } else {
      // nessuna impostazione salvata: il tema segue quello del computer (anche quando cambia)
      this.setTheme("system", false);
    }
  }

  /** Cambia la lingua dell'interfaccia (auto = come Windows): i componenti si ridisegnano da soli; con `persist` la scelta resta per le prossime aperture. */
  private async applicaLingua(lingua: ScelteLingua, persist = true) {
    this.linguaScelta = lingua;
    try { localStorage.setItem(CHIAVE_LINGUA, lingua); } catch { /* senza localStorage resta il file delle impostazioni */ }
    impostaLingua(risolviLingua(lingua));
    this.requestUpdate();
    if (persist) {
      await invokeTauri("save_settings", {
        settings: { theme: this.currentTheme, windowWidth: window.innerWidth, windowHeight: window.innerHeight, language: lingua },
      });
      this.statusMessage = t("Lingua del programma: {}", lingua === "auto" ? t("Automatica (come Windows)") : NOMI_LINGUA[lingua]);
    }
  }

  private async setTheme(theme: "light" | "dark" | "system", persist = true) {
    this.currentTheme = theme;
    let actualTheme = theme;

    if (theme === "system") {
      actualTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", actualTheme);

    if (persist) {
      await invokeTauri("save_settings", {
        settings: {
          theme,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          language: this.linguaScelta,
        },
      });
      this.statusMessage = t("Tema impostato su: {}", t(theme === "light" ? "Chiaro" : theme === "dark" ? "Scuro" : "Come il sistema"));
    }
  }

  /** Il contenuto del foglio di una scheda in formato .fsheet, per confrontarlo con quello di prima. */
  private async fotografa(doc: Parameters<typeof estraiDati>[0]): Promise<string> {
    return serializeSheetDocumentData(await estraiDati(doc));
  }

  private foglioVuoto: Promise<string> | null = null;

  /** Il contenuto di un foglio appena creato, in formato .fsheet: com'è prima che qualcuno ci scriva. */
  private fotografiaFoglioVuoto(): Promise<string> {
    if (this.foglioVuoto === null) this.foglioVuoto = this.fotografa(new DocumentStore().getOrCreateDocument("vuoto"));
    return this.foglioVuoto;
  }

  /** Il foglio della scheda è appena nato: conta come modificato non appena cambia, anche se succede prima del primo controllo. */
  private segnaVuoto(id: string) {
    this.fotografiaFoglioVuoto()
      .then((vuoto) => this.recupero.pulita(id, vuoto))
      .catch((err) => console.warn("[recupero] riferimento del foglio vuoto non disponibile:", err));
  }
  /** Il foglio della scheda è com'è su disco: da qui in poi conta come modificato solo se cambia. */
  private async segnaPulita(id: string) {
    const doc = defaultDocumentStore.getDocument(id);
    if (!doc) return;
    try { this.recupero.pulita(id, await this.fotografa(doc)); } catch (err) { console.warn("[recupero] foglio non fotografabile:", err); }
  }

  /** Guarda i fogli aperti e tiene aggiornata la copia di emergenza (ogni pochi secondi). Finché c'è una copia da ripristinare non fa niente. */
  /** l'ultimo problema della copia di emergenza di cui si è già avvisato l'utente (per non ripetere l'avviso a ogni controllo) */
  private avvisoRecuperoDato: string | null = null;

  async controllaRecupero(): Promise<void> {
    if (this.recuperabile || this.controlloInCorso) return;
    this.controlloInCorso = true;
    try {
      const vive: SchedaViva[] = [];
      for (const t of this.tabs) {
        const doc = defaultDocumentStore.getDocument(t.id);
        if (doc) vive.push({ id: t.id, titolo: t.title, dati: await this.fotografa(doc) });
      }
      this.recupero.controlla(vive);
      // se la copia di emergenza non si può scrivere (foglio troppo grande o deposito pieno) lo si dice una volta sola: altrimenti si crede di essere protetti
      const esito = this.recupero.esito;
      if ((esito === 'troppo-grande' || esito === 'errore') && this.avvisoRecuperoDato !== esito) {
        this.avvisoRecuperoDato = esito;
        this.statusMessage = esito === 'troppo-grande'
          ? t("Foglio molto grande: la copia automatica di emergenza non funziona, salva spesso (Ctrl+S).")
          : t("La copia automatica di emergenza non si riesce a scrivere: salva spesso (Ctrl+S).");
      } else if (esito === 'scritto' || esito === 'vuoto') {
        this.avvisoRecuperoDato = null;
      }
    } catch (err) {
      console.warn("[recupero] controllo non riuscito:", err);
    } finally {
      this.controlloInCorso = false;
    }
  }

  /** Rimette nella finestra il documento della copia di emergenza. Se la copia ne contiene più d'uno (versioni precedenti, a schede) carica il primo e lo dice. */
  private async ripristina() {
    const copia = this.recuperabile;
    if (!copia) return;
    const scheda = copia.schede[0];
    try {
      await applicaDati(defaultDocumentStore.getOrCreateDocument(DOC_ID, scheda.titolo), deserializeSheetDocumentData(scheda.dati));
    } catch (err) {
      this.statusMessage = t("Impossibile ripristinare: {}", err instanceof Error ? err.message : String(err));
      return;
    }
    this.titolo = scheda.titolo;
    this.origini.delete(DOC_ID);
    this.recupero.pulita(DOC_ID, ""); // è ancora da salvare: conta come modificato
    this.recuperabile = null;
    await this.ricaricaGriglia();
    const altri = copia.schede.length - 1;
    this.statusMessage = altri > 0 ? t("Ripristinato \"{}\". La copia conteneva altri {} fogli di una versione precedente: non sono stati caricati.", scheda.titolo, altri) : t("Ripristinato \"{}\"", scheda.titolo);
  }

  /** La griglia rilegge i fogli dopo che il contenuto del documento è stato sostituito. */
  private async ricaricaGriglia(): Promise<void> {
    await this.updateComplete;
    await (this.getActiveGrid() as { ricarica?: () => Promise<void> } | null)?.ricarica?.();
  }

  /** Prima di sostituire il file aperto (Apri, Nuovo): se ha modifiche non salvate chiede cosa fare. true = si può procedere. */
  private async confermaSeModificato(): Promise<boolean> {
    if (this.conferma) return false;
    const doc = defaultDocumentStore.getDocument(DOC_ID);
    let modificato = true; // se non si riesce a leggere il foglio, per prudenza si chiede
    try { modificato = !!doc && this.recupero.modificata(DOC_ID, await this.fotografa(doc)); } catch (err) { console.warn("[conferma] foglio non fotografabile:", err); }
    if (!modificato) return true;
    const scelta = await this.chiediConferma(
      t("Salvare «{}»?", this.titolo === TITOLO_NUOVO ? t(TITOLO_NUOVO) : this.titolo),
      t("Il foglio ha modifiche non salvate: se lo sostituisci andranno perse."),
      [{ id: "salva", testo: t("Salva"), principale: true }, { id: "scarta", testo: t("Non salvare") }, { id: "annulla", testo: t("Annulla"), annulla: true }],
    );
    if (scelta === "annulla") return false;
    if (scelta === "salva") return this.salvaScheda(this.getActiveTab(), false);
    return true;
  }

  /** File > Nuovo foglio di calcolo: sostituisce il file aperto con uno vuoto. */
  private async nuovoFile() {
    if (!(await this.confermaSeModificato())) return;
    try {
      const vuoto = await estraiDati(new DocumentStore().getOrCreateDocument("vuoto"));
      const doc = defaultDocumentStore.getOrCreateDocument(DOC_ID, TITOLO_NUOVO);
      await applicaDati(doc, vuoto);
      this.titolo = TITOLO_NUOVO;
      this.origini.delete(DOC_ID);
      await this.segnaPulita(DOC_ID);
      await this.ricaricaGriglia();
      this.statusMessage = "Nuovo foglio di calcolo";
    } catch (err) {
      this.statusMessage = t("Impossibile creare il foglio: {}", err instanceof Error ? err.message : String(err));
    }
  }

  /** Butta via la copia di emergenza trovata all'avvio. */
  private scartaCopia() {
    this.recupero.scarta();
    this.recuperabile = null;
    this.statusMessage = t("Copia di emergenza scartata");
  }
  /** Il testo mostrato in una cella e che tipo di valore è, come lo vede chi guarda la griglia. */
  private valoreDaStampare(valore: CellValue, formato?: string): ValoreStampa {
    switch (valore.kind) {
      case "number": return { testo: formatCellValue(valore, formato), tipo: "numero" };
      case "text": return { testo: formatDisplayValue(valore).text, tipo: "testo" };
      case "boolean": return { testo: formatDisplayValue(valore).text, tipo: "booleano" };
      case "error": return { testo: formatDisplayValue(valore).text, tipo: "errore" };
      default: return { testo: formatDisplayValue(valore).text, tipo: "vuoto" };
    }
  }

  /** Stampa il foglio della scheda attiva: ne prepara la tabella, apre la stampa di sistema (anteprima e "Salva come PDF") e poi la toglie. */
  async stampa(): Promise<void> {
    const tab = this.getActiveTab();
    const doc = defaultDocumentStore.getDocument(tab.id);
    if (!doc) {
      this.statusMessage = t("Nessun foglio di calcolo da stampare");
      return;
    }
    try {
      const piano = await this.pianoDelFoglioAttivo(doc);
      if (!piano) {
        this.statusMessage = t("Il foglio è vuoto: niente da stampare");
        return;
      }
      this.tabellaStampa = piano;
      this.impostaPaginaDiStampa(piano);
      await this.updateComplete;
      window.addEventListener("afterprint", () => { this.tabellaStampa = null; this.impostaPaginaDiStampa(null); }, { once: true });
      window.print();
    } catch (err) {
      this.tabellaStampa = null;
      this.impostaPaginaDiStampa(null);
      this.statusMessage = t("Impossibile stampare: {}", err instanceof Error ? err.message : String(err));
    }
  }

  /** Il piano di stampa del foglio attivo, con i valori calcolati dal motore e l'impostazione di pagina del foglio. null se è vuoto. */
  async pianoDelFoglioAttivo(doc: NonNullable<ReturnType<typeof defaultDocumentStore.getDocument>>): Promise<PianoStampa | null> {
    const scambio = scambioDaDocumento(await estraiDati(doc));
    const foglio = scambio.fogli.find((f) => f.nome === scambio.foglioAttivo) ?? scambio.fogli[0];
    if (!foglio) return null;
    // i valori si leggono dal motore una riga alla volta, solo per le celle che il piano chiede
    const valori = new Map<string, ValoreStampa>();
    const leggi = async (r1: number, c1: number, r2: number, c2: number): Promise<void> => {
      const m = await doc.client.getRange(foglio.nome, r1, c1, r2, c2);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const v = m[r - r1]?.[c - c1] ?? { kind: "empty" as const };
        valori.set(`${r}:${c}`, this.valoreDaStampare(v, stileEffettivo(foglio, r, c, indirizzoCella(r, c)).numFmt));
      }
    };
    // prima un giro senza valori per sapere quali righe e colonne servono, poi si leggono e si fa il piano vero
    const prova = pianoDiStampa(foglio, () => ({ testo: "", tipo: "vuoto" }), { file: this.titolo, adesso: new Date(), locale: localeCorrente() });
    if (!prova) return null;
    const righe = prova.pagine.flatMap((pg) => pg.righe);
    const colonne = prova.pagine.flatMap((pg) => pg.colonne);
    await leggi(Math.min(...righe), Math.min(...colonne), Math.max(...righe), Math.max(...colonne));
    return pianoDiStampa(foglio, (r, c) => valori.get(`${r}:${c}`) ?? { testo: "", tipo: "vuoto" }, { file: this.titolo, adesso: new Date(), locale: localeCorrente() });
  }

  /** La regola @page (carta e orientamento) deve stare nel documento, fuori dal componente: si mette prima della stampa e si toglie dopo. */
  private impostaPaginaDiStampa(piano: PianoStampa | null): void {
    const id = "pmb-sheets-pagina-stampa";
    document.getElementById(id)?.remove();
    if (!piano) return;
    const stile = document.createElement("style");
    stile.id = id;
    stile.textContent = `@page { size: ${piano.carta.larghezza}mm ${piano.carta.altezza}mm; margin: 0; }`;
    document.head.appendChild(stile);
  }

  /** Una pagina stampata: margini, intestazione, tabella (con le intestazioni di riga e colonna se scelte) e piè di pagina. */
  private paginaStampa(piano: PianoStampa, pg: PaginaPiano) {
    const m = piano.margini;
    const corpo = {
      position: "absolute", left: `${m.sinistro}mm`, right: `${m.destro}mm`, top: `${m.alto}mm`, bottom: `${m.basso}mm`,
      display: "flex", flexDirection: "column", alignItems: piano.centraOrizzontale ? "center" : "flex-start", justifyContent: piano.centraVerticale ? "center" : "flex-start",
    };
    const margine = (testi: PaginaPiano["intestazione"], dove: "alto" | "basso") => html`<div class="stampa-margine" style=${styleMap({
      position: "absolute", left: `${m.sinistro}mm`, right: `${m.destro}mm`, [dove === "alto" ? "top" : "bottom"]: `${Math.max(2, (dove === "alto" ? m.alto : m.basso) / 2 - 2)}mm`,
    })}><span>${testi.sinistra}</span><span>${testi.centro}</span><span>${testi.destra}</span></div>`;
    return html`<section class="stampa-pagina" style=${styleMap({ width: `${piano.carta.larghezza}mm`, height: `${piano.carta.altezza}mm` })}>
      ${margine(pg.intestazione, "alto")}
      <div style=${styleMap(corpo)}>
        <div class="stampa-scala" style=${styleMap({ zoom: String(piano.scala) })}>
          <table class="stampa-tabella${piano.griglia ? " con-griglia" : ""}">
            <colgroup>${piano.intestazioniRigheColonne ? html`<col style=${styleMap({ width: `${LARGHEZZA_NUMERI_RIGA}px` })} />` : ""}${pg.larghezze.map((w) => html`<col style=${styleMap({ width: `${w}px` })} />`)}</colgroup>
            ${piano.intestazioniRigheColonne ? html`<thead><tr style=${styleMap({ height: `${ALTEZZA_LETTERE_COLONNA}px` })}><th></th>${lettereColonne(pg).map((l) => html`<th>${l}</th>`)}</tr></thead>` : ""}
            <tbody>
              ${pg.celle.map((riga, i) => html`<tr style=${styleMap({ height: `${pg.altezze[i] ?? 22}px` })}>
                ${piano.intestazioniRigheColonne ? html`<th>${pg.righe[i]}</th>` : ""}${riga.map((c) => html`<td rowspan=${c.rowspan} colspan=${c.colspan} style=${styleMap(c.stile)}>${c.testo}</td>`)}
              </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
      ${margine(pg.pie, "basso")}
    </section>`;
  }
  private getActiveTab(): DocumentTab {
    return { id: DOC_ID, title: this.titolo };
  }

  private handleTitleChanged(e: CustomEvent<{ title: string }>) {
    this.titolo = e.detail.title;
    this.statusMessage = t("Foglio rinominato in \"{}\"", this.titolo);
    // Se il file non è ancora salvato su disco (oppure è stato appena rinominato), apri la finestra di salvataggio
    const origine = this.origini.get(DOC_ID);
    if (!origine || !origine.maniglia) {
      void this.salva(true);
    }
  }

  /** I fogli del file, come li comunica la griglia. */
  private handleSheetsChanged(e: CustomEvent<{ fogli: string[]; nascosti?: string[]; attivo: string; colori?: Record<string, string> }>) {
    this.coloriSchede = e.detail.colori ?? {};
    this.fogli = e.detail.fogli;
    this.foglioAttivo = e.detail.attivo;
  }

  /** Le schede in alto sono i fogli del file: clic = vai al foglio. */
  private handleTabSelected(e: CustomEvent<{ id: string }>) {
    void (this.getActiveGrid() as { switchSheet?: (n: string) => Promise<void> } | null)?.switchSheet?.(e.detail.id);
  }

  /** Mostra una domanda con più scelte e aspetta la risposta (l'id della scelta). */
  private chiediConferma(titolo: string, messaggio: string, scelte: SceltaConferma[]): Promise<string> {
    return new Promise((risolvi) => { this.conferma = { titolo, messaggio, scelte, risolvi }; });
  }

  private rispondiConferma(id: string) {
    const c = this.conferma;
    this.conferma = null;
    c?.risolvi(id);
  }

  /** Le schede con modifiche non salvate (diverse da com'erano appena create, aperte da file o salvate). */
  private async schedeModificate(): Promise<DocumentTab[]> {
    const modificate: DocumentTab[] = [];
    for (const t of this.tabs) {
      const doc = defaultDocumentStore.getDocument(t.id);
      if (doc && this.recupero.modificata(t.id, await this.fotografa(doc))) modificate.push(t);
    }
    return modificate;
  }

  /** Chiusura della finestra: se ci sono fogli non salvati chiede conferma, poi chiude davvero. */
  async richiediChiusuraApp(): Promise<void> {
    // una domanda è già aperta: la pagina è viva e lo ridice alla shell a ogni nuova X, altrimenti la terza X entro 10 s (decidi_chiusura in lib.rs)
    // la scambierebbe per una pagina bloccata e chiuderebbe senza salvare (trovato con la prova fisica del 2026-11-19; uguale in pmb_docs)
    if (this.conferma) { void invokeTauri("proteggi_chiusura", { attiva: true }); return; }
    let modificate: DocumentTab[] = [];
    try { modificate = await this.schedeModificate(); } catch (err) { console.warn("[chiusura] controllo non riuscito:", err); modificate = this.tabs; }
    if (modificate.length > 0) {
      const nomi = modificate.map((s) => `«${s.title === TITOLO_NUOVO ? t(TITOLO_NUOVO) : s.title}»`).join(", ");
      // la domanda compare: la pagina è viva, quindi una nuova X (anche un doppio clic) deve trovare la domanda, non chiudere senza salvare
      void invokeTauri("proteggi_chiusura", { attiva: true });
      const scelta = await this.chiediConferma(
        t("Uscire senza salvare?"),
        modificate.length === 1 ? t("Il foglio {} ha modifiche non salvate.", nomi) : t("{} fogli hanno modifiche non salvate: {}.", modificate.length, nomi),
        [{ id: "salva", testo: t("Salva"), principale: true }, { id: "esci", testo: t("Non salvare") }, { id: "annulla", testo: t("Annulla"), annulla: true }],
      );
      if (scelta === "salva") {
        // come in pmb_docs: si chiude solo se il salvataggio riesce (la finestra «Salva con nome» annullata lascia il programma aperto)
        const salvato = await this.salva(false);
        if (!salvato || (await this.schedeModificate()).length > 0) { void invokeTauri("proteggi_chiusura", { attiva: true }); this.statusMessage = t("Il foglio non è stato salvato: il programma resta aperto"); return; }
      } else if (scelta !== "esci") {
        // la pagina ha risposto: una nuova X entro 10 secondi deve chiedere di nuovo (la shell altrimenti chiuderebbe senza domande)
        void invokeTauri("proteggi_chiusura", { attiva: true });
        return;
      }
    }
    await invokeTauri("destroy_window");
  }

  /** X su una scheda = elimina quel foglio (con conferma se contiene dati). */
  private async handleTabClosed(e: CustomEvent<{ id: string }>) {
    const g: any = this.getActiveGrid();
    if (!g) return;
    await g.switchSheet(e.detail.id);
    await g.deleteCurrentSheet();
  }

  /** "+" = aggiunge un foglio al file. */
  private handleTabCreated() {
    void (this.getActiveGrid() as { handleAddSheet?: () => Promise<void> } | null)?.handleAddSheet?.();
  }

  /** Doppio clic su una scheda = rinomina il foglio. */
  private async handleTabRename(e: CustomEvent<{ id: string }>) {
    const g: any = this.getActiveGrid();
    if (!g) return;
    await g.switchSheet(e.detail.id);
    g.handlePromptRenameSheet(e.detail.id);
  }

  /** Clic destro su una scheda = menu del foglio (rinomina, duplica, elimina). */
  private async handleTabMenu(e: CustomEvent<{ id: string; evento: MouseEvent }>) {
    const g: any = this.getActiveGrid();
    if (!g) return;
    await g.switchSheet(e.detail.id);
    g.handleSheetContextMenu(e.detail.id, e.detail.evento);
  }

  /** Trascinare una scheda = cambiare l'ordine dei fogli. */
  private async handleTabMoved(e: CustomEvent<{ da: number; a: number }>) {
    await (this.getActiveGrid() as { reorderSheet?: (da: number, a: number) => Promise<boolean> } | null)?.reorderSheet?.(e.detail.da, e.detail.a);
  }

  /** File > Apri: il file sostituisce quello aperto (ogni finestra lavora su un solo file); se ha modifiche non salvate chiede prima cosa fare. */
  private async apriFile() {
    const file = await scegliFile(ESTENSIONI_APRI);
    if (!file) return;
    if (!(await this.confermaSeModificato())) return;
    await this.apriDaByte(new Uint8Array(await file.arrayBuffer()), file.name, file.maniglia ?? null);
  }

  /** Se la finestra è stata avviata con un file (doppio clic in Esplora risorse, "Apri con"), lo apre. */
  private async apriDaAvvio() {
    // nome, percorso ed eventuale problema (src-tauri/src/lib.rs, file_di_avvio: uguale in pmb_docs); i byte si leggono grezzi con file_leggi
    // (prima arrivavano come elenco JSON di numeri: 4 volte più lento)
    const f = await invokeTauri<{ nome: string; percorso: string; problema?: string | null }>("file_di_avvio");
    if (!f || !f.nome) return;
    // il file c'è ma non si apre: lo si dice, invece di aprire un foglio vuoto senza spiegazioni
    if (f.problema === "TROPPO_GRANDE") { this.statusMessage = t("«{}» è troppo grande per essere aperto (oltre 100 MB)", f.nome); return; }
    if (f.problema === "FORMATO_NON_SUPPORTATO") { this.statusMessage = t("«{}»: questo tipo di file non si apre con pmb_sheets", f.nome); return; }
    if (f.problema) { this.statusMessage = t("Non trovo il file «{}»", f.nome); return; }
    const grezzo = await invokeTauri<ArrayBuffer | ArrayLike<number>>("file_leggi", { percorsoFile: f.percorso });
    const bytes = grezzo instanceof ArrayBuffer ? new Uint8Array(grezzo) : grezzo && typeof grezzo.length === "number" ? Uint8Array.from(grezzo as ArrayLike<number>) : null;
    if (!bytes) { this.statusMessage = t("Non riesco a leggere \"{}\"", f.nome); return; }
    // con il percorso, «Salva» riscrive il file sul posto invece di chiedere dove salvarlo
    await this.apriDaByte(bytes, f.nome, manigliaNativa(f.percorso) as unknown as ManiglioFile);
  }

  private async apriDaByte(bytes: Uint8Array, nome: string, maniglia: ManiglioFile | null, password?: string) {
    const file = { name: nome, maniglia };
    try {
      const aperto = await apriInScheda(defaultDocumentStore, DOC_ID, bytes, file.name, password);
      this.dialogoPasswordFile = null;
      this.titolo = aperto.titolo;
      // un file che si apre ma non si riscrive nello stesso formato (macro, .xlsb, .html...) non resta legato al suo originale: «Salva» chiede un nome nuovo
      this.origini.set(DOC_ID, { maniglia: aperto.soloLettura ? null : file.maniglia ?? null, formato: aperto.formato, nome: file.name });
      await this.segnaPulita(DOC_ID);
      await this.ricaricaGriglia();
      this.statusMessage = aperto.avvisi.length > 0 ? t("Aperto \"{}\". {}", file.name, aperto.avvisi.join(" ")) : t("Aperto \"{}\"", file.name);
    } catch (err) {
      // il file ha la password per aprire: la si chiede (di nuovo, se era sbagliata) e si riprova
      if (err instanceof PasswordRichiesta) {
        this.dialogoPasswordFile = { modo: "apri", nome: file.name, errore: err.sbagliata ? t("La password non è giusta") : "", bytes, maniglia };
        await this.updateComplete;
        (this.renderRoot.querySelector("free-dialogo-password-file") as unknown as { libera?: () => void } | null)?.libera?.();
        return;
      }
      this.dialogoPasswordFile = null;
      this.statusMessage = t("Impossibile aprire \"{}\": {}", file.name, err instanceof Error ? err.message : String(err));
    }
  }

  private async applicaSerie(d: { direzione: "colonne" | "righe"; tipo: string; unita: string; passo: string; limite: string }): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || !this.dialogoSerie) return;
    const r = await grid.riempiSerie(d.direzione, d.tipo, d.unita, d.passo, d.limite);
    if (!r.ok) { this.dialogoSerie = { ...this.dialogoSerie, errore: r.messaggio }; return; }
    this.dialogoSerie = null;
    this.statusMessage = r.messaggio;
    this.riportaFocusAllaGriglia();
  }

  /** La password scritta nella finestra: apre il file cifrato, oppure imposta (o toglie, se vuota) quella del foglio. */
  private async confermaPasswordFile(password: string): Promise<void> {
    const d = this.dialogoPasswordFile;
    if (!d) return;
    if (d.modo === "apri") { if (d.bytes) await this.apriDaByte(d.bytes, d.nome, d.maniglia ?? null, password); return; }
    const doc = defaultDocumentStore.getDocument(this.getActiveTab().id);
    if (doc) doc.passwordApertura = password === "" ? undefined : password;
    this.dialogoPasswordFile = null;
    this.statusMessage = password === "" ? t("Password per aprire tolta: vale dal prossimo salvataggio") : t("Password per aprire impostata: vale dal prossimo salvataggio in .xlsx o .ods");
    this.riportaFocusAllaGriglia();
  }

  /** File > Salva (Ctrl+S) e Salva con nome (Ctrl+Maiusc+S): salva la scheda attiva. */
  private salva(conNome: boolean): Promise<boolean> {
    return this.salvaScheda(this.getActiveTab(), conNome);
  }

  /** Salva una scheda. Se il foglio viene da un file (o è già stato salvato) riscrive quello nello stesso formato, senza chiedere il nome;
   *  altrimenti, o con "Salva con nome", apre la finestra di scelta. Restituisce true solo se il file è stato scritto. */
  private async salvaScheda(tab: DocumentTab, conNome: boolean): Promise<boolean> {
    const origine = this.origini.get(tab.id);
    const formato: FormatoId = origine?.formato ?? "xlsx";
    try {
      const pronto = await preparaSalvataggio(defaultDocumentStore, tab.id, tab.title, formato);
      const destinazione = { maniglia: conNome ? null : origine?.maniglia ?? null };
      const salvato = await salvaSuDisco(pronto.nome, pronto.bytes, pronto.mime, destinazione);
      if (salvato) {
        this.origini.set(tab.id, { maniglia: destinazione.maniglia ?? null, formato, nome: pronto.nome });
        await this.segnaPulita(tab.id);
      }
      this.statusMessage = !salvato
        ? t("Salvataggio annullato")
        : pronto.avvisi.length > 0 ? t("Salvato \"{}\". {}", pronto.nome, pronto.avvisi.join(" ")) : t("Salvato \"{}\"", pronto.nome);
      return salvato;
    } catch (err) {
      this.statusMessage = t("Impossibile salvare: {}", err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  /** File > Scarica come...: esporta una copia nel formato scelto. Il foglio resta legato al suo file e non conta come salvato. */
  private async scaricaFile(formato: FormatoId) {
    const tab = this.getActiveTab();
    try {
      const pronto = await preparaSalvataggio(defaultDocumentStore, tab.id, tab.title, formato);
      const salvato = await salvaSuDisco(pronto.nome, pronto.bytes, pronto.mime);
      this.statusMessage = !salvato
        ? t("Salvataggio annullato")
        : pronto.avvisi.length > 0 ? t("Esportato \"{}\". {}", pronto.nome, pronto.avvisi.join(" ")) : t("Esportato \"{}\"", pronto.nome);
    } catch (err) {
      this.statusMessage = t("Impossibile esportare: {}", err instanceof Error ? err.message : String(err));
    }
  }
  private toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    if (this.sidebarOpen && this.sidebarTab !== "comments" && !this.activeChartConfig && !this.activePivotConfig) this.sidebarTab = "comments";
    this.statusMessage = this.sidebarOpen ? t("Pannello laterale aperto") : t("Pannello laterale chiuso");
  }

  // ---- File › Imposta pagina e File › Anteprima di stampa ----
  private apriImpostaPagina(): void {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.paginaAttiva !== "function") return;
    const doc = grid.getDoc();
    this.anteprima = null;
    this.dialogoPagina = { pagina: grid.paginaAttiva(), foglio: doc.activeSheetName, selezione: doc.selection.isAll ? "" : scriviIntervallo(doc.selection.range) };
  }
  private applicaImpostaPagina(p: ImpostaPagina, poiAnteprima: boolean): void {
    const grid: any = this.getActiveGrid();
    this.dialogoPagina = null;
    if (!grid || typeof grid.impostaPaginaAttiva !== "function") return;
    grid.impostaPaginaAttiva(p);
    this.statusMessage = t("Impostazione di pagina aggiornata");
    if (poiAnteprima) void this.apriAnteprima();
  }
  private async apriAnteprima(): Promise<void> {
    const doc = defaultDocumentStore.getDocument(this.getActiveTab().id);
    if (!doc) { this.statusMessage = t("Nessun foglio di calcolo da stampare"); return; }
    const piano = await this.pianoDelFoglioAttivo(doc);
    if (!piano) { this.statusMessage = t("Il foglio è vuoto: niente da stampare"); return; }
    this.anteprima = piano;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLButtonElement>('.anteprima button[data-azione="stampa"]')?.focus();
  }
  private chiudiAnteprima(): void { this.anteprima = null; }

  // ---- Dati › Rimuovi duplicati e Dati › Testo in colonne ----
  private async apriRimuoviDuplicati(): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.preparaDuplicati !== "function") return;
    const p = await grid.preparaDuplicati();
    if ("errore" in p) { this.statusMessage = p.errore; return; }
    this.dialogoDuplicati = p;
  }
  private async eseguiRimuoviDuplicati(colonne: number[], conIntestazione: boolean): Promise<void> {
    const grid: any = this.getActiveGrid();
    const d = this.dialogoDuplicati;
    this.dialogoDuplicati = null;
    if (!grid || !d) return;
    const esito = await grid.rimuoviDuplicati(d.area, colonne, conIntestazione);
    this.statusMessage = esito.tolte === 0
      ? t("Nessun duplicato trovato: {} righe uniche", esito.restano)
      : t("Righe duplicate rimosse: {}. Righe uniche rimaste: {}", esito.tolte, esito.restano);
  }
  private async apriTestoInColonne(): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.preparaTestoInColonne !== "function") return;
    const p = await grid.preparaTestoInColonne();
    if ("errore" in p) { this.statusMessage = p.errore; return; }
    this.dialogoTestoColonne = { ...p, sovrascritte: 0 };
  }
  /** Prima di dividere controlla se si sostituiscono celle piene a destra: in quel caso la finestra chiede conferma. */
  private async eseguiTestoInColonne(opzioni: OpzioniDivisione, confermato: boolean): Promise<void> {
    const grid: any = this.getActiveGrid();
    const d = this.dialogoTestoColonne;
    if (!grid || !d) return;
    if (!confermato) {
      const n = await grid.celleSovrascritte(d.area, dividiRighe(d.testi, opzioni));
      if (n > 0) { this.dialogoTestoColonne = { ...d, sovrascritte: n }; return; }
    }
    this.dialogoTestoColonne = null;
    const esito = await grid.testoInColonne(d.area, opzioni);
    this.statusMessage = esito.righe === 0 ? t("Niente da dividere con questo separatore") : t("Testo diviso: {} righe in {} colonne", esito.righe, esito.colonne);
  }

  private getActiveGrid(): any {
    return this.renderRoot.querySelector("free-sheet-grid");
  }

  private handleStatusMessageFromGrid(e: CustomEvent<{ message?: string; statsMessage?: string }>) {
    if (e.detail.message) {
      this.statusMessage = e.detail.message;
    }
    if (e.detail.statsMessage !== undefined) {
      this.statsMessage = e.detail.statsMessage;
    }
  }

  /** Ripiego dalla finestra di segnalazione: la posta dell'utente con un messaggio già compilato. */
  private async apriPostaSegnalazione(testo: string): Promise<void> {
    const url = urlSegnalazione({ app: "pmb_sheets", versione: VERSIONE_APP, sistema: navigator.userAgent, testo, tr: t });
    let aperto = false;
    if ((window as any).__TAURI__?.core?.invoke || (window as any).__TAURI_INTERNALS__?.invoke) {
      aperto = (await invokeTauri<boolean>("open_url", { url })) === true;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
      aperto = true;
    }
    this.segnalaAperta = false;
    this.statusMessage = aperto ? avvisoSegnalazione(t) : t("Non è stato possibile aprire la posta. {}", avvisoSegnalazione(t));
  }

  /** Dopo un comando da menu o da barra il focus torna alla griglia, così le scorciatoie (Ctrl+Z, Ctrl+C...) funzionano subito senza dover cliccare una cella.
   *  Se il comando ha aperto una finestra, o una ricerca, il focus resta dov'è. */
  private riportaFocusAllaGriglia(): void {
    window.setTimeout(() => {
      const finestraAperta = Array.from(this.renderRoot.querySelectorAll("*")).some((x) => x.tagName.startsWith("FREE-DIALOGO"));
      if (finestraAperta) return;
      (this.getActiveGrid() as { focusGriglia?: () => void } | null)?.focusGriglia?.();
    }, 80);
  }

  private handleMenuAction(e: CustomEvent<{ action: string; label: string }>) {
    const { action, label } = e.detail;
    if (action !== "open-menu-search") this.riportaFocusAllaGriglia();

    // Formato › Stili di cella: lo stile si applica alle celle selezionate come formato (un passo di annulla)
    if (action.startsWith("cell-style-")) {
      const s = stileCella(action.slice("cell-style-".length));
      const grid: any = this.getActiveGrid();
      if (s && grid && typeof grid.applyFormat === "function") { grid.applyFormat(s.stile, t("Stile di cella «{}»", t(s.nome))); this.statusMessage = t("Stile di cella «{}»", t(s.nome)); }
      return;
    }

    switch (action) {
      case "undo": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.undo === "function") grid.undo();
        break;
      }
      case "redo": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.redo === "function") grid.redo();
        break;
      }
      case "cut": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.cut === "function") grid.cut();
        break;
      }
      case "copy": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.copy === "function") grid.copy();
        break;
      }
      case "paste": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.paste === "function") grid.paste();
        break;
      }
      case "set-theme-light":
        this.setTheme("light");
        break;
      case "set-theme-dark":
        this.setTheme("dark");
        break;
      case "set-theme-system":
        this.setTheme("system");
        break;
      case "toggle-sidebar":
        this.toggleSidebar();
        break;
      case "new-sheet":
        void this.nuovoFile();
        break;
      case "open-file":
        void this.apriFile();
        break;
      case "save-file":
        void this.salva(false);
        break;
      case "save-as-file":
        void this.salva(true);
        break;
      case "download-xlsx":
        void this.scaricaFile("xlsx");
        break;
      case "download-csv":
        void this.scaricaFile("csv");
        break;
      case "download-ods":
        void this.scaricaFile("ods");
        break;
      case "download-pdf":
        void this.scaricaFile("pdf");
        break;
      case "download-fsheet":
        void this.scaricaFile("fsheet");
        break;
      case "open-menu-search": {
        const searchModal = this.renderRoot.querySelector("free-menu-search") as any;
        if (searchModal) searchModal.openDialog();
        break;
      }
      case "zoom-50":
        this.zoom = 50;
        break;
      case "zoom-75":
        this.zoom = 75;
        break;
      case "zoom-100":
        this.zoom = 100;
        break;
      case "zoom-125":
        this.zoom = 125;
        break;
      case "zoom-150":
        this.zoom = 150;
        break;
      case "nascondi-menu":
        this.alternaMenuNascosti();
        break;
      case "toggle-fullscreen":
        this.applicaSchermoIntero(!this.schermoIntero);
        break;
      case "page-setup": {
        this.apriImpostaPagina();
        break;
      }
      case "print-preview": {
        void this.apriAnteprima();
        break;
      }
      case "print-area-set":
      case "print-area-clear":
      case "page-break-row":
      case "page-break-col":
      case "page-breaks-clear": {
        const grid: any = this.getActiveGrid();
        if (!grid || typeof grid.paginaAttiva !== "function") break;
        this.statusMessage = action === "print-area-set" ? grid.impostaAreaStampaDallaSelezione()
          : action === "print-area-clear" ? grid.cancellaAreaStampa()
          : action === "page-break-row" ? grid.alternaInterruzionePagina("riga")
          : action === "page-break-col" ? grid.alternaInterruzionePagina("colonna")
          : grid.togliInterruzioniPagina();
        break;
      }
      case "remove-duplicates": {
        void this.apriRimuoviDuplicati();
        break;
      }
      case "case-upper":
      case "case-lower":
      case "case-title":
      case "case-sentence":
      case "case-toggle": {
        const grid: any = this.getActiveGrid();
        const modo = ({ "case-upper": "maiuscolo", "case-lower": "minuscolo", "case-title": "iniziali", "case-sentence": "frase", "case-toggle": "inverti" } as Record<string, string>)[action];
        if (grid && typeof grid.cambiaMaiuscole === "function") void grid.cambiaMaiuscole(modo).then((m: string) => { this.statusMessage = m; });
        break;
      }
      case "read-aloud": {
        if (staLeggendo()) { fermaLettura(); this.statusMessage = t("Lettura fermata"); break; }
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.testiDaLeggere === "function") {
          void grid.testiDaLeggere().then((pezzi: string[]) => {
            const ok = leggiAdAltaVoce({ pezzi, lingua: linguaCorrente() === "en" ? "en-US" : "it-IT" });
            this.statusMessage = ok ? t("Lettura ad alta voce: Esc o di nuovo Strumenti › Leggi le celle ad alta voce per fermarla") : t("Non c'è niente da leggere, o Windows non ha una voce installata per questa lingua");
          });
        }
        break;
      }
      case "trace-precedents":
      case "trace-dependents": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.mostraTracce === "function") void grid.mostraTracce(action === "trace-precedents" ? "precedenti" : "dipendenti").then((m: string) => { this.statusMessage = m; });
        break;
      }
      case "group":
      case "ungroup":
      case "group-collapse":
      case "group-expand":
      case "outline-clear": {
        const grid: any = this.getActiveGrid();
        const metodo = ({ group: "raggruppaSelezione", ungroup: "separaSelezione", "group-collapse": "comprimiGruppo", "group-expand": "espandiGruppo", "outline-clear": "cancellaStruttura" } as Record<string, string>)[action];
        if (grid && typeof grid[metodo] === "function") this.statusMessage = grid[metodo]();
        break;
      }
      case "fill-series": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.propostaSerie === "function") void grid.propostaSerie().then((p: { direzione: "colonne" | "righe"; data: boolean }) => { this.dialogoSerie = { ...p, errore: "" }; });
        break;
      }
      case "file-password": {
        const doc = defaultDocumentStore.getDocument(this.getActiveTab().id);
        this.dialogoPasswordFile = { modo: "imposta", nome: this.titolo, errore: "", haPassword: !!doc?.passwordApertura };
        break;
      }
      case "evaluate-formula": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.passiValutazione === "function") void grid.passiValutazione().then((v: { cella: string; formula: string; passi: Array<{ testo: string; valore: string }> }) => { this.dialogoValuta = v; });
        break;
      }
      case "watch-window": {
        this.controlloAperto = !this.controlloAperto;
        if (this.controlloAperto) this.avviaControllo(); else this.fermaControllo();
        break;
      }
      case "trace-clear": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.togliTracce === "function") grid.togliTracce();
        break;
      }
      case "show-formulas": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.alternaMostraFormule === "function") grid.alternaMostraFormule();
        break;
      }
      case "subtotals": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.colonneTabellaSelezionata === "function") {
          void grid.colonneTabellaSelezionata().then((c: Array<{ col: number; nome: string }> | null) => {
            if (!c) { this.statusMessage = t("Seleziona la tabella, con l'intestazione nella prima riga"); return; }
            this.dialogoSubtotali = { colonne: c, errore: "" };
          });
        }
        break;
      }
      case "goal-seek": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.cellaAttiva === "function") this.dialogoObiettivo = { cella: grid.cellaAttiva(), errore: "" };
        break;
      }
      case "split-text": {
        void this.apriTestoInColonne();
        break;
      }
      case "named-ranges": {
        const grid: any = this.getActiveGrid();
        const doc = grid && typeof grid.getDoc === "function" ? grid.getDoc() : null;
        if (doc) this.dialogoNomi = { intervallo: scriviIntervallo(doc.selection.range), foglio: doc.activeSheetName };
        break;
      }
      case "insert-comment":
        this.apriCommento();
        break;
      case "open-custom-num-fmt":
        this.apriDialogoFormato();
        break;
      case "insert-link":
        this.apriDialogoLink();
        break;
      case "protect-sheet":
        void this.apriProtezione(false);
        break;
      case "protect-workbook":
        void this.apriProtezione(true);
        break;
      case "spelling": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.toggleOrtografia === "function") this.statusMessage = grid.toggleOrtografia();
        break;
      }
      case "insert-image":
        void this.inserisciImmagine();
        break;
      case "insert-qr":
        this.dialogoQr = true;
        break;
      case "insert-sparkline": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.inserisciMinigrafico === "function") void grid.inserisciMinigrafico().then((m: string) => { this.statusMessage = m; });
        break;
      }
      case "insert-table": {
        const grid: any = this.getActiveGrid();
        if (grid && typeof grid.insertTable === "function") this.statusMessage = grid.insertTable();
        break;
      }
      case "open-preferences":
        this.preferenzeAperte = true;
        break;
      case "personalizza-barra":
        this.personalizzaBarraAperto = true;
        break;
      case "exit-app":
        void this.richiediChiusuraApp();
        break;
      case "insert-row-above": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertRowsAbove === "function") grid.insertRowsAbove();
        break;
      }
      case "insert-row-below": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertRowsBelow === "function") grid.insertRowsBelow();
        break;
      }
      case "delete-row":
      case "delete-rows": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.deleteSelectedRows === "function") grid.deleteSelectedRows();
        break;
      }
      case "insert-col-left": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertColsLeft === "function") grid.insertColsLeft();
        break;
      }
      case "insert-col-right": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertColsRight === "function") grid.insertColsRight();
        break;
      }
      case "delete-col":
      case "delete-cols": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.deleteSelectedCols === "function") grid.deleteSelectedCols();
        break;
      }
      case "select-all": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.handleSelectAll === "function") grid.handleSelectAll();
        break;
      }
      case "insert-sheet": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.handleAddSheet === "function") void grid.handleAddSheet();
        break;
      }
      case "info-app": { this.informazioniAperte = "info"; break; }
      case "info-condizioni": { this.informazioniAperte = "condizioni"; break; }
      case "info-licenze": { this.informazioniAperte = "licenze"; break; }
      case "info-segnala": { this.segnalaAperta = true; break; }
      case "about-app": {
        this.statusMessage = t("pmb_sheets: fogli di lavoro per Windows, per uso locale");
        break;
      }
      case "show-shortcuts": {
        this.statusMessage = t("Scorciatoie: Ctrl+C copia, Ctrl+X taglia, Ctrl+V incolla, Ctrl+Z annulla, Ctrl+Y ripeti, Ctrl+F trova, Ctrl+S salva, Ctrl+P stampa");
        break;
      }
      case "filter-views": {
        this.apriVisteFiltro();
        break;
      }
      case "conditional-format":
      case "data-validation": {
        const grid = this.getActiveGrid();
        const doc = grid && typeof grid.getDoc === "function" ? grid.getDoc() : null;
        if (doc) this.dialogoRegole = {
          modo: action === "conditional-format" ? "condizionale" : "convalida", intervallo: scriviIntervallo(doc.selection.range), regole: copiaRegole(doc.conditionalFormats),
          convalide: typeof grid.elencoConvalide === "function" ? copiaRegole(grid.elencoConvalide()) : [],
        };
        break;
      }
      case "clear-validation": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.rimuoviConvalida === "function") grid.rimuoviConvalida();
        break;
      }
      case "clear-conditional-format": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.rimuoviCondizionali === "function") grid.rimuoviCondizionali();
        break;
      }
      case "print": {
        void this.stampa();
        break;
      }
      case "sort-asc":
      case "sort-desc":
      case "create-filter":
      case "clear-filter":
      case "merge-all":
      case "merge-horizontal":
      case "merge-vertical":
      case "unmerge":
      case "find-replace":
      case "cell-unlock":
      case "cell-lock":
      case "cell-hide-formula":
      case "cell-show-formula":
      case "insert-checkbox": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.handleFormatAction === "function") grid.handleFormatAction(action);
        break;
      }
      case "freeze-rows-0":
      case "freeze-rows-1":
      case "freeze-rows-2":
      case "freeze-cols-0":
      case "freeze-cols-1":
      case "freeze-cols-2": {
        // blocca righe e colonne indipendentemente: si cambia una sola misura e l'altra resta com'è
        const grid = this.getActiveGrid();
        const doc = defaultDocumentStore.getDocument(DOC_ID);
        const n = Number(action.slice(-1));
        const righe = action.startsWith("freeze-rows") ? n : doc?.freezeRows ?? 0;
        const colonne = action.startsWith("freeze-cols") ? n : doc?.freezeCols ?? 0;
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(righe, colonne);
        break;
      }
      case "freeze-to-row":
      case "freeze-to-col":
      case "freeze-to-cell": {
        // blocca tutto quello che sta sopra e a sinistra della cella attiva, compresa la sua riga e la sua colonna
        const grid = this.getActiveGrid();
        const doc = defaultDocumentStore.getDocument(DOC_ID);
        if (grid && doc && typeof grid.setFreezePanes === "function") {
          const a = doc.selection.anchor;
          const righe = action === "freeze-to-col" ? doc.freezeRows ?? 0 : a.row;
          const colonne = action === "freeze-to-row" ? doc.freezeCols ?? 0 : a.col;
          grid.setFreezePanes(righe, colonne);
        }
        break;
      }
      case "paste-special-values": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.pasteSpecial === "function") grid.pasteSpecial("values_only");
        break;
      }
      case "paste-special-format": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.pasteSpecial === "function") grid.pasteSpecial("format_only");
        break;
      }
      case "paste-special-formulas": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.pasteSpecial === "function") grid.pasteSpecial("formulas_only");
        break;
      }
      case "paste-special-transposed": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.pasteSpecial === "function") grid.pasteSpecial("transposed");
        break;
      }
      case "freeze-none": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(0, 0);
        break;
      }
      case "freeze-1-row": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(1, 0);
        break;
      }
      case "freeze-2-rows": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(2, 0);
        break;
      }
      case "freeze-1-col": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(0, 1);
        break;
      }
      case "freeze-2-cols": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.setFreezePanes === "function") grid.setFreezePanes(0, 2);
        break;
      }
      case "insert-chart": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertChart === "function") {
          grid.insertChart("column").then((cfg: any) => {
            this.activeChartConfig = cfg;
            this.sidebarTab = "chart";
            this.sidebarOpen = true;
          });
        }
        break;
      }
      case "insert-pivot": {
        const grid = this.getActiveGrid();
        if (grid && typeof grid.insertPivotTable === "function") {
          grid.insertPivotTable().then((cfg: any) => {
            this.activePivotConfig = cfg;
            this.sidebarTab = "pivot";
            this.sidebarOpen = true;
          });
        }
        break;
      }
      default: {
        const grid = this.getActiveGrid();
        if (
          grid &&
          (action.startsWith("format-") ||
            action.startsWith("set-num-fmt-") ||
            action.startsWith("align-") ||
            action === "clear-formatting")
        ) {
          grid.handleFormatAction(action);
        } else {
          this.statusMessage = t("Funzione non ancora disponibile: {}", label);
        }
        break;
      }
    }
  }

  /** Inserisci > Commento (Ctrl+Alt+M): apre la finestra del commento sulla cella attiva. */
  private apriCommento(): void {
    const grid: any = this.getActiveGrid();
    if (grid && typeof grid.getActiveCellComment === "function") this.dialogoCommento = grid.getActiveCellComment();
  }

  /** Inserisci > Immagine: sceglie un file PNG, JPEG, GIF o WebP e lo mette sopra il foglio. Il tipo si riconosce dai byte, non dall'estensione. */
  private async inserisciImmagine(): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.insertImage !== "function") return;
    try {
      const file = await scegliFile(".png,.jpg,.jpeg,.gif,.webp");
      if (!file) return;
      if (file.size > LIMITE_BYTE_IMMAGINE) { this.statusMessage = t("Immagine troppo grande: {} MB (massimo 1,5 MB)", (file.size / 1_000_000).toFixed(1)); return; }
      const byte = new Uint8Array(await file.arrayBuffer());
      const tipo = rilevaTipoImmagine(byte);
      if (!tipo) { this.statusMessage = t("Il file non è un'immagine PNG, JPEG, GIF o WebP"); return; }
      const dataUrl = dataUrlDaByte(byte, tipo);
      const misure = await new Promise<{ w: number; h: number } | null>((risolvi) => {
        const img = new Image();
        img.onload = () => risolvi({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => risolvi(null);
        img.src = dataUrl;
      });
      if (!misure) { this.statusMessage = t("L'immagine è rovinata e non si riesce a leggere"); return; }
      this.statusMessage = grid.insertImage(dataUrl, file.name, misure.w, misure.h);
    } catch (err) {
      this.statusMessage = t("Impossibile inserire l'immagine: {}", err instanceof Error ? err.message : String(err));
    }
  }

  /** Formato > Numero > Altri formati: apre la finestra del formato personalizzato sulla cella attiva. */
  private apriDialogoFormato(): void {
    const grid: any = this.getActiveGrid();
    if (grid && typeof grid.getActiveCellFormat === "function") this.dialogoFormato = grid.getActiveCellFormat();
  }

  private applicaFormatoPersonalizzato(codice: string): void {
    const grid: any = this.getActiveGrid();
    this.dialogoFormato = null;
    if (!grid) return;
    grid.handleFormatAction("set-num-fmt-custom", codice);
    this.statusMessage = codice === "" ? t("Formato numerico: Automatico") : t("Formato numerico: {}", codice);
  }

  /** Strumenti › Proteggi foglio / la struttura: se non è protetto si apre la finestra per proteggerlo; se lo è, si toglie la protezione
   *  (con la finestra della password, se ne ha una). */
  private async apriProtezione(cartella: boolean): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.statoProtezione !== "function") return;
    const s = grid.statoProtezione();
    const protetto = cartella ? s.cartella : s.foglio;
    const conPassword = cartella ? s.cartellaConPassword : s.foglioConPassword;
    if (protetto && !conPassword) {
      await (cartella ? grid.togliProtezioneCartella("") : grid.togliProtezioneFoglio(""));
      this.statusMessage = cartella ? t("Struttura della cartella non più protetta") : t("Foglio «{}» non più protetto", s.nome);
      return;
    }
    this.dialogoProtezione = { modo: `${protetto ? "togli" : "proteggi"}-${cartella ? "cartella" : "foglio"}` as ModoProtezione, foglio: s.nome, errore: "" };
  }

  private async confermaProtezione(password: string): Promise<void> {
    const d = this.dialogoProtezione;
    const grid: any = this.getActiveGrid();
    if (!d || !grid) return;
    const cartella = d.modo.endsWith("cartella");
    if (d.modo.startsWith("proteggi")) {
      await (cartella ? grid.proteggiCartella(password) : grid.proteggiFoglio(password));
      this.dialogoProtezione = null;
      this.statusMessage = cartella ? t("Struttura della cartella protetta") : t("Foglio «{}» protetto", d.foglio);
      this.riportaFocusAllaGriglia();
      return;
    }
    const ok = await (cartella ? grid.togliProtezioneCartella(password) : grid.togliProtezioneFoglio(password));
    if (!ok) {
      this.dialogoProtezione = { ...d, errore: t("La password non è giusta") };
      (this.renderRoot.querySelector("free-dialogo-protezione") as { libera?: () => void } | null)?.libera?.();
      return;
    }
    this.dialogoProtezione = null;
    this.statusMessage = cartella ? t("Struttura della cartella non più protetta") : t("Foglio «{}» non più protetto", d.foglio);
    this.riportaFocusAllaGriglia();
  }

  private async applicaSubtotali(d: { gruppo: number; funzione: number; colonne: number[] }): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || !this.dialogoSubtotali) return;
    if (d.colonne.length === 0) { this.dialogoSubtotali = { ...this.dialogoSubtotali, errore: t("Scegli almeno una colonna a cui aggiungere il subtotale") }; return; }
    this.dialogoSubtotali = null;
    this.statusMessage = await grid.subtotali(d.gruppo, d.colonne, d.funzione);
    this.riportaFocusAllaGriglia();
  }

  // ---- Finestra controllo: i valori si rileggono ogni secondo finché è aperta ----
  private avviaControllo(): void {
    this.fermaControllo();
    const aggiorna = async (): Promise<void> => {
      const grid: any = this.getActiveGrid();
      if (grid && typeof grid.valoriOsservati === "function") this.celleControllo = await grid.valoriOsservati(this.osservate);
    };
    void aggiorna();
    this.timerControllo = window.setInterval(() => { void aggiorna(); }, 1000);
  }
  private fermaControllo(): void {
    if (this.timerControllo !== undefined) { window.clearInterval(this.timerControllo); this.timerControllo = undefined; }
  }
  private aggiungiOsservata(): void {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.cellaAttivaConFoglio !== "function") return;
    const c = grid.cellaAttivaConFoglio();
    if (!this.osservate.some((x) => x.foglio === c.foglio && x.riga === c.riga && x.colonna === c.colonna) && this.osservate.length < 100) this.osservate = [...this.osservate, c];
    this.avviaControllo();
  }

  private async cercaObiettivo(d: { obiettivo: string; valore: string; variabile: string }): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid || !this.dialogoObiettivo) return;
    const r = await grid.ricercaObiettivo(d.obiettivo, d.valore, d.variabile);
    if (r.ok) { this.dialogoObiettivo = null; this.statusMessage = r.messaggio; this.riportaFocusAllaGriglia(); return; }
    this.dialogoObiettivo = { ...this.dialogoObiettivo, errore: r.messaggio };
    (this.renderRoot.querySelector("free-dialogo-obiettivo") as { libera?: () => void } | null)?.libera?.();
  }

  /** Inserisci > Link (Ctrl+K): apre la finestra del link sulla cella attiva. */
  private apriDialogoLink(): void {
    const grid: any = this.getActiveGrid();
    if (grid && typeof grid.getActiveCellLink === "function") this.dialogoLink = grid.getActiveCellLink();
  }

  private async salvaLink(url: string, testo: string): Promise<void> {
    const d = this.dialogoLink;
    const grid: any = this.getActiveGrid();
    this.dialogoLink = null;
    if (!d || !grid) return;
    await grid.setLink(d.riga, d.colonna, url, testo);
    this.statusMessage = t("Link di {} salvato", d.cella);
  }

  private async rimuoviLink(): Promise<void> {
    const d = this.dialogoLink;
    const grid: any = this.getActiveGrid();
    this.dialogoLink = null;
    if (!d || !grid) return;
    await grid.setLink(d.riga, d.colonna, undefined);
    this.statusMessage = t("Link di {} rimosso", d.cella);
  }

  /** Apre un link della cella nel programma predefinito del sistema (solo http, https e mailto: lo controlla anche la shell). */
  private async apriLinkCella(url: string): Promise<void> {
    if (!urlAmmesso(url)) { this.statusMessage = t("Indirizzo non ammesso"); return; }
    let aperto = false;
    if ((window as any).__TAURI__?.core?.invoke || (window as any).__TAURI_INTERNALS__?.invoke) {
      aperto = (await invokeTauri<boolean>("open_url", { url })) === true;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
      aperto = true;
    }
    this.statusMessage = aperto ? t("Aperto {}", url) : t("Non è stato possibile aprire il link");
  }

  private salvaCommento(testo: string): void {
    const d = this.dialogoCommento;
    const grid: any = this.getActiveGrid();
    this.dialogoCommento = null;
    if (!d || !grid) return;
    const cambiato = grid.setComment(d.riga, d.colonna, testo);
    if (cambiato) this.statusMessage = testo.trim() === "" ? t("Commento di {} eliminato", d.cella) : t("Commento di {} salvato", d.cella);
  }

  /** Dalla finestra degli intervalli denominati: aggiunge il nome e aggiorna la finestra. */
  private async aggiungiNome(nome: NamedRange): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid) return;
    await grid.addNamedRange(nome);
    this.statusMessage = t("Intervallo denominato \"{}\" aggiunto", nome.name);
    this.requestUpdate();
  }

  private async eliminaNome(nome: string): Promise<void> {
    const grid: any = this.getActiveGrid();
    if (!grid) return;
    await grid.removeNamedRange(nome);
    this.statusMessage = t("Intervallo denominato \"{}\" eliminato", nome);
    this.requestUpdate();
  }

  private apriVisteFiltro(errore = "") {
    const grid: any = this.getActiveGrid();
    if (!grid || typeof grid.visteFiltro !== "function") return;
    const doc = grid.getDoc();
    this.dialogoViste = { viste: JSON.parse(JSON.stringify(grid.visteFiltro())), filtriAttivi: !!doc.isFilterActive && doc.activeFilters.size > 0, errore };
  }

  private gestisciVista(azione: "salva" | "applica" | "elimina", d: { nome?: string; id?: string }) {
    const grid: any = this.getActiveGrid();
    if (!grid) return;
    if (azione === "salva") {
      const errore = grid.salvaVistaFiltro(d.nome ?? "");
      if (!errore) this.statusMessage = t("Vista filtro \"{}\" salvata", (d.nome ?? "").trim());
      this.apriVisteFiltro(errore ?? "");
    } else if (azione === "applica") {
      const v = grid.visteFiltro().find((x: { id: string }) => x.id === d.id);
      if (grid.applicaVistaFiltro(d.id)) this.statusMessage = t("Vista filtro \"{}\" applicata", v?.nome ?? "");
      this.dialogoViste = null;
      this.riportaFocusAllaGriglia();
    } else {
      grid.eliminaVistaFiltro(d.id);
      this.statusMessage = t("Vista filtro eliminata");
      this.apriVisteFiltro();
    }
  }

  /** Dall'elenco della finestra: sposta o elimina una regola e aggiorna l'elenco mostrato; la finestra resta aperta. */
  private gestisciRegola(d: { azione: "su" | "giu" | "elimina"; indice: number }) {
    const grid: any = this.getActiveGrid();
    if (!grid || !this.dialogoRegole) return;
    if (d.azione === "elimina") grid.eliminaRegolaCondizionale(d.indice);
    else grid.spostaRegolaCondizionale(d.indice, d.azione === "su" ? -1 : 1);
    this.statusMessage = d.azione === "elimina" ? t("Regola di formattazione condizionale eliminata") : t("Priorità della regola cambiata");
    this.dialogoRegole = { ...this.dialogoRegole, regole: copiaRegole(grid.getDoc().conditionalFormats) };
  }

  /** Dall'elenco delle convalide: elimina la regola da tutte le sue celle e aggiorna l'elenco; la finestra resta aperta. */
  private gestisciConvalida(d: { azione: "elimina"; firma: string }) {
    const grid: any = this.getActiveGrid();
    if (!grid || !this.dialogoRegole) return;
    grid.eliminaConvalida(d.firma);
    this.statusMessage = t("Convalida dei dati eliminata");
    this.dialogoRegole = { ...this.dialogoRegole, convalide: copiaRegole(grid.elencoConvalide()) };
  }

  private applicaRegola(d: { modo: string; regola?: any; sostituisce?: number | string; convalida?: { intervallo: { startRow: number; endRow: number; startCol: number; endCol: number }; aree?: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }>; regola: any } }) {
    const grid: any = this.getActiveGrid();
    if (grid) {
      if (d.modo === "condizionale" && d.regola && typeof d.sostituisce === "number") {
        grid.sostituisciRegolaCondizionale(d.sostituisce, d.regola);
        this.statusMessage = t("Regola di formattazione condizionale modificata");
      } else if (d.modo === "condizionale" && d.regola) {
        grid.addConditionalFormatRule(d.regola);
        this.statusMessage = t("Regola di formattazione condizionale aggiunta");
      } else if (d.modo === "convalida" && d.convalida) {
        const aree = d.convalida.aree ?? [d.convalida.intervallo];
        grid.sostituisciConvalida(typeof d.sostituisce === "string" ? d.sostituisce : null, aree, d.convalida.regola);
        const n = aree.reduce((t, i) => t + (i.endRow - i.startRow + 1) * (i.endCol - i.startCol + 1), 0);
        this.statusMessage = typeof d.sostituisce === "string" ? t("Convalida modificata: {} {}", n, n === 1 ? "cella" : "celle") : t("Convalida applicata a {} celle", n);
      }
    }
    this.dialogoRegole = null;
  }

  private handleToolbarAction(e: CustomEvent<{ action: string; label: string; value?: string }>) {
    const { action, label, value } = e.detail;
    if (!action.includes("color")) this.riportaFocusAllaGriglia(); // i selettori di colore si aprono e vogliono il focus

    if (action === "undo") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.undo === "function") grid.undo();
    } else if (action === "redo") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.redo === "function") grid.redo();
    } else if (action === "cut") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.cut === "function") grid.cut();
    } else if (action === "copy") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.copy === "function") grid.copy();
    } else if (action === "paste") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.paste === "function") grid.paste();
    } else if (action === "format-painter") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.toggleFormatPainter === "function") grid.toggleFormatPainter();
    } else if (action === "insert-chart") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.insertChart === "function") {
        grid.insertChart("column").then((cfg: any) => {
          this.activeChartConfig = cfg;
          this.sidebarTab = "chart";
          this.sidebarOpen = true;
        });
      }
    } else if (action === "insert-pivot") {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.insertPivotTable === "function") {
        grid.insertPivotTable().then((cfg: any) => {
          this.activePivotConfig = cfg;
          this.sidebarTab = "pivot";
          this.sidebarOpen = true;
        });
      }
    } else if (action === "print") {
      void this.stampa();
    } else if (AZIONI_GRIGLIA.has(action)) {
      const grid = this.getActiveGrid();
      if (grid && typeof grid.handleFormatAction === "function") grid.handleFormatAction(action);
    } else if (action === "change-zoom" && value) {
      this.zoom = parseInt(value, 10) || 100;
      this.statusMessage = t("Zoom impostato al {}%", this.zoom);
    } else {
      const grid = this.getActiveGrid();
      if (
        grid &&
        (action.startsWith("format-") ||
          action.startsWith("change-") ||
          action.startsWith("align-") ||
          action.startsWith("set-num-fmt-") ||
          action === "increase-decimals" ||
          action === "decrease-decimals" ||
          action === "clear-formatting")
      ) {
        grid.handleFormatAction(action, value);
      } else {
        this.statusMessage = t("Azione strumento: {}", label);
      }
    }
  }

  render() {
    const activeTab = this.getActiveTab();

    return html`
      <!-- Contenitore radice applicazione -->
      <div class="app-theme-wrapper" data-current-theme=${this.currentTheme}>
        <!-- Barra del titolo custom (con «Nascondi i menu» restano solo la barra degli strumenti e il foglio, come in pmb_docs) -->
        ${this.menuNascosti ? "" : html`<free-titlebar
          .docTitle=${activeTab.title}
          .salvatoSuDisco=${!!this.origini.get(DOC_ID)?.maniglia}
          .nomeFileDisco=${this.origini.get(DOC_ID)?.nome ?? ""}
          @title-changed=${this.handleTitleChanged}
          @richiedi-salvataggio=${() => { void this.salva(true); }}
          @window-minimize=${() => invokeTauri("minimize_window")}
          @window-maximize=${() => invokeTauri("maximize_window")}
          @window-close=${() => { void this.richiediChiusuraApp(); }}
        ></free-titlebar>`}

        <!-- Barra dei menu -->
        ${this.menuNascosti ? "" : html`<free-menubar
          @menu-action=${this.handleMenuAction}
        ></free-menubar>`}

        <!-- Barra degli strumenti -->
        <free-toolbar
          .activeFormat=${this.activeCellFormat}
          .barra=${this.barraPersonalizzata}
          .menuNascosti=${this.menuNascosti}
          @nascondi-menu=${() => this.alternaMenuNascosti()}
          @menu-action=${this.handleMenuAction}
          @toolbar-action=${this.handleToolbarAction}
          @personalizza-barra=${() => { this.personalizzaBarraAperto = true; }}
          @barra-cambiata=${(e: CustomEvent<{ barra: string[] }>) => {
            this.barraPersonalizzata = e.detail.barra;
            try { localStorage.setItem("pmb_sheets.barra_personalizzata", JSON.stringify(this.barraPersonalizzata)); } catch {}
          }}
        ></free-toolbar>

        <!-- Barra delle schede dei fogli -->
        <free-tabs
          .tabs=${this.fogli.map((nome) => ({ id: nome, title: nome, colore: this.coloriSchede[nome] }))}
          .activeTabId=${this.foglioAttivo}
          @tab-selected=${this.handleTabSelected}
          @tab-closed=${this.handleTabClosed}
          @tab-created=${this.handleTabCreated}
          @tab-rename=${this.handleTabRename}
          @tab-menu=${this.handleTabMenu}
          @tab-moved=${this.handleTabMoved}
        ></free-tabs>

        <!-- Area di lavoro centrale: mantiene gli elementi vivi per ogni scheda -->
        <div class="main-workspace">
          <div class="content-area">
            <free-sheet-grid
              data-tab-id=${DOC_ID}
              .tabId=${DOC_ID}
              .zoom=${this.zoom}
              @comments-changed=${() => this.requestUpdate()}
              @apri-link=${(e: CustomEvent<{ url: string }>) => void this.apriLinkCella(e.detail.url)}
              @chiedi-link=${() => this.apriDialogoLink()}
              @chiedi-formato-numero=${() => this.apriDialogoFormato()}
              @sheets-changed=${this.handleSheetsChanged}
              @status-message=${this.handleStatusMessageFromGrid}
              @active-format-changed=${(e: CustomEvent<{ format: CellStyle }>) => { this.activeCellFormat = e.detail.format; }}
              @chart-edit-requested=${(e: CustomEvent) => {
                this.activeChartConfig = e.detail;
                this.sidebarTab = "chart";
                this.sidebarOpen = true;
              }}
              @pivot-created=${(e: CustomEvent) => {
                this.activePivotConfig = e.detail;
                this.sidebarTab = "pivot";
                this.sidebarOpen = true;
              }}
            ></free-sheet-grid>
          </div>

          <!-- Pannello laterale a scomparsa -->
          ${this.sidebarOpen
            ? html`<free-sidebar
                .open=${this.sidebarOpen}
                .activeTab=${this.sidebarTab}
                .chartConfig=${this.activeChartConfig}
                .pivotConfig=${this.activePivotConfig}
                .commenti=${(() => { const d = defaultDocumentStore.getDocument(DOC_ID); return d ? elencaCommenti(d.comments, d.activeSheetName) : []; })()}
                @vai-a-cella=${(e: CustomEvent<{ riga: number; colonna: number }>) => { const g: any = this.getActiveGrid(); if (g) g.goToCell(e.detail.riga, e.detail.colonna); }}
                @sidebar-close=${this.toggleSidebar}
                @chart-apply=${(e: CustomEvent) => {
                  const grid = this.getActiveGrid();
                  if (grid && typeof (grid as any).handleChartChange === "function") {
                    (grid as any).handleChartChange(e.detail);
                  }
                }}
                @pivot-apply=${(e: CustomEvent) => {
                  const grid = this.getActiveGrid();
                  if (grid && typeof (grid as any).computeAndRenderPivot === "function") {
                    (grid as any).computeAndRenderPivot(e.detail);
                  }
                }}
              ></free-sidebar>`
            : ""}
        </div>

        ${this.segnalaAperta
          ? html`<free-dialogo-segnala @chiudi-dialogo=${() => { this.segnalaAperta = false; this.riportaFocusAllaGriglia(); }} @inviato=${() => { this.segnalaAperta = false; this.statusMessage = t("Grazie! Il messaggio è stato inviato."); }} @posta=${(e: CustomEvent<{ testo: string }>) => { void this.apriPostaSegnalazione(e.detail.testo); }}></free-dialogo-segnala>`
          : ""}

        ${this.informazioniAperte !== null
          ? html`<free-dialogo-informazioni .pagina=${this.informazioniAperte} @chiudi-dialogo=${() => { this.informazioniAperte = null; this.riportaFocusAllaGriglia(); }}></free-dialogo-informazioni>`
          : ""}

        ${this.dialogoFormato
          ? html`<free-dialogo-formato
              .codice=${this.dialogoFormato.codice}
              .valore=${this.dialogoFormato.valore}
              @chiudi-dialogo=${() => { this.dialogoFormato = null; this.riportaFocusAllaGriglia(); }}
              @salva-formato=${(e: CustomEvent<{ codice: string }>) => this.applicaFormatoPersonalizzato(e.detail.codice)}
            ></free-dialogo-formato>`
          : ""}

        ${this.dialogoValuta
          ? html`<free-dialogo-valuta .cella=${this.dialogoValuta.cella} .formula=${this.dialogoValuta.formula} .passi=${this.dialogoValuta.passi}
              @chiudi-dialogo=${() => { this.dialogoValuta = null; this.riportaFocusAllaGriglia(); }}></free-dialogo-valuta>`
          : ""}

        ${this.controlloAperto
          ? html`<free-pannello-controllo .celle=${this.celleControllo}
              @aggiungi-osservata=${() => this.aggiungiOsservata()}
              @togli-osservata=${(e: CustomEvent<{ indice: number }>) => { this.osservate = this.osservate.filter((_, i) => i !== e.detail.indice); this.avviaControllo(); }}
              @chiudi-controllo=${() => { this.controlloAperto = false; this.fermaControllo(); this.riportaFocusAllaGriglia(); }}></free-pannello-controllo>`
          : ""}

        ${this.dialogoSerie
          ? html`<free-dialogo-serie .direzione=${this.dialogoSerie.direzione} .data=${this.dialogoSerie.data} .errore=${this.dialogoSerie.errore}
              @applica-serie=${(e: CustomEvent<{ direzione: "colonne" | "righe"; tipo: string; unita: string; passo: string; limite: string }>) => void this.applicaSerie(e.detail)}
              @chiudi-dialogo=${() => { this.dialogoSerie = null; this.riportaFocusAllaGriglia(); }}></free-dialogo-serie>`
          : ""}

        ${this.dialogoPasswordFile
          ? html`<free-dialogo-password-file .modo=${this.dialogoPasswordFile.modo} .nome=${this.dialogoPasswordFile.nome} .errore=${this.dialogoPasswordFile.errore}
              .haPassword=${!!this.dialogoPasswordFile.haPassword}
              @conferma-password-file=${(e: CustomEvent<{ password: string }>) => void this.confermaPasswordFile(e.detail.password)}
              @chiudi-dialogo=${() => { const apri = this.dialogoPasswordFile?.modo === "apri"; const nome = this.dialogoPasswordFile?.nome ?? ""; this.dialogoPasswordFile = null; if (apri) this.statusMessage = t("«{}» non aperto: serve la password", nome); this.riportaFocusAllaGriglia(); }}></free-dialogo-password-file>`
          : ""}

        ${this.dialogoQr
          ? html`<free-dialogo-qr
              @chiudi-dialogo=${() => { this.dialogoQr = false; this.riportaFocusAllaGriglia(); }}
              @inserisci-qr=${(e: CustomEvent<{ s: string; w: number; h: number }>) => { this.dialogoQr = false; const grid: any = this.getActiveGrid(); if (grid && typeof grid.insertImage === "function") this.statusMessage = grid.insertImage(e.detail.s, "codice-qr.png", e.detail.w, e.detail.h); this.riportaFocusAllaGriglia(); }}
            ></free-dialogo-qr>`
          : ""}

        ${this.dialogoSubtotali
          ? html`<free-dialogo-subtotali
              .colonne=${this.dialogoSubtotali.colonne}
              .errore=${this.dialogoSubtotali.errore}
              @chiudi-dialogo=${() => { this.dialogoSubtotali = null; this.riportaFocusAllaGriglia(); }}
              @applica-subtotali=${(e: CustomEvent<{ gruppo: number; funzione: number; colonne: number[] }>) => void this.applicaSubtotali(e.detail)}
            ></free-dialogo-subtotali>`
          : ""}

        ${this.dialogoObiettivo
          ? html`<free-dialogo-obiettivo
              .cella=${this.dialogoObiettivo.cella}
              .errore=${this.dialogoObiettivo.errore}
              @chiudi-dialogo=${() => { this.dialogoObiettivo = null; this.riportaFocusAllaGriglia(); }}
              @cerca-obiettivo=${(e: CustomEvent<{ obiettivo: string; valore: string; variabile: string }>) => void this.cercaObiettivo(e.detail)}
            ></free-dialogo-obiettivo>`
          : ""}

        ${this.dialogoProtezione
          ? html`<free-dialogo-protezione
              .modo=${this.dialogoProtezione.modo}
              .foglio=${this.dialogoProtezione.foglio}
              .errore=${this.dialogoProtezione.errore}
              @chiudi-dialogo=${() => { this.dialogoProtezione = null; this.riportaFocusAllaGriglia(); }}
              @conferma-protezione=${(e: CustomEvent<{ password: string }>) => void this.confermaProtezione(e.detail.password)}
            ></free-dialogo-protezione>`
          : ""}

        ${this.dialogoLink
          ? html`<free-dialogo-link
              .cella=${this.dialogoLink.cella}
              .url=${this.dialogoLink.url}
              .testo=${this.dialogoLink.testo}
              @chiudi-dialogo=${() => { this.dialogoLink = null; this.riportaFocusAllaGriglia(); }}
              @salva-link=${(e: CustomEvent<{ url: string; testo: string }>) => void this.salvaLink(e.detail.url, e.detail.testo)}
              @rimuovi-link=${() => void this.rimuoviLink()}
            ></free-dialogo-link>`
          : ""}

        ${this.dialogoCommento
          ? html`<free-dialogo-commento
              .cella=${this.dialogoCommento.cella}
              .testo=${this.dialogoCommento.testo}
              .data=${this.dialogoCommento.data}
              @chiudi-dialogo=${() => { this.dialogoCommento = null; this.riportaFocusAllaGriglia(); }}
              @salva-commento=${(e: CustomEvent<{ testo: string }>) => this.salvaCommento(e.detail.testo)}
            ></free-dialogo-commento>`
          : ""}

        ${this.dialogoPagina
          ? html`<free-dialogo-imposta-pagina
              .pagina=${this.dialogoPagina.pagina}
              .foglio=${this.dialogoPagina.foglio}
              .selezione=${this.dialogoPagina.selezione}
              @chiudi-dialogo=${() => { this.dialogoPagina = null; this.riportaFocusAllaGriglia(); }}
              @applica-pagina=${(e: CustomEvent) => this.applicaImpostaPagina(e.detail.pagina, false)}
              @anteprima-pagina=${(e: CustomEvent) => this.applicaImpostaPagina(e.detail.pagina, true)}
            ></free-dialogo-imposta-pagina>`
          : ""}
        ${this.anteprima
          ? html`<div class="anteprima" role="dialog" aria-modal="true" aria-labelledby="titolo-anteprima" @keydown=${(e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); this.chiudiAnteprima(); } }}>
              <div class="anteprima-barra">
                <h2 id="titolo-anteprima">${t("Anteprima di stampa")}</h2>
                <span data-campo="conta-pagine">${this.anteprima.pagine.length === 1 ? t("1 pagina") : t("{} pagine", this.anteprima.pagine.length)} · ${t("scala {}%", Math.round(this.anteprima.scala * 100))}</span>
                <span class="spazio"></span>
                <button data-azione="imposta" @click=${() => this.apriImpostaPagina()}>${t("Imposta pagina...")}</button>
                <button data-azione="stampa" class="primario" @click=${() => { this.chiudiAnteprima(); void this.stampa(); }}>${t("Stampa")}</button>
                <button data-azione="chiudi" @click=${() => this.chiudiAnteprima()}>${t("Chiudi")}</button>
              </div>
              <div class="anteprima-pagine">${this.anteprima.pagine.map((pg) => this.paginaStampa(this.anteprima!, pg))}</div>
            </div>`
          : ""}
        ${this.dialogoDuplicati
          ? html`<free-dialogo-duplicati
              .area=${scriviIntervallo(this.dialogoDuplicati.area)}
              .primaColonna=${this.dialogoDuplicati.area.startCol}
              .intestazioni=${this.dialogoDuplicati.intestazioni}
              @chiudi-dialogo=${() => { this.dialogoDuplicati = null; this.riportaFocusAllaGriglia(); }}
              @rimuovi-duplicati=${(e: CustomEvent) => { void this.eseguiRimuoviDuplicati(e.detail.colonne, e.detail.conIntestazione); }}
            ></free-dialogo-duplicati>`
          : ""}
        ${this.dialogoTestoColonne
          ? html`<free-dialogo-testo-colonne
              .area=${scriviIntervallo(this.dialogoTestoColonne.area)}
              .testi=${this.dialogoTestoColonne.testi}
              .sovrascritte=${this.dialogoTestoColonne.sovrascritte}
              @chiudi-dialogo=${() => { this.dialogoTestoColonne = null; this.riportaFocusAllaGriglia(); }}
              @dividi-testo=${(e: CustomEvent) => { void this.eseguiTestoInColonne(e.detail.opzioni, e.detail.confermato); }}
            ></free-dialogo-testo-colonne>`
          : ""}
        ${this.dialogoNomi
          ? html`<free-dialogo-nomi
              .nomi=${defaultDocumentStore.getDocument(DOC_ID)?.namedRanges.getAll() ?? []}
              .intervallo=${this.dialogoNomi.intervallo}
              .foglio=${this.dialogoNomi.foglio}
              @chiudi-dialogo=${() => { this.dialogoNomi = null; this.riportaFocusAllaGriglia(); }}
              @aggiungi-nome=${(e: CustomEvent) => { void this.aggiungiNome(e.detail.nome); }}
              @elimina-nome=${(e: CustomEvent) => { void this.eliminaNome(e.detail.nome); }}
            ></free-dialogo-nomi>`
          : ""}

        ${this.preferenzeAperte
          ? html`<free-dialogo-preferenze
              .tema=${this.currentTheme}
              .lingua=${this.linguaScelta}
              @scegli-lingua=${(e: CustomEvent<{ lingua: ScelteLingua }>) => { void this.applicaLingua(e.detail.lingua); }}
              @chiudi-dialogo=${() => { this.preferenzeAperte = false; this.riportaFocusAllaGriglia(); }}
              @scegli-tema=${(e: CustomEvent<{ tema: "light" | "dark" | "system" }>) => { void this.setTheme(e.detail.tema); }}
            ></free-dialogo-preferenze>`
          : ""}

        ${this.personalizzaBarraAperto
          ? html`<free-dialogo-personalizza-barra
              .barra=${this.barraPersonalizzata ?? barraPredefinita()}
              @chiudi-dialogo=${() => { this.personalizzaBarraAperto = false; this.riportaFocusAllaGriglia(); }}
              @barra-cambiata=${(e: CustomEvent<{ barra: string[] }>) => {
                this.barraPersonalizzata = e.detail.barra;
                try { localStorage.setItem("pmb_sheets.barra_personalizzata", JSON.stringify(this.barraPersonalizzata)); } catch {}
              }}
            ></free-dialogo-personalizza-barra>`
          : ""}

        ${this.dialogoViste
          ? html`<free-dialogo-viste-filtro
              .viste=${this.dialogoViste.viste}
              .filtriAttivi=${this.dialogoViste.filtriAttivi}
              .errore=${this.dialogoViste.errore}
              @chiudi-dialogo=${() => { this.dialogoViste = null; this.riportaFocusAllaGriglia(); }}
              @salva-vista=${(e: CustomEvent<{ nome: string }>) => this.gestisciVista("salva", e.detail)}
              @applica-vista=${(e: CustomEvent<{ id: string }>) => this.gestisciVista("applica", e.detail)}
              @elimina-vista=${(e: CustomEvent<{ id: string }>) => this.gestisciVista("elimina", e.detail)}
            ></free-dialogo-viste-filtro>`
          : ""}

        ${this.dialogoRegole
          ? html`<free-dialogo-regole
              .modo=${this.dialogoRegole.modo}
              .intervallo=${this.dialogoRegole.intervallo}
              .regole=${this.dialogoRegole.regole ?? []}
              .convalide=${this.dialogoRegole.convalide ?? []}
              @gestisci-convalida=${(e: CustomEvent<{ azione: "elimina"; firma: string }>) => this.gestisciConvalida(e.detail)}
              @gestisci-regola=${(e: CustomEvent) => this.gestisciRegola(e.detail)}
              @chiudi-dialogo=${() => { this.dialogoRegole = null; this.riportaFocusAllaGriglia(); }}
              @applica-regola=${(e: CustomEvent) => this.applicaRegola(e.detail)}
            ></free-dialogo-regole>`
          : ""}

        ${this.conferma
          ? html`<free-dialogo-conferma
              .titolo=${this.conferma.titolo}
              .messaggio=${this.conferma.messaggio}
              .scelte=${this.conferma.scelte}
              @scelta=${(e: CustomEvent<{ id: string }>) => this.rispondiConferma(e.detail.id)}
            ></free-dialogo-conferma>`
          : ""}

        ${this.recuperabile
          ? html`<div class="recupero" role="alertdialog" aria-label="Fogli non salvati">
              <span class="recupero-testo">${this.recuperabile.schede.length === 1 ? t("Foglio non salvato trovato") : t("{} fogli non salvati trovati", this.recuperabile.schede.length)}: ${this.recuperabile.schede.map((s) => `«${s.titolo === TITOLO_NUOVO ? t(TITOLO_NUOVO) : s.titolo}»`).join(", ")} (${new Date(this.recuperabile.salvato).toLocaleString(localeCorrente())})</span>
              <button class="ripristina" @click=${() => { void this.ripristina(); }}>Ripristina</button>
              <button class="scarta" @click=${() => this.scartaCopia()}>Scarta</button>
            </div>`
          : ""}
        <!-- Barra di stato -->
        <free-statusbar
          .statusMessage=${this.statusMessage}
          .statsMessage=${this.statsMessage}
          .zoom=${this.zoom}
          @zoom-change=${(e: CustomEvent<{ zoom: number }>) => (this.zoom = e.detail.zoom)}
        ></free-statusbar>

        ${this.tabellaStampa
          ? html`<div class="stampa" aria-hidden="true">${this.tabellaStampa.pagine.map((pg) => this.paginaStampa(this.tabellaStampa!, pg))}</div>`
          : ""}
        <!-- Modale ricerca nei menu (Alt+/) -->
        <free-menu-search
          @menu-action=${this.handleMenuAction}
        ></free-menu-search>
      </div>
    `;

  }
}
