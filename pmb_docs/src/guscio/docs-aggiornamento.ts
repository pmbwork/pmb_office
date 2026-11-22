import { css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t, linguaCorrente } from '../i18n/lingua';
import { VERSIONE_APP } from './docs-informazioni';
import { chiamaTauriGrezzo, chiamaTauriConErrore, dentroTauri } from './tauri';

type Fase = 'scelta' | 'lettura' | 'pronto' | 'installazione';
interface Info { versioneAttuale: string; versioneNuova: string; note: string; noteEn?: string; piuNuova: boolean }
/** Le note da mostrare nella lingua dell'interfaccia: in inglese se il pacchetto le ha, altrimenti quelle italiane. */
export function noteNellaLingua(i: Info): string { return linguaCorrente() === 'en' && (i.noteEn ?? '').trim() !== '' ? i.noteEn! : i.note; }

/** Perché un file di aggiornamento non va bene, in parole per l'utente (i codici li dà la parte nativa). Chiavi di traduzione. */
export function motivoAggiornamento(codice: string): string {
  switch (codice) {
    case 'NON_PACCHETTO': return t('Questo non è un file di aggiornamento di pmb_docs.');
    case 'DANNEGGIATO': return t('Il file di aggiornamento è danneggiato o incompleto: chiedine una copia nuova.');
    case 'FIRMA_NON_VALIDA': return t('Il file non è firmato da PMB: per sicurezza non lo installo.');
    case 'ALTRO_PROGRAMMA': return t('Questo aggiornamento è per un altro programma.');
    case 'VERSIONE_NON_VALIDA': return t('Il file di aggiornamento ha un numero di versione non valido.');
    case 'ANNULLATO': return t('Installazione annullata: serve il permesso di amministratore di Windows.');
    case 'SCRITTURA': return t("Non riesco a preparare l'installazione su questo computer.");
    case 'NON_PIU_NUOVO': return t('Questa versione è già installata o più recente.');
    case 'NON_NELL_APP': return t("L'aggiornamento funziona solo nel programma installato, non nel browser.");
    default: return t('Aggiornamento non riuscito.');
  }
}

/**
 * Finestra «Installa un aggiornamento»: l'utente sceglie un file `.pmbup` firmato da PMB, vede versione e novità e conferma. Il programma si chiude,
 * l'installer sostituisce i file (documenti e preferenze non si toccano) e riapre il programma.
 * Eventi: `chiudi`. La proprietà `prima` è una funzione che il guscio dà per mettere al sicuro il lavoro (copia di emergenza) prima di chiudere.
 */
@customElement('docs-aggiornamento')
export class DocsAggiornamento extends LinguaElement {
  @property({ attribute: false }) prima: () => void = () => {};
  @state() private fase: Fase = 'scelta';
  @state() private info: Info | null = null;
  @state() private messaggio = '';
  @state() private errore = false;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 520px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
    p { margin: 0 0 10px; line-height: 1.45; }
    .versioni { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 12px 0; }
    .versioni dt { color: var(--pmb-testo-2, #5f6368); } .versioni dd { margin: 0; font-weight: 500; }
    .note { white-space: pre-wrap; background: var(--pmb-superficie-2, #f8f9fa); border: 1px solid var(--pmb-bordo, #e8eaed); border-radius: 6px; padding: 8px 10px; max-height: 160px; overflow-y: auto; margin: 0 0 10px; }
    .nota { color: var(--pmb-testo-2, #5f6368); font-size: 12.5px; }
    .stato { min-height: 20px; margin: 0 0 8px; }
    .stato.errore { color: #b3261e; }
    button { height: 36px; padding: 0 20px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button:disabled { opacity: 0.5; cursor: default; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    input[type=file] { display: none; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('button.primario')?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); }

  private async suFile(e: Event): Promise<void> {
    const campo = e.target as HTMLInputElement;
    const file = campo.files?.[0];
    campo.value = '';
    if (!file) return;
    this.fase = 'lettura'; this.errore = false; this.info = null; this.messaggio = t('Controllo del file…');
    if (!dentroTauri()) { this.fase = 'scelta'; this.errore = true; this.messaggio = motivoAggiornamento('NON_NELL_APP'); return; }
    const r = await chiamaTauriGrezzo<Info>('aggiornamento_leggi', new Uint8Array(await file.arrayBuffer()));
    if (r.errore !== null || r.valore === null) { this.fase = 'scelta'; this.errore = true; this.messaggio = motivoAggiornamento(r.errore ?? ''); return; }
    this.info = r.valore;
    if (!r.valore.piuNuova) { this.fase = 'scelta'; this.errore = true; this.messaggio = t('Questo aggiornamento è la versione {}, ma hai già la {}: non serve installarlo.', r.valore.versioneNuova, r.valore.versioneAttuale); return; }
    this.fase = 'pronto'; this.messaggio = '';
  }

  private async installa(): Promise<void> {
    this.fase = 'installazione'; this.errore = false; this.messaggio = t("Avvio dell'installazione…");
    try { this.prima(); } catch { /* la copia di emergenza è un di più: non ferma l'aggiornamento */ }
    const r = await chiamaTauriConErrore('aggiornamento_installa');
    if (r.errore !== null) { this.fase = 'pronto'; this.errore = true; this.messaggio = motivoAggiornamento(r.errore); return; }
    this.messaggio = t('Il programma si chiude e si riapre da solo a fine aggiornamento…');
  }

  render() {
    const i = this.info;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-agg">
        <h2 id="titolo-agg">Installa un aggiornamento</h2>
        ${this.fase === 'pronto' || this.fase === 'installazione' ? nothing : html`
          <p>Scegli il file di aggiornamento (.pmbup) che ti ha mandato PMB. Il programma controlla che sia davvero firmato da PMB prima di installarlo. I tuoi documenti e le tue preferenze non vengono toccati.</p>`}
        <dl class="versioni">
          <dt>Versione installata</dt><dd>${i?.versioneAttuale ?? VERSIONE_APP}</dd>
          ${i && i.piuNuova ? html`<dt>Nuova versione</dt><dd>${i.versioneNuova}</dd>` : nothing}
        </dl>
        ${i && i.piuNuova && noteNellaLingua(i).trim() !== '' ? html`<p>Novità:</p><div class="note">${noteNellaLingua(i)}</div>` : nothing}
        ${this.fase === 'pronto' || this.fase === 'installazione' ? html`<p class="nota">Il programma si chiude, Windows chiede il permesso di amministratore e l'aggiornamento si installa. Poi il programma si riapre. Se hai documenti non salvati, al riavvio ti verrà proposto di ripristinarli.</p>` : nothing}
        <p class="stato ${this.errore ? 'errore' : ''}" role="status" aria-live="polite">${this.messaggio}</p>
        <div class="pulsanti">
          ${this.fase === 'pronto' || this.fase === 'installazione'
            ? html`<button class="primario" ?disabled=${this.fase === 'installazione'} @click=${() => { void this.installa(); }}>Installa e riavvia</button>`
            : html`<button class="primario" ?disabled=${this.fase === 'lettura'} @click=${() => this.renderRoot.querySelector<HTMLInputElement>('input[type=file]')?.click()}>Scegli il file…</button>`}
          <button ?disabled=${this.fase === 'installazione'} @click=${() => this.chiudi()}>Annulla</button>
        </div>
        <input type="file" accept=".pmbup" @change=${(e: Event) => { void this.suFile(e); }} />
      </div>`;
  }
}

