/**
 * Renderer SVG nativo per grafici di pmb_office Fogli (M3).
 * Zero dipendenze esterne.
 * Rispetta rigorosamente la CSP Tauri: ZERO attributi style in linea.
 * Tutti gli stili usano attributi di presentazione SVG nativi (fill, stroke, font-size, etc.).
 */

import { ChartConfig, CHART_PALETTE } from './chart-model';

function getSeriesColor(index: number, customColor?: string): string {
  if (customColor) return customColor;
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converte coordinate polari in cartesiane (per grafici a torta e ciambella).
 */
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Genera il path SVG per una fetta di torta o ciambella.
 */
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  innerRadius = 0
): string {
  const isFullCircle = endAngle - startAngle >= 359.99;
  if (isFullCircle) {
    endAngle = startAngle + 359.99;
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  if (innerRadius <= 0) {
    // Fetta di torta classica (a spicchio con centro)
    return [
      'M', x, y,
      'L', end.x, end.y,
      'A', radius, radius, 0, largeArcFlag, 1, start.x, start.y,
      'Z',
    ].join(' ');
  } else {
    // Fetta di ciambella (donut con buco interno)
    const innerStart = polarToCartesian(x, y, innerRadius, startAngle);
    const innerEnd = polarToCartesian(x, y, innerRadius, endAngle);
    return [
      'M', end.x, end.y,
      'A', radius, radius, 0, largeArcFlag, 1, start.x, start.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
      'Z',
    ].join(' ');
  }
}

/**
 * Genera il codice SVG completo per un dato ChartConfig.
 */
export function renderChartSvg(config: ChartConfig): string {
  const { width, height, title, showLegend, showLabels, type, categories, series } = config;

  const padLeft = 60;
  const padRight = showLegend ? 110 : 30;
  const padTop = title ? 44 : 24;
  const padBottom = 40;

  const plotW = Math.max(10, width - padLeft - padRight);
  const plotH = Math.max(10, height - padTop - padBottom);

  let elements: string[] = [];

  // 1. Sfondo del grafico
  elements.push(
    `<rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1"/>`
  );

  // 2. Titolo del grafico
  if (title) {
    elements.push(
      `<text x="${width / 2}" y="26" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="#1e293b">${escapeXml(title)}</text>`
    );
  }

  // Se non ci sono dati, mostra messaggio vuoto
  if (!series || series.length === 0 || !categories || categories.length === 0) {
    elements.push(
      `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#94a3b8">Nessun dato da visualizzare</text>`
    );
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
  }

  // Calcolo estremi dei valori numerici
  let allValues: number[] = [];
  for (const s of series) {
    allValues.push(...s.data);
  }
  let minVal = Math.min(0, ...allValues);
  let maxVal = Math.max(1, ...allValues);
  if (minVal === maxVal) maxVal += 1;

  // -------------------------------------------------------------------------
  // GRAFICI CIRCOLARI: TORTA (PIE) & CIAMBELLA (DONUT)
  // -------------------------------------------------------------------------
  if (type === 'pie' || type === 'donut') {
    const s0 = series[0];
    const dataVals = s0.data;
    const total = dataVals.reduce((acc, v) => acc + Math.max(0, v), 0);
    const cx = padLeft + plotW / 2;
    const cy = padTop + plotH / 2;
    const radius = Math.min(plotW, plotH) / 2 - 10;
    const innerRadius = type === 'donut' ? radius * 0.55 : 0;

    let currentAngle = 0;
    dataVals.forEach((val, idx) => {
      const sliceVal = Math.max(0, val);
      const angle = total > 0 ? (sliceVal / total) * 360 : 360 / dataVals.length;
      if (angle <= 0) return;

      const d = describeArc(cx, cy, radius, currentAngle, currentAngle + angle, innerRadius);
      const color = getSeriesColor(idx, s0.color);
      elements.push(
        `<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="2" class="chart-slice"/>`
      );

      // Etichette percentuali opzionali
      if (showLabels && total > 0 && angle > 15) {
        const midAngle = currentAngle + angle / 2;
        const labelR = innerRadius > 0 ? (radius + innerRadius) / 2 : radius * 0.7;
        const pos = polarToCartesian(cx, cy, labelR, midAngle);
        const pct = Math.round((sliceVal / total) * 100);
        elements.push(
          `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="11" font-weight="600" fill="#ffffff">${pct}%</text>`
        );
      }

      currentAngle += angle;
    });

    // Legenda per torta/ciambella (ogni fetta è una categoria)
    if (showLegend) {
      const legX = width - padRight + 12;
      let legY = padTop + 10;
      categories.forEach((cat, idx) => {
        const color = getSeriesColor(idx, s0.color);
        elements.push(
          `<rect x="${legX}" y="${legY}" width="12" height="12" rx="2" fill="${color}"/>`
        );
        elements.push(
          `<text x="${legX + 18}" y="${legY + 10}" font-family="sans-serif" font-size="11" fill="#475569">${escapeXml(cat)}</text>`
        );
        legY += 20;
      });
    }

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
  }

  // -------------------------------------------------------------------------
  // GRAFICO A BARRE ORIZZONTALI (BAR)
  // -------------------------------------------------------------------------
  if (type === 'bar') {
    const numCats = categories.length;
    const catHeight = plotH / numCats;
    const numSeries = series.length;
    const barHeight = Math.max(4, (catHeight * 0.7) / numSeries);

    // Griglia verticale e asse X
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const val = minVal + (t / ticks) * (maxVal - minVal);
      const x = padLeft + (t / ticks) * plotW;
      elements.push(
        `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + plotH}" stroke="#f1f5f9" stroke-width="1"/>`
      );
      elements.push(
        `<text x="${x}" y="${padTop + plotH + 18}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#94a3b8">${Math.round(val)}</text>`
      );
    }

    // Barre e categorie
    categories.forEach((cat, cIdx) => {
      const catY = padTop + cIdx * catHeight;
      elements.push(
        `<text x="${padLeft - 8}" y="${catY + catHeight / 2}" text-anchor="end" dominant-baseline="central" font-family="sans-serif" font-size="11" fill="#475569">${escapeXml(cat)}</text>`
      );

      series.forEach((s, sIdx) => {
        const val = s.data[cIdx] || 0;
        const barW = Math.max(0, ((val - minVal) / (maxVal - minVal)) * plotW);
        const y = catY + (catHeight * 0.15) + sIdx * barHeight;
        const color = getSeriesColor(sIdx, s.color);

        elements.push(
          `<rect x="${padLeft}" y="${y}" width="${barW}" height="${barHeight - 2}" fill="${color}" rx="3" class="chart-bar"/>`
        );

        if (showLabels && barW > 25) {
          elements.push(
            `<text x="${padLeft + barW - 4}" y="${y + (barHeight - 2) / 2}" text-anchor="end" dominant-baseline="central" font-family="sans-serif" font-size="10" fill="#ffffff" font-weight="600">${val}</text>`
          );
        }
      });
    });

    // Assi
    elements.push(
      `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#cbd5e1" stroke-width="1.5"/>`
    );
    elements.push(
      `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#cbd5e1" stroke-width="1.5"/>`
    );
  } else {
    // -------------------------------------------------------------------------
    // GRAFICI A SVILUPPO VERTICALE: COLONNE, LINEE, AREA, DISPERSIONE, COMBINATO
    // -------------------------------------------------------------------------
    const numCats = categories.length;
    const catWidth = plotW / numCats;
    const numSeries = series.length;
    const colWidth = Math.max(6, (catWidth * 0.7) / numSeries);

    const getY = (val: number) => {
      const ratio = (val - minVal) / (maxVal - minVal);
      return padTop + plotH - ratio * plotH;
    };

    // Griglia orizzontale e asse Y
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const val = minVal + (t / ticks) * (maxVal - minVal);
      const y = padTop + plotH - (t / ticks) * plotH;
      elements.push(
        `<line x1="${padLeft}" y1="${y}" x2="${padLeft + plotW}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`
      );
      elements.push(
        `<text x="${padLeft - 8}" y="${y}" text-anchor="end" dominant-baseline="central" font-family="sans-serif" font-size="10" fill="#94a3b8">${Math.round(val)}</text>`
      );
    }

    // Etichette categorie su asse X
    categories.forEach((cat, cIdx) => {
      const x = padLeft + cIdx * catWidth + catWidth / 2;
      elements.push(
        `<text x="${x}" y="${padTop + plotH + 18}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#475569">${escapeXml(cat)}</text>`
      );
    });

    // 1. Colonne (Column & Combo-column)
    series.forEach((s, sIdx) => {
      const isColumn = type === 'column' || (type === 'combo' && (s.type === 'column' || !s.type));
      if (!isColumn) return;

      const color = getSeriesColor(sIdx, s.color);
      s.data.forEach((val, cIdx) => {
        const catX = padLeft + cIdx * catWidth;
        const x = catX + (catWidth * 0.15) + sIdx * colWidth;
        const y = getY(val);
        const zeroY = getY(0);
        const barH = Math.abs(zeroY - y);
        const topY = Math.min(y, zeroY);

        elements.push(
          `<rect x="${x}" y="${topY}" width="${colWidth - 2}" height="${Math.max(1, barH)}" fill="${color}" rx="3" class="chart-column"/>`
        );

        if (showLabels && barH > 15) {
          elements.push(
            `<text x="${x + (colWidth - 2) / 2}" y="${topY - 4}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#334155" font-weight="600">${val}</text>`
          );
        }
      });
    });

    // 2. Linee e Area (Line, Area, Combo-line)
    series.forEach((s, sIdx) => {
      const isLine = type === 'line' || (type === 'combo' && s.type === 'line');
      const isArea = type === 'area';
      if (!isLine && !isArea) return;

      const color = getSeriesColor(sIdx, s.color);
      const points: { x: number; y: number }[] = [];

      s.data.forEach((val, cIdx) => {
        const x = padLeft + cIdx * catWidth + catWidth / 2;
        const y = getY(val);
        points.push({ x, y });
      });

      if (points.length > 0) {
        if (isArea) {
          const zeroY = getY(0);
          const areaPoints = [
            `M ${points[0].x} ${zeroY}`,
            ...points.map((p) => `L ${p.x} ${p.y}`),
            `L ${points[points.length - 1].x} ${zeroY}`,
            'Z',
          ].join(' ');
          elements.push(
            `<path d="${areaPoints}" fill="${color}" fill-opacity="0.25" class="chart-area"/>`
          );
        }

        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        elements.push(
          `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" class="chart-line"/>`
        );

        // Nodi / pallini sulla linea
        points.forEach((p, idx) => {
          elements.push(
            `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#ffffff" stroke="${color}" stroke-width="2" class="chart-dot"/>`
          );
          if (showLabels) {
            elements.push(
              `<text x="${p.x}" y="${p.y - 7}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#334155" font-weight="600">${s.data[idx]}</text>`
            );
          }
        });
      }
    });

    // 3. Dispersione (Scatter)
    if (type === 'scatter') {
      series.forEach((s, sIdx) => {
        const color = getSeriesColor(sIdx, s.color);
        s.data.forEach((val, cIdx) => {
          const x = padLeft + cIdx * catWidth + catWidth / 2;
          const y = getY(val);
          elements.push(
            `<circle cx="${x}" cy="${y}" r="5" fill="${color}" fill-opacity="0.8" stroke="#ffffff" stroke-width="1.5" class="chart-scatter-point"/>`
          );
        });
      });
    }

    // Assi
    elements.push(
      `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#cbd5e1" stroke-width="1.5"/>`
    );
    elements.push(
      `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#cbd5e1" stroke-width="1.5"/>`
    );
  }

  // -------------------------------------------------------------------------
  // LEGENDA (per grafici cartesiani)
  // -------------------------------------------------------------------------
  if (showLegend) {
    const legX = width - padRight + 12;
    let legY = padTop + 10;
    series.forEach((s, idx) => {
      const color = getSeriesColor(idx, s.color);
      elements.push(
        `<rect x="${legX}" y="${legY}" width="12" height="12" rx="2" fill="${color}"/>`
      );
      elements.push(
        `<text x="${legX + 18}" y="${legY + 10}" font-family="sans-serif" font-size="11" fill="#475569">${escapeXml(s.name)}</text>`
      );
      legY += 20;
    });
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
}
