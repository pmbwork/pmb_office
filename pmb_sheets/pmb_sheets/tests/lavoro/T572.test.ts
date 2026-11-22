// T572: file di Excel con controlli modulo e macro (segnalazione del 2026-11-22: un registro di adeguata verifica .xlsm aperto con
// pmb_sheets non mostrava tendine, pulsanti e link, che Excel e LibreOffice mostrano). Dal 0.2.16:
// - le caselle combinate diventano tendine della cella che coprono, con la voce scelta scritta nella cella;
// - i pulsanti restano, con la macro tradotta in azioni sicure (vai a un foglio, seleziona una cella, apri il link della cella);
//   una macro con altre istruzioni non si esegue e il pulsante dice perché;
// - i link a file accanto al foglio si importano (si aprono dopo una conferma); mai percorsi di rete, programmi o script.
// Il file .xlsm si costruisce qui (progetto VBA compreso), così la prova non usa file di altri.
import { describe, expect, test } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { MODULO, VML, progettoVba, xlsmDiProva } from './aiuti-xlsm';
import { decomprimiVba, leggiMacro, leggiModuliVba, macroDelModulo, nomeMacro } from '../../src/formati/vba';
import { formeVml, leggiIntervallo } from '../../src/formati/xlsx-controlli';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { documentoDaScambio, scambioDaDocumento } from '../../src/formati/scambio';
import { deserializeSheetDocumentData, serializeSheetDocumentData } from '../../src/sheet/document-data';
import { estensioneVietata, linkLocaleAmmesso, linkLocaleDaExcel, targetExcelDiLinkLocale } from '../../src/sheet/link';
import { pulsantiDaDati } from '../../src/sheet/pulsanti';

describe('T572: controlli modulo, macro e link locali dei file di Excel', () => {
  test('decompressione [MS-OVBA]: esempio della specifica senza compressione e un segno di copia', () => {
    const esempio = Uint8Array.from([0x01, 0x19, 0xb0, 0x00, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x00, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x00, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x2e]);
    expect(new TextDecoder().decode(decomprimiVba(esempio))).toBe('abcdefghijklmnopqrstuv.');
    // «abc» poi una copia di 6 byte da 3 indietro: segno 0x2003 (4 bit di scostamento, 12 di lunghezza)
    expect(new TextDecoder().decode(decomprimiVba(Uint8Array.from([0x01, 0x05, 0xb0, 0x08, 0x61, 0x62, 0x63, 0x03, 0x20])))).toBe('abcabcabc');
    expect(() => decomprimiVba(Uint8Array.from([0x02, 0x00]))).toThrow();
  });

  test('progetto VBA: moduli letti dal flusso dir (anche con la misura «sbagliata» di PROJECTVERSION)', () => {
    const moduli = leggiModuliVba(progettoVba({ Modulo1: MODULO, Foglio1: 'Private Sub Worksheet_Change(ByVal Target As Range)\r\nEnd Sub' }));
    expect([...moduli.keys()]).toEqual(['Modulo1', 'Foglio1']);
    expect(moduli.get('Modulo1')).toBe(MODULO);
  });

  test('macro: solo azioni sicure; continuazioni di riga e commenti; altro → non eseguibile con il motivo', () => {
    const m = macroDelModulo(MODULO);
    expect(m.map((x) => x.nome)).toEqual(['apriScheda', 'vaiDati', 'cartella', 'pericolosa']);
    expect(m[0]!.azioni).toEqual([{ tipo: 'cella', indirizzo: 'N1' }, { tipo: 'link' }]);
    expect(m[1]!.azioni).toEqual([{ tipo: 'foglio', nome: 'dati' }]);
    expect(m[2]!.azioni).toEqual([{ tipo: 'cella', indirizzo: 'N4' }, { tipo: 'link' }]);
    expect(m[3]!.azioni).toBeNull();
    expect(m[3]!.motivo).toContain('Shell');
    expect(macroDelModulo('Sub vuota()\nEnd Sub')[0]!.azioni).toEqual([]);
    expect(macroDelModulo('Sub a()\n  Range("A1:B2").Select\nEnd Sub')[0]!.azioni).toBeNull(); // un intervallo, non una cella
    expect([nomeMacro('[0]!schedasocieta'), nomeMacro('Modulo10.vai'), nomeMacro("'file.xlsm'!m")]).toEqual(['schedasocieta', 'vai', 'm']);
    expect(leggiMacro(progettoVba({ Modulo1: MODULO })).get('aprischeda')?.nome).toBe('apriScheda');
  });

  test('VML: testo, macro e aspetto dei pulsanti; intervalli degli elenchi', () => {
    const f = formeVml(VML);
    expect(f.get(1026)).toMatchObject({ testo: "SOCIETA'", macro: '[0]!apriScheda', tipo: 'Button', stile: { colore: '#FF0000', grassetto: true, dimensione: 22 } });
    expect(f.get(1027)).toMatchObject({ testo: 'Pulisci\ntutto', stile: { verticale: true, dimensione: 11 } });
    expect(leggiIntervallo('dati!$A$1:$A$12', 'x')).toEqual({ foglio: 'dati', da: { riga: 1, colonna: 1 }, a: { riga: 12, colonna: 1 } });
    expect(leggiIntervallo("'Elenco documenti'!B2", 'x')?.foglio).toBe('Elenco documenti');
    expect(leggiIntervallo('$C$3:$C$5', 'riepilogo')?.foglio).toBe('riepilogo');
    expect(leggiIntervallo('#REF!', 'x')).toBeNull();
  });

  test('link locali: relativi e assoluti sì; rete, programmi, script, flussi nascosti no', () => {
    expect(linkLocaleDaExcel("MODULI\\1%20Scheda%20SOCIETA'.docx")).toBe("file:MODULI/1 Scheda SOCIETA'.docx");
    expect(linkLocaleDaExcel('CLIENTI')).toBe('file:CLIENTI');
    expect(linkLocaleDaExcel('file:///C:/Documenti/a.pdf')).toBe('file:C:/Documenti/a.pdf');
    for (const no of ['\\\\server\\x.docx', 'file://server/x.docx', 'strumenti\\avvia.exe', 'a.docm', 'b.ps1', 'c.lnk', 'a.txt:nascosto', 'https://esempio.it', 'C:relativo.docx']) expect(linkLocaleDaExcel(no)).toBeNull();
    expect(linkLocaleAmmesso('file:../su/a.docx')).toBe(true);
    expect(estensioneVietata('Setup.EXE ')).toBe(true);
    expect(targetExcelDiLinkLocale("file:MODULI/1 Scheda SOCIETA'.docx")).toBe("MODULI\\1%20Scheda%20SOCIETA'.docx");
  });

  test('il file intero: tendina con la voce scelta, pulsanti con le azioni, link locale; avvisi chiari', async () => {
    const { scambio, avvisi } = await leggiXlsx(await xlsmDiProva());
    const f = scambio.fogli.find((x) => x.nome === 'riepilogo')!;
    expect(f.celle.I10).toBe('patente'); // sel=3 → terza voce di dati!A1:A4 (A1 è vuota)
    expect(f.convalide?.find((c) => c.intervallo.startRow === 10 && c.intervallo.startCol === 9)?.regola).toMatchObject({ type: 'list', listRange: 'dati!$A$1:$A$4' });
    expect(f.pulsanti?.map((p) => p.testo)).toEqual(["SOCIETA'", 'Pulisci\ntutto', 'DATI', 'cartella']);
    expect(f.pulsanti?.[0]).toMatchObject({ macro: 'apriScheda', azioni: [{ tipo: 'cella', indirizzo: 'N1' }, { tipo: 'link' }], stile: { colore: '#FF0000' } });
    expect(f.pulsanti?.[1]?.azioni).toBeUndefined();
    expect(f.pulsanti?.[1]?.motivo).toContain('Shell');
    expect(f.stili.N1?.link).toBe("file:MODULI/1 Scheda SOCIETA'.docx");
    expect(f.stili.N2?.link).toBeUndefined(); // percorso di rete
    expect(f.stili.N3?.link).toBeUndefined(); // programma
    expect(f.stili.N4?.link).toBe('file:CLIENTI_PROVA');
    const tutti = avvisi.join(' | ');
    expect(tutti).toContain('Una casella combinata del file è diventata la tendina');
    expect(tutti).toContain('4 pulsanti con macro; uno ha una macro che pmb_sheets non può eseguire');
    expect(tutti).toContain('2 controlli del file non sono stati importati');
    expect(tutti).toContain('collegamenti'); // rete e programma scartati
  });

  test('pulsanti nel documento e nel file .psheet; il link locale si risalva in .xlsx come lo scrive Excel', async () => {
    const { scambio } = await leggiXlsx(await xlsmDiProva());
    const dati = documentoDaScambio(scambio);
    expect(dati.buttons?.length).toBe(4);
    expect(dati.buttons?.[0]).toMatchObject({ sheetName: 'riepilogo', testo: "SOCIETA'" });
    const riletto = deserializeSheetDocumentData(serializeSheetDocumentData(dati));
    expect(riletto.buttons?.map((p) => p.azioni ?? null)).toEqual([[{ tipo: 'cella', indirizzo: 'N1' }, { tipo: 'link' }], null, [{ tipo: 'foglio', nome: 'dati' }], [{ tipo: 'cella', indirizzo: 'N4' }, { tipo: 'link' }]]);
    expect(pulsantiDaDati([{ sheetName: 'x', x: 1, y: 1, width: 10, height: 10, azioni: [{ tipo: 'shell', comando: 'rm' }] }])[0]!.azioni).toBeUndefined();
    const xlsx = await scriviXlsx(scambioDaDocumento(dati));
    const rel = new TextDecoder().decode((await leggiZip(xlsx)).get('xl/worksheets/_rels/sheet1.xml.rels')!);
    expect(rel).toContain("Target=\"MODULI\\1%20Scheda%20SOCIETA'.docx\"");
  });
});
