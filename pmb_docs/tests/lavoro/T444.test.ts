// T444: componenti di base, bordi e linee, equazioni, grafici e disegno.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { leggiZip } from '@comune/formati/zip';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { esporta } from '../../src/formati/file';
import { disegna } from '../../src/editor/render';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import { inserisciBlocco, prossimoIdTabella } from '../../src/editor/blocchi';
import { COMPONENTI } from '../../src/guscio/componenti';
import { VOCI_BORDO } from '../../src/guscio/bordi-dati';
import { ErroreEquazione, componi, leggiEquazione, MODELLI_EQUAZIONE, type Disegnatore, type Nodo } from '../../src/guscio/equazione';
import { ErroreGrafico, RIGHE_MASSIME, calcolaScala, leggiDati, numeroDaTesto } from '../../src/guscio/grafico';
import { MENU } from '../../src/guscio/menu-dati';
import { BORDO_PREDEFINITO, bordoValido, cursore, daTesto, deserializza, impostaBordo, serializza, statoIniziale, type Documento } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
const sel = (p0: number, p1 = p0) => ({ ancora: { p: p0, o: 0 }, fuoco: { p: p1, o: 0 } });
const testi = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));

async function guscio(testo = 'uno\ndue'): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto(testo)), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}
async function voceMenu(g: any, menu: string, etichetta: string, figlio?: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await barra.updateComplete;
  if (figlio) {
    const f = (Array.from(barra.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === figlio)!;
    f.click();
  }
  await attendi(60);
  await g.updateComplete;
}

describe('T444: componenti di base', () => {
  it('inserisciBlocco mette il blocco dopo il paragrafo del cursore e porta il cursore in un paragrafo vuoto dopo', () => {
    const st = { ...statoIniziale(daTesto('uno\ndue')), sel: cursore(0, 1) };
    const n = inserisciBlocco(st, [{ runs: [{ t: 'A', g: false, c: false, s: false }] }, { runs: [{ t: 'B', g: false, c: false, s: false }] }]);
    expect(testi(n.doc)).toEqual(['uno', 'A', 'B', '', 'due']);
    expect(n.sel.fuoco).toEqual({ p: 3, o: 0 });
  });
  it('un paragrafo vuoto viene sostituito dal blocco; in una tabella non si inserisce niente', () => {
    const vuoto = inserisciBlocco(statoIniziale(daTesto('')), [{ runs: [{ t: 'A', g: false, c: false, s: false }] }]);
    expect(testi(vuoto.doc)).toEqual(['A', '']);
    const conTab = inserisciBlocco(statoIniziale(daTesto('x')), COMPONENTI.find((c) => c.nome === 'Tabella delle attività')!.costruisci(0, new Date()));
    const dentro = { ...conTab, sel: cursore(conTab.doc.paragrafi.findIndex((p) => p.tb), 0) };
    expect(inserisciBlocco(dentro, [{ runs: [] }])).toBe(dentro);
  });
  it('ogni componente si costruisce, e le tabelle prendono un numero libero', () => {
    for (const c of COMPONENTI) {
      const b = c.costruisci(7, new Date(2026, 10, 4));
      expect(b.length, c.nome).toBeGreaterThan(0);
      for (const p of b) if (p.tb) expect(p.tb.i).toBe(7);
    }
    const tab = COMPONENTI.find((c) => c.nome === 'Pianificazione settimanale')!.costruisci(0, new Date());
    expect(tab.filter((p) => p.tb).length).toBe(12);
    expect(testi({ paragrafi: COMPONENTI.find((c) => c.nome === 'Data di oggi')!.costruisci(0, new Date(2026, 10, 4)) })).toEqual(['4 novembre 2026']);
  });
  it('dal menu: Inserisci › Componenti di base › Elenco di controllo mette le voci di attività, in un solo passo di annulla', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Componenti di base', 'Elenco di controllo');
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(testi(ed.stato.doc).slice(0, 6)).toEqual(['uno', 'Elenco di controllo', 'Primo passo', 'Secondo passo', 'Terzo passo', 'Quarto passo']);
    expect(ed.stato.doc.paragrafi.slice(2, 6).map((p: any) => p.el)).toEqual(['t', 't', 't', 't']);
    ed.annulla();
    expect(testi(ed.stato.doc)).toEqual(['uno', 'due']);
  });
  it('due tabelle di seguito hanno numeri diversi', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.inserisciComponente((id: number) => COMPONENTI[3].costruisci(id, new Date()));
    ed.inserisciComponente((id: number) => COMPONENTI[4].costruisci(id, new Date()));
    const ids = new Set(ed.stato.doc.paragrafi.filter((p: any) => p.tb).map((p: any) => p.tb.i));
    expect([...ids]).toEqual([0, 1]);
    expect(prossimoIdTabella(ed.stato)).toBe(2);
  });
});

describe('T444: bordi e linee', () => {
  it('bordoValido: spessore da 0,5 a 6 pt, colore #rrggbb, stile c/t/p', () => {
    expect(bordoValido({ w: 1.3, c: '#AABBCC', s: 't' })).toEqual({ w: 1.5, c: '#aabbcc', s: 't' });
    for (const x of [null, { w: 0, c: '#000000', s: 'c' }, { w: 7, c: '#000000', s: 'c' }, { w: 1, c: 'rosso', s: 'c' }, { w: 1, c: '#000000', s: 'x' }]) expect(bordoValido(x)).toBeUndefined();
  });
  it('impostaBordo mette il bordo predefinito, cambia solo la parte indicata e lo toglie', () => {
    let d = impostaBordo(daTesto('uno\ndue'), sel(0), {});
    expect(d.paragrafi[0].bd).toEqual(BORDO_PREDEFINITO);
    expect(d.paragrafi[1].bd).toBeUndefined();
    d = impostaBordo(d, sel(0), { w: 3 });
    d = impostaBordo(d, sel(0), { s: 'p' });
    expect(d.paragrafi[0].bd).toEqual({ w: 3, c: '#000000', s: 'p' });
    expect(impostaBordo(d, sel(0), null).paragrafi[0].bd).toBeUndefined();
  });
  it('si salva in .fdoc e un bordo non valido è rifiutato; A capo lo mantiene', () => {
    const d = impostaBordo(daTesto('uno'), sel(0), { c: '#d93025' });
    expect(deserializza(serializza(d)).paragrafi[0].bd).toEqual({ w: 1, c: '#d93025', s: 'c' });
    expect(() => deserializza(serializza(d).replace('"#d93025"', '"rosso"'))).toThrow();
    const ed = { ...nuovoEditor(), storia: { ...nuovoEditor().storia, presente: { ...statoIniziale(d), sel: cursore(0, 3) } } };
    const dopo = statoCorrente(eseguiAzioneFormato(ed, { tipo: 'invio' }).ed).doc;
    expect(dopo.paragrafi.map((p) => !!p.bd)).toEqual([true, true]);
  });
  it('il paragrafo si disegna con il bordo nello stile del nodo', () => {
    const z = document.createElement('div');
    disegna(z, impostaBordo(impostaBordo(daTesto('uno'), sel(0), { w: 2 }), sel(0), { s: 't', c: '#1a73e8' }));
    const p = z.querySelector('p')!;
    expect(p.classList.contains('bordo')).toBe(true);
    expect(p.style.borderTopStyle).toBe('dashed');
    expect(p.style.borderTopWidth).toBe('2pt');
  });
  it('.docx: quattro lati con spessore, stile e colore; si rilegge come bordo, non come linea orizzontale', async () => {
    const d = impostaBordo(impostaBordo(daTesto('uno\ndue'), sel(0), { w: 2, s: 't', c: '#1a73e8' }), sel(1), null);
    const voci = await leggiZip(await esportaDocx(d));
    const xml = new TextDecoder().decode(voci.get('word/document.xml')!);
    for (const lato of ['w:top', 'w:left', 'w:bottom', 'w:right']) expect(xml).toContain(`<${lato} w:val="dashed" w:sz="16" w:space="4" w:color="1A73E8"/>`);
    const letto = await importaDocx(await esportaDocx(d));
    expect(letto.paragrafi[0].bd).toEqual({ w: 2, c: '#1a73e8', s: 't' });
    expect(letto.paragrafi[0].hr).toBeUndefined();
  });
  it('.docx: la sola linea sotto è ancora la linea orizzontale', async () => {
    const letto = await importaDocx(await esportaDocx({ paragrafi: [{ hr: true, runs: [] }] }));
    expect(letto.paragrafi[0].hr).toBe(true);
    expect(letto.paragrafi[0].bd).toBeUndefined();
  });
  it('.odt e PDF: il bordo c\'è', async () => {
    const d = impostaBordo(daTesto('uno'), sel(0), { w: 2, c: '#188038' });
    const odt = new TextDecoder().decode((await leggiZip(await esporta(d, 'odt'))).get('content.xml')!);
    expect(odt).toContain('fo:border="2pt solid #188038"');
    const pdf = new TextDecoder('latin1').decode(await esporta(d, 'pdf'));
    expect(pdf).toMatch(/q 2 w 0\.094 0\.502 0\.220 RG \[\] 0 d [\d.]+ [\d.]+ [\d.]+ [\d.]+ re S Q/);
  });
  it('dal menu Formato › Bordi e linee: aggiunge, cambia colore e toglie il bordo', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await voceMenu(g, 'formato', 'Bordi e linee', 'Aggiungi bordo al paragrafo');
    expect(ed.stato.doc.paragrafi[0].bd).toEqual(BORDO_PREDEFINITO);
    await voceMenu(g, 'formato', 'Bordi e linee', 'Colore rosso');
    await voceMenu(g, 'formato', 'Bordi e linee', 'Spessore 3 pt');
    expect(ed.stato.doc.paragrafi[0].bd).toEqual({ w: 3, c: '#d93025', s: 'c' });
    await voceMenu(g, 'formato', 'Bordi e linee', 'Togli il bordo');
    expect(ed.stato.doc.paragrafi[0].bd).toBeUndefined();
    expect(VOCI_BORDO.length).toBe(15);
  });
});

describe('T444: equazioni', () => {
  const dritto = (v: string): Nodo => ({ t: 'testo', v, stile: 'dritto' });
  it('legge frazioni, radici, apici, pedici, somme, lettere greche e simboli', () => {
    expect(leggiEquazione('\\frac{a}{b}')).toEqual({ t: 'riga', figli: [{ t: 'frazione', num: { t: 'riga', figli: [{ t: 'testo', v: 'a', stile: 'corsivo' }] }, den: { t: 'riga', figli: [{ t: 'testo', v: 'b', stile: 'corsivo' }] } }] });
    const r = leggiEquazione('\\sqrt[3]{x}') as { figli: Array<{ t: string; indice?: unknown }> };
    expect(r.figli[0].t).toBe('radice');
    expect(r.figli[0].indice).toBeDefined();
    const s = leggiEquazione('x^{2}_{i}') as { figli: Array<{ t: string; sup?: unknown; sub?: unknown }> };
    expect(s.figli[0]).toMatchObject({ t: 'apice' });
    expect(s.figli[0].sup).toBeDefined();
    expect(s.figli[0].sub).toBeDefined();
    const somma = leggiEquazione('\\sum_{i=1}^{n} x_{i}') as { figli: Array<{ t: string; simbolo?: string; sub?: unknown; sup?: unknown }> };
    expect(somma.figli[0]).toMatchObject({ t: 'grande', simbolo: '∑' });
    expect(somma.figli[0].sub).toBeDefined();
    expect(leggiEquazione('\\alpha\\leq\\pi')).toEqual({ t: 'riga', figli: [dritto('α'), dritto('≤'), dritto('π')] });
  });
  it('un esponente senza graffe prende un solo carattere; le funzioni (sin, log) sono operatori', () => {
    const r = leggiEquazione('x^2y') as { figli: Array<{ t: string }> };
    expect(r.figli.map((f) => f.t)).toEqual(['apice', 'testo']);
    const f = leggiEquazione('\\sin x') as { figli: Array<{ t: string; v?: string; stile?: string }> };
    expect(f.figli[0]).toMatchObject({ t: 'testo', v: 'sin', stile: 'operatore' });
  });
  it('scritta male: messaggi chiari e mai un errore generico', () => {
    for (const [src, parte] of [['\\frac{a}{b', 'graffa'], ['a}', 'graffa'], ['\\foo', 'sconosciuto'], ['^2', 'apice'], ['x'.repeat(401), 'lunga'], ['{'.repeat(30) + 'x' + '}'.repeat(30), 'profondità']] as const) {
      expect(() => leggiEquazione(src), src.slice(0, 20)).toThrow(ErroreEquazione);
      try { leggiEquazione(src); } catch (e) { expect((e as Error).message.toLowerCase()).toContain(parte); }
    }
  });
  it('tutti i modelli della palette sono equazioni valide', () => {
    for (const m of MODELLI_EQUAZIONE) expect(() => leggiEquazione(m.testo), m.etichetta).not.toThrow();
  });
  it('la composizione dà misure sensate: una frazione è più alta di una lettera e un apice allarga la casella', () => {
    const misura = (t: string, c: number): number => t.length * c * 0.5;
    const lettera = componi(leggiEquazione('x'), 20, misura);
    const frazione = componi(leggiEquazione('\\frac{a}{b}'), 20, misura);
    const potenza = componi(leggiEquazione('x^{2}'), 20, misura);
    expect(frazione.su + frazione.giu).toBeGreaterThan(lettera.su + lettera.giu);
    expect(potenza.w).toBeGreaterThan(lettera.w);
    expect(potenza.su).toBeGreaterThan(lettera.su);
  });
  it('il disegno chiama il disegnatore con i testi e le linee giuste, dentro la casella', () => {
    const misura = (t: string, c: number): number => t.length * c * 0.5;
    const cas = componi(leggiEquazione('\\frac{a}{b}+\\sqrt{x}'), 20, misura);
    const testiDisegnati: string[] = []; let linee = 0; let percorsi = 0;
    const d: Disegnatore = { testo: (v) => { testiDisegnati.push(v); }, linea: () => { linee++; }, percorso: () => { percorsi++; } };
    cas.disegna(d, 0, cas.su);
    expect(testiDisegnati).toEqual(['a', 'b', '+', 'x']);
    expect(linee).toBe(2); // linea della frazione e tetto della radice
    expect(percorsi).toBe(1); // il segno di radice
    expect(cas.w).toBeGreaterThan(0);
  });
});

describe('T444: grafici', () => {
  it('numeroDaTesto: all\'italiana e all\'inglese', () => {
    expect(numeroDaTesto('12')).toBe(12);
    expect(numeroDaTesto('12,5')).toBe(12.5);
    expect(numeroDaTesto('1.234,5')).toBe(1234.5);
    expect(numeroDaTesto('1,234.5')).toBe(1234.5);
    expect(numeroDaTesto('1.234.567')).toBe(1234567);
    expect(numeroDaTesto('-3')).toBe(-3);
    expect(numeroDaTesto('40%')).toBe(40);
    for (const x of ['', 'abc', '1,2,x']) expect(Number.isNaN(numeroDaTesto(x)), x).toBe(true);
  });
  it('leggiDati: nomi delle serie dalla prima riga, valori mancanti a zero, una serie sola chiamata Valori', () => {
    const d = leggiDati('; Vendite; Costi\nGennaio; 120; 80\nFebbraio; 150');
    expect(d.serie).toEqual(['Vendite', 'Costi']);
    expect(d.righe).toEqual([{ etichetta: 'Gennaio', valori: [120, 80] }, { etichetta: 'Febbraio', valori: [150, 0] }]);
    expect(leggiDati('A; 1\nB; 2').serie).toEqual(['Valori']);
    expect(leggiDati('A\t1\nB\t2').righe.map((r) => r.valori[0])).toEqual([1, 2]);
  });
  it('leggiDati: errori chiari', () => {
    for (const [src, parte] of [['', 'almeno una riga'], ['A', 'non ha valori'], ['A; 1\nB; x', 'non è un numero'], ['; S1; S2\n', 'Mancano'], [Array.from({ length: RIGHE_MASSIME + 1 }, (_, i) => `r${i}; ${i}`).join('\n'), 'Troppe righe'], ['A; 1; 2; 3; 4; 5; 6; 7', 'Troppe serie']] as const) {
      expect(() => leggiDati(src), src.slice(0, 15)).toThrow(ErroreGrafico);
      try { leggiDati(src); } catch (e) { expect((e as Error).message).toContain(parte); }
    }
  });
  it('calcolaScala: massimi tondi, anche con negativi e con tutti zeri', () => {
    expect(calcolaScala(0, 180)).toEqual({ min: 0, max: 200, passo: 50 });
    expect(calcolaScala(0, 7)).toEqual({ min: 0, max: 8, passo: 2 });
    expect(calcolaScala(-30, 80)).toMatchObject({ min: -50, max: 100 });
    const zero = calcolaScala(0, 0);
    expect(zero.max).toBeGreaterThan(zero.min);
    expect(calcolaScala(0, 0.8).passo).toBeCloseTo(0.2);
  });
});

describe('T444: finestre dal menu', () => {
  it('le voci Disegno, Grafico, Equazione, Bordi, Componenti e la barra delle equazioni non sono più grigie (nessuna voce resta spenta)', () => {
    const tutte = MENU.flatMap((m) => m.voci);
    for (const e of ['Componenti di base', 'Disegno', 'Grafico', 'Equazione', 'Bordi e linee', 'Mostra barra degli strumenti delle equazioni']) expect(tutte.find((v) => v.etichetta === e)?.disabilitata, e).toBeUndefined();
    expect(tutte.filter((v) => v.disabilitata).map((v) => v.etichetta)).toEqual([]);
  });
  it('Inserisci › Equazione apre la finestra con la barra; il menu Visualizza la nasconde; Esc chiude', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Equazione');
    const eq = g.shadowRoot.querySelector('docs-equazione');
    expect(eq).not.toBeNull();
    await eq.updateComplete;
    expect(eq.shadowRoot.querySelectorAll('.barra button').length).toBe(MODELLI_EQUAZIONE.length);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-equazione')).toBeNull();
    await voceMenu(g, 'visualizza', 'Mostra barra degli strumenti delle equazioni');
    await voceMenu(g, 'inserisci', 'Equazione');
    const eq2 = g.shadowRoot.querySelector('docs-equazione');
    await eq2.updateComplete;
    expect(eq2.shadowRoot.querySelector('.barra')).toBeNull();
  });
  it('la palette mette il modello nella formula e il pulsante Inserisci si accende solo con una formula', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Equazione');
    const eq = g.shadowRoot.querySelector('docs-equazione');
    await eq.updateComplete;
    expect(eq.shadowRoot.querySelector('button.primario').disabled).toBe(true);
    (eq.shadowRoot.querySelector('.barra button') as HTMLButtonElement).click();
    await eq.updateComplete;
    expect(eq.shadowRoot.querySelector('textarea').value).toBe('\\frac{a}{b}');
    expect(eq.shadowRoot.querySelector('button.primario').disabled).toBe(false);
  });
  it('Inserisci › Grafico › A torta apre il grafico con quel tipo; Inserisci › Disegno › Nuovo apre il disegno', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Grafico', 'A torta');
    const gr = g.shadowRoot.querySelector('docs-grafico');
    expect(gr).not.toBeNull();
    expect(gr.tipoIniziale).toBe('torta');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    await voceMenu(g, 'inserisci', 'Disegno', 'Nuovo');
    expect(g.shadowRoot.querySelector('docs-disegno')).not.toBeNull();
  });
  it('quando la finestra consegna la tela, il documento riceve un\'immagine png e la finestra si chiude', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Disegno', 'Nuovo');
    let blobDato: Blob | null = null;
    g.inserisciImmagine = async (b: Blob) => { blobDato = b; };
    const tela = { toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' })) } as unknown as HTMLCanvasElement;
    g.shadowRoot.querySelector('docs-disegno').dispatchEvent(new CustomEvent('inserisci', { detail: { tela }, bubbles: true, composed: true }));
    await g.updateComplete;
    expect(blobDato).not.toBeNull();
    expect((blobDato as unknown as Blob).type).toBe('image/png');
    expect(g.shadowRoot.querySelector('docs-disegno')).toBeNull();
  });
});
