// T566: stampa unione. Elenco di Excel (.xlsx) e la sua conversione di LibreOffice (.ods), modello di Word con i campi MERGEFIELD e la
// sua conversione di LibreOffice (.odt, text:database-display); file in tests/file-prova/unione/ (LAVORO/studio-microsoft-office/office_stampa_unione.py).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, inserisciCampoUnione, testoDi, type Documento } from '../../src/modello/documento';
import { campiMancanti, campiUsati, conCampiComeTesto, documentoUnito } from '../../src/modello/unione';
import { leggiElenco } from '@comune/formati/elenco-dati';

const CARTELLA = 'tests/file-prova/unione';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const ATTESO = { colonne: ['Nome', 'Città', 'Importo', 'Data'], righe: [['Anna Rossi', 'Milano', '1234,5', '15/01/2026'], ['Bruno Verdi', 'Roma', '10', '01/02/2026'], ['Carla Neri', 'Torino', '0,25', '31/12/2025']] };

describe('T566: elenco della stampa unione', () => {
  test('.xlsx di Excel e .ods di LibreOffice: nomi delle colonne, numeri con la virgola e date come gg/mm/aaaa', async () => {
    expect(await leggiElenco(leggi('elenco_excel.xlsx'), 'e.xlsx')).toEqual(ATTESO);
    expect(await leggiElenco(leggi('elenco_libreoffice.ods'), 'e.ods')).toEqual(ATTESO);
  });
  test('.csv con il punto e virgola; colonne senza nome; in inglese il punto decimale', async () => {
    const csv = new TextEncoder().encode('Nome;;Cognome\r\nAnna;x;Rossi\r\n\r\n');
    expect(await leggiElenco(csv, 'e.csv')).toEqual({ colonne: ['Nome', 'Colonna 2', 'Cognome'], righe: [['Anna', 'x', 'Rossi']] });
    expect((await leggiElenco(leggi('elenco_excel.xlsx'), 'e.xlsx', false)).righe[0][2]).toBe('1234.5');
  });
});

describe('T566: campi e documento unito', () => {
  test('i campi del modello di Word (.docx) e di LibreOffice (.odt)', async () => {
    for (const n of ['modello_word.docx', 'modello_libreoffice.odt']) {
      const d = (await importa(leggi(n), n)).doc;
      expect(campiUsati(d), n).toEqual(['Nome', 'Città']);
      expect(testoDi(conCampiComeTesto(d)), n).toBe('Gentile «Nome», di «Città»');
    }
  });
  test('scritti da pmb_docs in .docx, .odt e .pdoc si rileggono', async () => {
    const d = (await importa(leggi('modello_word.docx'), 'm.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/modello_pmb.docx`, x);
    expect(campiUsati((await importa(x, 'm.docx')).doc)).toEqual(['Nome', 'Città']);
    expect(campiUsati((await importa(await esporta(d, 'odt'), 'm.odt')).doc)).toEqual(['Nome', 'Città']);
    expect(campiUsati(deserializza(serializza(d)))).toEqual(['Nome', 'Città']);
    expect(new TextDecoder().decode(await esporta(d, 'txt'))).toBe('Gentile «Nome», di «Città»');
  });
  test('il documento unito: una copia per riga, salto di pagina tra le copie, campi sostituiti; campi mancanti vuoti', async () => {
    const d = (await importa(leggi('modello_word.docx'), 'm.docx')).doc;
    const e = await leggiElenco(leggi('elenco_excel.xlsx'), 'e.xlsx');
    const u = documentoUnito(d, e);
    expect(u.paragrafi.map((p) => p.runs.map((r) => r.t).join(''))).toEqual(['Gentile Anna Rossi, di Milano', 'Gentile Bruno Verdi, di Roma', 'Gentile Carla Neri, di Torino']);
    expect(u.paragrafi.map((p) => p.sp === true)).toEqual([false, true, true]);
    expect(campiUsati(u)).toEqual([]);
    const conAltro: Documento = inserisciCampoUnione({ doc: d, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }, 'Titolo').doc;
    expect(campiMancanti(conAltro, e)).toEqual(['Titolo']);
    expect(documentoUnito(conAltro, e).paragrafi[0].runs.map((r) => r.t).join('')).toBe('Gentile Anna Rossi, di Milano');
  });
});
