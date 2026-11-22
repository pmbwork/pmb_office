import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t } from '../i18n/lingua';
import { customElement, state } from 'lit/decorators.js';
import { EMAIL_SEGNALAZIONI, LIMITI_SEGNALAZIONE, controllaTesto, inviaSegnalazione } from '@comune/informazioni/segnalazioni';
import { VERSIONE_APP } from './docs-informazioni';

type Fase = 'scrittura' | 'invio' | 'errore';

/**
 * Finestra «Segnala un bug o invia un feedback»: l'utente scrive, il messaggio parte via Internet verso il servizio di PMB che lo inoltra per email.
 * Eventi: `chiudi` (Annulla o Esc), `inviato` (esito positivo), `posta` (ripiego: l'utente chiede di usare il suo programma di posta; detail = { testo }).
 */
@customElement('docs-segnala')
export class DocsSegnala extends LinguaElement {
  @state() private testo = '';
  @state() private contatto = '';
  @state() private includiDati = true;
  @state() private fase: Fase = 'scrittura';
  @state() private messaggio = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) textarea:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { display: flex; flex-direction: column; gap: 10px; width: 540px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 20px 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0; font-size: 18px; font-weight: 500; }
    label { display: flex; flex-direction: column; gap: 4px; font-weight: 500; }
    .nota { color: var(--pmb-testo-2, #5f6368); font-size: 12.5px; line-height: 1.45; font-weight: 400; margin: 0; }
    textarea, input[type=email], input[type=text] { font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; box-sizing: border-box; width: 100%; }
    textarea { min-height: 150px; resize: vertical; }
    .conta { align-self: flex-end; color: var(--pmb-testo-2, #5f6368); font-size: 12px; }
    .spunta { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 400; }
    .spunta input { margin-top: 3px; }
    .stato { min-height: 20px; margin: 0; line-height: 1.4; }
    .stato.errore { color: #b3261e; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    button { height: 36px; padding: 0 20px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { background: #0b57d0; border-color: #0b57d0; color: #ffffff; }
    button:disabled { opacity: 0.5; cursor: default; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); }

  private async invia(): Promise<void> {
    const errore = controllaTesto(this.testo, t);
    if (errore) { this.fase = 'errore'; this.messaggio = errore; this.focalizza(); return; }
    this.fase = 'invio';
    this.messaggio = 'Invio in corso…';
    const esito = await inviaSegnalazione({ app: 'pmb_docs', versione: VERSIONE_APP, sistema: navigator.userAgent, testo: this.testo, contatto: this.contatto, includiDati: this.includiDati }, { tr: t });
    if (esito.ok) { this.dispatchEvent(new CustomEvent('inviato', { bubbles: true, composed: true })); return; }
    this.fase = 'errore';
    this.messaggio = `${esito.motivo} Puoi riprovare, oppure aprire il programma di posta.`;
  }

  private posta(): void { this.dispatchEvent(new CustomEvent('posta', { detail: { testo: this.testo }, bubbles: true, composed: true })); }

  render() {
    const occupato = this.fase === 'invio';
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-segnala">
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
        <p class="nota">Il messaggio parte via Internet solo quando premi Invia, verso un servizio di Google gestito da PMB che lo inoltra a ${EMAIL_SEGNALAZIONI}. Contiene solo quello che scrivi qui, mai i tuoi documenti.</p>
        <p class="stato ${this.fase === 'errore' ? 'errore' : ''}" role="status" aria-live="polite">${this.messaggio}</p>
        <div class="pulsanti">
          ${this.fase === 'errore' ? html`<button @click=${() => this.posta()}>Apri la posta</button>` : nothing}
          <button @click=${() => this.chiudi()}>Annulla</button>
          <button class="primario" ?disabled=${occupato} @click=${() => { void this.invia(); }}>Invia</button>
        </div>
      </div>`;
  }
}
