/**
 * Un'immagine sul foglio: si vede sopra le celle, si sposta trascinandola, si ridimensiona dall'angolo in basso a destra,
 * si seleziona con un clic e si elimina con Canc o col pulsante. Nessun attributo style scritto come testo (regola CSP della shell):
 * posizione e misure passano da variabili CSS impostate dal codice.
 */
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { LATO_MINIMO, type ImmagineConfig } from '../sheet/immagini';
import { t } from '../i18n/lingua';

@customElement('free-immagine-overlay')
export class FreeImmagineOverlay extends LinguaElement {
  @property({ type: Object }) config!: ImmagineConfig;
  @property({ type: Boolean, reflect: true }) selected = false;

  static styles = css`
    :host {
      position: absolute;
      left: var(--img-left, 50px);
      top: var(--img-top, 50px);
      width: var(--img-width, 200px);
      height: var(--img-height, 150px);
      display: block;
      box-sizing: border-box;
      z-index: 15;
      user-select: none;
    }
    .cornice { position: relative; width: 100%; height: 100%; box-sizing: border-box; border: 1px solid transparent; cursor: grab; }
    .cornice:active { cursor: grabbing; }
    :host([selected]) .cornice { border: 2px solid var(--color-accent, #2563eb); }
    img { width: 100%; height: 100%; display: block; object-fit: fill; pointer-events: none; }
    .maniglia { position: absolute; right: -1px; bottom: -1px; width: 14px; height: 14px; cursor: se-resize; background: linear-gradient(135deg, transparent 50%, var(--color-accent, #2563eb) 50%); }
    .elimina { position: absolute; right: 4px; top: 4px; display: none; width: 22px; height: 22px; padding: 0; border: none; border-radius: 4px; background: rgba(15, 23, 42, 0.7); color: #fff; font-size: 13px; line-height: 22px; cursor: pointer; }
    :host([selected]) .elimina { display: block; }
    :host(:not([selected])) .maniglia { display: none; }
  ` as any;

  connectedCallback(): void { super.connectedCallback(); this.applicaMisure(); }
  updated(): void { this.applicaMisure(); }

  private applicaMisure(): void {
    if (!this.config) return;
    this.style.setProperty('--img-left', `${this.config.x}px`);
    this.style.setProperty('--img-top', `${this.config.y}px`);
    this.style.setProperty('--img-width', `${this.config.width}px`);
    this.style.setProperty('--img-height', `${this.config.height}px`);
  }

  private invia(nome: string, dettaglio: unknown): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  private trascina(e: MouseEvent, modo: 'sposta' | 'ridimensiona'): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this.invia('immagine-select', this.config.id);
    const prima = { x: this.config.x, y: this.config.y, width: this.config.width, height: this.config.height };
    const x0 = e.clientX;
    const y0 = e.clientY;
    const suMovimento = (ev: MouseEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (modo === 'sposta') {
        this.config = { ...this.config, x: Math.max(0, prima.x + dx), y: Math.max(0, prima.y + dy) };
      } else {
        this.config = { ...this.config, width: Math.max(LATO_MINIMO, prima.width + dx), height: Math.max(LATO_MINIMO, prima.height + dy) };
      }
      this.applicaMisure();
    };
    const suRilascio = () => {
      window.removeEventListener('mousemove', suMovimento);
      window.removeEventListener('mouseup', suRilascio);
      const dopo = { x: this.config.x, y: this.config.y, width: this.config.width, height: this.config.height };
      if (dopo.x !== prima.x || dopo.y !== prima.y || dopo.width !== prima.width || dopo.height !== prima.height) {
        this.invia('immagine-change', { id: this.config.id, prima, dopo });
      }
    };
    window.addEventListener('mousemove', suMovimento);
    window.addEventListener('mouseup', suRilascio);
  }

  render() {
    if (!this.config) return html``;
    return html`
      <div class="cornice" role="img" aria-label=${t("Immagine {}", this.config.nome)} @mousedown=${(e: MouseEvent) => this.trascina(e, 'sposta')}>
        <img src=${this.config.dataUrl} alt=${this.config.nome} draggable="false" />
        <button class="elimina" title="Elimina l'immagine" aria-label="Elimina l'immagine" @mousedown=${(e: MouseEvent) => e.stopPropagation()} @click=${(e: MouseEvent) => { e.stopPropagation(); this.invia('immagine-delete', this.config.id); }}>✕</button>
        <div class="maniglia" @mousedown=${(e: MouseEvent) => this.trascina(e, 'ridimensiona')}></div>
      </div>
    `;
  }
}
