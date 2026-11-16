import { LOGO_PMB_SHEETS_ORIZZONTALE } from "./logo-pmb";
import { css } from "lit";
import { html } from "../i18n/html";
import { suMac } from "@comune/piattaforma";
import { LinguaElement } from "../i18n/lingua-element";
import { customElement, property, state } from "lit/decorators.js";
import { icons } from "../assets/icons/index";
import { t } from '../i18n/lingua';

@customElement("free-titlebar")
export class FreeTitlebar extends LinguaElement {
  @property({ type: String }) docTitle = "Foglio senza titolo";
  /** True se il documento è effettivamente salvato su disco */
  @property({ type: Boolean }) salvatoSuDisco = false;
  /** Nome o percorso del file salvato su disco se disponibile */
  @property({ type: String }) nomeFileDisco = "";
  @state() private isEditing = false;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--titlebar-height);
      background-color: var(--color-titlebar-bg);
      border-bottom: 1px solid var(--color-border-subtle);
      user-select: none;
      padding: 0 var(--space-2);
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      box-sizing: border-box;
    }

    .drag-region {
      position: absolute;
      top: 0;
      left: 0;
      right: 140px;
      height: var(--titlebar-height);
      z-index: 0;
      -webkit-app-region: drag;
    }

    .left-section {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      z-index: 1;
    }

    /* il logo orizzontale (con il nome del programma) su un pannello chiaro: i suoi testi sono scuri e nel tema scuro non si leggerebbero */
    .marchio {
      display: flex;
      align-items: center;
      height: 106px;
      padding: 0 12px;
      box-sizing: border-box;
      background-color: #ffffff;
      border: 1px solid var(--color-border-subtle);
      border-radius: 8px;
    }
    /* alto 100 pixel: il motto «Sistema professionale di foglio di calcolo» viene di circa 9 pixel e si legge */
    .marchio .logo-pmb { height: 100px; width: auto; display: block; }

    .title-input-container {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .doc-title {
      font-weight: 500;
      font-size: var(--font-size-base);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      cursor: text;
      transition: background-color var(--transition-fast);
      color: var(--color-text);
    }

    .doc-title:hover {
      background-color: var(--color-surface-hover);
    }

    input.doc-title-input {
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      font-weight: 500;
      padding: 2px 6px;
      border: 1px solid var(--color-accent);
      border-radius: var(--radius-sm);
      outline: none;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--transition-fast), color var(--transition-fast);
    }
    .status-badge:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }
    .status-badge.salvato svg {
      color: #10b981; /* Verde stato salvato */
    }
    .status-badge.non-salvato {
      color: #b45309; /* Ambra avviso */
    }
    .status-badge.non-salvato svg {
      color: #f59e0b;
    }

    /* i bottoni della finestra restano alti 38 pixel, in alto a destra come in Windows, anche se la barra è più alta */
    .window-controls {
      display: flex;
      align-items: center;
      align-self: flex-start;
      z-index: 2;
    }

    .control-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 38px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: background-color var(--transition-fast), color var(--transition-fast);
    }

    .control-btn:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }

    .control-btn.close:hover {
      background-color: #ef4444;
      color: #ffffff;
    }

    .control-btn:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: -2px;
    }
  ` as any;

  private handleTitleClick() {
    this.isEditing = true;
    this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector("input.doc-title-input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  private handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.finishEditing((e.target as HTMLInputElement).value);
    } else if (e.key === "Escape") {
      this.isEditing = false;
    }
  }

  private finishEditing(newTitle: string) {
    this.isEditing = false;
    const trimmed = newTitle.trim();
    if (trimmed && trimmed !== this.docTitle && trimmed !== this.titoloVisibile()) {
      this.docTitle = trimmed;
      this.dispatchEvent(new CustomEvent("title-changed", { detail: { title: this.docTitle }, bubbles: true, composed: true }));
    }
  }

  private handleMinimize() {
    this.dispatchEvent(new CustomEvent("window-minimize", { bubbles: true, composed: true }));
  }

  private handleMaximize() {
    this.dispatchEvent(new CustomEvent("window-maximize", { bubbles: true, composed: true }));
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent("window-close", { bubbles: true, composed: true }));
  }

  /** Il nome da mostrare: quello predefinito si traduce, quello scelto dall'utente no. */
  private titoloVisibile(): string { return this.docTitle === "Foglio senza titolo" ? t("Foglio senza titolo") : this.docTitle; }

  render() {

    return html`
      <!-- su Mac la finestra ha la sua barra del titolo nativa (src-tauri/tauri.macos.conf.json) e i pulsanti a destra non si mostrano -->
      <!-- trascinare sposta la finestra, il doppio clic la ingrandisce o la riporta com'era: lo fa Tauri (permessi in src-tauri/capabilities/default.json) -->
      <div class="drag-region" data-tauri-drag-region></div>

      <div class="left-section">
        <div class="marchio" title="pmb_office — Suite locale per ufficio"><img class="logo-pmb" alt="PMB Sheets" src=${LOGO_PMB_SHEETS_ORIZZONTALE} /></div>

        <div class="title-input-container">
          ${this.isEditing
            ? html`
                <input
                  type="text"
                  class="doc-title-input"
                  .value=${this.titoloVisibile()}
                  @keydown=${this.handleTitleKeyDown}
                  @blur=${(e: FocusEvent) => this.finishEditing((e.target as HTMLInputElement).value)}
                />
              `
            : html`
                <span class="doc-title" @click=${this.handleTitleClick} title="Fai clic per rinominare">
                  ${this.titoloVisibile()}
                </span>
              `}
        </div>

        <div
          class="status-badge ${this.salvatoSuDisco ? 'salvato' : 'non-salvato'}"
          title="${this.salvatoSuDisco
            ? t("Salvato su disco: {}", this.nomeFileDisco || this.titoloVisibile())
            : t("Bozza non ancora salvata su disco — fai clic o premi Ctrl+S per salvarla")}"
          @click=${() => this.dispatchEvent(new CustomEvent('richiedi-salvataggio', { bubbles: true, composed: true }))}
        >
          <span .innerHTML=${this.salvatoSuDisco ? icons.checkCircle : icons.checkCircle}></span>
          <span>${this.salvatoSuDisco ? t("Salvato su disco") : t("Non salvato su disco (Ctrl+S)")}</span>
        </div>
      </div>

      ${suMac() ? '' : html`
      <div class="window-controls">
          <button class="control-btn" @click=${this.handleMinimize} title="Riduci a icona" aria-label="Riduci a icona" .innerHTML=${icons.minimize}></button>
          <button class="control-btn" @click=${this.handleMaximize} title="Ingrandisci" aria-label="Ingrandisci" .innerHTML=${icons.maximize}></button>
          <button class="control-btn close" @click=${this.handleClose} title="Chiudi" aria-label="Chiudi" .innerHTML=${icons.close}></button>
        </div>
      `}
    `;
  }
}
