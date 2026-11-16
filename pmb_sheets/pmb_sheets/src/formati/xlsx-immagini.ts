// Immagini di un file .xlsx: la parte "disegno" del foglio (xl/drawings/drawingN.xml) con le figure e i loro byte (xl/media/imageN.ext).
// Scrittura e lettura stanno insieme così le due direzioni restano uguali. Le posizioni sono in pixel dall'angolo in alto a sinistra della prima cella
// (1 pixel = 9525 EMU, come in Excel a 96 dpi); in scrittura si usa un'ancora assoluta, in lettura si capiscono anche le ancore "a cella".
// Puro: nodi XML in entrata, testo XML in uscita.
import { elemento, type NodoXml } from '@comune/formati/xml';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '../sheet/viewport';
import { LATO_MINIMO, LIMITE_BYTE_IMMAGINE, estensioneImmagine, rilevaTipoImmagine, type ImmagineScambio } from '../sheet/immagini';
import type { FoglioScambio } from './scambio';
import { t } from '../i18n/lingua';

const EMU = 9525;
const NS_DISEGNO = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_DRAWINGML = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_RELAZIONI = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Le immagini che Excel sa tenere: PNG, JPEG, GIF. Il WebP no. */
export function immaginiPerExcel(f: FoglioScambio): ImmagineScambio[] {
  return (f.immagini ?? []).filter((i) => i.tipo !== 'image/webp' && i.byte.length > 0);
}

/** Quante immagini WebP di un foglio non possono andare nel file Excel. */
export function immaginiWebp(f: FoglioScambio): number {
  return (f.immagini ?? []).filter((i) => i.tipo === 'image/webp').length;
}

/** Il disegno del foglio: una figura per immagine, ancorata in modo assoluto. `idRelazione(k)` dà l'id della relazione verso i byte della k-esima immagine. */
export function disegnoXml(immagini: ImmagineScambio[], idRelazione: (k: number) => string): string {
  const ancore = immagini.map((im, k) => {
    const cx = Math.round(im.width * EMU);
    const cy = Math.round(im.height * EMU);
    return elemento('xdr:absoluteAnchor', {}, [
      elemento('xdr:pos', { x: Math.round(im.x * EMU), y: Math.round(im.y * EMU) }),
      elemento('xdr:ext', { cx, cy }),
      elemento('xdr:pic', {}, [
        elemento('xdr:nvPicPr', {}, [
          elemento('xdr:cNvPr', { id: k + 2, name: t("Immagine {}", k + 1), descr: im.nome }),
          elemento('xdr:cNvPicPr', {}, [elemento('a:picLocks', { noChangeAspect: 1 })]),
        ]),
        elemento('xdr:blipFill', {}, [elemento('a:blip', { 'r:embed': idRelazione(k) }), elemento('a:stretch', {}, [elemento('a:fillRect')])]),
        elemento('xdr:spPr', {}, [
          elemento('a:xfrm', {}, [elemento('a:off', { x: 0, y: 0 }), elemento('a:ext', { cx, cy })]),
          elemento('a:prstGeom', { prst: 'rect' }, [elemento('a:avLst')]),
        ]),
      ]),
      elemento('xdr:clientData'),
    ]);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${elemento('xdr:wsDr', { 'xmlns:xdr': NS_DISEGNO, 'xmlns:a': NS_DRAWINGML, 'xmlns:r': NS_RELAZIONI }, ancore)}`;
}

/** Nome senza prefisso: "xdr:pic" → "pic". */
const locale = (nome: string): string => nome.slice(nome.indexOf(':') + 1);
const figli = (n: NodoXml): NodoXml[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string');
const figlio = (n: NodoXml | undefined, nome: string): NodoXml | undefined => (n ? figli(n).find((f) => locale(f.nome) === nome) : undefined);
const testoNodo = (n: NodoXml | undefined): string => (n ? n.figli.map((f) => (typeof f === 'string' ? f : '')).join('').trim() : '');
const numero = (n: NodoXml | undefined): number => { const v = Number(testoNodo(n)); return Number.isFinite(v) ? v : 0; };
const attributo = (n: NodoXml | undefined, nome: string): string | undefined => {
  if (!n) return undefined;
  const chiave = Object.keys(n.attributi).find((k) => k === nome || k.endsWith(`:${nome}`));
  return chiave === undefined ? undefined : n.attributi[chiave];
};

function cerca(n: NodoXml, nome: string, profondita = 6): NodoXml | undefined {
  if (locale(n.nome) === nome) return n;
  if (profondita === 0) return undefined;
  for (const f of figli(n)) { const t = cerca(f, nome, profondita - 1); if (t) return t; }
  return undefined;
}

export interface EsitoDisegno { immagini: ImmagineScambio[]; scartate: number; altri: boolean }

/** Legge le immagini di un disegno. `byte(id)` dà i byte dell'immagine per l'id di relazione (undefined se manca).
 *  Le misure delle colonne e delle righe del foglio servono per le ancore "a cella". Restituisce anche quante figure con immagine non si sono potute prendere
 *  (tipo non ammesso, troppo grande, byte mancanti) e se nel disegno c'erano altre cose (grafici, forme, caselle di testo). */
export function leggiDisegno(radice: NodoXml | undefined, byte: (id: string) => Uint8Array | undefined, foglio: Pick<FoglioScambio, 'larghezze' | 'altezze'>): EsitoDisegno {
  const esito: EsitoDisegno = { immagini: [], scartate: 0, altri: false };
  if (!radice) return esito;
  const largColonna = (c: number): number => foglio.larghezze[c] ?? DEFAULT_COL_WIDTH;
  const altRiga = (r: number): number => foglio.altezze[r] ?? DEFAULT_ROW_HEIGHT;
  // posizione in pixel di un punto di ancoraggio (colonna e riga da 0, scostamenti in EMU)
  const punto = (da: NodoXml | undefined): { x: number; y: number } => {
    if (!da) return { x: 0, y: 0 };
    const c = Math.max(0, Math.min(16383, Math.floor(numero(figlio(da, 'col')))));
    const r = Math.max(0, Math.min(1048575, Math.floor(numero(figlio(da, 'row')))));
    let x = numero(figlio(da, 'colOff')) / EMU;
    let y = numero(figlio(da, 'rowOff')) / EMU;
    for (let k = 1; k <= c; k++) x += largColonna(k);
    for (let k = 1; k <= r; k++) y += altRiga(k);
    return { x, y };
  };
  for (const ancora of figli(radice)) {
    const tipoAncora = locale(ancora.nome);
    if (tipoAncora !== 'absoluteAnchor' && tipoAncora !== 'oneCellAnchor' && tipoAncora !== 'twoCellAnchor') continue;
    const pic = figlio(ancora, 'pic');
    if (!pic) { if (figli(ancora).some((f) => ['sp', 'graphicFrame', 'grpSp', 'cxnSp'].includes(locale(f.nome)))) esito.altri = true; continue; }
    let x = 0, y = 0, w = 0, h = 0;
    if (tipoAncora === 'absoluteAnchor') {
      const pos = figlio(ancora, 'pos'); const ext = figlio(ancora, 'ext');
      x = Number(pos?.attributi.x ?? 0) / EMU; y = Number(pos?.attributi.y ?? 0) / EMU;
      w = Number(ext?.attributi.cx ?? 0) / EMU; h = Number(ext?.attributi.cy ?? 0) / EMU;
    } else if (tipoAncora === 'oneCellAnchor') {
      const p = punto(figlio(ancora, 'from')); const ext = figlio(ancora, 'ext');
      x = p.x; y = p.y; w = Number(ext?.attributi.cx ?? 0) / EMU; h = Number(ext?.attributi.cy ?? 0) / EMU;
    } else {
      const p = punto(figlio(ancora, 'from')); const q = punto(figlio(ancora, 'to'));
      x = p.x; y = p.y; w = q.x - p.x; h = q.y - p.y;
    }
    const id = attributo(cerca(pic, 'blip') , 'embed');
    const dati = id !== undefined ? byte(id) : undefined;
    const tipo = dati ? rilevaTipoImmagine(dati) : null;
    if (!dati || !tipo || dati.length > LIMITE_BYTE_IMMAGINE || ![x, y, w, h].every(Number.isFinite)) { esito.scartate++; continue; }
    const cNvPr = cerca(pic, 'cNvPr');
    const nome = (attributo(cNvPr, 'descr') || attributo(cNvPr, 'name') || `immagine.${estensioneImmagine(tipo)}`).slice(0, 255);
    esito.immagini.push({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: Math.max(LATO_MINIMO, Math.round(w)), height: Math.max(LATO_MINIMO, Math.round(h)), nome, tipo, byte: dati });
  }
  return esito;
}
