// Dialogo «Personalizza barra degli strumenti» per pmb_sheets (come in pmb_docs).
// Consente di riordinare, aggiungere e togliere funzioni e separatori dalla barra degli strumenti.
// Supporta drag-and-drop con il mouse e pulsanti accessibili da tastiera (◀, ▶, ✕, Aggiungi).

import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {
  catalogo,
  funzione,
  barraPredefinita,
  ripulisciBarra,
  spostaElementoBarra,
  SEPARATORE,
  type Funzione,
} from '../sheet/barra-personalizzata';
import { t, tEtichetta, tGruppo } from '../i18n/lingua';

@customElement('free-dialogo-personalizza-barra')
export class FreeDialogoPersonalizzaBarra extends LinguaElement {
  /** Configurazione attuale della barra */
  @property({ attribute: false }) barra: string[] = barraPredefinita();

  @state() private filtro = '';
  /** Oggetto trascinato durante il drag & drop */
  private trascinato: { indice?: number; id?: string } | null = null;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      font-family: var(--font-family-base, sans-serif);
      font-size: 13px;
      color: var(--color-text, #202124);
    }
    .velo {
      position: absolute;
      inset: 0;
      background: rgba(32, 33, 36, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .finestra {
      background: var(--color-bg, #ffffff);
      border-radius: 8px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
      padding: 20px 24px;
      width: min(840px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 500;
    }
    h3 {
      margin: 4px 0 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary, #5f6368);
    }
    p.aiuto {
      margin: 0;
      color: var(--color-text-secondary, #5f6368);
      font-size: 12px;
      line-height: 1.4;
    }
    .barra-corrente {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 48px;
      max-height: 180px;
      overflow-y: auto;
      padding: 8px;
      border: 2px dashed var(--color-border, #dadce0);
      border-radius: 8px;
      background: var(--color-bg-secondary, #f8f9fa);
      box-sizing: border-box;
    }
    .barra-corrente.sopra {
      border-color: #1a73e8;
      background: rgba(26, 115, 232, 0.05);
    }
    .elemento {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 30px;
      padding: 0 4px 0 8px;
      border-radius: 15px;
      background: var(--color-bg, #ffffff);
      border: 1px solid var(--color-border, #dadce0);
      cursor: grab;
      user-select: none;
      font-size: 12px;
    }
    .elemento.separatore {
      padding: 0 4px;
      background: transparent;
      border-style: dashed;
    }
    .elemento.separatore .linea {
      width: 2px;
      height: 18px;
      background: var(--color-text-secondary, #747775);
      display: inline-block;
      margin: 0 4px;
    }
    .elemento.sopra {
      outline: 2px solid #1a73e8;
    }
    .elemento .icona {
      display: inline-flex;
      width: 16px;
      height: 16px;
    }
    .elemento .icona svg {
      width: 16px;
      height: 16px;
    }
    .elemento button,
    .riga button.btn-azione {
      border: 0;
      background: none;
      border-radius: 10px;
      height: 22px;
      min-width: 22px;
      padding: 0 4px;
      font: inherit;
      color: var(--color-text-secondary, #5f6368);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .elemento button:hover,
    .riga button.btn-azione:hover {
      background: var(--color-hover, #e8eaed);
      color: var(--color-text, #202124);
    }
    .cerca-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cerca {
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--color-border, #dadce0);
      border-radius: 15px;
      background: var(--color-bg, #ffffff);
      color: inherit;
      font: inherit;
      width: 300px;
      box-sizing: border-box;
    }
    .catalogo {
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 150px;
      max-height: 38vh;
      border: 1px solid var(--color-border, #dadce0);
      border-radius: 6px;
      padding: 6px 10px;
      box-sizing: border-box;
    }
    .catalogo.sopra {
      border-color: #1a73e8;
      background: rgba(26, 115, 232, 0.03);
    }
    .gruppo-titolo {
      margin: 10px 0 4px;
      font-weight: 600;
      color: var(--color-text-secondary, #5f6368);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .riga {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 30px;
      padding: 0 6px;
      border-radius: 4px;
      cursor: grab;
      font-size: 12.5px;
    }
    .riga:hover {
      background: var(--color-hover, #f1f3f4);
    }
    .riga .nome {
      flex: 1;
    }
    .riga.nella-barra {
      color: var(--color-text-secondary, #747775);
      cursor: default;
    }
    .riga .stato-presente {
      font-size: 11px;
      color: #1a73e8;
      font-weight: 500;
    }
    .pulsanti-basso {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
      margin-top: 4px;
    }
    .pulsanti-basso button {
      height: 32px;
      padding: 0 16px;
      border: 1px solid var(--color-border, #dadce0);
      border-radius: 4px;
      background: var(--color-bg, #ffffff);
      color: var(--color-text, #202124);
      font: inherit;
      cursor: pointer;
    }
    .pulsanti-basso button:hover {
      background: var(--color-hover, #f1f3f4);
    }
    .pulsanti-basso button.primario {
      background: #1a73e8;
      border-color: #1a73e8;
      color: #ffffff;
      font-weight: 500;
    }
    .pulsanti-basso button.primario:hover {
      background: #1557b0;
    }
    .spazio {
      flex: 1;
    }
  `;

  firstUpdated(): void {
    (this.renderRoot.querySelector('input.cerca') as HTMLInputElement | null)?.focus();
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private cambia(nuova: string[]): void {
    this.barra = ripulisciBarra(nuova) ?? [];
    this.dispatchEvent(
      new CustomEvent('barra-cambiata', {
        detail: { barra: this.barra },
        bubbles: true,
        composed: true,
      })
    );
  }

  // --- Drag and Drop ---
  private iniziaDrag(e: DragEvent, x: { indice?: number; id?: string }): void {
    this.trascinato = x;
    e.dataTransfer?.setData('text/plain', JSON.stringify(x));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  private dragSopra(e: DragEvent): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add('sopra');
  }

  private dragFuori(e: DragEvent): void {
    (e.currentTarget as HTMLElement).classList.remove('sopra');
  }

  private leggiTrascinato(e: DragEvent): { indice?: number; id?: string } | null {
    try {
      return this.trascinato ?? JSON.parse(e.dataTransfer?.getData('text/plain') || 'null');
    } catch {
      return null;
    }
  }

  private lasciaInBarra(e: DragEvent, prima?: number): void {
    e.preventDefault();
    e.stopPropagation();
    this.renderRoot.querySelectorAll('.sopra').forEach((x) => x.classList.remove('sopra'));
    const x = this.leggiTrascinato(e);
    this.trascinato = null;
    if (!x) return;

    const dove = prima ?? this.barra.length;
    if (x.indice !== undefined) {
      this.cambia(spostaElementoBarra(this.barra, x.indice, x.indice < dove ? dove - 1 : dove));
    } else if (x.id) {
      const b = [...this.barra];
      if (x.id !== SEPARATORE && b.includes(x.id)) return;
      b.splice(dove, 0, x.id);
      this.cambia(b);
    }
  }

  private lasciaInCatalogo(e: DragEvent): void {
    e.preventDefault();
    this.renderRoot.querySelectorAll('.sopra').forEach((x) => x.classList.remove('sopra'));
    const x = this.leggiTrascinato(e);
    this.trascinato = null;
    if (x?.indice !== undefined) {
      this.togli(x.indice);
    }
  }

  // --- Azioni pulsanti ---
  private togli(indice: number): void {
    this.cambia(this.barra.filter((_, k) => k !== indice));
  }

  private aggiungi(id: string): void {
    if (id !== SEPARATORE && this.barra.includes(id)) return;
    this.cambia([...this.barra, id]);
  }

  private iconaElemento(f: Funzione | undefined) {
    if (f?.icona) {
      return html`<span class="icona">${unsafeHTML(f.icona)}</span>`;
    }
    return '';
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.chiudi();
    }
  };

  render() {
    const filtro = this.filtro.trim().toLowerCase();
    const gruppi = new Map<string, Funzione[]>();

    for (const f of catalogo()) {
      if (filtro && !tEtichetta(f.etichetta).toLowerCase().includes(filtro) && !f.etichetta.toLowerCase().includes(filtro)) continue;
      if (!gruppi.has(f.gruppo)) gruppi.set(f.gruppo, []);
      gruppi.get(f.gruppo)!.push(f);
    }

    const n = this.barra.length;

    return html`
      <div
        class="velo"
        @keydown=${this.suTasto}
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.chiudi();
        }}
      >
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-personalizza">
          <h2 id="titolo-personalizza">Personalizza la barra degli strumenti</h2>
          <p class="aiuto">
            Trascina una funzione o un separatore nella barra per aggiungerlo; trascina gli elementi per
            riordinarli o trascinali fuori per rimuoverli. Puoi anche usare i pulsanti ◀ ▶ ✕.
          </p>

          <h3>La tua barra degli strumenti</h3>
          <div
            class="barra-corrente"
            role="list"
            aria-label="La tua barra"
            @dragover=${this.dragSopra}
            @dragleave=${this.dragFuori}
            @drop=${(e: DragEvent) => this.lasciaInBarra(e)}
          >
            ${this.barra.map((id, i) => {
              const f = funzione(id);
              const sep = id === SEPARATORE;
              const nome = sep ? t("Separatore") : f ? tEtichetta(f.etichetta) : id;

              return html`
                <div
                  class=${sep ? 'elemento separatore' : 'elemento'}
                  role="listitem"
                  data-id=${id}
                  draggable="true"
                  title=${nome}
                  @dragstart=${(e: DragEvent) => this.iniziaDrag(e, { indice: i })}
                  @dragover=${(e: DragEvent) => {
                    e.stopPropagation();
                    this.dragSopra(e);
                  }}
                  @dragleave=${this.dragFuori}
                  @drop=${(e: DragEvent) => this.lasciaInBarra(e, i)}
                >
                  ${sep
                    ? html`<span class="linea" aria-label="Separatore"></span>`
                    : html`${this.iconaElemento(f)}<span class="nome">${nome}</span>`}

                  <button
                    class="btn-azione"
                    aria-label="Sposta a sinistra"
                    title="Sposta a sinistra"
                    ?disabled=${i === 0}
                    @click=${() => this.cambia(spostaElementoBarra(this.barra, i, i - 1))}
                  >
                    ◀
                  </button>
                  <button
                    class="btn-azione"
                    aria-label="Sposta a destra"
                    title="Sposta a destra"
                    ?disabled=${i === n - 1}
                    @click=${() => this.cambia(spostaElementoBarra(this.barra, i, i + 1))}
                  >
                    ▶
                  </button>
                  <button
                    class="btn-azione"
                    aria-label="Togli dalla barra"
                    title="Togli dalla barra"
                    @click=${() => this.togli(i)}
                  >
                    ✕
                  </button>
                </div>
              `;
            })}
          </div>

          <div class="cerca-wrap">
            <h3>Funzioni disponibili</h3>
            <span class="spazio"></span>
            <input
              class="cerca"
              type="search"
              placeholder="Cerca una funzione..."
              aria-label="Cerca una funzione"
              .value=${this.filtro}
              @input=${(e: Event) => {
                this.filtro = (e.target as HTMLInputElement).value;
              }}
            />
          </div>

          <div
            class="catalogo"
            role="list"
            aria-label="Funzioni disponibili"
            @dragover=${this.dragSopra}
            @dragleave=${this.dragFuori}
            @drop=${this.lasciaInCatalogo}
          >
            ${[...gruppi.entries()].map(
              ([gruppo, voci]) => html`
                <div class="gruppo-titolo">${tGruppo(gruppo)}</div>
                ${voci.map((f) => {
                  const dentro = this.barra.includes(f.id);
                  return html`
                    <div
                      class=${dentro ? 'riga nella-barra' : 'riga'}
                      role="listitem"
                      data-id=${f.id}
                      draggable=${dentro ? 'false' : 'true'}
                      @dragstart=${(e: DragEvent) => this.iniziaDrag(e, { id: f.id })}
                    >
                      ${this.iconaElemento(f)}
                      <span class="nome">${tEtichetta(f.etichetta)}</span>
                      ${dentro
                        ? html`<span class="stato-presente">Nella barra</span>`
                        : html`
                            <button
                              class="btn-azione"
                              aria-label="Aggiungi alla barra"
                              @click=${() => this.aggiungi(f.id)}
                            >
                              Aggiungi
                            </button>
                          `}
                    </div>
                  `;
                })}
              `
            )}
          </div>

          <div class="pulsanti-basso">
            <button class="btn-separatore" @click=${() => this.aggiungi(SEPARATORE)}>
              + Aggiungi separatore
            </button>
            <button class="btn-ripristina" @click=${() => this.cambia(barraPredefinita())}>
              Ripristina predefinita
            </button>
            <span class="spazio"></span>
            <button class="primario" @click=${this.chiudi}>Fatto</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'free-dialogo-personalizza-barra': FreeDialogoPersonalizzaBarra;
  }
}

