import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Persistenza Impostazioni e Portabilità", () => {
  const testDataDir = path.resolve(__dirname, "../temp-test-data");
  const settingsFile = path.join(testDataDir, "impostazioni.json");
  const recentFile = path.join(testDataDir, "recenti.json");

  function saveSettings(settings: { theme: string; windowWidth: number; windowHeight: number }) {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), "utf-8");
  }

  function readSettings() {
    if (!fs.existsSync(settingsFile)) {
      return { theme: "system", windowWidth: 1200, windowHeight: 800 };
    }
    const content = fs.readFileSync(settingsFile, "utf-8");
    return JSON.parse(content);
  }

  it("salva e rilegge correttamente le impostazioni in formato JSON", () => {
    const original = { theme: "dark", windowWidth: 1400, windowHeight: 900 };
    saveSettings(original);

    const loaded = readSettings();
    expect(loaded).toEqual(original);
  });

  it("restituisce valori predefiniti se impostazioni.json non esiste", () => {
    if (fs.existsSync(settingsFile)) {
      fs.unlinkSync(settingsFile);
    }
    const defaults = readSettings();
    expect(defaults.theme).toBe("system");
    expect(defaults.windowWidth).toBe(1200);
    expect(defaults.windowHeight).toBe(800);
  });

  it("supporta recenti.json come array di stringhe vuoto o popolato", () => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    fs.writeFileSync(recentFile, JSON.stringify([], null, 2), "utf-8");
    const recents = JSON.parse(fs.readFileSync(recentFile, "utf-8"));
    expect(Array.isArray(recents)).toBe(true);
    expect(recents.length).toBe(0);

    // Cleanup
    if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
    if (fs.existsSync(recentFile)) fs.unlinkSync(recentFile);
    if (fs.existsSync(testDataDir)) fs.rmdirSync(testDataDir);
  });
});
