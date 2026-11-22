// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MISURE, COLORI, STILI } from '../../src/guscio/misure';

describe('T020: misure del guscio di pmb_docs', () => {
  it('misure delle zone', () => {
    // fascia alta col logo orizzontale leggibile: tutto quello che sta sotto scende di 50 px, titolo e menu accanto al logo
    expect(MISURE.logo).toEqual({ x: 16, y: 8, larghezza: 414, altezza: 99 });
    expect(MISURE.intestazione).toEqual({ y: 45, altezza: 24, xTitolo: 454, corpoTitolo: 18 });
    expect(MISURE.barraMenu).toEqual({ x: 8, y: 106, altezza: 33, corpo: 14 });
    expect(MISURE.barraStrumenti).toEqual({ x: 16, y: 149, altezza: 40, corpo: 13, margineLaterale: 16 });
    expect(MISURE.righello).toEqual({ x: 16, y: 197, altezza: 16 });
    expect(MISURE.areaEditor.y).toBe(213);
    expect(MISURE.pagina).toEqual({ larghezza: 794, altezza: 1123, y: 229 });
    // i menu sotto il logo (la barra si disegna 4 px più in basso della sua y), la barra degli strumenti sotto i menu
    expect(MISURE.barraMenu.y + 4).toBeGreaterThanOrEqual(MISURE.logo.y + MISURE.logo.altezza);
    expect(MISURE.barraMenu.y + 4 + MISURE.barraMenu.altezza).toBeLessThan(MISURE.barraStrumenti.y);
    expect(MISURE.logo.x + MISURE.logo.larghezza).toBeLessThan(MISURE.intestazione.xTitolo);
    // finestra bassa: stessa disposizione con il logo a metà, 50 px più in alto, senza sovrapposizioni
    const c = MISURE.compatta;
    expect(c.altezzaFinestra).toBe(740);
    expect(c.logo.larghezza / c.logo.altezza).toBeCloseTo(MISURE.logo.larghezza / MISURE.logo.altezza, 1);
    expect(c.barraMenu.y + 4).toBeGreaterThanOrEqual(c.logo.y + c.logo.altezza);
    expect(c.barraMenu.y + 4 + MISURE.barraMenu.altezza).toBeLessThan(c.barraStrumenti.y);
    expect(MISURE.logo.x + c.logo.larghezza).toBeLessThan(c.intestazione.xTitolo);
    expect([MISURE.barraStrumenti.y - c.barraStrumenti.y, MISURE.righello.y - c.righello.y, MISURE.areaEditor.y - c.areaEditor.y, 222 - c.pannelli.y, 212 - c.schede.y]).toEqual([50, 50, 50, 50, 50]);
    expect(MISURE.pannelloMenu.altezzaVoce).toBe(32);
    expect(MISURE.dialogo.raggio).toBe(28);
  });
  it('colori', () => {
    // variabili del tema con il valore del tema chiaro come riserva (il tema scuro le ridefinisce in TEMA_SCURO)
    expect(COLORI).toEqual({ sfondoApp: 'var(--pmb-sfondo-app, #F8FAFD)', barraStrumenti: 'var(--pmb-barra-strumenti, #F0F4F9)', testo: 'var(--pmb-testo, #1F1F1F)', pannelloMenu: 'var(--pmb-superficie, #FFFFFF)' });
  });
  it('stili dei pannelli', () => {
    expect(STILI.ombraPannelloMenu).toBe('0 2px 6px 2px rgba(0, 0, 0, 0.15)');
    expect(STILI.raggioPannelloMenu).toBe('0 4px 4px 4px');
    expect(STILI.fontBase.startsWith('Roboto')).toBe(true);
  });
});
