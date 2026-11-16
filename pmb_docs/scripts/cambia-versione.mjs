// Cambia il numero di versione di pmb_docs in tutti i posti dove va scritto uguale (un test lo controlla).
// Uso (dalla cartella pmb_docs):  node scripts/cambia-versione.mjs 0.2.0
// Poi:  npm run build  ·  npx tauri build --bundles nsis  ·  node scripts/crea-aggiornamento.mjs --note "che cosa cambia"
import fs from 'node:fs';
import path from 'node:path';

const nuova = process.argv[2];
if (!nuova || !/^\d{1,6}(\.\d{1,6}){1,3}$/.test(nuova)) { console.error('Uso: node scripts/cambia-versione.mjs <versione>  (per esempio 0.2.0)'); process.exit(1); }
const radice = process.cwd();
const file = [
  ['src-tauri/tauri.conf.json', /("version":\s*")[^"]+(")/],
  ['package.json', /("version":\s*")[^"]+(")/],
  ['src-tauri/Cargo.toml', /(^version\s*=\s*")[^"]+(")/m],
  ['src/guscio/docs-informazioni.ts', /(VERSIONE_APP\s*=\s*')[^']+(')/],
];
for (const [rel, re] of file) {
  const p = path.join(radice, rel);
  const s = fs.readFileSync(p, 'utf8');
  if (!re.test(s)) { console.error('Non trovo la versione in ' + rel); process.exit(1); }
  fs.writeFileSync(p, s.replace(re, `$1${nuova}$2`));
  console.log('  ' + rel + ' -> ' + nuova);
}
console.log('Fatto. Cargo.lock si aggiorna da solo alla prossima compilazione.');
