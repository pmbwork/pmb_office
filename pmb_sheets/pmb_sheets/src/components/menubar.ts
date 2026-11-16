import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { tVoce, scorciatoia, linguaCorrente } from '../i18n/lingua';

/** Lettere di accesso con Alt dei menu in inglese, per nome italiano del menu. */
const MNEMONICI_EN: Record<string, string> = { 'File': 'F', 'Modifica': 'E', 'Visualizza': 'V', 'Inserisci': 'I', 'Formato': 'O', 'Dati': 'D', 'Strumenti': 'T', 'Aiuto': 'H', 'Informazioni': 'A' };
import { customElement, state } from "lit/decorators.js";
import { menuRegistry, MenuCategory, MenuItem } from "../registry/menu";

@customElement("free-menubar")
export class FreeMenubar extends LinguaElement {
  @state() private activeMenuIndex: number | null = null;
  @state() private activeItemIndex: number = 0;
  @state() private isAltPressed = false;
  /** l'id della voce il cui sottomenu è aperto, se ce n'è uno */
  @state() private openSub: string | null = null;
  @state() private activeSubIndex: number = 0;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      height: var(--menubar-height);
      background-color: var(--color-menubar-bg);
      border-bottom: 1px solid var(--color-border-subtle);
      user-select: none;
      padding: 0 var(--space-2);
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      position: relative;
      box-sizing: border-box;
    }

    .menu-bar-container {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 100%;
    }

    .menu-btn {
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: var(--color-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: background-color var(--transition-fast);
      position: relative;
    }

    .menu-btn:hover,
    .menu-btn.active {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }

    .menu-btn:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: -1px;
    }

    /* il bottone «Segnalazione bug» dopo i menu: un'azione diretta, non un menu (non è un .menu-btn, così la navigazione tra i menu non cambia) */
    .bottone-segnala {
      margin-left: 6px;
      white-space: nowrap;
      flex: none;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid #22c55e;
      border-radius: var(--radius-sm);
      padding: 3px 10px;
      font-family: var(--font-family-base);
      font-size: var(--font-size-base);
      color: #22c55e;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background-color var(--transition-fast), border-color var(--transition-fast);
    }
    .bottone-segnala:hover {
      background-color: rgba(34, 197, 94, 0.22);
      border-color: #16a34a;
    }
    .bottone-segnala:focus-visible { outline: 2px solid #22c55e; outline-offset: 1px; }
    .bottone-segnala svg { width: 14px; height: 14px; display: block; }

    .mnemonic-underline {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    /* Dropdown menu popup */
    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      min-width: 220px;
      padding: 4px 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      font-size: var(--font-size-base);
      color: var(--color-text);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .dropdown-item:hover,
    .dropdown-item.focused {
      background-color: var(--color-surface-hover);
    }

    .dropdown-item.disabled {
      color: var(--color-text-disabled);
      cursor: not-allowed;
    }

    .dropdown-item.disabled:hover {
      background-color: transparent;
    }

    .shortcut {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      margin-left: var(--space-4);
    }

    .separator {
      height: 1px;
      background-color: var(--color-border-subtle);
      margin: 4px 0;
    }

    .menu-item-wrapper {
      position: relative;
    }

    .dropdown-item.has-sub {
      position: relative;
    }

    .chevron {
      margin-left: var(--space-4);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    /* sottomenu: si apre a destra della voce che lo contiene */
    .submenu {
      position: absolute;
      top: -5px;
      left: 100%;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      min-width: 180px;
      padding: 4px 0;
      z-index: 1001;
      display: flex;
      flex-direction: column;
    }
  ` as any;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    window.addEventListener("keyup", this.handleGlobalKeyUp);
    window.addEventListener("click", this.handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.handleGlobalKeyDown);
    window.removeEventListener("keyup", this.handleGlobalKeyUp);
    window.removeEventListener("click", this.handleOutsideClick);
  }

  private getVisibleMenus(): MenuCategory[] {
    return menuRegistry;
  }

  private handleOutsideClick = (e: MouseEvent) => {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (!path.includes(this) && !this.contains(e.target as Node)) {
      this.closeMenu();
    }
  };

  private handleGlobalKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Alt") {
      this.isAltPressed = false;
    }
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Alt") {
      this.isAltPressed = true;
    }

    // Mnemonics via Alt+Key (e.g. Alt+F for File, Alt+M for Modifica, Alt+D for Dati)
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      const key = e.key.toUpperCase();
      const visible = this.getVisibleMenus();
      const index = visible.findIndex((cat) => this.mnemonico(cat).toUpperCase() === key);
      if (index !== -1) {
        e.preventDefault();
        this.openMenu(index);
        return;
      }
    }

    if (this.activeMenuIndex !== null) {
      const visible = this.getVisibleMenus();
      const currentCat = visible[this.activeMenuIndex];
      const items = this.getVisibleItems(currentCat);

      if (this.openSub !== null) {
        const parent = items.find((it) => it.id === this.openSub);
        const subs = parent?.subitems ?? [];
        if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault();
          this.openSub = null;
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          this.activeSubIndex = this.nextIndex(subs, this.activeSubIndex, e.key === "ArrowDown" ? 1 : -1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const sub = subs[this.activeSubIndex];
          if (sub) this.executeItem(sub);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        const prevIdx = this.activeMenuIndex;
        this.closeMenu();
        if (prevIdx !== null) {
          const btns = this.renderRoot?.querySelectorAll<HTMLButtonElement>(".menu-btn");
          if (btns && btns[prevIdx]) {
            btns[prevIdx].focus();
          }
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const corrente = items[this.activeItemIndex];
        if (corrente?.subitems && !corrente.disabled) this.apriSottomenu(corrente);
        else this.openMenu((this.activeMenuIndex + 1) % visible.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.openMenu((this.activeMenuIndex - 1 + visible.length) % visible.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.focusNextItem(items, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.focusNextItem(items, -1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = items[this.activeItemIndex];
        if (selected && !selected.disabled && !selected.separator) {
          this.executeItem(selected);
        }
      }
    }
  };

  /** L'indice della prossima voce che si può scegliere (salta separatori e voci disattivate), partendo da "da". */
  private nextIndex(items: MenuItem[], da: number, direction: 1 | -1): number {
    let nextIdx = da;
    for (let count = 0; count < items.length; count++) {
      nextIdx = (nextIdx + direction + items.length) % items.length;
      const candidate = items[nextIdx];
      if (candidate && !candidate.disabled && !candidate.separator) return nextIdx;
    }
    return da;
  }

  private focusNextItem(items: MenuItem[], direction: 1 | -1) {
    if (items.length === 0) return;
    this.activeItemIndex = this.nextIndex(items, this.activeItemIndex, direction);
  }

  private apriSottomenu(item: MenuItem) {
    this.openSub = item.id;
    const primo = (item.subitems ?? []).findIndex((it) => !it.disabled && !it.separator);
    this.activeSubIndex = primo !== -1 ? primo : 0;
  }

  private openMenu(index: number) {
    this.activeMenuIndex = index;
    this.openSub = null;
    const visible = this.getVisibleMenus();
    const cat = visible[index];
    if (cat) {
      const items = this.getVisibleItems(cat);
      const firstValid = items.findIndex((it) => !it.disabled && !it.separator);
      this.activeItemIndex = firstValid !== -1 ? firstValid : 0;
    } else {
      this.activeItemIndex = 0;
    }
  }

  private closeMenu() {
    this.activeMenuIndex = null;
    this.activeItemIndex = 0;
    this.openSub = null;
  }

  private toggleMenu(index: number) {
    if (this.activeMenuIndex === index) {
      this.closeMenu();
    } else {
      this.openMenu(index);
    }
  }

  private getVisibleItems(cat: MenuCategory): MenuItem[] {
    return cat.items;
  }

  private executeItem(item: MenuItem) {
    if (item.disabled || item.separator) return;
    if (item.subitems) {
      // il passaggio del mouse l'ha già aperto: il clic lo lascia aperto invece di richiuderlo
      if (this.openSub !== item.id) this.apriSottomenu(item);
      return;
    }
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent("menu-action", {
        detail: { action: item.action || item.id, label: item.label },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** La lettera per aprire il menu con Alt: in inglese quella del nome inglese (Alt+E per Edit), come nei programmi in inglese. */
  private mnemonico(cat: MenuCategory): string {
    return linguaCorrente() === 'en' ? (MNEMONICI_EN[cat.label] ?? cat.mnemonic) : cat.mnemonic;
  }

  renderMnemonicLabel(label: string, mnemonic: string) {
    const idx = label.toLowerCase().indexOf(mnemonic.toLowerCase());
    if (idx === -1) return label;
    const before = label.slice(0, idx);
    const m = label.slice(idx, idx + 1);
    const after = label.slice(idx + 1);
    return html`${before}<span class="${this.isAltPressed ? 'mnemonic-underline' : ''}">${m}</span>${after}`;
  }

  render() {
    const visibleMenus = this.getVisibleMenus();

    return html`
      <div class="menu-bar-container" role="menubar">
        ${visibleMenus.map((cat, index) => {
          const isActive = this.activeMenuIndex === index;
          const items = this.getVisibleItems(cat);

          return html`
            <div class="menu-item-wrapper">
              <button
                class="menu-btn ${isActive ? 'active' : ''}"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded="${isActive}"
                @click=${() => this.toggleMenu(index)}
                @mouseenter=${() => {
                  if (this.activeMenuIndex !== null) this.openMenu(index);
                }}
              >
                ${this.renderMnemonicLabel(tVoce(cat.label), this.mnemonico(cat))}
              </button>

              ${isActive
                ? html`
                    <div class="dropdown-menu" role="menu">
                      ${items.map((item, itemIdx) => {
                        if (item.separator) {
                          return html`<div class="separator" role="separator"></div>`;
                        }

                        const isFocused = this.activeItemIndex === itemIdx;
                        const conSotto = !!item.subitems;
                        const aperto = this.openSub === item.id;

                        return html`
                          <div
                            class="dropdown-item ${item.disabled ? 'disabled' : ''} ${isFocused ? 'focused' : ''} ${conSotto ? 'has-sub' : ''}"
                            role="menuitem"
                            aria-disabled="${!!item.disabled}"
                            aria-haspopup="${conSotto ? 'menu' : 'false'}"
                            aria-expanded="${conSotto ? String(aperto) : 'false'}"
                            @click=${() => this.executeItem(item)}
                            @mouseenter=${() => {
                              this.activeItemIndex = itemIdx;
                              if (conSotto && !item.disabled) this.apriSottomenu(item);
                              else this.openSub = null;
                            }}
                          >
                            <span>${tVoce(item.label)}</span>
                            ${conSotto ? html`<span class="chevron" aria-hidden="true">▸</span>` : item.shortcut ? html`<span class="shortcut">${scorciatoia(item.shortcut)}</span>` : ""}
                            ${aperto
                              ? html`<div class="submenu" role="menu">
                                  ${(item.subitems ?? []).map((sub, subIdx) =>
                                    sub.separator
                                      ? html`<div class="separator" role="separator"></div>`
                                      : html`<div
                                          class="dropdown-item sub-item ${sub.disabled ? 'disabled' : ''} ${this.activeSubIndex === subIdx ? 'focused' : ''}"
                                          role="menuitem"
                                          aria-disabled="${!!sub.disabled}"
                                          @click=${(ev: Event) => { ev.stopPropagation(); this.executeItem(sub); }}
                                          @mouseenter=${(ev: Event) => { ev.stopPropagation(); this.activeSubIndex = subIdx; }}
                                        >
                                          <span>${tVoce(sub.label)}</span>
                                          ${sub.shortcut ? html`<span class="shortcut">${scorciatoia(sub.shortcut)}</span>` : ""}
                                        </div>`
                                  )}
                                </div>`
                              : ""}
                          </div>
                        `;
                      })}
                    </div>
                  `
                : ""}
            </div>
          `;
        })}
        <button
          class="bottone-segnala"
          data-azione="segnala-bug"
          title="Segnala un bug o invia un feedback"
          @click=${() => this.segnalaBug()}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <ellipse cx="8" cy="9.5" rx="3.5" ry="4.5" />
            <path d="M8 5v9M4.5 9.5H1.5M14.5 9.5h-3M5 6.5 3 4.5M11 6.5l2-2M5 12.5 3 14M11 12.5l2 1.5M6.5 5.2 5.5 2.8M9.5 5.2l1-2.4" />
          </svg>
          Segnalazione bug
        </button>
      </div>
    `;
  }

  /** Il bottone «Segnalazione bug»: chiude un menu aperto e apre la finestra di segnalazione (la stessa di Informazioni > Segnala un bug o invia un feedback). */
  private segnalaBug() {
    this.closeMenu();
    this.dispatchEvent(new CustomEvent("menu-action", { detail: { action: "info-segnala", label: "Segnalazione bug" }, bubbles: true, composed: true }));
  }
}
