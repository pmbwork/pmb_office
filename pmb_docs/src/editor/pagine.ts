// Impaginazione di pmb_docs: dove cade il salto da una pagina A4 alla successiva.
// Parte pura: riceve la posizione "naturale" delle righe di testo (come le disporrebbe il browser in un'unica colonna lunga)
// e dice quanto spazio inserire prima di certe righe perché nessuna riga attraversi il bordo di una pagina.
// Le misure sono in pixel dall'alto del primo foglio (il margine alto della prima pagina è dentro la misura).

export interface Riga {
  alto: number;
  basso: number;
  saltoForzato?: boolean;
  /** true se questa riga è già stata portata in cima al foglio dopo da un giro di impaginazione precedente (un salto forzato non va ripetuto) */
  spinta?: boolean;
}
export interface GeometriaPagine {
  /** altezza di un foglio */
  altezzaPagina: number;
  margineAlto: number;
  margineBasso: number;
  /** spazio vuoto tra un foglio e il successivo */
  spazio: number;
}
/** A4 a 96 punti per pollice (1123 px), margini di un pollice, 12 px tra un foglio e l'altro. */
export const GEOMETRIA_A4: GeometriaPagine = { altezzaPagina: 1123, margineAlto: 96, margineBasso: 96, spazio: 12 };
/** Per la stampa: la pagina della stampante è A4 senza margini (297 mm = 1122,52 px) e i fogli si toccano, senza spazio in mezzo. */
export const GEOMETRIA_STAMPA: GeometriaPagine = { altezzaPagina: 1122.52, margineAlto: 96, margineBasso: 96, spazio: 0 };

export type FormatoCarta = 'A4' | 'Letter' | 'A3' | 'A5';
export type OrientamentoPagina = 'verticale' | 'orizzontale';

export interface ImpostazioniPagina {
  formato: FormatoCarta;
  orientamento: OrientamentoPagina;
  margineAlto: number;
  margineBasso: number;
  margineSinistro: number;
  margineDestro: number;
  coloreSfondo: string;
}

export const FORMATI_CARTA: Record<FormatoCarta, { w: number; h: number; etichetta: string }> = {
  A4: { w: 794, h: 1123, etichetta: 'A4 (210 × 297 mm)' },
  Letter: { w: 816, h: 1056, etichetta: 'Letter (216 × 279 mm)' },
  A3: { w: 1123, h: 1587, etichetta: 'A3 (297 × 420 mm)' },
  A5: { w: 559, h: 794, etichetta: 'A5 (148 × 210 mm)' },
};

export const IMPOSTAZIONI_PREDEFINITE: ImpostazioniPagina = {
  formato: 'A4',
  orientamento: 'verticale',
  margineAlto: 96,
  margineBasso: 96,
  margineSinistro: 96,
  margineDestro: 96,
  coloreSfondo: '#ffffff',
};

export function calcolaGeometria(imp: ImpostazioniPagina): GeometriaPagine & { larghezza: number; altezza: number } {
  const base = FORMATI_CARTA[imp.formato] ?? FORMATI_CARTA.A4;
  const larghezza = imp.orientamento === 'orizzontale' ? base.h : base.w;
  const altezza = imp.orientamento === 'orizzontale' ? base.w : base.h;
  return {
    larghezza,
    altezza,
    altezzaPagina: altezza,
    margineAlto: imp.margineAlto,
    margineBasso: imp.margineBasso,
    spazio: 12,
  };
}

export interface Salto { riga: number; altezza: number }
export interface Impaginazione {
  /** spazio da inserire prima della riga indicata (porta la riga in cima alla pagina dopo) */
  salti: Salto[];
  pagine: number;
  /** altezza di tutti i fogli messi uno sotto l'altro, spazi compresi */
  altezzaTotale: number;
  /** pagina (da 0) in cui cade ogni riga dopo i salti */
  paginaDiRiga: number[];
}

const TOLLERANZA = 0.5;

export function inizioPagina(n: number, g: GeometriaPagine = GEOMETRIA_A4): number { return n * (g.altezzaPagina + g.spazio); }
export function altezzaFogli(pagine: number, g: GeometriaPagine = GEOMETRIA_A4): number {
  return pagine * g.altezzaPagina + Math.max(0, pagine - 1) * g.spazio;
}

export function impagina(righe: Riga[], g: GeometriaPagine = GEOMETRIA_A4): Impaginazione {
  const salti: Salto[] = [];
  const paginaDiRiga: number[] = [];
  let pagina = 0;
  let extra = 0;
  let ultimoBasso = 0;
  for (let i = 0; i < righe.length; i++) {
    let alto = righe[i].alto + extra;
    let basso = righe[i].basso + extra;
    const cima = (n: number): number => inizioPagina(n, g) + g.margineAlto;
    const fondo = (n: number): number => inizioPagina(n, g) + g.altezzaPagina - g.margineBasso;
    // una riga che comincia già in una pagina più avanti (dopo un blocco molto alto) conta per quella pagina
    while (alto >= inizioPagina(pagina + 1, g) - TOLLERANZA) pagina++;
    // una riga con salto pagina forzato va in cima alla pagina successiva
    if (righe[i].saltoForzato && !righe[i].spinta) {
      const h = cima(pagina + 1) - alto;
      salti.push({ riga: i, altezza: h });
      extra += h;
      alto += h;
      basso += h;
      pagina++;
    }
    // una riga che non entra più in fondo alla pagina va in cima alla successiva
    while (basso > fondo(pagina) + TOLLERANZA && alto > cima(pagina) + TOLLERANZA) {
      const h = cima(pagina + 1) - alto;
      salti.push({ riga: i, altezza: h });
      extra += h;
      alto += h;
      basso += h;
      pagina++;
    }
    // dopo un blocco molto alto una riga può ritrovarsi nel margine alto del foglio: la si porta dove comincia il testo
    if (alto < cima(pagina) - TOLLERANZA) {
      const h = cima(pagina) - alto;
      salti.push({ riga: i, altezza: h });
      extra += h;
      alto += h;
      basso += h;
    }
    paginaDiRiga.push(pagina);
    ultimoBasso = basso;
  }
  const perAltezza = righe.length === 0 ? 1 : Math.ceil((ultimoBasso + g.margineBasso + g.spazio - TOLLERANZA) / (g.altezzaPagina + g.spazio));
  const pagine = Math.max(1, pagina + 1, perAltezza);
  return { salti, pagine, altezzaTotale: altezzaFogli(pagine, g), paginaDiRiga };
}

export interface Frammento { alto: number; basso: number }

/**
 * Raggruppa i frammenti di testo (quelli che il browser dà per ogni pezzo di riga) in righe.
 * I frammenti arrivano in ordine di lettura: uno comincia una riga nuova se parte sotto la metà della riga che si sta costruendo.
 * Restituisce, per ogni riga, gli indici dei frammenti che la compongono.
 */
export function raggruppaFrammenti(frammenti: Frammento[]): number[][] {
  const righe: number[][] = [];
  let alto = 0;
  let basso = 0;
  frammenti.forEach((f, i) => {
    const nuova = righe.length === 0 || f.alto >= alto + (basso - alto) / 2 + TOLLERANZA;
    if (nuova) { righe.push([i]); alto = f.alto; basso = f.basso; return; }
    righe[righe.length - 1].push(i);
    alto = Math.min(alto, f.alto);
    basso = Math.max(basso, f.basso);
  });
  return righe;
}

/** Misura della riga formata da un gruppo di frammenti */
export function misuraRiga(frammenti: Frammento[], indici: number[]): Riga {
  let alto = Infinity;
  let basso = -Infinity;
  for (const i of indici) { alto = Math.min(alto, frammenti[i].alto); basso = Math.max(basso, frammenti[i].basso); }
  return { alto, basso };
}
