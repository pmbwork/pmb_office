import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import '../../src/guscio/docs-tabella';
import { disegna, domDaPosizione, paragrafiDom, posizioneDaDom } from '../../src/editor/render';
import { cellaVicina, inTabella, inserisciTabella } from '../../src/editor/tabelle';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import { popupTabella, VOCI_TABELLA } from '../../src/guscio/tabella-dati';
import { cursore, daTesto, inserisciTesto, statoIniziale, testoParagrafo, type Documento, type Stato } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const celle = (d: Documento): string[] => d.paragrafi.map((p) => (p.tb ? `${p.tb.r}${p.tb.c}` : '-'));
/** "ab" + tabella righe x colonne + paragrafo finale */
function docTabella(righe = 2, colonne = 2): Stato {
  return inserisciTabella({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) }, righe, colonne);
}
const scrivi = (s: Stato, p: number, t: string): Stato => inserisciTesto({ ...s, sel: cursore(p, 0) }, t);

describe('T111: il disegno delle tabelle', () => {
  it('una tabella diventa <table> con righe e celle; i paragrafi restano numerati nell\'ordine del documento', () => {
    const s = scrivi(docTabella(2, 2), 3, 'x');
    const zona = document.createElement('div');
    disegna(zona, s.doc);
    expect(Array.from(zona.children).map((c) => c.tagName)).toEqual(['P', 'TABLE', 'P']);
    const t = zona.querySelector('table') as HTMLTableElement;
    expect(t.className).toBe('tabella');
    expect(t.rows.length).toBe(2);
    expect(Array.from(t.rows).map((r) => r.cells.length)).toEqual([2, 2]);
    expect(paragrafiDom(zona).map((p) => p.getAttribute('data-p'))).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(t.rows[1].cells[0].querySelector('p')?.textContent).toBe('x');
    expect(t.rows[0].cells[0].querySelector('p br')).not.toBeNull();
    expect(zona.querySelectorAll('[style]').length).toBe(0);
  });

  it('una cella con più paragrafi li tiene tutti nella stessa cella; due tabelle vicine restano due tabelle', () => {
    let s = docTabella(1, 2);
    s = inserisciTesto({ ...s, sel: cursore(1, 0) }, 'a\nb');
    s = inserisciTabella({ ...s, sel: cursore(0, 0) }, 1, 1);
    const zona = document.createElement('div');
    disegna(zona, s.doc);
    expect(Array.from(zona.children).map((c) => c.tagName)).toEqual(['P', 'TABLE', 'P', 'TABLE', 'P']);
    const grande = zona.querySelectorAll('table')[1] as HTMLTableElement;
    expect(Array.from(grande.rows[0].cells[0].querySelectorAll('p')).map((p) => p.textContent)).toEqual(['a', 'b']);
    expect(zona.querySelectorAll('table')[0].querySelectorAll('td').length).toBe(1);
  });

  it('un documento senza tabelle si disegna come prima', () => {
    const zona = document.createElement('div');
    disegna(zona, daTesto('uno\ndue'));
    expect(Array.from(zona.children).map((c) => c.tagName)).toEqual(['P', 'P']);
    expect(zona.querySelector('table')).toBeNull();
  });

  it('dal DOM alla posizione e ritorno funzionano anche dentro le celle', () => {
    const s = scrivi(scrivi(docTabella(2, 2), 2, 'cella'), 4, 'ultima');
    const zona = document.createElement('div');
    document.body.appendChild(zona);
    disegna(zona, s.doc);
    const celle = zona.querySelectorAll('td');
    const testoCella = celle[1].querySelector('p span')!.firstChild!;
    expect(posizioneDaDom(zona, testoCella, 3)).toEqual({ p: 2, o: 3 });
    expect(posizioneDaDom(zona, celle[3].querySelector('p span')!.firstChild!, 2)).toEqual({ p: 4, o: 2 });
    expect(domDaPosizione(zona, { p: 4, o: 2 })).toEqual({ nodo: celle[3].querySelector('p span')!.firstChild, offset: 2 });
    expect(domDaPosizione(zona, { p: 1, o: 0 })?.nodo).toBe(celle[0].querySelector('p'));
    expect(domDaPosizione(zona, { p: 99, o: 0 })).toBeNull();
    // un punto sulla cella o sulla riga (non su un paragrafo) vale l'inizio del primo paragrafo che contiene
    expect(posizioneDaDom(zona, celle[2], 0)).toEqual({ p: 3, o: 0 });
    expect(posizioneDaDom(zona, zona.querySelector('tr')!, 0)).toEqual({ p: 1, o: 0 });
    // un punto sul contenitore: l'indice conta i blocchi (paragrafo, tabella, paragrafo)
    expect(posizioneDaDom(zona, zona, 1)).toEqual({ p: 1, o: 0 });
    expect(posizioneDaDom(zona, zona, 2)).toEqual({ p: 5, o: 0 });
    expect(posizioneDaDom(zona, zona, 3)).toEqual({ p: 5, o: 0 });
    expect(posizioneDaDom(zona, document.body, 0)).toBeNull();
    zona.remove();
  });
});

describe('T111: Tab tra le celle', () => {
  it('inTabella dice se il cursore è in una tabella', () => {
    const s = docTabella();
    expect(inTabella({ ...s, sel: cursore(0, 0) })).toBe(false);
    expect(inTabella({ ...s, sel: cursore(3, 0) })).toBe(true);
  });

  it('Tab va alla cella dopo, a capo di riga quando finisce la riga; Maiusc+Tab torna indietro', () => {
    const s = docTabella(2, 2);
    const in00 = { ...s, sel: cursore(1, 0) };
    const a = cellaVicina(in00, false);
    expect(a.sel.fuoco).toEqual({ p: 2, o: 0 });
    const b = cellaVicina(a, false);
    expect(b.doc.paragrafi[b.sel.fuoco.p].tb).toMatchObject({ r: 1, c: 0 });
    expect(cellaVicina(b, true).sel.fuoco).toEqual({ p: 2, o: 0 });
    expect(cellaVicina(in00, true)).toBe(in00);
  });

  it('Tab nell\'ultima cella aggiunge una riga e ci va; fuori da una tabella non fa niente', () => {
    const s = docTabella(2, 2);
    const ultima = { ...s, sel: cursore(4, 0) };
    const n = cellaVicina(ultima, false);
    expect(celle(n.doc)).toEqual(['-', '00', '01', '10', '11', '20', '21', '-']);
    expect(n.doc.paragrafi[n.sel.fuoco.p].tb).toMatchObject({ r: 2, c: 0 });
    const fuori = { ...s, sel: cursore(0, 0) };
    expect(cellaVicina(fuori, false)).toBe(fuori);
  });

  it('con più paragrafi nella cella Tab va comunque alla cella dopo, all\'inizio del suo primo paragrafo', () => {
    let s = docTabella(1, 2);
    s = inserisciTesto({ ...s, sel: cursore(2, 0) }, 'a\nb');
    const n = cellaVicina({ ...s, sel: cursore(1, 0) }, false);
    expect(n.sel.fuoco).toEqual({ p: 2, o: 0 });
    const indietro = cellaVicina({ ...s, sel: cursore(3, 1) }, true);
    expect(indietro.sel.fuoco).toEqual({ p: 1, o: 0 });
  });

  it('il tasto Tab dell\'editor muove tra le celle, anche con un elenco; l\'ultima cella aggiunge una riga con un solo annulla', () => {
    const s = docTabella(1, 2);
    const ed = nuovoEditor({ ...s, sel: cursore(1, 0) });
    const r1 = eseguiAzioneFormato(ed, { tipo: 'tab', indietro: false });
    expect(statoCorrente(r1.ed).sel.fuoco.p).toBe(2);
    expect(r1.ed.storia.passato.length).toBe(0);
    const r2 = eseguiAzioneFormato(r1.ed, { tipo: 'tab', indietro: false });
    expect(statoCorrente(r2.ed).doc.paragrafi.length).toBe(s.doc.paragrafi.length + 2);
    expect(r2.ed.storia.passato.length).toBe(1);
    const annullato = eseguiAzioneFormato(r2.ed, { tipo: 'annulla' }).ed;
    expect(statoCorrente(annullato).doc.paragrafi.length).toBe(s.doc.paragrafi.length);
    expect(eseguiAzioneFormato(ed, { tipo: 'tab', indietro: true }).ed).toBe(ed);
    const conElenco = eseguiAzioneFormato(nuovoEditor({ ...s, sel: cursore(1, 0) }), { tipo: 'elenco', elenco: 'p' }).ed;
    const dopo = eseguiAzioneFormato(conElenco, { tipo: 'tab', indietro: false }).ed;
    expect(statoCorrente(dopo).sel.fuoco.p).toBe(2);
    expect(statoCorrente(dopo).doc.paragrafi[1].ri).toBeUndefined();
  });
});

describe('T111: il menu della tabella', () => {
  it('ha dodici voci (dal 0.4.14 anche unisci, dividi, intestazione e ordina), ognuna con la sua operazione, e nessuna spuntata', () => {
    const p = popupTabella();
    expect(p.tipo).toBe('lista');
    expect(p.voci.length).toBe(12);
    expect(p.voci.map((v) => v.etichetta)).toEqual(VOCI_TABELLA.map((v) => v[0]));
    expect(p.voci.map((v) => (v.azione as { op: string }).op)).toEqual(['rigaSopra', 'rigaSotto', 'colonnaPrima', 'colonnaDopo', 'eliminaRiga', 'eliminaColonna', 'unisciCelle', 'dividiCella', 'intestazione', 'ordinaCrescente', 'ordinaDecrescente', 'eliminaTabella']);
    expect(popupTabella(true).voci.filter((v) => v.attiva).map((v) => (v.azione as { op: string }).op)).toEqual(['intestazione']);
    expect(p.voci.every((v) => !v.attiva && v.azione.tipo === 'modificaTabella')).toBe(true);
  });
});

async function dialogo(): Promise<any> {
  const d: any = document.createElement('docs-tabella');
  document.body.appendChild(d);
  await d.updateComplete;
  return d;
}
const campo = (d: any, n: 'righe' | 'colonne'): HTMLInputElement => d.shadowRoot.querySelector(`input.${n}`);
function digita(c: HTMLInputElement, t: string): void { c.value = t; c.dispatchEvent(new Event('input', { bubbles: true })); }
function tasto(c: HTMLElement, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  c.dispatchEvent(e);
  return e;
}

describe('T111: il dialogo della tabella', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('parte da 3 righe e 3 colonne; Inserisci avvisa con i numeri; Invio fa lo stesso', async () => {
    const d = await dialogo();
    const visti: any[] = [];
    d.addEventListener('applica', (e: any) => visti.push(e.detail));
    expect([campo(d, 'righe').value, campo(d, 'colonne').value]).toEqual(['3', '3']);
    d.shadowRoot.querySelector('button.applica').click();
    digita(campo(d, 'righe'), ' 5 ');
    digita(campo(d, 'colonne'), '2');
    expect(tasto(campo(d, 'colonne'), 'Enter').defaultPrevented).toBe(true);
    expect(visti).toEqual([{ righe: 3, colonne: 3 }, { righe: 5, colonne: 2 }]);
  });

  it('numeri non validi mostrano l\'errore e non avvisano; l\'errore sparisce scrivendo', async () => {
    const d = await dialogo();
    const visti: any[] = [];
    d.addEventListener('applica', (e: any) => visti.push(e.detail));
    for (const [r, c] of [['0', '3'], ['3', '0'], ['51', '3'], ['3', '21'], ['1.5', '3'], ['', '3'], ['3', ''], ['a', '3']]) {
      digita(campo(d, 'righe'), r);
      digita(campo(d, 'colonne'), c);
      d.shadowRoot.querySelector('button.applica').click();
      await d.updateComplete;
      expect(d.shadowRoot.querySelector('.errore').textContent, `${r}x${c}`).toContain('Righe da 1 a 50');
    }
    expect(visti).toEqual([]);
    digita(campo(d, 'righe'), '2');
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('.errore').textContent.trim()).toBe('');
    digita(campo(d, 'righe'), '50');
    digita(campo(d, 'colonne'), '20');
    d.shadowRoot.querySelector('button.applica').click();
    expect(visti).toEqual([{ righe: 50, colonne: 20 }]);
  });

  it('Esc e Annulla chiudono; focalizza mette il cursore nelle righe', async () => {
    const d = await dialogo();
    const visti: string[] = [];
    d.addEventListener('chiudi', () => visti.push('chiudi'));
    expect(tasto(campo(d, 'righe'), 'Escape').defaultPrevented).toBe(true);
    d.shadowRoot.querySelector('button.annulla').click();
    expect(visti).toEqual(['chiudi', 'chiudi']);
    d.focalizza();
    expect(d.shadowRoot.activeElement).toBe(campo(d, 'righe'));
  });
});

// ---------------------------------------------------------------- l'editor con un layout finto
async function editor(stato: Stato): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  el.impostaStato(stato);
  return el;
}

describe('T111: l\'editor e le tabelle', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('un clic dentro una cella sceglie il paragrafo di quella cella, non il primo della riga', async () => {
    const el = await editor({ ...docTabella(1, 2), sel: cursore(1, 0) });
    const par = Array.from(el.shadowRoot.querySelectorAll('p[data-p]')) as HTMLElement[];
    for (const p of par) p.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const tdSecondo = el.shadowRoot.querySelectorAll('td')[1];
    el.shadowRoot.elementsFromPoint = () => [tdSecondo];
    expect(el.posizioneDaPunto(50, 50)).toEqual({ p: 2, o: 0 });
    el.shadowRoot.elementsFromPoint = () => [];
    expect(el.posizioneDaPunto(50, 50)).toEqual({ p: 0, o: 0 });
    el.shadowRoot.elementsFromPoint = () => [el.shadowRoot.querySelectorAll('td')[0]];
    expect(el.posizioneDaPunto(50, 50)).toEqual({ p: 1, o: 0 });
  });

  it('inTabella dell\'editor segue il cursore', async () => {
    const s = docTabella();
    const el = await editor({ ...s, sel: cursore(0, 0) });
    expect(el.inTabella()).toBe(false);
    el.impostaStato({ ...s, sel: cursore(2, 0) });
    expect(el.inTabella()).toBe(true);
  });

  describe('con un layout finto', () => {
    let originale: typeof Element.prototype.getBoundingClientRect | undefined;
    afterEach(() => { if (originale) Element.prototype.getBoundingClientRect = originale; originale = undefined; });

    /** righe: alto e basso di ogni riga della tabella; par: alto e basso dei paragrafi fuori dalla tabella (per numero) */
    function layout(righe: Array<[number, number]>, par: Record<number, [number, number]>): void {
      originale ??= Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        const fatto = (a: number, b: number, w: number): DOMRect => ({ top: a, bottom: b, left: 0, right: w, width: w, height: b - a, x: 0, y: a, toJSON() {} }) as DOMRect;
        if (this.tagName === 'DOCS-EDITOR') return fatto(0, 3000, 800);
        let base: [number, number] | undefined;
        if (this.tagName === 'TR' && !this.classList.contains('salto-riga')) {
          const tutte = Array.from((this.parentNode as Element).querySelectorAll('tr:not(.salto-riga)'));
          base = righe[tutte.indexOf(this)];
        } else if (this.tagName === 'P' && this.parentNode && (this.parentNode as Element).classList.contains('testo')) {
          base = par[Number(this.getAttribute('data-p'))];
        }
        if (!base) return fatto(0, 0, 0);
        const radice = this.getRootNode() as ShadowRoot;
        const tutti = Array.from(radice.querySelectorAll('.testo *'));
        let spostamento = 0;
        for (const s of Array.from(radice.querySelectorAll('tr.salto-riga'))) {
          if (tutti.indexOf(s) < tutti.indexOf(this)) spostamento += parseFloat((s.firstElementChild as HTMLElement).style.height) || 0;
        }
        return fatto(base[0] + spostamento, base[1] + spostamento, 700);
      };
    }

    it('una riga che non entra in fondo al foglio passa tutta al foglio dopo, con uno spazio vuoto prima; le altre restano', async () => {
      const s = docTabella(3, 1);
      layout([[96, 1000], [1000, 1100], [1100, 1200]], { 0: [96, 112], 4: [1200, 1216] });
      const el = await editor({ ...s, sel: cursore(1, 0) });
      const spazi = el.shadowRoot.querySelectorAll('tr.salto-riga');
      expect(spazi.length).toBe(1);
      expect((spazi[0].firstElementChild as HTMLElement).style.height).toBe('231px');
      expect((spazi[0].firstElementChild as HTMLTableCellElement).colSpan).toBe(1);
      expect(spazi[0].previousElementSibling?.querySelector('p')?.getAttribute('data-p')).toBe('1');
      expect(spazi[0].nextElementSibling?.querySelector('p')?.getAttribute('data-p')).toBe('2');
      expect(el.pagine).toBe(2);
      expect(el.shadowRoot.querySelectorAll('.testo p[style]').length).toBe(0);
    });

    it('con più colonne lo spazio occupa tutta la larghezza; una tabella che sta nel foglio non ne ha', async () => {
      const s = docTabella(2, 3);
      layout([[96, 1000], [1000, 1100]], { 0: [96, 112], 7: [1100, 1116] });
      const el = await editor({ ...s, sel: cursore(1, 0) });
      const spazio = el.shadowRoot.querySelector('tr.salto-riga');
      expect((spazio.firstElementChild as HTMLTableCellElement).colSpan).toBe(3);
      document.body.innerHTML = '';
      document.body.appendChild(document.createElement('div'));
      const corta = docTabella(2, 2);
      layout([[96, 200], [200, 300]], { 0: [96, 112], 5: [300, 316] });
      const el2 = await editor({ ...corta, sel: cursore(1, 0) });
      expect(el2.shadowRoot.querySelectorAll('tr.salto-riga').length).toBe(0);
      expect(el2.pagine).toBe(1);
    });

    it('ricontrollando il testo dopo una modifica gli spazi non si accumulano', async () => {
      const s = docTabella(3, 1);
      layout([[96, 1000], [1000, 1100], [1100, 1200]], { 0: [96, 112], 4: [1200, 1216] });
      const el = await editor({ ...s, sel: cursore(1, 0) });
      el.applicaAzione({ tipo: 'testo', testo: 'x' });
      el.applicaAzione({ tipo: 'testo', testo: 'y' });
      expect(el.shadowRoot.querySelectorAll('tr.salto-riga').length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------- tutto insieme nel guscio
async function guscio(stato: Stato): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato(stato);
  return { g, ed };
}
/** Apre il menu Formato e passa con il mouse sulla voce: restituisce le sotto-voci del sottomenu che si apre (Formato › Tabella, › Immagine). */
async function sottovociFormato(g: any, etichetta: string): Promise<HTMLElement[]> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  if (!barraMenu.shadowRoot.querySelector('.pannello[data-menu="formato"]')) (barraMenu.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = () => (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce().dispatchEvent(new MouseEvent('mouseenter'));
  await barraMenu.updateComplete;
  return Array.from(voce().querySelectorAll('.sottopannello .figlio')) as HTMLElement[];
}
async function vociMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  (barraMenu.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await attendi();
  await g.updateComplete;
  const d = g.shadowRoot.querySelector('docs-tabella');
  if (d) await d.updateComplete;
}
const dialogoDi = (g: any): any => g.shadowRoot.querySelector('docs-tabella');
const avvisoDi = (g: any): string | null => g.shadowRoot.querySelector('.avviso')?.textContent?.trim() ?? null;

describe('T111: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Inserisci > Tabella apre il dialogo; Inserisci mette la tabella nel documento e nel disegno e il cursore nella prima cella', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    expect(dialogoDi(g)).toBeNull();
    await vociMenu(g, 'inserisci', 'Tabella');
    const d = dialogoDi(g);
    expect(d).not.toBeNull();
    expect(d.shadowRoot.activeElement).toBe(campo(d, 'righe'));
    digita(campo(d, 'righe'), '2');
    digita(campo(d, 'colonne'), '4');
    d.shadowRoot.querySelector('button.applica').click();
    await attendi();
    await g.updateComplete;
    expect(dialogoDi(g)).toBeNull();
    expect(celle(ed.stato.doc)).toEqual(['-', '00', '01', '02', '03', '10', '11', '12', '13', '-']);
    expect(ed.shadowRoot.querySelectorAll('table.tabella').length).toBe(1);
    expect(ed.shadowRoot.querySelectorAll('td').length).toBe(8);
    expect(ed.stato.sel.fuoco).toEqual({ p: 1, o: 0 });
  });

  it('dentro una tabella non si apre il dialogo e compare un avviso', async () => {
    const { g } = await guscio({ ...docTabella(), sel: cursore(2, 0) });
    await vociMenu(g, 'inserisci', 'Tabella');
    expect(dialogoDi(g)).toBeNull();
    expect(avvisoDi(g)).toContain('dentro un');
  });

  it('Esc chiude il dialogo senza cambiare il documento', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    await vociMenu(g, 'inserisci', 'Tabella');
    ed.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, composed: true }));
    await attendi();
    await g.updateComplete;
    expect(dialogoDi(g)).toBeNull();
    expect(ed.stato.doc.paragrafi.length).toBe(1);
  });

  it('Formato › Tabella è un sottomenu: fuori da una tabella dice che cosa serve; dentro ha le dodici voci e la voce scelta cambia la tabella', async () => {
    const s = docTabella(2, 2);
    const { g, ed } = await guscio({ ...s, sel: cursore(0, 0) });
    const fuori = await sottovociFormato(g, 'Tabella');
    expect(fuori.map((f) => (f.textContent ?? '').trim())).toEqual(['Metti il cursore in una tabella']);
    expect(fuori[0].classList.contains('disabilitata')).toBe(true);
    ed.impostaStato({ ...s, sel: cursore(1, 0) });
    const voci = await sottovociFormato(g, 'Tabella');
    expect(voci.length).toBe(12);
    voci.find((v) => (v.textContent ?? '').includes('Inserisci riga sotto'))!.click();
    await attendi();
    expect(g.shadowRoot.querySelector('docs-popup')).toBeNull();
    expect(celle(ed.stato.doc)).toEqual(['-', '00', '01', '10', '11', '20', '21', '-']);
    expect(ed.shadowRoot.querySelectorAll('tr').length).toBe(3);
  });

  it('il testo scritto in una cella finisce nella cella', async () => {
    const { ed } = await guscio({ ...docTabella(), sel: cursore(3, 0) });
    ed.applicaAzione({ tipo: 'testo', testo: 'ciao' });
    expect(ed.shadowRoot.querySelectorAll('td')[2].textContent).toBe('ciao');
    expect(testoParagrafo(ed.stato.doc.paragrafi[3])).toBe('ciao');
  });
});
