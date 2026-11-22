// Rigenera controlli_macro.xlsm (file di prova della prova fisica giro_55) dal costruttore dei test: npx vite-node tests/file-prova/controlli/crea-controlli.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xlsmDiProva } from '../../lavoro/aiuti-xlsm';
const qui = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(qui, 'controlli_macro.xlsm'), await xlsmDiProva());
console.log('scritto', path.join(qui, 'controlli_macro.xlsm'));
