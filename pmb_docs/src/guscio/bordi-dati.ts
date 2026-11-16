// "Formato › Bordi e linee": le voci del sottomenu e che cosa cambiano nel bordo del paragrafo.
import { SPESSORI_BORDO, type Bordo } from '../modello/documento';

export interface VoceBordo { etichetta: string; /** null = togli il bordo */ parziale: Partial<Bordo> | null }

export const VOCI_BORDO: VoceBordo[] = [
  { etichetta: 'Aggiungi bordo al paragrafo', parziale: {} },
  ...SPESSORI_BORDO.map((w) => ({ etichetta: `Spessore ${String(w).replace('.', ',')} pt`, parziale: { w } })),
  { etichetta: 'Linea continua', parziale: { s: 'c' } },
  { etichetta: 'Linea tratteggiata', parziale: { s: 't' } },
  { etichetta: 'Linea puntinata', parziale: { s: 'p' } },
  { etichetta: 'Colore nero', parziale: { c: '#000000' } },
  { etichetta: 'Colore grigio', parziale: { c: '#808080' } },
  { etichetta: 'Colore rosso', parziale: { c: '#d93025' } },
  { etichetta: 'Colore blu', parziale: { c: '#1a73e8' } },
  { etichetta: 'Colore verde', parziale: { c: '#188038' } },
  { etichetta: 'Togli il bordo', parziale: null },
];
