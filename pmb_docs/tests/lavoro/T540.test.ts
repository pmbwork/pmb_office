// T540: RTF, parti saltate e dati binari (analisi del 2026-11-18, visto anche sul programma installato): una nota a piè di pagina spezzava il
// paragrafo in cui si trova, un'intestazione aggiungeva un paragrafo vuoto e toglieva l'allineamento al testo, \binN non era gestito.
import { describe, it, expect } from 'vitest';
import { importaRtf } from '../../src/formati/rtf';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const par = (rtf: string): Array<{ t: string; al?: string }> =>
  importaRtf(enc(rtf)).paragrafi.map((p) => ({ t: p.runs.map((r) => r.t).join(''), ...(p.al ? { al: p.al } : {}) }));

describe('T540: RTF, parti saltate e dati binari', () => {
  it('una nota a piè di pagina non spezza il paragrafo in cui si trova', () => {
    expect(par('{\\rtf1\\ansi\\pard Prima parte{\\footnote \\pard\\plain Testo della nota\\par} seconda parte.\\par}').map((p) => p.t))
      .toEqual(['Prima parte seconda parte.']);
  });
  it('un’intestazione non aggiunge paragrafi vuoti e non toglie l’allineamento al testo', () => {
    expect(par('{\\rtf1\\ansi{\\header \\pard Intestazione\\par}\\pard\\qc Titolo centrato\\par}')).toEqual([{ t: 'Titolo centrato', al: 'ce' }]);
    expect(par('{\\rtf1\\ansi\\pard\\qc{\\header \\pard Intestazione\\par} Titolo centrato\\par}')).toEqual([{ t: ' Titolo centrato', al: 'ce' }]);
  });
  it('le celle di una tabella in un piè di pagina non creano tabelle nel documento', () => {
    const doc = importaRtf(enc('{\\rtf1\\ansi{\\footer \\trowd\\intbl Pagina\\cell\\row}\\pard Testo\\par}'));
    expect(doc.paragrafi.map((p) => p.runs.map((r) => r.t).join(''))).toEqual(['Testo']);
    expect(doc.paragrafi.every((p) => !p.tb)).toBe(true);
  });
  it('\\binN salta i suoi byte anche se contengono parentesi e barre', () => {
    expect(par('{\\rtf1\\ansi Prima{\\*\\objdata \\bin7 {{\\x}}\\} dopo\\par Ultimo\\par}').map((p) => p.t)).toEqual(['Prima dopo', 'Ultimo']);
  });
  it('fuori dalle parti saltate paragrafi e allineamento restano come prima', () => {
    expect(par('{\\rtf1\\ansi\\pard\\qr Destra\\par\\pard Normale\\par}')).toEqual([{ t: 'Destra', al: 'dx' }, { t: 'Normale' }]);
  });
});
