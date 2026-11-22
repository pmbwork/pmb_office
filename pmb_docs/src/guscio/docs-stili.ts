import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_NOME_STILE } from '../modello/documento';
import type { VoceStile } from '../modello/stili';
import { NOMI_STILE } from './popup-dati';
import { t } from '../i18n/lingua';

/** Finestra degli stili personali: crea uno stile dal paragrafo del cursore; per ogni stile del documento: applica, aggiorna dal
 *  paragrafo del cursore, rinomina, elimina. corrente = lo stile del paragrafo del cursore. */
@customElement('docs-stili')
export class DocsStili extends LinguaElement {
  @property({ attribute: false }) voci: VoceStile[] = [];
  @property({ attribute: false }) corrente: string | undefined = undefined;
  /** il messaggio dell'ultima operazione non riuscita (già tradotto) */
  @property({ attribute: false }) errore = '';
  @state() private nome = '';
  @state() private rinomina: string | null = null;
  @state() private nuovoNome = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 520px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 16px; font-size: 18px; font-weight: 500; }
    .riga-nuovo { display: flex; gap: 8px; margin-bottom: 8px; }
    .spiega { margin: 0 0 16px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    .errore { margin: 0 0 12px; color: #b3261e; }
    input { flex: 1; min-width: 0; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; outline: none; }
    input:focus { border-color: #0b57d0; }
    ul { list-style: none; margin: 0 0 16px; padding: 0; max-height: 260px; overflow-y: auto; border-top: 1px solid var(--pmb-bordo, #e8eaed); }
    li { display: flex; align-items: center; gap: 6px; padding: 8px 4px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); }
    li.corrente { background: var(--pmb-superficie-2, #f1f4f9); }
    li .testo { flex: 1; min-width: 0; }
    li .nome { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li .anteprima { font-size: 12px; color: var(--pmb-testo-2, #5f6368); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vuoto { color: var(--pmb-testo-2, #5f6368); margin: 0 0 16px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
    button.piccolo { height: 28px; padding: 0 10px; }
    .pulsanti { display: flex; justify-content: flex-end; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private invia(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  private crea(): void {
    const n = this.nome.trim();
    if (n === '') return;
    this.invia('crea', { nome: n });
  }

  /** Il guscio lo chiama quando lo stile è stato creato: il campo si svuota. */
  svuota(): void { this.nome = ''; }

  private confermaRinomina(id: string): void {
    const n = this.nuovoNome.trim();
    if (n !== '') this.invia('rinomina', { id, nome: n });
    this.rinomina = null;
  }

  private descrizione(v: VoceStile): string {
    const base = t('basato su {}', t(NOMI_STILE[v.stile.base]));
    const usi = v.usi === 1 ? t('1 paragrafo') : t('{} paragrafi', String(v.usi));
    return `${base} · ${usi}${v.esempio ? ` · «${v.esempio}»` : ''}`;
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-stili">
        <h2 id="titolo-stili">Stili personali</h2>
        <div class="riga-nuovo">
          <input type="text" class="nuovo" aria-label="Nome del nuovo stile" placeholder="Nome del nuovo stile" maxlength=${LUNGHEZZA_MASSIMA_NOME_STILE}
            .value=${this.nome} @input=${(e: Event) => { this.nome = (e.target as HTMLInputElement).value; }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.crea(); } }} />
          <button class="primario crea" @click=${() => this.crea()}>Crea dal paragrafo</button>
        </div>
        <p class="spiega">Lo stile nuovo prende carattere, corpo, colore, grassetto, corsivo, allineamento e spazi del paragrafo del cursore.</p>
        ${this.errore ? html`<p class="errore" role="alert">${this.errore}</p>` : ''}
        ${this.voci.length === 0
          ? html`<p class="vuoto">Nessuno stile personale nel documento.</p>`
          : html`<ul>${this.voci.map((v) => html`
              <li class=${v.stile.id === this.corrente ? 'corrente' : ''} data-id=${v.stile.id}>
                ${this.rinomina === v.stile.id
                  ? html`<input type="text" class="rinomina" aria-label="Nuovo nome dello stile" maxlength=${LUNGHEZZA_MASSIMA_NOME_STILE} .value=${this.nuovoNome}
                      @input=${(e: Event) => { this.nuovoNome = (e.target as HTMLInputElement).value; }}
                      @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.confermaRinomina(v.stile.id); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.rinomina = null; } }} />
                    <button class="piccolo" @click=${() => this.confermaRinomina(v.stile.id)}>OK</button>`
                  : html`<div class="testo"><div class="nome">${v.stile.nome}</div><div class="anteprima">${this.descrizione(v)}</div></div>
                    <button class="piccolo applica" @click=${() => this.invia('applica', { id: v.stile.id })}>Applica</button>
                    <button class="piccolo aggiorna" title=${t('Ridefinisce lo stile come il paragrafo del cursore')} @click=${() => this.invia('aggiorna', { id: v.stile.id })}>Aggiorna</button>
                    <button class="piccolo rinomina-voce" @click=${() => { this.rinomina = v.stile.id; this.nuovoNome = v.stile.nome; void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLInputElement>('input.rinomina')?.focus()); }}>Rinomina</button>
                    <button class="piccolo elimina" @click=${() => this.invia('elimina', { id: v.stile.id })}>Elimina</button>`}
              </li>`)}</ul>`}
        <div class="pulsanti"><button class="chiudi" @click=${() => this.invia('chiudi')}>Chiudi</button></div>
      </div>
    `;
  }
}
