import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import { LUNGHEZZA_MASSIMA_COMMENTO } from '../modello/documento';
import type { VoceCommento, VoceRevisione } from '../modello/revisioni';
import { dataBreve } from '../editor/render';

/**
 * Pannello «Commenti e modifiche», a destra del documento: la registrazione delle modifiche (accendi e spegni, accetta e rifiuta,
 * una o tutte) e i commenti (nuovo commento sul testo selezionato, rispondi, risolvi o riapri, elimina; un clic porta al testo).
 * Non tocca il documento: manda eventi al guscio, che li passa all'editor.
 */
@customElement('docs-commenti')
export class DocsCommenti extends LinguaElement {
  @property({ attribute: false }) commenti: VoceCommento[] = [];
  @property({ attribute: false }) revisioni: VoceRevisione[] = [];
  @property({ type: Boolean }) registra = false;
  /** c'è da scrivere un commento nuovo (Inserisci › Commento) */
  @property({ type: Boolean }) nuovo = false;
  /** il commento del testo dove sta il cursore: si mette in evidenza */
  @property({ attribute: false }) attivo: string | undefined;
  @state() private testoNuovo = '';
  @state() private risposte: Record<string, string> = {};
  @state() private mostraRisolti = false;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) textarea:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }
    :host { display: flex; flex-direction: column; font: 13px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); background: var(--pmb-superficie, #ffffff);
      border-left: 1px solid var(--pmb-bordo, #dadce0); box-sizing: border-box; }
    .testa { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); }
    h2 { margin: 0; font-size: 15px; font-weight: 500; }
    .chiudi { border: 0; background: none; font-size: 18px; width: 28px; height: 28px; border-radius: 14px; cursor: pointer; color: inherit; }
    .chiudi:hover { background: var(--pmb-hover, #e8eaed); }
    .corpo { flex: 1; overflow-y: auto; padding: 10px 12px; }
    h3 { margin: 6px 0 8px; font-size: 13px; font-weight: 500; color: var(--pmb-testo-2, #5f6368); text-transform: uppercase; letter-spacing: 0.4px; }
    .sezione { margin-bottom: 16px; }
    .scheda { border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; cursor: pointer; background: var(--pmb-superficie, #ffffff); }
    .scheda:hover { box-shadow: 0 1px 3px rgba(60, 64, 67, 0.25); }
    .scheda.attivo { border-color: #fbbc04; box-shadow: 0 0 0 1px #fbbc04; }
    .scheda.risolto { opacity: 0.65; }
    .autore { font-weight: 500; }
    .data { font-size: 11px; color: var(--pmb-testo-2, #5f6368); margin-left: 6px; }
    .citato { font-size: 12px; color: var(--pmb-testo-2, #5f6368); border-left: 3px solid #fbbc04; padding-left: 6px; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .testo { white-space: pre-wrap; word-break: break-word; margin: 4px 0; }
    .risposta { border-top: 1px solid var(--pmb-bordo, #e8eaed); margin-top: 6px; padding-top: 6px; }
    textarea { width: 100%; box-sizing: border-box; min-height: 54px; resize: vertical; font: inherit; padding: 6px 8px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 6px;
      background: var(--pmb-superficie, #ffffff); color: inherit; outline: none; }
    textarea:focus { border-color: #0b57d0; }
    .pulsanti { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    button { height: 28px; padding: 0 12px; border-radius: 14px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0);
      background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
    button:disabled { opacity: 0.5; cursor: default; }
    .interruttore { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .stato-reg { font-weight: 500; }
    .stato-reg.acceso { color: #b3261e; }
    .modifica { display: flex; align-items: flex-start; gap: 6px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 8px; padding: 6px 8px; margin-bottom: 6px; cursor: pointer; }
    .modifica:hover { box-shadow: 0 1px 3px rgba(60, 64, 67, 0.25); }
    .modifica .dettaglio { flex: 1; min-width: 0; }
    .modifica .pezzo { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .modifica .pezzo.i { text-decoration: underline; }
    .modifica .pezzo.d { text-decoration: line-through; }
    .tondo { width: 26px; height: 26px; padding: 0; border-radius: 13px; flex: none; }
    .vuoto { color: var(--pmb-testo-2, #5f6368); margin: 4px 0 8px; }
    label.risolti { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); margin-bottom: 8px; cursor: pointer; }
  `;

  /** Mette il fuoco nella casella del commento nuovo (o sulla prima casella del pannello). */
  focalizza(): void {
    // prima la casella del commento nuovo (un elenco di selettori darebbe il primo nell'ordine della pagina: il pulsante Chiudi)
    const r = this.renderRoot;
    (r.querySelector<HTMLElement>('textarea.nuovo') ?? r.querySelector<HTMLElement>('textarea') ?? r.querySelector<HTMLElement>('button'))?.focus();
  }

  private invia(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }
  private commenta(): void {
    if (this.testoNuovo.trim() === '') return;
    this.invia('nuovo-commento', { testo: this.testoNuovo });
    this.testoNuovo = '';
  }
  private rispondi(id: string): void {
    const testo = (this.risposte[id] ?? '').trim();
    if (testo === '') return;
    this.invia('rispondi', { id, testo });
    this.risposte = { ...this.risposte, [id]: '' };
  }
  /** Ctrl+Invio conferma il commento o la risposta che si sta scrivendo; Esc annulla il commento nuovo. */
  private tastoCasella(e: KeyboardEvent, conferma: () => void): void {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); conferma(); }
    if (e.key === 'Escape' && this.nuovo) { e.preventDefault(); this.testoNuovo = ''; this.invia('annulla-nuovo'); }
  }

  private schedaCommento(c: VoceCommento) {
    return html`
      <div class="scheda${c.ok ? ' risolto' : ''}${c.id === this.attivo ? ' attivo' : ''}" data-id=${c.id} @click=${(e: Event) => { if ((e.target as HTMLElement).closest('button, textarea')) return; this.invia('vai', { id: c.id }); }}>
        <div><span class="autore">${c.a}</span><span class="data">${dataBreve(c.d)}</span></div>
        ${c.ancorato !== '' ? html`<div class="citato">«${c.ancorato}»</div>` : ''}
        <div class="testo">${c.t}</div>
        ${(c.r ?? []).map((r) => html`<div class="risposta"><div><span class="autore">${r.a}</span><span class="data">${dataBreve(r.d)}</span></div><div class="testo">${r.t}</div></div>`)}
        ${c.ok ? '' : html`
          <textarea class="rispondi" aria-label=${t('Rispondi al commento')} placeholder=${t('Rispondi…')} maxlength=${LUNGHEZZA_MASSIMA_COMMENTO} .value=${this.risposte[c.id] ?? ''}
            @input=${(e: Event) => { this.risposte = { ...this.risposte, [c.id]: (e.target as HTMLTextAreaElement).value }; }}
            @keydown=${(e: KeyboardEvent) => this.tastoCasella(e, () => this.rispondi(c.id))}></textarea>`}
        <div class="pulsanti">
          ${c.ok ? '' : html`<button class="primario" ?disabled=${(this.risposte[c.id] ?? '').trim() === ''} @click=${() => this.rispondi(c.id)}>Rispondi</button>`}
          <button class="risolvi" @click=${() => this.invia('risolvi', { id: c.id, risolto: !c.ok })}>${c.ok ? t('Riapri') : t('Risolvi')}</button>
          <button class="elimina" @click=${() => this.invia('elimina', { id: c.id })}>Elimina</button>
        </div>
      </div>`;
  }

  render() {
    const aperti = this.commenti.filter((c) => !c.ok);
    const risolti = this.commenti.filter((c) => c.ok);
    return html`
      <div class="testa"><h2 id="titolo-commenti">Commenti e modifiche</h2><button class="chiudi" aria-label=${t('Chiudi')} title=${t('Chiudi')} @click=${() => this.invia('chiudi')}>✕</button></div>
      <div class="corpo" role="region" aria-labelledby="titolo-commenti">
        <div class="sezione">
          <h3>Modifiche registrate</h3>
          <div class="interruttore">
            <span class="stato-reg${this.registra ? ' acceso' : ''}">${this.registra ? t('Registrazione accesa') : t('Registrazione spenta')}</span>
            <button class="registra" aria-pressed=${this.registra ? 'true' : 'false'} @click=${() => this.invia('registra')}>${this.registra ? t('Spegni') : t('Accendi')}</button>
          </div>
          ${this.revisioni.length === 0 ? html`<p class="vuoto">Nessuna modifica registrata.</p>` : html`
            ${this.revisioni.map((v) => html`
              <div class="modifica" @click=${(e: Event) => { if ((e.target as HTMLElement).closest('button')) return; this.invia('vai-modifica', { p: v.p, o: v.o, fine: v.fine }); }}>
                <div class="dettaglio">
                  <div><span class="autore">${v.autore}</span><span class="data">${v.tipo === 'i' ? t('ha inserito') : t('ha cancellato')} · ${dataBreve(v.data)}</span></div>
                  <div class="pezzo ${v.tipo}">${v.testo.replace(/￼/g, '▣')}</div>
                </div>
                <button class="tondo accetta" title=${t('Accetta')} aria-label=${t('Accetta')} @click=${() => this.invia('accetta', { p: v.p, o: v.o, fine: v.fine })}>✓</button>
                <button class="tondo rifiuta" title=${t('Rifiuta')} aria-label=${t('Rifiuta')} @click=${() => this.invia('rifiuta', { p: v.p, o: v.o, fine: v.fine })}>✕</button>
              </div>`)}
            <div class="pulsanti"><button class="accetta-tutte" @click=${() => this.invia('accetta-tutte')}>Accetta tutte</button><button class="rifiuta-tutte" @click=${() => this.invia('rifiuta-tutte')}>Rifiuta tutte</button></div>`}
        </div>
        <div class="sezione">
          <h3>Commenti</h3>
          ${this.nuovo ? html`
            <div class="scheda nuovo-commento">
              <textarea class="nuovo" aria-label=${t('Testo del commento')} placeholder=${t('Scrivi un commento sul testo selezionato…')} maxlength=${LUNGHEZZA_MASSIMA_COMMENTO} .value=${this.testoNuovo}
                @input=${(e: Event) => { this.testoNuovo = (e.target as HTMLTextAreaElement).value; }} @keydown=${(e: KeyboardEvent) => this.tastoCasella(e, () => this.commenta())}></textarea>
              <div class="pulsanti"><button class="primario commenta" ?disabled=${this.testoNuovo.trim() === ''} @click=${() => this.commenta()}>Commenta</button><button @click=${() => { this.testoNuovo = ''; this.invia('annulla-nuovo'); }}>Annulla</button></div>
            </div>` : ''}
          ${aperti.length === 0 && !this.nuovo ? html`<p class="vuoto">${this.commenti.length === 0 ? t('Nessun commento. Seleziona del testo e scegli Inserisci › Commento (Ctrl+Alt+M).') : t('Nessun commento aperto.')}</p>` : ''}
          ${aperti.map((c) => this.schedaCommento(c))}
          ${risolti.length > 0 ? html`<label class="risolti"><input type="checkbox" .checked=${this.mostraRisolti} @change=${(e: Event) => { this.mostraRisolti = (e.target as HTMLInputElement).checked; }} /> ${t('Mostra i commenti risolti ({})', risolti.length)}</label>` : ''}
          ${this.mostraRisolti ? risolti.map((c) => this.schedaCommento(c)) : ''}
          ${this.commenti.length > 0 ? html`<div class="pulsanti"><button class="elimina-tutti" @click=${() => this.invia('elimina-tutti')}>Elimina tutti i commenti</button></div>` : ''}
        </div>
      </div>
    `;
  }
}
