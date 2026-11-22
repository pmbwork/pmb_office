// Crea la coppia di chiavi (Ed25519) con cui si firmano gli aggiornamenti di pmb_docs. Da eseguire UNA volta sola.
//  - la chiave PRIVATA si aggiunge al vault delle credenziali (mai stampata a schermo, mai in un file del progetto);
//  - la chiave PUBBLICA si scrive in src-tauri/src/chiave_pubblica.rs: il programma la usa per controllare gli aggiornamenti.
// Se la chiave pubblica cambia, i programmi già installati non riconosceranno più gli aggiornamenti firmati con la nuova chiave:
// non rigenerarla se esistono installazioni da aggiornare.
// Uso (dalla cartella pmb_docs):  node scripts/genera-chiave-firma.mjs
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
const USCITA = path.join(process.cwd(), 'src-tauri', 'src', 'chiave_pubblica.rs');
const MARCA = '-----BEGIN PRIVATE KEY-----';

const vault = fs.readFileSync(VAULT, 'utf8');
if (vault.includes(MARCA) && vault.includes('pmb_docs — firma degli aggiornamenti')) { console.error('Esiste già una chiave di firma nel vault: non la sostituisco.'); process.exit(1); }
if (fs.existsSync(USCITA)) { console.error('Esiste già ' + USCITA + ': non la sostituisco.'); process.exit(1); }

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pubRaw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString().trim();

fs.writeFileSync(USCITA,
  `// Chiave pubblica (Ed25519) con cui pmb_docs controlla la firma degli aggiornamenti. File generato da scripts/genera-chiave-firma.mjs: non modificarlo.\n` +
  `// La chiave privata corrispondente sta nel vault delle credenziali (voce «pmb_docs — firma degli aggiornamenti»).\n` +
  `pub const CHIAVE_PUBBLICA: [u8; 32] = [${[...pubRaw].join(', ')}];\n`);

const voce = `\n\n## pmb_docs — firma degli aggiornamenti — aggiunto ${new Date().toISOString().slice(0, 10)}\n\n` +
  `Chiave privata Ed25519 (PKCS#8) con cui \`pmb_docs/scripts/crea-aggiornamento.mjs\` firma i file di aggiornamento \`.pmbup\`. ` +
  `La chiave pubblica corrispondente è dentro il programma (\`src-tauri/src/chiave_pubblica.rs\`). ` +
  `**Non perderla e non rigenerarla**: senza questa chiave non si possono più firmare aggiornamenti per i programmi già installati. ` +
  `Chi la possiede può costruire aggiornamenti che i programmi installati accettano: non condividerla.\n\n` +
  '```\n' + pem + '\n```\n';
fs.appendFileSync(VAULT, voce);
console.log('Chiave creata. Pubblica scritta in ' + USCITA + ' (' + Buffer.from(pubRaw).toString('hex') + '). Privata aggiunta al vault.');
