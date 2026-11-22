// agente-suite-office: verifica automatica di licenze, provenienza e originalità di un progetto (nato per la suite pmb_office).
// ORIGINALE in vault di lavoro di PMB, .claude/agenti/agente-suite-office/ (regole: vault di lavoro di PMB, .claude/regole_progetti/regole_agente_suite_office.md);
// nei progetti ce n'è una COPIA in <progetto>/agente-suite-office/, messa da aggiorna-progetto.ps1: non modificarla lì.
// I dati del progetto (percorsi, licenze ammesse, origine dei file) stanno nel suo <progetto>/agente-suite-office/registro-provenienza.json.
// Uso:  node verifica.mjs [--radice <cartella del progetto>] [--registro <file.json>] [--rapporto <file.md>] [--senza-rigenerare]
// --radice: predefinita la cartella sopra lo script (giusta per la copia nel progetto); dall'originale va indicata.
// --senza-rigenerare: salta il confronto con l'elenco dei componenti ricalcolato (serve npm ci nelle app e cargo; su GitHub si fa sempre).
// Esito: 0 = nessun BLOCCO; 1 = almeno un BLOCCO. Gli AVVISI non bloccano ma vanno letti.
// Limite dichiarato: un controllo automatico trova i segni riconoscibili di materiale altrui (avvisi, testi di licenza, file senza
// origine, dipendenze con licenze incompatibili); non può dimostrare che nessuna riga sia stata copiata né escludere brevetti.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined; };
const RADICE = path.resolve(arg('--radice') ?? path.join(QUI, '..'));
const RAPPORTO = arg('--rapporto');
const RIGENERA = !process.argv.includes('--senza-rigenerare');
const FILE_REG = path.resolve(arg('--registro') ?? path.join(RADICE, 'agente-suite-office', 'registro-provenienza.json'));
if (!fs.existsSync(FILE_REG)) { console.error(`Manca il registro di provenienza del progetto: ${FILE_REG} (indicare --radice <cartella del progetto>)`); process.exit(2); }
const REG = JSON.parse(fs.readFileSync(FILE_REG, 'utf8'));
const CONF = REG.progetto;

const esiti = []; // { livello: 'BLOCCO' | 'AVVISO' | 'OK', controllo, testo }
const blocco = (controllo, testo) => esiti.push({ livello: 'BLOCCO', controllo, testo });
const avviso = (controllo, testo) => esiti.push({ livello: 'AVVISO', controllo, testo });
const ok = (controllo, testo) => esiti.push({ livello: 'OK', controllo, testo });

// ---------- file del progetto ----------
const SALTA = /(^|\/)(node_modules|target|dist|\.git|RILASCI|LAVORO|PROVE|graphify-out|build-cache)(\/|$)/;
function elencoFile() {
  if (fs.existsSync(path.join(RADICE, '.git'))) {
    try { return execFileSync('git', ['-C', RADICE, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean); } catch { /* git assente: si cammina */ }
  }
  const tutti = [];
  const cammina = (rel) => {
    for (const e of fs.readdirSync(path.join(RADICE, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (SALTA.test(r)) continue;
      if (e.isDirectory()) cammina(r); else tutti.push(r);
    }
  };
  cammina('');
  return tutti;
}
const FILE = elencoFile();
const globRe = (g) => new RegExp('^' + g.split('**').map((p) => p.split('*').map((q) => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
const corrisponde = (f, globs) => globs.some((g) => globRe(g).test(f));
const leggi = (f) => fs.readFileSync(path.join(RADICE, f), 'utf8');

// ---------- 1. licenza del progetto ----------
{
  const c = 'Licenza del progetto';
  // nel repository LICENSE sta nella radice; nella cartella di lavoro in repo-github/ (sincronizza.ps1 lo copia)
  const lic = ['LICENSE', 'repo-github/LICENSE'].find((x) => FILE.includes(x));
  if (!lic) blocco(c, 'manca il file LICENSE');
  else if (!/GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/.test(leggi(lic))) blocco(c, `${lic} non è il testo della GNU GPL v3`);
  else ok(c, `${lic} = GNU GPL v3`);
  // nessun testo del progetto può aggiungere restrizioni alla GPL (sezioni 7 e 10): per esempio vietare la vendita o l'uso commerciale.
  // I nomi e il logo PMB invece si possono tutelare (sezione 7 e: marchi).
  const RESTRIZIONI = /non si (può|possono|puo') (vendere|noleggiare)|vietat[ao] (la vendita|l'uso commerciale)|solo (per )?uso (personale|non commerciale)|uso non commerciale|non[- ]commercial use only|may not (be )?(sell|sold)/i;
  for (const f of FILE.filter((x) => /\.(md|ts|txt|html)$/.test(x) && !corrisponde(x, REG.avvisiAmmessi.map((a) => a.file)))) {
    leggi(f).split(/\r?\n/).forEach((riga, i) => { if (RESTRIZIONI.test(riga)) blocco(c, `${f}:${i + 1} restrizione incompatibile con la GPL v3: «${riga.trim().slice(0, 160)}»`); });
  }
  for (const f of CONF.fileCondizioni ?? []) if (FILE.includes(f) && !/GPL/.test(leggi(f))) blocco(c, `${f} non cita la GPL`);
  for (const f of FILE.filter((x) => /(^|\/)package\.json$/.test(x) && !SALTA.test(x))) {
    const pj = JSON.parse(leggi(f));
    if (pj.license && !/^GPL-3\.0/.test(pj.license)) blocco(c, `${f}: campo license «${pj.license}» diverso dalla GPL-3.0 del progetto`);
  }
}

// ---------- 2. licenze dei componenti di terze parti ----------
const AMMESSE = new Set(REG.licenzeAmmesse);
const VIETATE = REG.licenzeVietate.map((x) => new RegExp(x, 'i'));
function valutaLicenza(espressione) {
  // «MIT/Apache-2.0», «Apache-2.0 / MIT» = alternative; OR: basta un'alternativa ammessa; AND: servono tutte
  const e = espressione.replace(/\s*\/\s*/g, ' OR ').replace(/[()]/g, ' ').trim();
  if (!e || e === '?' || /vedi file/i.test(e)) return 'ignota';
  if (VIETATE.some((re) => re.test(e))) return 'vietata';
  const alternative = e.split(/\s+OR\s+/i).map((a) => a.split(/\s+AND\s+/i).map((x) => x.trim()));
  return alternative.some((termini) => termini.every((t) => AMMESSE.has(t))) ? 'ammessa' : 'ignota';
}
const leggiElenco = (f) => { const m = leggi(f).match(/COMPONENTI_TERZI[^=]*=\s*(\[\[[\s\S]*?\]\]);/); return m ? JSON.parse(m[1]) : null; };
const ELENCHI = Object.fromEntries(Object.entries(CONF.app).map(([k, v]) => [k, v.elencoComponenti]));
const APP = Object.fromEntries(Object.entries(CONF.app).map(([k, v]) => [k, v.cartella]));
const componenti = {};
for (const [app, f] of Object.entries(ELENCHI)) {
  const c = `Licenze dei componenti (${app})`;
  if (!FILE.includes(f)) { blocco(c, `manca ${f}`); continue; }
  const el = leggiElenco(f); componenti[app] = el;
  if (!el) { blocco(c, `${f} non leggibile`); continue; }
  const male = el.map((x) => [x, valutaLicenza(x[2])]).filter(([, v]) => v !== 'ammessa');
  for (const [x, v] of male) blocco(c, `${x[0]} ${x[1]}: licenza «${x[2]}» ${v === 'vietata' ? 'NON compatibile con la GPL v3' : 'non riconosciuta (aggiungerla al registro solo dopo averla verificata)'}`);
  if (!male.length) ok(c, `${el.length} componenti, tutte licenze compatibili con la GPL v3`);
  const senzaTitolare = el.filter((x) => !x[3] || /nessun avviso/i.test(x[3]));
  if (senzaTitolare.length) avviso(c, `${senzaTitolare.length} componenti senza titolare del copyright nel pacchetto (si mostra «gli autori del progetto»): ${senzaTitolare.slice(0, 8).map((x) => x[0]).join(', ')}${senzaTitolare.length > 8 ? '…' : ''}`);
}

// ---------- 3. elenco dei componenti aggiornato (ricalcolato e confrontato) ----------
const NOTICE = [];
if (RIGENERA) {
  for (const [app, f] of Object.entries(ELENCHI)) {
    const c = `Elenco componenti aggiornato (${app})`;
    const dirApp = path.join(RADICE, APP[app]);
    if (!fs.existsSync(path.join(dirApp, 'node_modules'))) { blocco(c, `manca node_modules in ${APP[app]}: lanciare npm ci, oppure --senza-rigenerare`); continue; }
    const tmp = path.join(os.tmpdir(), `agente-suite-office-${app}-${process.pid}.ts`);
    try {
      execFileSync('node', [path.join(RADICE, CONF.generatoreElenco), dirApp, tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
      const m = fs.readFileSync(tmp, 'utf8').match(/COMPONENTI_TERZI[^=]*=\s*(\[\[[\s\S]*?\]\]);/);
      const oggi = JSON.parse(m[1]).map((x) => x.slice(0, 3).join(' '));
      const scritto = new Set((componenti[app] ?? []).map((x) => x.slice(0, 3).join(' ')));
      const oggiS = new Set(oggi);
      const nuovi = oggi.filter((x) => !scritto.has(x)); const tolti = [...scritto].filter((x) => !oggiS.has(x));
      if (nuovi.length || tolti.length) blocco(c, `l'elenco nel programma non corrisponde alle dipendenze: mancano [${nuovi.join('; ')}], in più [${tolti.join('; ')}]. Rigenerare con comune/scripts/genera-licenze.mjs`);
      else ok(c, `uguale alle dipendenze di oggi (${oggi.length})`);
    } catch (e) { blocco(c, `ricalcolo non riuscito: ${String(e.stderr ?? e.message).slice(0, 300)}`); }
    finally { fs.rmSync(tmp, { force: true }); }
    // file NOTICE dei componenti (Apache-2.0, sezione 4d: vanno riportati con il programma)
    try {
      const lock = JSON.parse(fs.readFileSync(path.join(dirApp, 'package-lock.json'), 'utf8'));
      for (const [k, v] of Object.entries(lock.packages)) if (k && !v.dev) {
        const d = path.join(dirApp, k);
        if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) if (/^NOTICE/i.test(n)) NOTICE.push(`${app}: ${k.replace(/^.*node_modules\//, '')}`);
      }
      for (const piatt of ['x86_64-pc-windows-msvc', 'aarch64-apple-darwin']) {
        const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--filter-platform', piatt, '--manifest-path', path.join(dirApp, 'src-tauri', 'Cargo.toml')], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
        const inGrafo = new Set(meta.resolve.nodes.map((n) => n.id));
        for (const p of meta.packages) if (inGrafo.has(p.id) && p.id !== meta.resolve.root) {
          const d = path.dirname(p.manifest_path);
          for (const n of fs.readdirSync(d)) if (/^NOTICE/i.test(n)) NOTICE.push(`${app}: ${p.name} ${p.version}`);
        }
      }
    } catch { /* cargo assente: il controllo dei NOTICE resta parziale */ }
  }
  const unici = [...new Set(NOTICE)].filter((x) => !REG.noticeRiportati.some((r) => x.includes(r)));
  if (unici.length) avviso('File NOTICE (Apache-2.0)', `componenti con file NOTICE da riportare nelle informazioni del programma: ${unici.join(', ')}`);
  else ok('File NOTICE (Apache-2.0)', 'nessun componente con file NOTICE da riportare');
} else avviso('Elenco componenti aggiornato', 'saltato (--senza-rigenerare): su GitHub si fa sempre');

// ---------- 4. caratteri inclusi nel programma ----------
for (const [app, dir] of Object.entries(CONF.app).filter(([, v]) => v.caratteri).map(([k, v]) => [k, v.caratteri])) {
  const c = `Caratteri (${app})`;
  const fam = new Set(FILE.filter((f) => f.startsWith(dir + '/') && /\.(woff2?|ttf|otf)$/.test(f)).map((f) => path.basename(f).replace(/-(latin|latin-ext|cyrillic|greek|vietnamese)(-ext)?-\d+.*$/, '')));
  const pacchetti = new Set((componenti[app] ?? []).filter((x) => x[4] === 'carattere').map((x) => x[0].replace('@fontsource/', '')));
  const senza = [...fam].filter((f) => !pacchetti.has(f) && !corrisponde(`${dir}/${f}`, REG.caratteriPropri ?? []));
  if (senza.length) blocco(c, `caratteri inclusi senza componente e licenza nell'elenco: ${senza.join(', ')}`);
  else ok(c, `${fam.size} famiglie, tutte con la loro licenza nell'elenco`);
}

// ---------- 5. avvisi di copyright e testi di licenza altrui nel codice ----------
{
  const c = 'Codice: avvisi e testi altrui';
  const SEGNI = [
    [/copyright\s*(\(c\)|©)?\s*(\d{4}|by\b)/i, 'avviso di copyright'],
    [/\(c\)\s*\d{4}/i, 'avviso di copyright'],
    [/SPDX-License-Identifier/i, 'identificatore di licenza'],
    [/Permission is hereby granted, free of charge/i, 'testo della licenza MIT'],
    [/Licensed under the Apache License/i, 'testo della licenza Apache'],
    [/Redistribution and use in source and binary forms/i, 'testo della licenza BSD'],
    [/subject to the terms of the Mozilla Public/i, 'testo della licenza MPL'],
    [/all rights reserved/i, '«all rights reserved»'],
    [/\b(derived|adapted|ported|copied|taken) from\b/i, 'dichiarazione di derivazione'],
    [/stackoverflow\.com\/(a|questions)\//i, 'codice preso da Stack Overflow'],
    [/\b(tratto|copiato|preso|ricavato) da\s+(https?:|github|stackoverflow|libreoffice|openoffice|microsoft)/i, 'dichiarazione di derivazione'],
  ];
  const TESTO = /\.(ts|tsx|js|mjs|cjs|rs|py|ps1|sh|nsi|wxs|html|css|toml|yml|yaml|json|md|txt)$/i;
  let n = 0;
  for (const f of FILE.filter((x) => TESTO.test(x) && !corrisponde(x, REG.avvisiAmmessi.map((a) => a.file)))) {
    let t; try { t = leggi(f); } catch { continue; }
    n++;
    const righe = t.split(/\r?\n/);
    righe.forEach((r, i) => {
      if (REG.righeAmmesse.some((a) => new RegExp(a).test(r))) return;
      const nomi = [...new Set(SEGNI.filter(([re]) => re.test(r)).map(([, nome]) => nome))];
      if (nomi.length) blocco(c, `${f}:${i + 1} ${nomi.join(', ')}: «${r.trim().slice(0, 140)}»`);
    });
  }
  if (!esiti.some((e) => e.controllo === c && e.livello === 'BLOCCO')) ok(c, `${n} file di testo controllati, nessun segno di materiale altrui fuori dal registro`);
  // i file ammessi devono ancora avere il loro avviso (un modello derivato senza avviso violerebbe la sua licenza)
  for (const a of REG.avvisiAmmessi.filter((x) => x.deveContenere)) for (const f of FILE.filter((x) => corrisponde(x, [a.file])))
    if (!leggi(f).includes(a.deveContenere)) blocco(c, `${f}: manca l'avviso richiesto dalla licenza d'origine («${a.deveContenere}»)`);
}

// ---------- 6. file binari: ognuno deve avere origine e licenza registrate ----------
{
  const c = 'Risorse: origine registrata';
  const BIN = /\.(png|jpe?g|gif|bmp|ico|icns|svg|webp|woff2?|ttf|otf|pdf|docx?|xlsx?|odt|ods|pptx?|rtf|zip|wav|mp3|mp4)$/i;
  const bin = FILE.filter((f) => BIN.test(f));
  const senza = bin.filter((f) => !corrisponde(f, REG.risorse.map((r) => r.percorso)));
  for (const f of senza) blocco(c, `${f}: origine e licenza non registrate nel registro di provenienza del progetto`);
  if (!senza.length) ok(c, `${bin.length} file binari, tutti con origine registrata`);
}

// ---------- 7. nomi e marchi ----------
{
  const c = 'Nomi e marchi';
  const MARCHI = /\b(Microsoft|Office 365|Word|Excel|PowerPoint|Google|LibreOffice|OpenOffice|Apple|Pages|Numbers|Keynote)\b/;
  for (const f of FILE.filter((x) => /tauri\.conf\.json$/.test(x))) {
    const conf = JSON.parse(leggi(f));
    const nomi = [conf.productName, conf.identifier, ...(conf.app?.windows ?? []).map((w) => w.title)].filter(Boolean);
    for (const nome of nomi) if (MARCHI.test(nome)) blocco(c, `${f}: il nome «${nome}» contiene un marchio altrui`);
  }
  for (const f of FILE.filter((x) => /(^|\/)media\//.test(x) && MARCHI.test(path.basename(x)))) blocco(c, `${f}: file grafico con il nome di un marchio altrui`);
  if (!esiti.some((e) => e.controllo === c && e.livello === 'BLOCCO')) ok(c, 'nomi dei programmi, finestre e grafica senza marchi altrui (i formati .docx/.xlsx si citano solo per compatibilità)');
}

// ---------- 7b. file di testo integri: nessun carattere di controllo ----------
// un percorso scritto con le barre rovesciate dentro uno script può diventare «\b \t \r \n \a \v» veri (successo tre volte il 22/11:
// installa.ps1, pubblica-release.ps1, un resoconto): lo script non trova più il file. Ammessi solo tabulazione, a capo e ritorno a capo.
{
  const c = 'File di testo integri';
  const TESTO_INTEGRO = /\.(ts|tsx|js|mjs|cjs|rs|py|ps1|sh|nsi|wxs|html|css|toml|yml|yaml|json|md|txt)$/i;
  // eslint-disable-next-line no-control-regex
  const CONTROLLO = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
  let n = 0;
  for (const f of FILE.filter((x) => TESTO_INTEGRO.test(x))) {
    let t; try { t = leggi(f); } catch { continue; }
    n++;
    const righe = t.split(/\r?\n/);
    const i = righe.findIndex((r) => CONTROLLO.test(r.replace(/\r$/, '')));
    if (i >= 0) blocco(c, `${f}:${i + 1} contiene un carattere di controllo (di solito una sequenza con la barra rovesciata diventata un carattere vero): «${JSON.stringify(righe[i].slice(0, 120))}»`);
  }
  if (!esiti.some((e) => e.controllo === c && e.livello === 'BLOCCO')) ok(c, `${n} file di testo senza caratteri di controllo`);
}

// ---------- 8. documenti delle licenze aggiornati ----------
{
  const c = 'Documenti delle licenze';
  for (const [app, f] of Object.entries(CONF.app).filter(([, v]) => v.documentoLicenze).map(([k, v]) => [k, v.documentoLicenze])) if (FILE.includes(f)) {
    const d = leggi(f).match(/(?:generato|aggiornato) il (\d{4}-\d{2}-\d{2})/)?.[1];
    const g = leggi(ELENCHI[app]).match(/FILE GENERATO[^(]*\((\d{4}-\d{2}-\d{2})\)/)?.[1];
    if (d && g && d < g) avviso(c, `${f} è del ${d}, l'elenco nel programma del ${g}: il documento è superato (l'elenco valido è quello in Aiuto › Informazioni)`);
    else ok(c, `${f} allineato`);
  }
}

// ---------- rapporto ----------
const data = new Date().toISOString().slice(0, 16).replace('T', ' ');
const nB = esiti.filter((e) => e.livello === 'BLOCCO').length, nA = esiti.filter((e) => e.livello === 'AVVISO').length;
const icona = { BLOCCO: '❌', AVVISO: '⚠️', OK: '✅' };
let md = `# agente-suite-office: verifica di licenze, provenienza e originalità\n\n${data} UTC · ${FILE.length} file · **${nB} blocchi, ${nA} avvisi**\n\n`;
for (const e of [...esiti].sort((a, b) => ['BLOCCO', 'AVVISO', 'OK'].indexOf(a.livello) - ['BLOCCO', 'AVVISO', 'OK'].indexOf(b.livello)))
  md += `- ${icona[e.livello]} **${e.controllo}**: ${e.testo}\n`;
md += `\n## Che cosa questo controllo non può garantire\n${REG.limiti.map((l) => `- ${l}`).join('\n')}\n`;
if (RAPPORTO) fs.writeFileSync(RAPPORTO, md, 'utf8');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
process.exit(nB ? 1 : 0);
