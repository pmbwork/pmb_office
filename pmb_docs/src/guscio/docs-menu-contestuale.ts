// Menu del tasto destro sul documento di pmb_docs (come il menu delle celle di pmb_sheets): Taglia, Copia, Incolla e le altre voci
// di Modifica, più link e formattazione. Il guscio gli dà le voci e la posizione; lui avvisa con "scelta" (menu e voce, come la barra dei menu) o "chiudi".
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { tVoce, scorciatoia } from '../i18n/lingua';

export interface VoceContestuale { menu: string; voce: string; scorciatoia?: string; disattiva?: boolean }
/** Una voce, oppure null per una riga di separazione. */
export type RigaContestuale = VoceContestuale | null;

/** Le voci del menu: Taglia, Copia ed Elimina servono solo con del testo selezionato. */
export function vociContestuali(conSelezione: boolean): RigaContestuale[] {
  return [
    { menu: 'modifica', voce: 'Taglia', scorciatoia: 'Ctrl+X', disattiva: !conSelezione },
    { menu: 'modifica', voce: 'Copia', scorciatoia: 'Ctrl+C', disattiva: !conSelezione },
    { menu: 'modifica', voce: 'Incolla', scorciatoia: 'Ctrl+V' },
    { menu: 'modifica', voce: 'Incolla senza formattazione', scorciatoia: 'Ctrl+Maiusc+V' },
    { menu: 'modifica', voce: 'Elimina', scorciatoia: 'Canc', disattiva: !conSelezione },
    null,
    { menu: 'modifica', voce: 'Seleziona tutto', scorciatoia: 'Ctrl+A' },
    null,
    { menu: 'inserisci', voce: 'Link', scorciatoia: 'Ctrl+K' },
    { menu: 'formato', voce: 'Cancella formattazione', scorciatoia: 'Ctrl+\\', disattiva: !conSelezione },
  ];
}

@customElement('docs-menu-contestuale')
export class DocsMenuContestuale extends LinguaElement {
  @property({ attribute: false }) voci: RigaContestuale[] = [];
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover, :host-context([alto-contrasto]) button:focus-visible { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { position: fixed; z-index: 30; display: block; }
    .pannello { background: var(--pmb-superficie, #ffffff); border-radius: 4px; padding: 6px 0; min-width: 240px;
      box-shadow: 0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3); font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    button { display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; height: 30px; padding: 0 16px 0 24px; border: 0;
      background: none; text-align: left; font: inherit; color: inherit; cursor: default; }
    button:hover:not(:disabled), button:focus-visible { background: var(--pmb-hover, #e8eaed); outline: none; }
    button:disabled { color: var(--pmb-testo-disabilitato, #9aa0a6); }
    .tasti { color: var(--pmb-testo-2, #5f6368); font-size: 13px; }
    button:disabled .tasti { color: inherit; }
    hr { border: 0; border-top: 1px solid var(--pmb-bordo, #e0e0e0); margin: 6px 0; }
  `;

  private ascolta = false;
  private pulsanti(): HTMLButtonElement[] { return Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); }
  /** Mette il fuoco sulla prima voce che si può scegliere (per la tastiera e i lettori di schermo). */
  focalizza(): void { this.pulsanti()[0]?.focus(); }

  private scegli(v: VoceContestuale): void {
    if (v.disattiva) return;
    this.dispatchEvent(new CustomEvent('scelta', { detail: { menu: v.menu, voce: v.voce }, bubbles: true, composed: true }));
  }
  private chiudi(tastiera: boolean): void { this.dispatchEvent(new CustomEvent('chiudi', { detail: { tastiera }, bubbles: true, composed: true })); }
  private fuori = (e: Event): void => { if (!e.composedPath().includes(this)) this.chiudi(false); };
  private tasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.chiudi(true); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const p = this.pulsanti();
      if (p.length === 0) return;
      const i = p.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLButtonElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % p.length : (i <= 0 ? p.length - 1 : i - 1);
      p[n].focus();
    }
  };
  private sfocato = (): void => { this.chiudi(false); };

  connectedCallback(): void {
    super.connectedCallback();
    if (this.ascolta) return;
    this.ascolta = true;
    window.addEventListener('pointerdown', this.fuori, true);
    window.addEventListener('keydown', this.tasto, true);
    window.addEventListener('blur', this.sfocato);
  }
  disconnectedCallback(): void {
    this.ascolta = false;
    window.removeEventListener('pointerdown', this.fuori, true);
    window.removeEventListener('keydown', this.tasto, true);
    window.removeEventListener('blur', this.sfocato);
    super.disconnectedCallback();
  }

  protected updated(): void {
    // il menu resta dentro la finestra
    const w = this.offsetWidth;
    const h = this.offsetHeight;
    const maxX = typeof window !== 'undefined' ? window.innerWidth - w - 4 : this.x;
    const maxY = typeof window !== 'undefined' ? window.innerHeight - h - 4 : this.y;
    this.style.left = `${Math.max(0, w > 0 ? Math.min(this.x, maxX) : this.x)}px`;
    this.style.top = `${Math.max(0, h > 0 ? Math.min(this.y, maxY) : this.y)}px`;
  }

  render() {
    return html`<div class="pannello" role="menu" aria-label="Menu del documento">
      ${this.voci.map((v) => v === null ? html`<hr role="separator" />` : html`
        <button role="menuitem" data-voce=${v.voce} ?disabled=${!!v.disattiva} @click=${() => this.scegli(v)}>
          <span>${tVoce(v.voce)}</span><span class="tasti">${v.scorciatoia ? scorciatoia(v.scorciatoia) : ''}</span></button>`)}
    </div>`;
  }
}
