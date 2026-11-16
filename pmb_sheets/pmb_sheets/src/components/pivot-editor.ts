/**
 * Pannello laterale di configurazione delle tabelle pivot (M3).
 */

import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t } from '../i18n/lingua';
import { customElement, property } from 'lit/decorators.js';
import { PivotConfig, PivotAggregation } from '../sheet/pivot/pivot-model';

@customElement('free-pivot-editor')
export class FreePivotEditor extends LinguaElement {
  @property({ type: Object }) config: PivotConfig = {
    id: 'pivot-1',
    name: 'Tabella pivot',
    sourceSheet: 'Foglio1',
    sourceRange: 'A1:C10',
    rowFields: [{ sourceColIndex: 0, name: t('Campo Riga') }],
    colFields: [],
    valueFields: [{ sourceColIndex: 1, name: t('Valore'), aggregation: 'SUM' }],
    filters: [],
    showGrandTotals: true,
    showSubtotals: false,
  };

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

  private handleRangeInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.config = { ...this.config, sourceRange: val };
  }

  private handleAggregationChange(e: Event): void {
    const agg = (e.target as HTMLSelectElement).value as PivotAggregation;
    if (this.config.valueFields.length > 0) {
      this.config.valueFields[0].aggregation = agg;
    }
  }

  private handleGrandTotalsToggle(e: Event): void {
    const val = (e.target as HTMLInputElement).checked;
    this.config = { ...this.config, showGrandTotals: val };
  }

  private handleApply(): void {
    this.dispatchEvent(new CustomEvent('pivot-apply', {
      detail: this.config,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="editor-section">
        <label class="editor-label">Intervallo Sorgente Dati</label>
        <input class="editor-input" type="text" .value=${this.config.sourceRange} @input=${this.handleRangeInput} placeholder="es. A1:D10" />
      </div>

      <div class="editor-section">
        <label class="editor-label">Campi Riga</label>
        <input class="editor-input" type="text" .value=${this.config.rowFields.map((f) => f.name).join(', ')} placeholder="Colonna riga..." readonly />
      </div>

      <div class="editor-section">
        <label class="editor-label">Aggregazione Valore</label>
        <select class="editor-select" .value=${this.config.valueFields[0]?.aggregation || 'SUM'} @change=${this.handleAggregationChange}>
          <option value="SUM">SOMMA (SUM)</option>
          <option value="COUNT">CONTEGGIO (COUNT)</option>
          <option value="AVERAGE">MEDIA (AVERAGE)</option>
          <option value="MIN">MINIMO (MIN)</option>
          <option value="MAX">MASSIMO (MAX)</option>
        </select>
      </div>

      <div class="editor-section">
        <label class="checkbox-row">
          <input type="checkbox" ?checked=${this.config.showGrandTotals} @change=${this.handleGrandTotalsToggle} />
          Mostra totali complessivi
        </label>
      </div>

      <button class="btn-apply" @click=${this.handleApply}>Crea / Aggiorna Tabella Pivot</button>
    `;
  }
}
