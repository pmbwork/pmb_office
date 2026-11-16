import { describe, it, expect } from 'vitest';
import { validateCellValue, type DataValidationRule } from '../../src/sheet/data-validation';
import { creaRegolaConvalida, datiDaConvalida, descriviConvalida, type DatiConvalida } from '../../src/sheet/regole-dialogo';

describe('Convalida dati con elenco da intervallo di celle', () => {
  it('crea correttamente una regola per elenco da intervallo (con o senza "=")', () => {
    const dati: DatiConvalida = {
      intervallo: 'B2:B10',
      tipo: 'elenco',
      voci: '=A1:A5',
      operatore: 'between',
      valore1: '',
      valore2: '',
      azione: 'rifiuta',
      messaggio: 'Seleziona un valore consentito dall\'elenco',
      ammettiVuote: true,
    };
    const res = creaRegolaConvalida(dati, 'val-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.valore.regola.type).toBe('list');
    expect(res.valore.regola.listRange).toBe('A1:A5');
    expect(res.valore.regola.value1).toBe('=A1:A5');
    expect(res.valore.regola.action).toBe('reject');
    expect(res.valore.regola.helpText).toBe('Seleziona un valore consentito dall\'elenco');
  });

  it('rifiuta un intervallo sorgente vuoto o non interpretabile', () => {
    const datiVuoto: DatiConvalida = {
      intervallo: 'B2',
      tipo: 'elenco',
      voci: '   ',
      operatore: 'between',
      valore1: '',
      valore2: '',
      azione: 'rifiuta',
      messaggio: '',
      ammettiVuote: true,
    };
    const resVuoto = creaRegolaConvalida(datiVuoto, 'val-2');
    expect(resVuoto.ok).toBe(false);
  });

  it('riconosce e descrive la convalida da intervallo', () => {
    const regola: DataValidationRule = {
      id: 'val-3',
      type: 'list',
      listRange: 'Foglio1!C1:C10',
      value1: '=Foglio1!C1:C10',
      action: 'reject',
    };
    const descr = descriviConvalida(regola);
    expect(descr).toContain('Elenco da intervallo: =Foglio1!C1:C10');

    const dati = datiDaConvalida(regola, [{ startRow: 2, endRow: 5, startCol: 2, endCol: 2 }]);
    expect(dati).not.toBeNull();
    expect(dati?.tipo).toBe('elenco');
    expect(dati?.voci).toBe('=Foglio1!C1:C10');
  });

  it('validateCellValue valuta sia voci fisse che voci risolte dinamicamente', () => {
    const regolaIntervallo: DataValidationRule = {
      id: 'val-4',
      type: 'list',
      listRange: 'A1:A3',
      value1: '=A1:A3',
      action: 'reject',
    };

    const vociDinamiche = ['Milano', 'Roma', 'Napoli'];

    expect(validateCellValue('Roma', regolaIntervallo, undefined, vociDinamiche).valid).toBe(true);
    expect(validateCellValue('milano', regolaIntervallo, undefined, vociDinamiche).valid).toBe(true);
    expect(validateCellValue('Torino', regolaIntervallo, undefined, vociDinamiche).valid).toBe(false);
  });
});

