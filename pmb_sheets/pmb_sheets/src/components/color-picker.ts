/**
 * Componente Selettore Colore per pmb_office.
 * - Tavolozza propria di 40 colori definita in src/theme/palette.ts
 * - Opzioni speciali: "Automatico" e "Nessun riempimento"
 * - Navigabile interamente da tastiera (frecce, Enter, Escape)
 * - Accessibilita ARIA completa
 * - Zero inline style attributes (puro styleMap da CSSOM)
 */

import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t } from '../i18n/lingua';
import { customElement, property, state } from 'lit/decorators.js';
import { PALETTE_COLORS, COLOR_SPECIALS } from '../theme/palette';
import { styleMap } from '../utils/style-map';

@customElement('free-color-picker')
export class FreeColorPicker extends LinguaElement {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
      font-family: inherit;
      color: var(--color-text, #1e293b);
      z-index: 1000;
    }

    /* in posizione fissa, calcolata dal bottone che apre la tavolozza: la barra degli strumenti ha overflow: hidden
       (serve a nascondere i gruppi che non ci stanno) e una tavolozza in posizione assoluta veniva tagliata, invisibile e non cliccabile */
    .picker-popup {
      position: fixed;
      z-index: 3000;
      background: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border, #cbd5e1);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 240px;
      box-sizing: border-box;
    }

    .special-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--color-border, #e2e8f0);
      padding-bottom: 6px;
    }

    .action-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid transparent;
      background: none;
      cursor: pointer;
      font-size: 12px;
      text-align: left;
      color: inherit;
    }

    .action-button:hover,
    .action-button:focus-visible {
      background: var(--color-surface-hover, #f1f5f9);
      border-color: var(--color-border, #cbd5e1);
      outline: none;
    }

    .action-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid var(--color-border, #94a3b8);
      box-sizing: border-box;
    }

    .palette-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
    }

    .color-swatch {
      width: 22px;
      height: 22px;
      border-radius: 3px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      cursor: pointer;
      padding: 0;
      box-sizing: border-box;
      transition: transform 0.05s ease;
    }

    .color-swatch:hover,
    .color-swatch:focus-visible {
      transform: scale(1.15);
      border-color: var(--color-focus, #2563eb);
      outline: 2px solid var(--color-focus, #2563eb);
      z-index: 2;
    }
  `;

  @property({ type: Boolean, reflect: true })
  public open = false;

  @property({ type: String })
  public mode: 'text' | 'fill' | 'border' = 'text';

  @state()
  private focusedIndex = -1;

  /** dove si apre il riquadro (coordinate della finestra): subito sotto il bottone che contiene la tavolozza */
  @state()
  private posizione: { top: number; left: number } | null = null;

  updated(): void {
    if (!this.open) { if (this.posizione) this.posizione = null; return; }
    const ancora = (this.parentElement ?? this).getBoundingClientRect();
    const larghezza = 240;
    const left = Math.max(4, Math.min(ancora.left, window.innerWidth - larghezza - 8));
    const top = ancora.bottom + 4;
    if (!this.posizione || this.posizione.top !== top || this.posizione.left !== left) this.posizione = { top, left };
  }

  public toggle(open?: boolean): void {
    this.open = open !== undefined ? open : !this.open;
    if (this.open) {
      this.focusedIndex = -1;
      setTimeout(() => {
        const first = this.renderRoot.querySelector('.action-button') as HTMLElement;
        first?.focus();
      }, 20);
    }
  }

  public close(): void {
    if (this.open) {
      this.open = false;
      this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    const swatches = Array.from(this.renderRoot.querySelectorAll('.color-swatch')) as HTMLElement[];
    if (swatches.length === 0) return;

    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      let nextIndex = this.focusedIndex;

      if (this.focusedIndex === -1) {
        nextIndex = 0;
      } else {
        if (e.key === 'ArrowRight') nextIndex = (this.focusedIndex + 1) % swatches.length;
        if (e.key === 'ArrowLeft') nextIndex = (this.focusedIndex - 1 + swatches.length) % swatches.length;
        if (e.key === 'ArrowDown') nextIndex = (this.focusedIndex + 8) % swatches.length;
        if (e.key === 'ArrowUp') nextIndex = (this.focusedIndex - 8 + swatches.length) % swatches.length;
      }

      this.focusedIndex = nextIndex;
      swatches[nextIndex]?.focus();
    }
  }

  private selectColor(color: string): void {
    this.dispatchEvent(
      new CustomEvent('color-select', {
        detail: { color, mode: this.mode },
        bubbles: true,
        composed: true,
      })
    );
    this.close();
  }

  render() {
    if (!this.open) return html``;

    return html`
      <div
        class="picker-popup"
        style=${styleMap(this.posizione ? { top: `${this.posizione.top}px`, left: `${this.posizione.left}px` } : { visibility: 'hidden' })}
        role="dialog"
        aria-label="Tavolozza colori"
        aria-modal="true"
        @keydown=${this.handleKeyDown}
      >
        <div class="special-actions">
          <button
            class="action-button"
            type="button"
            role="button"
            @click=${() => this.selectColor(COLOR_SPECIALS.AUTO)}
          >
            <span class="action-dot" style=${styleMap({ backgroundColor: 'var(--color-text, #000000)' })}></span>
            <span>Automatico</span>
          </button>
          ${this.mode === 'fill'
            ? html`
                <button
                  class="action-button"
                  type="button"
                  role="button"
                  @click=${() => this.selectColor(COLOR_SPECIALS.NONE)}
                >
                  <span class="action-dot" style=${styleMap({ backgroundColor: 'transparent' })}></span>
                  <span>Nessun riempimento</span>
                </button>
              `
            : ''}
        </div>

        <div class="palette-grid" role="group" aria-label="Colori della tavolozza">
          ${PALETTE_COLORS.map(
            (c, idx) => html`
              <button
                class="color-swatch"
                type="button"
                role="button"
                aria-label=${t(c.label)}
                title=${t(c.label)}
                tabindex=${this.focusedIndex === idx ? '0' : '-1'}
                style=${styleMap({ backgroundColor: c.hex })}
                @click=${() => this.selectColor(c.hex)}
              ></button>
            `
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'free-color-picker': FreeColorPicker;
  }
}
