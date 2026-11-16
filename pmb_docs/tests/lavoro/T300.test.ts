import { describe, it, expect } from 'vitest';
import {
  CAMPO_PAGINA, CAMPO_PAGINE, OGGETTO, RIGHE_MARGINE_MASSIME,
  alternaElenco, alternaSegno, allineamentoMargine, applicaAttributo, applicaParagrafo, applicaSegno, cambiaRientro, cancella, cancellaSelezione, conParagrafi,
  controllaMargine, cursore, daTesto, deserializza, documentiUguali, documentoVuoto, impostaAttributo, impostaIntestazione, impostaLarghezzaImmagine, impostaPiede,
  inserisciImmagine, inserisciTesto, paragrafiConCampi, paragrafiDaTesto, pulisciFormato, serializza, statoIniziale, testoDaParagrafi, testoDi, testoParagrafo,
  type Documento, type Paragrafo, type Run, type Selezione, type Stato,
} from '../../src/modello/documento';
import { inserisciTabella, modificaTabella, type OperazioneTabella } from '../../src/editor/tabelle';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const sel = (p: number, da: number, p2: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p: p2, o: a } });
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const par = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [run(t)] });
function congela<T>(o: T): T {
  if (o && typeof o === 'object') { for (const v of Object.values(o as object)) congela(v); Object.freeze(o); }
  return o;
}
const INTESTAZIONE: Paragrafo[] = [par('Relazione', { al: 'ce' })];
const PIEDE: Paragrafo[] = [par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`, { al: 'dx' })];
function conMargini(testo = 'abc def\nxyz'): Documento { return impostaPiede(impostaIntestazione(daTesto(testo), INTESTAZIONE), PIEDE); }
const stato = (d: Documento, s: Selezione = cursore(0, 2)): Stato => ({ ...statoIniziale(d), sel: s });

describe('T300 intestazione e piè di pagina nel modello', () => {
  it('i campi sono due caratteri diversi e fuori dal testo normale', () => {
    expect(CAMPO_PAGINA).toBe('');
    expect(CAMPO_PAGINE).toBe('');
    expect(RIGHE_MARGINE_MASSIME).toBe(3);
    expect(documentoVuoto()).toEqual({ paragrafi: [{ runs: [] }] });
    expect(Object.keys(daTesto('ciao'))).toEqual(['paragrafi']);
  });

  it('ogni modifica del corpo conserva intestazione e piè di pagina', () => {
    const base = conMargini();
    const conserva = (d: Documento, nome: string) => {
      expect(d.intestazione, nome).toEqual(INTESTAZIONE);
      expect(d.piede, nome).toEqual(PIEDE);
    };
    const s = stato(base);
    conserva(inserisciTesto(s, 'x').doc, 'inserisciTesto');
    conserva(inserisciTesto(s, 'x\ny\nz').doc, 'inserisciTesto con a capo');
    conserva(inserisciTesto({ ...s, sel: sel(0, 1, 1, 2) }, 'q').doc, 'inserisciTesto su più paragrafi');
    conserva(cancella(s, 'indietro').doc, 'cancella indietro');
    conserva(cancella({ ...s, sel: cursore(0, 7) }, 'avanti').doc, 'cancella avanti unendo paragrafi');
    conserva(cancellaSelezione({ ...s, sel: sel(0, 1, 0, 3) }).doc, 'cancellaSelezione');
    conserva(alternaSegno({ ...s, sel: sel(0, 0, 0, 3) }, 'g').doc, 'alternaSegno');
    conserva(impostaAttributo({ ...s, sel: sel(0, 0, 0, 3) }, 'z', 14).doc, 'impostaAttributo');
    conserva(applicaSegno(base, sel(0, 0, 1, 2), 'c', true), 'applicaSegno');
    conserva(applicaAttributo(base, sel(0, 0, 1, 2), 'k', '#ff0000'), 'applicaAttributo');
    conserva(applicaParagrafo(base, sel(0, 0, 1, 1), 'al', 'ce'), 'applicaParagrafo');
    conserva(cambiaRientro(base, sel(0, 0, 1, 1), 1), 'cambiaRientro');
    conserva(alternaElenco(base, sel(0, 0, 1, 1), 'p'), 'alternaElenco');
    conserva(pulisciFormato(base, sel(0, 0, 1, 1)), 'pulisciFormato');
    const conImmagine = inserisciImmagine(s, { s: PNG, w: 200, h: 100 });
    conserva(conImmagine.doc, 'inserisciImmagine');
    conserva(impostaLarghezzaImmagine({ ...conImmagine, sel: sel(0, 2, 0, 3) }, 100).doc, 'impostaLarghezzaImmagine');
    const conTabella = inserisciTabella(s, 2, 2);
    conserva(conTabella.doc, 'inserisciTabella');
    const operazioni: OperazioneTabella[] = ['rigaSopra', 'rigaSotto', 'colonnaPrima', 'colonnaDopo', 'eliminaRiga', 'eliminaColonna', 'eliminaTabella'];
    for (const op of operazioni) conserva(modificaTabella(conTabella, op).doc, `modificaTabella ${op}`);
    const unaRiga = inserisciTabella(s, 1, 1);
    conserva(modificaTabella(unaRiga, 'eliminaRiga').doc, 'eliminaRiga dell\'ultima riga');
    conserva(modificaTabella(unaRiga, 'eliminaColonna').doc, 'eliminaColonna dell\'ultima colonna');
  });

  it('il testo del corpo non comprende intestazione e piè di pagina', () => {
    const d = conMargini('uno\ndue');
    expect(testoDi(d)).toBe('uno\ndue');
    expect(d.paragrafi.length).toBe(2);
  });

  it('conParagrafi cambia solo il corpo e non tocca l\'originale', () => {
    const d = congela(conMargini());
    const n = conParagrafi(d, [par('nuovo')]);
    expect(n.paragrafi).toEqual([par('nuovo')]);
    expect(n.intestazione).toEqual(INTESTAZIONE);
    expect(n.piede).toEqual(PIEDE);
    expect(testoDi(d)).toBe('abc def\nxyz');
    expect(conParagrafi(daTesto('a'), [par('b')])).toEqual({ paragrafi: [par('b')] });
  });

  it('impostaIntestazione e impostaPiede mettono i paragrafi, ognuno al suo posto, senza toccare l\'ingresso', () => {
    const d = congela(daTesto('corpo'));
    const conI = impostaIntestazione(d, congela([par('Testata', { al: 'ce' })]));
    expect(conI.intestazione).toEqual([par('Testata', { al: 'ce' })]);
    expect(conI.piede).toBeUndefined();
    expect('piede' in conI).toBe(false);
    const conP = impostaPiede(conI, [par('Fine', { al: 'dx' })]);
    expect(conP.piede).toEqual([par('Fine', { al: 'dx' })]);
    expect(conP.intestazione).toEqual([par('Testata', { al: 'ce' })]);
    expect(d).toEqual({ paragrafi: [par('corpo')] });
    expect(Object.keys(d)).toEqual(['paragrafi']);
    const sostituita = impostaIntestazione(conP, [par('Altra')]);
    expect(sostituita.intestazione).toEqual([par('Altra')]);
    expect(sostituita.piede).toEqual([par('Fine', { al: 'dx' })]);
  });

  it('i tratti si fondono e gli attributi ammessi restano', () => {
    const d = impostaIntestazione(daTesto('x'), [
      { al: 'dx', runs: [run('a', { g: true }), run('b', { g: true }), run('c', { c: true, s: true, f: 'Roboto', z: 14, k: '#112233', h: '#ffff00' })] },
      { runs: [] },
    ]);
    expect(d.intestazione).toEqual([
      { al: 'dx', runs: [run('ab', { g: true }), run('c', { c: true, s: true, f: 'Roboto', z: 14, k: '#112233', h: '#ffff00' })] },
      { runs: [] },
    ]);
  });

  it('nessun paragrafo, solo paragrafi vuoti o undefined tolgono l\'intestazione e il piè di pagina', () => {
    const d = conMargini();
    for (const vuoto of [undefined, [], [{ runs: [] }], [{ al: 'ce' as const, runs: [] }, { runs: [] }]]) {
      const i = impostaIntestazione(d, vuoto);
      expect('intestazione' in i, JSON.stringify(vuoto)).toBe(false);
      expect(i.piede).toEqual(PIEDE);
      const p = impostaPiede(d, vuoto);
      expect('piede' in p, JSON.stringify(vuoto)).toBe(false);
      expect(p.intestazione).toEqual(INTESTAZIONE);
    }
  });

  it('controllaMargine dice perché un blocco non è ammesso', () => {
    expect(controllaMargine([par('ok')])).toBeNull();
    expect(controllaMargine([par('a'), par('b'), par('c')])).toBeNull();
    expect(controllaMargine([par('x'.repeat(300))])).toBeNull();
    expect(controllaMargine([])).toBe('da 1 a 3 paragrafi');
    expect(controllaMargine([par('a'), par('b'), par('c'), par('d')])).toBe('da 1 a 3 paragrafi');
    expect(controllaMargine(undefined as unknown as Paragrafo[])).toBe('da 1 a 3 paragrafi');
    for (const extra of [{ el: 'p' }, { ri: 2 }, { st: '1' }, { tb: { i: 0, r: 0, c: 0 } }, { ls: 2 }]) {
      expect(controllaMargine([par('a', extra as Partial<Paragrafo>)]), JSON.stringify(extra)).toBe("solo l'allineamento");
    }
    expect(controllaMargine([par('x'.repeat(301))])).toBe('riga troppo lunga');
    expect(controllaMargine([{ runs: [run(OGGETTO, { im: { s: PNG, w: 1, h: 1 } })] }])).toBe('niente immagini né link');
    expect(controllaMargine([{ runs: [run('a', { u: 'https://esempio.it' })] }])).toBe('niente immagini né link');
    expect(controllaMargine([par(`a${OGGETTO}b`)])).toBe('niente immagini né link');
  });

  it('un\'intestazione o un piè di pagina non ammessi danno un errore chiaro e non cambiano il documento', () => {
    const d = congela(conMargini());
    const quattro = [par('a'), par('b'), par('c'), par('d')];
    expect(() => impostaIntestazione(d, quattro)).toThrow('Intestazione non valido: da 1 a 3 paragrafi');
    expect(() => impostaPiede(d, quattro)).toThrow('Piè di pagina non valido: da 1 a 3 paragrafi');
    expect(() => impostaPiede(d, [par('a', { el: 'n' })])).toThrow("Piè di pagina non valido: solo l'allineamento");
    expect(() => impostaIntestazione(d, [par('x'.repeat(301))])).toThrow('Intestazione non valido: riga troppo lunga');
    expect(d.intestazione).toEqual(INTESTAZIONE);
  });

  it('paragrafiConCampi: i campi diventano i numeri della pagina', () => {
    const origine = congela([
      { al: 'dx' as const, runs: [run('Pag. ', { g: true }), run(CAMPO_PAGINA), run(' di ', { g: true }), run(CAMPO_PAGINE)] },
      par(`${CAMPO_PAGINA}/${CAMPO_PAGINA}/${CAMPO_PAGINE}`),
      par('niente campi'),
      { runs: [] },
    ]);
    const r = paragrafiConCampi(origine, 3, 12);
    expect(r[0]).toEqual({ al: 'dx', runs: [run('Pag. ', { g: true }), run('3'), run(' di ', { g: true }), run('12')] });
    expect(r[1]).toEqual(par('3/3/12'));
    expect(r[2]).toEqual(par('niente campi'));
    expect(r[3]).toEqual({ runs: [] });
    expect(paragrafiConCampi(origine, 10, 100)[1]).toEqual(par('10/10/100'));
    expect(testoParagrafo(origine[1])).toBe(`${CAMPO_PAGINA}/${CAMPO_PAGINA}/${CAMPO_PAGINE}`);
    expect(paragrafiConCampi([], 1, 1)).toEqual([]);
    const fusi = paragrafiConCampi([{ runs: [run('a'), run(CAMPO_PAGINA), run('b')] }], 7, 9);
    expect(fusi[0].runs).toEqual([run('a7b')]);
  });

  it('paragrafiDaTesto: righe, campi tra graffe e allineamento', () => {
    expect(paragrafiDaTesto('uno\ndue')).toEqual([par('uno'), par('due')]);
    expect(paragrafiDaTesto('uno\ndue', 'ce')).toEqual([par('uno', { al: 'ce' }), par('due', { al: 'ce' })]);
    expect(paragrafiDaTesto('a', 'dx')).toEqual([par('a', { al: 'dx' })]);
    expect(paragrafiDaTesto('a', 'gi')).toEqual([par('a', { al: 'gi' })]);
    expect(Object.keys(paragrafiDaTesto('a', 'sx')[0])).toEqual(['runs']);
    expect(paragrafiDaTesto('Pag. {pagina} di {pagine}')).toEqual([par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`)]);
    expect(paragrafiDaTesto('{pagina}{pagina}{pagine}')).toEqual([par(`${CAMPO_PAGINA}${CAMPO_PAGINA}${CAMPO_PAGINE}`)]);
    expect(paragrafiDaTesto('{Pagina} {pag} {pagina')).toEqual([par('{Pagina} {pag} {pagina')]);
    expect(paragrafiDaTesto('a\r\nb\rc')).toEqual([par('a'), par('b'), par('c')]);
    expect(paragrafiDaTesto('a\n\nb')).toEqual([par('a'), { runs: [] }, par('b')]);
    expect(paragrafiDaTesto('a\n\n\n')).toEqual([par('a')]);
    expect(paragrafiDaTesto(`x${CAMPO_PAGINA}y${CAMPO_PAGINE}z${OGGETTO}w`)).toEqual([par('xyzw')]);
    expect(paragrafiDaTesto('')).toEqual([]);
    expect(paragrafiDaTesto('\n\n')).toEqual([]);
    expect(paragrafiDaTesto('a\nb\nc\nd').length).toBe(4);
  });

  it('testoDaParagrafi è il contrario di paragrafiDaTesto', () => {
    for (const t of ['solo testo', 'Pag. {pagina} di {pagine}', 'a\nb\nc', 'a\n\nb', '{pagine}']) expect(testoDaParagrafi(paragrafiDaTesto(t)), t).toBe(t);
    expect(testoDaParagrafi(undefined)).toBe('');
    expect(testoDaParagrafi([])).toBe('');
    expect(testoDaParagrafi(PIEDE)).toBe('Pag. {pagina} di {pagine}');
    expect(testoDaParagrafi([par(`${CAMPO_PAGINE}${CAMPO_PAGINA}`), { runs: [run('a', { g: true }), run('b')] }])).toBe('{pagine}{pagina}\nab');
  });

  it('allineamentoMargine: quello del primo paragrafo, a sinistra se manca', () => {
    expect(allineamentoMargine(undefined)).toBe('sx');
    expect(allineamentoMargine([])).toBe('sx');
    expect(allineamentoMargine([par('a')])).toBe('sx');
    expect(allineamentoMargine([par('a', { al: 'ce' }), par('b', { al: 'dx' })])).toBe('ce');
    expect(allineamentoMargine([par('a', { al: 'dx' })])).toBe('dx');
    expect(allineamentoMargine([par('a', { al: 'gi' })])).toBe('gi');
  });

  it('salvataggio: un documento senza intestazione né piè di pagina si scrive come prima', () => {
    expect(serializza(daTesto('ciao'))).toBe('{"v":1,"p":[[{"t":"ciao"}]]}');
    expect(serializza(applicaParagrafo(daTesto('ciao'), sel(0, 0, 0, 0), 'al', 'ce'))).toBe('{"v":1,"p":[{"a":{"al":"ce"},"r":[{"t":"ciao"}]}]}');
    expect(serializza(impostaIntestazione(daTesto('x'), undefined))).toBe('{"v":1,"p":[[{"t":"x"}]]}');
  });

  it('salvataggio: intestazione e piè di pagina vanno in ih e pf, dopo il corpo', () => {
    const d = conMargini('x');
    const j = JSON.parse(serializza(d));
    expect(Object.keys(j)).toEqual(['v', 'p', 'ih', 'pf']);
    expect(j.ih).toEqual([{ a: { al: 'ce' }, r: [{ t: 'Relazione' }] }]);
    expect(j.pf).toEqual([{ a: { al: 'dx' }, r: [{ t: `Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}` }] }]);
    expect(Object.keys(JSON.parse(serializza(impostaPiede(daTesto('x'), PIEDE))))).toEqual(['v', 'p', 'pf']);
    expect(Object.keys(JSON.parse(serializza(impostaIntestazione(daTesto('x'), INTESTAZIONE))))).toEqual(['v', 'p', 'ih']);
  });

  it('salvataggio: scritto e riletto è uguale, con formattazione dentro le righe', () => {
    const d = impostaPiede(impostaIntestazione(daTesto('corpo\nsecondo'), [
      { al: 'ce', runs: [run('Ti', { g: true }), run('tolo', { c: true, f: 'Roboto', z: 14, k: '#102030' })] }, par('seconda riga'),
    ]), [par(`${CAMPO_PAGINA}`, { al: 'dx' }), par(`di ${CAMPO_PAGINE}`)]);
    const r = deserializza(serializza(d));
    expect(r).toEqual(d);
    expect(documentiUguali(r, d)).toBe(true);
    expect(deserializza(serializza(daTesto('niente')))).toEqual(daTesto('niente'));
    expect('intestazione' in deserializza(serializza(daTesto('niente')))).toBe(false);
  });

  it('documentiUguali vede le differenze nell\'intestazione e nel piè di pagina', () => {
    const a = conMargini();
    expect(documentiUguali(a, conMargini())).toBe(true);
    expect(documentiUguali(a, impostaIntestazione(a, [par('Altra')]))).toBe(false);
    expect(documentiUguali(a, impostaPiede(a, [par('Altro')]))).toBe(false);
    expect(documentiUguali(a, impostaPiede(a, undefined))).toBe(false);
    expect(documentiUguali(daTesto('a'), impostaIntestazione(daTesto('a'), [par('x')]))).toBe(false);
  });

  it('apertura: intestazioni e piè di pagina non validi si rifiutano, quelli vuoti si ignorano', () => {
    const base = (extra: Record<string, unknown>) => JSON.stringify({ v: 1, p: [[{ t: 'x' }]], ...extra });
    expect(() => deserializza(base({ ih: 'testo' }))).toThrow('Documento non valido: intestazione');
    expect(() => deserializza(base({ pf: { r: [] } }))).toThrow('Documento non valido: piè di pagina');
    expect(() => deserializza(base({ ih: [[{ t: 'a' }], [{ t: 'b' }], [{ t: 'c' }], [{ t: 'd' }]] }))).toThrow('Documento non valido: intestazione');
    expect(() => deserializza(base({ pf: [{ a: { tb: { i: 0, r: 0, c: 0 } }, r: [{ t: 'a' }] }] }))).toThrow('Documento non valido: piè di pagina');
    expect(() => deserializza(base({ ih: [{ a: { el: 'p' }, r: [{ t: 'a' }] }] }))).toThrow('Documento non valido: intestazione');
    expect(() => deserializza(base({ ih: [[{ t: OGGETTO, im: { s: PNG, w: 5, h: 5 } }]] }))).toThrow('Documento non valido: intestazione');
    expect(() => deserializza(base({ pf: [[{ t: 'link', u: 'https://esempio.it' }]] }))).toThrow('Documento non valido: piè di pagina');
    expect(() => deserializza(base({ ih: [[{ t: 'x'.repeat(301) }]] }))).toThrow('Documento non valido: intestazione');
    expect(() => deserializza(base({ ih: [{ r: 'no' }] }))).toThrow('Documento non valido: paragrafo');
    for (const vuoto of [[], [[]], [{ a: { al: 'ce' }, r: [] }, []]]) {
      const d = deserializza(base({ ih: vuoto, pf: vuoto }));
      expect('intestazione' in d, JSON.stringify(vuoto)).toBe(false);
      expect('piede' in d, JSON.stringify(vuoto)).toBe(false);
    }
    expect(deserializza(base({ ih: [[{ t: `${CAMPO_PAGINA}` }]] })).intestazione).toEqual([par(CAMPO_PAGINA)]);
  });

  it('apertura: il corpo non può contenere i campi', () => {
    expect(() => deserializza(JSON.stringify({ v: 1, p: [[{ t: `a${CAMPO_PAGINA}b` }]] }))).toThrow('Documento non valido: campo');
    expect(() => deserializza(JSON.stringify({ v: 1, p: [[{ t: 'ok' }], [{ t: `${CAMPO_PAGINE}` }]] }))).toThrow('Documento non valido: campo');
    expect(deserializza(JSON.stringify({ v: 1, p: [[{ t: 'ok' }]] }))).toEqual(daTesto('ok'));
    expect(() => deserializza('{"v":2,"p":[]}')).toThrow('Documento non valido: versione o paragrafi');
  });

  it('scrivendo o incollando nel corpo i caratteri dei campi si scartano', () => {
    expect(testoDi(inserisciTesto(statoIniziale(daTesto('')), `a${CAMPO_PAGINA}b${CAMPO_PAGINE}c`).doc)).toBe('abc');
    expect(testoDi(daTesto(`a${CAMPO_PAGINA}b${CAMPO_PAGINE}c\nd`))).toBe('abc\nd');
    expect(testoDi(inserisciTesto(statoIniziale(daTesto('x')), CAMPO_PAGINA).doc)).toBe('x');
  });
});
