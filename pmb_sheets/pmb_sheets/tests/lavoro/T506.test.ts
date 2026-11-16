import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

// Riferimenti calcolati con pandas 2.3.3 (filtri, groupby, sort_values) sugli stessi dati.
const REPARTO = ['Nord', 'Sud', 'Nord', 'Est', 'Sud', 'Nord', 'Est', 'Sud', 'Ovest', 'Nord'];
const AGENTE = ['Anna', 'Bruno', 'Carla', 'Dino', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Ines', 'Luca'];
const VENDITE = [120.5, 80, 200, 45.25, 95, 310, 60, 150.75, 20, 99];
const QUANTITA = [3, 2, 5, 1, 4, 7, 2, 3, 1, 2];

type V = { kind: string; value?: unknown; values?: V[][]; error?: string };

function griglia(formula: string, intestazione = true) {
  const w = createWorkbook();
  const s = 'Foglio1';
  const colonne = [REPARTO, AGENTE, VENDITE, QUANTITA];
  const nomi = ['Reparto', 'Agente', 'Vendite', 'Quantita'];
  let r0 = 1;
  if (intestazione) { nomi.forEach((n, c) => w.setCell(s, `${'ABCD'[c]}1`, n)); r0 = 2; }
  colonne.forEach((col, c) => col.forEach((v, i) => w.setCell(s, `${'ABCD'[c]}${r0 + i}`, String(v))));
  w.setCell(s, 'H1', formula);
  const out: unknown[][] = [];
  for (let r = 1; r <= 40; r++) {
    const riga: unknown[] = [];
    for (let c = 0; c < 6; c++) {
      const v = w.getCell(s, `${'HIJKLM'[c]}${r}`).value as V;
      riga.push(v.kind === 'empty' ? null : v.kind === 'error' ? v.error : v.value);
    }
    if (riga.every((x) => x === null)) break;
    while (riga.length && riga[riga.length - 1] === null) riga.pop(); // niente vuoti in coda
    out.push(riga);
  }
  return out;
}
const Q = (q: string, h?: number) => `=QUERY(A1:D11,"${q}"${h === undefined ? '' : `,${h}`})`;
const colonna = (g: unknown[][], i = 0) => g.map((r) => r[i]);
const vicino = (a: unknown, b: number, rel = 1e-12) => { expect(typeof a).toBe('number'); expect(Math.abs((a as number) - b)).toBeLessThanOrEqual(Math.max(Math.abs(b) * rel, 1e-12)); };

describe('T506: QUERY', () => {
  it('select e intestazione come nelle colonne dei dati', () => {
    const g = griglia(Q('select Col2, Col3'));
    expect(g[0]).toEqual(['Agente', 'Vendite']);
    expect(g.length).toBe(11);
    expect(g[1].slice(0, 2)).toEqual(['Anna', 120.5]);
  });
  it('senza select restituisce tutto; select * equivale', () => {
    expect(griglia(Q('')).length).toBe(11);
    const a = griglia(Q('select *'));
    expect(a[0]).toEqual(['Reparto', 'Agente', 'Vendite', 'Quantita']);
  });
  it('where con and e confronti come pandas', () => {
    const g = griglia(Q("select Col2 where Col3 > 90 and Col1 = 'Nord'"));
    expect(colonna(g).slice(1)).toEqual(['Anna', 'Carla', 'Fabio', 'Luca']);
  });
  it('where con or, not, parentesi', () => {
    const g = griglia(Q("select Col2 where (Col1 = 'Est' or Col1 = 'Ovest') and not Col3 < 30"));
    expect(colonna(g).slice(1)).toEqual(['Dino', 'Gina']);
  });
  it('contains, starts with, ends with, like, matches', () => {
    expect(colonna(griglia(Q("select Col2 where Col2 contains 'in'"))).slice(1)).toEqual(['Dino', 'Gina']); // "Ines" ha la I maiuscola: il confronto distingue le maiuscole
    expect(colonna(griglia(Q("select Col2 where Col2 starts with 'H'"))).slice(1)).toEqual(['Hugo']);
    expect(colonna(griglia(Q("select Col2 where Col2 ends with 'a'"))).slice(1)).toEqual(['Anna', 'Carla', 'Elena', 'Gina', 'Luca']);
    expect(colonna(griglia(Q("select Col2 where Col2 like '_ugo'"))).slice(1)).toEqual(['Hugo']);
    expect(colonna(griglia(Q("select Col2 where Col2 matches '[A-C].*'"))).slice(1)).toEqual(['Anna', 'Bruno', 'Carla']);
  });
  it('group by con sum, avg, count, max, min = pandas', () => {
    const g = griglia(Q('select Col1, sum(Col3), avg(Col3), count(Col2), max(Col4) group by Col1'));
    expect(g[0].slice(0, 5)).toEqual(['Reparto', 'sum Vendite', 'avg Vendite', 'count Agente', 'max Quantita']);
    const atteso: Record<string, number[]> = { Nord: [729.5, 182.375, 4, 7], Sud: [325.75, 108.58333333333333, 3, 4], Est: [105.25, 52.625, 2, 2], Ovest: [20, 20, 1, 1] };
    expect(g.length).toBe(5);
    for (const riga of g.slice(1)) {
      const a = atteso[riga[0] as string];
      expect(a).toBeDefined();
      [1, 2, 3, 4].forEach((i) => vicino(riga[i], a[i - 1]));
    }
  });
  it('aggregati senza group by danno una sola riga', () => {
    const g = griglia(Q('select sum(Col3), avg(Col3), count(Col1)'));
    expect(g.length).toBe(2);
    vicino(g[1][0], 1180.5); vicino(g[1][1], 118.05); vicino(g[1][2], 10);
  });
  it('order by con più chiavi e desc = pandas sort_values', () => {
    const g = griglia(Q('select Col2 order by Col1, Col3 desc'));
    expect(colonna(g).slice(1)).toEqual(['Gina', 'Dino', 'Fabio', 'Carla', 'Anna', 'Luca', 'Ines', 'Hugo', 'Elena', 'Bruno']);
  });
  it('order by su un aggregato', () => {
    const g = griglia(Q('select Col1, sum(Col3) group by Col1 order by sum(Col3) desc'));
    expect(colonna(g).slice(1)).toEqual(['Nord', 'Sud', 'Est', 'Ovest']);
  });
  it('limit e offset', () => {
    const g = griglia(Q('select Col2 order by Col3 desc limit 3 offset 1'));
    expect(colonna(g).slice(1)).toEqual(['Carla', 'Hugo', 'Anna']);
  });
  it('espressioni aritmetiche e label', () => {
    const g = griglia(Q("select Col2, Col3 / Col4 label Col3 / Col4 'Prezzo medio'"));
    expect(g[0].slice(0, 2)).toEqual(['Agente', 'Prezzo medio']);
    const rif = [40.166667, 40, 40, 45.25, 23.75, 44.285714, 30, 50.25, 20, 49.5];
    g.slice(1).forEach((r, i) => vicino(r[1], rif[i], 1e-6));
  });
  it('label su un aggregato', () => {
    const g = griglia(Q("select Col1, sum(Col3) group by Col1 label sum(Col3) 'Totale'"));
    expect(g[0].slice(0, 2)).toEqual(['Reparto', 'Totale']);
  });
  it('senza intestazione (argomento 0) il primo rigo è un dato e non c\'è titolo', () => {
    const g = griglia('=QUERY(A2:D11,"select Col2 where Col3 > 200",0)', true);
    expect(colonna(g)).toEqual(['Fabio']);
  });
  it('is null / is not null', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', 'n'); w.setCell('Foglio1', 'A2', 'x'); w.setCell('Foglio1', 'A4', 'z');
    w.setCell('Foglio1', 'C1', '=QUERY(A1:A4,"select Col1 where Col1 is not null",1)');
    expect((w.getCell('Foglio1', 'C1').value as V).value).toBe('n'); // intestazione
    expect((w.getCell('Foglio1', 'C2').value as V).value).toBe('x');
    expect((w.getCell('Foglio1', 'C3').value as V).value).toBe('z');
  });
  it('dati e query con virgolette doppie dentro: apici semplici nella query', () => {
    const g = griglia(Q("select Col2 where Col1 = 'Ovest'"));
    expect(colonna(g).slice(1)).toEqual(['Ines']);
  });
  it('errori: query rotta, colonna fuori dai dati, col non raggruppata, where con aggregato', () => {
    for (const q of ['select', 'select Col9', 'select Col1, sum(Col3)', 'select Col1 where sum(Col3) > 1', 'select Col1 pivot Col2', "select Col1 where Col1 = 'x", 'selezione Col1', 'select Col1 limit -1', 'select Col1 limit 2 limit 3']) {
      const g = griglia(Q(q));
      expect(g[0][0], q).toBe('#VALUE!');
    }
  });
  it('nessun risultato dà #N/A', () => {
    const g = griglia(Q("select Col2 where Col1 = 'Inesistente'", 0));
    expect(g[0][0]).toBe('#N/A');
  });
  it('divisione per zero dà #DIV/0! nella cella', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '4'); w.setCell('Foglio1', 'B1', '0');
    w.setCell('Foglio1', 'D1', '=QUERY(A1:B1,"select Col1 / Col2",0)');
    expect((w.getCell('Foglio1', 'D1').value as V).error).toBe('#DIV/0!');
  });
  it('si aggiorna quando cambia un dato e funziona dentro altre formule', () => {
    const w = createWorkbook();
    ['a', 'b', 'a'].forEach((t, i) => { w.setCell('Foglio1', `A${i + 1}`, t); w.setCell('Foglio1', `B${i + 1}`, String(i + 1)); });
    w.setCell('Foglio1', 'D1', '=SUM(QUERY(A1:B3,"select sum(Col2) where Col1 = \'a\'",0))');
    expect((w.getCell('Foglio1', 'D1').value as V).value).toBe(4);
    w.setCell('Foglio1', 'B3', '10');
    expect((w.getCell('Foglio1', 'D1').value as V).value).toBe(11);
  });
  it('dopo la modifica di un dato i gruppi si ricalcolano e si riordinano', () => {
    const w = createWorkbook();
    const s = 'Foglio1';
    ['Reparto', 'Agente', 'Vendite', 'Quantita'].forEach((n, c) => w.setCell(s, `${'ABCD'[c]}1`, n));
    for (let i = 0; i < 10; i++) { w.setCell(s, `A${i + 2}`, REPARTO[i]); w.setCell(s, `B${i + 2}`, AGENTE[i]); w.setCell(s, `C${i + 2}`, String(VENDITE[i])); w.setCell(s, `D${i + 2}`, String(QUANTITA[i])); }
    w.setCell(s, 'J1', '=QUERY(A1:D11,"select Col1, sum(Col3) group by Col1 order by sum(Col3) desc")');
    expect((w.getCell(s, 'J2').value as V).value).toBe('Nord');
    w.setCell(s, 'C3', '1000'); // riga 3 = Bruno (Sud): 80 → 1000, Sud = 1000 + 95 + 150,75
    expect((w.getCell(s, 'J2').value as V).value).toBe('Sud');
    expect((w.getCell(s, 'K2').value as V).value).toBe(1245.75);
    expect((w.getCell(s, 'K3').value as V).value).toBe(729.5);
  });
  it('parole chiave senza distinzione tra maiuscole e minuscole, nomi Col anche minuscoli', () => {
    const g = griglia(Q("SELECT col2 WHERE col1 = 'Ovest' ORDER BY col2 DESC LIMIT 5"));
    expect(colonna(g).slice(1)).toEqual(['Ines']);
  });
});
