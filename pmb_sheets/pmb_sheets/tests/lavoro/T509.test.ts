import { describe, it, expect } from 'vitest';
import { avvisiEsportazione, esporta, importa } from '../../src/formati/file';
import { foglioVuoto, documentoDaScambio, scambioDaDocumento } from '../../src/formati/scambio';
import { FORMATI_PREIMPOSTATI_ELENCO } from '../../src/sheet/formati-preimpostati';
import { formatCellValue } from '../../src/sheet/number-format';

// i formati nuovi devono sopravvivere al salvataggio e alla riapertura nei tre formati che li conservano
const CODICI = [...FORMATI_PREIMPOSTATI_ELENCO.map((f) => f.codice), '[>=100]"alto";"basso"', '#,##0.00;[Red]-#,##0.00;"zero"'];

function documento() {
  const f = foglioVuoto('Foglio1');
  CODICI.forEach((codice, i) => {
    f.celle[`A${i + 1}`] = '1234.5';
    f.stili[`A${i + 1}`] = { numFmt: codice } as never;
  });
  return documentoDaScambio({ fogli: [f], foglioAttivo: 'Foglio1' });
}

const formatiDi = async (bytes: Uint8Array, nome: string): Promise<Array<string | undefined>> => {
  const s = scambioDaDocumento((await importa(bytes, nome)).dati).fogli[0];
  return CODICI.map((_, i) => (s.stili[`A${i + 1}`] as { numFmt?: string } | undefined)?.numFmt);
};

describe('T509: i formati numerici nuovi nei file', () => {
  it('.psheet conserva ogni codice identico', async () => {
    expect(await formatiDi(await esporta(documento(), 'fsheet'), 'x.psheet')).toEqual(CODICI);
  });

  it('.xlsx conserva ogni codice (anche se scritto in modo equivalente) e il testo che ne esce non cambia', async () => {
    const letti = await formatiDi(await esporta(documento(), 'xlsx'), 'x.xlsx');
    CODICI.forEach((codice, i) => {
      expect(letti[i], codice).toBeDefined();
      expect(formatCellValue({ kind: 'number', value: 1234.5 }, letti[i]), codice).toBe(formatCellValue({ kind: 'number', value: 1234.5 }, codice));
      expect(formatCellValue({ kind: 'number', value: -1234.5 }, letti[i]), codice).toBe(formatCellValue({ kind: 'number', value: -1234.5 }, codice));
      expect(formatCellValue({ kind: 'number', value: 0 }, letti[i]), codice).toBe(formatCellValue({ kind: 'number', value: 0 }, codice));
    });
  });

  it('.ods: i formati che conserva danno lo stesso testo; gli altri cadono in modo dichiarato', async () => {
    const letti = await formatiDi(await esporta(documento(), 'ods'), 'x.ods');
    const persi: string[] = [];
    CODICI.forEach((codice, i) => {
      const a = formatCellValue({ kind: 'number', value: 1234.5 }, letti[i]);
      const b = formatCellValue({ kind: 'number', value: 1234.5 }, codice);
      if (a !== b) persi.push(codice);
    });
    // nessuna perdita silenziosa: ogni formato che l'.ods non porta uguale è nominato nell'avviso di esportazione
    const avvisi = avvisiEsportazione(documento(), 'ods');
    for (const codice of persi) expect(avvisi.some((a) => a.includes(`«${codice}»`)), `senza avviso: ${codice}`).toBe(true);
    // e quelli che porta li porta davvero: i semplici (valuta arrotondata, data estesa) non cambiano
    expect(persi).not.toContain('€#,##0');
    expect(persi).not.toContain('dddd d mmmm yyyy');
  });
});
