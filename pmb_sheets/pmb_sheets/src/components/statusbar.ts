import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { t } from "../i18n/lingua";
import { customElement, property } from "lit/decorators.js";

@customElement("free-statusbar")
export class FreeStatusbar extends LinguaElement {
  @property({ type: String }) statusMessage = "Pronto";
  @property({ type: String }) statsMessage = "";
  @property({ type: Number }) zoom = 100;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--statusbar-height);
      background-color: var(--color-statusbar-bg);
      border-top: 1px solid var(--color-border);
      padding: 0 var(--space-3);
      user-select: none;
      box-sizing: border-box;
      font-family: var(--font-family-base);
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .selection-stats {
      font-weight: 500;
      color: var(--color-text);
      margin-right: var(--space-2);
    }

    .zoom-slider {
      width: 90px;
      height: 4px;
      accent-color: var(--color-accent);
      cursor: pointer;
    }

    .zoom-text {
      width: 40px;
      text-align: right;
      font-weight: 500;
      color: var(--color-text);
    }
  ` as any;

  private handleZoomChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.dispatchEvent(new CustomEvent("zoom-change", { detail: { zoom: val }, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="status-left" role="status" aria-live="polite" aria-atomic="true">
        <span>${this.statusMessage === "Pronto" ? t("Pronto") : this.statusMessage}</span>
      </div>

      <div class="status-right">
        ${this.statsMessage ? html`<span class="selection-stats">${this.statsMessage}</span>` : ""}
        <span>Zoom:</span>
        <input
          type="range"
          class="zoom-slider"
          min="50"
          max="200"
          step="5"
          .value=${this.zoom.toString()}
          @input=${this.handleZoomChange}
          aria-label="Regola livello di zoom"
        />
        <span class="zoom-text">${this.zoom}%</span>
      </div>
    `;
  }
}
