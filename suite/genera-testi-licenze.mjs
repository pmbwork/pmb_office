// Prepara i due testi che l'installer della suite mostra prima di installare, da accettare con una casella:
//   1. la licenza di pmb_office (GPL-3.0, il file LICENSE del repository);
//   2. i componenti di terze parti che entrano nei programmi e i testi delle loro licenze (gli stessi della finestra «Informazioni»
//      dei due programmi, file generati da comune/scripts/genera-licenze.mjs).
// I file escono in UTF-16 con BOM: è la codifica che la pagina della licenza di NSIS legge sempre bene. Con --utf8 escono in UTF-8 e con
// i normali a capo (per l'installatore del Mac, che mostra un solo testo: mac/crea-suite-mac.sh li mette uno dopo l'altro).
// Uso: node suite/genera-testi-licenze.mjs <cartella-di-uscita> [--utf8]   (lo lanciano crea-suite.ps1 e mac/crea-suite-mac.sh)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
const radice = path.resolve(qui, '..');
const argomenti = process.argv.slice(2);
const utf8 = argomenti.includes('--utf8');
const [uscita] = argomenti.filter((a) => a !== '--utf8');
if (!uscita) { console.error('uso: node genera-testi-licenze.mjs <cartella-di-uscita>'); process.exit(1); }
fs.mkdirSync(uscita, { recursive: true });

/** Il valore JSON di `export const NOME ... = <json>;` in un file licenze-terze.ts. */
function costante(testo, nome) {
  const riga = testo.split(/\r?\n/).find((r) => r.startsWith(`export const ${nome}`));
  if (!riga) throw new Error(`manca ${nome}`);
  return JSON.parse(riga.slice(riga.indexOf('= ') + 2).replace(/;\s*$/, ''));
}

const FILE_PROGRAMMI = [
  ['pmb_docs', path.join(radice, 'pmb_docs', 'src', 'guscio', 'licenze-terze.ts')],
  ['pmb_sheets', path.join(radice, 'pmb_sheets', 'pmb_sheets', 'src', 'components', 'licenze-terze.ts')],
];
const componenti = new Map(); // "nome versione" -> { voce, programmi }
const testi = {};
for (const [programma, file] of FILE_PROGRAMMI) {
  const t = fs.readFileSync(file, 'utf8');
  for (const c of costante(t, 'COMPONENTI_TERZI')) {
    const chiave = `${c[0]} ${c[1]}`;
    const v = componenti.get(chiave) ?? { voce: c, programmi: [] };
    v.programmi.push(programma);
    componenti.set(chiave, v);
  }
  Object.assign(testi, costante(t, 'TESTI_LICENZE'));
}

const scrivi = (nome, testo) => {
  if (utf8) { fs.writeFileSync(path.join(uscita, nome), testo.replace(/\r\n/g, '\n'), 'utf8'); return; }
  const corpo = testo.replace(/\r?\n/g, '\r\n');
  const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(corpo, 'utf16le')]);
  fs.writeFileSync(path.join(uscita, nome), buf);
};

// 1. licenza del programma
// nel repository la licenza è nella radice, nel vault in repo-github/
const fileLicenza = [path.join(radice, 'LICENSE'), path.join(radice, 'repo-github', 'LICENSE')].find((f) => fs.existsSync(f));
if (!fileLicenza) throw new Error('manca il file LICENSE');
const gpl = fs.readFileSync(fileLicenza, 'utf8');
scrivi('licenza-pmb_office.txt', [
  'pmb_office (pmb_docs, pmb_sheets) - © PMB',
  '',
  'IT - pmb_office è software libero: puoi usarlo, copiarlo, modificarlo e ridistribuirlo secondo i termini della GNU General Public License, versione 3 (GPL-3.0), riportata qui sotto nel testo ufficiale in inglese. Il programma è distribuito SENZA ALCUNA GARANZIA, come indicato nelle sezioni 15 e 16 della licenza.',
  '',
  'EN - pmb_office is free software: you can use, copy, modify and redistribute it under the terms of the GNU General Public License, version 3 (GPL-3.0), whose official text follows. The program is distributed WITHOUT ANY WARRANTY, as stated in sections 15 and 16 of the license.',
  '',
  '----------------------------------------------------------------------',
  '',
  gpl.trim(),
  '',
].join('\n'));

// 2. componenti di terze parti
const elenco = [...componenti.values()].sort((a, b) => a.voce[0].localeCompare(b.voce[0]) || a.voce[1].localeCompare(b.voce[1]));
const righe = [
  'IT - I programmi pmb_office contengono componenti di terze parti, ognuno con la sua licenza. Qui sotto ci sono l\'elenco dei componenti (nome, versione, licenza, titolare, programmi in cui entra) e i testi completi delle licenze.',
  'EN - The pmb_office programs contain third-party components, each under its own license. Below are the list of components (name, version, license, copyright holder, programs that include it) and the full license texts.',
  '',
  `${elenco.length} componenti / components`,
  '',
];
for (const { voce: [nome, versione, licenza, titolare], programmi } of elenco) {
  righe.push(`${nome} ${versione}  -  ${licenza}  -  ${programmi.join(', ')}`, `    ${titolare}`);
}
righe.push('');
for (const sigla of Object.keys(testi).sort()) {
  righe.push('======================================================================', sigla, '======================================================================', '', testi[sigla].trim(), '');
}
scrivi('licenze-terze-parti.txt', righe.join('\n'));
console.log(`testi delle licenze in ${uscita}: ${elenco.length} componenti, ${Object.keys(testi).length} licenze`);
