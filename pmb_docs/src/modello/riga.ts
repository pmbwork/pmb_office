// Altezza naturale della riga dei caratteri: in Word l'interlinea «multipla» (1, 1,15, 1,5, 2...) moltiplica l'altezza naturale della
// riga del carattere (ascendente, discendente e spazio tra le righe che il carattere stesso dichiara), non il suo corpo: Calibri a
// 11 punti con interlinea 1,15 fa righe di 11 × 1,221 × 1,15 punti. Nella pagina si misura il carattere vero (editor/render.ts);
// questa tabella (misurata sui caratteri di Windows, 2026-11-25) serve dove non si può misurare (PDF, prove automatiche). Modulo puro.
import { CARATTERE_NORMALE } from './documento';

const RIGA_NATURALE: Record<string, number> = {
  calibri: 1.221, 'calibri light': 1.221, cambria: 1.172, arial: 1.15, helvetica: 1.15, 'times new roman': 1.149, verdana: 1.215,
  georgia: 1.136, 'segoe ui': 1.33, tahoma: 1.207, 'courier new': 1.133, aptos: 1.171, 'aptos display': 1.171, 'trebuchet ms': 1.161,
  garamond: 1.125, 'century gothic': 1.226, 'book antiqua': 1.242, 'arial narrow': 1.147, consolas: 1.171, candara: 1.221,
  constantia: 1.221, corbel: 1.221, 'franklin gothic book': 1.134, 'palatino linotype': 1.349, 'comic sans ms': 1.394, roboto: 1.2,
};

/** L'altezza naturale della riga del carattere, in corpi (Arial e i caratteri sconosciuti: 1,15). */
export function rigaNaturale(carattere: string = CARATTERE_NORMALE): number {
  return RIGA_NATURALE[carattere.trim().toLowerCase()] ?? 1.15;
}
