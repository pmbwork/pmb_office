import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CHIAVE_RECUPERO, LUNGHEZZA_MASSIMA_RECUPERO, RITARDO_SALVATAGGIO, Recupero, archivioDa, eVuoto, leggiRecupero, pacchettoRecupero,
  type Archivio,
} from '../../src/formati/recupero';
import { OGGETTO, daTesto, documentoVuoto, serializza, testoDi, type Documento, type Run } from '../../src/modello/documento';

const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const conTesto = (t: string): Documento => daTesto(t);

/** deposito finto: un oggetto con le tre funzioni di localStorage */
function deposito() {
  const dati = new Map<string, string>();
  return {
    dati,
    getItem: (k: string) => (dati.has(k) ? dati.get(k)! : null),
    setItem: (k: string, v: string) => { dati.set(k, v); },
    removeItem: (k: string) => { dati.delete(k); },
  };
}

/** archivio finto che ricorda cosa gli è stato chiesto */
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

/** timer finto: tiene le azioni in sospeso e le fa scattare a comando */
function timerFinto() {
  const t = {
    chiamate: [] as Array<{ azione: () => void; ms: number; id: number }>,
    annullati: [] as unknown[],
    prossimo: 1,
    imposta(azione: () => void, ms: number): unknown { const id = t.prossimo++; t.chiamate.push({ azione, ms, id }); return id; },
    annulla(id: unknown): void { t.annullati.push(id); },
    scatta(i = t.chiamate.length - 1): void { t.chiamate[i].azione(); },
  };
  return t;
}

function recupero(a: Archivio, extra: Record<string, unknown> = {}) {
  const t = timerFinto();
  const r = new Recupero(a, { imposta: t.imposta, annulla: t.annulla, ora: () => 1234, ...extra });
  return { r, t };
}

afterEach(() => { vi.useRealTimers(); });

describe('T304: costanti', () => {
  it('chiave, ritardo e lunghezza massima', () => {
    expect(CHIAVE_RECUPERO).toBe('pmb_docs.recupero');
    expect(RITARDO_SALVATAGGIO).toBe(2000);
    expect(LUNGHEZZA_MASSIMA_RECUPERO).toBe(4_500_000);
  });
});

describe('T304: eVuoto', () => {
  it('un documento nuovo è vuoto', () => { expect(eVuoto(documentoVuoto())).toBe(true); });
  it('un paragrafo con una riga di testo vuota o con attributi senza testo è vuoto', () => {
    expect(eVuoto({ paragrafi: [{ runs: [run('')], al: 'ce', el: 'punti' }] })).toBe(true);
  });
  it('con del testo non è vuoto', () => { expect(eVuoto(conTesto('a'))).toBe(false); });
  it('due paragrafi non sono vuoti anche senza testo', () => { expect(eVuoto({ paragrafi: [{ runs: [] }, { runs: [] }] })).toBe(false); });
  it('un\'immagine non è vuoto', () => {
    expect(eVuoto({ paragrafi: [{ runs: [run(OGGETTO, { im: { s: 'data:image/png;base64,AAAA', w: 10, h: 10 } })] }] })).toBe(false);
  });
  it('una cella di tabella senza testo non è vuoto', () => {
    expect(eVuoto({ paragrafi: [{ runs: [], tb: { i: 0, r: 0, c: 0 } }] })).toBe(false);
  });
  it('un\'intestazione o un piè di pagina bastano a non essere vuoto', () => {
    expect(eVuoto({ paragrafi: [{ runs: [] }], intestazione: [{ runs: [run('x')] }] })).toBe(false);
    expect(eVuoto({ paragrafi: [{ runs: [] }], piede: [{ runs: [run('x')] }] })).toBe(false);
  });
});

describe('T304: pacchettoRecupero e leggiRecupero', () => {
  it('il pacchetto è un JSON con versione, titolo, ora e documento serializzato', () => {
    const doc = conTesto('Ciao');
    const dati = JSON.parse(pacchettoRecupero('Tesi', doc, 42));
    expect(dati).toEqual({ v: 1, titolo: 'Tesi', salvato: 42, doc: serializza(doc) });
  });
  it('andata e ritorno: titolo, ora, testo e formattazione', () => {
    const doc: Documento = {
      paragrafi: [{ runs: [run('Titolo', { g: true, z: 24 })], al: 'ce' }, { runs: [run('corpo '), run('link', { u: 'https://esempio.it' })] }],
      intestazione: [{ runs: [run('Testata')], al: 'dx' }],
      piede: [{ runs: [run('Piede')] }],
    };
    const r = leggiRecupero(pacchettoRecupero('La mia tesi', doc, 99))!;
    expect(r.titolo).toBe('La mia tesi');
    expect(r.salvato).toBe(99);
    expect(serializza(r.doc)).toBe(serializza(doc));
  });
  it('un titolo vuoto resta vuoto', () => {
    expect(leggiRecupero(pacchettoRecupero('', conTesto('a'), 1))!.titolo).toBe('');
  });
  it('null, testo vuoto e testo che non è JSON danno null', () => {
    expect(leggiRecupero(null)).toBeNull();
    expect(leggiRecupero('')).toBeNull();
    expect(leggiRecupero('{non json')).toBeNull();
  });
  it('JSON che non è un oggetto dà null', () => {
    expect(leggiRecupero('[]')).toBeNull();
    expect(leggiRecupero('"testo"')).toBeNull();
    expect(leggiRecupero('42')).toBeNull();
    expect(leggiRecupero('null')).toBeNull();
  });
  it('versione, titolo, ora o documento sbagliati danno null', () => {
    const buono = { v: 1, titolo: 't', salvato: 1, doc: serializza(conTesto('a')) };
    expect(leggiRecupero(JSON.stringify(buono))).not.toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, v: 2 }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, v: undefined }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, titolo: 5 }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, salvato: '1' }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, salvato: null }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, doc: 5 }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, doc: { paragrafi: [] } }))).toBeNull();
    expect(leggiRecupero(JSON.stringify({ ...buono, doc: 'non è un documento' }))).toBeNull();
  });
  it('un\'ora non finita (Infinity scritto come testo non è un numero JSON) dà null', () => {
    const t = `{"v":1,"titolo":"t","salvato":1e999,"doc":${JSON.stringify(serializza(conTesto('a')))}}`;
    expect(leggiRecupero(t)).toBeNull();
  });
  it('una copia di un documento vuoto dà null', () => {
    expect(leggiRecupero(pacchettoRecupero('t', documentoVuoto(), 1))).toBeNull();
  });
});

describe('T304: archivioDa', () => {
  it('scrive, rilegge e cancella sulla chiave predefinita', () => {
    const d = deposito();
    const a = archivioDa(d);
    expect(a.leggi()).toBeNull();
    expect(a.scrivi('uno')).toBe(true);
    expect(d.dati.get('pmb_docs.recupero')).toBe('uno');
    expect(a.leggi()).toBe('uno');
    a.cancella();
    expect(a.leggi()).toBeNull();
    expect(d.dati.size).toBe(0);
  });
  it('usa la chiave data', () => {
    const d = deposito();
    const a = archivioDa(d, 'altra');
    a.scrivi('x');
    expect([...d.dati.keys()]).toEqual(['altra']);
  });
  it('legge e cancella sulla chiave data, lasciando stare le altre', () => {
    const d = deposito();
    d.setItem('altra', 'mia');
    d.setItem(CHIAVE_RECUPERO, 'standard');
    const a = archivioDa(d, 'altra');
    expect(a.leggi()).toBe('mia');
    a.cancella();
    expect([...d.dati.entries()]).toEqual([[CHIAVE_RECUPERO, 'standard']]);
    expect(archivioDa(d).leggi()).toBe('standard');
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

describe('T304: Recupero, scrittura ritardata', () => {
  it('segnala non scrive subito: mette un solo timer col ritardo predefinito', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    expect(a.scritture).toEqual([]);
    expect(t.chiamate.map((c) => c.ms)).toEqual([2000]);
    expect(r.esito).toBeNull();
  });
  it('quando il timer scatta scrive titolo, documento e ora data da "ora"', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('Il titolo', conTesto('testo'));
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0])).toEqual({ v: 1, titolo: 'Il titolo', salvato: 1234, doc: serializza(conTesto('testo')) });
    expect(r.esito).toBe('scritto');
    expect(t.annullati).toEqual([]);
  });
  it('il ritardo si può cambiare', () => {
    const { r, t } = recupero(archivioFinto(), { ritardo: 50 });
    r.segnala('t', conTesto('a'));
    expect(t.chiamate[0].ms).toBe(50);
  });
  it('più segnalazioni prima dello scatto fanno un solo timer e si scrive l\'ultima versione', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('uno', conTesto('a'));
    r.segnala('due', conTesto('ab'));
    r.segnala('tre', conTesto('abc'));
    expect(t.chiamate).toHaveLength(1);
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    const dati = JSON.parse(a.scritture[0]);
    expect(dati.titolo).toBe('tre');
    expect(dati.doc).toBe(serializza(conTesto('abc')));
  });
  it('dopo lo scatto una nuova modifica mette un nuovo timer', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    t.scatta();
    r.segnala('t', conTesto('ab'));
    expect(t.chiamate).toHaveLength(2);
    t.scatta();
    expect(a.scritture).toHaveLength(2);
    expect(JSON.parse(a.scritture[1]).doc).toBe(serializza(conTesto('ab')));
  });
  it('senza timer finto usa i timer veri: nulla prima di 2000 ms, la copia a 2000 ms', () => {
    vi.useFakeTimers();
    const a = archivioFinto();
    const r = new Recupero(a);
    r.segnala('t', conTesto('a'));
    vi.advanceTimersByTime(1999);
    expect(a.scritture).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(a.scritture).toHaveLength(1);
    expect(r.esito).toBe('scritto');
  });
  it('senza "ora" l\'ora della copia è quella vera', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    const a = archivioFinto();
    const r = new Recupero(a);
    r.segnala('t', conTesto('a'));
    vi.advanceTimersByTime(2000);
    expect(JSON.parse(a.scritture[0]).salvato).toBe(Date.parse('2026-11-01T10:00:02Z'));
  });
});

describe('T304: Recupero, scriviOra', () => {
  it('scrive subito quello che è in attesa e cancella il timer', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scriviOra();
    expect(a.scritture).toHaveLength(1);
    expect(t.annullati).toEqual([1]);
    expect(r.esito).toBe('scritto');
  });
  it('dopo scriviOra una nuova modifica mette un nuovo timer', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scriviOra();
    r.segnala('t', conTesto('ab'));
    expect(t.chiamate).toHaveLength(2);
    t.scatta();
    expect(a.scritture).toHaveLength(2);
  });
  it('dopo scriviOra un timer rimasto per errore non scrive una seconda volta', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scriviOra();
    t.scatta();
    expect(a.scritture).toHaveLength(1);
  });
  it('senza niente in attesa non fa niente', () => {
    const a = archivioFinto('vecchia');
    const { r, t } = recupero(a);
    r.scriviOra();
    expect(a.scritture).toEqual([]);
    expect(a.cancellazioni).toBe(0);
    expect(a.contenuto).toBe('vecchia');
    expect(t.annullati).toEqual([]);
    expect(r.esito).toBeNull();
  });
  it('un documento vuoto cancella la copia invece di scriverla', () => {
    const a = archivioFinto('vecchia');
    const { r } = recupero(a);
    r.segnala('t', documentoVuoto());
    r.scriviOra();
    expect(a.scritture).toEqual([]);
    expect(a.cancellazioni).toBe(1);
    expect(a.contenuto).toBeNull();
    expect(r.esito).toBe('vuoto');
  });
  it('una copia lunga esattamente il massimo si scrive, un carattere in più no (e la vecchia resta)', () => {
    // le 'a' non si raddoppiano né nel documento né nel pacchetto: la lunghezza cresce di un carattere per ogni 'a'
    const resto = pacchettoRecupero('t', conTesto('a'), 1234).length - 1;
    const giusta = archivioFinto();
    const uno = recupero(giusta).r;
    uno.segnala('t', conTesto('a'.repeat(LUNGHEZZA_MASSIMA_RECUPERO - resto)));
    uno.scriviOra();
    expect(giusta.scritture).toHaveLength(1);
    expect(giusta.scritture[0].length).toBe(LUNGHEZZA_MASSIMA_RECUPERO);
    expect(uno.esito).toBe('scritto');
    const grande = archivioFinto('vecchia');
    const due = recupero(grande).r;
    due.segnala('t', conTesto('a'.repeat(LUNGHEZZA_MASSIMA_RECUPERO - resto + 1)));
    due.scriviOra();
    expect(grande.scritture).toEqual([]);
    expect(grande.cancellazioni).toBe(0);
    expect(grande.contenuto).toBe('vecchia');
    expect(due.esito).toBe('troppo-grande');
  });
  it('se il deposito rifiuta la scrittura l\'esito è errore', () => {
    const a = archivioFinto(null, false);
    const { r } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scriviOra();
    expect(a.scritture).toHaveLength(1);
    expect(r.esito).toBe('errore');
  });
  it('l\'esito segue l\'ultima scrittura', () => {
    const a = archivioFinto();
    const { r } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scriviOra();
    expect(r.esito).toBe('scritto');
    r.segnala('t', documentoVuoto());
    r.scriviOra();
    expect(r.esito).toBe('vuoto');
  });
});

describe('T304: Recupero, trova e scarta', () => {
  it('trova rilegge la copia scritta', () => {
    const a = archivioFinto();
    const { r } = recupero(a);
    r.segnala('Relazione', conTesto('uno\ndue'));
    r.scriviOra();
    const trovato = r.trova()!;
    expect(trovato.titolo).toBe('Relazione');
    expect(trovato.salvato).toBe(1234);
    expect(testoDi(trovato.doc)).toBe('uno\ndue');
  });
  it('trova dà null se non c\'è niente o la copia è rovinata', () => {
    expect(recupero(archivioFinto()).r.trova()).toBeNull();
    expect(recupero(archivioFinto('{rotto')).r.trova()).toBeNull();
  });
  it('trova funziona anche su una copia scritta da un\'altra sessione', () => {
    const a = archivioFinto(pacchettoRecupero('Ieri', conTesto('testo di ieri'), 7));
    const r = recupero(a).r.trova()!;
    expect(r.titolo).toBe('Ieri');
    expect(r.salvato).toBe(7);
  });
  it('scarta cancella la copia, cancella il timer e annulla quello che era in attesa', () => {
    const a = archivioFinto('vecchia');
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scarta();
    expect(a.cancellazioni).toBe(1);
    expect(a.contenuto).toBeNull();
    expect(t.annullati).toEqual([1]);
    t.scatta();
    r.scriviOra();
    expect(a.scritture).toEqual([]);
  });
  it('scarta senza niente in attesa cancella comunque la copia', () => {
    const a = archivioFinto('vecchia');
    const { r, t } = recupero(a);
    r.scarta();
    expect(a.cancellazioni).toBe(1);
    expect(t.annullati).toEqual([]);
  });
  it('dopo scarta una nuova modifica rimette il timer e riscrive', () => {
    const a = archivioFinto();
    const { r, t } = recupero(a);
    r.segnala('t', conTesto('a'));
    r.scarta();
    r.segnala('t', conTesto('ab'));
    expect(t.chiamate).toHaveLength(2);
    t.scatta();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0]).doc).toBe(serializza(conTesto('ab')));
  });
});

describe('T304: prova con il deposito vero del browser', () => {
  it('una copia scritta si rilegge anche con un\'altra istanza, finché non si scarta', () => {
    const d = deposito();
    const uno = new Recupero(archivioDa(d));
    uno.segnala('Bozza', conTesto('prima riga'));
    uno.scriviOra();
    const due = new Recupero(archivioDa(d));
    expect(due.trova()!.titolo).toBe('Bozza');
    due.scarta();
    expect(new Recupero(archivioDa(d)).trova()).toBeNull();
    expect(d.dati.size).toBe(0);
  });
});
