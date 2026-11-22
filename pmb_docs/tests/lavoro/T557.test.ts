// T557: stili personali (modello/stili.ts): creati dal paragrafo, applicati, aggiornati, rinominati, eliminati; disegnati nella pagina;
// salvati in .pdoc, .docx (come li scrive Word) e .odt (come LibreOffice). File di confronto: tests/file-prova/stili/word-stili.docx
// (fatto da Word con LAVORO/studio-microsoft-office/word_stili.py) e libreoffice-stili.odt (lo stesso file convertito da LibreOffice).
// I file scritti si lasciano in tmp/pmb-T557.docx e .odt per riaprirli in Word e LibreOffice.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { importaOdt, esportaOdt } from '../../src/formati/odt';
import { disegna } from '../../src/editor/render';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor } from '../../src/editor/azioni';
import { cursore, deserializza, serializza, statoIniziale, testoParagrafo, type Documento, type Paragrafo, type Stato } from '../../src/modello/documento';
import { aggiornaStile, applicaStile, creaStile, cssStili, eliminaStile, elencoStili, motivoNome, rinominaStile, senzaStiliPersonali } from '../../src/modello/stili';
import { unisciSchede } from '../../src/modello/schede';
import { popupPerComando, statoBarra } from '../../src/guscio/popup-dati';

const par = (t: string, extra: Partial<Paragrafo> = {}, formato: object = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [{ t, g: false, c: false, s: false, ...formato }] });
const DOC: Documento = { paragrafi: [
  par('Avviso rosso', { al: 'ce', sa: 12 }, { g: true, z: 14, k: '#cc0000', f: 'Georgia' }),
  par('Testo normale'),
  par('Altro avviso'),
  par('Un titolo', { st: '1' }),
] };
const crea = (s: Stato, nome: string): Stato => { const r = creaStile(s, nome); if (typeof r === 'string') throw new Error(r); return r; };

describe('T557: stili personali nel modello', () => {
  test('creare dal paragrafo del cursore: prende carattere, corpo, colore, grassetto, allineamento e spazio; i tratti lasciano il formato allo stile', () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    expect(s.doc.stili).toEqual([{ id: 'Stile1', nome: 'Avviso', base: 'n', f: 'Georgia', z: 14, k: '#cc0000', g: true, al: 'ce', sa: 12 }]);
    expect(s.doc.paragrafi[0].su).toBe('Stile1');
    expect(s.doc.paragrafi[0].runs[0]).toEqual({ t: 'Avviso rosso', g: true, c: false, s: false });   // f, z, k ora dallo stile
    expect(motivoNome(s.doc, 'avviso')).toBe('C\'è già uno stile con questo nome');
    expect(motivoNome(s.doc, 'Titolo 1')).toBe('C\'è già uno stile con questo nome');
    expect(creaStile(s, '  ')).toBe('Scrivi il nome dello stile');
  });
  test('applicare copia allineamento e spazi nel paragrafo; uno stile già fatto (o Cancella formattazione) lo toglie', () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    const doc = applicaStile(s.doc, cursore(2, 0).sel ?? { ancora: { p: 2, o: 0 }, fuoco: { p: 2, o: 0 } }, 'Stile1');
    expect(doc.paragrafi[2]).toMatchObject({ su: 'Stile1', al: 'ce', sa: 12 });
    const ed = nuovoEditor({ doc, sel: { ancora: { p: 2, o: 0 }, fuoco: { p: 2, o: 0 } }, pendenti: null });
    const normale = eseguiAzioneFormato(ed, { tipo: 'stile', valore: '2' }).ed.storia.presente.doc.paragrafi[2];
    expect(normale.su).toBeUndefined();
    expect(normale.st).toBe('2');
    const pulito = eseguiAzioneFormato(ed, { tipo: 'pulisci' }).ed.storia.presente.doc.paragrafi[2];
    expect(pulito.su).toBeUndefined();
    const ancora = eseguiAzioneFormato(ed, { tipo: 'stilePersonale', id: 'Stile1' }).ed.storia.presente.doc.paragrafi[2];
    expect(ancora.su).toBe('Stile1');
  });
  test('uno stile basato su un titolo: il paragrafo è un titolo (sommario) e Invio in fondo torna al testo normale', () => {
    const s = crea({ ...statoIniziale(DOC), sel: { ancora: { p: 3, o: 0 }, fuoco: { p: 3, o: 0 } } }, 'Capitolo');
    expect(s.doc.stili![0].base).toBe('1');
    expect(s.doc.paragrafi[3]).toMatchObject({ su: 'Stile1', st: '1' });
    const ed = nuovoEditor({ ...s, sel: { ancora: { p: 3, o: 9 }, fuoco: { p: 3, o: 9 } } });
    const dopo = eseguiAzioneFormato(ed, { tipo: 'invio' }).ed.storia.presente.doc.paragrafi[4];
    expect(dopo.su).toBeUndefined();
    expect(dopo.st).toBeUndefined();
  });
  test('aggiornare dal paragrafo, rinominare, eliminare; l\'elenco con gli usi', () => {
    let s = crea(statoIniziale(DOC), 'Avviso');
    s = { ...s, doc: applicaStile(s.doc, { ancora: { p: 2, o: 0 }, fuoco: { p: 2, o: 0 } }, 'Stile1') };
    // il paragrafo 2 diventa allineato a destra e in corsivo: aggiornando lo stile da lì, anche il paragrafo 0 va a destra
    const cambiato: Stato = { ...s, doc: { ...s.doc, paragrafi: s.doc.paragrafi.map((p, i) => (i === 2 ? { ...p, al: 'dx', runs: p.runs.map((r) => ({ ...r, c: true })) } : p)) }, sel: { ancora: { p: 2, o: 0 }, fuoco: { p: 2, o: 0 } } };
    const agg = aggiornaStile(cambiato, 'Stile1');
    expect(agg.doc.stili![0]).toMatchObject({ al: 'dx', c: true, g: true, z: 14 });
    expect(agg.doc.paragrafi[0].al).toBe('dx');
    expect(elencoStili(agg.doc).map((v) => [v.stile.nome, v.usi, v.esempio])).toEqual([['Avviso', 2, 'Avviso rosso']]);
    const rin = rinominaStile(agg.doc, 'Stile1', 'Nota');
    expect(typeof rin !== 'string' && rin.stili![0].nome).toBe('Nota');
    expect(rinominaStile(agg.doc, 'Stile1', 'Sottotitolo')).toBe('C\'è già uno stile con questo nome');
    const via = eliminaStile(agg.doc, 'Stile1');
    expect(via.stili).toBeUndefined();
    expect(via.paragrafi.every((p) => p.su === undefined)).toBe(true);
  });
  test('.pdoc: gli stili usati si salvano e si rileggono; uno stile che manca o è rovinato si rifiuta', () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    expect(deserializza(serializza(s.doc))).toEqual(JSON.parse(JSON.stringify(s.doc)));
    const testo = JSON.parse(serializza(s.doc));
    expect(() => deserializza(JSON.stringify({ ...testo, su: [] }))).toThrow();                            // paragrafo con uno stile che non c'è
    expect(() => deserializza(JSON.stringify({ ...testo, su: [{ ...testo.su[0], k: 'rosso' }] }))).toThrow();
    expect(() => deserializza(JSON.stringify({ ...testo, su: [{ ...testo.su[0], f: 'A"; } body { x' }] }))).toThrow();
  });
  test('nella pagina: classe su-ID e regola CSS dello stile; il menu degli stili e la casella della barra', () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    const zona = document.createElement('div');
    disegna(zona, s.doc);
    expect(zona.querySelector('p[data-p="0"]')!.className).toContain('su su-Stile1');
    expect(cssStili(s.doc.stili, (f) => `"${f}"`)).toBe('.testo p.su.su-Stile1 { font-family: "Georgia"; font-size: 14pt; color: #cc0000; font-weight: 700; }');
    const b = statoBarra(s);
    expect(b.valori['stile-paragrafo']).toBe('Avviso ▾');
    const voci = popupPerComando('stile-paragrafo', b)!.voci;
    expect(voci.map((v) => v.etichetta)).toEqual(['Testo normale', 'Titolo', 'Sottotitolo', 'Titolo 1', 'Titolo 2', 'Titolo 3', 'Stili personali', 'Avviso', 'Aggiorna «Avviso» come questo paragrafo', 'Crea o gestisci stili…']);
    expect(voci.filter((v) => v.attiva).map((v) => v.etichetta)).toEqual(['Avviso']);
  });
  test('senza stili (PDF): il formato dello stile va nei tratti; più schede: stili uguali uniti, diversi rinominati', () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    const piatto = senzaStiliPersonali(s.doc);
    expect(piatto.stili).toBeUndefined();
    expect(piatto.paragrafi[0].runs[0]).toMatchObject({ f: 'Georgia', z: 14, k: '#cc0000', g: true });
    const altro = crea(statoIniziale({ paragrafi: [par('x', {}, { c: true })] }), 'Avviso');
    const unito = unisciSchede([{ titolo: 'A', doc: s.doc }, { titolo: 'B', doc: s.doc }, { titolo: 'C', doc: altro.doc }] as never);
    expect(unito.stili!.map((x) => [x.id, x.nome])).toEqual([['Stile1', 'Avviso'], ['Stile1_3_2', 'Avviso (2)']]);
    expect(deserializza(serializza(unito)).stili!.length).toBe(2);
  });
});

describe('T557: .docx e .odt come Word e LibreOffice', () => {
  const attesi = [
    { nome: 'Nota importante', base: 'n', g: true, z: 14, k: '#ff0000', al: 'ce', sa: 12 },
    { nome: 'Capitolo speciale', base: '1', c: true, k: '#0000c0', f: 'Georgia' },
  ];
  const controlla = (d: Documento): void => {
    const perNome = new Map((d.stili ?? []).map((s) => [s.nome, s]));
    for (const a of attesi) expect(perNome.get(a.nome), a.nome).toMatchObject(a);
    const stileDi = (testo: string): string | undefined => { const p = d.paragrafi.find((x) => testoParagrafo(x).startsWith(testo)); return d.stili?.find((s) => s.id === p?.su)?.nome; };
    expect(stileDi('Attenzione')).toBe('Nota importante');
    expect(stileDi('Capitolo che')).toBe('Capitolo speciale');
    expect(stileDi('Un paragrafo normale')).toBeUndefined();
    expect(d.paragrafi.find((x) => testoParagrafo(x).startsWith('Capitolo che'))!.st).toBe('1');
    expect(d.paragrafi.find((x) => testoParagrafo(x).startsWith('Attenzione'))!.al).toBe('ce');
  };
  test('il documento di Word: gli stili personali con base, formato e paragrafi', async () => {
    const d = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/stili/word-stili.docx')));
    controlla(d);
    // i tratti non ripetono il carattere dello stile (Georgia) né quello normale del documento
    expect(d.paragrafi.find((x) => testoParagrafo(x).startsWith('Capitolo che'))!.runs[0].f).toBeUndefined();
  });
  test('lo stesso documento convertito da LibreOffice', async () => {
    controlla(await importaOdt(new Uint8Array(fs.readFileSync('tests/file-prova/stili/libreoffice-stili.odt'))));
  });
  test('scritto da pmb_docs in .docx (customStyle con basedOn) e in .odt (stile con nome in styles.xml), e riletto uguale', async () => {
    const s = crea(statoIniziale(DOC), 'Avviso');
    const s2 = crea({ ...s, sel: { ancora: { p: 3, o: 0 }, fuoco: { p: 3, o: 0 } } }, 'Capitolo mio');
    const { leggiZip } = await import('@comune/formati/zip');
    const docx = await esportaDocx(s2.doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T557.docx'), docx);
    const stiliXml = new TextDecoder().decode((await leggiZip(docx)).get('word/styles.xml')!);
    expect(stiliXml).toContain('<w:style w:type="paragraph" w:customStyle="1" w:styleId="Stile1"><w:name w:val="Avviso"/><w:basedOn w:val="Normal"/>');
    expect(stiliXml).toContain('<w:basedOn w:val="Heading1"/>');
    expect(new TextDecoder().decode((await leggiZip(docx)).get('word/document.xml')!)).toContain('<w:pStyle w:val="Stile2"/>');
    const r = await importaDocx(docx);
    expect(r.stili).toEqual(s2.doc.stili);
    expect(r.paragrafi.map((p) => p.su)).toEqual(s2.doc.paragrafi.map((p) => p.su));
    const odt = await esportaOdt(s2.doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T557.odt'), odt);
    const stiliOdt = new TextDecoder().decode((await leggiZip(odt)).get('styles.xml')!);
    expect(stiliOdt).toContain('style:name="Stile1" style:display-name="Avviso" style:family="paragraph" style:parent-style-name="Standard"');
    const o = await importaOdt(odt);
    expect(o.stili).toEqual(s2.doc.stili);
    expect(o.paragrafi.slice(0, 4).map((p) => p.su)).toEqual(s2.doc.paragrafi.map((p) => p.su));
  });
});
