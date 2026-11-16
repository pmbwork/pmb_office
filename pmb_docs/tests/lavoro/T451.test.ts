// T451: menu "Informazioni" di pmb_docs: condizioni d'uso, garanzie e licenze di terze parti.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { MENU } from '../../src/guscio/menu-dati';
import { COMPONENTI_TERZI, TESTI_LICENZE } from '../../src/guscio/licenze-terze';
import { sezioniInformazioni } from '@comune/informazioni/condizioni';

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
async function guscio(): Promise<any> {
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  return g;
}
const finestra = async (g: any): Promise<any> => { await g.updateComplete; const d = g.shadowRoot.querySelector('docs-informazioni'); if (d) await d.updateComplete; return d; };

describe('T451: Informazioni (docs)', () => {
  it('"Informazioni" è la penultima voce del menu in alto (dopo c\'è «Segnalazione bug»), con le sue voci', () => {
    const ultimo = MENU[MENU.length - 2];
    expect(MENU[MENU.length - 1]).toMatchObject({ id: 'segnalazione', etichetta: 'Segnalazione bug', voci: [], diretto: true });
    expect([ultimo.etichetta, ultimo.voci.map((v) => v.etichetta)]).toEqual(['Informazioni', ['Informazioni su pmb_docs', "Condizioni d'uso", 'Licenze di terze parti', 'Installa un aggiornamento', 'Segnala un bug o invia un feedback']]);
  });
  it('ogni voce apre la finestra sulla sua pagina', async () => {
    const g = await guscio();
    g.apriInformazioni('info');
    let d = await finestra(g);
    expect(d).not.toBeNull();
    expect(d.shadowRoot.textContent).toMatch(/software gratuito/i);
    g.apriInformazioni('condizioni');
    d = await finestra(g);
    expect(d.shadowRoot.textContent).toMatch(/GPL-3.0/);
    expect(d.shadowRoot.textContent).toMatch(/Nessuna garanzia/);
    expect(d.shadowRoot.textContent).toMatch(/controllo ortografico/);
    g.apriInformazioni('licenze');
    d = await finestra(g);
    expect(d.shadowRoot.querySelectorAll('tbody tr').length).toBe(COMPONENTI_TERZI.length);
    expect(Array.from(d.shadowRoot.querySelectorAll('details summary')).map((s: any) => s.textContent)).toEqual(Object.keys(TESTI_LICENZE));
  });
  it('si chiude con Chiudi; la ricerca filtra i componenti', async () => {
    const g = await guscio();
    g.apriInformazioni('licenze');
    const d = await finestra(g);
    const campo = d.shadowRoot.querySelector('input[type=search]') as HTMLInputElement;
    campo.value = 'serde'; campo.dispatchEvent(new Event('input'));
    await d.updateComplete;
    const n = d.shadowRoot.querySelectorAll('tbody tr').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(COMPONENTI_TERZI.length);
    (d.shadowRoot.querySelector('.pulsanti button') as HTMLButtonElement).click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-informazioni')).toBeNull();
  });
  it('testi e licenze: gratuito e open source (GPL-3.0), nessuna garanzia, librerie vere', () => {
    const s = sezioniInformazioni({ app: 'pmb_docs', versione: '0.1.0', correttore: true });
    const t = Object.values(s).flat().flatMap((x) => [x.titolo, ...x.paragrafi]).join('\n');
    for (const r of [/software gratuito/i, /GNU General Public License, versione 3/, /distribuire versioni modificate/, /non può presentarla con il nome o il logo PMB/, /senza garanzie di alcun tipo/, /Windows, Microsoft, Word, Excel, Google/, /non invia i tuoi documenti/, /MPL-2\.0/]) expect(t).toMatch(r);
    const nomi = COMPONENTI_TERZI.map((c) => c[0]);
    for (const n of ['lit', 'tauri', 'serde', 'windows']) expect(nomi, n).toContain(n);
    expect(COMPONENTI_TERZI.filter((c) => c[2] === '?' || c[2] === '')).toEqual([]);
    for (const l of ['MIT', 'Apache-2.0', 'MPL-2.0']) expect(TESTI_LICENZE[l], l).toBeTruthy();
  });
  it('«Segnalazione bug» in alto, dopo Informazioni: un clic apre subito la finestra di segnalazione, senza pannello', async () => {
    const g = await guscio();
    const mb: any = g.shadowRoot.querySelector('docs-menubar');
    await mb.updateComplete;
    const titoli = Array.from(mb.shadowRoot.querySelectorAll('button.titolo-menu')) as HTMLButtonElement[];
    const b = titoli.at(-1)!;
    expect([titoli.at(-2)!.textContent!.trim(), b.textContent!.trim(), b.getAttribute('aria-haspopup')]).toEqual(['Informazioni', 'Segnalazione bug', 'false']);
    // passandoci sopra con un altro menu aperto, il pannello si chiude e non se ne apre un altro
    titoli[0].click(); await mb.updateComplete;
    expect(mb.shadowRoot.querySelector('.pannello')).not.toBeNull();
    b.dispatchEvent(new MouseEvent('mouseenter')); await mb.updateComplete;
    expect(mb.shadowRoot.querySelector('.pannello')).toBeNull();
    expect(g.shadowRoot.querySelector('docs-segnala')).toBeNull();
    b.click(); await mb.updateComplete; await g.updateComplete;
    expect(mb.shadowRoot.querySelector('.pannello')).toBeNull();
    expect(g.shadowRoot.querySelector('docs-segnala')).not.toBeNull();
  });
  it('«Segnalazione bug» è evidenziata con un azzurro chiaro (e un blu scuro nel tema scuro)', () => {
    const css = [(customElements.get('docs-menubar') as any).styles].flat(Infinity).map((x: any) => x.cssText).join('');
    expect(css).toContain(".titolo-menu[data-menu='segnalazione'] { background: #e8f0fe; color: #0b57d0;");
    expect(css).toContain(`:host-context(docs-guscio[tema="scuro"]) .titolo-menu[data-menu='segnalazione'] { background: #1f3760; color: #a8c7fa; }`);
  });
});
