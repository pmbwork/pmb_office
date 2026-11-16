import { describe, it, expect } from 'vitest';
import {
  calcolaGeometria,
  IMPOSTAZIONI_PREDEFINITE,
  type ImpostazioniPagina,
} from '../../src/editor/pagine';
import { DocsImpostaPagina } from '../../src/guscio/docs-imposta-pagina';
import '../../src/guscio/docs-imposta-pagina';
import { DocsGuscio } from '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-guscio';

describe('T405: Impostazione pagina (Menu File > Impostazione pagina)', () => {
  it('calcolaGeometria calcola correttamente dimensioni e margini per i formati e orientamenti', () => {
    // A4 Verticale (default)
    const a4v = calcolaGeometria(IMPOSTAZIONI_PREDEFINITE);
    expect(a4v.larghezza).toBe(794);
    expect(a4v.altezza).toBe(1123);
    expect(a4v.altezzaPagina).toBe(1123);
    expect(a4v.margineAlto).toBe(96);
    expect(a4v.margineBasso).toBe(96);

    // A4 Orizzontale
    const a4h = calcolaGeometria({ ...IMPOSTAZIONI_PREDEFINITE, orientamento: 'orizzontale' });
    expect(a4h.larghezza).toBe(1123);
    expect(a4h.altezza).toBe(794);
    expect(a4h.altezzaPagina).toBe(794);

    // Letter Verticale
    const letv = calcolaGeometria({ ...IMPOSTAZIONI_PREDEFINITE, formato: 'Letter' });
    expect(letv.larghezza).toBe(816);
    expect(letv.altezza).toBe(1056);

    // A3 Verticale
    const a3v = calcolaGeometria({ ...IMPOSTAZIONI_PREDEFINITE, formato: 'A3' });
    expect(a3v.larghezza).toBe(1123);
    expect(a3v.altezza).toBe(1587);

    // A5 Verticale
    const a5v = calcolaGeometria({ ...IMPOSTAZIONI_PREDEFINITE, formato: 'A5' });
    expect(a5v.larghezza).toBe(559);
    expect(a5v.altezza).toBe(794);

    // Margini personalizzati
    const marginiCustom = calcolaGeometria({
      ...IMPOSTAZIONI_PREDEFINITE,
      margineAlto: 120,
      margineBasso: 140,
    });
    expect(marginiCustom.margineAlto).toBe(120);
    expect(marginiCustom.margineBasso).toBe(140);
  });

  it('docs-imposta-pagina emette evento applica con i nuovi valori', async () => {
    const el = document.createElement('docs-imposta-pagina') as DocsImpostaPagina;
    document.body.appendChild(el);
    await el.updateComplete;

    let applicato: ImpostazioniPagina | null = null;
    el.addEventListener('applica', (e: Event) => {
      applicato = (e as CustomEvent).detail.impostazioni;
    });

    // Seleziona orientamento orizzontale
    const radioOrizzontale = el.renderRoot.querySelector<HTMLInputElement>('input[value="orizzontale"]');
    expect(radioOrizzontale).not.toBeNull();
    radioOrizzontale!.checked = true;
    radioOrizzontale!.dispatchEvent(new Event('change'));
    await el.updateComplete;

    // Seleziona formato Letter
    const selectFormato = el.renderRoot.querySelector<HTMLSelectElement>('select[aria-label="Formato carta"]');
    expect(selectFormato).not.toBeNull();
    selectFormato!.value = 'Letter';
    selectFormato!.dispatchEvent(new Event('change'));
    await el.updateComplete;

    // Clic su OK
    const btnOk = el.renderRoot.querySelector<HTMLButtonElement>('button.ok');
    expect(btnOk).not.toBeNull();
    btnOk!.click();

    expect(applicato).not.toBeNull();
    expect(applicato!.orientamento).toBe('orizzontale');
    expect(applicato!.formato).toBe('Letter');

    el.remove();
  });

  it('docs-imposta-pagina emette chiudi su Escape o clic su Annulla', async () => {
    const el = document.createElement('docs-imposta-pagina') as DocsImpostaPagina;
    document.body.appendChild(el);
    await el.updateComplete;

    let chiuso = false;
    el.addEventListener('chiudi', () => { chiuso = true; });

    const btnAnnulla = el.renderRoot.querySelector<HTMLButtonElement>('button.annulla');
    btnAnnulla?.click();
    expect(chiuso).toBe(true);

    chiuso = false;
    const velo = el.renderRoot.querySelector('.velo');
    velo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(chiuso).toBe(true);

    el.remove();
  });

  it('DocsGuscio apre il dialogo tramite File > Impostazione pagina e aggiorna le classi della pagina', async () => {
    const guscio = document.createElement('docs-guscio') as DocsGuscio;
    document.body.appendChild(guscio);
    await guscio.updateComplete;

    const mb = guscio.renderRoot.querySelector('docs-menubar');
    expect(mb).not.toBeNull();

    // Invio voce menu "Impostazione pagina"
    mb?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'file', voce: 'Impostazione pagina' },
      bubbles: true,
      composed: true,
    }));
    await guscio.updateComplete;

    // Verifica che il dialogo sia aperto
    const dialogo = guscio.renderRoot.querySelector('docs-imposta-pagina');
    expect(dialogo).not.toBeNull();

    // Applica nuova impostazione: Orizzontale Letter
    dialogo?.dispatchEvent(new CustomEvent('applica', {
      detail: {
        impostazioni: {
          ...IMPOSTAZIONI_PREDEFINITE,
          orientamento: 'orizzontale',
          formato: 'Letter',
        },
      },
      bubbles: true,
      composed: true,
    }));
    await guscio.updateComplete;

    // Il dialogo si chiude
    expect(guscio.renderRoot.querySelector('docs-imposta-pagina')).toBeNull();

    // La pagina ha le classi corrispondenti
    const pagina = guscio.renderRoot.querySelector('.pagina');
    expect(pagina?.classList.contains('orientamento-orizzontale')).toBe(true);
    expect(pagina?.classList.contains('formato-letter')).toBe(true);

    // DocsEditor riceve le nuove impostazioni
    const ed = guscio.renderRoot.querySelector('docs-editor') as any;
    expect(ed.impostazioniPagina.orientamento).toBe('orizzontale');
    expect(ed.impostazioniPagina.formato).toBe('Letter');

    guscio.remove();
  });
});
