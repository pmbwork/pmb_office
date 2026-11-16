// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  leggiIntervallo, scriviIntervallo, creaRegolaCondizionale, creaRegolaConvalida, CONDIZIONI, TIPI_CONVALIDA, OPERATORI_CONVALIDA, CELLE_MASSIME_CONVALIDA,
  type DatiCondizionale, type DatiConvalida,
} from '../../src/sheet/regole-dialogo';
import { evaluateConditionalFormats } from '../../src/sheet/conditional-format';
import { validateCellValue } from '../../src/sheet/data-validation';

describe('T325: intervalli scritti a mano', () => {
  it.each([
    ['A1:B5', { startRow: 1, endRow: 5, startCol: 1, endCol: 2 }],
    ['b2', { startRow: 2, endRow: 2, startCol: 2, endCol: 2 }],
    ['  C3:C10 ', { startRow: 3, endRow: 10, startCol: 3, endCol: 3 }],
    ['B5:A1', { startRow: 1, endRow: 5, startCol: 1, endCol: 2 }],
    ['AA10', { startRow: 10, endRow: 10, startCol: 27, endCol: 27 }],
  ])('%j si legge come intervallo', (testo, atteso) => {
    expect(leggiIntervallo(testo)).toEqual(atteso);
  });

  it.each(['', '   ', 'ciao', 'A', '1', 'A1:', ':B2', 'A1:B', 'Foglio2!A1:B2', 'A0', 'XFE1', 'A1:B2:C3'])('%j non è un intervallo', (testo) => {
    expect(leggiIntervallo(testo)).toBeNull();
  });

  it('si riscrive come si scrive: una cella sola senza i due punti', () => {
    expect(scriviIntervallo({ startRow: 2, endRow: 2, startCol: 2, endCol: 2 })).toBe('B2');
    expect(scriviIntervallo({ startRow: 1, endRow: 5, startCol: 1, endCol: 2 })).toBe('A1:B5');
    expect(scriviIntervallo({ startRow: 10, endRow: 20, startCol: 27, endCol: 28 })).toBe('AA10:AB20');
  });

  it('andata e ritorno', () => {
    for (const t of ['A1', 'A1:B5', 'AA10:AB20', 'Z100:Z200']) expect(scriviIntervallo(leggiIntervallo(t)!)).toBe(t);
  });
});

const cond = (extra: Partial<DatiCondizionale> = {}): DatiCondizionale => ({
  intervallo: 'A1:A10', condizione: 'maggiore', valore1: '5', valore2: '', sfondo: '#ffff00', testo: '', grassetto: false, ...extra,
});
const ok = <T,>(e: { ok: true; valore: T } | { ok: false; errore: string }): T => { if (!e.ok) throw new Error(e.errore); return e.valore; };
const err = (e: { ok: boolean; errore?: string }): string => { if (e.ok) throw new Error('doveva dare errore'); return e.errore ?? ''; };

describe('T325: regola di formattazione condizionale', () => {
  it('la lista delle condizioni ha 19 voci (13 condizioni, la formula e 5 stili grafici) con il numero di valori giusto', () => {
    expect(CONDIZIONI).toHaveLength(19);
    expect(CONDIZIONI.filter((c) => c.valori === 0).map((c) => c.id)).toEqual(['vuota', 'non-vuota', 'scala-2', 'scala-3', 'barre', 'frecce', 'semafori']);
    expect(CONDIZIONI.filter((c) => c.valori === 2).map((c) => c.id)).toEqual(['tra']);
  });

  it('maggiore di 5 con sfondo giallo: tipo valore di cella, operatore, numeri e stile', () => {
    const r = ok(creaRegolaCondizionale(cond(), 'r1'));
    expect(r).toEqual({ id: 'r1', type: 'cell_value', range: { startRow: 1, endRow: 10, startCol: 1, endCol: 1 }, operator: 'greater_than', value1: 5, style: { backgroundColor: '#ffff00' } });
  });

  it.each([
    ['maggiore', 'greater_than'], ['maggiore-uguale', 'greater_equal'], ['minore', 'less_than'], ['minore-uguale', 'less_equal'], ['uguale', 'equal_to'], ['diverso', 'not_equal_to'],
  ] as const)('la condizione %s diventa %s', (condizione, operatore) => {
    expect(ok(creaRegolaCondizionale(cond({ condizione }), 'r')).operator).toBe(operatore);
  });

  it('tra: due valori, il primo non maggiore del secondo', () => {
    const r = ok(creaRegolaCondizionale(cond({ condizione: 'tra', valore1: '2', valore2: '8' }), 'r'));
    expect([r.operator, r.value1, r.value2]).toEqual(['between', 2, 8]);
    expect(err(creaRegolaCondizionale(cond({ condizione: 'tra', valore1: '9', valore2: '8' }), 'r'))).toContain('minore o uguale');
    expect(err(creaRegolaCondizionale(cond({ condizione: 'tra', valore1: '2', valore2: '' }), 'r'))).toContain('secondo valore');
    expect(ok(creaRegolaCondizionale(cond({ condizione: 'tra', valore1: '4', valore2: '4' }), 'r')).value2).toBe(4);
  });

  it('i numeri si leggono anche con la virgola decimale', () => {
    expect(ok(creaRegolaCondizionale(cond({ valore1: '2,5' }), 'r')).value1).toBe(2.5);
    expect(err(creaRegolaCondizionale(cond({ valore1: 'abc' }), 'r'))).toContain('numero');
    expect(err(creaRegolaCondizionale(cond({ valore1: '' }), 'r'))).toContain('numero');
  });

  it.each([
    ['contiene', 'contains'], ['non-contiene', 'not_contains'], ['inizia', 'starts_with'], ['finisce', 'ends_with'],
  ] as const)('la condizione di testo %s diventa %s e il testo si pulisce dagli spazi', (condizione, operatore) => {
    const r = ok(creaRegolaCondizionale(cond({ condizione, valore1: '  ciao ' }), 'r'));
    expect([r.type, r.operator, r.value1]).toEqual(['text', operatore, 'ciao']);
    expect(err(creaRegolaCondizionale(cond({ condizione, valore1: '   ' }), 'r'))).toContain('testo');
  });

  it('vuota e non vuota non vogliono valori', () => {
    const v = ok(creaRegolaCondizionale(cond({ condizione: 'vuota', valore1: '' }), 'r'));
    expect([v.type, v.operator, v.value1]).toEqual(['text', 'empty', undefined]);
    expect(ok(creaRegolaCondizionale(cond({ condizione: 'non-vuota', valore1: '' }), 'r')).operator).toBe('not_empty');
  });

  it('lo stile: solo quello che è stato scelto', () => {
    expect(ok(creaRegolaCondizionale(cond({ sfondo: '', testo: '#ff0000' }), 'r')).style).toEqual({ textColor: '#ff0000' });
    expect(ok(creaRegolaCondizionale(cond({ sfondo: '', grassetto: true }), 'r')).style).toEqual({ bold: true });
    expect(ok(creaRegolaCondizionale(cond({ sfondo: '#00ff00', testo: '#000000', grassetto: true }), 'r')).style).toEqual({ backgroundColor: '#00ff00', textColor: '#000000', bold: true });
  });

  it('senza nessuno stile, con colori sbagliati o con intervallo sbagliato: errore', () => {
    expect(err(creaRegolaCondizionale(cond({ sfondo: '' }), 'r'))).toContain('almeno uno stile');
    expect(err(creaRegolaCondizionale(cond({ sfondo: 'giallo' }), 'r'))).toContain('sfondo');
    expect(err(creaRegolaCondizionale(cond({ sfondo: '', testo: '#fff' }), 'r'))).toContain('testo');
    expect(err(creaRegolaCondizionale(cond({ intervallo: 'pippo' }), 'r'))).toContain('Intervallo');
    expect(err(creaRegolaCondizionale(cond({ condizione: 'boh' as never }), 'r'))).toContain('condizione');
  });

  it('il motore applica la regola: maggiore di 5 colora il 7 e non il 3, solo dentro l\'intervallo', () => {
    const r = ok(creaRegolaCondizionale(cond({ intervallo: 'A1:A3' }), 'r'));
    expect(evaluateConditionalFormats('7', 1, 1, [r])).toEqual({ backgroundColor: '#ffff00' });
    expect(evaluateConditionalFormats('3', 1, 1, [r])).toBeNull();
    expect(evaluateConditionalFormats('7', 4, 1, [r])).toBeNull();
    expect(evaluateConditionalFormats('7', 1, 2, [r])).toBeNull();
  });

  it('il motore applica anche le regole di testo e di vuoto', () => {
    const c = ok(creaRegolaCondizionale(cond({ condizione: 'contiene', valore1: 'ok', sfondo: '', grassetto: true }), 'r'));
    expect(evaluateConditionalFormats('tutto OK', 1, 1, [c])).toEqual({ bold: true });
    expect(evaluateConditionalFormats('no', 1, 1, [c])).toBeNull();
    const v = ok(creaRegolaCondizionale(cond({ condizione: 'vuota', valore1: '' }), 'r'));
    expect(evaluateConditionalFormats('', 1, 1, [v])).toEqual({ backgroundColor: '#ffff00' });
    expect(evaluateConditionalFormats('x', 1, 1, [v])).toBeNull();
  });
});

const conv = (extra: Partial<DatiConvalida> = {}): DatiConvalida => ({
  intervallo: 'B2:B4', tipo: 'elenco', voci: 'rosso, verde , blu', operatore: 'between', valore1: '', valore2: '', azione: 'rifiuta', messaggio: '', ammettiVuote: true, ...extra,
});

describe('T325: regola di convalida dei dati', () => {
  it('i tipi e gli operatori disponibili', () => {
    expect(TIPI_CONVALIDA.map((t) => t.id)).toEqual(['elenco', 'numero', 'lunghezza', 'casella']);
    expect(OPERATORI_CONVALIDA).toHaveLength(8);
    expect(OPERATORI_CONVALIDA.filter((o) => o.valori === 2).map((o) => o.id)).toEqual(['between', 'not_between']);
  });

  it('elenco: le voci si puliscono e si dice dove vale la regola', () => {
    const p = ok(creaRegolaConvalida(conv(), 'v1'));
    expect(p.intervallo).toEqual({ startRow: 2, endRow: 4, startCol: 2, endCol: 2 });
    expect(p.regola).toEqual({ id: 'v1', type: 'list', action: 'reject', allowEmpty: true, listItems: ['rosso', 'verde', 'blu'] });
    expect(err(creaRegolaConvalida(conv({ voci: ' , ,' }), 'v'))).toContain('voce');
  });

  it('numero: operatore e valori, con la virgola decimale', () => {
    const p = ok(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'between', valore1: '1,5', valore2: '10' }), 'v'));
    expect([p.regola.type, p.regola.operator, p.regola.value1, p.regola.value2]).toEqual(['number', 'between', 1.5, 10]);
    const q = ok(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'greater_than', valore1: '0' }), 'v'));
    expect([q.regola.operator, q.regola.value1, q.regola.value2]).toEqual(['greater_than', 0, undefined]);
    expect(err(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'between', valore1: '5', valore2: '' }), 'v'))).toContain('secondo valore');
    expect(err(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'not_between', valore1: '9', valore2: '1' }), 'v'))).toContain('minore o uguale');
    expect(err(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'equal_to', valore1: 'x' }), 'v'))).toContain('numero');
    expect(err(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'boh' as never, valore1: '1' }), 'v'))).toContain('condizione');
  });

  it('lunghezza del testo e casella di controllo', () => {
    const l = ok(creaRegolaConvalida(conv({ tipo: 'lunghezza', operatore: 'less_equal', valore1: '10' }), 'v'));
    expect([l.regola.type, l.regola.operator, l.regola.value1]).toEqual(['text_length', 'less_equal', 10]);
    const c = ok(creaRegolaConvalida(conv({ tipo: 'casella' }), 'v'));
    expect(c.regola).toEqual({ id: 'v', type: 'checkbox', action: 'reject', allowEmpty: true });
  });

  it('azione, messaggio e celle vuote', () => {
    const p = ok(creaRegolaConvalida(conv({ azione: 'avvisa', messaggio: '  Scegli un colore  ', ammettiVuote: false }), 'v'));
    expect([p.regola.action, p.regola.helpText, p.regola.allowEmpty]).toEqual(['warn', 'Scegli un colore', false]);
    expect(ok(creaRegolaConvalida(conv(), 'v')).regola.helpText).toBeUndefined();
  });

  it('intervallo sbagliato o troppo grande: errore', () => {
    expect(err(creaRegolaConvalida(conv({ intervallo: 'zzz' }), 'v'))).toContain('Intervallo');
    expect(err(creaRegolaConvalida(conv({ intervallo: 'A1:A10001' }), 'v'))).toContain('troppo grande');
    expect(ok(creaRegolaConvalida(conv({ intervallo: `A1:A${CELLE_MASSIME_CONVALIDA}` }), 'v')).intervallo.endRow).toBe(CELLE_MASSIME_CONVALIDA);
    expect(err(creaRegolaConvalida(conv({ intervallo: 'A:B' }), 'v'))).toContain('Intervallo non valido');
  });

  it('il motore applica la regola: elenco, numero compreso tra, lunghezza', () => {
    const e = ok(creaRegolaConvalida(conv(), 'v')).regola;
    expect(validateCellValue('Verde', e).valid).toBe(true);
    expect(validateCellValue('giallo', e).valid).toBe(false);
    const n = ok(creaRegolaConvalida(conv({ tipo: 'numero', operatore: 'between', valore1: '1', valore2: '10' }), 'v')).regola;
    expect(validateCellValue('5', n).valid).toBe(true);
    expect(validateCellValue('11', n).valid).toBe(false);
    const l = ok(creaRegolaConvalida(conv({ tipo: 'lunghezza', operatore: 'less_equal', valore1: '3' }), 'v')).regola;
    expect(validateCellValue('abc', l).valid).toBe(true);
    expect(validateCellValue('abcd', l).valid).toBe(false);
    const m = ok(creaRegolaConvalida(conv({ messaggio: 'No!', azione: 'avvisa' }), 'v')).regola;
    expect(validateCellValue('x', m)).toMatchObject({ valid: false, action: 'warn', message: 'No!' });
  });
});
