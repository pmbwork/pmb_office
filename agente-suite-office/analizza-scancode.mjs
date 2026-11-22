// agente-suite-office: legge il risultato di ScanCode (scancode --license --copyright --json-pp) sul codice di un progetto e segnala
// ogni licenza o titolare del copyright diverso da quelli del progetto, fuori dai file ammessi nel registro di provenienza.
// ORIGINALE in vault di lavoro di PMB, .claude/agenti/agente-suite-office/; nei progetti c'è una copia (aggiorna-progetto.ps1): non modificarla lì.
// Uso: node analizza-scancode.mjs scancode.json [--registro registro-provenienza.json] [--rapporto rapporto.md]   (esito 1 se trova un BLOCCO)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const j = process.argv.indexOf('--registro');
// il registro del progetto: accanto alla copia dell'agente nel progetto, oppure indicato con --registro
const REG = JSON.parse(fs.readFileSync(j > 0 ? process.argv[j + 1] : path.join(QUI, 'registro-provenienza.json'), 'utf8'));
const [ingresso] = process.argv.slice(2);
const i = process.argv.indexOf('--rapporto'); const RAPPORTO = i > 0 ? process.argv[i + 1] : undefined;
const dati = JSON.parse(fs.readFileSync(ingresso, 'utf8'));
const TOGLI_RADICE = process.argv.includes('--togli-radice');
const globRe = (g) => new RegExp('^' + g.split('**').map((p) => p.split('*').map((q) => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
// ammessi: i file con avvisi altrui dichiarati (avvisiAmmessi) e quelli verificati a mano dopo una segnalazione di ScanCode
// (scancodeAmmessi: documenti che citano le licenze, falsi positivi), ognuno con il suo motivo nel registro
const ammesso = (f) => [...REG.avvisiAmmessi, ...(REG.scancodeAmmessi ?? [])].some((a) => globRe(a.file).test(f));
// licenze che possono comparire nel codice del progetto senza essere materiale altrui: la sua (GPL-3.0) e i nomi citati nei testi
const DEL_PROGETTO = /^(gpl-3\.0|gpl-3\.0-plus|gpl-3\.0-only|gpl-3\.0-or-later|unknown-license-reference|free-unknown|unknown)$/i;
// il titolare del progetto (registro: progetto.titolare) non è materiale altrui
const titolare = (REG.progetto?.titolare ?? 'PMB').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TITOLARI_PROGETTO = new RegExp(`\\b${titolare}\\b`);

const righe = []; let file = 0;
for (const f of dati.files ?? []) {
  if (f.type !== 'file') continue;
  file++;
  // --togli-radice: senza --strip-root (che in ScanCode 32.4.1 fallisce) ogni percorso comincia con il nome della cartella analizzata
  const rel = TOGLI_RADICE ? f.path.replace(/\\/g, '/').replace(/^[^/]*\//, '') : f.path.replace(/\\/g, '/');
  if (ammesso(rel)) continue;
  const licenze = (f.license_detections ?? []).map((d) => d.license_expression_spdx ?? d.license_expression).filter(Boolean);
  const estranee = [...new Set(licenze)].filter((l) => !l.split(/\s+(?:AND|OR|WITH)\s+/i).every((x) => DEL_PROGETTO.test(x.replace(/[()]/g, ''))));
  if (estranee.length) righe.push(`- ❌ ${rel}: licenza riconosciuta ${estranee.join(', ')}`);
  const titolari = [...new Set((f.holders ?? []).map((h) => h.holder))].filter((h) => !TITOLARI_PROGETTO.test(h));
  if (titolari.length) righe.push(`- ❌ ${rel}: avviso di copyright di ${titolari.join(', ')}`);
}
const md = `# agente-suite-office: scansione ScanCode\n\n${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${file} file analizzati · **${righe.length} segnalazioni**\n\n`
  + (righe.length ? righe.join('\n') + '\n\nOgni segnalazione va guardata: se il materiale è altrui va tolto, oppure dichiarato nel registro di provenienza con la sua licenza.\n' : '- ✅ nessuna licenza o avviso di copyright altrui nel codice del progetto, fuori dai file ammessi nel registro\n');
if (RAPPORTO) fs.writeFileSync(RAPPORTO, md, 'utf8');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
process.exit(righe.length ? 1 : 0);
