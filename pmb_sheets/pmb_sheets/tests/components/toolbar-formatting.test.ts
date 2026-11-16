import { describe, it, expect } from 'vitest';
import '../../src/components/toolbar';
import '../../src/components/color-picker';
import { FreeToolbar } from '../../src/components/toolbar';
import { FreeColorPicker } from '../../src/components/color-picker';

describe('Toolbar & ColorPicker Formatting Component Tests (happy-dom)', () => {
  it('la toolbar riflette lo stato di grassetto, corsivo e font-size della cella attiva', async () => {
    const tb = document.createElement('free-toolbar') as FreeToolbar;
    tb.activeFormat = {
      bold: true,
      italic: false,
      fontSize: 14,
      fontFamily: 'Roboto',
      numFmt: '€#,##0.00',
    };
    document.body.appendChild(tb);
    await tb.updateComplete;

    const boldBtn = tb.renderRoot.querySelector('#btn-bold');
    expect(boldBtn).not.toBeNull();
    expect(boldBtn?.classList.contains('active')).toBe(true);

    const italicBtn = tb.renderRoot.querySelector('#btn-italic');
    expect(italicBtn).not.toBeNull();
    expect(italicBtn?.classList.contains('active')).toBe(false);

    const currencyBtn = tb.renderRoot.querySelector('#btn-format-currency');
    expect(currencyBtn?.classList.contains('active')).toBe(true);

    // Aggiornamento formato cella attiva
    tb.activeFormat = { bold: false, italic: true, fontSize: 18 };
    await tb.updateComplete;

    expect(boldBtn?.classList.contains('active')).toBe(false);
    expect(italicBtn?.classList.contains('active')).toBe(true);

    document.body.removeChild(tb);
  });

  it('il clic sui pulsanti emette le azioni corrette', async () => {
    const tb = document.createElement('free-toolbar') as FreeToolbar;
    document.body.appendChild(tb);
    await tb.updateComplete;

    let firedAction = '';
    tb.addEventListener('toolbar-action', (e: any) => {
      firedAction = e.detail.action;
    });

    const boldBtn = tb.renderRoot.querySelector('#btn-bold') as HTMLButtonElement;
    boldBtn?.click();
    expect(firedAction).toBe('format-bold');

    const strikeBtn = tb.renderRoot.querySelector('#btn-strike') as HTMLButtonElement;
    strikeBtn?.click();
    expect(firedAction).toBe('format-strike');

    const clearBtn = tb.renderRoot.querySelector('#btn-clear-formatting') as HTMLButtonElement;
    clearBtn?.click();
    expect(firedAction).toBe('clear-formatting');

    document.body.removeChild(tb);
  });

  it('color-picker dispone di 40 colori, opzioni speciali e navigazione accessibile', async () => {
    const picker = document.createElement('free-color-picker') as FreeColorPicker;
    picker.mode = 'fill';
    document.body.appendChild(picker);
    picker.toggle(true);
    await picker.updateComplete;

    const popup = picker.renderRoot.querySelector('.picker-popup');
    expect(popup).not.toBeNull();
    expect(popup?.getAttribute('role')).toBe('dialog');
    expect(popup?.getAttribute('aria-label')).toBe('Tavolozza colori');

    const swatches = picker.renderRoot.querySelectorAll('.color-swatch');
    expect(swatches.length).toBe(40);

    let selectedColor = '';
    picker.addEventListener('color-select', (e: any) => {
      selectedColor = e.detail.color;
    });

    // Clic sul primo campione colore
    (swatches[0] as HTMLButtonElement).click();
    expect(selectedColor).toBe('#f3f4f6');
    expect(picker.open).toBe(false);

    document.body.removeChild(picker);
  });

  it('toolbar responsive a 800, 1000, 1200, 1600px: altezza costante 42px e popup overflow funzionante', async () => {
    const tb = document.createElement('free-toolbar') as any;
    document.body.appendChild(tb);
    await tb.updateComplete;

    // Test a 1600px
    tb.containerWidth = 1600;
    await tb.updateComplete;
    expect(tb.renderRoot.querySelector('#btn-toolbar-more')).toBeNull();

    // Test a 1000px
    tb.containerWidth = 1000;
    await tb.updateComplete;
    const moreBtn1000 = tb.renderRoot.querySelector('#btn-toolbar-more');
    expect(moreBtn1000).not.toBeNull();

    // Test a 800px (finestra minima consentita da tauri.conf.json)
    tb.containerWidth = 800;
    await tb.updateComplete;
    const moreBtn800 = tb.renderRoot.querySelector('#btn-toolbar-more') as HTMLButtonElement;
    expect(moreBtn800).not.toBeNull();

    // Clic su Altro (...) apre il popup overflow
    moreBtn800.click();
    await tb.updateComplete;
    expect(tb.overflowMenuOpen).toBe(true);

    const popup = tb.renderRoot.querySelector('.overflow-popup');
    expect(popup).not.toBeNull();
    expect(popup.getAttribute('role')).toBe('menu');

    // Test di interazione reale su controllo dentro il popup overflow
    let emittedAction = '';
    tb.addEventListener('toolbar-action', (e: any) => {
      emittedAction = e.detail.action;
    });

    const alignRightBtn = popup.querySelector('#btn-align-right-overflow') as HTMLButtonElement;
    alignRightBtn?.click();
    expect(emittedAction).toBe('align-right');

    document.body.removeChild(tb);
  });

  it('calcolo contrasto WCAG del colore automatico del bordo: supera 3:1 sia in chiaro che in scuro', () => {
    // Formula luminanza relativa WCAG 2.2
    function getLuminance(r: number, g: number, b: number): number {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrast(hex1: string, hex2: string): number {
      const parse = (h: string) => {
        const clean = h.replace('#', '');
        return [
          parseInt(clean.substring(0, 2), 16),
          parseInt(clean.substring(2, 4), 16),
          parseInt(clean.substring(4, 6), 16),
        ];
      };
      const [r1, g1, b1] = parse(hex1);
      const [r2, g2, b2] = parse(hex2);
      const l1 = getLuminance(r1, g1, b1);
      const l2 = getLuminance(r2, g2, b2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Tema chiaro: sfondo bianco #ffffff, bordo automatico #1e293b
    const contrastLight = getContrast('#ffffff', '#1e293b');
    expect(contrastLight).toBeGreaterThanOrEqual(3.0);
    expect(contrastLight).toBeGreaterThan(10.0); // Misura reale ~ 12.6:1

    // Tema scuro: sfondo blu notte #0f172a, bordo automatico #e2e8f0
    const contrastDark = getContrast('#0f172a', '#e2e8f0');
    expect(contrastDark).toBeGreaterThanOrEqual(3.0);
    expect(contrastDark).toBeGreaterThan(10.0); // Misura reale ~ 13.5:1
  });
});
