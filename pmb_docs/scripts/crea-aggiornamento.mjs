// Confeziona un file di aggiornamento firmato (.pmbup) per pmb_docs a partire dall'installer della nuova versione.
// Uso (dalla cartella pmb_docs, dopo `npx tauri build --bundles nsis`):
//   node scripts/crea-aggiornamento.mjs [--note "che cosa cambia"] [--note-en "what changes"] [--setup <percorso setup.exe>] [--versione 0.2.0]
// --note-en: le stesse note in inglese, mostrate quando il programma è in inglese (dalla 0.4.0; i programmi più vecchi mostrano sempre --note).
// Senza opzioni prende l'installer appena compilato e la versione da src-tauri/tauri.conf.json.
// Scrive in ../RILASCI/pmb_docs/<versione>/ : l'installer completo (per chi non ha ancora il programma) e il file .pmbup (per chi ce l'ha già).
// La chiave privata di firma si legge dal vault delle credenziali (voce «pmb_docs — firma degli aggiornamenti»): non esce mai da lì.
// Formato del file: vedi src-tauri/src/aggiorna.rs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';

// file delle credenziali: variabile PMB_CREDENZIALI, altrimenti la posizione standard rispetto a questo script (fuori dal progetto)
// cerca .claude/memory/credenziali_vault.md risalendo dalle cartelle superiori: nel vault che contiene il progetto o in un vault accanto
function trovaVault() {
  const rel = path.join('.claude', 'memory', 'credenziali_vault.md');
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const qui = path.join(dir, rel);
    if (fs.existsSync(qui)) return qui;
    const padre = path.dirname(dir);
    for (const fratello of fs.existsSync(padre) ? fs.readdirSync(padre) : []) {
      const lì = path.join(padre, fratello, rel);
      if (fs.existsSync(lì)) return lì;
    }
    if (padre === dir) break;
    dir = padre;
  }
  throw new Error('File delle credenziali non trovato: impostare la variabile PMB_CREDENZIALI');
}
const VAULT = process.env.PMB_CREDENZIALI || trovaVault();
const radice = process.cwd();
const arg = (nome) => { const i = process.argv.indexOf('--' + nome); return i >= 0 ? process.argv[i + 1] : undefined; };

const conf = JSON.parse(fs.readFileSync(path.join(radice, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const versione = arg('versione') ?? conf.version;
const setup = arg('setup') ?? path.join(radice, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `pmb_docs_${conf.version}_x64-setup.exe`);
const note = arg('note') ?? '';
const noteEn = arg('note-en') ?? '';
if (!/^\d{1,6}(\.\d{1,6}){0,3}$/.test(versione)) { console.error('Versione non valida: ' + versione); process.exit(1); }
if (!fs.existsSync(setup)) { console.error('Non trovo l\'installer: ' + setup + ' (prima: npx tauri build --bundles nsis)'); process.exit(1); }
if (versione !== conf.version && !arg('setup')) { console.error(`La versione ${versione} non coincide con quella di tauri.conf.json (${conf.version}): l'installer compilato è un'altra.`); process.exit(1); }

// chiave privata dal vault
const vault = fs.readFileSync(VAULT, 'utf8');
const voce = vault.indexOf('pmb_docs — firma degli aggiornamenti');
const m = voce >= 0 ? /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/.exec(vault.slice(voce)) : null;
if (!m) { console.error('Nel vault non c\'è la chiave di firma (scripts/genera-chiave-firma.mjs).'); process.exit(1); }
const privata = crypto.createPrivateKey(m[0]);
const pubblicaRaw = crypto.createPublicKey(privata).export({ format: 'der', type: 'spki' }).subarray(-32);

// la chiave pubblica nel programma deve essere quella della chiave privata: altrimenti il programma rifiuterebbe l'aggiornamento
const rs = fs.readFileSync(path.join(radice, 'src-tauri', 'src', 'chiave_pubblica.rs'), 'utf8');
const nelProgramma = Buffer.from((/\[([\d,\s]+)\]/.exec(rs)?.[1] ?? '').split(',').map((x) => Number(x.trim())));
if (!nelProgramma.equals(pubblicaRaw)) { console.error('La chiave pubblica scritta nel programma non corrisponde alla chiave privata del vault: l\'aggiornamento non verrebbe accettato.'); process.exit(1); }

const installer = fs.readFileSync(setup);
const intestazione = Buffer.from(JSON.stringify({
  app: 'pmb_docs', versione, note, ...(noteEn ? { note_en: noteEn } : {}), dimensione: installer.length, sha256: crypto.createHash('sha256').update(installer).digest('hex'),
}), 'utf8');
if (intestazione.length > 16 * 1024) { console.error('Le note sono troppo lunghe.'); process.exit(1); }
const firma = crypto.sign(null, intestazione, privata);
const lunghezza = Buffer.alloc(4); lunghezza.writeUInt32LE(intestazione.length);
const pacchetto = Buffer.concat([Buffer.from('PMBUP1\n', 'latin1'), lunghezza, intestazione, firma, installer]);

// controllo finale: la firma si verifica con la chiave pubblica
const ok = crypto.verify(null, intestazione, crypto.createPublicKey(privata), firma);
if (!ok || firma.length !== 64) { console.error('Controllo della firma fallito.'); process.exit(1); }

const cartella = path.resolve(radice, '..', 'RILASCI', 'pmb_docs', versione);
fs.mkdirSync(cartella, { recursive: true });
const nomeSetup = `pmb_docs_${versione}_x64-setup.exe`;
fs.copyFileSync(setup, path.join(cartella, nomeSetup));
const nomePacchetto = `pmb_docs-aggiornamento-${versione}.pmbup`;
fs.writeFileSync(path.join(cartella, nomePacchetto), pacchetto);
console.log(`Versione ${versione}\n  installer completo : ${path.join(cartella, nomeSetup)} (${(installer.length / 1048576).toFixed(2)} MB)\n  file di aggiornamento: ${path.join(cartella, nomePacchetto)} (${(pacchetto.length / 1048576).toFixed(2)} MB, firmato)`);
