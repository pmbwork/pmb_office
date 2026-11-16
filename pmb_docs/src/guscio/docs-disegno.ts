import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

type Strumento = 'penna' | 'linea' | 'freccia' | 'rettangolo' | 'ellisse' | 'gomma';
const STRUMENTI: ReadonlyArray<readonly [Strumento, string]> = [['penna', 'Penna'], ['linea', 'Linea'], ['freccia', 'Freccia'], ['rettangolo', 'Rettangolo'], ['ellisse', 'Ellisse'], ['gomma', 'Gomma']];
const COLORI = ['#000000', '#5f6368', '#d93025', '#f29900', '#188038', '#1a73e8', '#9334e6', '#ffffff'];
const LARGHEZZA = 600; const ALTEZZA = 340; const RISOLUZIONE = 2; const ANNULLA_MASSIMO = 30;

/** Finestra Disegno: una tavola bianca con penna, linee, frecce, rettangoli, ellissi e gomma; si inserisce nel documento come immagine. */
@customElement('docs-disegno')
export class DocsDisegno extends LinguaElement {
  @state() private strumento: Strumento = 'penna';
  @state() private colore = '#000000';
  @state() private spessore = 3;
  @state() private pieno = false;
  @state() private passiAnnulla = 0;
  private storia: ImageData[] = [];
  private inizio: { x: number; y: number } | null = null;
  private base: ImageData | null = null;
  private ultimo: { x: number; y: number } | null = null;

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 660px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 20px 24px 24px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    .strumenti { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
    .strumenti button, .pulsanti button { height: 30px; padding: 0 12px; border: 1px solid #dadce0; border-radius: 15px; background: #ffffff; font: inherit; cursor: pointer; color: #0b57d0; }
    .strumenti button:hover, .pulsanti button:hover { background: #f8f9fa; }
    .strumenti button.attivo { background: #e8f0fe; border-color: #0b57d0; font-weight: 500; }
    .strumenti button:disabled { color: #9aa0a6; cursor: default; background: #ffffff; }
    .colori { display: flex; gap: 4px; align-items: center; }
    .colori button.colore { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 2px solid #dadce0; }
    .colori button.colore.attivo { border-color: #0b57d0; box-shadow: 0 0 0 2px #e8f0fe; }
    label.opz { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #444746; }
    select { height: 30px; border: 1px solid #dadce0; border-radius: 4px; font: inherit; background: #ffffff; }
    canvas { display: block; width: ${LARGHEZZA}px; max-width: 100%; height: auto; aspect-ratio: ${LARGHEZZA} / ${ALTEZZA}; border: 1px solid #dadce0; border-radius: 4px; background: #ffffff; cursor: crosshair; touch-action: none; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 12px; margin-top: 14px; }
    .pulsanti button { height: 36px; padding: 0 20px; border-radius: 18px; font-weight: 500; }
    .pulsanti button.primario { border: 0; background: #0b57d0; color: #ffffff; }
  `;

  private tela(): HTMLCanvasElement | null { return this.renderRoot.querySelector('canvas'); }
  private contesto(): CanvasRenderingContext2D | null { return this.tela()?.getContext('2d', { willReadFrequently: true }) ?? null; }

  protected firstUpdated(): void {
    const c = this.tela();
    if (!c) return;
    c.width = LARGHEZZA * RISOLUZIONE; c.height = ALTEZZA * RISOLUZIONE;
    const ctx = this.contesto();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }

  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('.strumenti button')?.focus(); }

  private punto(e: PointerEvent): { x: number; y: number } {
    const c = this.tela()!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  private salvaPerAnnullare(): void {
    const ctx = this.contesto(); const c = this.tela();
    if (!ctx || !c) return;
    this.storia.push(ctx.getImageData(0, 0, c.width, c.height));
    if (this.storia.length > ANNULLA_MASSIMO) this.storia.shift();
    this.passiAnnulla = this.storia.length;
  }

  private stile(ctx: CanvasRenderingContext2D): void {
    const gomma = this.strumento === 'gomma';
    ctx.strokeStyle = gomma ? '#ffffff' : this.colore; ctx.fillStyle = gomma ? '#ffffff' : this.colore;
    ctx.lineWidth = (gomma ? this.spessore * 4 : this.spessore) * RISOLUZIONE; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }

  private suGiu = (e: PointerEvent): void => {
    const ctx = this.contesto(); const c = this.tela();
    if (!ctx || !c || e.button !== 0) return;
    c.setPointerCapture?.(e.pointerId);
    this.salvaPerAnnullare();
    this.inizio = this.punto(e); this.ultimo = this.inizio;
    this.base = ctx.getImageData(0, 0, c.width, c.height);
    if (this.strumento === 'penna' || this.strumento === 'gomma') {
      this.stile(ctx);
      ctx.beginPath(); ctx.arc(this.inizio.x, this.inizio.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    }
  };
  private suMuovi = (e: PointerEvent): void => {
    const ctx = this.contesto();
    if (!ctx || !this.inizio || !this.base) return;
    const p = this.punto(e);
    this.stile(ctx);
    if (this.strumento === 'penna' || this.strumento === 'gomma') {
      ctx.beginPath(); ctx.moveTo(this.ultimo!.x, this.ultimo!.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      this.ultimo = p;
      return;
    }
    ctx.putImageData(this.base, 0, 0);
    this.stile(ctx);
    const { x, y } = this.inizio;
    if (this.strumento === 'linea' || this.strumento === 'freccia') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.x, p.y); ctx.stroke();
      if (this.strumento === 'freccia') {
        const a = Math.atan2(p.y - y, p.x - x); const l = Math.max(10, ctx.lineWidth * 4);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - l * Math.cos(a - 0.45), p.y - l * Math.sin(a - 0.45)); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - l * Math.cos(a + 0.45), p.y - l * Math.sin(a + 0.45)); ctx.stroke();
      }
    } else if (this.strumento === 'rettangolo') {
      if (this.pieno) ctx.fillRect(x, y, p.x - x, p.y - y); else ctx.strokeRect(x, y, p.x - x, p.y - y);
    } else if (this.strumento === 'ellisse') {
      ctx.beginPath(); ctx.ellipse((x + p.x) / 2, (y + p.y) / 2, Math.max(1, Math.abs(p.x - x) / 2), Math.max(1, Math.abs(p.y - y) / 2), 0, 0, Math.PI * 2);
      if (this.pieno) ctx.fill(); else ctx.stroke();
    }
  };
  private suSu = (): void => { this.inizio = null; this.base = null; this.ultimo = null; };

  private annulla(): void {
    const ctx = this.contesto(); const ultimo = this.storia.pop();
    if (ctx && ultimo) ctx.putImageData(ultimo, 0, 0);
    this.passiAnnulla = this.storia.length;
  }
  private cancella(): void {
    const ctx = this.contesto(); const c = this.tela();
    if (!ctx || !c) return;
    this.salvaPerAnnullare();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private conferma(): void { const c = this.tela(); if (c) this.invia('inserisci', { tela: c }); }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-dis">
        <h2 id="titolo-dis">Disegno</h2>
        <div class="strumenti" role="toolbar" aria-label="Strumenti di disegno">
          ${STRUMENTI.map(([id, nome]) => html`<button class=${this.strumento === id ? 'attivo' : ''} aria-pressed=${this.strumento === id ? 'true' : 'false'} @click=${() => { this.strumento = id; }}>${t(nome)}</button>`)}
          <span class="colori" role="group" aria-label="Colore">${COLORI.map((c) => html`<button class=${this.colore === c ? 'colore attivo' : 'colore'} data-colore=${c} aria-label=${t('Colore {}', c)} title=${c} @click=${() => { this.colore = c; }}></button>`)}</span>
          <label class="opz">Spessore <select aria-label="Spessore" @change=${(e: Event) => { this.spessore = Number((e.target as HTMLSelectElement).value); }}>
            ${[1, 2, 3, 5, 8, 12].map((s) => html`<option value=${s} ?selected=${s === this.spessore}>${s}</option>`)}</select></label>
          <label class="opz"><input type="checkbox" .checked=${this.pieno} @change=${(e: Event) => { this.pieno = (e.target as HTMLInputElement).checked; }} /> Pieno</label>
          <button ?disabled=${this.passiAnnulla === 0} @click=${() => this.annulla()}>Annulla</button>
          <button @click=${() => this.cancella()}>Cancella tutto</button>
        </div>
        <canvas aria-label="Tavola da disegno" @pointerdown=${this.suGiu} @pointermove=${this.suMuovi} @pointerup=${this.suSu} @pointercancel=${this.suSu}></canvas>
        <div class="pulsanti">
          <button @click=${() => this.invia('chiudi')}>Chiudi</button>
          <button class="primario" @click=${() => this.conferma()}>Inserisci nel documento</button>
        </div>
      </div>`;
  }
}
