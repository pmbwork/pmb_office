import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import {
  CAMPO_PAGINA, CAMPO_PAGINE, OGGETTO, controllaMargine, daTesto, impostaIntestazione, impostaPiede, testoDi, testoParagrafo,
  type Documento, type Paragrafo, type Run,
} from '../../src/modello/documento';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const par = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [run(t)] });
const dec = new TextDecoder();
const enc = new TextEncoder();
function documento(corpo: string, i?: Paragrafo[], p?: Paragrafo[]): Documento { return impostaPiede(impostaIntestazione(daTesto(corpo), i), p); }
async function pacchetto(doc: Documento) {
  const voci = await leggiZip(await esportaDocx(doc));
  const xml = (n: string): NodoXml => analizzaXml(dec.decode(voci.get(n)));
  return { voci, xml, nomi: [...voci.keys()] };
}
const ELENCO_BASE = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml'];

// ---- file di Word costruiti a mano ----
const NSW = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const TIPO_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
interface OpzioniWord { corpo?: string; sezione?: string; rels?: string; parti?: Record<string, string | Uint8Array>; senzaRels?: boolean }
async function word(o: OpzioniWord = {}): Promise<Uint8Array> {
  const parti: Record<string, string | Uint8Array> = {
    'word/document.xml': `<w:document ${NSW}><w:body>${o.corpo ?? '<w:p><w:r><w:t>corpo</w:t></w:r></w:p>'}${o.sezione ?? ''}</w:body></w:document>`,
    ...(o.senzaRels ? {} : { 'word/_rels/document.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${o.rels ?? ''}</Relationships>` }),
    ...(o.parti ?? {}),
  };
  return scriviZip(Object.entries(parti).map(([nome, testo]) => ({ nome, dati: typeof testo === 'string' ? enc.encode(testo) : testo })));
}
const rel = (id: string, tipo: string, bersaglio: string, extra = ''): string => `<Relationship Id="${id}" Type="${TIPO_REL}/${tipo}" Target="${bersaglio}"${extra}/>`;
const testata = (figli: string, radice = 'hdr'): string => `<w:${radice} ${NSW}>${figli}</w:${radice}>`;
const p = (figli: string, jc = ''): string => `<w:p>${jc ? `<w:pPr><w:jc w:val="${jc}"/></w:pPr>` : ''}${figli}</w:p>`;
const r = (t: string, rPr = ''): string => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const campoComplesso = (istruzione: string, risultato: string, rPr = '', conSeparatore = true): string =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${istruzione} </w:instrText></w:r>`
  + (conSeparatore ? `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${r(risultato, rPr)}` : '') + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
const campoSemplice = (istruzione: string, risultato: string, rPr = ''): string => `<w:fldSimple w:instr=" ${istruzione} ">${r(risultato, rPr)}</w:fldSimple>`;
const SEZIONE_INTESTAZIONE = '<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>';
const RELAZIONE_INTESTAZIONE = rel('rIdH', 'header', 'header1.xml');
async function conIntestazione(figli: string, extra: OpzioniWord = {}): Promise<Documento> {
  return importaDocx(await word({ sezione: SEZIONE_INTESTAZIONE, rels: RELAZIONE_INTESTAZIONE, parti: { 'word/header1.xml': testata(figli) }, ...extra }));
}

describe('T301 intestazione e piè di pagina nel formato .docx: esportazione', () => {
  it('senza intestazione né piè di pagina il file è fatto come prima', async () => {
    const c = await pacchetto(daTesto('ciao'));
    expect(c.nomi).toEqual(ELENCO_BASE);
    expect(dec.decode(c.voci.get('word/document.xml'))).not.toContain('Reference');
    expect(dec.decode(c.voci.get('[Content_Types].xml'))).not.toContain('header');
    expect(dec.decode(c.voci.get('word/_rels/document.xml.rels'))).not.toContain('header');
  });

  it('con intestazione e piè di pagina: le parti, i riferimenti nella sezione, le relazioni e i tipi', async () => {
    const c = await pacchetto(documento('ciao', [par('Testata')], [par('Fine')]));
    expect(c.nomi).toEqual([...ELENCO_BASE, 'word/header1.xml', 'word/footer1.xml']);
    const sezione = trova(c.xml('word/document.xml'), 'w:body/w:sectPr') as NodoXml;
    expect(sezione.figli.map((f) => (typeof f === 'string' ? f : f.nome))).toEqual(['w:headerReference', 'w:footerReference', 'w:pgSz', 'w:pgMar']);
    const [h, f] = [figliElemento(sezione, 'w:headerReference')[0], figliElemento(sezione, 'w:footerReference')[0]];
    expect([h.attributi['w:type'], f.attributi['w:type']]).toEqual(['default', 'default']);
    const relazioni = figliElemento(c.xml('word/_rels/document.xml.rels'), 'Relationship');
    const trovaRel = (id: string) => relazioni.find((x) => x.attributi.Id === id);
    expect(trovaRel(h.attributi['r:id'])?.attributi.Target).toBe('header1.xml');
    expect(trovaRel(h.attributi['r:id'])?.attributi.Type).toBe('http://schemas.openxmlformats.org/officeDocument/2006/relationships/header');
    expect(trovaRel(f.attributi['r:id'])?.attributi.Target).toBe('footer1.xml');
    expect(trovaRel(f.attributi['r:id'])?.attributi.Type).toBe('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer');
    const tipi = figliElemento(c.xml('[Content_Types].xml'), 'Override').map((o) => [o.attributi.PartName, o.attributi.ContentType]);
    expect(tipi).toContainEqual(['/word/header1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml']);
    expect(tipi).toContainEqual(['/word/footer1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml']);
  });

  it('solo intestazione o solo piè di pagina: solo la sua parte', async () => {
    const solaI = await pacchetto(documento('x', [par('Testata')]));
    expect(solaI.nomi).toEqual([...ELENCO_BASE, 'word/header1.xml']);
    const sezI = trova(solaI.xml('word/document.xml'), 'w:body/w:sectPr') as NodoXml;
    expect(figliElemento(sezI, 'w:headerReference').length + figliElemento(sezI, 'w:footerReference').length).toBe(1);
    const solaP = await pacchetto(documento('x', undefined, [par('Fine')]));
    expect(solaP.nomi).toEqual([...ELENCO_BASE, 'word/footer1.xml']);
    expect(figliElemento(trova(solaP.xml('word/document.xml'), 'w:body/w:sectPr') as NodoXml, 'w:footerReference').length).toBe(1);
  });

  it('il testo delle parti: paragrafi, allineamento, formato dei tratti e tabulazioni', async () => {
    const c = await pacchetto(documento('x', [
      { al: 'ce', runs: [run('Re', { g: true }), run('lazione', { c: true, s: true, f: 'Roboto', z: 14, k: '#112233' })] },
      par('a\tb', { al: 'dx' }), par('terza', { al: 'gi' }),
    ]));
    const h = c.xml('word/header1.xml');
    expect(h.nome).toBe('w:hdr');
    const paragrafi = figliElemento(h, 'w:p');
    expect(paragrafi.length).toBe(3);
    expect(paragrafi.map((x) => trova(x, 'w:pPr/w:jc')?.attributi['w:val'])).toEqual(['center', 'right', 'both']);
    const tratti = figliElemento(paragrafi[0], 'w:r');
    expect(tratti.map((x) => testoXml(x))).toEqual(['Re', 'lazione']);
    expect(trova(tratti[0], 'w:rPr/w:b')).toBeDefined();
    expect(trova(tratti[1], 'w:rPr/w:i')).toBeDefined();
    expect(trova(tratti[1], 'w:rPr/w:color')?.attributi['w:val']).toBe('112233');
    expect(trova(tratti[1], 'w:rPr/w:sz')?.attributi['w:val']).toBe('28');
    expect(nodiDi(figliElemento(paragrafi[1], 'w:r')[0])).toEqual(['w:t', 'w:tab', 'w:t']);
  });

  it('i campi del numero di pagina sono campi PAGE e NUMPAGES, col formato del tratto', async () => {
    const c = await pacchetto(documento('x', undefined, [
      { al: 'dx', runs: [run(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`, { g: true })] },
      par(`${CAMPO_PAGINA}${CAMPO_PAGINE}`), par(`${CAMPO_PAGINA}`),
    ]));
    const [uno, due, tre] = figliElemento(c.xml('word/footer1.xml'), 'w:p');
    const soloPagine = figliElemento((await pacchetto(documento('x', undefined, [par(`${CAMPO_PAGINE}`)]))).xml('word/footer1.xml'), 'w:p')[0];
    expect(figliElemento(soloPagine, 'w:fldSimple').map((x) => x.attributi['w:instr'])).toEqual([' NUMPAGES ']);
    expect(figliElemento(soloPagine, 'w:r').length).toBe(0);
    expect(uno.figli.map((f) => (typeof f === 'string' ? f : f.nome))).toEqual(['w:pPr', 'w:r', 'w:fldSimple', 'w:r', 'w:fldSimple']);
    const campi = figliElemento(uno, 'w:fldSimple');
    expect(campi.map((x) => x.attributi['w:instr'])).toEqual([' PAGE ', ' NUMPAGES ']);
    for (const x of campi) {
      expect(trova(x, 'w:r/w:rPr/w:b')).toBeDefined();
      expect(testoXml(x)).toBe('1');
    }
    expect(figliElemento(uno, 'w:r').map((x) => testoXml(x))).toEqual(['Pag. ', ' di ']);
    expect(figliElemento(due, 'w:fldSimple').map((x) => x.attributi['w:instr'])).toEqual([' PAGE ', ' NUMPAGES ']);
    expect(figliElemento(due, 'w:r').length).toBe(0);
    expect(figliElemento(tre, 'w:fldSimple').map((x) => x.attributi['w:instr'])).toEqual([' PAGE ']);
    expect(figliElemento(tre, 'w:r').length).toBe(0);
    expect(trova(due, 'w:fldSimple/w:r/w:rPr')).toBeUndefined();
  });

  it('gli identificativi delle relazioni sono tutti diversi, con link, immagini, intestazione e piè di pagina', async () => {
    const doc: Documento = {
      ...documento('x', [par('Testata')], [par('Fine')]),
      paragrafi: [{ runs: [run('vai', { u: 'https://esempio.it' }), run(OGGETTO, { im: { s: PNG, w: 10, h: 10 } })] }],
    };
    const c = await pacchetto(doc);
    const id = figliElemento(c.xml('word/_rels/document.xml.rels'), 'Relationship').map((x) => x.attributi.Id);
    expect(id.length).toBe(6);
    expect(new Set(id).size).toBe(6);
    const sezione = trova(c.xml('word/document.xml'), 'w:body/w:sectPr') as NodoXml;
    for (const rif of ['w:headerReference', 'w:footerReference']) expect(id).toContain(figliElemento(sezione, rif)[0].attributi['r:id']);
  });

  it('un\'intestazione che non si può scrivere (link, immagini) dà un errore e non un file sbagliato', async () => {
    const guasto: Documento = { paragrafi: [{ runs: [] }], intestazione: [{ runs: [run('vai', { u: 'https://esempio.it' })] }] };
    await expect(esportaDocx(guasto)).rejects.toThrow('Intestazione o piè di pagina non validi: niente link né immagini');
  });
});

describe('T301 intestazione e piè di pagina nel formato .docx: importazione', () => {
  it('scritto e riletto: il documento è lo stesso', async () => {
    const docs = [
      documento('corpo\nsecondo', [{ al: 'ce', runs: [run('Re', { g: true }), run('lazione', { c: true, s: true, f: 'Roboto', z: 14, k: '#112233', h: '#ffff00' })] }, par('seconda')], [par(`Pag. ${CAMPO_PAGINA} di ${CAMPO_PAGINE}`, { al: 'dx' })]),
      documento('x', [par('solo testata')]),
      documento('x', undefined, [{ al: 'gi', runs: [run(`${CAMPO_PAGINA}`, { g: true }), run(' / '), run(`${CAMPO_PAGINE}`, { c: true })] }, par('a\tb'), par('c')]),
      daTesto('niente'),
    ];
    for (const d of docs) {
      const r = await importaDocx(await esportaDocx(d));
      expect(r.intestazione, 'intestazione').toEqual(d.intestazione);
      expect(r.piede, 'piede').toEqual(d.piede);
      expect(testoDi(r)).toBe(testoDi(d));
    }
    expect('intestazione' in (await importaDocx(await esportaDocx(daTesto('niente'))))).toBe(false);
  });

  it('campi complessi di Word: PAGE e NUMPAGES, con o senza separatore, col formato del tratto', async () => {
    const d = await conIntestazione(
      p(`${r('Pagina ')}${campoComplesso('PAGE \\* MERGEFORMAT', '1', '<w:b/>')}${r(' di ')}${campoComplesso('NUMPAGES', '9', '<w:i/>', false)}`, 'right')
      + p(campoComplesso('PAGE', '7')),
    );
    expect(d.intestazione).toEqual([
      { al: 'dx', runs: [run('Pagina '), run(CAMPO_PAGINA, { g: true }), run(' di '), run(CAMPO_PAGINE, { c: true })] },
      par(CAMPO_PAGINA),
    ]);
    expect(testoDi(d)).toBe('corpo');
  });

  it('campi semplici: PAGE e NUMPAGES col formato del tratto, gli altri restano testo', async () => {
    const d = await conIntestazione(
      p(`${campoSemplice('PAGE', '4', '<w:b/>')}${r(' - ')}${campoSemplice('NUMPAGES', '8')}${r(' - ')}${campoSemplice('DATE \\@ d/M/yyyy', '2/3/2024')}`),
    );
    expect(d.intestazione).toEqual([{ runs: [run(CAMPO_PAGINA, { g: true }), run(` - ${CAMPO_PAGINE} - 2/3/2024`)] }]);
  });

  it('un campo dentro lo stesso tratto del testo che lo precede: il testo prima, poi il campo', async () => {
    const d = await conIntestazione(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Pag. </w:t><w:fldChar w:fldCharType="begin"/><w:instrText> PAGE </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>1</w:t><w:fldChar w:fldCharType="end"/><w:t xml:space="preserve"> fine</w:t></w:r></w:p>`);
    expect(d.intestazione).toEqual([{ runs: [run(`Pag. ${CAMPO_PAGINA} fine`, { g: true })] }]);
  });

  it('altri campi complessi (data, indice) restano testo col valore che avevano', async () => {
    const d = await conIntestazione(p(`${r('Il ')}${campoComplesso('DATE \\@ "dd/MM/yyyy"', '02/03/2024')}${r(' ')}${campoComplesso('TIME', '10:30', '<w:b/>', false)}`));
    expect(d.intestazione).toEqual([{ runs: [run('Il 02/03/2024 ')] }]);
  });

  it('campi che iniziano come PAGE o NUMPAGES ma sono altri (rimandi, pagine della sezione) restano testo', async () => {
    const d = await conIntestazione(p(`${campoComplesso('PAGEREF _Toc1 \h', '3')}${r(' ')}${campoComplesso('SECTIONPAGES', '2')}${r(' ')}${campoSemplice('PAGEREF x', '5')}${r(' ')}${campoSemplice('NUMPAGESX', '6')}`));
    expect(d.intestazione).toEqual([par('3 2 5 6')]);
    const minuscolo = await conIntestazione(p(`${campoComplesso('page', '1')}${campoSemplice('numpages', '2')}`));
    expect(minuscolo.intestazione).toEqual([par(`${CAMPO_PAGINA}${CAMPO_PAGINE}`)]);
  });

  it('i campi nel corpo del testo non diventano mai campi del numero di pagina', async () => {
    const d = await importaDocx(await word({ corpo: p(`${r('a ')}${campoSemplice('PAGE', '5')}${r(' b ')}${campoComplesso('NUMPAGES', '9')}`) }));
    expect(testoDi(d)).toBe('a 5 b 9');
    expect(testoDi(d)).not.toContain(CAMPO_PAGINA);
    expect(testoDi(d)).not.toContain(CAMPO_PAGINE);
  });

  it('allineamenti: sinistra, centro, destra e giustificato', async () => {
    const d = await conIntestazione(p(r('a'), 'left') + p(r('b'), 'center') + p(r('c'), 'end'));
    expect(d.intestazione?.map((x) => x.al)).toEqual([undefined, 'ce', 'dx']);
    const g = await conIntestazione(p(r('d'), 'both'));
    expect(g.intestazione?.[0].al).toBe('gi');
  });

  it('si legge solo la parte "default": senza tipo vale default, "first" ed "even" si ignorano', async () => {
    const sezione = (rif: string) => `<w:sectPr>${rif}<w:titlePg/></w:sectPr>`;
    const rels = rel('rIdF', 'header', 'primo.xml') + rel('rIdE', 'header', 'pari.xml') + rel('rIdD', 'header', 'normale.xml');
    const parti = { 'word/primo.xml': testata(p(r('primo'))), 'word/pari.xml': testata(p(r('pari'))), 'word/normale.xml': testata(p(r('normale'))) };
    const tutte = '<w:headerReference w:type="first" r:id="rIdF"/><w:headerReference w:type="even" r:id="rIdE"/><w:headerReference w:type="default" r:id="rIdD"/>';
    expect((await importaDocx(await word({ sezione: sezione(tutte), rels, parti }))).intestazione).toEqual([par('normale')]);
    expect((await importaDocx(await word({ sezione: sezione('<w:headerReference r:id="rIdD"/>'), rels, parti }))).intestazione).toEqual([par('normale')]);
    expect((await importaDocx(await word({ sezione: sezione('<w:headerReference w:type="first" r:id="rIdF"/><w:headerReference w:type="even" r:id="rIdE"/>'), rels, parti })) as Documento).intestazione).toBeUndefined();
  });

  it('si usa la sezione finale del corpo, non quelle dentro i paragrafi', async () => {
    const dentro = `<w:p><w:pPr><w:sectPr><w:headerReference w:type="default" r:id="rIdA"/></w:sectPr></w:pPr></w:p>`;
    const d = await importaDocx(await word({
      corpo: `${dentro}<w:p><w:r><w:t>testo</w:t></w:r></w:p>`, sezione: SEZIONE_INTESTAZIONE,
      rels: rel('rIdA', 'header', 'a.xml') + RELAZIONE_INTESTAZIONE,
      parti: { 'word/a.xml': testata(p(r('sbagliata'))), 'word/header1.xml': testata(p(r('giusta'))) },
    }));
    expect(d.intestazione).toEqual([par('giusta')]);
    const senzaSezioneFinale = await importaDocx(await word({ corpo: dentro, rels: rel('rIdA', 'header', 'a.xml'), parti: { 'word/a.xml': testata(p(r('sbagliata'))) } }));
    expect(senzaSezioneFinale.intestazione).toBeUndefined();
  });

  it('percorsi delle parti: assoluti, con altro nome, e relazioni che mancano o non portano a niente', async () => {
    const sez = (id: string, tipo = 'headerReference') => `<w:sectPr><w:${tipo} w:type="default" r:id="${id}"/></w:sectPr>`;
    const assoluto = await importaDocx(await word({ sezione: sez('rId9'), rels: rel('rId9', 'header', '/word/altro/testata.xml'), parti: { 'word/altro/testata.xml': testata(p(r('assoluta'))) } }));
    expect(assoluto.intestazione).toEqual([par('assoluta')]);
    const relativo = await importaDocx(await word({ sezione: sez('rId9'), rels: rel('rId9', 'header', 'sotto/testata7.xml'), parti: { 'word/sotto/testata7.xml': testata(p(r('relativa'))) } }));
    expect(relativo.intestazione).toEqual([par('relativa')]);
    const salita = await importaDocx(await word({ sezione: sez('rId9'), rels: rel('rId9', 'header', '../extra/t.xml'), parti: { 'extra/t.xml': testata(p(r('in alto'))) } }));
    expect(salita.intestazione).toEqual([par('in alto')]);
    const ignoto = await importaDocx(await word({ sezione: sez('rId9'), rels: rel('rId1', 'header', 'header1.xml'), parti: { 'word/header1.xml': testata(p(r('x'))) } }));
    expect(ignoto.intestazione).toBeUndefined();
    const senzaFile = await importaDocx(await word({ sezione: sez('rId9'), rels: rel('rId9', 'header', 'manca.xml') }));
    expect(senzaFile.intestazione).toBeUndefined();
    const senzaRels = await importaDocx(await word({ sezione: sez('rId9'), senzaRels: true, parti: { 'word/header1.xml': testata(p(r('x'))) } }));
    expect(senzaRels.intestazione).toBeUndefined();
    const senzaSezione = await importaDocx(await word({ rels: RELAZIONE_INTESTAZIONE, parti: { 'word/header1.xml': testata(p(r('x'))) } }));
    expect(senzaSezione.intestazione).toBeUndefined();
    const senzaId = await importaDocx(await word({ sezione: '<w:sectPr><w:headerReference w:type="default"/></w:sectPr>', rels: RELAZIONE_INTESTAZIONE, parti: { 'word/header1.xml': testata(p(r('x'))) } }));
    expect(senzaId.intestazione).toBeUndefined();
  });

  it('piè di pagina e intestazione insieme, ognuno al suo posto', async () => {
    const d = await importaDocx(await word({
      sezione: '<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/></w:sectPr>',
      rels: RELAZIONE_INTESTAZIONE + rel('rIdF', 'footer', 'footer1.xml'),
      parti: { 'word/header1.xml': testata(p(r('Testata'))), 'word/footer1.xml': testata(p(r('Fine'), 'center'), 'ftr') },
    }));
    expect(d.intestazione).toEqual([par('Testata')]);
    expect(d.piede).toEqual([par('Fine', { al: 'ce' })]);
    const soloPiede = await importaDocx(await word({
      sezione: '<w:sectPr><w:footerReference w:type="default" r:id="rIdF"/></w:sectPr>', rels: rel('rIdF', 'footer', 'footer1.xml'),
      parti: { 'word/footer1.xml': testata(p(r('Fine')), 'ftr') },
    }));
    expect('intestazione' in soloPiede).toBe(false);
    expect(soloPiede.piede).toEqual([par('Fine')]);
  });

  it('parti vuote: nessuna intestazione; paragrafi vuoti all\'inizio restano, quelli in fondo no', async () => {
    expect('intestazione' in (await conIntestazione('<w:p/>'))).toBe(false);
    expect('intestazione' in (await conIntestazione(`${p('')}${p('', 'center')}`))).toBe(false);
    expect((await conIntestazione(`<w:p/>${p(r('Titolo'))}<w:p/><w:p/>`)).intestazione).toEqual([{ runs: [] }, par('Titolo')]);
  });

  it('si riducono a testo semplice: al massimo 3 paragrafi e 300 caratteri, senza link, immagini, tabelle, elenchi e stili', async () => {
    const quattro = await conIntestazione(p(r('a')) + p(r('b')) + p(r('c')) + p(r('d')));
    expect(quattro.intestazione?.map(testoParagrafo)).toEqual(['a', 'b', 'c']);
    const lungo = await conIntestazione(p(`${r('x'.repeat(200), '<w:b/>')}${r('y'.repeat(200))}`));
    expect(lungo.intestazione).toEqual([{ runs: [run('x'.repeat(200), { g: true }), run('y'.repeat(100))] }]);
    expect((await conIntestazione(p(r('z'.repeat(400))))).intestazione).toEqual([par('z'.repeat(300))]);
    const esatto = await conIntestazione(p(`${r('x'.repeat(300), '<w:b/>')}${r('y'.repeat(50))}`));
    expect(esatto.intestazione).toEqual([{ runs: [run('x'.repeat(300), { g: true })] }]);
    expect((await conIntestazione(p(r('w'.repeat(300))))).intestazione).toEqual([par('w'.repeat(300))]);
    const collegamento = await conIntestazione(`<w:p><w:hyperlink r:id="rIdL">${r('vai')}</w:hyperlink>${r(' qui')}</w:p>`, { rels: RELAZIONE_INTESTAZIONE + rel('rIdL', 'hyperlink', 'https://esempio.it', ' TargetMode="External"') });
    expect(collegamento.intestazione).toEqual([par('vai qui')]);
    const tabella = await conIntestazione('<w:tbl><w:tr><w:tc><w:p><w:r><w:t>uno</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>due</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
    expect(tabella.intestazione?.map(testoParagrafo)).toEqual(['uno', 'due']);
    expect(tabella.intestazione?.every((x) => x.tb === undefined)).toBe(true);
    const decorato = await conIntestazione(`<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:ind w:left="1440"/><w:spacing w:line="480" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${r('Titolo')}</w:p>`);
    expect(decorato.intestazione).toEqual([par('Titolo', { al: 'ce' })]);
    expect(controllaMargine(decorato.intestazione as Paragrafo[])).toBeNull();
    expect(controllaMargine(lungo.intestazione as Paragrafo[])).toBeNull();
    const conTab = await conIntestazione(`<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t></w:r></w:p>`);
    expect(conTab.intestazione).toEqual([par('a\tb')]);
  });

  it('le immagini dell\'intestazione si scartano e il testo accanto resta', async () => {
    const disegno = `<w:r><w:drawing><wp:inline><wp:extent cx="95250" cy="95250"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdI"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const png = Uint8Array.from(atob(PNG.split(',')[1]), (c) => c.charCodeAt(0));
    const corpoConImmagine = await importaDocx(await word({ corpo: `<w:p>${disegno}</w:p>`, rels: rel('rIdI', 'image', 'media/a.png'), parti: { 'word/media/a.png': png } }));
    expect(corpoConImmagine.paragrafi[0].runs.some((x) => x.im !== undefined)).toBe(true);
    const d = await conIntestazione(`<w:p>${r('prima ')}${disegno}${r(' dopo')}</w:p>`, { rels: RELAZIONE_INTESTAZIONE + rel('rIdI', 'image', 'media/a.png'), parti: { 'word/header1.xml': testata(`<w:p>${r('prima ')}${disegno}${r(' dopo')}</w:p>`), 'word/media/a.png': png } });
    expect(d.intestazione).toEqual([par('prima  dopo')]);
    expect(d.intestazione?.[0].runs.some((x) => x.t.includes(OGGETTO))).toBe(false);
  });

  it('una parte che non è XML dà un errore chiaro', async () => {
    await expect(importaDocx(await word({ sezione: SEZIONE_INTESTAZIONE, rels: RELAZIONE_INTESTAZIONE, parti: { 'word/header1.xml': '<w:hdr' } }))).rejects.toThrow(/^DOCX non valido: word\/header1\.xml: /);
  });
});

function nodiDi(n: NodoXml): string[] { return n.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome).filter((nome) => nome !== 'w:rPr'); }
