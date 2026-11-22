// Finestra "Testo in colonne" di pmb_sheets: separatore (o larghezza fissa), opzioni e anteprima delle prime righe.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import { dividiRighe, leggiPosizioni, OPZIONI_DIVISIONE, rilevaSeparatore, type OpzioniDivisione, type TipoSeparatore } from '../sheet/testo-in-colonne';

const SEPARATORI: Array<[TipoSeparatore, string]> = [
  ['auto', 'Rileva automaticamente'], ['virgola', 'Virgola'], ['puntoevirgola', 'Punto e virgola'], ['tab', 'Tabulazione'],
  ['spazio', 'Spazio'], ['punto', 'Punto'], ['barra', 'Barra verticale |'], ['personalizzato', 'Altro'], ['larghezza', 'Larghezza fissa'],
];
const NOMI_RILEVATI: Record<string, string> = { '\t': 'tabulazione', ';': 'punto e virgola', ',': 'virgola', '|': 'barra verticale', ' ': 'spazio' };
const RIGHE_ANTEPRIMA = 6;

@customElement('free-dialogo-testo-colonne')
export class FreeDialogoTestoColonne extends LinguaElement {
  /** il testo delle celle da dividere, dall'alto in basso */
  @property({ attribute: false }) testi: string[] = [];
  /** l'area scritta per l'utente, per esempio "A1:A20" */
  @property({ type: String }) area = '';
  /** se c'è, quante celle piene a destra verrebbero sostituite: la finestra chiede conferma */
  @property({ type: Number }) sovrascritte = 0;
  @state() private opz: OpzioniDivisione = { ...OPZIONI_DIVISIONE };
  @state() private posizioni = '';
  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 6px; font-size: 16px; font-weight: 500; }
    p.nota { margin: 0 0 12px; color: var(--color-text-muted, #5f6368); }
    .riga { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    select, input[type="text"] { padding: 5px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    input[type="text"] { width: 140px; }
    label.casella { display: flex; align-items: center; gap: 8px; padding: 2px 0; cursor: pointer; }
    .anteprima { overflow: auto; max-height: 200px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; margin: 10px 0; }
    table { border-collapse: collapse; font-size: 12px; }
    td { border: 1px solid var(--color-border, #e0e0e0); padding: 3px 6px; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
    .errore, .avviso { margin: 6px 0; }
    .errore { color: #d93025; }
    .avviso { color: #b06000; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
  `;

  firstUpdated(): void { this.renderRoot.querySelector<HTMLSelectElement>('select')?.focus(); }

  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private cambia(p: Partial<OpzioniDivisione>): void { this.opz = { ...this.opz, ...p }; this.errore = ''; if (this.sovrascritte > 0) this.sovrascritte = 0; }

  /** Le opzioni complete, o null (con il motivo in `errore`) se mancano dati. */
  private opzioni(): OpzioniDivisione | null {
    if (this.opz.separatore === 'personalizzato' && (this.opz.personalizzato ?? '') === '') { this.errore = t('Scrivi il separatore da usare.'); return null; }
    if (this.opz.separatore === 'larghezza') {
      const pos = leggiPosizioni(this.posizioni);
      if (!pos) { this.errore = t('Scrivi le posizioni in cui tagliare, per esempio 10; 25.'); return null; }
      return { ...this.opz, posizioni: pos };
    }
    return this.opz;
  }
  private dividi(confermato: boolean): void {
    const o = this.opzioni();
    if (!o) return;
    this.dispatchEvent(new CustomEvent('dividi-testo', { detail: { opzioni: o, confermato }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); } };

  render() {
    const o = this.opz;
    const pos = o.separatore === 'larghezza' ? leggiPosizioni(this.posizioni) : null;
    const prova: OpzioniDivisione = o.separatore === 'larghezza' ? { ...o, posizioni: pos ?? [] } : o;
    const campione = this.testi.slice(0, RIGHE_ANTEPRIMA);
    const divise = dividiRighe(campione, prova);
    const larghe = divise.reduce((m, p) => Math.max(m, p.length), 1);
    const rilevato = o.separatore === 'auto' ? NOMI_RILEVATI[rilevaSeparatore(this.testi)] ?? '' : '';
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-tc">
          <h2 id="titolo-tc">Testo in colonne</h2>
          <p class="nota">${t('Area: {}. I pezzi vanno nella cella e in quelle alla sua destra.', this.area)}</p>
          <div class="riga">
            <label for="sep">Separatore</label>
            <select id="sep" data-campo="separatore" @change=${(e: Event) => this.cambia({ separatore: (e.target as HTMLSelectElement).value as TipoSeparatore })}>
              ${SEPARATORI.map(([v, n]) => html`<option value=${v} ?selected=${o.separatore === v}>${t(n)}</option>`)}
            </select>
            ${o.separatore === 'auto' && rilevato ? html`<span class="nota">${t('trovato: {}', t(rilevato))}</span>` : nothing}
            ${o.separatore === 'personalizzato' ? html`<input type="text" data-campo="personalizzato" aria-label="Separatore personalizzato" maxlength="10" .value=${o.personalizzato ?? ''}
              @input=${(e: Event) => this.cambia({ personalizzato: (e.target as HTMLInputElement).value })} />` : nothing}
            ${o.separatore === 'larghezza' ? html`<input type="text" data-campo="posizioni" aria-label="Posizioni in cui tagliare" placeholder="10; 25" .value=${this.posizioni}
              @input=${(e: Event) => { this.posizioni = (e.target as HTMLInputElement).value; this.errore = ''; }} />` : nothing}
          </div>
          ${o.separatore === 'larghezza' ? nothing : html`
            <label class="casella"><input type="checkbox" data-campo="consecutivi" .checked=${o.consecutiviComeUno} @change=${(e: Event) => this.cambia({ consecutiviComeUno: (e.target as HTMLInputElement).checked })} /> Separatori di fila come uno solo</label>
            <label class="casella"><input type="checkbox" data-campo="virgolette" .checked=${o.virgolette} @change=${(e: Event) => this.cambia({ virgolette: (e.target as HTMLInputElement).checked })} /> Il testo tra virgolette resta unito</label>`}
          <label class="casella"><input type="checkbox" data-campo="spazi" .checked=${o.togliSpazi} @change=${(e: Event) => this.cambia({ togliSpazi: (e.target as HTMLInputElement).checked })} /> Togli gli spazi in cima e in fondo</label>
          <div class="anteprima" aria-label="Anteprima">
            <table><tbody>${divise.map((p) => html`<tr>${Array.from({ length: larghe }, (_, i) => html`<td>${p[i] ?? ''}</td>`)}</tr>`)}</tbody></table>
          </div>
          ${this.errore ? html`<div class="errore" role="alert">${this.errore}</div>` : nothing}
          ${this.sovrascritte > 0 ? html`<div class="avviso" role="alert" data-campo="avviso">${t('{} celle piene a destra verranno sostituite.', this.sovrascritte)}</div>` : nothing}
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            ${this.sovrascritte > 0
              ? html`<button class="primario" data-azione="sostituisci" @click=${() => this.dividi(true)}>Sostituisci e dividi</button>`
              : html`<button class="primario" data-azione="dividi" @click=${() => this.dividi(false)}>Dividi</button>`}
          </div>
        </div>
      </div>`;
  }
}
