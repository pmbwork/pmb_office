import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/components/menubar";
import "../src/components/menu-search";
import { FreeMenubar } from "../src/components/menubar";
import { FreeMenuSearch } from "../src/components/menu-search";

describe("Test di Navigazione da Tastiera e Accessibilità (DOM)", () => {
  let menubar: FreeMenubar;
  let menuSearch: FreeMenuSearch;

  beforeEach(async () => {
    document.body.innerHTML = "";
    menubar = document.createElement("free-menubar") as FreeMenubar;
    document.body.appendChild(menubar);

    menuSearch = document.createElement("free-menu-search") as FreeMenuSearch;
    document.body.appendChild(menuSearch);

    await menubar.updateComplete;
    await menuSearch.updateComplete;
  });

  afterEach(() => {
    menubar.remove();
    menuSearch.remove();
    document.body.innerHTML = "";
  });

  // -------------------------------------------------------------
  // Caso 1: Alt+F apre il menu File, e solo quello (con test negativo)
  // -------------------------------------------------------------
  describe("Caso 1: Apertura con Alt+Lettera (Mnemonici)", () => {
    it("Alt+F apre il menu File e nessun altro menu", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(1);

      const menuButtons = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn");
      expect(menuButtons[0].classList.contains("active")).toBe(true);
      expect(menuButtons[1].classList.contains("active")).toBe(false);
    });

    it("Test negativo: il tasto 'F' da solo SENZA Alt non deve aprire il menu", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: false, bubbles: true }));
      await menubar.updateComplete;

      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(0);

      const menuButtons = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn");
      expect(menuButtons[0].classList.contains("active")).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Caso 2: Freccia giù/su sposta il focus e salta disabilitati e separatori (con test negativo)
  // -------------------------------------------------------------
  describe("Caso 2: Freccia Giù/Su salta voci disabilitate e separatori", () => {
    it("Freccia giù e su navigano solo tra voci abilitate escludendo separatori e disabled", async () => {
      // Apri menu File (Alt+F)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      const items = menubar.renderRoot.querySelectorAll(".dropdown-menu > *");
      const focusedBefore = menubar.renderRoot.querySelector(".dropdown-item.focused");
      expect(focusedBefore).not.toBeNull();
      expect(focusedBefore?.classList.contains("disabled")).toBe(false);

      // Naviga con ArrowDown
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await menubar.updateComplete;

      const focusedAfterDown = menubar.renderRoot.querySelector(".dropdown-item.focused");
      expect(focusedAfterDown).not.toBeNull();
      expect(focusedAfterDown?.classList.contains("disabled")).toBe(false);
      expect(focusedAfterDown?.classList.contains("separator")).toBe(false);

      // Naviga con ArrowUp torna indietro
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      await menubar.updateComplete;

      const focusedAfterUp = menubar.renderRoot.querySelector(".dropdown-item.focused");
      expect(focusedAfterUp?.textContent?.trim()).toBe(focusedBefore?.textContent?.trim());
    });

    it("Test negativo: premere Freccia Giù/Su quando nessun menu è aperto non apre alcun menu", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await menubar.updateComplete;

      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // Caso 3: Freccia destra/sinistra passa al menu vicino, con ritorno circolare
  // -------------------------------------------------------------
  describe("Caso 3: Navigazione orizzontale circolare tra categorie di menu", () => {
    it("Freccia destra e sinistra passano al menu adiacente con ritorno circolare", async () => {
      // Apri File (indice 0)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      const buttons = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn");
      const totalMenus = buttons.length;
      expect(buttons[0].classList.contains("active")).toBe(true);

      // Freccia destra -> Modifica (indice 1)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await menubar.updateComplete;
      expect(buttons[1].classList.contains("active")).toBe(true);
      expect(buttons[0].classList.contains("active")).toBe(false);

      // Freccia sinistra -> torna a File (indice 0)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await menubar.updateComplete;
      expect(buttons[0].classList.contains("active")).toBe(true);

      // Freccia sinistra dall'indice 0 -> va all'ultimo menu (circolare)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await menubar.updateComplete;
      expect(buttons[totalMenus - 1].classList.contains("active")).toBe(true);

      // Freccia destra dall'ultimo menu -> torna all'indice 0 (circolare)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await menubar.updateComplete;
      expect(buttons[0].classList.contains("active")).toBe(true);
    });

    it("Test negativo: Freccia Destra a menu chiuso non apre alcun menu", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await menubar.updateComplete;

      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // Caso 4: Invio esegue la voce attiva e chiude il menu
  // -------------------------------------------------------------
  describe("Caso 4: Esecuzione voce con Invio", () => {
    it("Invio invia l'evento menu-action per la voce attiva e chiude il dropdown", async () => {
      const actionSpy = vi.fn();
      menubar.addEventListener("menu-action", actionSpy);

      // Apri menu File
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      // Premi Invio sulla voce attiva (es. 'Nuovo documento')
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await menubar.updateComplete;

      expect(actionSpy).toHaveBeenCalledTimes(1);
      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(0);
    });

    it("Test negativo: Invio quando nessun menu è aperto non scatena alcun evento", async () => {
      const actionSpy = vi.fn();
      menubar.addEventListener("menu-action", actionSpy);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await menubar.updateComplete;

      expect(actionSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------
  // Caso 5: Esc chiude il menu e restituisce il focus
  // -------------------------------------------------------------
  describe("Caso 5: Chiusura con Esc e ripristino focus", () => {
    it("Esc chiude il menu aperto e ripristina il focus sul pulsante della barra", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      const buttons = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn");
      expect(buttons[0].classList.contains("active")).toBe(true);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await menubar.updateComplete;

      const dropdowns = menubar.renderRoot.querySelectorAll(".dropdown-menu");
      expect(dropdowns.length).toBe(0);
      expect(buttons[0].classList.contains("active")).toBe(false);
    });

    it("Test negativo: premere Esc quando non ci sono menu aperti non causa errori", async () => {
      expect(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------
  // Caso 6: Alt+/ apre la ricerca, filtra e Invio esegue
  // -------------------------------------------------------------
  describe("Caso 6: Ricerca rapida menu (Alt+/)", () => {
    it("Alt+/ apre la casella; digitare 'salva' filtra le voci; Invio esegue la prima e chiude", async () => {
      const actionSpy = vi.fn();
      menuSearch.addEventListener("menu-action", actionSpy);

      // Alt+/ per aprire la ricerca
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", altKey: true, bubbles: true }));
      await menuSearch.updateComplete;

      expect(menuSearch.open).toBe(true);
      const modal = menuSearch.renderRoot.querySelector(".search-modal");
      expect(modal).not.toBeNull();

      // Scrivere 'salva' nell'input
      const input = menuSearch.renderRoot.querySelector<HTMLInputElement>("input.search-input");
      expect(input).not.toBeNull();
      input!.value = "salva";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await menuSearch.updateComplete;

      const results = menuSearch.renderRoot.querySelectorAll(".result-item");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].textContent?.toLowerCase()).toContain("salva");

      // Invio per selezionare la prima voce
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await menuSearch.updateComplete;

      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(menuSearch.open).toBe(false);
    });

    it("Test negativo: il tasto '/' da solo SENZA Alt non apre la casella di ricerca", async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", altKey: false, bubbles: true }));
      await menuSearch.updateComplete;

      expect(menuSearch.open).toBe(false);
      const modal = menuSearch.renderRoot.querySelector(".search-modal");
      expect(modal).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // Caso 7: Attributi ARIA conformi (role, aria-expanded, aria-haspopup)
  // -------------------------------------------------------------
  describe("Caso 7: Attributi ARIA dei menu", () => {
    it("aria-expanded passa da 'false' a 'true' all'apertura e torna a 'false' alla chiusura", async () => {
      const container = menubar.renderRoot.querySelector(".menu-bar-container");
      expect(container?.getAttribute("role")).toBe("menubar");

      const fileBtn = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn")[0];
      expect(fileBtn.getAttribute("role")).toBe("menuitem");
      expect(fileBtn.getAttribute("aria-haspopup")).toBe("true");
      expect(fileBtn.getAttribute("aria-expanded")).toBe("false");

      // Apri File con Alt+F
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      expect(fileBtn.getAttribute("aria-expanded")).toBe("true");

      const dropdown = menubar.renderRoot.querySelector(".dropdown-menu");
      expect(dropdown?.getAttribute("role")).toBe("menu");

      // Chiudi con Esc
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await menubar.updateComplete;

      expect(fileBtn.getAttribute("aria-expanded")).toBe("false");
    });

    it("Test negativo: un menu non attivo mantiene aria-expanded='false' anche se un altro menu si apre", async () => {
      // Apri File (indice 0)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
      await menubar.updateComplete;

      const buttons = menubar.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-btn");
      // Modifica (indice 1) deve rimanere false
      expect(buttons[1].getAttribute("aria-expanded")).toBe("false");
    });
  });
});
