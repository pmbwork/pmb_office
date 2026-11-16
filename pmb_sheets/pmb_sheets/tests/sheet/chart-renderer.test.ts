/**
 * Test unitari per il renderer SVG nativo dei grafici (M3).
 */

import { describe, it, expect } from 'vitest';
import { renderChartSvg } from '../../src/sheet/chart/chart-renderer';
import { ChartConfig } from '../../src/sheet/chart/chart-model';

describe('Chart Renderer SVG (Tutti gli 8 tipi nativi)', () => {
  const baseConfig: ChartConfig = {
    id: 'chart-1',
    title: 'Vendite Trimestrali',
    type: 'column',
    sheetName: 'Foglio1',
    dataRange: 'A1:C5',
    x: 50,
    y: 50,
    width: 500,
    height: 300,
    showLegend: true,
    showLabels: true,
    categories: ['Gen', 'Feb', 'Mar', 'Apr'],
    series: [
      { name: 'Nord', data: [120, 200, 150, 300] },
      { name: 'Sud', data: [90, 130, 210, 180] },
    ],
  };

  it('genera SVG valido per grafico a colonne (column) senza attributi style in linea', () => {
    const svg = renderChartSvg({ ...baseConfig, type: 'column' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-column"');
    expect(svg).toContain('Vendite Trimestrali');
    expect(svg).toContain('Nord');
    expect(svg).toContain('Sud');
    // Verifica rigorosa CSP: nessun style="..."
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico a barre orizzontali (bar)', () => {
    const svg = renderChartSvg({ ...baseConfig, type: 'bar' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-bar"');
    expect(svg).toContain('Gen');
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico a linee (line)', () => {
    const svg = renderChartSvg({ ...baseConfig, type: 'line' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-line"');
    expect(svg).toContain('class="chart-dot"');
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico ad area (area)', () => {
    const svg = renderChartSvg({ ...baseConfig, type: 'area' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-area"');
    expect(svg).toContain('class="chart-line"');
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico a torta (pie) con fette <path class="chart-slice">', () => {
    const svg = renderChartSvg({
      ...baseConfig,
      type: 'pie',
      series: [{ name: 'Fatturato', data: [40, 30, 20, 10] }],
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-slice"');
    expect(svg).toContain('%'); // Etichette percentuali
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico a ciambella (donut) con raggio interno', () => {
    const svg = renderChartSvg({
      ...baseConfig,
      type: 'donut',
      series: [{ name: 'Quote', data: [50, 25, 25] }],
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-slice"');
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico a dispersione (scatter)', () => {
    const svg = renderChartSvg({ ...baseConfig, type: 'scatter' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-scatter-point"');
    expect(svg).not.toContain('style=');
  });

  it('genera SVG valido per grafico combinato (combo: colonne + linea)', () => {
    const svg = renderChartSvg({
      ...baseConfig,
      type: 'combo',
      series: [
        { name: 'Reale', data: [100, 200, 300, 400], type: 'column' },
        { name: 'Target', data: [150, 250, 280, 350], type: 'line' },
      ],
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="chart-column"');
    expect(svg).toContain('class="chart-line"');
    expect(svg).not.toContain('style=');
  });
});
