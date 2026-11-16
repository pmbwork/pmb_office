// Mac: Cmd al posto di Ctrl e scorciatoie scritte con i simboli del Mac (comune/src/piattaforma.ts). Su Windows non cambia niente.
// Lo stesso file c'è in pmb_docs/tests/piattaforma-mac.test.ts: tenerli uguali.
import { afterEach, describe, expect, it } from 'vitest';
import { impostaMacPerProva, scorciatoiaPerSistema, scorciatoieNelTesto, suMac, tastoPrimario, testoPerSistema } from '@comune/piattaforma';
import { impostaLingua, scorciatoia, t } from '../src/i18n/lingua';

afterEach(() => { impostaMacPerProva(null); impostaLingua('it'); });

describe('piattaforma: Windows e Mac', () => {
  it('nei test (happy-dom su Windows o Linux) non si è su un Mac, a meno di fingerlo', () => {
    expect(suMac()).toBe(false);
    impostaMacPerProva(true);
    expect(suMac()).toBe(true);
  });

  it('il tasto principale è Ctrl su Windows e Cmd su Mac', () => {
    const ctrl = { ctrlKey: true, metaKey: false }, cmd = { ctrlKey: false, metaKey: true };
    expect([tastoPrimario(ctrl), tastoPrimario(cmd)]).toEqual([true, false]);
    impostaMacPerProva(true);
    expect([tastoPrimario(ctrl), tastoPrimario(cmd)]).toEqual([false, true]);
  });

  it('su Windows le scorciatoie restano scritte come sono', () => {
    for (const s of ['Ctrl+S', 'Ctrl+Maiusc+S', 'Alt+Maiusc+5', 'F7']) expect(scorciatoiaPerSistema(s)).toBe(s);
    expect(scorciatoieNelTesto('Grassetto (Ctrl+B)')).toBe('Grassetto (Ctrl+B)');
    expect(testoPerSistema('Automatica (come Windows)')).toBe('Automatica (come Windows)');
  });

  it('su Mac le scorciatoie si scrivono con i simboli, nell\'ordine del Mac', () => {
    impostaMacPerProva(true);
    const attese: Array<[string, string]> = [
      ['Ctrl+S', '⌘S'], ['Ctrl+Maiusc+S', '⇧⌘S'], ['Ctrl+Shift+S', '⇧⌘S'], ['Ctrl+Alt+M', '⌥⌘M'], ['Alt+Maiusc+5', '⌥⇧5'],
      ['Maiusc+F11', '⇧F11'], ['F7', 'F7'], ['Ctrl+Invio', '⌘↩'], ['Ctrl++', '⌘+'], ['Ctrl+o', '⌘O'], ['Ctrl+Y, Ctrl+Maiusc+Z', '⌘Y, ⇧⌘Z'],
    ];
    for (const [da, a] of attese) expect(scorciatoiaPerSistema(da), da).toBe(a);
  });

  it('su Mac le scorciatoie dentro le frasi si convertono e «Windows» diventa «macOS»', () => {
    impostaMacPerProva(true);
    expect(scorciatoieNelTesto('Grassetto (Ctrl+B)')).toBe('Grassetto (⌘B)');
    expect(scorciatoieNelTesto('Non salvato su disco (Ctrl+S)')).toBe('Non salvato su disco (⌘S)');
    expect(scorciatoieNelTesto('Ctrl+clic per aprire il link')).toBe('⌘clic per aprire il link');
    expect(scorciatoieNelTesto('Formatta come valuta (Ctrl+Maiusc+4)')).toBe('Formatta come valuta (⇧⌘4)');
    expect(testoPerSistema('Automatica (come Windows)')).toBe('Automatica (come macOS)');
    expect(testoPerSistema('Nessuna scorciatoia qui')).toBe('Nessuna scorciatoia qui');
  });

  it('le traduzioni e le scritte dei menu del programma passano dalla conversione, in italiano e in inglese', () => {
    expect(scorciatoia('Ctrl+Maiusc+S')).toBe('Ctrl+Maiusc+S');
    impostaMacPerProva(true);
    expect(scorciatoia('Ctrl+Maiusc+S')).toBe('⇧⌘S');
    expect(t('Non salvato su disco (Ctrl+S)')).toBe('Non salvato su disco (⌘S)');
    impostaLingua('en');
    expect(scorciatoia('Ctrl+Maiusc+S')).toBe('⇧⌘S');
    expect(t('Non salvato su disco (Ctrl+S)')).toMatch(/\(⌘S\)/);
  });
});

describe('modalità portatile (device come AI_PRO)', () => {
  afterEach(() => { delete (globalThis as { __PMB_PORTATILE__?: boolean }).__PMB_PORTATILE__; });
  it('la pagina sa di essere sul device solo se la parte nativa lo ha detto', async () => {
    const { portatile } = await import('@comune/piattaforma');
    expect(portatile()).toBe(false);
    (globalThis as { __PMB_PORTATILE__?: boolean }).__PMB_PORTATILE__ = true;
    expect(portatile()).toBe(true);
  });
});
