// Link (collegamenti) sulle celle di pmb_sheets. L'indirizzo sta nello stile della cella (CellStyle.link), quindi segue la cella
// quando si copia, si incolla, si inseriscono righe o si copiano i fogli, e si salva insieme agli altri stili.
// Modulo puro (niente DOM). Si ammettono solo http, https e mailto: le stesse regole del comando `open_url` della shell.

export const LUNGHEZZA_MASSIMA_LINK = 2000;

/** Colore e sottolineatura con cui si vede una cella con un link (come in Excel). */
export const COLORE_LINK = '#0563c1';

const SCHEMA = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL = /^[^\s@/:?#]+@[^\s@/:?#]+\.[^\s@/:?#]+$/;
const DOMINIO = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:[/?#]\S*)?$/i;

/** Dall'indirizzo scritto da una persona a quello da salvare. `null` se non è un indirizzo ammesso.
 *  - "esempio.it" diventa "https://esempio.it"; "mario@esempio.it" diventa "mailto:mario@esempio.it".
 *  - Si rifiutano altri schemi (javascript:, file:, ...), spazi e caratteri di controllo. */
export function normalizzaLink(testo: string): string | null {
  const t = testo.trim();
  if (t === '' || t.length > LUNGHEZZA_MASSIMA_LINK) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(t)) return null;
  let url: string;
  if (SCHEMA.test(t)) {
    if (!/^(https?:\/\/|mailto:)/i.test(t)) return null;
    url = t;
  } else if (EMAIL.test(t)) {
    url = `mailto:${t}`;
  } else if (DOMINIO.test(t)) {
    url = `https://${t}`;
  } else {
    return null;
  }
  return urlAmmesso(url) ? url : null;
}

/** Controlla un indirizzo già completo con le stesse regole della shell (host non vuoto per http/https, un indirizzo di posta per mailto). */
export function urlAmmesso(url: string): boolean {
  if (url.length > LUNGHEZZA_MASSIMA_LINK) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(url) || url.includes('\\')) return false;
  const minuscolo = url.toLowerCase();
  if (minuscolo.startsWith('mailto:')) {
    const resto = url.slice(7);
    const fine = resto.search(/[/?#]/);
    const indirizzo = fine === -1 ? resto : resto.slice(0, fine);
    return indirizzo.includes('@') && !indirizzo.startsWith('@') && !indirizzo.endsWith('@');
  }
  const resto = minuscolo.startsWith('https://') ? url.slice(8) : minuscolo.startsWith('http://') ? url.slice(7) : null;
  if (resto === null) return false;
  const fine = resto.search(/[/?#]/);
  const host = fine === -1 ? resto : resto.slice(0, fine);
  return host !== '' && !host.startsWith('.') && !host.includes('@');
}
