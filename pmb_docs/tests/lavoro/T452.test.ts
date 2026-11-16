// T452: la freccia compare solo sulle voci che hanno davvero un sottomenu, e il sottomenu si apre passandoci sopra (senza clic).
// Un sottomenu può avere le voci scritte nei dati (figli) o calcolate al momento dal guscio (dinamico: Stili paragrafo, Allinea...).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-menubar';
import { MENU } from '../../src/guscio/menu-dati';

beforeEach(() => { document.body.innerHTML = ''; });
async function apri(id: string): Promise<any> {
  const el: any = document.createElement('docs-menubar');
  document.body.appendChild(el);
  await el.updateComplete;
  (el.shadowRoot.querySelector(`button.titolo-menu[data-menu="${id}"]`) as HTMLButtonElement).click();
  await el.updateComplete;
  return el;
}
const voci = (el: any): HTMLElement[] => Array.from(el.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[];

describe('T452: frecce e sottomenu al passaggio del mouse', () => {
  it('nei dati nessuna voce con "sottomenu" è priva di voci (scritte o calcolate), e ogni sottomenu scritto ha almeno una voce', () => {
    for (const m of MENU) for (const v of m.voci) {
      if (v.sottomenu) expect((v.figli?.length ?? 0) > 0 || v.dinamico === true, `${m.id} › ${v.etichetta}`).toBe(true);
      if (v.dinamico) expect(v.sottomenu, `${m.id} › ${v.etichetta}`).toBe(true);
      if (v.figli) expect(v.figli.length, `${m.id} › ${v.etichetta}`).toBeGreaterThan(0);
    }
  });
  it('la freccia c\'è se e solo se la voce ha un sottomenu, in ogni menu', async () => {
    for (const m of MENU) {
      const el = await apri(m.id);
      voci(el).forEach((v, i) => expect(!!v.querySelector('.freccia'), `${m.id} › ${m.voci[i].etichetta}`).toBe(!!(m.voci[i].figli || m.voci[i].dinamico)));
      el.remove();
    }
  });
  it('passando sopra una voce con freccia il sottomenu si apre senza clic; passando su una senza freccia si chiude', async () => {
    for (const m of MENU) {
      const el = await apri(m.id);
      for (const [i, d] of m.voci.entries()) {
        voci(el)[i].dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const sotto = voci(el)[i].querySelector('.sottopannello');
        if (d.figli) {
          expect(sotto, `${m.id} › ${d.etichetta}`).not.toBeNull();
          expect(sotto!.querySelectorAll('.figlio').length).toBe(d.figli.length);
        } else if (d.dinamico) {
          expect(sotto, `${m.id} › ${d.etichetta}`).not.toBeNull(); // le voci le dà il guscio (qui, senza guscio, nessuna)
        } else {
          expect(el.shadowRoot.querySelector('.sottopannello'), `${m.id} › ${d.etichetta}`).toBeNull();
        }
      }
      el.remove();
    }
  });
});
