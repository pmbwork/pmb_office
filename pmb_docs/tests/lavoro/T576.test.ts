// T576: pulsanti divisi dei colori nella barra (segnalazione del 2026-11-26: «accanto ci dovrebbe essere una freccetta per il menu per
// scegliere il colore e cliccando sull'icona semplicemente adottare il colore selezionato e presente nell'icona», come Word e LibreOffice).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-toolbar';
import { conStriscia, COLORI_INIZIALI } from '@comune/icone';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-toolbar');
  el.larghezza = 1600;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const comandi = (el: any): string[] => { const out: string[] = []; el.addEventListener('comando', (e: CustomEvent) => out.push(e.detail.id)); return out; };

describe('T576: pulsanti divisi dei colori (pmb_docs)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('l\'icona applica il colore della striscia, la freccia apre la tavolozza', async () => {
    const el = await monta();
    const ids = comandi(el);
    for (const id of ['colore-testo', 'evidenzia']) {
      (el.shadowRoot.querySelector(`button.comando[data-id="${id}"]`) as HTMLElement).click();
      (el.shadowRoot.querySelector(`button.freccia-colore[data-id="${id}-scegli"]`) as HTMLElement).click();
    }
    expect(ids).toEqual(['colore-testo-applica', 'colore-testo', 'evidenzia-applica', 'evidenzia']);
  });
  it('la striscia mostra il colore che si applicherà: all\'inizio rosso e giallo (come Word), poi l\'ultimo scelto', async () => {
    const el = await monta();
    const striscia = (id: string) => el.shadowRoot.querySelector(`button.comando[data-id="${id}"] svg path`)?.getAttribute('fill');
    expect(striscia('colore-testo')).toBe(COLORI_INIZIALI.testo);
    expect(striscia('evidenzia')).toBe(COLORI_INIZIALI.evidenzia);
    el.colori = { 'colore-testo': '#0000ff', 'evidenzia': '#00ff00' };
    await el.updateComplete;
    expect(striscia('colore-testo')).toBe('#0000ff');
    expect(striscia('evidenzia')).toBe('#00ff00');
  });
  it('conStriscia cambia solo la striscia e ignora i colori non validi', () => {
    const svg = '<svg><path d="M0 20h24v4H0z" fill="#1d4ed8"/><path d="M1 1"/></svg>';
    expect(conStriscia(svg, '#abcdef')).toBe('<svg><path d="M0 20h24v4H0z" fill="#abcdef"/><path d="M1 1"/></svg>');
    expect(conStriscia(svg, 'rosso')).toBe(svg);
    expect(conStriscia(svg, undefined)).toBe(svg);
  });
});
