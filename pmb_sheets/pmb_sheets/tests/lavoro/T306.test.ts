import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CHIAVE_RECUPERO, INTERVALLO_CONTROLLO, LUNGHEZZA_MASSIMA_RECUPERO, Recupero, archivioDa, leggiRecupero, pacchettoRecupero,
  type Archivio, type SchedaViva,
} from '../../src/formati/recupero';
import { serializeSheetDocumentData } from '../../src/sheet/document-data';
import { documentoDaScambio, foglioVuoto } from '../../src/formati/scambio';

/** un foglio .fsheet valido, con una cella scritta */
const dati = (testo: string): string => serializeSheetDocumentData(documentoDaScambio({ foglioAttivo: 'Foglio1', fogli: [{ ...foglioVuoto('Foglio1'), celle: { A1: testo } }] }));
const viva = (id: string, titolo: string, testo: string): SchedaViva => ({ id, titolo, dati: dati(testo) });

function deposito() {
  const d = new Map<string, string>();
  return { d, getItem: (k: string) => (d.has(k) ? d.get(k)! : null), setItem: (k: string, v: string) => { d.set(k, v); }, removeItem: (k: string) => { d.delete(k); } };
}

function archivioFinto(contenuto: string | null = null, scrittura = true) {
  const a = {
    contenuto,
    scritture: [] as string[],
    cancellazioni: 0,
    leggi(): string | null { return a.contenuto; },
    scrivi(t: string): boolean { a.scritture.push(t); if (scrittura) a.contenuto = t; return scrittura; },
    cancella(): void { a.cancellazioni++; a.contenuto = null; },
  };
  return a as Archivio & typeof a;
}

const nuovo = (a: Archivio) => new Recupero(a, { ora: () => 4321 });

afterEach(() => { vi.useRealTimers(); });

describe('T306: costanti', () => {
  it('chiave, intervallo e lunghezza massima', () => {
    expect(CHIAVE_RECUPERO).toBe('pmb_sheets.recupero');
    expect(INTERVALLO_CONTROLLO).toBe(3000);
    expect(LUNGHEZZA_MASSIMA_RECUPERO).toBe(4_500_000);
  });
});

describe('T306: archivioDa', () => {
  it('scrive, rilegge e cancella sulla chiave predefinita', () => {
    const d = deposito();
    const a = archivioDa(d);
    expect(a.leggi()).toBeNull();
    expect(a.scrivi('uno')).toBe(true);
    expect(d.d.get('pmb_sheets.recupero')).toBe('uno');
    expect(a.leggi()).toBe('uno');
    a.cancella();
    expect(a.leggi()).toBeNull();
    expect(d.d.size).toBe(0);
  });
  it('legge, scrive e cancella sulla chiave data, lasciando stare le altre', () => {
    const d = deposito();
    d.setItem('altra', 'mia');
    d.setItem(CHIAVE_RECUPERO, 'standard');
    const a = archivioDa(d, 'altra');
    expect(a.leggi()).toBe('mia');
    a.scrivi('nuova');
    expect(d.d.get('altra')).toBe('nuova');
    a.cancella();
    expect([...d.d.entries()]).toEqual([[CHIAVE_RECUPERO, 'standard']]);
  });
  it('senza deposito non legge, non scrive e non si rompe', () => {
    for (const nessuno of [null, undefined]) {
      const a = archivioDa(nessuno);
      expect(a.leggi()).toBeNull();
      expect(a.scrivi('x')).toBe(false);
      expect(() => a.cancella()).not.toThrow();
    }
  });
  it('se il deposito dà errore non si rompe: legge null, scrive false, cancella senza errori', () => {
    const rotto = {
      getItem: () => { throw new Error('no'); },
      setItem: () => { throw new Error('pieno'); },
      removeItem: () => { throw new Error('no'); },
    };
    const a = archivioDa(rotto);
    expect(a.leggi()).toBeNull();
    expect(a.scrivi('x')).toBe(false);
    expect(() => a.cancella()).not.toThrow();
  });
});

describe('T306: pacchettoRecupero e leggiRecupero', () => {
  it('il pacchetto è un JSON con versione, ora e fogli', () => {
    const schede = [{ titolo: 'Conti', dati: dati('a') }];
    expect(JSON.parse(pacchettoRecupero(schede, 42))).toEqual({ v: 1, salvato: 42, schede });
  });
  it('andata e ritorno: ora, titoli e contenuto dei fogli, nello stesso ordine', () => {
    const schede = [{ titolo: 'Uno', dati: dati('a') }, { titolo: 'Due', dati: dati('b') }];
    expect(leggiRecupero(pacchettoRecupero(schede, 99))).toEqual({ schede, salvato: 99 });
  });
  it('null e testo che non è JSON danno null', () => {
    expect(leggiRecupero(null)).toBeNull();
    expect(leggiRecupero('')).toBeNull();
    expect(leggiRecupero('{non json')).toBeNull();
  });
  it('JSON che non è un oggetto con i campi giusti dà null', () => {
    for (const t of ['null', '[]', '"testo"', '42', '{}']) expect(leggiRecupero(t), t).toBeNull();
  });
  it('versione, ora o elenco dei fogli sbagliati danno null', () => {
    const buono = { v: 1, salvato: 1, schede: [{ titolo: 't', dati: dati('a') }] };
    expect(leggiRecupero(JSON.stringify(buono))).not.toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, v: 2 }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, v: undefined }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, salvato: '1' }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, salvato: null }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, schede: 'no' }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, schede: {} }))).toBeNull();
  });
  it('un\'ora non finita dà null', () => {
    const t = `{"v":1,"salvato":1e999,"schede":[{"titolo":"t","dati":${JSON.stringify(dati('a'))}}]}`;
    expect(leggiRecupero(t)).toBeNull();
  });
  it('senza fogli leggibili dà null; con alcuni leggibili tiene solo quelli', () => {
    const buono = { titolo: 'ok', dati: dati('a') };
    const pacco = (schede: unknown[]) => JSON.stringify({ v: 1, salvato: 5, schede });
    expect(leggiRecupero(pacco([]))).toBeNull();
    expect(leggiRecupero(pacco([{ titolo: 'x', dati: 'non è un foglio' }]))).toBeNull();
    expect(leggiRecupero(pacco([{ titolo: 5, dati: dati('a') }]))).toBeNull();
    expect(leggiRecupero(pacco([{ titolo: 'x', dati: 7 }]))).toBeNull();
    expect(leggiRecupero(pacco([null, 'x', 3]))).toBeNull();
    expect(leggiRecupero(pacco([{ titolo: 'x', dati: 'rotto' }, buono, { dati: dati('b') }]))).toEqual({ schede: [buono], salvato: 5 });
  });
  it('un titolo vuoto resta vuoto', () => {
    expect(leggiRecupero(pacchettoRecupero([{ titolo: '', dati: dati('a') }], 1))!.schede[0].titolo).toBe('');
  });
});

describe('T306: Recupero, controllo dei fogli', () => {
  it('la prima volta che vede una scheda ne ricorda il contenuto e non scrive: cancella solo la copia', () => {
    const a = archivioFinto('vecchia');
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    expect(a.scritture).toEqual([]);
    expect(a.cancellazioni).toBe(1);
    expect(a.contenuto).toBeNull();
    expect(r.esito).toBe('vuoto');
  });
  it('se il foglio cambia scrive titolo, contenuto e ora', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0])).toEqual({ v: 1, salvato: 4321, schede: [{ titolo: 'Conti', dati: dati('b') }] });
    expect(r.esito).toBe('scritto');
  });
  it('se non è cambiato niente dall\'ultimo controllo non riscrive e non cancella', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    for (let i = 0; i < 3; i++) r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.scritture).toHaveLength(1);
    expect(a.cancellazioni).toBe(1);
  });
  it('una nuova modifica riscrive la copia', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    r.controlla([viva('t1', 'Conti', 'c')]);
    expect(a.scritture).toHaveLength(2);
    expect(JSON.parse(a.scritture[1]).schede[0].dati).toBe(dati('c'));
  });
  it('anche il solo titolo cambiato riscrive la copia', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    r.controlla([viva('t1', 'Bilancio', 'b')]);
    expect(a.scritture).toHaveLength(2);
    expect(JSON.parse(a.scritture[1]).schede[0].titolo).toBe('Bilancio');
  });
  it('tornare al contenuto di partenza cancella la copia', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    r.controlla([viva('t1', 'Conti', 'a')]);
    expect(a.contenuto).toBeNull();
    expect(a.cancellazioni).toBe(2);
    expect(r.esito).toBe('vuoto');
  });
  it('nella copia vanno solo le schede modificate, nell\'ordine in cui sono', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Uno', 'a'), viva('t2', 'Due', 'a'), viva('t3', 'Tre', 'a')]);
    r.controlla([viva('t1', 'Uno', 'x'), viva('t2', 'Due', 'a'), viva('t3', 'Tre', 'z')]);
    expect(JSON.parse(a.scritture[0]).schede.map((s: { titolo: string }) => s.titolo)).toEqual(['Uno', 'Tre']);
  });
  it('una scheda comparsa dopo ha il suo riferimento e non sposta quello delle altre', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Uno', 'a')]);
    r.controlla([viva('t1', 'Uno', 'a'), viva('t2', 'Due', 'q')]);
    expect(a.scritture).toEqual([]);
    r.controlla([viva('t1', 'Uno', 'a'), viva('t2', 'Due', 'r')]);
    expect(JSON.parse(a.scritture[0]).schede.map((s: { titolo: string }) => s.titolo)).toEqual(['Due']);
  });
  it('un elenco di schede vuoto cancella la copia solo se prima c\'era qualcosa da cancellare', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Uno', 'a')]);
    r.controlla([viva('t1', 'Uno', 'b')]);
    r.controlla([]);
    expect(a.contenuto).toBeNull();
    expect(a.cancellazioni).toBe(2);
  });
});

describe('T306: pulita e chiusa', () => {
  it('pulita dà il riferimento prima ancora che la scheda si veda: se è diversa è subito modificata', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.pulita('t1', dati('file'));
    r.controlla([viva('t1', 'Conti', 'file')]);
    expect(a.scritture).toEqual([]);
    r.controlla([viva('t1', 'Conti', 'file ma modificato')]);
    expect(a.scritture).toHaveLength(1);
    const r2 = nuovo(archivioFinto());
    const b = archivioFinto();
    const r3 = nuovo(b);
    r3.pulita('t9', dati('vuoto'));
    r3.controlla([viva('t9', 'Nuovo', 'già scritto')]);
    expect(b.scritture).toHaveLength(1);
    expect(r2.esito).toBeNull();
  });
  it('dopo un salvataggio (pulita col contenuto salvato) la scheda non è più modificata e la copia sparisce', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.contenuto).not.toBeNull();
    r.pulita('t1', dati('b'));
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.contenuto).toBeNull();
    r.controlla([viva('t1', 'Conti', 'c')]);
    expect(JSON.parse(a.scritture[1]).schede).toHaveLength(1);
  });
  it('salvare una scheda lascia nella copia le altre ancora modificate', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Uno', 'a'), viva('t2', 'Due', 'a')]);
    r.controlla([viva('t1', 'Uno', 'b'), viva('t2', 'Due', 'b')]);
    r.pulita('t1', dati('b'));
    r.controlla([viva('t1', 'Uno', 'b'), viva('t2', 'Due', 'b')]);
    expect(JSON.parse(a.scritture[1]).schede.map((s: { titolo: string }) => s.titolo)).toEqual(['Due']);
  });
  it('chiusa fa dimenticare la scheda: se lo stesso identificativo ricompare, riparte da capo', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Uno', 'a')]);
    r.chiusa('t1');
    r.controlla([viva('t1', 'Uno', 'b')]);
    expect(a.scritture).toEqual([]);
    r.controlla([viva('t1', 'Uno', 'c')]);
    expect(a.scritture).toHaveLength(1);
  });
  it('chiusa su una scheda mai vista non fa niente', () => {
    const r = nuovo(archivioFinto());
    expect(() => r.chiusa('mai-vista')).not.toThrow();
  });
});

describe('T306: limiti, errori, trova e scarta', () => {
  it('una copia lunga esattamente il massimo si scrive, un carattere in più no (la vecchia resta)', () => {
    const lunga = (n: number) => 'a'.repeat(n);
    const sempre = (titolo: string) => viva('t1', titolo, 'x');
    // la lunghezza della copia cresce di un carattere per ogni carattere del titolo
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([sempre('t')]);
    const base = JSON.stringify({ v: 1, salvato: 4321, schede: [{ titolo: '', dati: dati('y') }] }).length;
    r.controlla([{ id: 't1', titolo: lunga(LUNGHEZZA_MASSIMA_RECUPERO - base), dati: dati('y') }]);
    expect(a.scritture).toHaveLength(1);
    expect(a.scritture[0].length).toBe(LUNGHEZZA_MASSIMA_RECUPERO);
    expect(r.esito).toBe('scritto');
    const b = archivioFinto('vecchia');
    const r2 = nuovo(b);
    r2.controlla([sempre('t')]);
    b.contenuto = 'vecchia';
    r2.controlla([{ id: 't1', titolo: lunga(LUNGHEZZA_MASSIMA_RECUPERO - base + 1), dati: dati('y') }]);
    expect(b.scritture).toEqual([]);
    expect(b.contenuto).toBe('vecchia');
    expect(r2.esito).toBe('troppo-grande');
  });
  it('se il deposito rifiuta la scrittura l\'esito è errore e al controllo dopo si riprova', () => {
    const a = archivioFinto(null, false);
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(r.esito).toBe('errore');
    expect(a.scritture).toHaveLength(1);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.scritture).toHaveLength(2);
  });
  it('l\'esito segue l\'ultima operazione', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    expect(r.esito).toBeNull();
    r.controlla([viva('t1', 'Conti', 'a')]);
    expect(r.esito).toBe('vuoto');
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(r.esito).toBe('scritto');
  });
  it('trova rilegge la copia scritta, anche da un\'altra sessione', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(nuovo(a).trova()).toEqual({ schede: [{ titolo: 'Conti', dati: dati('b') }], salvato: 4321 });
    expect(nuovo(archivioFinto()).trova()).toBeNull();
    expect(nuovo(archivioFinto('{rotto')).trova()).toBeNull();
  });
  it('scarta cancella la copia e al controllo dopo si riscrive se ci sono ancora fogli modificati', () => {
    const a = archivioFinto();
    const r = nuovo(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    r.scarta();
    expect(a.contenuto).toBeNull();
    expect(a.cancellazioni).toBe(2);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(a.scritture).toHaveLength(2);
  });
  it('senza "ora" l\'ora della copia è quella vera', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    const a = archivioFinto();
    const r = new Recupero(a);
    r.controlla([viva('t1', 'Conti', 'a')]);
    r.controlla([viva('t1', 'Conti', 'b')]);
    expect(JSON.parse(a.scritture[0]).salvato).toBe(Date.parse('2026-11-01T10:00:00Z'));
  });
  it('prova con il deposito vero: una copia scritta si rilegge con un\'altra istanza finché non si scarta', () => {
    const d = deposito();
    const uno = new Recupero(archivioDa(d));
    uno.controlla([viva('t1', 'Bozza', 'a')]);
    uno.controlla([viva('t1', 'Bozza', 'b')]);
    const due = new Recupero(archivioDa(d));
    expect(due.trova()!.schede[0].titolo).toBe('Bozza');
    due.scarta();
    expect(new Recupero(archivioDa(d)).trova()).toBeNull();
    expect(d.d.size).toBe(0);
  });
});
