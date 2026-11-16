// Finestra Dati > Viste filtro...: salva con un nome i filtri attivi del foglio, li richiama e li elimina (Fase 44).
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { columnIndexToLetters } from '../engine/address';
import { LUNGHEZZA_MASSIMA_NOME_VISTA, type VistaFiltro } from '../sheet/filter';
import { t } from '../i18n/lingua';

/** "Colonne A e C" oppure "Colonna B": dove filtra la vista. */
export function descriviVista(v: VistaFiltro): string {
  const lettere = v.filtri.map((f) => columnIndexToLetters(f.col));
  if (lettere.length === 1) return t("Colonna {}", lettere[0]);
  return t("Colonne {} e {}", lettere.slice(0, -1).join(', '), lettere[lettere.length - 1]);
}

@customElement('free-dialogo-viste-filtro')
export class FreeDialogoVisteFiltro extends LinguaElement {
  @property({ attribute: false }) viste: VistaFiltro[] = [];
  /** vero se sul foglio c'è almeno un filtro attivo da salvare */
  @property({ type: Boolean }) filtriAttivi = false;
  @property({ type: String }) errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    ul { list-style: none; margin: 0 0 16px; padding: 0; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; max-height: 200px; overflow: auto; }
    li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; }
    li + li { border-top: 1px solid var(--color-border, #dadce0); }
    .nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .dove { flex: none; color: var(--color-text-secondary, #5f6368); }
    .vuoto { margin: 0 0 16px; color: var(--color-text-secondary, #5f6368); }
    .riga { display: flex; gap: 8px; margin-bottom: 8px; }
    input[type='text'] { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .nota { color: var(--color-text-secondary, #5f6368); margin: 0 0 8px; }
    .errore { color: #d93025; min-height: 18px; margin: 4px 0 12px; }
    .bottoni { display: flex; justify-content: flex-end; }
    button { padding: 6px 12px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button:disabled { opacity: 0.4; cursor: default; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
  `;

  firstUpdated(): void { (this.renderRoot.querySelector('[data-campo="nome"]') as HTMLInputElement | null)?.focus(); }

  /** Dopo un salvataggio riuscito l'elenco cambia e il campo del nome si svuota; dopo un errore il nome resta da correggere. */
  updated(cambiati: Map<string, unknown>): void {
    if (cambiati.has('viste') && this.errore === '') {
      const campo = this.renderRoot.querySelector('[data-campo="nome"]') as HTMLInputElement | null;
      if (campo) campo.value = '';
    }
  }

  private manda(nome: string, detail: Record<string, string> = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true }));
  }

  private salva(): void {
    const campo = this.renderRoot.querySelector('[data-campo="nome"]') as HTMLInputElement | null;
    this.manda('salva-vista', { nome: campo?.value ?? '' });
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); this.manda('chiudi-dialogo'); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).dataset.campo === 'nome') { e.preventDefault(); this.salva(); }
  };

  render() {
    return html`
      <div class="velo" @click=${() => this.manda('chiudi-dialogo')} @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-label="Viste filtro" @click=${(e: Event) => e.stopPropagation()}>
          <h2>Viste filtro</h2>
          ${this.viste.length === 0
            ? html`<p class="vuoto" data-vuoto>Nessuna vista salvata su questo foglio.</p>`
            : html`<ul data-elenco>
                ${this.viste.map((v) => html`
                  <li data-id=${v.id}>
                    <span class="nome" title=${v.nome}>${v.nome}</span>
                    <span class="dove">${descriviVista(v)}</span>
                    <button data-azione="applica" data-id=${v.id} aria-label="Applica la vista ${v.nome}" @click=${() => this.manda('applica-vista', { id: v.id })}>Applica</button>
                    <button data-azione="elimina" data-id=${v.id} aria-label="Elimina la vista ${v.nome}" title="Elimina" @click=${() => this.manda('elimina-vista', { id: v.id })}>✕</button>
                  </li>`)}
              </ul>`}
          <p class="nota">${this.filtriAttivi ? t("Salva i filtri attivi del foglio con un nome (con lo stesso nome la vista si aggiorna).") : t("Per salvare una vista scegli prima un filtro su una colonna.")}</p>
          <div class="riga">
            <input type="text" data-campo="nome" aria-label="Nome della vista" maxlength=${LUNGHEZZA_MASSIMA_NOME_VISTA} placeholder="Nome della vista" ?disabled=${!this.filtriAttivi}>
            <button data-azione="salva" class="primario" ?disabled=${!this.filtriAttivi} @click=${() => this.salva()}>Salva</button>
          </div>
          <div class="errore" role="alert">${this.errore !== '' ? this.errore : nothing}</div>
          <div class="bottoni"><button data-azione="chiudi" @click=${() => this.manda('chiudi-dialogo')}>Chiudi</button></div>
        </div>
      </div>`;
  }
}
