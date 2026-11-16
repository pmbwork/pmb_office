// Migrazione dei dati salvati in locale quando il programma si chiamava free_sheets: preferenze, dizionario, copia di emergenza e versioni
// si trovavano sotto chiavi "free_sheets.*"; ora sono "pmb_sheets.*". Le copie vecchie si spostano (una volta sola) e non si perde niente.

/** Sposta ogni chiave che comincia con `vecchio` in una che comincia con `nuovo`, senza sovrascrivere una chiave nuova già presente. */
export function migraChiavi(deposito: Storage | null, vecchio: string, nuovo: string): number {
  if (!deposito) return 0;
  let spostate = 0;
  try {
    const chiavi: string[] = [];
    for (let i = 0; i < deposito.length; i++) { const k = deposito.key(i); if (k !== null && k.startsWith(vecchio)) chiavi.push(k); }
    for (const k of chiavi) {
      const nuova = nuovo + k.slice(vecchio.length);
      const valore = deposito.getItem(k);
      if (valore !== null && deposito.getItem(nuova) === null) { deposito.setItem(nuova, valore); spostate++; }
      deposito.removeItem(k);
    }
  } catch { /* deposito pieno o non accessibile: si riprova al prossimo avvio */ }
  return spostate;
}
