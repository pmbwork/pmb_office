// Genera l'elenco dei componenti di terze parti e i testi delle loro licenze per la finestra "Informazioni" di un'app.
// Uso (da una cartella con Rust nel PATH):  node genera-licenze.mjs <cartella-app> <file-di-uscita.ts>
// Legge Cargo (cargo metadata, offline) e package-lock.json dell'app e prende i testi dai file di licenza dei pacchetti installati.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [appDir, uscita] = process.argv.slice(2);
if (!appDir || !uscita) { console.error('uso: node genera-licenze.mjs <cartella-app> <file-di-uscita.ts>'); process.exit(1); }

const componenti = []; // [nome, versione, licenza, copyright, origine]
const fileLicenza = []; // {nome, testo}
const RE_FILE = /^(licen[cs]e|copying|unlicense|notice)/i;
const RE_COPY = /^\s*(copyright\b.*|\(c\)\s.*|©.*)$/im;

function leggiLicenze(dir) {
  const out = [];
  try { for (const f of fs.readdirSync(dir)) if (RE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile()) { const t = fs.readFileSync(path.join(dir, f), 'utf8'); if (t.length < 80000) out.push(t); } } catch { /* cartella assente */ }
  return out;
}
function copyright(testi, autori) {
  // salta le frasi standard delle licenze ("copyright notice", "copyright owner", "[yyyy]"): non sono titolari veri
  const FRASE = /^copyright\s+(notice|owner|holder|license|statement|and\b|in\b|ownership)|\[(yyyy|name)|attached to the work|\byyyy\b/i;
  for (const t of testi) { for (const riga of t.split(/\r?\n/)) { const m = RE_COPY.exec(riga); if (m && !FRASE.test(m[1].trim())) return m[1].trim().replace(/\s+/g, ' ').slice(0, 170); } }
  return autori && autori.length ? ('Copyright ' + autori.join(', ')).slice(0, 170) : 'Gli autori del progetto (nessun avviso indicato nel pacchetto)';
}

// ---- Rust ----
// i programmi si distribuiscono per Windows e per Mac (Apple Silicon e Intel): l'elenco comprende i componenti di tutte e tre le piattaforme,
// così la stessa finestra delle licenze vale per ogni versione (sul Mac entrano componenti che su Windows non ci sono, e viceversa)
const PIATTAFORME = ['x86_64-pc-windows-msvc', 'aarch64-apple-darwin', 'x86_64-apple-darwin'];
const inGrafo = new Set();
const pacchetti = new Map(); // id -> pacchetto, da tutte le piattaforme (ognuna elenca solo i suoi)
let radice = '';
for (const piattaforma of PIATTAFORME) {
  // prima senza rete; se nella cache mancano i componenti di un'altra piattaforma (per esempio quelli solo Mac compilando su Windows)
  // si riprova con la rete: prima l'errore fermava tutto e l'elenco restava vecchio (rfd mancava, 22/11)
  const argomenti = ['metadata', '--format-version', '1', '--filter-platform', piattaforma, '--manifest-path', path.join(appDir, 'src-tauri', 'Cargo.toml')];
  const opzioni = { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] };
  let testo;
  try { testo = execFileSync('cargo', ['--offline', ...argomenti], opzioni); } catch { testo = execFileSync('cargo', argomenti, opzioni); }
  const meta = JSON.parse(testo);
  for (const n of meta.resolve.nodes) inGrafo.add(n.id);
  for (const p of meta.packages) pacchetti.set(p.id, p);
  radice = meta.resolve.root;
}
for (const p of [...pacchetti.values()].filter((x) => inGrafo.has(x.id) && x.id !== radice).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))) {
  const testi = leggiLicenze(path.dirname(p.manifest_path));
  testi.forEach((t) => fileLicenza.push({ nome: p.name, testo: t }));
  componenti.push([p.name, p.version, p.license ?? (p.license_file ? 'vedi file di licenza' : '?'), copyright(testi, p.authors), 'rust']);
}
// ---- npm (solo quelli che entrano nel programma, più i caratteri) ----
const lock = JSON.parse(fs.readFileSync(path.join(appDir, 'package-lock.json'), 'utf8'));
const npm = new Map();
for (const [k, v] of Object.entries(lock.packages)) if (k && !v.dev) npm.set(k.replace(/^.*node_modules\//, ''), k);
for (const nome of ['@fontsource/inter', '@fontsource/roboto']) npm.set(nome, 'node_modules/' + nome); // i caratteri finiscono nel pacchetto anche se sono dipendenze di sviluppo
for (const [nome, k] of [...npm].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dir = path.join(appDir, k);
  let pj = {}; try { pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { /* manca */ }
  const testi = leggiLicenze(dir);
  testi.forEach((t) => fileLicenza.push({ nome, testo: t }));
  const autore = typeof pj.author === 'string' ? pj.author : pj.author?.name;
  // un pacchetto di un'altra piattaforma (per esempio @tauri-apps/cli-win32-x64-msvc su Linux) non è installato: versione e licenza
  // si leggono dal package-lock, così l'elenco esce uguale su ogni sistema (su GitHub mancavano, 22/11)
  const voce = lock.packages[k] ?? {};
  const licenza = (typeof pj.license === 'string' ? pj.license : pj.license?.type) ?? voce.license ?? '?';
  componenti.push([nome, pj.version ?? voce.version ?? '', licenza, copyright(testi, autore ? [autore] : []), nome.startsWith('@fontsource/') ? 'carattere' : 'npm']);
}
// ---- icone (tracciati incorporati nel codice) ----
componenti.push(['Material Icons e Material Symbols (icone)', '', 'Apache-2.0', 'Copyright Google LLC', 'icone']);

// ---- testi delle licenze: un testo per ogni sigla, ripulito dai copyright dei singoli pacchetti ----
const marcatori = {
  'MIT': (t) => /Permission is hereby granted, free of charge/i.test(t) && !/No Attribution/i.test(t),
  'Apache-2.0': (t) => /Apache License/i.test(t) && /Version 2\.0/i.test(t),
  'BSD-3-Clause': (t) => /Redistribution and use in source and binary forms/i.test(t) && /Neither the name/i.test(t),
  'BSD-2-Clause': (t) => /Redistribution and use in source and binary forms/i.test(t) && !/Neither the name/i.test(t),
  'MPL-2.0': (t) => /Mozilla Public License Version 2\.0/i.test(t),
  'Unicode-3.0': (t) => /UNICODE LICENSE V3/i.test(t),
  'Zlib': (t) => /altered source versions/i.test(t),
  'Unlicense': (t) => /free and unencumbered software/i.test(t),
  '0BSD': (t) => /Permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i.test(t) && !/provided that the above copyright notice/i.test(t),
  'ISC': (t) => /Permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee is hereby granted, provided that/i.test(t),
  'CC0-1.0': (t) => /CC0 1\.0 Universal/i.test(t),
  'MIT-0': (t) => /MIT No Attribution/i.test(t),
  'OFL-1.1': (t) => /SIL OPEN FONT LICENSE/i.test(t),
};
const senzaCopyright = (t) => t.split(/\r?\n/).filter((l) => !RE_COPY.test(l) || /^\s*copyright\s+(notice|holder|owner)/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
const sigle = new Set();
for (const c of componenti) for (const s of String(c[2]).split(/\s+(?:OR|AND)\s+|\s*\/\s*|[()]/).map((x) => x.trim()).filter(Boolean)) sigle.add(s);
const testiLicenze = {};
for (const s of [...sigle].sort()) {
  const m = marcatori[s]; if (!m) continue;
  const trovato = fileLicenza.find((f) => m(f.testo));
  if (trovato) testiLicenze[s] = (s === 'Apache-2.0' || s === 'MPL-2.0' || s === 'OFL-1.1' || s === 'CC0-1.0') ? trovato.testo.trim().replace(/\r\n/g, '\n') : 'Copyright (c) i rispettivi titolari indicati nell\'elenco dei componenti\n\n' + senzaCopyright(trovato.testo).replace(/\r\n/g, '\n');
}
const senzaTesto = [...sigle].filter((s) => !testiLicenze[s] && !['vedi file di licenza', '?'].includes(s));
const corpo = `// FILE GENERATO da comune/scripts/genera-licenze.mjs (${new Date().toISOString().slice(0, 10)}): non modificare a mano.
// Componenti di terze parti che entrano nel programma e testi delle loro licenze.
/** [nome, versione, licenza, copyright, origine] */
export const COMPONENTI_TERZI: ReadonlyArray<readonly [string, string, string, string, string]> = ${JSON.stringify(componenti)};
/** Un testo per ogni sigla di licenza presente. */
export const TESTI_LICENZE: Readonly<Record<string, string>> = ${JSON.stringify(testiLicenze)};
`;
fs.writeFileSync(uscita, corpo, 'utf8');
console.log(`${componenti.length} componenti, ${Object.keys(testiLicenze).length} testi di licenza (${Object.keys(testiLicenze).join(', ')})`);
if (senzaTesto.length) console.log('sigle senza testo trovato:', senzaTesto.join(', '));
const senzaLic = componenti.filter((c) => c[2] === '?' || c[2] === 'vedi file di licenza').map((c) => c[0]);
if (senzaLic.length) console.log('componenti senza licenza dichiarata:', senzaLic.join(', '));
