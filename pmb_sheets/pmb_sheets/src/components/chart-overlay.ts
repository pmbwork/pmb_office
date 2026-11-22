/**
 * Componente per il rendering e la manipolazione interattiva dei Grafici sul foglio.
 * Zero attributi style in linea (piena conformità CSP Tauri).
 * Supporta spostamento (drag), ridimensionamento (resize), selezione, esportazione e rimozione.
 */

import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ChartConfig } from '../sheet/chart/chart-model';
import { renderChartSvg } from '../sheet/chart/chart-renderer';
import { salvaSuDisco } from '../formati/file-io';

@customElement('free-chart-overlay')
export class FreeChartOverlay extends LinguaElement {
  @property({ type: Object }) config!: ChartConfig;
  @property({ type: Boolean }) selected = false;

  @state() private isDragging = false;
  @state() private isResizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private origX = 0;
  private origY = 0;
  private origW = 0;
  private origH = 0;

  static styles = css`
    :host {
      position: absolute;
      left: var(--chart-left, 50px);
      top: var(--chart-top, 50px);
      width: var(--chart-width, 480px);
      height: var(--chart-height, 300px);
      display: block;
      box-sizing: border-box;
      z-index: 20;
      user-select: none;
    }

    .chart-container {
      width: 100%;
      height: 100%;
      position: relative;
      background-color: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border, #cbd5e1);
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :host([selected]) .chart-container {
      border: 2px solid var(--color-accent, #2563eb);
    }

    .chart-header {
      height: 28px;
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
      cursor: grab;
    }

    .chart-header:active {
      cursor: grabbing;
    }

    .chart-title-tag {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chart-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .chart-btn {
      background: transparent;
      border: none;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      color: #475569;
      cursor: pointer;
    }

    .chart-btn:hover {
      background-color: #e2e8f0;
      color: #0f172a;
    }

    .chart-body {
      flex: 1;
      width: 100%;
      height: calc(100% - 28px);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-body svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 14px;
      height: 14px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 50%, #94a3b8 50%);
      border-bottom-right-radius: 6px;
    }
  ` as any;

  connectedCallback(): void {
    super.connectedCallback();
    this.updateHostStyles();
  }

  updated(): void {
    this.updateHostStyles();
  }

  private updateHostStyles(): void {
    if (!this.config) return;
    this.style.setProperty('--chart-left', `${this.config.x}px`);
    this.style.setProperty('--chart-top', `${this.config.y}px`);
    this.style.setProperty('--chart-width', `${this.config.width}px`);
    this.style.setProperty('--chart-height', `${this.config.height}px`);
  }

  private handleHeaderMouseDown(e: MouseEvent): void {
    e.stopPropagation();
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.origX = this.config.x;
    this.origY = this.config.y;

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = ev.clientX - this.dragStartX;
      const dy = ev.clientY - this.dragStartY;
      this.config.x = Math.max(0, this.origX + dx);
      this.config.y = Math.max(0, this.origY + dy);
      this.updateHostStyles();
    };

    const onMouseUp = () => {
      this.isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.dispatchEvent(new CustomEvent('chart-change', { detail: this.config, bubbles: true, composed: true }));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private handleResizeMouseDown(e: MouseEvent): void {
    e.stopPropagation();
    this.isResizing = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.origW = this.config.width;
    this.origH = this.config.height;

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.isResizing) return;
      const dw = ev.clientX - this.dragStartX;
      const dh = ev.clientY - this.dragStartY;
      this.config.width = Math.max(200, this.origW + dw);
      this.config.height = Math.max(150, this.origH + dh);
      this.updateHostStyles();
      this.requestUpdate();
    };

    const onMouseUp = () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.dispatchEvent(new CustomEvent('chart-change', { detail: this.config, bubbles: true, composed: true }));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private handleExportSvg(): void {
    const svgCode = renderChartSvg(this.config);
    // come ogni salvataggio: finestra «Salva con nome» del sistema (Windows, Mac) o quella interna nella pocket. Prima, fuori dalla pocket, era uno
    // scaricamento: su Windows finiva in Download senza chiedere dove, sul Mac (WKWebView, senza gestore degli scaricamenti) non faceva niente
    void salvaSuDisco(`${this.config.title || 'grafico'}.svg`, new TextEncoder().encode(svgCode), 'image/svg+xml')
      .catch((e) => console.warn('[grafico] esportazione SVG non riuscita:', e));
  }

  private handleDelete(): void {
    this.dispatchEvent(new CustomEvent('chart-delete', { detail: this.config.id, bubbles: true, composed: true }));
  }

  private handleEdit(): void {
    this.dispatchEvent(new CustomEvent('chart-edit', { detail: this.config, bubbles: true, composed: true }));
  }

  render() {
    if (!this.config) return html``;
    const svgContent = renderChartSvg(this.config);

    return html`
      <div class="chart-container" @click=${() => this.dispatchEvent(new CustomEvent('chart-select', { detail: this.config.id, bubbles: true, composed: true }))}>
        <div class="chart-header" @mousedown=${this.handleHeaderMouseDown}>
          <span class="chart-title-tag">Grafico (${this.config.type})</span>
          <div class="chart-actions">
            <button class="chart-btn" @click=${this.handleEdit} title="Modifica nel pannello">Modifica</button>
            <button class="chart-btn" @click=${this.handleExportSvg} title="Esporta come SVG">Esporta</button>
            <button class="chart-btn" @click=${this.handleDelete} title="Elimina grafico">✕</button>
          </div>
        </div>
        <div class="chart-body" @dblclick=${this.handleEdit}>
          ${unsafeHTML(svgContent)}
        </div>
        <div class="resize-handle" @mousedown=${this.handleResizeMouseDown}></div>
      </div>
    `;
  }
}
