// T462: i menu in alto (File, Modifica…) si aprono passandoci sopra, senza clic.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/guscio/docs-menubar';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-menubar');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const titolo = (el: any, id: string): HTMLButtonElement => el.shadowRoot.querySelector(`button.titolo-menu[data-menu="${id}"]`);
const pannello = (el: any): HTMLElement | null => el.shadowRoot.querySelector('.pannello');
const passaSopra = async (el: any, id: string): Promise<void> => { titolo(el, id).dispatchEvent(new MouseEvent('mouseenter')); await el.updateComplete; };
const esce = async (el: any): Promise<void> => { el.dispatchEvent(new MouseEvent('mouseleave')); await el.updateComplete; };

beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('T462: menu che si aprono passandoci sopra', () => {
  it('basta passare sul titolo: il pannello si apre, senza clic', async () => {
    const el = await monta();
    expect(pannello(el)).toBeNull();
    await passaSopra(el, 'file');
    expect(pannello(el)?.dataset.menu).toBe('file');
    expect(titolo(el, 'file').getAttribute('aria-expanded')).toBe('true');
  });
  it('passando da un titolo all\'altro si cambia menu, e ne resta aperto uno solo', async () => {
    const el = await monta();
    await passaSopra(el, 'file');
    await passaSopra(el, 'modifica');
    await passaSopra(el, 'strumenti');
    expect(el.shadowRoot.querySelectorAll('.pannello').length).toBe(1);
    expect(pannello(el)?.dataset.menu).toBe('strumenti');
    expect(titolo(el, 'file').getAttribute('aria-expanded')).toBe('false');
  });
  it('uscendo da barra e pannello il menu si richiude dopo un attimo, non subito', async () => {
    const el = await monta();
    await passaSopra(el, 'formato');
    await esce(el);
    expect(pannello(el)).not.toBeNull();            // un movimento storto non fa perdere il menu
    vi.advanceTimersByTime(300); await el.updateComplete;
    expect(pannello(el)).toBeNull();
  });
  it('se il mouse rientra prima dello scadere, il menu resta aperto', async () => {
    const el = await monta();
    await passaSopra(el, 'inserisci');
    await esce(el);
    vi.advanceTimersByTime(100);
    el.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(500); await el.updateComplete;
    expect(pannello(el)?.dataset.menu).toBe('inserisci');
  });
  it('il clic sul titolo appena aperto passandoci sopra lo lascia aperto (e poi non si richiude più da solo)', async () => {
    const el = await monta();
    await passaSopra(el, 'visualizza');
    titolo(el, 'visualizza').click(); await el.updateComplete;
    expect(pannello(el)?.dataset.menu).toBe('visualizza');
    await esce(el);
    vi.advanceTimersByTime(1000); await el.updateComplete;
    expect(pannello(el)?.dataset.menu).toBe('visualizza');            // aperto con il clic: resta finché non si sceglie, Esc o clic fuori
    titolo(el, 'visualizza').click(); await el.updateComplete;       // un altro clic lo chiude, come prima
    expect(pannello(el)).toBeNull();
  });
  it('un menu aperto con il clic non si chiude uscendo con il mouse', async () => {
    const el = await monta();
    titolo(el, 'file').click(); await el.updateComplete;
    await esce(el);
    vi.advanceTimersByTime(1000); await el.updateComplete;
    expect(pannello(el)?.dataset.menu).toBe('file');
  });
  it('Esc e il clic fuori dai menu chiudono quello aperto', async () => {
    const el = await monta();
    await passaSopra(el, 'file');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await el.updateComplete;
    expect(pannello(el)).toBeNull();
    titolo(el, 'modifica').click(); await el.updateComplete;
    expect(pannello(el)).not.toBeNull();
    const altrove = document.createElement('div'); document.body.appendChild(altrove);
    altrove.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true })); await el.updateComplete;
    expect(pannello(el)).toBeNull();
  });
  it('scegliere una voce chiude il menu e l\'uscita del mouse dopo non fa danni', async () => {
    const el = await monta();
    const scelte: unknown[] = []; el.addEventListener('voce-menu', (e: Event) => scelte.push((e as CustomEvent).detail));
    await passaSopra(el, 'file');
    (el.shadowRoot.querySelector('.pannello .voce') as HTMLElement).click(); await el.updateComplete;
    expect(scelte).toHaveLength(1);
    expect(pannello(el)).toBeNull();
    await esce(el); vi.advanceTimersByTime(500); await el.updateComplete;
    expect(pannello(el)).toBeNull();
  });
  it('i sottomenu continuano ad aprirsi passandoci sopra (anche dentro un menu aperto con il mouse)', async () => {
    const el = await monta();
    await passaSopra(el, 'file');
    const voce = (Array.from(el.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((v) => v.querySelector('.freccia'))!;
    voce.dispatchEvent(new MouseEvent('mouseenter')); await el.updateComplete;
    expect(el.shadowRoot.querySelector('.sottopannello')).not.toBeNull();
  });
});
