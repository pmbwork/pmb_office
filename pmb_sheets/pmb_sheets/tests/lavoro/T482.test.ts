import { describe, it, expect } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { scriviOds, condizioneConvalida } from '../../src/formati/ods-scrivi';
import { leggiOds, condizioneDaOds } from '../../src/formati/ods-leggi';
import { avvisiEsportazione, esporta, importa } from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { DocumentStore } from '../../src/sheet/document-store';
import type { DataValidationRule } from '../../src/sheet/data-validation';

const testo = (b: Uint8Array) => new TextDecoder().decode(b);
const foglio = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });
async function giro(s: Scambio) { return leggiOds(await scriviOds(s)); }
async function contenuto(s: Scambio): Promise<string> { return testo((await leggiZip(await scriviOds(s))).get('content.xml')!); }

describe('T482: righe e colonne nascoste nel file OpenDocument', () => {
  const s = (): Scambio => ({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: 'x', C3: '5' }, righeNascoste: [2, 5, 6], colonneNascoste: [2, 4] })] });
  it('si scrivono con la visibilità "collapse"', async () => {
    const x = await contenuto(s());
    expect(x).toContain('table:visibility="collapse"');
  });
  it('si rileggono uguali, anche senza celle dentro', async () => {
    const r = await giro(s());
    expect(r.scambio.fogli[0].righeNascoste).toEqual([2, 5, 6]);
    expect(r.scambio.fogli[0].colonneNascoste).toEqual([2, 4]);
    expect(r.avvisi).toEqual([]);
  });
  it('un file senza righe nascoste non ha il campo', async () => {
    const r = await giro({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: 'x' } })] });
    expect(r.scambio.fogli[0].righeNascoste).toBeUndefined();
    expect(r.scambio.fogli[0].colonneNascoste).toBeUndefined();
  });
});

describe('T482: commenti', () => {
  const s = (): Scambio => ({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { B2: '10' }, commenti: [
    { riga: 2, colonna: 2, testo: 'Prezzo da controllare\nsecondo riga', autore: 'Anna' },
    { riga: 5, colonna: 3, testo: 'Cella vuota con nota <&>' },
  ] })] });
  it('si scrivono come annotazioni, prima del testo della cella', async () => {
    const x = await contenuto(s());
    expect(x).toContain('<office:annotation><dc:creator>Anna</dc:creator><text:p>Prezzo da controllare</text:p><text:p>secondo riga</text:p></office:annotation>');
    expect(x.indexOf('<office:annotation>')).toBeLessThan(x.indexOf('<text:p>10</text:p>'));
    expect(x).toContain('Cella vuota con nota &lt;&amp;&gt;');
  });
  it('si rileggono uguali, anche su celle vuote', async () => {
    const r = await giro(s());
    const c = r.scambio.fogli[0].commenti!;
    expect(c).toContainEqual({ riga: 2, colonna: 2, testo: 'Prezzo da controllare\nsecondo riga', autore: 'Anna' });
    expect(c).toContainEqual({ riga: 5, colonna: 3, testo: 'Cella vuota con nota <&>' });
    expect(r.scambio.fogli[0].celle.B2).toBe('10');
  });
});

describe('T482: nomi definiti', () => {
  const s = (): Scambio => ({
    foglioAttivo: 'Vendite 1', fogli: [foglio('Vendite 1', { celle: { C2: '3', C3: '4', C4: '=SUM(Prezzi)' } }), foglio('Altro')],
    nomi: [{ nome: 'Prezzi', foglio: 'Vendite 1', riferimento: 'C2:C3' }, { nome: 'Cella', foglio: 'Altro', riferimento: 'B7' }],
  });
  it('si scrivono come intervalli con nome', async () => {
    const x = await contenuto(s());
    expect(x).toContain("<table:named-range table:name=\"Prezzi\" table:base-cell-address=\"$'Vendite 1'.$C$2\" table:cell-range-address=\"$'Vendite 1'.$C$2:.$C$3\"/>");
    expect(x).toContain('table:name="Cella" table:base-cell-address="$Altro.$B$7" table:cell-range-address="$Altro.$B$7"');
    expect(x.indexOf('<table:named-expressions>')).toBeGreaterThan(x.lastIndexOf('</table:table>'));
  });
  it('si rileggono uguali', async () => {
    const r = await giro(s());
    expect(r.scambio.nomi).toEqual([{ nome: 'Prezzi', foglio: 'Vendite 1', riferimento: 'C2:C3' }, { nome: 'Cella', foglio: 'Altro', riferimento: 'B7' }]);
    expect(r.avvisi).toEqual([]);
  });
  it('quelli che non sono un intervallo semplice si contano negli avvisi', async () => {
    const bytes = await scriviOds(s());
    const voci = await leggiZip(bytes);
    const xml = testo(voci.get('content.xml')!).replace('</table:named-expressions>', '<table:named-expression table:name="Tasse" table:expression="of:=0.22"/></table:named-expressions>');
    const { scriviZip } = await import('@comune/formati/zip');
    const nuovo = await scriviZip([...voci].map(([nome, dati]) => ({ nome, dati: nome === 'content.xml' ? new TextEncoder().encode(xml) : dati, senzaCompressione: nome === 'mimetype' })));
    const r = await leggiOds(nuovo);
    expect(r.avvisi).toEqual(['Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).']);
    expect(r.scambio.nomi).toHaveLength(2);
  });
});

describe('T482: convalide dei dati', () => {
  const regola = (r: Partial<DataValidationRule>): DataValidationRule => ({ id: 'x', action: 'reject', type: 'number', ...r } as DataValidationRule);
  it.each<[string, Partial<DataValidationRule>, string]>([
    ['elenco', { type: 'list', listItems: ['Mela', 'Pera "verde"'] }, 'of:cell-content-is-in-list("Mela";"Pera ""verde""")'],
    ['elenco da intervallo', { type: 'list', value1: 'A1:A5' }, 'of:cell-content-is-in-list([.A1:.A5])'],
    ['numero tra', { type: 'number', operator: 'between', value1: 0, value2: 100 }, 'of:cell-content-is-decimal-number() and of:cell-content-is-between(0;100)'],
    ['numero maggiore', { type: 'number', operator: 'greater_than', value1: 5 }, 'of:cell-content-is-decimal-number() and of:cell-content()>5'],
    ['numero diverso', { type: 'number', operator: 'not_equal_to', value1: 3 }, 'of:cell-content-is-decimal-number() and of:cell-content()!=3'],
    ['data', { type: 'date', operator: 'greater_equal', value1: 46000 }, 'of:cell-content-is-date() and of:cell-content()>=46000'],
    ['lunghezza', { type: 'text_length', operator: 'less_equal', value1: 10 }, 'of:cell-content-text-length()<=10'],
    ['lunghezza tra', { type: 'text_length', operator: 'not_between', value1: 2, value2: 4 }, 'of:cell-content-text-length-is-not-between(2;4)'],
    ['formula', { type: 'custom', value1: '=ISNUMBER(A1)' }, 'of:is-true-formula(ISNUMBER([.A1]))'],
    ['casella', { type: 'checkbox' }, 'of:cell-content-is-in-list("TRUE";"FALSE")'],
  ])('%s: condizione scritta e riletta', (_nome, r, attesa) => {
    expect(condizioneConvalida(regola(r))).toBe(attesa);
    const letta = condizioneDaOds(attesa)!;
    expect(letta).toBeTruthy();
    expect(letta.type).toBe(r.type === 'checkbox' ? 'list' : r.type);
    if (r.operator) expect(letta.operator).toBe(r.operator);
  });

  it('una regola senza valori non si scrive', () => {
    expect(condizioneConvalida(regola({ type: 'number', operator: 'between', value1: 1 }))).toBeNull();
    expect(condizioneConvalida(regola({ type: 'list' }))).toBeNull();
    expect(condizioneConvalida(regola({ type: 'custom', value1: ' ' }))).toBeNull();
  });

  it('la lettura accetta anche la virgola come separatore e il prefisso mancante', () => {
    expect(condizioneDaOds('cell-content-is-between(1,10)')).toBeNull(); // da sola non dice il tipo: non si inventa
    expect(condizioneDaOds('cell-content-is-whole-number() and cell-content-is-between(1,10)')).toMatchObject({ type: 'number', operator: 'between', value1: 1, value2: 10 });
    expect(condizioneDaOds('of:cell-content-is-in-list("a","b")')).toMatchObject({ type: 'list', listItems: ['a', 'b'] });
    expect(condizioneDaOds('qualcosa di strano')).toBeNull();
  });

  const s = (): Scambio => ({ foglioAttivo: 'F', fogli: [foglio('F', {
    celle: { B2: 'Mela', D2: '5' },
    convalide: [
      { intervallo: { startRow: 2, endRow: 4, startCol: 2, endCol: 2 }, regola: regola({ type: 'list', listItems: ['Mela', 'Pera'], action: 'reject' }) },
      { intervallo: { startRow: 2, endRow: 3, startCol: 4, endCol: 4 }, regola: regola({ type: 'number', operator: 'between', value1: 0, value2: 100, action: 'warn', helpText: 'da 0 a 100', allowEmpty: false }) },
    ],
  })] });

  it('nel file: una voce per regola diversa e il nome su ogni cella', async () => {
    const x = await contenuto(s());
    expect(x.match(/<table:content-validation /g)).toHaveLength(2);
    expect(x.match(/table:content-validation-name="val1"/g)).toHaveLength(3);
    expect(x.match(/table:content-validation-name="val2"/g)).toHaveLength(2);
    expect(x).toContain('table:allow-empty-cell="false"');
    expect(x).toContain('table:message-type="warning"');
    expect(x).toContain('<table:help-message table:display="true"><text:p>da 0 a 100</text:p></table:help-message>');
    expect(x.indexOf('<table:content-validations>')).toBeLessThan(x.indexOf('<table:table '));
  });

  it('si rileggono uguali, cella per cella', async () => {
    const r = await giro(s());
    const v = r.scambio.fogli[0].convalide!;
    expect(v).toHaveLength(5);
    const lista = v.filter((x) => x.regola.type === 'list');
    expect(lista.map((x) => x.intervallo.startRow).sort()).toEqual([2, 3, 4]);
    expect(lista[0].regola).toMatchObject({ listItems: ['Mela', 'Pera'], action: 'reject' });
    const numero = v.find((x) => x.regola.type === 'number')!;
    expect(numero.regola).toMatchObject({ operator: 'between', value1: 0, value2: 100, action: 'warn', helpText: 'da 0 a 100', allowEmpty: false });
    expect(r.avvisi).toEqual([]);
  });

  it('una convalide con una condizione sconosciuta si conta negli avvisi', async () => {
    const voci = await leggiZip(await scriviOds(s()));
    const xml = testo(voci.get('content.xml')!).replace('of:cell-content-is-in-list(&quot;Mela&quot;;&quot;Pera&quot;)', 'of:strano()');
    const { scriviZip } = await import('@comune/formati/zip');
    const r = await leggiOds(await scriviZip([...voci].map(([nome, dati]) => ({ nome, dati: nome === 'content.xml' ? new TextEncoder().encode(xml) : dati, senzaCompressione: nome === 'mimetype' }))));
    expect(r.avvisi).toEqual(['Una convalida dei dati del file non è stata importata (la sua condizione non è tra quelle supportate).']);
    expect(r.scambio.fogli[0].convalide!.every((x) => x.regola.type === 'number')).toBe(true);
  });
});

describe('T482: nel documento, dall\'esportazione all\'apertura', () => {
  it('commenti, convalide, nomi e righe nascoste fanno il giro completo', async () => {
    const origine = documentoDaScambio({
      foglioAttivo: 'F',
      fogli: [foglio('F', {
        celle: { A1: 'a', A2: '3', C4: '=SUM(Prezzi)' }, righeNascoste: [3], colonneNascoste: [5],
        commenti: [{ riga: 1, colonna: 1, testo: 'nota' }],
        convalide: [{ intervallo: { startRow: 2, endRow: 2, startCol: 1, endCol: 1 }, regola: { id: '', type: 'number', operator: 'greater_than', value1: 0, action: 'reject' } }],
      })],
      nomi: [{ nome: 'Prezzi', foglio: 'F', riferimento: 'A2:A2' }],
    });
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t');
    await applicaDati(doc, origine);
    const bytes = await esporta(await estraiDati(doc), 'ods');
    const aperto = await importa(bytes, 'prova.ods');
    expect(aperto.formato).toBe('ods');
    expect(aperto.avvisi).toEqual([]);
    expect(aperto.dati.hiddenRows).toEqual([3]);
    expect(aperto.dati.hiddenCols).toEqual([5]);
    expect(aperto.dati.comments).toHaveLength(1);
    expect(aperto.dati.comments![0]).toMatchObject({ testo: 'nota' });
    expect(Object.keys(aperto.dati.dataValidations ?? {})).toEqual(['2:1']);
    expect(aperto.dati.namedRanges?.map((n) => n.name)).toEqual(['Prezzi']);
  });

  it('gli avvisi di esportazione in OpenDocument elencano solo le formattazioni condizionali', async () => {
    const origine = documentoDaScambio({
      foglioAttivo: 'F',
      fogli: [foglio('F', {
        celle: { A1: 'a' }, righeNascoste: [3], commenti: [{ riga: 1, colonna: 1, testo: 'nota' }],
        condizionali: [{ id: 'c', type: 'cell_value', range: { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, operator: 'greater_than', value1: 1, style: { bold: true } }],
      })],
      nomi: [{ nome: 'N', foglio: 'F', riferimento: 'A1' }],
    });
    const testoAvvisi = avvisiEsportazione(origine, 'ods').join(' ');
    expect(testoAvvisi).toContain('le formattazioni condizionali');
    for (const parola of ['commenti', 'convalide', 'intervalli denominati', 'righe e colonne nascoste']) expect(testoAvvisi).not.toContain(parola);
    // gli altri formati continuano ad avvisare di tutto
    const csv = avvisiEsportazione(origine, 'csv').join(' ');
    for (const parola of ['commenti', 'formattazioni condizionali', 'intervalli denominati', 'righe e colonne nascoste']) expect(csv).toContain(parola);
  });
});
