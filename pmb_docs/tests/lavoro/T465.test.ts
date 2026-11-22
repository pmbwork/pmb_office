// T465: in tema scuro i titoli dei menu in alto non devono avere il testo scuro fisso (sparivano sullo sfondo scuro).
import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-menubar';

describe('T465: menu in tema scuro', () => {
  const css = (customElements.get('docs-menubar') as unknown as { styles: { cssText: string } }).styles.cssText;
  it('l\'host non fissa il colore del testo: lo eredita dal guscio (che in tema scuro è chiaro)', () => {
    const host = /:host\s*\{([^}]*)\}/.exec(css)![1];
    expect(host).toMatch(/color:\s*inherit/);
  });
  it('i pannelli dei menu seguono il tema: fondo e testo sono variabili (chiari nel tema chiaro, scuri nel tema scuro)', () => {
    expect(css).toMatch(/\.pannello,\s*\.sottopannello\s*\{\s*color:\s*var\(--pmb-testo,\s*#1F1F1F\)/i);
    expect(css).toMatch(/\.pannello\s*\{[^}]*background:\s*var\(--pmb-superficie,\s*#FFFFFF\)/i);
  });
  it('in tema scuro il titolo sotto il mouse ha uno sfondo scuro, non quello chiaro del tema chiaro', () => {
    expect(css).toMatch(/docs-guscio\[tema="scuro"\]\)\s*\.titolo-menu:hover\s*\{\s*background:\s*#3c4043/);
  });
});

// T466 (stesso file): cursore a freccia, evidenziazione grigia e pannello sotto il proprio titolo
describe('T466: aspetto dei menu', () => {
  const css = (customElements.get('docs-menubar') as unknown as { styles: { cssText: string } }).styles.cssText;
  it('sui menu il cursore è la freccia e il testo non si seleziona (niente cursore a barra)', () => {
    expect(/:host\s*\{[^}]*cursor:\s*default[^}]*user-select:\s*none/.test(css)).toBe(true);
    expect(/\.pannello,\s*\.sottopannello\s*\{[^}]*cursor:\s*default[^}]*user-select:\s*none/.test(css)).toBe(true);
  });
  it('titoli, voci e sottovoci si evidenziano con lo stesso grigio al passaggio', () => {
    const grigio = (sel: string): string => css.split('}').map((r) => r.trim()).find((r) => r.startsWith(sel + ' {') || r.startsWith(sel + '{'))?.match(/background:\s*(?:var\(--pmb-hover,\s*)?(#[0-9a-f]{6})/i)?.[1] ?? '';
    const titolo = css.split('}').map((r) => r.trim()).find((r) => r.startsWith(".titolo-menu[aria-expanded='true'], .titolo-menu:hover"))?.match(/background:\s*(?:var\(--pmb-hover,\s*)?(#[0-9a-f]{6})/i)?.[1];
    expect(titolo).toBe('#e8eaed');
    expect(grigio('.voce:hover')).toBe(titolo);
    expect(grigio('.figlio:hover')).toBe(titolo);
  });
  it('il pannello si apre sotto il proprio titolo: ha una posizione a sinistra calcolata', async () => {
    const m: any = document.createElement('docs-menubar');
    document.body.appendChild(m);
    await m.updateComplete;
    m.aperto = 'strumenti';
    await m.updateComplete;
    const pannello = m.shadowRoot.querySelector('.pannello') as HTMLElement;
    expect(pannello.getAttribute('data-menu')).toBe('strumenti');
    expect(pannello.style.left).toMatch(/^\d+px$/);
  });
});
