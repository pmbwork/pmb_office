// Storia di annulla e ripeti per pmb_docs: funzioni pure su una struttura {passato, presente, futuro}.
import { documentiUguali, type Stato } from './documento';

export interface Storia { passato: Stato[]; presente: Stato; futuro: Stato[] }
export const LIMITE_STORIA = 200;

export function nuovaStoria(stato: Stato): Storia { return { passato: [], presente: stato, futuro: [] }; }

// Se il documento non cambia (solo selezione) il presente viene sostituito senza nuova voce.
// Con unisci = true una modifica si fonde nella voce corrente (digitazione continua).
export function registra(storia: Storia, stato: Stato, unisci = false): Storia {
  if (documentiUguali(stato.doc, storia.presente.doc)) return { ...storia, presente: stato };
  if (unisci && storia.passato.length > 0) return { passato: storia.passato, presente: stato, futuro: [] };
  const passato = [...storia.passato, storia.presente];
  while (passato.length > LIMITE_STORIA) passato.shift();
  return { passato, presente: stato, futuro: [] };
}

export function puoAnnullare(storia: Storia): boolean { return storia.passato.length > 0; }
export function puoRipetere(storia: Storia): boolean { return storia.futuro.length > 0; }

export function annulla(storia: Storia): Storia {
  if (storia.passato.length === 0) return storia;
  const precedente = storia.passato[storia.passato.length - 1];
  return {
    passato: storia.passato.slice(0, -1),
    presente: { ...precedente, pendenti: null },
    futuro: [storia.presente, ...storia.futuro],
  };
}

export function ripeti(storia: Storia): Storia {
  if (storia.futuro.length === 0) return storia;
  const [prossimo, ...resto] = storia.futuro;
  return { passato: [...storia.passato, storia.presente], presente: { ...prossimo, pendenti: null }, futuro: resto };
}
