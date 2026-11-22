import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';
import { EMAIL_SEGNALAZIONI, LIMITI_SEGNALAZIONE, controllaTesto, inviaSegnalazione } from '@comune/informazioni/segnalazioni';
import { VERSIONE_APP } from './dialogo-informazioni';
import { t } from '../i18n/lingua';

type Fase = 'scrittura' | 'invio' | 'errore';

/**
 * Finestra «Segnala un bug o invia un feedback»: l'utente scrive, il messaggio parte via Internet verso il servizio di PMB che lo inoltra per email.
 * Eventi: `chiudi-dialogo` (Annulla o Esc), `inviato` (esito positivo), `posta` (ripiego: usare il programma di posta; detail = { testo }).
 */
@customElement('free-dialogo-segnala')
export class FreeDialogoSegnala extends LinguaElement {
  @state() private testo = '';
  @state() private contatto = '';
  @state() private includiDati = true;
  @state() private fase: Fase = 'scrittura';
  @state() private messaggio = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13.5px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { display: flex; flex-direction: column; gap: 10px; background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 18px 22px; width: 540px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; }
    h2 { margin: 0; font-size: 16px; font-weight: 500; }
    label { display: flex; flex-direction: column; gap: 4px; font-weight: 500; }
    .nota { opacity: 0.7; font-size: 12px; line-height: 1.45; font-weight: 400; margin: 0; }
    textarea, input[type=email] { font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; box-sizing: border-box; width: 100%; background: transparent; color: inherit; }
    textarea { min-height: 140px; resize: vertical; }
    .conta { align-self: flex-end; opacity: 0.7; font-size: 12px; }
    .spunta { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 400; }
    .spunta input { margin-top: 3px; }
    .stato { min-height: 18px; margin: 0; line-height: 1.4; }
    .stato.errore { color: #d93025; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    button { padding: 7px 18px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; cursor: pointer; font: inherit; }
    button.primario { background: #188a4a; border-color: #188a4a; color: #ffffff; }
    button:disabled { opacity: 0.5; cursor: default; }
  `;

  firstUpdated(): void { this.focalizza(); }
  focalizza(): void { this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); } };

  private async invia(): Promise<void> {
    const errore = controllaTesto(this.testo, t);
    if (errore) { this.fase = 'errore'; this.messaggio = errore; this.focalizza(); return; }
    this.fase = 'invio';
    this.messaggio = t("Invio in corso…");
    const esito = await inviaSegnalazione({ app: 'pmb_sheets', versione: VERSIONE_APP, sistema: navigator.userAgent, testo: this.testo, contatto: this.contatto, includiDati: this.includiDati }, { tr: t });
    if (esito.ok) { this.dispatchEvent(new CustomEvent('inviato', { bubbles: true, composed: true })); return; }
    this.fase = 'errore';
    this.messaggio = t("{} Puoi riprovare, oppure aprire il programma di posta.", esito.motivo);
  }

  private posta(): void { this.dispatchEvent(new CustomEvent('posta', { detail: { testo: this.testo }, bubbles: true, composed: true })); }

  render() {
    const occupato = this.fase === 'invio';
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-segnala">
          <h2 id="titolo-segnala">Segnala un bug o invia un feedback</h2>
          <label>Che cosa vuoi dirci?
            <textarea aria-describedby="conta-segnala" maxlength=${LIMITI_SEGNALAZIONE.massimoTesto} placeholder="Descrivi il problema (che cosa hai fatto, che cosa è successo, che cosa ti aspettavi) o il tuo suggerimento."
              .value=${this.testo} ?disabled=${occupato} @input=${(e: Event) => { this.testo = (e.target as HTMLTextAreaElement).value; if (this.fase === 'errore') this.fase = 'scrittura'; }}></textarea>
          </label>
          <span class="conta" id="conta-segnala">${this.testo.length} / ${LIMITI_SEGNALAZIONE.massimoTesto}</span>
          <label>La tua email, se vuoi una risposta (facoltativa)
            <input type="email" autocomplete="email" maxlength=${LIMITI_SEGNALAZIONE.massimoContatto} .value=${this.contatto} ?disabled=${occupato}
              @input=${(e: Event) => { this.contatto = (e.target as HTMLInputElement).value; }} />
          </label>
          <label class="spunta"><input type="checkbox" .checked=${this.includiDati} ?disabled=${occupato} @change=${(e: Event) => { this.includiDati = (e.target as HTMLInputElement).checked; }} />
            <span>Includi nome e versione del programma e il sistema (aiuta a trovare il problema)</span></label>
          <p class="nota">Il messaggio parte via Internet solo quando premi Invia, verso un servizio di Google gestito da PMB che lo inoltra a PMB (contatto: ${EMAIL_SEGNALAZIONI}). Contiene solo quello che scrivi qui, mai i tuoi fogli.</p>
          <p class="stato ${this.fase === 'errore' ? 'errore' : ''}" role="status" aria-live="polite">${this.messaggio}</p>
          <div class="bottoni">
            ${this.fase === 'errore' ? html`<button @click=${() => this.posta()}>Apri la posta</button>` : nothing}
            <button @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" ?disabled=${occupato} @click=${() => { void this.invia(); }}>Invia</button>
          </div>
        </div>
      </div>`;
  }
}
