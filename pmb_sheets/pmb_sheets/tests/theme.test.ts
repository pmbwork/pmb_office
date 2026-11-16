import { describe, it, expect, beforeEach } from "vitest";

describe("Gestione Temi (theme)", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
  });

  function applyTheme(theme: "light" | "dark" | "system", systemPrefersDark = false): string {
    let activeTheme = theme;
    if (theme === "system") {
      activeTheme = systemPrefersDark ? "dark" : "light";
    }
    mockStorage["theme"] = theme;
    return activeTheme;
  }

  it("applica correttamente il tema chiaro", () => {
    const active = applyTheme("light");
    expect(active).toBe("light");
    expect(mockStorage["theme"]).toBe("light");
  });

  it("applica correttamente il tema scuro", () => {
    const active = applyTheme("dark");
    expect(active).toBe("dark");
    expect(mockStorage["theme"]).toBe("dark");
  });

  it("rispetta il tema di sistema quando impostato su 'system'", () => {
    const activeWhenSystemLight = applyTheme("system", false);
    expect(activeWhenSystemLight).toBe("light");

    const activeWhenSystemDark = applyTheme("system", true);
    expect(activeWhenSystemDark).toBe("dark");
  });
});
