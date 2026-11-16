// Menu a tendina della barra strumenti di pmb_docs: elenco di voci oppure tavolozza di colori.
// Il guscio gli dà il contenuto (popup-dati.ts) e la posizione; lui avvisa con "scelta" o "chiudi".
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import type { Popup, VocePopup } from './popup-dati';
import { famigliaCss } from './caratteri';

@customElement('docs-popup')
export class DocsPopup extends LinguaElement {
  @property({ attribute: false }) popup: Popup | null = null;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { position: fixed; z-index: 10; display: block; }
    .pannello { background: #ffffff; border-radius: 4px; padding: 6px 0; min-width: 160px; max-height: 360px; overflow: auto;
      box-shadow: 0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3); font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .voce { display: flex; align-items: center; width: 100%; height: 32px; padding: 0 16px 0 8px; border: 0; background: none;
      text-align: left; font: inherit; color: inherit; cursor: default; }
    .voce:hover { background: #e8eaed; }
    .spunta { width: 24px; flex: none; text-align: center; }
    .intestazione { padding: 8px 16px 2px; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; color: #5f6368; }
    .voce { font-size: 15px; }
    .tavolozza { display: grid; grid-template-columns: repeat(10, 22px); gap: 4px; padding: 8px 12px; }
    .colore { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 1px solid #c4c7c5; cursor: default; }
    .colore.attiva { outline: 2px solid #1a73e8; outline-offset: 1px; }
  `;

  private ascolta = false;

  private scegli(v: VocePopup): void {
    this.dispatchEvent(new CustomEvent('scelta', { detail: { azione: v.azione }, bubbles: true, composed: true }));
  }
  private chiudi(tastiera: boolean): void {
    this.dispatchEvent(new CustomEvent('chiudi', { detail: { tastiera }, bubbles: true, composed: true }));
  }
  private fuori = (e: Event): void => {
    if (!e.composedPath().includes(this)) this.chiudi(false);
  };
  private tasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); this.chiudi(true); }
  };

  disconnectedCallback() { this.smetti(); super.disconnectedCallback(); }
  private smetti(): void {
    if (!this.ascolta) return;
    this.ascolta = false;
    window.removeEventListener('pointerdown', this.fuori, true);
    window.removeEventListener('keydown', this.tasto, true);
  }

  protected updated(): void {
    if (this.popup && !this.ascolta) {
      this.ascolta = true;
      window.addEventListener('pointerdown', this.fuori, true);
      window.addEventListener('keydown', this.tasto, true);
    } else if (!this.popup) this.smetti();
    const larghezza = this.offsetWidth;
    const massimo = typeof window !== 'undefined' ? window.innerWidth - larghezza - 8 : this.x;
    this.style.left = `${Math.max(0, larghezza > 0 ? Math.min(this.x, massimo) : this.x)}px`;
    this.style.top = `${this.y}px`;
    this.renderRoot.querySelectorAll<HTMLElement>('[data-colore]').forEach((b) => { b.style.backgroundColor = b.dataset.colore ?? ''; });
    // ogni nome di carattere si scrive con il carattere stesso
    this.renderRoot.querySelectorAll<HTMLElement>('button.voce[data-carattere]').forEach((b) => { const c = b.dataset.carattere ?? ''; b.style.fontFamily = c === '' ? '' : famigliaCss(c); });
  }

  private voceLista(v: VocePopup) {
    if (v.intestazione) return html`<div class="intestazione" role="presentation">${v.etichetta}</div>`;
    return html`<button class="voce" role="menuitemradio" data-carattere=${v.carattere ?? ''} aria-checked=${v.attiva ? 'true' : 'false'} @click=${() => this.scegli(v)}><span class="spunta">${v.attiva ? '✓' : ''}</span>${v.etichetta}</button>`;
  }

  render() {
    const p = this.popup;
    if (!p) return html``;
    if (p.tipo === 'lista') return html`<div class="pannello" role="menu" aria-label=${p.titolo}>${p.voci.map((v) => this.voceLista(v))}</div>`;
    const [speciale, ...colori] = p.voci;
    return html`<div class="pannello" role="menu" aria-label=${p.titolo}>
      ${this.voceLista(speciale)}
      <div class="tavolozza">${colori.map((v) => html`<button class=${v.attiva ? 'colore attiva' : 'colore'} role="menuitemradio" aria-checked=${v.attiva ? 'true' : 'false'} aria-label=${v.etichetta} title=${v.etichetta} data-colore=${v.colore ?? ''} @click=${() => this.scegli(v)}></button>`)}</div>
    </div>`;
  }
}
