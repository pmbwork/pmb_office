// Impostazioni comuni a tutti i test: il computer di prova si comporta come un Windows in italiano (altrimenti la lingua «automatica» sceglierebbe l'inglese
// e quasi tutti i test, che controllano i testi italiani, fallirebbero), e ogni test parte con l'interfaccia in italiano.
import { beforeEach } from 'vitest';
import { impostaLingua } from '../src/i18n/lingua';

if (typeof navigator !== 'undefined') {
  try { Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true }); } catch { /* niente */ }
}
// Da Node 25 Node ha un suo localStorage globale (Web Storage di Node), che prende il posto di quello di happy-dom: senza --localstorage-file
// localStorage.clear() falliva (PC Acer, Node 26: circa 180 test), con il file i test si scambiavano i dati attraverso il disco. Qui ogni file
// di test ha un localStorage e un sessionStorage in memoria, come nel browser, qualunque sia la versione di Node (2026-11-18).
class DepositoInMemoria {
  private dati = new Map<string, string>();
  get length(): number { return this.dati.size; }
  key(i: number): string | null { return [...this.dati.keys()][i] ?? null; }
  getItem(k: string): string | null { const v = this.dati.get(String(k)); return v === undefined ? null : v; }
  setItem(k: string, v: string): void { this.dati.set(String(k), String(v)); }
  removeItem(k: string): void { this.dati.delete(String(k)); }
  clear(): void { this.dati.clear(); }
}
for (const nome of ['localStorage', 'sessionStorage'] as const) {
  try { Object.defineProperty(globalThis, nome, { value: new DepositoInMemoria() as unknown as Storage, configurable: true, writable: true }); } catch { /* resta quello che c'è */ }
}
beforeEach(() => { impostaLingua('it'); });
