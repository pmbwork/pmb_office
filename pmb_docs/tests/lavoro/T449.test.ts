// T449: piccole correzioni dalla revisione: segnalibri tra schede, argomenti mancanti nelle equazioni, accessibilità, pannello schede.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { ErroreEquazione, MODELLI_EQUAZIONE, leggiEquazione } from '../../src/guscio/equazione';
import { calcolaScala } from '../../src/guscio/grafico';
import { cursore, daTesto, impostaSegnalibro, statoIniziale, type Documento } from '../../src/modello/documento';
import { unisciSchede } from '../../src/modello/schede';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('T449: segnalibri nel documento unito', () => {
  it('due schede con lo stesso segnalibro: nel documento unito i nomi restano diversi', () => {
    const a = impostaSegnalibro(daTesto('uno'), 0, 'Inizio');
    const b = impostaSegnalibro(daTesto('due'), 0, 'inizio');
    const c = impostaSegnalibro(daTesto('tre'), 0, 'Inizio');
    const m: Documento = unisciSchede([{ titolo: 'A', doc: a }, { titolo: 'B', doc: b }, { titolo: 'C', doc: c }]);
    const nomi = m.paragrafi.map((p) => p.sg).filter((x): x is string => x !== undefined);
    expect(nomi).toEqual(['Inizio', 'inizio (2)', 'Inizio (3)']);
    expect(new Set(nomi.map((n) => n.toLowerCase())).size).toBe(3);
    expect(a.paragrafi[0].sg).toBe('Inizio'); // le schede originali non cambiano
  });
});

describe('T449: equazioni con argomenti mancanti', () => {
  it('\\frac{a} senza denominatore, x^ e \\sqrt senza argomento sono errori chiari (non un risultato vuoto)', () => {
    for (const src of ['\\frac{a}', '\\frac', 'x^', 'x_', '\\sqrt']) {
      expect(() => leggiEquazione(src), src).toThrow(ErroreEquazione);
      try { leggiEquazione(src); } catch (e) { expect((e as Error).message).toContain('Manca un argomento'); }
    }
  });
  it('un gruppo vuoto scritto apposta resta valido, come gli argomenti con un solo carattere', () => {
    expect(() => leggiEquazione('x^{}')).not.toThrow();
    expect(() => leggiEquazione('\\frac12')).not.toThrow();
    expect(() => leggiEquazione('x^2')).not.toThrow();
  });
  it('ogni modello della palette ha un nome per chi usa lo screen reader, e nomi diversi', () => {
    const nomi = MODELLI_EQUAZIONE.map((m) => m.nome);
    expect(nomi.every((n) => n.length > 2)).toBe(true);
    expect(new Set(nomi).size).toBe(nomi.length);
  });
});

describe('T449: scala dei grafici', () => {
  it('le linee dell\'asse a indice cadono esattamente sullo zero anche con passi decimali', () => {
    const s = calcolaScala(-0.3, 0.6);
    const linee = Math.round((s.max - s.min) / s.passo);
    const valori = Array.from({ length: linee + 1 }, (_, k) => s.min + k * s.passo);
    expect(valori.some((v) => Math.abs(v) < s.passo / 1e6)).toBe(true);
    expect(valori[valori.length - 1]).toBeCloseTo(s.max, 9);
  });
});

async function guscio(): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('x')), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}

describe('T449: accessibilità dei dialoghi e pannello schede', () => {
  it('le finestre sono modali, la palette ha le etichette e gli errori si annunciano', async () => {
    const g = await guscio();
    g.apriFinestraImmagine('equazione');
    await g.updateComplete;
    const eq = g.shadowRoot.querySelector('docs-equazione');
    await eq.updateComplete;
    expect(eq.shadowRoot.querySelector('[role=dialog]').getAttribute('aria-modal')).toBe('true');
    const palette = Array.from(eq.shadowRoot.querySelectorAll('.barra button')) as HTMLButtonElement[];
    expect(palette.length).toBe(MODELLI_EQUAZIONE.length);
    expect(palette.every((b) => (b.getAttribute('aria-label') ?? '') !== '')).toBe(true);
    eq.shadowRoot.querySelector('textarea').value = '\\frac{a}';
    eq.shadowRoot.querySelector('textarea').dispatchEvent(new Event('input'));
    await eq.updateComplete; await attendi(30); await eq.updateComplete;
    expect(eq.shadowRoot.querySelector('.errore')?.getAttribute('role')).toBe('alert');
    for (const nome of ['docs-grafico', 'docs-disegno']) {
      g.chiudiFinestreImmagine();
      g.apriFinestraImmagine(nome === 'docs-grafico' ? 'colonne' : 'disegno');
      await g.updateComplete;
      const f = g.shadowRoot.querySelector(nome);
      await f.updateComplete;
      expect(f.shadowRoot.querySelector('[role=dialog]').getAttribute('aria-modal'), nome).toBe('true');
    }
  });
  it('il pannello delle schede sposta la pagina (attributo con-schede) solo quando c\'è', async () => {
    const g = await guscio();
    expect(g.hasAttribute('con-schede')).toBe(false);
    g.nuovaScheda();
    await g.updateComplete;
    expect(g.hasAttribute('con-schede')).toBe(true);
    g.eliminaScheda(1);
    await g.updateComplete;
    expect(g.hasAttribute('con-schede')).toBe(false);
    g.nuovaScheda(); g.nuova?.();
    g.nuovo();
    await g.updateComplete;
    expect(g.hasAttribute('con-schede')).toBe(false);
  });
});
