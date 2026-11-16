// Logica pura della finestra "Intervalli denominati": controlla quello che si scrive e prepara i dati per il motore.
import { isValidNamedRangeName, type NamedRange, type NamedRangeRegistry } from './named-ranges';
import { leggiIntervallo, scriviIntervallo, type Esito } from './regole-dialogo';
import { t } from '../i18n/lingua';

export interface DatiNome {
  nome: string;
  /** l'intervallo scritto dall'utente, per esempio "A1:B10" o "D1" */
  intervallo: string;
  /** il foglio a cui appartiene l'intervallo */
  foglio: string;
  /** i nomi già in uso, per non averne due uguali (maiuscole e minuscole non contano) */
  esistenti: string[];
}

/** Controlla nome e intervallo e, se vanno bene, crea l'intervallo denominato. */
export function creaNomeIntervallo(d: DatiNome): Esito<NamedRange> {
  const nome = d.nome.trim();
  if (nome === '') return { ok: false, errore: t("Scrivi un nome.") };
  if (!isValidNamedRangeName(nome)) {
    return { ok: false, errore: t("Il nome non è valido: usa lettere, numeri e trattino basso, senza spazi, e non può somigliare a una cella come A1.") };
  }
  if (d.esistenti.some((e) => e.toUpperCase() === nome.toUpperCase())) {
    return { ok: false, errore: t("Esiste già un intervallo con questo nome.") };
  }
  const i = leggiIntervallo(d.intervallo);
  if (!i) return { ok: false, errore: t("Scrivi l'intervallo come A1:B10, oppure una cella sola come D1.") };
  return {
    ok: true,
    valore: {
      name: nome,
      sheetName: d.foglio,
      rangeString: scriviIntervallo(i),
      startRow: i.startRow,
      startCol: i.startCol,
      endRow: i.endRow,
      endCol: i.endCol,
    },
  };
}

/** Il riferimento completo che il motore capisce: "Foglio1!A1:B10", con gli apici se il nome del foglio ha spazi o simboli. */
export function riferimentoNome(n: NamedRange): string {
  if (n.rangeString.includes('!')) return n.rangeString;
  const foglio = /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.sheetName) ? n.sheetName : `'${n.sheetName.replace(/'/g, "''")}'`;
  return `${foglio}!${n.rangeString}`;
}

/** L'elenco dei nomi nella forma che il motore si aspetta. */
export function nomiPerMotore(registro: NamedRangeRegistry): Array<{ name: string; ref: string }> {
  return registro.getAll().map((n) => ({ name: n.name, ref: riferimentoNome(n) }));
}
