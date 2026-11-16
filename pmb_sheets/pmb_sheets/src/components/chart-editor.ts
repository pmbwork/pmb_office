/**
 * Pannello laterale di configurazione ed editing dei grafici (M3).
 */

import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { ChartConfig, ChartType } from '../sheet/chart/chart-model';

@customElement('free-chart-editor')
export class FreeChartEditor extends LinguaElement {
  @property({ type: Object }) config!: ChartConfig;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: var(--font-family-base, sans-serif);
      font-size: 13px;
      color: var(--color-text, #1e293b);
    }

    .editor-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .editor-label {
      font-weight: 600;
      font-size: 12px;
      color: #64748b;
    }

    .editor-input, .editor-select {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
      background-color: #ffffff;
      color: #0f172a;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .btn-apply {
      padding: 8px 12px;
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }

    .btn-apply:hover {
      background-color: #1d4ed8;
    }
  ` as any;

  private handleTypeChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value as ChartType;
    this.config = { ...this.config, type: val };
    this.dispatchUpdate();
  }

  private handleTitleInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.config = { ...this.config, title: val };
    this.dispatchUpdate();
  }

  private handleRangeInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.config = { ...this.config, dataRange: val };
    this.dispatchUpdate();
  }

  private handleLegendToggle(e: Event): void {
    const val = (e.target as HTMLInputElement).checked;
    this.config = { ...this.config, showLegend: val };
    this.dispatchUpdate();
  }

  private handleLabelsToggle(e: Event): void {
    const val = (e.target as HTMLInputElement).checked;
    this.config = { ...this.config, showLabels: val };
    this.dispatchUpdate();
  }

  private dispatchUpdate(): void {
    this.dispatchEvent(new CustomEvent('chart-config-change', {
      detail: this.config,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.config) return html`<div>Nessun grafico selezionato</div>`;

    return html`
      <div class="editor-section">
        <label class="editor-label">Tipo di Grafico</label>
        <select class="editor-select" .value=${this.config.type} @change=${this.handleTypeChange}>
          <option value="column">Colonne (Verticale)</option>
          <option value="bar">Barre (Orizzontale)</option>
          <option value="line">Linee</option>
          <option value="area">Area</option>
          <option value="pie">Torta</option>
          <option value="donut">Ciambella</option>
          <option value="scatter">Dispersione</option>
          <option value="combo">Combinato (Colonne + Linea)</option>
        </select>
      </div>

      <div class="editor-section">
        <label class="editor-label">Titolo del Grafico</label>
        <input class="editor-input" type="text" .value=${this.config.title || ''} @input=${this.handleTitleInput} placeholder="Titolo grafico..." />
      </div>

      <div class="editor-section">
        <label class="editor-label">Intervallo Dati</label>
        <input class="editor-input" type="text" .value=${this.config.dataRange || ''} @input=${this.handleRangeInput} placeholder="es. A1:B5" />
      </div>

      <div class="editor-section">
        <label class="checkbox-row">
          <input type="checkbox" ?checked=${this.config.showLegend} @change=${this.handleLegendToggle} />
          Mostra legenda
        </label>
      </div>

      <div class="editor-section">
        <label class="checkbox-row">
          <input type="checkbox" ?checked=${this.config.showLabels} @change=${this.handleLabelsToggle} />
          Mostra etichette dati
        </label>
      </div>

      <button class="btn-apply" @click=${this.dispatchUpdate}>Applica Modifiche</button>
    `;
  }
}
