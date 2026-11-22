// Ruotare, capovolgere e ritagliare un'immagine di pmb_docs: si rifà l'immagine stessa con un canvas (così è uguale in ogni formato,
// anche nel PDF e nei programmi che non conoscono rotazioni e ritagli). Il JPEG resta JPEG (qualità 0,92), gli altri diventano PNG.
// Le misure nel foglio seguono l'immagine: ruotando si scambiano (stando dentro la larghezza del testo), ritagliando si riducono
// della parte tolta. Le parti pure (misure e conti) sono esportate per le prove; il resto usa il DOM.
import { immagineValida, LARGHEZZA_TESTO, ALTEZZA_MASSIMA, type Immagine } from '../modello/documento';

export type Trasformazione = 'ruotaDestra' | 'ruotaSinistra' | 'capovolgiOrizzontale' | 'capovolgiVerticale';
/** Quanto togliere da ogni lato, in percento della larghezza (sx, dx) e dell'altezza (su, giu). */
export interface Ritaglio { sx: number; dx: number; su: number; giu: number }
/** Di ogni lato si toglie al massimo il 45%: resta sempre almeno il 10% dell'immagine. */
export const RITAGLIO_MASSIMO = 45;

export function ritaglioValido(r: Ritaglio): Ritaglio {
  const v = (x: number): number => (Number.isFinite(x) ? Math.min(RITAGLIO_MASSIMO, Math.max(0, Math.round(x * 10) / 10)) : 0);
  return { sx: v(r.sx), dx: v(r.dx), su: v(r.su), giu: v(r.giu) };
}

/** Le misure nel foglio dopo la trasformazione (puro). */
export function misureDopo(im: Immagine, op: Trasformazione): { w: number; h: number } {
  if (op === 'capovolgiOrizzontale' || op === 'capovolgiVerticale') return { w: im.w, h: im.h };
  let w = im.h;
  let h = im.w;
  const scala = Math.min(1, LARGHEZZA_TESTO / w, ALTEZZA_MASSIMA / h);
  w = Math.max(1, Math.round(w * scala));
  h = Math.max(1, Math.round(h * scala));
  return { w, h };
}

/** Il rettangolo da tenere (in pixel dell'immagine vera) e le misure nel foglio dopo il ritaglio (puro). */
export function contiRitaglio(im: Immagine, naturale: { w: number; h: number }, r0: Ritaglio): { x: number; y: number; cw: number; ch: number; w: number; h: number } | null {
  const r = ritaglioValido(r0);
  const x = Math.round((naturale.w * r.sx) / 100);
  const y = Math.round((naturale.h * r.su) / 100);
  const cw = naturale.w - x - Math.round((naturale.w * r.dx) / 100);
  const ch = naturale.h - y - Math.round((naturale.h * r.giu) / 100);
  if (cw < 1 || ch < 1) return null;
  return { x, y, cw, ch, w: Math.max(1, Math.round((im.w * cw) / naturale.w)), h: Math.max(1, Math.round((im.h * ch) / naturale.h)) };
}

function carica(s: string): Promise<HTMLImageElement | null> {
  return new Promise((risolvi) => {
    const img = new Image();
    img.onload = () => risolvi(img.naturalWidth >= 1 && img.naturalHeight >= 1 ? img : null);
    img.onerror = () => risolvi(null);
    img.src = s;
  });
}

const tipoUscita = (s: string): 'image/jpeg' | 'image/png' => (s.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png');

function nuova(im: Immagine, canvas: HTMLCanvasElement, w: number, h: number): Immagine | null {
  const s = canvas.toDataURL(tipoUscita(im.s), 0.92);
  const out: Immagine = { s, w, h, ...(im.a !== undefined ? { a: im.a } : {}) };
  return immagineValida(out) ? out : null;
}

/** L'immagine ruotata o capovolta, o null se non si riesce (immagine illeggibile o troppo grande dopo). */
export async function trasformaImmagine(im: Immagine, op: Trasformazione): Promise<Immagine | null> {
  const img = await carica(im.s);
  if (!img) return null;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const ruota = op === 'ruotaDestra' || op === 'ruotaSinistra';
  const canvas = document.createElement('canvas');
  canvas.width = ruota ? H : W;
  canvas.height = ruota ? W : H;
  const c = canvas.getContext('2d');
  if (!c) return null;
  if (op === 'ruotaDestra') { c.translate(H, 0); c.rotate(Math.PI / 2); }
  else if (op === 'ruotaSinistra') { c.translate(0, W); c.rotate(-Math.PI / 2); }
  else if (op === 'capovolgiOrizzontale') { c.translate(W, 0); c.scale(-1, 1); }
  else { c.translate(0, H); c.scale(1, -1); }
  c.drawImage(img, 0, 0);
  const m = misureDopo(im, op);
  return nuova(im, canvas, m.w, m.h);
}

/** L'immagine ritagliata, o null se non si riesce. */
export async function ritagliaImmagine(im: Immagine, r: Ritaglio): Promise<Immagine | null> {
  const img = await carica(im.s);
  if (!img) return null;
  const k = contiRitaglio(im, { w: img.naturalWidth, h: img.naturalHeight }, r);
  if (!k) return null;
  const canvas = document.createElement('canvas');
  canvas.width = k.cw;
  canvas.height = k.ch;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.drawImage(img, k.x, k.y, k.cw, k.ch, 0, 0, k.cw, k.ch);
  return nuova(im, canvas, k.w, k.h);
}
