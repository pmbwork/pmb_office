// Formato .odt (OpenDocument Text, LibreOffice Writer) per pmb_docs:
// esporta il documento e importa i documenti generati da LibreOffice / OpenOffice.
// Puro: riceve o restituisce byte, non tocca il DOM o la finestra.
import { leggiZip, scriviZip, type VoceZip } from '@comune/formati/zip';
import { analizzaXml, elemento, escapaXml, trova, type NodoXml } from '@comune/formati/xml';
import { t } from '../i18n/lingua';
import {
  normalizza, urlValido,
  type AttributiParagrafo, type Documento, type Paragrafo, type Run,
} from '../modello/documento';

export const MIME_ODT = 'application/vnd.oasis.opendocument.text';
const NS_OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const NS_STYLE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const NS_FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const NS_XLINK = 'http://www.w3.org/1999/xlink';
const NS_MANIFEST = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';

const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

function esadecimale(c: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(c);
  if (!m) return null;
  const h = m[1];
  const sei = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  return '#' + sei.toUpperCase();
}

function runVuoto(t = ''): Run {
  return { t, g: false, c: false, s: false };
}

// ===================== ESPORTAZIONE ODT =====================

export async function esportaOdt(doc: Documento): Promise<Uint8Array> {
  const stiliTesto: string[] = [];
  const stiliParagrafo: string[] = [];

  let contatoreStileT = 0;
  let contatoreStileP = 0;
  const mappaStiliT = new Map<string, string>();
  const mappaStiliP = new Map<string, string>();

  function idStileRun(r: Run): string | undefined {
    const chiavi: string[] = [];
    if (r.g) chiavi.push('b');
    if (r.c) chiavi.push('i');
    if (r.s) chiavi.push('u');
    if (r.x === 'b') chiavi.push('s');
    if (r.k) chiavi.push(`c:${esadecimale(r.k)}`);
    if (r.h) chiavi.push(`bg:${esadecimale(r.h)}`);
    if (r.z) chiavi.push(`z:${r.z}`);
    if (r.f) chiavi.push(`f:${r.f}`);
    if (r.v) chiavi.push(`v:${r.v}`);
    if (chiavi.length === 0) return undefined;
    const chiave = chiavi.join(';');
    if (mappaStiliT.has(chiave)) return mappaStiliT.get(chiave);

    const nome = `T${++contatoreStileT}`;
    mappaStiliT.set(chiave, nome);

    const attrs: Record<string, string> = {};
    if (r.g) attrs['fo:font-weight'] = 'bold';
    if (r.c) attrs['fo:font-style'] = 'italic';
    if (r.s) { attrs['style:text-underline-style'] = 'solid'; attrs['style:text-underline-width'] = 'auto'; }
    if (r.x === 'b') attrs['style:text-line-through-style'] = 'solid';
    const col = r.k ? esadecimale(r.k) : null;
    if (col) attrs['fo:color'] = col;
    const bg = r.h ? esadecimale(r.h) : null;
    if (bg) attrs['fo:background-color'] = bg;
    if (r.z) attrs['fo:font-size'] = `${r.z}pt`;
    if (r.f) attrs['style:font-name'] = r.f;
    if (r.v === 'p') attrs['style:text-position'] = 'super 58%';
    if (r.v === 'b') attrs['style:text-position'] = 'sub 58%';

    stiliTesto.push(elemento('style:style', { 'style:name': nome, 'style:family': 'text' }, [
      elemento('style:text-properties', attrs),
    ]));
    return nome;
  }

  function idStilePar(p: Paragrafo): string | undefined {
    const chiavi: string[] = [];
    if (p.al) chiavi.push(`al:${p.al}`);
    if (p.ls) chiavi.push(`ls:${p.ls}`);
    if (p.ri) chiavi.push(`ri:${p.ri}`);
    if (p.sb) chiavi.push(`sb:${p.sb}`);
    if (p.sa) chiavi.push(`sa:${p.sa}`);
    if (p.bd) chiavi.push(`bd:${p.bd.w}${p.bd.c}${p.bd.s}`);
    if (p.sp) chiavi.push('sp');
    if (p.hr) chiavi.push('hr');
    if (chiavi.length === 0) return undefined;
    const chiave = chiavi.join(';');
    if (mappaStiliP.has(chiave)) return mappaStiliP.get(chiave);

    const nome = `P${++contatoreStileP}`;
    mappaStiliP.set(chiave, nome);

    const attrs: Record<string, string> = {};
    if (p.al === 'ce') attrs['fo:text-align'] = 'center';
    else if (p.al === 'dx') attrs['fo:text-align'] = 'end';
    else if (p.al === 'gi') attrs['fo:text-align'] = 'justify';
    else attrs['fo:text-align'] = 'start';

    if (p.ls) attrs['fo:line-height'] = `${Math.round(p.ls * 100)}%`;
    if (p.ri) attrs['fo:margin-left'] = `${(p.ri * 1.25).toFixed(2)}cm`;
    if (p.sb) attrs['fo:margin-top'] = `${p.sb}pt`;
    if (p.sa) attrs['fo:margin-bottom'] = `${p.sa}pt`;
    if (p.bd) attrs['fo:border'] = `${p.bd.w}pt ${p.bd.s === 'c' ? 'solid' : p.bd.s === 't' ? 'dashed' : 'dotted'} ${p.bd.c}`;
    if (p.sp) attrs['fo:break-before'] = 'page';
    if (p.hr) attrs['fo:border-bottom'] = '0.5pt solid #c7c7c7';

    stiliParagrafo.push(elemento('style:style', { 'style:name': nome, 'style:family': 'paragraph' }, [
      elemento('style:paragraph-properties', attrs),
    ]));
    return nome;
  }

  function serializzaParagrafo(p: Paragrafo): string {
    const stPar = idStilePar(p);
    const attrsPar: Record<string, string> = {};
    if (stPar) attrsPar['text:style-name'] = stPar;

    const spanPar: string[] = [];
    const runs = p.runs && p.runs.length > 0 ? p.runs : [runVuoto()];
    for (const r of runs) {
      const stRun = idStileRun(r);
      let runXml = escapaXml(r.t);
      if (stRun) {
        runXml = elemento('text:span', { 'text:style-name': stRun }, [runXml]);
      }
      if (r.u && urlValido(r.u)) {
        runXml = elemento('text:a', { 'xlink:type': 'simple', 'xlink:href': r.u }, [runXml]);
      }
      spanPar.push(runXml);
    }

    const tag = p.st && ['1', '2', '3'].includes(p.st) ? 'text:h' : 'text:p';
    if (tag === 'text:h') {
      attrsPar['text:outline-level'] = p.st ?? '1';
    }
    return elemento(tag, attrsPar, spanPar);
  }

  const corpoXml: string[] = [];
  const paragrafi = doc.paragrafi ?? [];
  let i = 0;

  while (i < paragrafi.length) {
    const p = paragrafi[i];
    if (p.tb) {
      const idTab = p.tb.i;
      const celle: Paragrafo[][][] = [];
      while (i < paragrafi.length && paragrafi[i].tb?.i === idTab) {
        const pt = paragrafi[i];
        const r = pt.tb!.r;
        const c = pt.tb!.c;
        (celle[r] ??= [])[c] ??= [];
        celle[r][c].push(pt);
        i++;
      }
      const righeXml: string[] = [];
      for (const riga of celle) {
        const celleXml: string[] = [];
        for (const colCella of (riga ?? [])) {
          const parsCella = (colCella ?? []).map((cp) => serializzaParagrafo(cp));
          celleXml.push(elemento('table:table-cell', { 'office:value-type': 'string' }, parsCella));
        }
        righeXml.push(elemento('table:table-row', {}, celleXml));
      }
      corpoXml.push(elemento('table:table', { 'table:name': `Tabella_${idTab}` }, righeXml));
    } else {
      corpoXml.push(serializzaParagrafo(p));
      i++;
    }
  }

  const contentXml = INTESTAZIONE_XML + elemento('office:document-content', {
    'xmlns:office': NS_OFFICE,
    'xmlns:style': NS_STYLE,
    'xmlns:text': NS_TEXT,
    'xmlns:table': NS_TABLE,
    'xmlns:fo': NS_FO,
    'xmlns:xlink': NS_XLINK,
    'office:version': '1.3',
  }, [
    elemento('office:automatic-styles', {}, [...stiliParagrafo, ...stiliTesto]),
    elemento('office:body', {}, [
      elemento('office:text', {}, corpoXml),
    ]),
  ]);

  const stylesXml = INTESTAZIONE_XML + elemento('office:document-styles', {
    'xmlns:office': NS_OFFICE,
    'xmlns:style': NS_STYLE,
    'xmlns:text': NS_TEXT,
    'xmlns:table': NS_TABLE,
    'xmlns:fo': NS_FO,
    'office:version': '1.3',
  }, [
    elemento('office:styles', {}, [
      elemento('style:default-style', { 'style:family': 'paragraph' }, [
        elemento('style:paragraph-properties', { 'fo:line-height': '115%' }),
        elemento('style:text-properties', { 'style:font-name': 'Roboto', 'fo:font-size': '11pt' }),
      ]),
    ]),
  ]);

  const metaXml = INTESTAZIONE_XML + elemento('office:document-meta', {
    'xmlns:office': NS_OFFICE,
    'xmlns:meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
    'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
    'office:version': '1.3',
  }, [
    elemento('office:meta', {}, [
      elemento('meta:generator', {}, ['pmb_office pmb_docs 0.1']),
      elemento('dc:date', {}, [new Date().toISOString()]),
    ]),
  ]);

  const manifestXml = INTESTAZIONE_XML + elemento('manifest:manifest', {
    'xmlns:manifest': NS_MANIFEST,
    'manifest:version': '1.3',
  }, [
    elemento('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': MIME_ODT }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'content.xml', 'manifest:media-type': 'text/xml' }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'styles.xml', 'manifest:media-type': 'text/xml' }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'meta.xml', 'manifest:media-type': 'text/xml' }),
  ]);

  const voci: VoceZip[] = [
    { nome: 'mimetype', dati: new TextEncoder().encode(MIME_ODT), senzaCompressione: true },
    { nome: 'META-INF/manifest.xml', dati: new TextEncoder().encode(manifestXml) },
    { nome: 'content.xml', dati: new TextEncoder().encode(contentXml) },
    { nome: 'styles.xml', dati: new TextEncoder().encode(stylesXml) },
    { nome: 'meta.xml', dati: new TextEncoder().encode(metaXml) },
  ];

  return scriviZip(voci);
}

// ===================== IMPORTAZIONE ODT =====================

export async function importaOdt(bytes: Uint8Array): Promise<Documento> {
  const archivio = await leggiZip(bytes);
  const contentBytes = archivio.get('content.xml');
  if (!contentBytes) throw new Error(t('File ODT non valido: content.xml mancante'));

  const xmlStr = new TextDecoder('utf-8').decode(contentBytes);
  const radice = analizzaXml(xmlStr);

  const stiliMappa = new Map<string, { r?: Partial<Run>; p?: Partial<AttributiParagrafo> }>();
  const autoStyles = trova(radice, 'office:automatic-styles');
  if (autoStyles) {
    const stili = autoStyles.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'style:style');
    for (const s of stili) {
      const nome = s.attributi['style:name'];
      if (!nome) continue;
      const st: { r?: Partial<Run>; p?: Partial<AttributiParagrafo> } = {};

      const textProp = trova(s, 'style:text-properties');
      if (textProp) {
        st.r = {};
        if (textProp.attributi['fo:font-weight'] === 'bold') st.r.g = true;
        if (textProp.attributi['fo:font-style'] === 'italic') st.r.c = true;
        if (textProp.attributi['style:text-underline-style'] === 'solid') st.r.s = true;
        if (textProp.attributi['style:text-line-through-style'] === 'solid') st.r.x = 'b';
        if (textProp.attributi['fo:color']) st.r.k = textProp.attributi['fo:color'];
        if (textProp.attributi['fo:background-color']) st.r.h = textProp.attributi['fo:background-color'];
        if (textProp.attributi['fo:font-size']) {
          const z = parseFloat(textProp.attributi['fo:font-size']);
          if (!isNaN(z)) st.r.z = z;
        }
        if (textProp.attributi['style:font-name']) st.r.f = textProp.attributi['style:font-name'];
      }

      const parProp = trova(s, 'style:paragraph-properties');
      if (parProp) {
        st.p = {};
        const align = parProp.attributi['fo:text-align'];
        if (align === 'center') st.p.al = 'ce';
        else if (align === 'end' || align === 'right') st.p.al = 'dx';
        else if (align === 'justify') st.p.al = 'gi';
        else if (align === 'start' || align === 'left') st.p.al = 'sx';
      }
      stiliMappa.set(nome, st);
    }
  }

  const officeText = trova(radice, 'office:body/office:text');
  if (!officeText) throw new Error(t('Struttura ODT non valida: office:text non trovato'));

  const outParagrafi: Paragrafo[] = [];
  let contatoreTab = 1;

  function estraiRunDaFigli(figli: Array<NodoXml | string>, ereditati: Partial<Run> = {}): Run[] {
    const runs: Run[] = [];
    for (const f of figli) {
      if (typeof f === 'string') {
        if (f.length > 0) {
          runs.push({
            t: f,
            g: ereditati.g ?? false,
            c: ereditati.c ?? false,
            s: ereditati.s ?? false,
            ...ereditati,
          });
        }
      } else {
        const stileNome = f.attributi['text:style-name'];
        const stileDati = stileNome ? stiliMappa.get(stileNome)?.r : undefined;
        const curProps = { ...ereditati, ...(stileDati ?? {}) };
        if (f.nome === 'text:a') {
          const href = f.attributi['xlink:href'];
          if (href) curProps.u = href;
        }
        runs.push(...estraiRunDaFigli(f.figli, curProps));
      }
    }
    return runs;
  }

  const nodiCorpo = officeText.figli.filter((f): f is NodoXml => typeof f !== 'string');
  for (const n of nodiCorpo) {
    if (n.nome === 'text:p' || n.nome === 'text:h') {
      const stileNome = n.attributi['text:style-name'];
      const stPar = stileNome ? stiliMappa.get(stileNome)?.p : undefined;
      const attr: AttributiParagrafo = { ...(stPar ?? {}) };
      if (n.nome === 'text:h') {
        const lv = n.attributi['text:outline-level'] ?? '1';
        attr.st = (lv === '1' || lv === '2' || lv === '3') ? lv : '1';
      }
      const runs = estraiRunDaFigli(n.figli);
      outParagrafi.push({
        runs: normalizza(runs.length > 0 ? runs : [runVuoto()]),
        ...attr,
      });
    } else if (n.nome === 'table:table') {
      const idT = contatoreTab++;
      const righe = n.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'table:table-row');
      let r = 0;
      for (const row of righe) {
        const celle = row.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'table:table-cell');
        let c = 0;
        for (const cell of celle) {
          const parCella = cell.figli.filter((f): f is NodoXml => typeof f !== 'string' && (f.nome === 'text:p' || f.nome === 'text:h'));
          if (parCella.length === 0) {
            outParagrafi.push({ runs: [runVuoto()], tb: { i: idT, r, c } });
          } else {
            for (const cp of parCella) {
              const runs = estraiRunDaFigli(cp.figli);
              outParagrafi.push({ runs: normalizza(runs.length > 0 ? runs : [runVuoto()]), tb: { i: idT, r, c } });
            }
          }
          c++;
        }
        r++;
      }
      outParagrafi.push({ runs: [runVuoto()] });
    }
  }

  return {
    paragrafi: outParagrafi.length > 0 ? outParagrafi : [{ runs: [runVuoto()] }],
  };
}
