import { describe, it, expect } from 'vitest';
import {
  alternaSegno, applicaAttributo, cursore, daTesto, deserializza, formatoSelezione, impostaAttributo, inserisciTesto, linkIn,
  normalizza, pulisciFormato, serializza, statoIniziale, testoDi, urlValido,
  type Documento, type Selezione, type Stato,
} from '../../src/modello/documento';
import { inserisciLink, linkAl, normalizzaUrl, rimuoviLink, statoLink } from '../../src/editor/link';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';

const URL1 = 'https://esempio.it/a';
const URL2 = 'https://altro.it';
const sel = (p: number, da: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p, o: a } });
/** "uno due tre" con "due" come link (posizioni 4-7) */
function conLink(testo = 'uno due tre', da = 4, a = 7, url = URL1): Stato {
  return statoIniziale(applicaAttributo(daTesto(testo), sel(0, da, a), 'u', url));
}
const runs = (d: Documento) => d.paragrafi[0].runs.map((r) => [r.t, r.u]);

describe('T090: indirizzi dei link', () => {
  it('urlValido accetta solo http, https e mailto, senza spazi né caratteri di controllo', () => {
    for (const ok of ['http://a.it', 'https://esempio.it/a?b=1#c', 'HTTPS://A.IT', 'mailto:me@esempio.it']) expect(urlValido(ok), ok).toBe(true);
    for (const no of ['', 'javascript:alert(1)', 'data:text/html,x', 'ftp://a.it', 'file:///c:/x', 'https://', 'http:///x', 'https://a b.it', 'https://a.it/\nx', 'mailto:', 'www.esempio.it', ' https://a.it', 'https://a.it/\u0000']) {
      expect(urlValido(no), JSON.stringify(no)).toBe(false);
    }
    expect(urlValido('https://a.it/' + 'x'.repeat(2000))).toBe(false);
  });

  it('normalizzaUrl completa quello che scrive l\'utente e rifiuta il resto', () => {
    expect(normalizzaUrl('  https://esempio.it/x ')).toBe('https://esempio.it/x');
    expect(normalizzaUrl('www.esempio.it')).toBe('https://www.esempio.it');
    expect(normalizzaUrl('esempio.it/pagina?a=1')).toBe('https://esempio.it/pagina?a=1');
    expect(normalizzaUrl('esempio.it:8080/x')).toBe('https://esempio.it:8080/x');
    expect(normalizzaUrl('me@esempio.it')).toBe('mailto:me@esempio.it');
    expect(normalizzaUrl('mailto:me@esempio.it')).toBe('mailto:me@esempio.it');
    for (const no of ['', '   ', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'ftp://a.it', 'una frase con spazi', 'parola', 'http://', 'https://a b.it']) {
      expect(normalizzaUrl(no), JSON.stringify(no)).toBeNull();
    }
  });
});

describe('T090: il link nel modello', () => {
  it('il link si mette su una selezione, si legge dal formato solo se è uguale in tutto il testo e si toglie', () => {
    const d = daTesto('uno due tre');
    const con = applicaAttributo(d, sel(0, 4, 7), 'u', URL1);
    expect(runs(con)).toEqual([['uno ', undefined], ['due', URL1], [' tre', undefined]]);
    expect(formatoSelezione(con, sel(0, 4, 7)).u).toBe(URL1);
    expect(formatoSelezione(con, sel(0, 0, 7)).u).toBeUndefined();
    expect(runs(applicaAttributo(con, sel(0, 0, 11), 'u', undefined))).toEqual([['uno due tre', undefined]]);
    for (const r of con.paragrafi[0].runs) expect(Object.keys(r).includes('u') === (r.t === 'due')).toBe(true);
  });

  it('due link diversi non si fondono, due uguali e vicini sì', () => {
    const base = daTesto('abcdef');
    const diversi = applicaAttributo(applicaAttributo(base, sel(0, 0, 3), 'u', URL1), sel(0, 3, 6), 'u', URL2);
    expect(runs(diversi)).toEqual([['abc', URL1], ['def', URL2]]);
    const uguali = applicaAttributo(applicaAttributo(base, sel(0, 0, 3), 'u', URL1), sel(0, 3, 6), 'u', URL1);
    expect(runs(uguali)).toEqual([['abcdef', URL1]]);
    expect(normalizza([{ t: 'a', g: false, c: false, s: false, u: URL1 }, { t: 'b', g: false, c: false, s: false }]).length).toBe(2);
  });

  it('il testo scritto dentro un link resta nel link, ai due bordi no', () => {
    const s = conLink();
    const dentro = inserisciTesto({ ...s, sel: cursore(0, 6) }, 'X');
    expect(runs(dentro.doc)).toEqual([['uno ', undefined], ['duXe', URL1], [' tre', undefined]]);
    const fine = inserisciTesto({ ...s, sel: cursore(0, 7) }, 'X');
    expect(runs(fine.doc)).toEqual([['uno ', undefined], ['due', URL1], ['X tre', undefined]]);
    const inizio = inserisciTesto({ ...s, sel: cursore(0, 4) }, 'X');
    expect(runs(inizio.doc)).toEqual([['uno X', undefined], ['due', URL1], [' tre', undefined]]);
    expect(linkIn(s.doc, { p: 0, o: 5 })).toBe(URL1);
    expect(linkIn(s.doc, { p: 0, o: 4 })).toBeUndefined();
    expect(linkIn(s.doc, { p: 0, o: 7 })).toBeUndefined();
  });

  it('sostituire un pezzo di testo interno al link lo lascia nel link; sostituire a cavallo del bordo no', () => {
    const s = conLink();
    const interno = inserisciTesto({ ...s, sel: sel(0, 5, 6) }, 'ZZ');
    expect(runs(interno.doc)).toEqual([['uno ', undefined], ['dZZe', URL1], [' tre', undefined]]);
    const bordo = inserisciTesto({ ...s, sel: sel(0, 6, 9) }, 'ZZ');
    expect(runs(bordo.doc)).toEqual([['uno ', undefined], ['du', URL1], ['ZZre', undefined]]);
  });

  it('grassetto o corpo scelti col cursore a fine link non portano il link nel testo che si scrive', () => {
    const s = conLink();
    const g = alternaSegno({ ...s, sel: cursore(0, 7) }, 'g');
    expect(g.pendenti?.u).toBeUndefined();
    const fine = inserisciTesto(g, 'X');
    expect(runs(fine.doc).slice(2)).toEqual([['X', undefined], [' tre', undefined]]);
    expect(fine.doc.paragrafi[0].runs[2].g).toBe(true);
    const z = impostaAttributo({ ...s, sel: cursore(0, 7) }, 'z', 18);
    expect(z.pendenti?.u).toBeUndefined();
  });

  it('cancella formattazione toglie grassetto e colori ma lascia il link', () => {
    let s = conLink();
    s = { ...s, doc: applicaAttributo(s.doc, sel(0, 4, 7), 'k', '#ff0000') };
    const pulito = pulisciFormato(s.doc, sel(0, 0, 11));
    expect(runs(pulito)).toEqual([['uno ', undefined], ['due', URL1], [' tre', undefined]]);
    expect(pulito.paragrafi[0].runs[1].k).toBeUndefined();
  });

  it('si salva e si rilegge senza perdere il link; un indirizzo non ammesso rende il file non valido', () => {
    const d = conLink().doc;
    const testo = serializza(d);
    expect(testo).toContain('"u":"https://esempio.it/a"');
    expect(serializza(deserializza(testo))).toBe(testo);
    expect(runs(deserializza(testo))).toEqual(runs(d));
    expect(serializza(daTesto('senza link'))).not.toContain('"u"');
    const sbagliato = (u: unknown) => JSON.stringify({ v: 1, p: [[{ t: 'x', u }]] });
    expect(() => deserializza(sbagliato('javascript:alert(1)'))).toThrow(/link/);
    expect(() => deserializza(sbagliato(5))).toThrow(/link/);
    expect(() => deserializza(sbagliato(''))).toThrow(/link/);
    expect(deserializza(sbagliato('mailto:a@b.it')).paragrafi[0].runs[0].u).toBe('mailto:a@b.it');
  });
});

describe('T090: trovare e modificare i link', () => {
  it('linkAl trova il tratto intero dal cursore dentro, a fine link o toccando il testo dopo; null altrove', () => {
    const d = conLink().doc;
    for (const o of [5, 6, 7]) expect(linkAl(d, { p: 0, o }), String(o)).toEqual({ p: 0, da: 4, a: 7, u: URL1, testo: 'due' });
    expect(linkAl(d, { p: 0, o: 4 })).toEqual({ p: 0, da: 4, a: 7, u: URL1, testo: 'due' });
    expect(linkAl(d, { p: 0, o: 3 })).toBeNull();
    expect(linkAl(d, { p: 0, o: 8 })).toBeNull();
    expect(linkAl(daTesto('niente'), { p: 0, o: 2 })).toBeNull();
  });

  it('statoLink: cursore sul link, cursore fuori, selezione con link, selezione mista', () => {
    const s = conLink();
    expect(statoLink({ ...s, sel: cursore(0, 5) })).toEqual({ url: URL1, testo: 'due', selezione: false });
    expect(statoLink({ ...s, sel: cursore(0, 1) })).toEqual({ url: null, testo: '', selezione: false });
    expect(statoLink({ ...s, sel: sel(0, 4, 7) })).toEqual({ url: URL1, testo: 'due', selezione: true });
    expect(statoLink({ ...s, sel: sel(0, 0, 3) })).toEqual({ url: null, testo: 'uno', selezione: true });
    expect(statoLink({ ...s, sel: sel(0, 2, 6) })).toEqual({ url: null, testo: 'o du', selezione: true });
  });

  it('inserisciLink con testo selezionato fa diventare link la selezione', () => {
    const s = { ...statoIniziale(daTesto('uno due tre')), sel: sel(0, 4, 7) };
    const n = inserisciLink(s, 'www.esempio.it');
    expect(runs(n.doc)).toEqual([['uno ', undefined], ['due', 'https://www.esempio.it'], [' tre', undefined]]);
    expect(n.sel).toEqual(sel(0, 4, 7));
  });

  it('inserisciLink col cursore fuori da un link scrive il testo dato, o l\'indirizzo, e il cursore resta dopo', () => {
    const s = { ...statoIniziale(daTesto('ab cd')), sel: cursore(0, 3) };
    const a = inserisciLink(s, URL2, 'sito');
    expect(runs(a.doc)).toEqual([['ab ', undefined], ['sito', URL2], ['cd', undefined]]);
    expect(a.sel).toEqual(cursore(0, 7));
    const b = inserisciLink(s, URL2);
    expect(testoDi(b.doc)).toBe('ab ' + URL2 + 'cd');
    expect(b.sel).toEqual(cursore(0, 3 + URL2.length));
    const c = inserisciLink(s, URL2, 'due\nrighe');
    expect(testoDi(c.doc)).toBe('ab due righecd');
  });

  it('inserisciLink col cursore dentro un link cambia l\'indirizzo, e il testo se è diverso, tenendo il formato', () => {
    const s = conLink();
    const indirizzo = inserisciLink({ ...s, sel: cursore(0, 5) }, URL2, 'due');
    expect(runs(indirizzo.doc)).toEqual([['uno ', undefined], ['due', URL2], [' tre', undefined]]);
    const g = { ...s, doc: applicaAttributo(s.doc, sel(0, 4, 7), 'g', true) };
    const testo = inserisciLink({ ...g, sel: cursore(0, 5) }, URL2, 'quattro');
    expect(testoDi(testo.doc)).toBe('uno quattro tre');
    expect(testo.doc.paragrafi[0].runs.map((r) => [r.t, r.u, r.g])).toEqual([['uno ', undefined, false], ['quattro', URL2, true], [' tre', undefined, false]]);
    expect(testo.sel).toEqual(cursore(0, 11));
  });

  it('un indirizzo non valido non cambia niente: viene restituito lo stesso stato', () => {
    const s = { ...statoIniziale(daTesto('uno due')), sel: sel(0, 0, 3) };
    expect(inserisciLink(s, 'javascript:alert(1)')).toBe(s);
    expect(inserisciLink(s, '   ')).toBe(s);
    const dentro = { ...s, sel: cursore(0, 2) };
    expect(inserisciLink(dentro, 'frase con spazi', 'x')).toBe(dentro);
  });

  it('rimuoviLink toglie il link dalla selezione o da quello sotto il cursore, lasciando il testo', () => {
    const s = conLink();
    expect(runs(rimuoviLink({ ...s, sel: cursore(0, 5) }).doc)).toEqual([['uno due tre', undefined]]);
    expect(runs(rimuoviLink({ ...s, sel: sel(0, 0, 11) }).doc)).toEqual([['uno due tre', undefined]]);
    expect(runs(rimuoviLink({ ...s, sel: sel(0, 5, 6) }).doc)).toEqual([['uno ', undefined], ['d', URL1], ['u', undefined], ['e', URL1], [' tre', undefined]]);
    const fuori = { ...s, sel: cursore(0, 1) };
    expect(rimuoviLink(fuori)).toBe(fuori);
    const senza = { ...statoIniziale(daTesto('niente')), sel: sel(0, 0, 3) };
    expect(rimuoviLink(senza)).toBe(senza);
  });

  it('rimuovere il link da una parte soltanto lo spezza in due link', () => {
    const s = conLink('abcdef', 0, 6);
    const n = rimuoviLink({ ...s, sel: sel(0, 2, 4) });
    expect(runs(n.doc)).toEqual([['ab', URL1], ['cd', undefined], ['ef', URL1]]);
  });
});

describe('T090: le azioni link e togliLink', () => {
  it('link e togliLink passano da annulla e ripeti, un passo ciascuno', () => {
    const base = statoIniziale(daTesto('uno due tre'));
    let ed = nuovoEditor({ ...base, sel: sel(0, 4, 7) });
    const dopo = eseguiAzioneFormato(ed, { tipo: 'link', url: URL1 }).ed;
    expect(runs(statoCorrente(dopo).doc)[1]).toEqual(['due', URL1]);
    const tolto = eseguiAzioneFormato(dopo, { tipo: 'togliLink' }).ed;
    expect(runs(statoCorrente(tolto).doc)).toEqual([['uno due tre', undefined]]);
    const indietro = eseguiAzioneFormato(tolto, { tipo: 'annulla' }).ed;
    expect(runs(statoCorrente(indietro).doc)[1]).toEqual(['due', URL1]);
    ed = eseguiAzioneFormato(indietro, { tipo: 'annulla' }).ed;
    expect(runs(statoCorrente(ed).doc)).toEqual([['uno due tre', undefined]]);
  });

  it('un indirizzo non valido o niente da togliere non registra nessun passo di annulla', () => {
    const ed = nuovoEditor({ ...statoIniziale(daTesto('uno due tre')), sel: sel(0, 4, 7) });
    expect(eseguiAzioneFormato(ed, { tipo: 'link', url: 'javascript:alert(1)' }).ed).toBe(ed);
    expect(eseguiAzioneFormato(ed, { tipo: 'togliLink' }).ed).toBe(ed);
  });
});
