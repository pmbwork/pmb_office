// Il carattere base della cartella (quello delle celle senza un carattere proprio): Excel lo scrive come primo carattere di styles.xml
// (Calibri 11, Aptos 11...). pmb_sheets da sé scrive Arial 10 e disegna con il carattere dell'interfaccia; un file con un altro
// carattere base lo tiene, lo usa per disegnare tutte le celle senza carattere proprio e lo riscrive. Modulo puro.
export interface CarattereBase { nome: string; dimensione: number }

/** Quello che pmb_sheets scrive da sé: un file con questo carattere base non ne tiene uno. */
export const CARATTERE_BASE_PMB: CarattereBase = { nome: 'Arial', dimensione: 10 };

export function carattereBaseValido(x: unknown): CarattereBase | undefined {
  const c = x as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || typeof c.nome !== 'string' || typeof c.dimensione !== 'number') return undefined;
  const nome = c.nome.trim();
  if (nome === '' || nome.length > 100 || /[\x00-\x1f"';{}<>\\]/.test(nome) || !(c.dimensione >= 1 && c.dimensione <= 409)) return undefined;
  if (nome.toLowerCase() === CARATTERE_BASE_PMB.nome.toLowerCase() && c.dimensione === CARATTERE_BASE_PMB.dimensione) return undefined;
  return { nome, dimensione: c.dimensione };
}
