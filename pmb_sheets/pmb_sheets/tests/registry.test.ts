import { describe, it, expect } from "vitest";
import { menuRegistry, getAllExecutableMenuItems } from "../src/registry/menu";
import { getToolbarFogli, sheetToolbar } from "../src/registry/toolbars";

describe("Registro dei Menu (menu.ts)", () => {
  it("contiene tutte le categorie obbligatorie", () => {
    const categoryIds = menuRegistry.map((c) => c.id);
    expect(categoryIds).toContain("file");
    expect(categoryIds).toContain("edit");
    expect(categoryIds).toContain("view");
    expect(categoryIds).toContain("insert");
    expect(categoryIds).toContain("format");
    expect(categoryIds).toContain("data");
    expect(categoryIds).toContain("tools");
    expect(categoryIds).toContain("help");
  });

  it("la categoria 'Dati' è presente nel menu di Fogli", () => {
    const dataCategory = menuRegistry.find((c) => c.id === "data");
    expect(dataCategory).toBeDefined();

    const items = getAllExecutableMenuItems();
    const dataItems = items.filter((i) => i.label.startsWith("Dati"));
    expect(dataItems.length).toBeGreaterThan(0);
  });

  it("nel menu non c'è nessuna voce da elaboratore di testi (Nuovo documento, interruzione di pagina, conteggio parole)", () => {
    const azioni = getAllExecutableMenuItems().map((i) => i.action);
    expect(azioni).not.toContain("new-document");
    expect(azioni).not.toContain("insert-page-break");
    expect(azioni).not.toContain("word-count");
  });

  it("ogni categoria ha un mnemonico valido per la tastiera Alt", () => {
    for (const cat of menuRegistry) {
      expect(cat.mnemonic).toBeDefined();
      expect(cat.mnemonic.length).toBe(1);
      expect(cat.label.toUpperCase()).toContain(cat.mnemonic.toUpperCase());
    }
  });

  it("estrazione piatta per ricerca menu (Alt+/) restituisce voci con etichetta e azione", () => {
    const items = getAllExecutableMenuItems();
    expect(items.length).toBeGreaterThan(15);
    for (const item of items) {
      expect(item.action).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.separator).toBeFalsy();
    }
  });
});

describe("Registro Barre degli Strumenti (toolbars.ts)", () => {
  it("c'è una sola barra, quella dei fogli di lavoro", () => {
    const sheetTb = getToolbarFogli();
    expect(sheetTb).toEqual(sheetToolbar);

    // Fogli: opzioni di formattazione celle, niente stili di paragrafo né elenchi
    const sheetGroupIds = sheetTb.map((g) => g.id);
    expect(sheetGroupIds).toContain("sheet-formats");
    expect(sheetGroupIds).toContain("cell-operations");
    expect(sheetGroupIds).not.toContain("lists");
  });
});
