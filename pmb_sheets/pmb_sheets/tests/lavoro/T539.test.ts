// T539: un file con l'estensione di un formato che è sempre un archivio (.xlsx, .ods...) ma che non è un archivio dà un errore chiaro
// (trovato con la prova fisica giro_08, 2026-11-18: si apriva come un CSV con dentro il testo del file). Stesso messaggio di pmb_docs.
import { describe, it, expect } from 'vitest';
import { importa } from '../../src/formati/file';

const testo = new TextEncoder().encode('questo non e un file excel');

describe('T539: file rovinati con l’estensione di un archivio', () => {
  for (const ext of ['xlsx', 'xlsm', 'xltx', 'xltm', 'xlsb', 'ods', 'ots']) {
    it(`.${ext}: errore chiaro, non un foglio con il testo del file`, async () => {
      await expect(importa(testo, `rotto.${ext}`)).rejects.toThrow(`non è un file .${ext} valido`);
    });
  }
  it('i formati di testo restano apribili come testo (.csv, .txt)', async () => {
    expect((await importa(new TextEncoder().encode('a;b\n1;2'), 'dati.csv')).formato).toBe('csv');
    expect((await importa(new TextEncoder().encode('a\tb'), 'dati.txt')).formato).toBe('csv');
  });
});
