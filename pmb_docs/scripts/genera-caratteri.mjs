// Genera i caratteri inclusi in pmb_docs: copia da node_modules/@fontsource i file woff2 (alfabeto latino, normale e grassetto, tondo e corsivo
// dove esistono) in src/assets/fonts/extra, scrive src/assets/fonts/caratteri-extra.css e src/guscio/caratteri-dati.ts.
// Uso (dalla cartella pmb_docs):  node scripts/genera-caratteri.mjs
import fs from 'node:fs';
import path from 'node:path';

// [pacchetto, nome della famiglia come lo scrive il CSS del pacchetto, gruppo]
const FAMIGLIE = [
  ['open-sans', 'Open Sans', 'Sans serif'], ['lato', 'Lato', 'Sans serif'], ['montserrat', 'Montserrat', 'Sans serif'], ['poppins', 'Poppins', 'Sans serif'],
  ['source-sans-3', 'Source Sans 3', 'Sans serif'], ['nunito', 'Nunito', 'Sans serif'], ['raleway', 'Raleway', 'Sans serif'], ['work-sans', 'Work Sans', 'Sans serif'],
  ['fira-sans', 'Fira Sans', 'Sans serif'], ['noto-sans', 'Noto Sans', 'Sans serif'], ['pt-sans', 'PT Sans', 'Sans serif'],
  ['oswald', 'Oswald', 'Sans serif'], ['barlow', 'Barlow', 'Sans serif'],
  ['merriweather', 'Merriweather', 'Serif'], ['playfair-display', 'Playfair Display', 'Serif'], ['lora', 'Lora', 'Serif'], ['pt-serif', 'PT Serif', 'Serif'],
  ['noto-serif', 'Noto Serif', 'Serif'], ['libre-baskerville', 'Libre Baskerville', 'Serif'], ['eb-garamond', 'EB Garamond', 'Serif'], ['crimson-text', 'Crimson Text', 'Serif'],
  ['cormorant-garamond', 'Cormorant Garamond', 'Serif'], ['roboto-slab', 'Roboto Slab', 'Serif'], ['source-serif-4', 'Source Serif 4', 'Serif'],
  ['inconsolata', 'Inconsolata', 'Monospazio'], ['source-code-pro', 'Source Code Pro', 'Monospazio'], ['roboto-mono', 'Roboto Mono', 'Monospazio'], ['jetbrains-mono', 'JetBrains Mono', 'Monospazio'],
  ['dancing-script', 'Dancing Script', 'Decorativo'], ['pacifico', 'Pacifico', 'Decorativo'], ['caveat', 'Caveat', 'Decorativo'], ['lobster', 'Lobster', 'Decorativo'],
  ['comfortaa', 'Comfortaa', 'Decorativo'], ['bebas-neue', 'Bebas Neue', 'Decorativo'],
];
const PESI = ['400', '700'];
const STILI = ['normal', 'italic'];

const radice = process.cwd();
const dest = path.join(radice, 'src', 'assets', 'fonts', 'extra');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
let css = '/* Caratteri inclusi in pmb_docs (tutti con licenza OFL 1.1, vedi Informazioni > Licenze di terze parti). File generato da scripts/genera-caratteri.mjs: non modificarlo a mano. */\n';
const dati = [];
let totaleByte = 0, nFile = 0;
for (const [pacchetto, nome, gruppo] of FAMIGLIE) {
  const files = path.join(radice, 'node_modules', '@fontsource', pacchetto, 'files');
  if (!fs.existsSync(files)) throw new Error(`manca il pacchetto @fontsource/${pacchetto}: npm install`);
  let facce = 0;
  for (const stile of STILI) for (const peso of PESI) {
    const f = `${pacchetto}-latin-${peso}-${stile}.woff2`;
    if (!fs.existsSync(path.join(files, f))) continue;
    fs.copyFileSync(path.join(files, f), path.join(dest, f));
    totaleByte += fs.statSync(path.join(dest, f)).size; nFile++; facce++;
    css += `@font-face { font-family: '${nome}'; font-style: ${stile}; font-weight: ${peso}; font-display: swap; src: url('./extra/${f}') format('woff2'); }\n`;
  }
  if (facce === 0) throw new Error(`nessun file latin per ${pacchetto}`);
  dati.push([nome, gruppo]);
}
fs.writeFileSync(path.join(radice, 'src', 'assets', 'fonts', 'caratteri-extra.css'), css);
fs.writeFileSync(path.join(radice, 'src', 'guscio', 'caratteri-dati.ts'),
  `// Caratteri inclusi nel programma [nome della famiglia, gruppo]. File generato da scripts/genera-caratteri.mjs: non modificarlo a mano.\n` +
  `export const CARATTERI_INCLUSI: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(dati)};\n`);
console.log(`${dati.length} famiglie, ${nFile} file, ${(totaleByte / 1048576).toFixed(2)} MB`);
