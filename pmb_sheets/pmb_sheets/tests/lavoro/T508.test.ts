import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { formattaNumero, coloreDelFormato, formatoRiconosciuto } from '../../src/engine/format-testo';
import { coloreFormato, formatCellValue } from '../../src/sheet/number-format';
import { ESEMPI_FORMATO, FORMATI_PREIMPOSTATI_ELENCO, FORMATI_PREIMPOSTATI_PER_ID, formatoPreimpostatoDelCodice } from '../../src/sheet/formati-preimpostati';
import { formatoAccettabile } from '../../src/components/dialogo-formato';
import { menuRegistry } from '../../src/registry/menu';

const f = (n: number, codice: string) => formattaNumero(n, codice, 'en');

describe('T508: formati numerici (contabilità, durata, condizioni, colori)', () => {
  const CONT = FORMATI_PREIMPOSTATI_PER_ID['accounting'].codice;

  it('contabilità: positivo, negativo tra parentesi, zero con trattino (niente "00")', () => {
    expect(f(1234.5, CONT).trim()).toBe('€ 1,234.50');
    expect(f(-1234.5, CONT).trim()).toBe('€ (1,234.50)');
    const zero = f(0, CONT);
    expect(zero.trim()).toBe('€ -');
    expect(zero).not.toMatch(/[0-9]/);
  });

  it('i segnaposto ? scrivono spazio dove manca la cifra, gli 0 scrivono zeri', () => {
    expect(f(7, '??')).toBe(' 7');
    expect(f(0, '??')).toBe('  ');
    expect(f(7, '000')).toBe('007');
    expect(f(0, '0')).toBe('0');
    expect(f(0, '#')).toBe('');
  });

  it('una sezione di solo testo scrive solo il testo, non il numero', () => {
    expect(f(150, '[>=100]"alto";"basso"')).toBe('alto');
    expect(f(50, '[>=100]"alto";"basso"')).toBe('basso');
    expect(f(5, '0;-0;"zero"')).toBe('5');
    expect(f(0, '0;-0;"zero"')).toBe('zero');
    expect(f(9, '"sì"')).toBe('sì');
  });

  it('condizioni: tre fasce e il resto', () => {
    const cod = '[<10]"basso";[<100]"medio";"alto"';
    expect(f(5, cod)).toBe('basso');
    expect(f(50, cod)).toBe('medio');
    expect(f(500, cod)).toBe('alto');
    expect(f(10, '[=10]"dieci";0')).toBe('dieci');
    expect(f(11, '[=10]"dieci";0')).toBe('11');
    expect(f(11, '[<>10]"altro";"dieci"')).toBe('altro');
  });

  it('condizioni con il numero scritto: le sezioni usano il formato', () => {
    expect(f(1234.5, '[>=1000]#,##0;0.00')).toBe('1,235');
    expect(f(12.345, '[>=1000]#,##0;0.00')).toBe('12.35');
  });

  it('i colori: [Red] e [Blue] scelti secondo la sezione che vale', () => {
    const cod = '#,##0.00;[Red]-#,##0.00;[Blue]0';
    expect(coloreDelFormato(-5, cod)).toBe('#d00000');
    expect(coloreDelFormato(5, cod)).toBeNull();
    expect(coloreDelFormato(0, cod)).toBe('#0000ff');
    expect(coloreDelFormato(1, '[Green]0')).toBe('#008000');
    expect(coloreDelFormato(1, '0.00')).toBeNull();
    expect(coloreDelFormato(1, '[red]0')).toBe('#d00000');                // senza distinzione tra maiuscole e minuscole
    expect(coloreDelFormato(150, '[Blue][>=100]"alto";"basso"')).toBe('#0000ff');
    expect(coloreDelFormato(50, '[Blue][>=100]"alto";"basso"')).toBeNull();
  });

  it('coloreFormato lavora sui valori delle celle e ignora testi e formati rotti', () => {
    const num = { kind: 'number', value: -3 };
    expect(coloreFormato(num, '0;[Red]-0')).toBe('#d00000');
    expect(coloreFormato({ kind: 'text', value: 'x' }, '0;[Red]-0')).toBeUndefined();
    expect(coloreFormato(num, '')).toBeUndefined();
    expect(coloreFormato(num, '[Red]abc?x')).toBeUndefined();
  });

  it('durata e frazioni dei formati pronti', () => {
    expect(f(1.5, FORMATI_PREIMPOSTATI_PER_ID['duration'].codice)).toBe('36:00:00');
    expect(f(2.75, '[h]:mm')).toBe('66:00');
    expect(f(3.25, FORMATI_PREIMPOSTATI_PER_ID['fraction'].codice)).toBe('3 1/4');
    expect(f(0.5, FORMATI_PREIMPOSTATI_PER_ID['fraction'].codice)).toBe('1/2');
    expect(f(45000, FORMATI_PREIMPOSTATI_PER_ID['date-long'].codice)).toBe('Wednesday 15 March 2023');
    expect(f(1234.5, FORMATI_PREIMPOSTATI_PER_ID['currency-round'].codice)).toBe('€1,235');
    expect(f(-1234.5, FORMATI_PREIMPOSTATI_PER_ID['financial'].codice)).toBe('(1,234.50)');
    expect(f(1234.5, FORMATI_PREIMPOSTATI_PER_ID['financial'].codice)).toBe('1,234.50');
    expect(f(-1234.5, FORMATI_PREIMPOSTATI_PER_ID['negative-red'].codice)).toBe('-1,234.50');
  });

  it('tutti i formati pronti e gli esempi sono riconosciuti e ben formati', () => {
    for (const p of FORMATI_PREIMPOSTATI_ELENCO) {
      expect(formatoRiconosciuto(p.codice), p.nome).toBe(true);
      expect(formatoAccettabile(p.codice), p.nome).toBe(true);
      // date e durate non hanno una forma per i numeri negativi (Excel scrive ####): lì il risultato è null e la cella ricade sul testo semplice
      const eTempo = p.id === 'duration' || p.id === 'date-long';
      for (const v of [1234.5, -1234.5, 0, 0.0625, 45000]) {
        if (eTempo && v < 0) { expect(f(v, p.codice), `${p.nome} ${v}`).toBeNull(); continue; }
        expect(f(v, p.codice), `${p.nome} ${v}`).not.toBeNull();
      }
    }
    for (const e of ESEMPI_FORMATO) {
      expect(formatoRiconosciuto(e.codice), e.codice).toBe(true);
      expect(f(1234.5, e.codice), e.codice).not.toBeNull();
    }
    expect(new Set(FORMATI_PREIMPOSTATI_ELENCO.map((p) => p.id)).size).toBe(FORMATI_PREIMPOSTATI_ELENCO.length);
  });

  it('formatoPreimpostatoDelCodice riconosce solo il codice esatto', () => {
    expect(formatoPreimpostatoDelCodice('[h]:mm:ss')?.id).toBe('duration');
    expect(formatoPreimpostatoDelCodice('[h]:mm')).toBeUndefined();
    expect(formatoPreimpostatoDelCodice('')).toBeUndefined();
    expect(formatoPreimpostatoDelCodice(undefined)).toBeUndefined();
  });

  it('la finestra accetta vuoto, @, General e i formati validi; rifiuta il resto', () => {
    for (const ok of ['', '  ', '@', 'General', 'standard', '0.00', '#,##0;[Red]-#,##0', '[>=100]"alto";"basso"', 'dd/mm/yyyy']) expect(formatoAccettabile(ok), ok).toBe(true);
    for (const no of ['abc', '0.00 xyz', '"non chiusa', '0;0;0;0;0', '#,##0 qq']) expect(formatoAccettabile(no), no).toBe(false);
  });

  it('con la lingua italiana punto e virgola si scambiano, i colori restano', () => {
    expect(formattaNumero(-1234.5, '#,##0.00;[Red]-#,##0.00', 'it')).toBe('-1.234,50');
    expect(formatCellValue({ kind: 'number', value: 3.5 }, '0.0')).toMatch(/^3[.,]5$/);
  });

  it('TEXT e le celle usano lo stesso interprete (sezioni, condizioni, colori ignorati dal testo)', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=TEXT(150,"[>=100]""alto"";""basso""")');
    w.setCell('Foglio1', 'A2', '=TEXT(-5,"0;[Red]-0")');
    w.setCell('Foglio1', 'A3', '=TEXT(1.5,"[h]:mm:ss")');
    expect((w.getCell('Foglio1', 'A1').value as { value: unknown }).value).toBe('alto');
    expect((w.getCell('Foglio1', 'A2').value as { value: unknown }).value).toBe('-5');
    expect((w.getCell('Foglio1', 'A3').value as { value: unknown }).value).toBe('36:00:00');
  });

  it('il menu Formato > Numero ha tutte le voci nuove e "Altri formati…"', () => {
    const menu = menuRegistry;
    const formato = menu.find((m) => m.id === 'format');
    const numero = formato?.items.find((i) => i.id === 'number-format');
    const azioni = (numero?.subitems ?? []).map((s) => s.action);
    for (const a of ['set-num-fmt-duration', 'set-num-fmt-accounting', 'set-num-fmt-financial', 'set-num-fmt-currency-round', 'set-num-fmt-negative-red', 'set-num-fmt-fraction', 'set-num-fmt-date-long', 'open-custom-num-fmt']) {
      expect(azioni, a).toContain(a);
    }
    // ogni azione "set-num-fmt-<id>" ha un formato pronto
    for (const a of azioni) if (a && /^set-num-fmt-(accounting|financial|currency-round|duration|fraction|date-long|negative-red)$/.test(a)) expect(FORMATI_PREIMPOSTATI_PER_ID[a.slice('set-num-fmt-'.length)], a).toBeDefined();
  });
});
