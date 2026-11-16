import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { tEtichetta, scorciatoia } from '../i18n/lingua';
import { customElement, property, state } from "lit/decorators.js";
import { getAllExecutableMenuItems, MenuItem } from "../registry/menu";
import { icons } from "../assets/icons/index";

@customElement("free-menu-search")
export class FreeMenuSearch extends LinguaElement {
  @property({ type: Boolean }) open = false;
  @state() private query = "";
  @state() private selectedIndex = 0;

  static styles = css`
    :host {
      display: block;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 80px;
    }

    .search-modal {
      width: 480px;
      max-height: 400px;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--font-family-base);
    }

    .input-row {
      display: flex;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border-subtle);
      gap: var(--space-2);
      color: var(--color-text-secondary);
    }

    input.search-input {
      flex: 1;
      border: none;
      outline: none;
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      background: transparent;
    }

    .shortcut-badge {
      font-size: var(--font-size-xs);
      background-color: var(--color-surface-hover);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      padding: 2px 6px;
      color: var(--color-text-muted);
    }

    .results-list {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-1) 0;
    }

    .result-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-4);
      font-size: var(--font-size-base);
      color: var(--color-text);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .result-item.selected,
    .result-item:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-accent);
    }

    .result-shortcut {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    .no-results {
      padding: var(--space-4);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
  ` as any;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.handleGlobalKeyDown);
  }

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Alt+/ opens search
    if (e.altKey && (e.key === "/" || e.code === "Slash")) {
      e.preventDefault();
      this.openDialog();
      return;
    }

    if (this.open) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeDialog();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const results = this.getFilteredItems();
        if (results.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % results.length;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const results = this.getFilteredItems();
        if (results.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + results.length) % results.length;
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const results = this.getFilteredItems();
        if (results.length > 0 && results[this.selectedIndex]) {
          this.executeItem(results[this.selectedIndex]);
        }
      }
    }
  };

  openDialog() {
    this.open = true;
    this.query = "";
    this.selectedIndex = 0;
    this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector("input.search-input") as HTMLInputElement;
      if (input) input.focus();
    });
  }

  closeDialog() {
    this.open = false;
    this.query = "";
  }

  private getFilteredItems(): MenuItem[] {
    const all = getAllExecutableMenuItems();
    if (!this.query.trim()) return all;
    const q = this.query.toLowerCase();
    return all.filter((item) => tEtichetta(item.label).toLowerCase().includes(q) || item.label.toLowerCase().includes(q));
  }

  private executeItem(item: MenuItem) {
    this.closeDialog();
    this.dispatchEvent(
      new CustomEvent("menu-action", {
        detail: { action: item.action, label: tEtichetta(item.label) },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.open) return html``;

    const results = this.getFilteredItems();

    return html`
      <div class="modal-backdrop" @click=${(e: MouseEvent) => {
        if (e.target === e.currentTarget) this.closeDialog();
      }}>
        <div class="search-modal">
          <div class="input-row">
            <span .innerHTML=${icons.search}></span>
            <input
              type="text"
              class="search-input"
              placeholder="Cerca nei menu..."
              .value=${this.query}
              @input=${(e: Event) => {
                this.query = (e.target as HTMLInputElement).value;
                this.selectedIndex = 0;
              }}
            />
            <span class="shortcut-badge">Esc per uscire</span>
          </div>

          <div class="results-list">
            ${results.length === 0
              ? html`<div class="no-results">Nessuna voce di menu trovata</div>`
              : results.map(
                  (item, idx) => html`
                    <div
                      class="result-item ${idx === this.selectedIndex ? 'selected' : ''}"
                      @click=${() => this.executeItem(item)}
                      @mouseenter=${() => (this.selectedIndex = idx)}
                    >
                      <span>${tEtichetta(item.label)}</span>
                      ${item.shortcut ? html`<span class="result-shortcut">${scorciatoia(item.shortcut)}</span>` : ""}
                    </div>
                  `
                )}
          </div>
        </div>
      </div>
    `;
  }
}
