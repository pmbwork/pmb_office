import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { icons } from "../assets/icons/index";

export interface DocumentTab {
  id: string;
  title: string;
  /** colore della scheda ("#rrggbb"): una barra colorata sotto il nome */
  colore?: string;
}

@customElement("free-tabs")
export class FreeTabs extends LinguaElement {
  @property({ type: Array }) tabs: DocumentTab[] = [];
  @property({ type: String }) activeTabId = "";

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      height: var(--tabbar-height);
      background-color: var(--color-titlebar-bg);
      border-bottom: 1px solid var(--color-border);
      padding: 0 var(--space-2);
      user-select: none;
      box-sizing: border-box;
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
    }

    .tabs-list {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 100%;
      overflow-x: auto;
    }

    .tab-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      height: 30px;
      background-color: var(--color-surface-hover);
      border: 1px solid var(--color-border-subtle);
      border-bottom: none;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: background-color var(--transition-fast), color var(--transition-fast);
      box-sizing: border-box;
    }

    .tab-item:hover {
      background-color: var(--color-surface-active);
      color: var(--color-text);
    }

    .tab-item.active {
      background-color: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-accent);
      font-weight: 500;
      border-top: 2px solid var(--color-accent);
    }

    .tab-icon {
      display: flex;
      align-items: center;
    }

    .tab-close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: transparent;
      border: none;
      border-radius: var(--radius-full);
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 0;
      margin-left: 4px;
    }

    .tab-close-btn:hover {
      background-color: var(--color-border);
      color: var(--color-text);
    }

    .new-tab-container {
      position: relative;
      margin-left: var(--space-2);
    }

    .new-tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .new-tab-btn:hover {
      background-color: var(--color-surface-hover);
      border-color: var(--color-border-subtle);
    }

  ` as any;

  private selectTab(id: string) {
    this.dispatchEvent(new CustomEvent("tab-selected", { detail: { id }, bubbles: true, composed: true }));
  }

  private closeTab(e: MouseEvent, id: string) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("tab-closed", { detail: { id }, bubbles: true, composed: true }));
  }

  private renameTab(id: string) {
    this.dispatchEvent(new CustomEvent("tab-rename", { detail: { id }, bubbles: true, composed: true }));
  }

  private menuTab(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("tab-menu", { detail: { id, evento: e }, bubbles: true, composed: true }));
  }

  private trascinaDa = "";

  private dragStart(e: DragEvent, id: string) {
    this.trascinaDa = id;
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  private drop(e: DragEvent, id: string) {
    e.preventDefault();
    const da = this.tabs.findIndex((t) => t.id === this.trascinaDa);
    const a = this.tabs.findIndex((t) => t.id === id);
    this.trascinaDa = "";
    if (da < 0 || a < 0 || da === a) return;
    this.dispatchEvent(new CustomEvent("tab-moved", { detail: { da, a }, bubbles: true, composed: true }));
  }

  // Il colore della scheda va con styleMap e non con un attributo style scritto come testo: il CSP di Tauri blocca gli stili scritti come attributo.
  private createNew() {
    this.dispatchEvent(new CustomEvent("tab-created", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="tabs-list">
        ${this.tabs.map((tab) => {
          const isActive = tab.id === this.activeTabId;

          return html`
            <div
              class="tab-item ${isActive ? 'active' : ''}"
              draggable="true"
              @click=${() => this.selectTab(tab.id)}
              @dblclick=${() => this.renameTab(tab.id)}
              @contextmenu=${(e: MouseEvent) => this.menuTab(e, tab.id)}
              @dragstart=${(e: DragEvent) => this.dragStart(e, tab.id)}
              @dragover=${(e: DragEvent) => e.preventDefault()}
              @drop=${(e: DragEvent) => this.drop(e, tab.id)}
              title="${tab.title}"
              style=${styleMap(tab.colore ? { borderBottom: `3px solid ${tab.colore}` } : {})}
            >
              <span class="tab-icon" .innerHTML=${icons.sheet}></span>
              <span>${tab.title}</span>
              ${this.tabs.length > 1
                ? html`
                    <button
                      class="tab-close-btn"
                      title="Elimina foglio"
                      @click=${(e: MouseEvent) => this.closeTab(e, tab.id)}
                      .innerHTML=${icons.close}
                    ></button>
                  `
                : ""}
            </div>
          `;
        })}
      </div>

      <div class="new-tab-container">
        <button
          class="new-tab-btn"
          title="Aggiungi foglio"
          @click=${() => this.createNew()}
          .innerHTML=${icons.add}
        ></button>

      </div>
    `;
  }
}
