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

// ---- link a file e cartelle del computer (dal 0.2.16: nei file di Excel, per esempio «MODULI\1 Scheda SOCIETA'.docx» accanto al foglio)
// Si conservano come «file:» + percorso con le barre «/»: relativo alla cartella del file aperto, oppure assoluto su un disco («C:/...»).
// Sicurezza: niente percorsi di rete (\server\... : su Windows aprirli può mandare le credenziali dell'utente a quel computer), niente
// programmi né script (estensioni sotto); il percorso vero si controlla di nuovo nella parte nativa prima di aprire, dopo una conferma.

/** Estensioni che non si aprono mai da un link: programmi, script, collegamenti e installatori. */
export const ESTENSIONI_VIETATE = new Set([
  'exe', 'com', 'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'msi', 'msp', 'mst', 'scr', 'pif', 'lnk', 'url',
  'reg', 'hta', 'cpl', 'jar', 'dll', 'sys', 'inf', 'scf', 'application', 'appref-ms', 'gadget', 'msc', 'chm', 'library-ms', 'settingcontent-ms',
  'app', 'command', 'sh', 'bash', 'zsh', 'csh', 'py', 'pyw', 'pl', 'rb', 'php', 'workflow', 'terminal', 'pkg', 'dmg', 'appimage', 'deb', 'rpm',
  'xlsm', 'xltm', 'xlam', 'docm', 'dotm', 'pptm', 'potm', 'ppam', 'xla', 'xll',
]);

/** Vero se l'estensione del percorso è tra quelle che non si aprono. */
export function estensioneVietata(percorso: string): boolean {
  const nome = percorso.split(/[\\/]/).pop() ?? '';
  const i = nome.lastIndexOf('.');
  return i > 0 && ESTENSIONI_VIETATE.has(nome.slice(i + 1).toLowerCase().replace(/[\s.]+$/, ''));
}

/** Controlla un link locale già nella forma «file:percorso». */
export function linkLocaleAmmesso(url: string): boolean {
  if (!url.toLowerCase().startsWith('file:') || url.length > LUNGHEZZA_MASSIMA_LINK) return false;
  const p = url.slice(5);
  // eslint-disable-next-line no-control-regex
  if (p === '' || /[\u0000-\u001f\u007f<>"|?*]/.test(p) || p.includes('\\')) return false;
  if (p.startsWith('//')) return false;                       // percorso di rete
  if (/^[a-z]:(?!\/)/i.test(p)) return false;                 // «C:cartella» (relativo al disco): ambiguo
  if (/^[a-z]:\//i.test(p) && p.slice(3).includes(':')) return false;
  if (!/^[a-z]:\//i.test(p) && p.includes(':')) return false;  // altri schemi o flussi NTFS (a.txt:flusso)
  return !estensioneVietata(p);
}

/** Dal riferimento scritto in un file di Excel (Target della relazione) al link locale da conservare; `null` se non è un file locale ammesso. */
export function linkLocaleDaExcel(target: string): string | null {
  let t = target.trim();
  if (t === '' || /^(https?|mailto|ftp|javascript|data|vbscript):/i.test(t)) return null;
  if (/^file:/i.test(t)) {
    t = t.replace(/^file:/i, '');
    if (/^\/\/\/[a-z]:/i.test(t)) t = t.slice(3);              // file:///C:/...
    else if (t.startsWith('//')) return null;                  // file://server/...
  }
  try { t = decodeURIComponent(t); } catch { return null; }
  t = t.replace(/\\/g, '/');
  const url = `file:${t}`;
  return linkLocaleAmmesso(url) ? url : null;
}

/** Il riferimento da scrivere in un file di Excel per un link locale (stesso stile di Excel: barre rovesciate, spazi come %20). */
export function targetExcelDiLinkLocale(url: string): string {
  return url.slice(5).replace(/\//g, '\\').replace(/ /g, '%20');
}
