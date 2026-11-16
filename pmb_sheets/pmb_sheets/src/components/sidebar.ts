import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../assets/icons/index";
import "./chart-editor";
import "./pivot-editor";
import { ChartConfig } from "../sheet/chart/chart-model";
import { PivotConfig } from "../sheet/pivot/pivot-model";
import { columnIndexToLetters } from "../engine/address";
import type { CommentoSalvato } from "../sheet/commenti";

@customElement("free-sidebar")
export class FreeSidebar extends LinguaElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) activeTab: "comments" | "chart" | "pivot" = "comments";
  @property({ type: Object }) chartConfig?: ChartConfig;
  @property({ type: Object }) pivotConfig?: PivotConfig;
  /** i commenti del foglio attivo, in ordine di riga e colonna */
  @property({ attribute: false }) commenti: CommentoSalvato[] = [];

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width);
      height: 100%;
      background-color: var(--color-sidebar-bg);
      border-left: 1px solid var(--color-border);
      box-sizing: border-box;
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      user-select: none;
      transition: width var(--transition-normal);
    }

    :host([hidden]) {
      display: none;
    }

    .commento-voce {
      display: block;
      width: 100%;
      text-align: left;
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-bottom: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }
    .commento-voce:hover { background-color: var(--color-accent-subtle); }
    .commento-cella { font-weight: 500; }
    .commento-data { color: var(--color-text-muted); font-size: 12px; }
    .commento-testo { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 2px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 40px;
      padding: 0 var(--space-3);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .tabs-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .tab-btn {
      background: transparent;
      border: none;
      font-family: var(--font-family-base);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: color var(--transition-fast), background-color var(--transition-fast);
    }

    .tab-btn:hover {
      color: var(--color-text);
      background-color: var(--color-surface-hover);
    }

    .tab-btn.active {
      color: var(--color-accent);
      border-bottom: 2px solid var(--color-accent);
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      cursor: pointer;
    }

    .close-btn:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }

    .sidebar-content {
      flex: 1;
      padding: var(--space-4);
      overflow-y: auto;
    }

    .placeholder-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      gap: var(--space-2);
    }

    .placeholder-title {
      font-weight: 500;
      color: var(--color-text);
    }
  ` as any;

  private vaiACella(riga: number, colonna: number) {
    this.dispatchEvent(new CustomEvent("vai-a-cella", { detail: { riga, colonna }, bubbles: true, composed: true }));
  }

  private closeSidebar() {
    this.dispatchEvent(new CustomEvent("sidebar-close", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="sidebar-header">
        <div class="tabs-header">
          <button
            class="tab-btn ${this.activeTab === 'comments' ? 'active' : ''}"
            @click=${() => (this.activeTab = "comments")}
          >
            Commenti
          </button>
          ${this.chartConfig || this.activeTab === 'chart' ? html`
            <button
              class="tab-btn ${this.activeTab === 'chart' ? 'active' : ''}"
              @click=${() => (this.activeTab = "chart")}
            >
              Grafico
            </button>
          ` : ''}
          ${this.pivotConfig || this.activeTab === 'pivot' ? html`
            <button
              class="tab-btn ${this.activeTab === 'pivot' ? 'active' : ''}"
              @click=${() => (this.activeTab = "pivot")}
            >
              Pivot
            </button>
          ` : ''}
        </div>

        <button class="close-btn" @click=${this.closeSidebar} title="Chiudi pannello laterale" .innerHTML=${icons.close}></button>
      </div>

      <div class="sidebar-content">
        ${this.activeTab === "comments"
          ? this.commenti.length === 0
            ? html`
              <div class="placeholder-box" data-elenco="vuoto">
                <span class="placeholder-title">Commenti</span>
                <span>Nessun commento in questo foglio. Seleziona una cella e scegli Inserisci › Commento.</span>
              </div>
            `
            : html`
              <div data-elenco="commenti">
                ${this.commenti.map((c) => html`
                  <button class="commento-voce" data-riga=${c.riga} data-colonna=${c.colonna} @click=${() => this.vaiACella(c.riga, c.colonna)}>
                    <div class="commento-cella">${columnIndexToLetters(c.colonna)}${c.riga}</div>
                    <div class="commento-testo">${c.testo}</div>
                    ${c.data ? html`<div class="commento-data">${new Date(c.data).toLocaleString("it-IT")}</div>` : ""}
                  </button>`)}
              </div>
            `
          : this.activeTab === "chart" && this.chartConfig
          ? html`
              <free-chart-editor
                .config=${this.chartConfig}
                @chart-apply=${(e: CustomEvent) => this.dispatchEvent(new CustomEvent('chart-apply', { detail: e.detail, bubbles: true, composed: true }))}
              ></free-chart-editor>
            `
          : this.activeTab === "pivot"
          ? html`
              <free-pivot-editor
                .config=${this.pivotConfig}
                @pivot-apply=${(e: CustomEvent) => this.dispatchEvent(new CustomEvent('pivot-apply', { detail: e.detail, bubbles: true, composed: true }))}
              ></free-pivot-editor>
            `
          : html`
              <div class="placeholder-box">
                <span class="placeholder-title">Nessun elemento selezionato</span>
                <span>Seleziona un elemento per visualizzarne le opzioni.</span>
              </div>
            `}
      </div>
    `;
  }
}
