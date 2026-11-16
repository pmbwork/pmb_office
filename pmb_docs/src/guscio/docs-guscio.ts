import { t, localeCorrente, impostaLingua, risolviLingua } from '../i18n/lingua';
import { css, unsafeCSS } from 'lit';
import { html } from '../i18n/html';
import { LOGO_PMB_DOCS_ORIZZONTALE } from './logo-pmb';
import { LinguaElement } from '../i18n/lingua-element';
import { nomeScheda } from './docs-schede';
import { customElement, state, property } from 'lit/decorators.js';
import './docs-conteggio';
import type { DocsConteggio } from './docs-conteggio';
import './docs-dettagli';
import type { DocsDettagli, DettagliDocumento } from './docs-dettagli';
import './docs-simboli';
import type { DocsSimboli } from './docs-simboli';
import './docs-versioni';
import type { DocsVersioni } from './docs-versioni';
import './docs-nota';
import './docs-segnalibri';
import './docs-ortografia';
import './docs-informazioni';
import './docs-segnala';
import './docs-caratteri';
import './docs-personalizza-barra';
import { barraPredefinita, ripulisciBarra } from './barra-personalizzata';
import './docs-aggiornamento';
import { caricaPersonali, depositoIndexedDb, rilevaCaratteriWindows } from './caratteri';
import { VERSIONE_APP } from './docs-informazioni';
import type { PaginaInformazioni } from '@comune/informazioni/condizioni';
import { avvisoSegnalazione, urlSegnalazione } from '@comune/informazioni/segnalazioni';
import './docs-schede';
import { SCHEDE_MASSIME, titoloNuovaScheda, titoloSchedaValido, unisciSchede, type Scheda } from '../modello/schede';
import { nuovoEditor, statoCorrente, type StatoEditor } from '../editor/azioni';
import './docs-equazione';
import './docs-grafico';
import './docs-disegno';
import { TIPI_GRAFICO, type TipoGrafico } from './grafico';
import { COMPONENTI } from './componenti';
import { VOCI_BORDO } from './bordi-dati';
import './docs-dizionario';
import './docs-preferenze';
import { leggiPreferenze, salvaPreferenze, LINGUE, type Preferenze } from './preferenze';
import { suggerisciNativo, lingueDisponibili } from '../editor/ortografia-nativa';
import type { ErroreOrtografia } from '../editor/docs-editor';
import { testoParagrafo, type VoceSegnalibro } from '../modello/documento';
import type { DocsNota } from './docs-nota';
import type { DocsSegnalibri } from './docs-segnalibri';
import { leggiVersioni, salvaNuovaVersione, eliminaVersione, type VersioneSalvata } from '../formati/versioni';
import './docs-imposta-pagina';
import type { DocsImpostaPagina } from './docs-imposta-pagina';
import './docs-righello-verticale';
import { IMPOSTAZIONI_PREDEFINITE, calcolaGeometria, type ImpostazioniPagina } from '../editor/pagine';
import type { StatisticheTesto } from '../editor/docs-editor';
import './docs-menubar';
import type { SottovoceDinamica } from './docs-menubar';
import './docs-toolbar';
import '../editor/docs-editor';
import type { DocsEditor, StatoRicerca } from '../editor/docs-editor';
import './docs-trova';
import './docs-link';
import './docs-righello';
import './docs-tabella';
import type { DocsTabella } from './docs-tabella';
import { popupTabella } from './tabella-dati';
import './docs-margini';
import type { DocsMargini } from './docs-margini';
import { allineamentoMargine, testoDaParagrafi, type Allineamento, type Paragrafo } from '../modello/documento';
import type { DocsLink } from './docs-link';
import type { StatoLink } from '../editor/link';
import { apriIndirizzo, chiamaTauri } from './tauri';
import { migraChiavi } from './migrazione';
import type { DocsTrova } from './docs-trova';
import type { OpzioniRicerca } from '../editor/ricerca';
import './docs-popup';
import './docs-finestra';
import { LIVELLI_ZOOM, popupAllineaRientro, popupElenchi, popupPerComando, popupZoom, statoBarra, type Popup, type StatoBarra } from './popup-dati';
import { ESTENSIONI_APRI, FORMATI, TITOLO_PREDEFINITO, esportaSchede, importa, nomeFile, titoloDaNome, type FormatoId } from '../formati/file';
import { assicuraScrittura, salvaSuDisco, scegliFile, scegliFileConManiglia, scriviSuManiglia, type ManiglioFile } from '../formati/file-io';
import { ACCETTA_IMMAGINI, leggiImmagine } from '../formati/immagine';
import { popupImmagine } from './immagine-dati';
import type { Immagine } from '../modello/documento';
import { cursore, statoIniziale } from '../modello/documento';
import { MISURE, COLORI, STILI } from './misure';
import type { Documento } from '../modello/documento';
import { Recupero, archivioDa, type Recuperato } from '../formati/recupero';

/** Il deposito del browser per la copia di emergenza; null se non si può usare (per esempio con i dati del sito bloccati). */
function depositoLocale(): Storage | null {
  try { const d = window.localStorage; migraChiavi(d, 'free_docs.', 'pmb_docs.'); return d; } catch { return null; }
}

/** Guscio di pmb_docs: intestazione, menu, barra strumenti, righello e foglio A4, nelle posizioni misurate. */
@customElement('docs-guscio')
export class DocsGuscio extends LinguaElement {
  /** larghezza della finestra: la barra strumenti la usa per decidere quali comandi mostrare */
  @state() private larghezza = typeof window !== 'undefined' ? window.innerWidth : 1600;
  /** testi delle caselle e pulsanti accesi della barra, dallo stato dell'editor */
  @state() private barra: StatoBarra | null = null;
  /** Copia formato: il formato è stato copiato e aspetta di essere applicato a una selezione fatta con il mouse. */
  @state() private copiaFormatoAttiva = false;
  private pressioneNellEditor = false;
  @state() private popup: Popup | null = null;
  @state() private titolo = TITOLO_PREDEFINITO;
  @state() private trovaAperta = false;
  @state() private sostituzione = false;
  @state() private ricerca: StatoRicerca = { totale: 0, corrente: 0, errore: null, troncato: false };
  @state() private linkAperto = false;
  @state() private righelloVisibile = true;
  @state() private tabellaAperta = false;
  /** il dialogo di intestazione e piè di pagina, se è aperto: la casella iniziale e i testi (con {pagina} e {pagine}) e gli allineamenti di partenza */
  @state() private margini: { zona: 'intestazione' | 'piede'; intestazione: string; piede: string; alIntestazione: Allineamento; alPiede: Allineamento } | null = null;
  @state() private datiLink: StatoLink = { url: null, testo: '', selezione: false };
  /** messaggio in basso (errori di apertura o di salvataggio), sparisce da solo */
  @state() private avviso: string | null = null;
  @state() private conteggioAperto = false;
  @state() private datiConteggio: StatisticheTesto | null = null;
  @state() private dettagliAperti = false;
  @state() private datiDettagli: DettagliDocumento | null = null;
  @property({ type: Boolean }) caratteriNonStampabili = false;
  @state() private colonne = 1;
  @state() private simboliAperto = false;
  @state() private versioniAperte = false;
  @state() private elencoVersioni: VersioneSalvata[] = [];
  @state() private notaAperta = false;
  @state() private segnalibriAperti = false;
  @state() private prefs: Preferenze = leggiPreferenze(depositoLocale());
  @state() private lingueWindows: string[] = [];
  @state() private dialogoPref: 'preferenze' | 'accessibilita' | null = null;
  @state() private dizionarioAperto = false;
  @state() private informazioniAperte: PaginaInformazioni | null = null;
  @state() private segnalaAperta = false;
  @state() private caratteriAperti = false;
  @state() private personalizzaAperta = false;
  /** true mentre si scrive il nuovo nome del documento nell'intestazione */
  @state() private titoloInModifica = false;
  @state() private aggiornamentoAperto = false;
  /** Le schede del documento: la scheda attiva è quella nell'editor (stato null), le altre tengono il loro stato con la storia di annulla. */
  @state() private schede: Array<{ titolo: string; stato: StatoEditor | null }> = [{ titolo: 'Scheda 1', stato: null }];
  @state() private schedaAttiva = 0;
  private versioneSchede = 0;
  private ultimaVersioneSchede = 0;
  @state() private equazioneAperta = false;
  @state() private disegnoAperto = false;
  @state() private graficoAperto: TipoGrafico | null = null;
  @state() private elencoDizionario: string[] = [];
  @state() private ortografiaAperta: { parola: string; contesto: string; posizione: string; azione: number; suggerimenti: string[] } | null = null;
  private erroriDialogo: ErroreOrtografia[] = [];
  private indiceErrore = 0;
  @state() private elencoSegnalibri: VoceSegnalibro[] = [];
  private numeriRiga = false;
  @state() private impostaPaginaAperta = false;
  @state() private impostazioniPagina: ImpostazioniPagina = { ...IMPOSTAZIONI_PREDEFINITE };
  @property({ type: Boolean, reflect: true, attribute: 'senza-pagine' })
  senzaPagine = false;
  @property({ type: Boolean, reflect: true, attribute: 'schermo-intero' })
  schermoIntero = false;
  @property({ type: String, reflect: true })
  tema: 'chiaro' | 'scuro' = 'chiaro';
  @state() private zoom = 100;
  /** la copia di emergenza trovata all'avvio, in attesa che l'utente scelga se ripristinarla: finché c'è, il salvataggio automatico non scrive */
  @state() private recuperabile: Recuperato | null = null;
  /** il salvataggio automatico del documento aperto: sostituibile (nei test e in altri ambienti) */
  recupero = new Recupero(archivioDa(depositoLocale()));
  private ultimoDoc: Documento | null = null;
  private ultimoTitolo = '';
  private timerAvviso = 0;
  private osservaArea: ResizeObserver | null = null;
  /** come si scrive e si legge un file: sostituibili (nei test e in altri ambienti) */
  salva: (nome: string, bytes: Uint8Array, mime: string, iniziaDa?: ManiglioFile | null) => Promise<unknown> = salvaSuDisco;
  /** File su disco a cui Salva riscrive (scelto con Apri o Salva con nome). */
  private maniglia: ManiglioFile | null = null;
  private formatoManiglia: FormatoId = 'docx';
  /** File aperto con Apri ma non scrivibile: Salva con nome parte da lì (stessa cartella e stesso nome). */
  private origine: ManiglioFile | null = null;
  scegli: () => Promise<{ file: File; maniglia: ManiglioFile | null } | File | null> = () => scegliFileConManiglia(ESTENSIONI_APRI);
  /** come si sceglie e si legge un'immagine: sostituibili (nei test e in altri ambienti) */
  scegliImmagine: () => Promise<File | null> = () => scegliFile(ACCETTA_IMMAGINI);
  caricaImmagine: (file: Blob) => Promise<Immagine | null> = (file) => leggiImmagine(file);
  private popupId = '';
  private popupX = 0;
  private popupY = 0;
  private ultimaChiusura: { id: string; t: number } | null = null;

  apriConteggio(): void {
    const ed = this.editor();
    if (!ed) return;
    this.datiConteggio = ed.statisticheTesto();
    this.conteggioAperto = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsConteggio>('docs-conteggio')?.focalizza();
    });
  }

  private chiudiConteggio(): void {
    if (!this.conteggioAperto) return;
    this.conteggioAperto = false;
    this.editor()?.focalizza();
  }

  apriDettagli(): void {
    const ed = this.editor();
    const stats = ed ? ed.statisticheTesto() : { pagine: 1, parole: 0, caratteri: 0 };
    this.datiDettagli = {
      titolo: this.titoloVisibile(this.titolo),
      formato: 'Documento (.docx)',
      pagine: stats.pagine,
      parole: stats.parole,
      caratteri: stats.caratteri,
      dataModifica: new Date().toLocaleDateString(localeCorrente()) + ' ' + new Date().toLocaleTimeString(localeCorrente(), { hour: '2-digit', minute: '2-digit' }),
    };
    this.dettagliAperti = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsDettagli>('docs-dettagli')?.focalizza();
    });
  }

  chiudiDettagli(): void {
    if (!this.dettagliAperti) return;
    this.dettagliAperti = false;
    this.editor()?.focalizza();
  }

  alternaCaratteriNonStampabili(): void {
    this.caratteriNonStampabili = !this.caratteriNonStampabili;
    this.editor()?.impostaMostraNonStampabili(this.caratteriNonStampabili);
    this.mostraAvviso(this.caratteriNonStampabili ? t('Caratteri non stampabili visibili') : t('Caratteri non stampabili nascosti'));
  }

  impostaColonne(n: number): void {
    this.colonne = Math.max(1, Math.min(3, n));
    this.editor()?.impostaColonne(this.colonne);
    this.mostraAvviso(this.colonne === 1 ? t('Impostato a 1 colonna') : t('Impostato a {} colonne', this.colonne));
  }

  apriImpostaPagina(): void {
    this.impostaPaginaAperta = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsImpostaPagina>('docs-imposta-pagina')?.focalizza();
    });
  }

  chiudiImpostaPagina(): void {
    if (!this.impostaPaginaAperta) return;
    this.impostaPaginaAperta = false;
    this.editor()?.focalizza();
  }

  apriSimboli(): void {
    this.simboliAperto = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsSimboli>('docs-simboli')?.focalizza();
    });
  }

  chiudiSimboli(): void {
    if (!this.simboliAperto) return;
    this.simboliAperto = false;
    this.editor()?.focalizza();
  }

  private suInserisciSimbolo = (e: Event): void => {
    const s = (e as CustomEvent).detail.simbolo as string;
    this.editor()?.applicaAzione({ tipo: 'testo', testo: s });
  };

  apriVersioni(): void {
    this.elencoVersioni = leggiVersioni(depositoLocale(), this.titolo);
    this.versioniAperte = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsVersioni>('docs-versioni')?.focalizza();
    });
  }

  chiudiVersioni(): void {
    if (!this.versioniAperte) return;
    this.versioniAperte = false;
    this.editor()?.focalizza();
  }

  private suCreaVersione = (e: Event): void => {
    const nome = (e as CustomEvent).detail.nome as string | undefined;
    const ed = this.editor();
    if (!ed) return;
    const salvata = salvaNuovaVersione(depositoLocale(), this.titolo, ed.stato.doc, nome);
    if (salvata) {
      this.elencoVersioni = leggiVersioni(depositoLocale(), this.titolo);
      this.mostraAvviso(t('Versione salvata con successo'));
    }
  };

  private suRipristinaVersione = (e: Event): void => {
    const v = (e as CustomEvent).detail.versione as VersioneSalvata;
    const ed = this.editor();
    if (!ed) return;
    this.dimenticaOrtografia();
    ed.impostaStato({ doc: v.doc, sel: cursore(0, 0), pendenti: null });
    this.chiudiVersioni();
    this.mostraAvviso(t('Versione ripristinata: {}', v.nome || 'Versione senza nome'));
  };

  private suEliminaVersione = (e: Event): void => {
    const id = (e as CustomEvent).detail.id as string;
    eliminaVersione(depositoLocale(), this.titolo, id);
    this.elencoVersioni = leggiVersioni(depositoLocale(), this.titolo);
  };

  apriNotaPiePagina(): void {
    this.notaAperta = true;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<DocsNota>('docs-nota')?.focalizza();
    });
  }

  apriSegnalibri(): void {
    this.elencoSegnalibri = this.editor()?.segnalibri() ?? [];
    this.segnalibriAperti = true;
    this.segnaApertura('segnalibri');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<DocsSegnalibri>('docs-segnalibri')?.focalizza(); });
  }

  chiudiSegnalibri(): void {
    if (!this.segnalibriAperti) return;
    this.segnalibriAperti = false;
    this.editor()?.focalizza();
  }

  private suAggiungiSegnalibro = (e: Event): void => {
    const nome = (e as CustomEvent).detail.nome as string;
    const ed = this.editor();
    if (!ed) return;
    if (!ed.aggiungiSegnalibro(nome)) { this.mostraAvviso(t('Nome del segnalibro non valido (al massimo 60 caratteri)')); return; }
    this.elencoSegnalibri = ed.segnalibri();
    this.mostraAvviso(t('Segnalibro «{}» aggiunto al paragrafo del cursore', nome.trim()));
  };
  private suVaiSegnalibro = (e: Event): void => {
    this.segnalibriAperti = false;
    const ed = this.editor();
    ed?.vaiASegnalibro((e as CustomEvent).detail.p as number);
    ed?.focalizza();
  };
  private suTogliSegnalibro = (e: Event): void => {
    const ed = this.editor();
    if (!ed) return;
    ed.rimuoviSegnalibro((e as CustomEvent).detail.nome as string);
    this.elencoSegnalibri = ed.segnalibri();
  };

  alternaNumeriRiga(): void {
    this.numeriRiga = !this.numeriRiga;
    this.requestUpdate();
    this.editor()?.impostaNumeriRiga(this.numeriRiga);
    this.mostraAvviso(this.numeriRiga ? t('Numeri di riga visibili (solo a schermo, non si stampano)') : t('Numeri di riga nascosti'));
    this.editor()?.focalizza();
  }

  // ---- finestre: Esc chiude quella aperta per ultima ----
  private apertureFinestre = new Map<string, number>();
  private contaAperture = 0;
  private segnaApertura(nome: string): void { this.apertureFinestre.set(nome, ++this.contaAperture); }
  /** Chiude la finestra (tra quelle nuove) aperta più di recente; false se non ce n'è nessuna. */
  private chiudiUltimaFinestra(): boolean {
    const aperte: Array<[string, boolean, () => void]> = [
      ['immagini', this.equazioneAperta || this.disegnoAperto || this.graficoAperto !== null, () => { this.chiudiFinestreImmagine(); }],
      ['ortografia', this.ortografiaAperta !== null, () => this.chiudiOrtografia()],
      ['dizionario', this.dizionarioAperto, () => this.chiudiDizionario()],
      ['preferenze', this.dialogoPref !== null, () => this.chiudiPreferenze()],
      ['segnalibri', this.segnalibriAperti, () => this.chiudiSegnalibri()],
      ['informazioni', this.informazioniAperte !== null, () => this.chiudiInformazioni()],
      ['segnala', this.segnalaAperta, () => this.chiudiSegnala()],
      ['caratteri', this.caratteriAperti, () => this.chiudiCaratteri()],
      ['personalizza', this.personalizzaAperta, () => this.chiudiPersonalizza()],
      ['aggiornamento', this.aggiornamentoAperto, () => this.chiudiAggiornamento()],
    ];
    const attive = aperte.filter(([, aperta]) => aperta).sort((a, b) => (this.apertureFinestre.get(b[0]) ?? 0) - (this.apertureFinestre.get(a[0]) ?? 0));
    if (attive.length === 0) return false;
    attive[0][2]();
    return true;
  }

  // ---- modifiche non salvate ----
  /** I documenti (uno per scheda) com'erano all'ultimo salvataggio o apertura: se ora sono gli stessi oggetti non c'è niente da perdere. */
  private docSalvati: Documento[] | null = null;
  private titoliSalvati: string[] = [];
  /** il nome del documento com'era all'ultimo salvataggio o apertura: rinominare è una modifica da salvare */
  private titoloDocSalvato = TITOLO_PREDEFINITO;
  private ricordaSalvato(schede: Scheda[]): void { this.docSalvati = schede.map((s) => s.doc); this.titoliSalvati = schede.map((s) => s.titolo); this.requestUpdate(); } // l'intestazione mostra lo stato del salvataggio
  /** Salvato: la copia di emergenza si cancella solo se il documento è ancora quello salvato. */
  private segnaSalvato(istantanea: Scheda[]): void {
    this.ricordaSalvato(istantanea);
    this.titoloDocSalvato = this.titolo;
    this.requestUpdate();
    if (!this.modificato()) this.recupero.scarta();
  }
  /** true se c'è qualcosa che nessun file contiene. */
  modificato(): boolean {
    const ora = this.schedeComplete();
    const s = this.docSalvati;
    if (this.titolo !== this.titoloDocSalvato) return true;
    if (s === null) return ora.some((x) => !(x.doc.paragrafi.length === 1 && x.doc.paragrafi[0].runs.length === 0));
    return ora.length !== s.length || ora.some((x, i) => x.doc !== s[i] || x.titolo !== this.titoliSalvati[i]);
  }
  /** Prima di sostituire il documento: se ci sono modifiche non salvate chiede se continuare (la copia di emergenza verrebbe cancellata). */
  private confermaPerdita(): boolean {
    if (!this.modificato()) return true;
    try { return window.confirm(t('Ci sono modifiche non salvate. Se continui andranno perse.\n\nContinuare senza salvare?')); } catch { return true; }
  }
  nuovoConConferma(): void { if (this.confermaPerdita()) this.nuovo(); }
  async apriConConferma(): Promise<void> { if (this.confermaPerdita()) await this.apri(); }

  // ---- schede (Tab) ----
  /** Tutte le schede con il loro documento aggiornato (quella attiva dall'editor). */
  private schedeComplete(): Scheda[] {
    const ed = this.editor();
    return this.schede.map((s, i) => ({ titolo: s.titolo, doc: i === this.schedaAttiva && ed ? ed.stato.doc : s.stato ? statoCorrente(s.stato).doc : { paragrafi: [{ runs: [] }] } }));
  }
  /** Il documento intero: con più schede sono una dopo l'altra. */
  private documentoCompleto(): import('../modello/documento').Documento {
    const ed = this.editor();
    return this.schede.length > 1 || !ed ? unisciSchede(this.schedeComplete()) : ed.stato.doc;
  }
  private memorizzaSchedaAttiva(): void {
    const ed = this.editor();
    if (!ed) return;
    this.schede = this.schede.map((s, i) => (i === this.schedaAttiva ? { ...s, stato: ed.statoEditor } : s));
  }
  private schedeCambiate(): void { this.dimenticaOrtografia(); this.versioneSchede++; this.segnaSchedeVisibili(); this.copiaDiEmergenza(); }
  /** Con più di una scheda c'è l'elenco a sinistra: la pagina si sposta per non finirci sotto (attributo letto dal CSS). */
  private segnaSchedeVisibili(): void { this.toggleAttribute('con-schede', this.schede.length > 1); }
  /** Cambiando documento o scheda la finestra del correttore non vale più: gli errori che mostrava sono di un altro testo. */
  private dimenticaOrtografia(): void { this.ortografiaAperta = null; this.erroriDialogo = []; this.indiceErrore = 0; }
  /** Torna a una sola scheda con il documento dato (Nuovo, Apri, Ripristina). */
  private unaScheda(titolo = 'Scheda 1'): void { this.dimenticaOrtografia(); this.schede = [{ titolo, stato: null }]; this.schedaAttiva = 0; this.versioneSchede++; this.segnaSchedeVisibili(); }
  cambiaScheda(i: number): void {
    const ed = this.editor();
    if (!ed || i === this.schedaAttiva || i < 0 || i >= this.schede.length) return;
    this.memorizzaSchedaAttiva();
    this.schedaAttiva = i;
    const stato = this.schede[i].stato;
    if (stato) ed.impostaStatoEditor(stato); else ed.impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: cursore(0, 0), pendenti: null });
    this.schede = this.schede.map((s, k) => (k === i ? { ...s, stato: null } : s));
    this.schedeCambiate();
    ed.focalizza();
  }
  nuovaScheda(): void {
    const ed = this.editor();
    if (!ed) return;
    if (this.schede.length >= SCHEDE_MASSIME) { this.mostraAvviso(t('Al massimo {} schede', SCHEDE_MASSIME)); return; }
    this.memorizzaSchedaAttiva();
    this.schede = [...this.schede, { titolo: titoloNuovaScheda(this.schede.map((s) => s.titolo)), stato: null }];
    this.schedaAttiva = this.schede.length - 1;
    ed.impostaStato(statoIniziale());
    this.schedeCambiate();
    this.mostraAvviso(t('Nuova scheda: «{}»', nomeScheda(this.schede[this.schedaAttiva].titolo)));
    ed.focalizza();
  }
  rinominaScheda(i: number, titolo: string): void {
    const valido = titoloSchedaValido(titolo);
    if (valido === null) { this.mostraAvviso(t('Il nome della scheda non può essere vuoto né più lungo di 80 caratteri')); return; }
    if (!this.schede[i]) return;
    this.schede = this.schede.map((s, k) => (k === i ? { ...s, titolo: valido } : s));
    this.schedeCambiate();
  }
  eliminaScheda(i: number): void {
    const ed = this.editor();
    if (!ed || this.schede.length < 2 || !this.schede[i]) return;
    this.memorizzaSchedaAttiva();
    const eraAttiva = i === this.schedaAttiva;
    const nome = this.schede[i].titolo;
    this.schede = this.schede.filter((_, k) => k !== i);
    if (eraAttiva) {
      this.schedaAttiva = Math.max(0, i - 1);
      const stato = this.schede[this.schedaAttiva].stato;
      if (stato) ed.impostaStatoEditor(stato); else ed.impostaStato(statoIniziale());
      this.schede = this.schede.map((s, k) => (k === this.schedaAttiva ? { ...s, stato: null } : s));
    } else if (i < this.schedaAttiva) this.schedaAttiva--;
    this.schedeCambiate();
    this.mostraAvviso(t('Scheda «{}» eliminata', nome));
  }
  /** Carica le schede di un file aperto: la prima è attiva, le altre aspettano con il loro documento. */
  private caricaSchede(schede: Scheda[]): void {
    const ed = this.editor();
    if (!ed) return;
    this.dimenticaOrtografia();
    this.schede = schede.map((s, k) => ({ titolo: s.titolo, stato: k === 0 ? null : nuovoEditor({ doc: s.doc, sel: cursore(0, 0), pendenti: null }) }));
    this.schedaAttiva = 0;
    this.versioneSchede++;
    this.segnaSchedeVisibili();
    ed.impostaStato({ doc: schede[0].doc, sel: cursore(0, 0), pendenti: null });
  }

  // ---- equazione, grafico, disegno: finestre che producono un'immagine da mettere nel documento ----
  private apriFinestraImmagine(quale: 'equazione' | 'disegno' | TipoGrafico): void {
    if (quale === 'equazione') this.equazioneAperta = true; else if (quale === 'disegno') this.disegnoAperto = true; else this.graficoAperto = quale;
    this.segnaApertura('immagini');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>(quale === 'equazione' ? 'docs-equazione' : quale === 'disegno' ? 'docs-disegno' : 'docs-grafico')?.focalizza(); });
  }
  private chiudiFinestreImmagine(): boolean {
    if (!this.equazioneAperta && !this.disegnoAperto && this.graficoAperto === null) return false;
    this.equazioneAperta = false; this.disegnoAperto = false; this.graficoAperto = null;
    this.editor()?.focalizza();
    return true;
  }
  /** Il canvas della finestra diventa un'immagine png nel documento. */
  private suTelaPronta = (e: Event): void => {
    const tela = (e as CustomEvent).detail.tela as HTMLCanvasElement;
    this.chiudiFinestreImmagine();
    tela.toBlob((blob) => { if (blob) void this.inserisciImmagine(blob); else this.mostraAvviso(t('Non riesco a trasformare il disegno in un\'immagine')); }, 'image/png');
  };

  // ---- Informazioni: condizioni d'uso e licenze ----
  apriInformazioni(pagina: PaginaInformazioni): void {
    this.informazioniAperte = pagina;
    this.segnaApertura('informazioni');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-informazioni')?.focalizza(); });
  }
  /** Apre la finestra per scrivere un bug o un feedback; il messaggio parte via Internet solo quando l'utente preme Invia. */
  segnalaProblema(): void {
    this.segnalaAperta = true;
    this.segnaApertura('segnala');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-segnala')?.focalizza(); });
  }
  private chiudiSegnala(): void { if (!this.segnalaAperta) return; this.segnalaAperta = false; this.editor()?.focalizza(); }
  private suSegnalaInviata = (): void => { this.chiudiSegnala(); this.mostraAvviso(t('Grazie! Il messaggio è stato inviato.')); };
  /** Ripiego: la posta dell'utente con un messaggio già compilato. */
  private suSegnalaPosta = (e: Event): void => {
    const testo = String((e as CustomEvent).detail?.testo ?? '');
    void apriIndirizzo(urlSegnalazione({ app: 'pmb_docs', versione: VERSIONE_APP, sistema: navigator.userAgent, testo, tr: t })).then((ok) => {
      this.chiudiSegnala();
      this.mostraAvviso(ok ? avvisoSegnalazione(t) : t('Non è stato possibile aprire la posta. {}', avvisoSegnalazione(t)));
    });
  };
  private chiudiInformazioni(): void { if (this.informazioniAperte === null) return; this.informazioniAperte = null; this.editor()?.focalizza(); }

  // ---- preferenze, correttore ortografico, dizionario ----
  /** Cambia le preferenze, le salva sul computer e le applica subito. */
  private cambiaPreferenze(parziale: Partial<Preferenze>): void {
    this.prefs = { ...this.prefs, ...parziale };
    salvaPreferenze(depositoLocale(), this.prefs);
    this.applicaPreferenze();
  }

  /** Il sistema (Windows, macOS) usa il tema scuro? Serve al tema «Come il sistema». */
  private sistemaScuro(): boolean {
    try { return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches; } catch { return false; }
  }
  /** Il sistema è passato dal tema chiaro allo scuro o viceversa: con il tema «Come il sistema» lo si segue subito. */
  private suTemaSistema = (): void => { if (this.prefs.tema === 'sistema') this.applicaPreferenze(); };

  private applicaPreferenze(): void {
    const p = this.prefs;
    impostaLingua(risolviLingua(p.interfaccia));
    this.tema = p.tema === 'sistema' ? (this.sistemaScuro() ? 'scuro' : 'chiaro') : p.tema;
    this.toggleAttribute('alto-contrasto', p.altoContrasto);
    this.toggleAttribute('riduci-animazioni', p.riduciAnimazioni);
    this.toggleAttribute('menu-nascosti', p.menuNascosti);
    const ed = this.editor();
    if (!ed) return;
    ed.toggleAttribute('cursore-grande', p.cursoreGrande);
    ed.toggleAttribute('alto-contrasto', p.altoContrasto);
    ed.impostaDizionario(p.dizionario);
    ed.impostaOrtografia(p.ortografia, p.lingua);
  }

  private apriPreferenze(modo: 'preferenze' | 'accessibilita'): void {
    this.dialogoPref = modo;
    this.segnaApertura('preferenze');
    if (modo === 'preferenze' && this.lingueWindows.length === 0) void lingueDisponibili(LINGUE.map(([c]) => c)).then((l) => { this.lingueWindows = l; });
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-preferenze')?.focalizza(); });
  }
  private chiudiPreferenze(): void { if (!this.dialogoPref) return; this.dialogoPref = null; this.editor()?.focalizza(); }

  private apriDizionario(): void {
    this.elencoDizionario = [...this.prefs.dizionario].sort((a, b) => a.localeCompare(b, 'it'));
    this.dizionarioAperto = true;
    this.segnaApertura('dizionario');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-dizionario')?.focalizza(); });
  }
  // ---- aggiornamento da file ----
  private apriAggiornamento(): void {
    this.aggiornamentoAperto = true;
    this.segnaApertura('aggiornamento');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-aggiornamento')?.focalizza(); });
  }
  private chiudiAggiornamento(): void { if (!this.aggiornamentoAperto) return; this.aggiornamentoAperto = false; this.editor()?.focalizza(); }

  // ---- nome del documento nell'intestazione (come in pmb_sheets) ----
  /** Un clic sul nome (o File › Rinomina) lo rende modificabile: Invio o clic fuori conferma, Esc annulla. */
  iniziaTitolo(): void {
    this.titoloInModifica = true;
    void this.updateComplete.then(() => {
      const campo = this.renderRoot.querySelector<HTMLInputElement>('input.titolo-documento');
      campo?.focus();
      campo?.select();
    });
  }
  private fineTitolo(valore: string, conferma = true): void {
    if (!this.titoloInModifica) return;
    this.titoloInModifica = false;
    const nuovo = valore.trim();
    if (conferma && nuovo !== '' && nuovo !== this.titoloVisibile(this.titolo)) {
      this.titolo = nuovo;
      this.copiaDiEmergenza();
      // Se il documento non è ancora salvato su disco con un proprio file, apri la finestra di salvataggio
      if (!this.maniglia) {
        void this.scarica(this.formatoManiglia);
      }
    }
    this.editor()?.focalizza();
  }
  private suTastoTitolo = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.fineTitolo((e.target as HTMLInputElement).value); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.fineTitolo('', false); }
  };

  // ---- barra degli strumenti personalizzata ----
  apriPersonalizza(): void {
    this.personalizzaAperta = true;
    this.segnaApertura('personalizza');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-personalizza-barra')?.focalizza(); });
  }
  private chiudiPersonalizza(): void { if (!this.personalizzaAperta) return; this.personalizzaAperta = false; this.editor()?.focalizza(); }
  /** La barra scelta si salva nelle preferenze; se è uguale a quella di partenza si torna alla barra predefinita (null). */
  private suBarraCambiata = (e: Event): void => {
    const nuova = ripulisciBarra((e as CustomEvent<{ barra: string[] }>).detail.barra) ?? [];
    const predefinita = barraPredefinita();
    const uguale = nuova.length === predefinita.length && nuova.every((x, i) => x === predefinita[i]);
    this.cambiaPreferenze({ barra: uguale ? null : nuova });
  };
  /** Nasconde o mostra i menu in alto (titolo e barra dei menu): resta solo la barra degli strumenti, come in Google Documenti. */
  alternaMenuNascosti(): void { this.cambiaPreferenze({ menuNascosti: !this.prefs.menuNascosti }); }

  // ---- caratteri personali ----
  private apriCaratteri(): void {
    this.caratteriAperti = true;
    this.segnaApertura('caratteri');
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-caratteri')?.focalizza(); });
  }
  private chiudiCaratteri(): void { if (!this.caratteriAperti) return; this.caratteriAperti = false; this.editor()?.focalizza(); }
  /** Dopo un'importazione o una rimozione l'editor rivede l'impaginazione (le righe cambiano con il carattere). */
  private suCaratteriCambiati = (): void => { this.editor()?.requestUpdate(); void document.fonts?.ready?.then(() => this.editor()?.requestUpdate()); };
  /** Riconosce i caratteri di Windows installati e carica quelli personali già importati. */
  private avviaCaratteri(): void {
    rilevaCaratteriWindows();
    if (typeof indexedDB === 'undefined') return;
    void caricaPersonali(depositoIndexedDb()).then(() => this.editor()?.requestUpdate());
  }
  private chiudiDizionario(): void { if (!this.dizionarioAperto) return; this.dizionarioAperto = false; this.editor()?.focalizza(); }
  private suDizionarioAggiungi = (e: Event): void => {
    const parola = ((e as CustomEvent).detail.parola as string).trim();
    if (parola === '' || /\s/.test(parola) || parola.length > 60) { this.mostraAvviso(t('Scrivi una sola parola (al massimo 60 caratteri)')); return; }
    this.editor()?.aggiungiAlDizionario(parola);
    this.elencoDizionario = [...this.prefs.dizionario].sort((a, b) => a.localeCompare(b, 'it'));
  };
  private suDizionarioTogli = (e: Event): void => {
    this.editor()?.rimuoviDalDizionario((e as CustomEvent).detail.parola as string);
    this.elencoDizionario = [...this.prefs.dizionario].sort((a, b) => a.localeCompare(b, 'it'));
  };
  /** L'editor dice che il dizionario è cambiato: si salva tra le preferenze. */
  private suDizionarioCambiato = (e: Event): void => {
    const parole = ((e as CustomEvent).detail.parole as string[]).slice();
    const attuali = new Set(this.prefs.dizionario.map((x) => x.toLowerCase()));
    const nuovi = new Set(parole.map((x) => x.toLowerCase()));
    // si tengono le parole come l'utente le ha scritte, si aggiungono le nuove e si tolgono quelle sparite
    const mantenute = this.prefs.dizionario.filter((x) => nuovi.has(x.toLowerCase()));
    const aggiunte = parole.filter((x) => !attuali.has(x.toLowerCase()));
    this.prefs = { ...this.prefs, dizionario: [...mantenute, ...aggiunte] };
    salvaPreferenze(depositoLocale(), this.prefs);
  };

  /** Lancia il controllo ortografico di tutto il documento e apre la finestra sul primo errore. */
  async apriOrtografia(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    this.mostraAvviso(t('Controllo ortografico in corso…'));
    await ed.controllaOrtografiaOra();
    if (ed.ortografiaMessaggio) { this.mostraAvviso(ed.ortografiaMessaggio); return; }
    if (ed.erroriOrtografici.length === 0) { this.ortografiaAperta = null; this.mostraAvviso(t('Nessun errore di ortografia trovato')); return; }
    this.avviso = null;
    this.indiceErrore = 0;
    await this.mostraErroreOrtografia();
  }

  private async mostraErroreOrtografia(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    const lista = ed.erroriOrtografici;
    if (lista.length === 0) { this.ortografiaAperta = null; this.mostraAvviso(t('Controllo ortografico completato')); ed.focalizza(); return; }
    // finiti gli errori dopo quello appena trattato: il controllo è completato (gli errori saltati con Ignora restano ignorati)
    if (this.indiceErrore >= lista.length) { this.ortografiaAperta = null; this.mostraAvviso(t('Controllo ortografico completato')); ed.focalizza(); return; }
    if (!this.ortografiaAperta) this.segnaApertura('ortografia');
    this.erroriDialogo = lista;
    const e = lista[this.indiceErrore];
    ed.selezionaErroreOrtografia(e);
    const testo = testoParagrafo(ed.stato.doc.paragrafi[e.p] ?? { runs: [] });
    const contesto = testo.slice(Math.max(0, e.da - 25), Math.min(testo.length, e.a + 25)).replace(/\s+/g, ' ');
    const suggerimenti = e.azione === 2 ? (e.sostituto === '' ? [] : [e.sostituto]) : e.azione === 0 ? await suggerisciNativo(e.parola, ed.ortografiaLingua) : [];
    this.ortografiaAperta = { parola: e.parola, contesto, posizione: `${this.indiceErrore + 1} di ${lista.length}`, azione: e.azione, suggerimenti };
    void this.updateComplete.then(() => { this.renderRoot.querySelector<HTMLElement & { focalizza(): void }>('docs-ortografia')?.focalizza(); });
  }

  private chiudiOrtografia(): void { if (!this.ortografiaAperta) return; this.ortografiaAperta = null; this.editor()?.focalizza(); }
  private erroreCorrente(): ErroreOrtografia | undefined { return this.erroriDialogo[this.indiceErrore]; }
  private ortOccupato = false;
  /** Esegue un'azione della finestra del correttore una alla volta: un doppio clic non deve lavorare su posizioni già vecchie. */
  private async azioneOrtografia(fn: (ed: DocsEditor, err: ErroreOrtografia) => void | Promise<void>): Promise<void> {
    if (this.ortOccupato) return;
    const ed = this.editor(); const err = this.erroreCorrente();
    if (!ed || !err) return;
    this.ortOccupato = true;
    try {
      await fn(ed, err);
      await ed.controllaOrtografiaOra();
      // si riparte dal primo errore che sta dopo quello appena trattato (per posizione, non per numero: gli errori possono essere spariti)
      const lista = ed.erroriOrtografici;
      const k = lista.findIndex((x) => x.p > err.p || (x.p === err.p && x.da >= err.da));
      this.indiceErrore = k < 0 ? lista.length : k;
      await this.mostraErroreOrtografia();
    } finally { this.ortOccupato = false; }
  }
  private suOrtCambia = (e: Event): Promise<void> => this.azioneOrtografia((ed, err) => {
    if (!ed.sostituisciErroreOrtografia(err, (e as CustomEvent).detail.testo as string)) this.mostraAvviso(t('Il testo è cambiato: ricontrollo'));
  });
  private suOrtCambiaTutto = (e: Event): Promise<void> => this.azioneOrtografia((ed, err) => {
    const n = ed.sostituisciTutteOrtografia(err.parola, (e as CustomEvent).detail.testo as string);
    this.mostraAvviso(n === 1 ? t('Cambiata 1 parola') : t('Cambiate {} parole', n));
  });
  private suOrtIgnora = async (): Promise<void> => {
    if (this.ortOccupato) return;
    this.ortOccupato = true;
    try { this.indiceErrore++; await this.mostraErroreOrtografia(); } finally { this.ortOccupato = false; }
  };
  private suOrtIgnoraTutto = (): Promise<void> => this.azioneOrtografia((ed, err) => { ed.ignoraParolaOrtografia(err.parola); });
  private suOrtAggiungi = (): Promise<void> => this.azioneOrtografia((ed, err) => { ed.aggiungiAlDizionario(err.parola); });

  chiudiNotaPiePagina(): void {
    if (!this.notaAperta) return;
    this.notaAperta = false;
    this.editor()?.focalizza();
  }

  private suApplicaNota = (e: Event): void => {
    const testo = (e as CustomEvent).detail.testo as string;
    this.notaAperta = false;
    this.editor()?.inserisciNota(testo);
    this.editor()?.focalizza();
  };

  private suImpostaPaginaApplica = (e: Event): void => {
    const nuove = (e as CustomEvent).detail.impostazioni as ImpostazioniPagina;
    this.impostaImpostazioniPagina(nuove);
    this.impostaPaginaAperta = false;
    this.editor()?.focalizza();
  };

  /** Imposta le impostazioni di pagina (margini, orientamento, formato) nel guscio e nell'editor. */
  impostaImpostazioniPagina(imp: ImpostazioniPagina): void {
    this.impostazioniPagina = { ...imp };
    // larghezza del foglio per centrarlo e per allineare il righello (variabili CSS: niente attributi style in linea)
    const larghezza = calcolaGeometria(this.impostazioniPagina).larghezza;
    this.style.setProperty('--larghezza-foglio', `${larghezza}px`);
    this.style.setProperty('--sx-minimo', larghezza === 794 ? '301px' : '44px');
    this.editor()?.impostaImpostazioniPagina(this.impostazioniPagina);
  }

  /** Passa al livello di zoom successivo (+1) o precedente (-1). */
  passoZoom(verso: 1 | -1): void {
    const i = LIVELLI_ZOOM.indexOf(this.zoom);
    const j = Math.max(0, Math.min(LIVELLI_ZOOM.length - 1, (i < 0 ? LIVELLI_ZOOM.indexOf(100) : i) + verso));
    this.impostaZoom(LIVELLI_ZOOM[j]);
  }

  /** Ctrl + rotella: zoom del documento (e non quello della pagina intera, che ingrandirebbe anche menu e barre). */
  private suRotella = (e: WheelEvent): void => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    this.passoZoom(e.deltaY < 0 ? 1 : -1);
  };

  /** Imposta il livello di zoom del documento (50, 75, 90, 100, 125, 150, 200). */
  impostaZoom(z: number): void {
    if (LIVELLI_ZOOM.includes(z)) {
      this.zoom = z;
    }
  }

  /** Restituisce il livello di zoom attuale. */
  get zoomAttuale(): number {
    return this.zoom;
  }

  /** Le voci dei menu che sono accese adesso: il menu le mostra con il segno di spunta, così si vede che la scelta ha funzionato. */
  private vociSpuntate(): string[] {
    const s: string[] = [];
    if (!this.senzaPagine) s.push('visualizza›Mostra layout di stampa');
    if (this.righelloVisibile) s.push('visualizza›Mostra righello');
    if (this.prefs.barraEquazioni) s.push('visualizza›Mostra barra degli strumenti delle equazioni');
    if (this.caratteriNonStampabili) s.push('visualizza›Mostra caratteri non stampabili');
    if (this.schermoIntero) s.push('visualizza›Schermo intero');
    if (this.prefs.menuNascosti) s.push('visualizza›Nascondi i menu');
    s.push(this.prefs.tema === 'sistema' ? 'visualizza›Modalità›Tema di sistema' : this.tema === 'scuro' ? 'visualizza›Modalità›Tema scuro' : 'visualizza›Modalità›Tema chiaro');
    if (this.numeriRiga) s.push('strumenti›Numeri di riga');
    if (this.prefs.ortografia) s.push('strumenti›Ortografia e grammatica›Sottolinea gli errori mentre scrivi');
    s.push(`formato›Colonne›${this.colonne === 1 ? '1 colonna' : `${this.colonne} colonne`}`);
    const lingua = LINGUE.find(([c]) => c === this.prefs.lingua);
    if (lingua) s.push(`file›Correttore lingua›${lingua[1]}`);
    return s;
  }

  alternaModalitaPagine(): void {
    this.senzaPagine = !this.senzaPagine;
    this.requestUpdate();
    const ed = this.editor();
    if (ed) {
      ed.impostaSenzaPagine(this.senzaPagine);
    }
  }

  alternaSchermoIntero(): void {
    this.schermoIntero = !this.schermoIntero;
    if (this.schermoIntero) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        // no-op
      }
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen().catch(() => {});
        }
      } catch {
        // no-op
      }
    }
  }

  /** Il browser consuma il primo Esc per uscire dal pieno schermo senza avvisare la pagina: si allinea qui lo stato dell'app. */
  private suFullscreenChange = (): void => {
    if (!document.fullscreenElement && this.schermoIntero) this.schermoIntero = false;
  };

  esciSchermoIntero(): void {
    if (!this.schermoIntero) return;
    this.schermoIntero = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      // no-op
    }
  }

  impostaTema(t: 'chiaro' | 'scuro'): void {
    this.tema = t;
  }

  alternaTema(): void {
    this.tema = this.tema === 'scuro' ? 'chiaro' : 'scuro';
  }

  static styles = css`
    :host { display: block; position: relative; width: 100%; height: 100vh; overflow: hidden; background: ${unsafeCSS(COLORI.sfondoApp)}; color: ${unsafeCSS(COLORI.testo)}; font-family: ${unsafeCSS(STILI.fontBase)}; }
    .intestazione { position: absolute; left: ${unsafeCSS(String(MISURE.intestazione.xTitolo))}px; top: ${unsafeCSS(String(MISURE.intestazione.y + 1))}px; height: ${unsafeCSS(String(MISURE.intestazione.altezza))}px; display: flex; align-items: center; gap: 8px; }
    /* intestazione come quella di pmb_sheets: etichetta col nome del programma, logo, nome del documento (un clic per rinominarlo), stato del salvataggio */
    /* logo orizzontale di pmb_docs (media/logo/Logo PMB Docs Orizzontale): a sinistra, alto quanto titolo e menu insieme e oltre, così si legge anche il sottotitolo; versione con le scritte chiare per il tema scuro */
    .logo-app { position: absolute; left: ${unsafeCSS(String(MISURE.logo.x))}px; top: ${unsafeCSS(String(MISURE.logo.y))}px; width: ${unsafeCSS(String(MISURE.logo.larghezza))}px; height: ${unsafeCSS(String(MISURE.logo.altezza))}px; background: url("${unsafeCSS(LOGO_PMB_DOCS_ORIZZONTALE)}") no-repeat left center / contain; user-select: none; }
    /* il logo ufficiale ha i testi scuri: nel tema scuro sta su un riquadro chiaro, come in pmb_sheets (mai una versione ricolorata) */
    :host([tema="scuro"]) .logo-app { background-color: #ffffff; background-origin: content-box; padding: 4px 10px; box-sizing: border-box; border-radius: 8px; }
    /* finestra stretta: il logo resta grande (i menu sono sotto); il nome del documento si accorcia con i puntini */
    @media (max-width: 999px) { .titolo-documento { max-width: 180px; } }
    .titolo-documento { order: 2; font: 500 16px ${unsafeCSS(STILI.fontBase)}; color: ${unsafeCSS(COLORI.testo)}; padding: 2px 6px; border-radius: 4px; white-space: nowrap; max-width: 420px; overflow: hidden; text-overflow: ellipsis; }
    span.titolo-documento { cursor: text; }
    span.titolo-documento:hover { background: #e8eaed; }
    span.titolo-documento:focus-visible { outline: 2px solid #0b57d0; outline-offset: 1px; }
    input.titolo-documento { width: 320px; padding: 1px 5px; border: 1px solid #0b57d0; outline: none; background: #ffffff; box-sizing: border-box; height: 26px; }
    .stato-salvataggio { order: 3; flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; font: 12px Roboto, Arial, sans-serif; color: #5f6368; user-select: none; }
    .stato-salvataggio svg { width: 16px; height: 16px; color: #188038; }
    .stato-salvataggio.da-salvare .punto { width: 8px; height: 8px; border-radius: 50%; background: #e37400; }
    :host([tema="scuro"]) span.titolo-documento:hover { background: #3c4043; }
    :host([tema="scuro"]) input.titolo-documento { background: #1e1f20; color: #e3e3e3; border-color: #a8c7fa; }
    :host([tema="scuro"]) .stato-salvataggio { color: #c4c7c5; }
    :host([tema="scuro"]) .stato-salvataggio svg { color: #6dd58c; }
    /* l'icona del documento a sinistra del titolo (disegno originale di pmb_docs: quaderno con la costa e tre righe) */
    /* barra di scorrimento sottile */
    .area-editor::-webkit-scrollbar { width: 15px; height: 15px; }
    .area-editor::-webkit-scrollbar-track, .area-editor::-webkit-scrollbar-corner { background: transparent; }
    .area-editor::-webkit-scrollbar-button { display: none; }
    .area-editor::-webkit-scrollbar-thumb { background: #e1e3e1; background-clip: padding-box; border-style: solid; border-color: transparent; border-width: 0 4px 0 3px; border-radius: 8px; }
    docs-menubar { position: absolute; left: ${unsafeCSS(String(MISURE.barraMenu.x))}px; top: ${unsafeCSS(String(MISURE.barraMenu.y + 4))}px; }
    .contenitore-strumenti { position: absolute; left: ${unsafeCSS(String(MISURE.barraStrumenti.x))}px; right: ${unsafeCSS(String(MISURE.barraStrumenti.margineLaterale))}px; top: ${unsafeCSS(String(MISURE.barraStrumenti.y))}px; }
    .righello { position: absolute; left: ${unsafeCSS(String(MISURE.righello.x))}px; right: ${unsafeCSS(String(MISURE.barraStrumenti.margineLaterale))}px; top: ${unsafeCSS(String(MISURE.righello.y))}px; height: ${unsafeCSS(String(MISURE.righello.altezza))}px; background: ${unsafeCSS(COLORI.sfondoApp)}; border-bottom: 1px solid #c4c7c5; display: flex; justify-content: flex-start; padding-left: max(calc(var(--sx-minimo, 301px) - 16px), calc((100vw - var(--larghezza-foglio, 794px) - 38px) / 2 - 16px)); overflow: hidden; }
    .area-editor { position: absolute; left: 0; right: 0; top: ${unsafeCSS(String(MISURE.areaEditor.y))}px; bottom: 0; overflow: auto; display: flex; justify-content: flex-start; align-items: flex-start; }
    .pagina { position: relative; flex: none; margin-left: max(var(--sx-minimo, 301px), calc((100vw - var(--larghezza-foglio, 794px) - 38px) / 2)); width: ${unsafeCSS(String(MISURE.pagina.larghezza))}px; margin-top: ${unsafeCSS(String(MISURE.pagina.y - MISURE.areaEditor.y))}px; margin-bottom: 24px; }
    .trascina { position: absolute; left: 0; top: 0; right: 138px; height: 64px; -webkit-app-region: drag; }
    .intestazione, docs-menubar, .contenitore-strumenti { -webkit-app-region: no-drag; }
    docs-trova { position: absolute; right: 28px; top: 222px; z-index: 15; -webkit-app-region: no-drag; }
    docs-tabella { position: absolute; right: 28px; top: 222px; z-index: 16; -webkit-app-region: no-drag; }
    docs-margini { position: absolute; right: 28px; top: 222px; z-index: 16; -webkit-app-region: no-drag; }
    :host([con-schede]) .pagina { margin-left: max(232px, var(--sx-minimo, 301px), calc((100vw - var(--larghezza-foglio, 794px) - 38px) / 2)); }
    docs-schede { position: absolute; left: 12px; top: 212px; bottom: 16px; width: 200px; z-index: 12; -webkit-app-region: no-drag; }
    @media (max-width: 1100px) { docs-schede { width: 150px; } }
    docs-link { position: absolute; right: 28px; top: 222px; z-index: 16; -webkit-app-region: no-drag; }
    docs-conteggio, docs-imposta-pagina, docs-simboli, docs-versioni, docs-nota, docs-segnalibri, docs-informazioni, docs-segnala, docs-caratteri, docs-personalizza-barra, docs-aggiornamento, docs-ortografia, docs-dizionario, docs-preferenze, docs-equazione, docs-grafico, docs-disegno, docs-dettagli { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 25; -webkit-app-region: no-drag; }
    .avviso { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 20; max-width: 80%; padding: 14px 24px; border-radius: 4px; background: #323232; color: #ffffff; font-size: 14px; }
    .recupero { position: absolute; left: 50%; bottom: 76px; transform: translateX(-50%); z-index: 21; display: flex; align-items: center; gap: 16px; max-width: 80%; padding: 8px 8px 8px 24px; border-radius: 4px; background: #323232; color: #ffffff; font-size: 14px; }
    .recupero button { height: 36px; padding: 0 12px; border: 0; border-radius: 4px; background: none; color: #a8c7fa; font: inherit; font-weight: 500; cursor: default; }
    .recupero button:hover { background: rgba(255, 255, 255, 0.08); }
    .pagina docs-editor { display: block; }
    .righello-v { position: absolute; left: -26px; top: 0; -webkit-app-region: no-drag; }
    .pagina.senza-pagine .righello-v { display: none; }
    .pagina.zoom-50 { zoom: 0.5; }
    .pagina.zoom-75 { zoom: 0.75; }
    .pagina.zoom-90 { zoom: 0.9; }
    .pagina.zoom-100 { zoom: 1; }
    .pagina.zoom-125 { zoom: 1.25; }
    .pagina.zoom-150 { zoom: 1.5; }
    .pagina.zoom-200 { zoom: 2; }
    .pagina.orientamento-orizzontale.formato-a4 { width: 1123px; }
    .pagina.orientamento-verticale.formato-a4 { width: 794px; }
    .pagina.orientamento-verticale.formato-letter { width: 816px; }
    .pagina.orientamento-orizzontale.formato-letter { width: 1056px; }
    .pagina.orientamento-verticale.formato-a3 { width: 1123px; }
    .pagina.orientamento-orizzontale.formato-a3 { width: 1587px; }
    .pagina.orientamento-verticale.formato-a5 { width: 559px; }
    .pagina.orientamento-orizzontale.formato-a5 { width: 794px; }
    :host([senza-righello]) .righello { display: none; }
    :host([senza-righello]) .area-editor { top: 197px !important; }
    :host([senza-righello][menu-nascosti]) .area-editor { top: 58px !important; }
    /* menu nascosti: restano la barra degli strumenti, il righello e il foglio, tutto più in alto */
    :host([menu-nascosti]) .logo-app, :host([menu-nascosti]) .intestazione, :host([menu-nascosti]) docs-menubar { display: none !important; }
    :host([menu-nascosti]) .contenitore-strumenti { top: 10px; }
    :host([menu-nascosti]) .righello { top: 58px !important; }
    :host([menu-nascosti]) .area-editor { top: 74px !important; }
    :host([menu-nascosti]) docs-schede { top: 73px; }
    /* finestra bassa: logo a metà e tutto più in alto, per lasciare spazio al foglio (dopo le regole di «Mostra righello», così vince sulla posizione della finestra alta; quelle di «Nascondi i menu», più specifiche, restano valide) */
    @media (max-height: ${unsafeCSS(String(MISURE.compatta.altezzaFinestra))}px) {
      .logo-app { top: ${unsafeCSS(String(MISURE.compatta.logo.y))}px; width: ${unsafeCSS(String(MISURE.compatta.logo.larghezza))}px; height: ${unsafeCSS(String(MISURE.compatta.logo.altezza))}px; }
      .intestazione { top: ${unsafeCSS(String(MISURE.compatta.intestazione.y + 1))}px; left: ${unsafeCSS(String(MISURE.compatta.intestazione.xTitolo))}px; }
      docs-menubar { top: ${unsafeCSS(String(MISURE.compatta.barraMenu.y + 4))}px; }
      .contenitore-strumenti { top: ${unsafeCSS(String(MISURE.compatta.barraStrumenti.y))}px; }
      .righello { top: ${unsafeCSS(String(MISURE.compatta.righello.y))}px; }
      .area-editor { top: ${unsafeCSS(String(MISURE.compatta.areaEditor.y))}px; }
      docs-trova, docs-tabella, docs-margini, docs-link { top: ${unsafeCSS(String(MISURE.compatta.pannelli.y))}px; }
      docs-schede { top: ${unsafeCSS(String(MISURE.compatta.schede.y))}px; }
      :host([senza-righello]) .area-editor { top: ${unsafeCSS(String(MISURE.compatta.righello.y))}px !important; }
    }
    :host([schermo-intero]) .intestazione,
    :host([schermo-intero]) docs-menubar,
    :host([schermo-intero]) .contenitore-strumenti,
    :host([schermo-intero]) .righello,
    :host([schermo-intero]) .trascina { display: none !important; }
    :host([schermo-intero]) .area-editor { top: 0 !important; }
    .pagina.senza-pagine {
      width: min(960px, calc(100vw - 64px)) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      margin-top: 16px !important;
      box-shadow: none;
      border: none;
    }
    :host([tema="scuro"]) {
      background: #1e1f20;
      color: #e3e3e3;
    }
    :host([tema="scuro"]) .titolo-documento {
      color: #e3e3e3;
    }
    :host([tema="scuro"]) .righello {
      background: #1e1f20;
      border-bottom-color: #444746;
    }
    :host([tema="scuro"]) .area-editor::-webkit-scrollbar-thumb {
      background: #444746;
    }
    @media print {
      :host { height: auto; overflow: visible; background: #ffffff; }
      docs-schede, .trascina, .intestazione, docs-menubar, .contenitore-strumenti, .righello, docs-trova, docs-link, docs-finestra, .avviso { display: none; }
      .recupero { display: none; }
      .area-editor { position: static; display: block; overflow: visible; }
      .pagina { width: auto; margin: 0; }
      .righello-v { display: none; }
    }
  `;

  /** Il foglio sta al centro dell'area meno la barra di scorrimento: il righello lascia lo stesso spazio a destra. */
  private allineaRighello(): void {
    const area = this.renderRoot.querySelector<HTMLElement>('.area-editor');
    const righello = this.renderRoot.querySelector<HTMLElement>('.righello');
    if (!area || !righello) return;
    const barra = Math.max(0, area.offsetWidth - area.clientWidth);
    // senza barra di scorrimento non si scrive niente (l'attributo style non deve restare vuoto in giro)
    if (barra > 0) righello.style.paddingRight = `${barra}px`; else righello.removeAttribute('style');
  }
  private aggiornaLarghezza = () => { this.larghezza = window.innerWidth; this.allineaRighello(); };
  connectedCallback() { super.connectedCallback(); impostaLingua(risolviLingua(this.prefs.interfaccia)); this.recuperabile = this.recupero.trova(); window.addEventListener('pagehide', this.suPagehide); window.addEventListener('resize', this.aggiornaLarghezza); window.addEventListener('beforeprint', this.suPrimaDiStampare); window.addEventListener('afterprint', this.suDopoStampa); window.addEventListener('keydown', this.suTastoGuscio); window.addEventListener('mousedown', this.suPressioneCopiaFormato, true); window.addEventListener('mouseup', this.suRilascioCopiaFormato); document.addEventListener('fullscreenchange', this.suFullscreenChange); try { window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', this.suTemaSistema); } catch { /* senza matchMedia il tema di sistema resta quello letto all'avvio */ } this.aggiornaLarghezza(); }
  disconnectedCallback() { window.removeEventListener('pagehide', this.suPagehide); this.recupero.scriviOra(); window.removeEventListener('resize', this.aggiornaLarghezza); window.removeEventListener('beforeprint', this.suPrimaDiStampare); window.removeEventListener('afterprint', this.suDopoStampa); window.removeEventListener('keydown', this.suTastoGuscio); window.removeEventListener('mousedown', this.suPressioneCopiaFormato, true); window.removeEventListener('mouseup', this.suRilascioCopiaFormato); document.removeEventListener('fullscreenchange', this.suFullscreenChange); try { window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener('change', this.suTemaSistema); } catch { /* vedi connectedCallback */ } window.clearTimeout(this.timerAvviso); this.osservaArea?.disconnect(); super.disconnectedCallback(); }
  /** Stampa il documento (o lo salva in PDF dalla finestra di stampa): l'editor si prepara con prima della stampa e torna com'era dopo. */
  stampa(): void { window.print(); }
  private suPrimaDiStampare = (): void => { this.editor()?.preparaStampa(); };
  private suDopoStampa = (): void => { this.editor()?.finisciStampa(); };
  private editor(): DocsEditor | null { return this.renderRoot.querySelector<DocsEditor>('docs-editor'); }
  /** Se il sistema ha passato al programma un file («Apri con» o doppio clic; sul Mac dal Finder), lo apre. */
  private async apriDaAvvio(): Promise<void> {
    const nome = await chiamaTauri<string | null>('nome_file_di_avvio');
    if (!nome) return;
    const grezzo = await chiamaTauri<ArrayBuffer | ArrayLike<number>>('leggi_file_di_avvio');
    // la parte nativa manda i byte come ArrayBuffer o come elenco di numeri, secondo il percorso di Tauri
    const byte = grezzo instanceof ArrayBuffer ? new Uint8Array(grezzo) : grezzo && typeof grezzo.length === 'number' ? Uint8Array.from(grezzo as ArrayLike<number>) : null;
    if (!byte) { this.mostraAvviso(t('Non riesco a leggere "{}"', nome)); return; }
    await this.apriFile(new File([byte], nome), null);
  }

  protected firstUpdated(): void {
    const ed = this.editor();
    this.applicaPreferenze();
    this.avviaCaratteri();
    void this.apriDaAvvio();
    // su Mac, un file aperto dal Finder mentre il programma è già acceso (lo manda la parte nativa, src-tauri/src/lib.rs)
    window.addEventListener('file-dal-finder', () => { void this.apriDaAvvio(); });
    if (ed) {
      this.barra = statoBarra(ed.stato);
      (this.barra as any).zoom = this.zoom;
    }
    this.allineaRighello();
    const area = this.renderRoot.querySelector<HTMLElement>('.area-editor');
    if (area && typeof ResizeObserver !== 'undefined') {
      this.osservaArea = new ResizeObserver(() => this.allineaRighello());
      this.osservaArea.observe(area);
      const pagina = area.querySelector('.pagina');
      if (pagina) this.osservaArea.observe(pagina);
    }
  }
  private suComando = (e: Event): void => {
    const dettaglio = (e as CustomEvent).detail as { id?: string; rect?: DOMRect | null } | undefined;
    const id = String(dettaglio?.id ?? '');
    if (id === 'cerca') { void this.apriTrova(false); return; }
    if (id === 'link') { void this.apriLink(); return; }
    if (id === 'immagine') { void this.inserisciImmagine(); return; }
    if (id === 'stampa') { this.stampa(); return; }
    if (id === 'nascondi-menu') { this.alternaMenuNascosti(); return; }
    if (id === 'zoom') {
      const r = dettaglio?.rect;
      this.popupId = id;
      this.popupX = r ? r.left : 0;
      this.popupY = r ? r.bottom + 2 : 0;
      this.popup = popupZoom(this.zoom);
      return;
    }
    const NON_DISPONIBILI: Record<string, string> = {};
    if (id === 'copia-formato') {
      if (this.copiaFormatoAttiva) { this.annullaCopiaFormato(); this.mostraAvviso(t('Copia formato annullato')); return; }
      this.editor()?.copiaFormato();
      this.copiaFormatoAttiva = true;
      this.mostraAvviso(t('Formato copiato: seleziona con il mouse il testo a cui applicarlo (Esc per annullare)'));
      return;
    }
    if (id === 'ortografia') { void this.apriOrtografia(); return; }
    if (NON_DISPONIBILI[id]) { this.mostraAvviso(t(NON_DISPONIBILI[id])); return; }
    const popup = popupPerComando(id, this.barra ?? undefined);
    if (!popup) { this.editor()?.eseguiComando(id); return; }
    // un clic sul pulsante del menu già aperto lo chiude (il pointerdown l'ha già chiuso: non si riapre)
    if (this.ultimaChiusura && this.ultimaChiusura.id === id && performance.now() - this.ultimaChiusura.t < 400) return;
    const r = dettaglio?.rect;
    this.popupId = id;
    this.popupX = r ? r.left : 0;
    this.popupY = r ? r.bottom + 2 : 0;
    this.popup = popup;
  };
  private suScelta = (e: Event): void => {
    const azione = (e as CustomEvent).detail.azione;
    this.popup = null;
    if (azione?.tipo === 'scarica') { void this.scarica(azione.formato as FormatoId); return; }
    if (azione?.tipo === 'apri-caratteri') { this.apriCaratteri(); return; }
    if (azione?.tipo === 'zoom') {
      this.impostaZoom(Number(azione.valore));
      return;
    }
    this.editor()?.applicaAzione(azione);
  };

  /** Il titolo di un documento nuovo («Documento senza titolo») si scrive nella lingua corrente; un titolo scelto dall'utente resta com'è. */
  private titoloVisibile(titolo: string): string { return titolo === TITOLO_PREDEFINITO ? t(TITOLO_PREDEFINITO) : titolo; }

  private mostraAvviso(testo: string): void {
    this.avviso = testo;
    window.clearTimeout(this.timerAvviso);
    this.timerAvviso = window.setTimeout(() => { this.avviso = null; }, 6000);
  }

  private suPagehide = (): void => { this.recupero.scriviOra(); };

  /** Mette in coda la copia di emergenza se il documento o il titolo sono cambiati; finché c'è una copia da ripristinare non scrive niente. */
  private copiaDiEmergenza(): void {
    const ed = this.editor();
    if (!ed || this.recuperabile) return;
    const doc = ed.stato.doc;
    if (doc === this.ultimoDoc && this.titolo === this.ultimoTitolo && this.versioneSchede === this.ultimaVersioneSchede) return;
    this.ultimoDoc = doc;
    this.ultimoTitolo = this.titolo;
    this.ultimaVersioneSchede = this.versioneSchede;
    // con più schede la copia di emergenza tiene tutto il testo (le schede una dopo l'altra)
    this.recupero.segnala(this.titolo, this.schede.length > 1 ? () => this.documentoCompleto() : doc);
  }

  /** Rimette nell'editor il documento della copia di emergenza. */
  private ripristina(): void {
    const copia = this.recuperabile;
    const ed = this.editor();
    if (!copia || !ed) return;
    this.recuperabile = null;
    this.titolo = copia.titolo.trim() === '' ? TITOLO_PREDEFINITO : copia.titolo;
    this.unaScheda();
    ed.impostaStato({ doc: copia.doc, sel: cursore(0, 0), pendenti: null });
    this.docSalvati = null; // il testo ripristinato non è in nessun file
    ed.focalizza();
  }

  /** Butta via la copia di emergenza trovata all'avvio. */
  private scartaCopia(): void {
    if (!this.recuperabile) return;
    this.recupero.scarta();
    this.recuperabile = null;
    this.editor()?.focalizza();
  }
  /** Salva il documento nel formato scelto, col titolo come nome del file. */
  async scarica(formato: FormatoId): Promise<void> {
    const ed = this.editor();
    const f = FORMATI.find((x) => x.id === formato);
    if (!ed || !f) return;
    try {
      const istantanea = this.schedeComplete();
      const bytes = await esportaSchede(istantanea, formato);
      const m = await this.salva(nomeFile(this.titoloVisibile(this.titolo), formato), bytes, f.mime, this.origine);
      if (formato !== 'pdf' && m && typeof (m as ManiglioFile).createWritable === 'function') { this.maniglia = m as ManiglioFile; this.origine = null; this.formatoManiglia = formato; }
      this.segnaSalvato(istantanea); // salvato: la copia di emergenza non serve più (se non si è scritto altro nel frattempo)
    } catch (e) {
      this.mostraAvviso(t('Non riesco a salvare il file: {}', (e as Error).message));
    }
  }

  /** Salva sul file già scelto; se non c'è ancora, chiede dove (Salva con nome). */
  async salvaDocumento(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    if (!this.maniglia) { await this.scarica(this.formatoManiglia); return; }
    // un file aperto con Apri è di sola lettura: la prima volta si passa da "Salva con nome", già posizionato sul file
    if (!(await assicuraScrittura(this.maniglia))) {
      this.origine = this.maniglia;
      this.maniglia = null;
      await this.scarica(this.formatoManiglia);
      return;
    }
    try {
      const istantanea = this.schedeComplete();
      const bytes = await esportaSchede(istantanea, this.formatoManiglia);
      await scriviSuManiglia(this.maniglia, bytes);
      this.segnaSalvato(istantanea);
      this.mostraAvviso(t('Documento salvato'));
    } catch (e) {
      this.origine = this.maniglia;
      this.maniglia = null; // file non più disponibile: si chiede dove salvare
      this.mostraAvviso(t('Non riesco a salvare sul file: {}. Scegli dove salvare.', (e as Error).message));
      await this.scarica(this.formatoManiglia);
    }
  }

  /** Chiede un file e lo apre al posto del documento attuale. */
  async apri(): Promise<void> {
    const ed = this.editor();
    const scelto = await this.scegli();
    if (!ed || !scelto) return;
    const file = scelto instanceof File ? scelto : scelto.file;
    const maniglia = scelto instanceof File ? null : scelto.maniglia;
    await this.apriFile(file, maniglia);
  }

  /** Apre un file già in mano (scelto nella finestra di Apri, oppure passato da Windows con «Apri con» o doppio clic). */
  async apriFile(file: File, maniglia: ManiglioFile | null): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    try {
      const r = await importa(new Uint8Array(await file.arrayBuffer()), file.name);
      if (r.schede) this.caricaSchede(r.schede); else { this.unaScheda(); ed.impostaStato({ doc: r.doc, sel: cursore(0, 0), pendenti: null }); }
      this.recupero.scarta(); // il file aperto è già su disco
      this.ricordaSalvato(this.schedeComplete());
      this.titolo = titoloDaNome(file.name);
      this.titoloDocSalvato = this.titolo;
      const est = file.name.split('.').pop()?.toLowerCase() ?? '';
      const scrivibile = FORMATI.find((x) => x.estensione === est);
      this.maniglia = maniglia && scrivibile ? maniglia : null;
      this.origine = null;
      this.formatoManiglia = scrivibile ? scrivibile.id : 'docx';
      this.avviso = null;
      ed.focalizza();
    } catch (e) {
      this.mostraAvviso(t('Non riesco ad aprire "{}": {}', file.name, (e as Error).message));
    }
  }

  nuovo(): void {
    this.unaScheda();
    this.editor()?.impostaStato(statoIniziale());
    this.ricordaSalvato(this.schedeComplete());
    this.recupero.scarta(); // documento nuovo: niente da recuperare
    this.maniglia = null;
    this.origine = null;
    this.formatoManiglia = 'docx';
    this.titolo = TITOLO_PREDEFINITO;
    this.titoloDocSalvato = TITOLO_PREDEFINITO;
    this.editor()?.focalizza();
  }

  private trova(): DocsTrova | null { return this.renderRoot.querySelector<DocsTrova>('docs-trova'); }

  /** Apre la barra di ricerca (con la riga della sostituzione se richiesto); se c'è del testo selezionato lo cerca subito. */
  async apriTrova(sostituzione: boolean): Promise<void> {
    const ed = this.editor();
    const selezionato = ed ? ed.testoSelezionato() : '';
    this.sostituzione = sostituzione || (this.trovaAperta && this.sostituzione);
    this.trovaAperta = true;
    await this.updateComplete;
    const t = this.trova();
    if (!t) return;
    if (selezionato !== '') t.impostaQuery(selezionato);
    t.focalizza();
  }

  private dialogoLink(): DocsLink | null { return this.renderRoot.querySelector<DocsLink>('docs-link'); }

  /** Apre il dialogo del link: con del testo selezionato lo trasforma in link, col cursore su un link lo modifica, altrimenti ne scrive uno nuovo. */
  async apriLink(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    this.datiLink = ed.linkAttuale();
    this.linkAperto = true;
    await this.updateComplete;
    this.dialogoLink()?.focalizza();
  }

  private dialogoTabella(): DocsTabella | null { return this.renderRoot.querySelector<DocsTabella>('docs-tabella'); }

  /**
   * Apre il dialogo di intestazione e piè di pagina con quello che c'è nel documento. Con numeroPagina, se il piè di pagina è vuoto,
   * lo prepara con il numero di pagina a destra (come Inserisci > Numeri di pagina).
   */
  async apriMargini(zona: 'intestazione' | 'piede', numeroPagina = false): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    const doc = ed.stato.doc;
    let piede = testoDaParagrafi(doc.piede);
    let alPiede = allineamentoMargine(doc.piede);
    if (numeroPagina && piede === '') { piede = '{pagina}'; alPiede = 'dx'; }
    this.margini = { zona, intestazione: testoDaParagrafi(doc.intestazione), piede, alIntestazione: allineamentoMargine(doc.intestazione), alPiede };
    await this.updateComplete;
    this.renderRoot.querySelector<DocsMargini>('docs-margini')?.focalizza();
  }
  private chiudiMargini(): void {
    if (!this.margini) return;
    this.margini = null;
    this.editor()?.focalizza();
  }
  private suMarginiApplica = (e: Event): void => {
    const d = (e as CustomEvent).detail as { intestazione?: Paragrafo[]; piede?: Paragrafo[] };
    this.margini = null;
    this.editor()?.applicaAzione({ tipo: 'margini', intestazione: d.intestazione, piede: d.piede });
  };
  /** Apre il dialogo per inserire una tabella; dentro una tabella non si può. */
  async apriTabella(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    if (ed.inTabella()) { this.mostraAvviso(t('Non si può inserire una tabella dentro un\'altra tabella')); return; }
    this.tabellaAperta = true;
    await this.updateComplete;
    this.dialogoTabella()?.focalizza();
  }
  private chiudiTabella(): void {
    if (!this.tabellaAperta) return;
    this.tabellaAperta = false;
    this.editor()?.focalizza();
  }
  private suTabellaApplica = (e: Event): void => {
    const d = (e as CustomEvent).detail as { righe: number; colonne: number };
    this.tabellaAperta = false;
    this.editor()?.applicaAzione({ tipo: 'tabella', righe: d.righe, colonne: d.colonne });
  };

  /** Le voci dei sottomenu del menu Formato che dipendono dal punto del documento (stile, allineamento, interlinea, elenco,
   *  tabella, immagine): le stesse dei riquadri della barra degli strumenti, con la spunta sulla scelta attuale. */
  private sottovociMenu = (menu: string, voce: string): SottovoceDinamica[] => {
    if (menu !== 'formato') return [];
    const s = this.barra ?? undefined;
    switch (voce) {
      case 'Allinea e applica rientro': return popupAllineaRientro(s).voci;
      case 'Interlinea e spaziatura paragrafo': return popupPerComando('interlinea', s)?.voci ?? [];
      case 'Stili paragrafo': return popupPerComando('stile-paragrafo', s)?.voci ?? [];
      case 'Elenchi puntati e numerati': return popupElenchi(s).voci;
      case 'Tabella': return this.editor()?.inTabella() ? popupTabella().voci : [{ etichetta: t('Metti il cursore in una tabella'), disabilitata: true }];
      case 'Immagine': return this.editor()?.immagineSelezionata() ? popupImmagine().voci : [{ etichetta: t('Seleziona prima un\'immagine'), disabilitata: true }];
      default: return [];
    }
  };
  /** Scelta in uno di quei sottomenu: si applica come la stessa scelta fatta nel riquadro della barra. */
  private suAzioneMenu = (e: Event): void => {
    this.suScelta(new CustomEvent('scelta', { detail: { azione: (e as CustomEvent).detail.azione } }));
  };

  /** Apre il popup di una voce del menu Formato che sulla barra strumenti ha il suo pulsante, sotto il titolo "Formato". Dice se la voce era una di queste. */
  private apriPopupFormato(voce: string): boolean {
    const s = this.barra ?? undefined;
    let id: string;
    let popup: Popup | null;
    switch (voce) {
      case 'Allinea e applica rientro': id = 'allineamento-rientro'; popup = popupAllineaRientro(s); break;
      case 'Interlinea e spaziatura paragrafo': id = 'interlinea'; popup = popupPerComando(id, s); break;
      case 'Stili paragrafo': id = 'stile-paragrafo'; popup = popupPerComando(id, s); break;
      case 'Elenchi puntati e numerati': id = 'elenchi'; popup = popupElenchi(s); break;
      default: return false;
    }
    if (!popup) return false;
    const titolo = this.renderRoot.querySelector('docs-menubar')?.shadowRoot?.querySelector('[data-menu="formato"]');
    const r = titolo ? titolo.getBoundingClientRect() : null;
    this.popupId = id;
    this.popupX = r ? r.left : 0;
    this.popupY = r ? r.bottom + 2 : 0;
    this.popup = popup;
    return true;
  }
  /** Mette un'immagine nel documento: quella data (incollata) o una scelta da un file. Se non è ammessa avvisa. */
  async inserisciImmagine(dato?: Blob | null): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    const file = dato ?? (await this.scegliImmagine());
    if (!file) return;
    const immagine = await this.caricaImmagine(file);
    if (!immagine) { this.mostraAvviso(t('Immagine non ammessa: servono png, jpeg, gif o webp fino a 5 MB')); return; }
    ed.applicaAzione({ tipo: 'immagine', immagine });
  }
  private suImmagineIncollata = (e: Event): void => { void this.inserisciImmagine((e as CustomEvent).detail.file as Blob); };

  private chiudiLink(): void {
    if (!this.linkAperto) return;
    this.linkAperto = false;
    this.editor()?.focalizza();
  }
  private suLinkApplica = (e: Event): void => {
    const d = (e as CustomEvent).detail as { url: string; testo?: string };
    this.linkAperto = false;
    this.editor()?.applicaAzione({ tipo: 'link', url: d.url, testo: d.testo });
  };
  private suLinkRimuovi = (): void => {
    this.linkAperto = false;
    this.editor()?.applicaAzione({ tipo: 'togliLink' });
  };
  private suApriLink = (e: Event): void => { void apriIndirizzo(String((e as CustomEvent).detail.url ?? '')); };

  private chiudiTrova(): void {
    if (!this.trovaAperta) return;
    this.trovaAperta = false;
    this.editor()?.azzeraRicerca();
    this.editor()?.focalizza();
  }

  private suRicerca = (e: Event): void => {
    const d = (e as CustomEvent).detail as { query: string; opzioni: OpzioniRicerca };
    const ed = this.editor();
    if (ed) this.ricerca = ed.cerca(d.query, d.opzioni);
  };
  private suPasso = (passo: 1 | -1) => (): void => {
    const ed = this.editor();
    if (ed) this.ricerca = ed.vaiAlRisultato(passo);
  };
  private suSostituisci = (e: Event): void => {
    const ed = this.editor();
    if (ed) this.ricerca = ed.sostituisciCorrente(String((e as CustomEvent).detail.sostituto ?? ''));
  };
  private suSostituisciTutto = (e: Event): void => {
    const ed = this.editor();
    if (!ed) return;
    const r = ed.sostituisciTutto(String((e as CustomEvent).detail.sostituto ?? ''));
    this.ricerca = r;
    this.mostraAvviso(r.conteggio === 1 ? t('Sostituita 1 occorrenza') : t('Sostituite {} occorrenze', r.conteggio));
  };

  private suVoceMenu = (e: Event): void => {
    const { menu, voce } = (e as CustomEvent).detail as { menu: string; voce: string };
    if (menu === 'modifica') {
      if (voce === 'Trova e sostituisci') { void this.apriTrova(true); return; }
      const ed = this.editor();
      if (!ed) return;
      if (voce === 'Annulla') { ed.annulla(); return; }
      if (voce === 'Ripeti') { ed.ripeti(); return; }
      if (voce === 'Seleziona tutto') { ed.selezionaTutto(); return; }
      if (voce === 'Elimina') { ed.elimina(); return; }
      if (voce === 'Copia') { void ed.copia(); return; }
      if (voce === 'Taglia') { void ed.taglia(); return; }
      if (voce === 'Incolla' || voce === 'Incolla senza formattazione') { void ed.incolla(); return; }
      if (voce === 'Conteggio parole') { void this.apriConteggio(); return; }
    }
    if (menu === 'strumenti' && voce === 'Conteggio parole') { void this.apriConteggio(); return; }
    if (menu === 'visualizza' && voce === 'Mostra layout di stampa') { this.alternaModalitaPagine(); return; }
    if (menu === 'formato' && voce === 'Orientamento pagina') {
      const o = this.impostazioniPagina.orientamento === 'verticale' ? 'orizzontale' : 'verticale';
      this.impostaImpostazioniPagina({ ...this.impostazioniPagina, orientamento: o });
      return;
    }
    if (menu === 'visualizza' && voce === 'Mostra righello') { this.righelloVisibile = !this.righelloVisibile; this.toggleAttribute('senza-righello', !this.righelloVisibile); return; }
    if (menu === 'visualizza' && voce === 'Mostra caratteri non stampabili') { this.alternaCaratteriNonStampabili(); return; }
    if (menu === 'visualizza' && voce === 'Schermo intero') { this.alternaSchermoIntero(); return; }
    if (menu === 'visualizza' && voce === 'Nascondi i menu') { this.alternaMenuNascosti(); return; }
    if (menu === 'visualizza' && voce === 'Personalizza barra degli strumenti') { this.apriPersonalizza(); return; }
    if (menu === 'visualizza' && voce === 'Tema scuro') { this.cambiaPreferenze({ tema: 'scuro' }); return; }
    if (menu === 'visualizza' && voce === 'Tema chiaro') { this.cambiaPreferenze({ tema: 'chiaro' }); return; }
    if (menu === 'visualizza' && voce === 'Tema di sistema') { this.cambiaPreferenze({ tema: 'sistema' }); return; }
    if (menu === 'visualizza' && voce === 'Alterna tema') { this.cambiaPreferenze({ tema: this.tema === 'scuro' ? 'chiaro' : 'scuro' }); return; }
    if (menu === 'visualizza' && voce === 'Zoom') {
      const titolo = this.renderRoot.querySelector('docs-menubar')?.shadowRoot?.querySelector('[data-menu="visualizza"]');
      const r = titolo ? titolo.getBoundingClientRect() : null;
      this.popupId = 'zoom';
      this.popupX = r ? r.left : 0;
      this.popupY = r ? r.bottom + 2 : 0;
      this.popup = popupZoom(this.zoom);
      return;
    }
    if (menu === 'inserisci' && voce === 'Link') { void this.apriLink(); return; }
    if (menu === 'inserisci' && voce === 'Tabella') { void this.apriTabella(); return; }
    if (menu === 'formato' && voce === 'Intestazioni e piè di pagina') { void this.apriMargini('intestazione'); return; }
    if (menu === 'formato' && voce === 'Numeri di pagina') { void this.apriMargini('piede', true); return; }
    if (menu === 'formato' && (voce === 'Passa al formato Senza pagine' || voce === 'Passa al formato Pagine')) {
      this.alternaModalitaPagine();
      return;
    }
    if (menu === 'inserisci' && voce === 'Immagine') { void this.inserisciImmagine(); return; }
    if (menu === 'inserisci' && voce === 'Salto di pagina') { this.editor()?.inserisciSaltoPagina(); return; }
    if (menu === 'inserisci' && voce === 'Linea orizzontale') { this.editor()?.inserisciLineaOrizzontale(); return; }
    if (menu === 'inserisci' && (voce === 'Simboli' || voce === 'Caratteri speciali')) { this.apriSimboli(); return; }
    if (menu === 'formato' && (e as CustomEvent).detail.padre === 'Bordi e linee') {
      const v = VOCI_BORDO.find((x) => x.etichetta === voce);
      if (v) { this.editor()?.applicaAzione({ tipo: 'bordo', parziale: v.parziale }); this.editor()?.focalizza(); }
      return;
    }
    if (menu === 'inserisci' && voce === 'Equazione') { this.apriFinestraImmagine('equazione'); return; }
    if (menu === 'inserisci' && (e as CustomEvent).detail.padre === 'Disegno') { this.apriFinestraImmagine('disegno'); return; }
    if (menu === 'inserisci' && (e as CustomEvent).detail.padre === 'Grafico') {
      const t = TIPI_GRAFICO.find(([, nome]) => nome === voce);
      if (t) this.apriFinestraImmagine(t[0]);
      return;
    }
    if (menu === 'visualizza' && voce === 'Mostra barra degli strumenti delle equazioni') {
      this.cambiaPreferenze({ barraEquazioni: !this.prefs.barraEquazioni });
      this.mostraAvviso(this.prefs.barraEquazioni ? t('Barra delle equazioni visibile nella finestra Equazione') : t('Barra delle equazioni nascosta'));
      return;
    }
    if (menu === 'segnalazione') { this.segnalaProblema(); return; }
    if (menu === 'informazioni') {
      if (voce.startsWith('Segnala')) { this.segnalaProblema(); return; }
      if (voce.startsWith('Installa un aggiornamento')) { this.apriAggiornamento(); return; }
      this.apriInformazioni(voce.startsWith('Condizioni') ? 'condizioni' : voce.startsWith('Licenze') ? 'licenze' : 'info');
      return;
    }
    if (menu === 'inserisci' && voce === 'Tab') { this.nuovaScheda(); return; }
    if (menu === 'inserisci' && voce === 'Segnalibro') { this.apriSegnalibri(); return; }
    if (menu === 'inserisci' && (e as CustomEvent).detail.padre === 'Componenti di base') {
      const c = COMPONENTI.find((x) => x.nome === voce);
      if (c && !this.editor()?.inserisciComponente((id) => c.costruisci(id, new Date()))) this.mostraAvviso(t('Metti il cursore fuori da una tabella per inserire questo componente'));
      else if (c) this.editor()?.focalizza();
      return;
    }
    if (menu === 'file' && (e as CustomEvent).detail.padre === 'Correttore lingua') {
      const lingua = LINGUE.find(([, nome]) => nome === voce);
      if (lingua) { this.cambiaPreferenze({ lingua: lingua[0] }); this.mostraAvviso(t('Lingua del correttore: {}', lingua[1])); }
      return;
    }
    if (menu === 'strumenti' && (e as CustomEvent).detail.padre === 'Ortografia e grammatica') {
      if (voce === 'Controlla ortografia') { void this.apriOrtografia(); return; }
      if (voce === 'Sottolinea gli errori mentre scrivi') { this.cambiaPreferenze({ ortografia: !this.prefs.ortografia }); this.mostraAvviso(this.prefs.ortografia ? t('Errori di ortografia sottolineati') : t('Errori di ortografia non sottolineati')); return; }
    }
    if (menu === 'strumenti' && voce === 'Dizionario') { this.apriDizionario(); return; }
    if (menu === 'strumenti' && voce === 'Caratteri personali') { this.apriCaratteri(); return; }
    if (menu === 'strumenti' && voce === 'Preferenze') { this.apriPreferenze('preferenze'); return; }
    if (menu === 'strumenti' && voce === 'Accessibilità') { this.apriPreferenze('accessibilita'); return; }
    if (menu === 'strumenti' && voce === 'Numeri di riga') { this.alternaNumeriRiga(); return; }
    if (menu === 'inserisci' && (voce === 'Nota a piè di pagina' || voce === 'Nota')) { this.apriNotaPiePagina(); return; }
    if (menu === 'formato' && voce === 'Immagine') {
      if (!this.editor()?.immagineSelezionata()) { this.mostraAvviso(t('Seleziona prima un\'immagine')); return; }
      const titolo = this.renderRoot.querySelector('docs-menubar')?.shadowRoot?.querySelector('[data-menu="formato"]');
      const r = titolo ? titolo.getBoundingClientRect() : null;
      this.popupId = 'immagine';
      this.popupX = r ? r.left : 0;
      this.popupY = r ? r.bottom + 2 : 0;
      this.popup = popupImmagine();
      return;
    }
    if (menu === 'formato' && voce === 'Tabella') {
      if (!this.editor()?.inTabella()) { this.mostraAvviso(t('Metti il cursore in una tabella')); return; }
      const titolo = this.renderRoot.querySelector('docs-menubar')?.shadowRoot?.querySelector('[data-menu="formato"]');
      const r = titolo ? titolo.getBoundingClientRect() : null;
      this.popupId = 'tabella';
      this.popupX = r ? r.left : 0;
      this.popupY = r ? r.bottom + 2 : 0;
      this.popup = popupTabella();
      return;
    }
    if (menu === 'formato' && voce === 'Cancella formattazione') {
      this.editor()?.cancellaFormattazione();
      return;
    }
    if (menu === 'formato' && (e as CustomEvent).detail.padre === 'Testo') { this.editor()?.eseguiComando(voce.toLowerCase()); return; }
    if (menu === 'formato' && (e as CustomEvent).detail.padre === 'Colonne') {
      const v = (e as CustomEvent).detail.voce;
      if (v === '1 colonna') this.impostaColonne(1);
      else if (v === '2 colonne') this.impostaColonne(2);
      else if (v === '3 colonne') this.impostaColonne(3);
      return;
    }
    if (menu === 'formato' && this.apriPopupFormato(voce)) return;
    if (menu !== 'file') return;
    if (voce === 'Stampa' || voce === 'Anteprima di stampa') { this.stampa(); return; }
    if (voce === 'Nuovo' || voce === 'Documento di testo') this.nuovoConConferma();
    else if (voce === 'Foglio di calcolo') {
      try { window.open('../pmb_sheets/index.html', '_blank'); } catch {}
      return;
    }
    else if (voce === 'Dettagli') this.apriDettagli();
    else if (voce === 'Apri') void this.apriConConferma();
    else if (voce === 'Salva') void this.salvaDocumento();
    else if (voce === 'Salva con nome') { this.maniglia = null; void this.scarica(this.formatoManiglia); }
    else if (voce === 'Rinomina') { this.iniziaTitolo(); }
    else if (voce === 'Impostazione pagina') {
      this.apriImpostaPagina();
      return;
    } else if (voce === 'Cronologia versioni' || voce === 'Vedi la cronologia delle versioni') {
      this.apriVersioni();
      return;
    } else if (voce.includes('.docx')) { void this.scarica('docx'); }
    else if (voce.includes('.odt')) { void this.scarica('odt'); }
    else if (voce.includes('.pdf')) { void this.scarica('pdf'); }
    else if (voce.includes('.txt')) { void this.scarica('txt'); }
    else if (voce.includes('.pdoc') || voce.includes('.fdoc')) { void this.scarica('fdoc'); }
  };

  private suPressioneCopiaFormato = (e: MouseEvent): void => {
    const ed = this.editor();
    this.pressioneNellEditor = !!ed && e.composedPath().includes(ed);
  };
  /** Copia formato: appena si finisce di selezionare del testo nell'editor, ci si applica il formato copiato. */
  private suRilascioCopiaFormato = (): void => {
    if (!this.copiaFormatoAttiva || !this.pressioneNellEditor) return;
    this.pressioneNellEditor = false;
    const ed = this.editor();
    if (ed?.applicaFormatoCopiato()) this.copiaFormatoAttiva = false;
  };
  private annullaCopiaFormato(): void {
    this.editor()?.annullaCopiaFormato();
    this.copiaFormatoAttiva = false;
  }
  private suTastoGuscio = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.copiaFormatoAttiva && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.annullaCopiaFormato(); this.mostraAvviso(t('Copia formato annullato')); return; }
    if (e.key === 'F11' && e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.nuovaScheda(); return; } // Maiusc+F11: nuova scheda
    if (e.key === 'F11') { e.preventDefault(); this.alternaSchermoIntero(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); this.alternaMenuNascosti(); return; }
    if (e.key === 'Escape' && this.schermoIntero && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.esciSchermoIntero(); return; }
    if (e.key === 'Escape' && this.tabellaAperta && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiTabella(); return; }
    if (e.key === 'Escape' && this.margini && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiMargini(); return; }
    if (e.key === 'Escape' && this.linkAperto && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiLink(); return; }
    if (e.key === 'Escape' && this.trovaAperta && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiTrova(); return; }
    if (e.key === 'Escape' && this.conteggioAperto && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiConteggio(); return; }
    if (e.key === 'Escape' && this.dettagliAperti && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiDettagli(); return; }
    if (e.key === 'Escape' && this.impostaPaginaAperta && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiImpostaPagina(); return; }
    if (e.key === 'Escape' && this.simboliAperto && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiSimboli(); return; }
    if (e.key === 'Escape' && this.versioniAperte && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiVersioni(); return; }
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && this.chiudiUltimaFinestra()) { e.preventDefault(); return; }
    if (e.key === 'F7' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); void this.apriOrtografia(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.apriDizionario(); return; }
    if (e.key === 'Escape' && this.notaAperta && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.chiudiNotaPiePagina(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
      e.preventDefault();
      this.alternaCaratteriNonStampabili();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
      e.preventDefault();
      this.apriNotaPiePagina();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.maniglia = null; void this.scarica(this.formatoManiglia); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) { e.preventDefault(); void this.apriConteggio(); return; }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); void this.salvaDocumento(); }
    else if (k === 'o') { e.preventDefault(); void this.apriConConferma(); }
    else if (k === 'f') { e.preventDefault(); void this.apriTrova(false); }
    else if (k === 'h') { e.preventDefault(); void this.apriTrova(true); }
    else if (k === 'k') { e.preventDefault(); void this.apriLink(); }
    else if (k === 'p') { e.preventDefault(); this.stampa(); }
    else if (k === '=' || k === '+') { e.preventDefault(); this.passoZoom(1); }
    else if (k === '-') { e.preventDefault(); this.passoZoom(-1); }
    else if (k === '0') { e.preventDefault(); this.impostaZoom(100); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'c' || e.code === 'KeyC')) { e.preventDefault(); void this.apriConteggio(); return; }
  };
  private suChiudi = (e: Event): void => {
    this.ultimaChiusura = { id: this.popupId, t: performance.now() };
    this.popup = null;
    if ((e as CustomEvent).detail?.tastiera) this.editor()?.focalizza();
  };
  private suCambio = (e: Event): void => {
    this.barra = statoBarra((e as CustomEvent).detail.stato);
    this.copiaDiEmergenza();
    if (this.trovaAperta) { const ed = this.editor(); if (ed) this.ricerca = ed.statoRicerca(); }
    this.allineaRighello();
  };

  private suCambioMargineRighello = (e: CustomEvent<{ tipo: 'sinistro' | 'destro'; valore: number }>): void => {
    const { tipo, valore } = e.detail;
    const imp = { ...this.impostazioniPagina };
    if (tipo === 'sinistro') imp.margineSinistro = valore;
    else imp.margineDestro = valore;
    this.impostaImpostazioniPagina(imp);
  };

  private suCambioMargineVerticale = (e: CustomEvent<{ tipo: 'alto' | 'basso'; valore: number }>): void => {
    const { tipo, valore } = e.detail;
    const imp = { ...this.impostazioniPagina };
    if (tipo === 'alto') imp.margineAlto = valore;
    else imp.margineBasso = valore;
    this.impostaImpostazioniPagina(imp);
  };

  render() {
    return html`
      <div class="trascina"></div>
      <span class="logo-app" role="img" aria-label="pmb_docs" title="pmb_office — suite per ufficio che lavora sul tuo computer"></span>
      <div class="intestazione">
        ${this.titoloInModifica
          ? html`<input class="titolo-documento" type="text" aria-label="Nome del documento" .value=${this.titoloVisibile(this.titolo)} @keydown=${this.suTastoTitolo} @blur=${(e: FocusEvent) => this.fineTitolo((e.target as HTMLInputElement).value)} />`
          : html`<span class="titolo-documento" role="button" tabindex="0" title="Fai clic per rinominare" @click=${() => this.iniziaTitolo()} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.iniziaTitolo(); } }}>${this.titoloVisibile(this.titolo)}</span>`}
        ${this.modificato() || !this.maniglia
          ? html`<span class="stato-salvataggio da-salvare" title="Ci sono modifiche che non sono ancora in un file: salvale con File › Salva" @click=${() => void this.salvaDocumento()}><span class="punto"></span><span>${this.maniglia ? t('Modifiche non salvate') : t('Non salvato su disco (Ctrl+S)')}</span></span>`
          : html`<span class="stato-salvataggio" title="Il documento è salvato sul tuo computer come file"><svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg><span>Salvato su disco</span></span>`}
      </div>
      <docs-menubar .spuntate=${this.vociSpuntate()} .sottovoci=${this.sottovociMenu} @voce-menu=${this.suVoceMenu} @azione-menu=${this.suAzioneMenu}></docs-menubar>
      <div class="contenitore-strumenti"><docs-toolbar .larghezza=${this.larghezza} .valori=${{ ...(this.barra?.valori ?? {}), 'zoom': `${this.zoom}% ▾` }} .attivi=${[...(this.barra?.attivi ?? []), ...(this.copiaFormatoAttiva ? ['copia-formato'] : []), ...(this.prefs.ortografia ? ['ortografia'] : [])]} .barra=${this.prefs.barra} ?menuNascosti=${this.prefs.menuNascosti} @comando=${this.suComando} @voce-menu=${this.suVoceMenu} @barra-cambiata=${this.suBarraCambiata} @personalizza-barra=${() => this.apriPersonalizza()}></docs-toolbar></div>
      <div class="righello" aria-label="Righello">${this.righelloVisibile ? html`<docs-righello .geometria=${{ larghezza: calcolaGeometria(this.impostazioniPagina).larghezza, margineSinistro: this.impostazioniPagina.margineSinistro, margineDestro: this.impostazioniPagina.margineDestro }} @cambio-margine=${this.suCambioMargineRighello} @fine-margine=${() => this.editor()?.focalizza()}></docs-righello>` : ''}</div>
      <main class="area-editor" @wheel=${this.suRotella} @cambio=${this.suCambio} @dizionario=${this.suDizionarioCambiato} @apri-link=${this.suApriLink} @immagine-incollata=${this.suImmagineIncollata}><div class="pagina zoom-${this.zoom} orientamento-${this.impostazioniPagina.orientamento} formato-${this.impostazioniPagina.formato.toLowerCase()}${this.senzaPagine ? ' senza-pagine' : ''}" role="textbox" aria-multiline="true" aria-label="Documento">${this.righelloVisibile ? html`<docs-righello-verticale class="righello-v" .zoom=${this.zoom / 100} .geometria=${{ altezza: calcolaGeometria(this.impostazioniPagina).altezza, margineAlto: this.impostazioniPagina.margineAlto, margineBasso: this.impostazioniPagina.margineBasso }} @cambio-margine-v=${this.suCambioMargineVerticale} @fine-margine=${() => this.editor()?.focalizza()}></docs-righello-verticale>` : ''}<docs-editor .impostazioniPagina=${this.impostazioniPagina} .senzaPagine=${this.senzaPagine} .mostraNonStampabili=${this.caratteriNonStampabili} .colonne=${this.colonne}></docs-editor></div></main>
      <docs-finestra></docs-finestra>
      ${this.trovaAperta ? html`<docs-trova .sostituzione=${this.sostituzione} .totale=${this.ricerca.totale} .corrente=${this.ricerca.corrente} .errore=${this.ricerca.errore} .troncato=${this.ricerca.troncato}
        @ricerca=${this.suRicerca} @successivo=${this.suPasso(1)} @precedente=${this.suPasso(-1)} @sostituisci=${this.suSostituisci} @sostituisci-tutto=${this.suSostituisciTutto} @chiudi=${() => this.chiudiTrova()}></docs-trova>` : ''}
      ${this.linkAperto ? html`<docs-link .testoIniziale=${this.datiLink.testo} .urlIniziale=${this.datiLink.url ?? ''} .conTesto=${!this.datiLink.selezione} .esiste=${this.datiLink.url !== null}
        @applica=${this.suLinkApplica} @rimuovi=${this.suLinkRimuovi} @chiudi=${() => this.chiudiLink()}></docs-link>` : ''}
      ${this.tabellaAperta ? html`<docs-tabella @applica=${this.suTabellaApplica} @chiudi=${() => this.chiudiTabella()}></docs-tabella>` : ''}
      ${this.margini ? html`<docs-margini .intestazioneIniziale=${this.margini.intestazione} .piedeIniziale=${this.margini.piede}
        .allineamentoIntestazione=${this.margini.alIntestazione} .allineamentoPiede=${this.margini.alPiede} .zona=${this.margini.zona}
        @applica=${this.suMarginiApplica} @chiudi=${() => this.chiudiMargini()}></docs-margini>` : ''}
      ${this.recuperabile ? html`<div class="recupero" role="alertdialog" aria-label="Documento non salvato">
        <span class="recupero-testo">Documento non salvato trovato: «${this.titoloVisibile(this.recuperabile.titolo.trim() === '' ? TITOLO_PREDEFINITO : this.recuperabile.titolo)}» (${new Date(this.recuperabile.salvato).toLocaleString(localeCorrente())})</span>
        <button class="ripristina" @click=${() => this.ripristina()}>Ripristina</button>
        <button class="scarta" @click=${() => this.scartaCopia()}>Scarta</button>
      </div>` : ''}
      ${this.popup ? html`<docs-popup .popup=${this.popup} .x=${this.popupX} .y=${this.popupY} @scelta=${this.suScelta} @chiudi=${this.suChiudi}></docs-popup>` : ''}
      ${this.conteggioAperto && this.datiConteggio ? html`<docs-conteggio .dati=${this.datiConteggio} @chiudi=${() => this.chiudiConteggio()}></docs-conteggio>` : ''}
      ${this.dettagliAperti && this.datiDettagli ? html`<docs-dettagli .dati=${this.datiDettagli} @chiudi=${() => this.chiudiDettagli()}></docs-dettagli>` : ''}
      ${this.impostaPaginaAperta ? html`<docs-imposta-pagina .impostazioni=${this.impostazioniPagina} @applica=${this.suImpostaPaginaApplica} @chiudi=${() => this.chiudiImpostaPagina()}></docs-imposta-pagina>` : ''}
      ${this.simboliAperto ? html`<docs-simboli @inserisci=${this.suInserisciSimbolo} @chiudi=${() => this.chiudiSimboli()}></docs-simboli>` : ''}
      ${this.versioniAperte ? html`<docs-versioni .versioni=${this.elencoVersioni} @crea=${this.suCreaVersione} @ripristina=${this.suRipristinaVersione} @elimina=${this.suEliminaVersione} @chiudi=${() => this.chiudiVersioni()}></docs-versioni>` : ''}
      ${this.schede.length > 1 ? html`<docs-schede .titoli=${this.schede.map((s) => s.titolo)} .attiva=${this.schedaAttiva}
        @seleziona=${(e: Event) => this.cambiaScheda((e as CustomEvent).detail.i as number)} @nuova=${() => this.nuovaScheda()}
        @rinomina=${(e: Event) => this.rinominaScheda((e as CustomEvent).detail.i as number, (e as CustomEvent).detail.titolo as string)}
        @elimina=${(e: Event) => this.eliminaScheda((e as CustomEvent).detail.i as number)}></docs-schede>` : ''}
      ${this.equazioneAperta ? html`<docs-equazione .mostraBarra=${this.prefs.barraEquazioni} @inserisci=${this.suTelaPronta} @chiudi=${() => this.chiudiFinestreImmagine()}></docs-equazione>` : ''}
      ${this.graficoAperto !== null ? html`<docs-grafico .tipoIniziale=${this.graficoAperto} @inserisci=${this.suTelaPronta} @chiudi=${() => this.chiudiFinestreImmagine()}></docs-grafico>` : ''}
      ${this.disegnoAperto ? html`<docs-disegno @inserisci=${this.suTelaPronta} @chiudi=${() => this.chiudiFinestreImmagine()}></docs-disegno>` : ''}
      ${this.aggiornamentoAperto ? html`<docs-aggiornamento .prima=${() => this.recupero.scriviOra()} @chiudi=${() => this.chiudiAggiornamento()}></docs-aggiornamento>` : ''}
      ${this.personalizzaAperta ? html`<docs-personalizza-barra .barra=${this.prefs.barra ?? barraPredefinita()} @barra-cambiata=${this.suBarraCambiata} @chiudi=${() => this.chiudiPersonalizza()}></docs-personalizza-barra>` : ''}
      ${this.caratteriAperti ? html`<docs-caratteri @chiudi=${() => this.chiudiCaratteri()} @cambiato=${this.suCaratteriCambiati}></docs-caratteri>` : ''}
      ${this.segnalaAperta ? html`<docs-segnala @chiudi=${() => this.chiudiSegnala()} @inviato=${this.suSegnalaInviata} @posta=${this.suSegnalaPosta}></docs-segnala>` : ''}
      ${this.informazioniAperte !== null ? html`<docs-informazioni .pagina=${this.informazioniAperte} @chiudi=${() => this.chiudiInformazioni()}></docs-informazioni>` : ''}
      ${this.ortografiaAperta ? html`<docs-ortografia .parola=${this.ortografiaAperta.parola} .contesto=${this.ortografiaAperta.contesto} .posizione=${this.ortografiaAperta.posizione} .azione=${this.ortografiaAperta.azione} .suggerimenti=${this.ortografiaAperta.suggerimenti}
        @cambia=${this.suOrtCambia} @cambia-tutto=${this.suOrtCambiaTutto} @ignora=${this.suOrtIgnora} @ignora-tutto=${this.suOrtIgnoraTutto} @aggiungi=${this.suOrtAggiungi} @chiudi=${() => this.chiudiOrtografia()}></docs-ortografia>` : ''}
      ${this.dizionarioAperto ? html`<docs-dizionario .parole=${this.elencoDizionario} @aggiungi=${this.suDizionarioAggiungi} @togli=${this.suDizionarioTogli} @chiudi=${() => this.chiudiDizionario()}></docs-dizionario>` : ''}
      ${this.dialogoPref ? html`<docs-preferenze .preferenze=${this.prefs} .modo=${this.dialogoPref} .lingueDisponibili=${this.lingueWindows} @cambia=${(e: Event) => this.cambiaPreferenze((e as CustomEvent).detail.preferenze as Partial<Preferenze>)} @chiudi=${() => this.chiudiPreferenze()}></docs-preferenze>` : ''}
      ${this.segnalibriAperti ? html`<docs-segnalibri .voci=${this.elencoSegnalibri} @aggiungi=${this.suAggiungiSegnalibro} @vai=${this.suVaiSegnalibro} @togli=${this.suTogliSegnalibro} @chiudi=${() => this.chiudiSegnalibri()}></docs-segnalibri>` : ''}
      ${this.notaAperta ? html`<docs-nota @applica=${this.suApplicaNota} @chiudi=${() => this.chiudiNotaPiePagina()}></docs-nota>` : ''}
      ${this.avviso ? html`<div class="avviso" role="alert">${this.avviso}</div>` : ''}
    `;
  }
}
