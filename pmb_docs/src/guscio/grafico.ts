import { t } from '../i18n/lingua';
// Grafici: i dati si scrivono come righe "Etichetta; valore; valore" e il grafico (colonne, barre, linee, torta) si disegna su un canvas
// per metterlo nel documento come immagine. Qui ci sono la lettura dei dati e le scale (testabili senza canvas) e il disegno.

export type TipoGrafico = 'colonne' | 'barre' | 'linee' | 'torta';
export const TIPI_GRAFICO: ReadonlyArray<readonly [TipoGrafico, string]> = [['colonne', 'A colonne'], ['barre', 'A barre'], ['linee', 'A linee'], ['torta', 'A torta']];

export interface DatiGrafico { serie: string[]; righe: Array<{ etichetta: string; valori: number[] }> }
export class ErroreGrafico extends Error {}

export const RIGHE_MASSIME = 40;
export const SERIE_MASSIME = 6;
export const COLORI_SERIE = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7b61ff', '#a0a0a0'];

/** Un numero scritto all'italiana o all'inglese ("1.234,5", "12,5", "3.14"); NaN se non lo è. */
export function numeroDaTesto(t: string): number {
  const s = t.trim().replace(/\s/g, '');
  if (s === '' || !/^[-+]?[\d.,]+(?:e[-+]?\d+)?%?$/i.test(s)) return NaN;
  const senzaPercento = s.replace(/%$/, '');
  const virgola = senzaPercento.lastIndexOf(','); const punto = senzaPercento.lastIndexOf('.');
  let normale = senzaPercento;
  if (virgola >= 0 && punto >= 0) normale = virgola > punto ? senzaPercento.replace(/\./g, '').replace(',', '.') : senzaPercento.replace(/,/g, '');
  else if (virgola >= 0) normale = senzaPercento.replace(',', '.');
  else if ((senzaPercento.match(/\./g) ?? []).length > 1) normale = senzaPercento.replace(/\./g, '');
  const n = Number(normale);
  return Number.isFinite(n) ? n : NaN;
}

/** Legge i dati: una riga per etichetta, valori separati da ";" o da tabulazione. La prima riga può dare i nomi delle serie (se i suoi valori non sono numeri). */
export function leggiDati(testo: string): DatiGrafico {
  const righeTesto = testo.replace(/\r\n?/g, '\n').split('\n').map((r) => r.trim()).filter((r) => r !== '');
  if (righeTesto.length === 0) throw new ErroreGrafico(t('Scrivi almeno una riga di dati, per esempio: Gennaio; 12'));
  const celle = righeTesto.map((r) => r.split(/[;\t]/).map((c) => c.trim()));
  let serie: string[] | null = null;
  const prima = celle[0];
  if (prima.length > 1 && prima.slice(1).every((c) => Number.isNaN(numeroDaTesto(c)))) { serie = prima.slice(1); celle.shift(); }
  if (celle.length === 0) throw new ErroreGrafico(t('Mancano le righe dei valori sotto i nomi delle serie'));
  if (celle.length > RIGHE_MASSIME) throw new ErroreGrafico(t('Troppe righe: al massimo {}', RIGHE_MASSIME));
  const righe = celle.map((c, k) => {
    if (c.length < 2) throw new ErroreGrafico(t('La riga {} ("{}") non ha valori: scrivi per esempio "{}; 10"', k + 1, c[0], c[0]));
    const valori = c.slice(1).map((v) => numeroDaTesto(v));
    if (valori.some((v) => Number.isNaN(v))) throw new ErroreGrafico(t('La riga {} ("{}") ha un valore che non è un numero', k + 1, c[0]));
    return { etichetta: c[0], valori };
  });
  const n = Math.max(...righe.map((r) => r.valori.length));
  if (n > SERIE_MASSIME) throw new ErroreGrafico(t('Troppe serie: al massimo {}', SERIE_MASSIME));
  for (const r of righe) while (r.valori.length < n) r.valori.push(0);
  const nomi = Array.from({ length: n }, (_, k) => serie?.[k] ?? (n === 1 ? 'Valori' : `Serie ${k + 1}`));
  return { serie: nomi, righe };
}

/** Un massimo "tondo" e il passo delle linee della griglia (da 4 a 6 linee). */
export function calcolaScala(minimo: number, massimo: number): { min: number; max: number; passo: number } {
  const alto = Math.max(massimo, 0); const basso = Math.min(minimo, 0);
  const intervallo = alto - basso || 1;
  const grezzo = intervallo / 5;
  const potenza = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const f = grezzo / potenza;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * potenza;
  const min = Math.floor(basso / passo) * passo;
  let max = Math.ceil(alto / passo) * passo;
  if (max <= min) max = min + passo; // tutti i valori a zero: la scala non deve avere altezza nulla
  return { min, max, passo };
}

function etichettaNumero(v: number, passo: number): string {
  const decimali = passo >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(passo)));
  return v.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
}

export function disegnaGrafico(ctx: CanvasRenderingContext2D, w: number, h: number, tipo: TipoGrafico, titolo: string, dati: DatiGrafico): void {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  const carattere = (px: number, grassetto = false): string => `${grassetto ? '700 ' : ''}${px}px Arial, Helvetica, sans-serif`;
  let alto = 16;
  if (titolo.trim() !== '') { ctx.fillStyle = '#202124'; ctx.font = carattere(16, true); ctx.textAlign = 'center'; ctx.fillText(titolo.trim(), w / 2, 24); alto = 40; }
  const conLegenda = dati.serie.length > 1 || tipo === 'torta';
  const legenda = (): void => {
    ctx.font = carattere(11); ctx.textAlign = 'left';
    const voci = tipo === 'torta' ? dati.righe.map((r) => r.etichetta) : dati.serie;
    let x = 16; let y = h - 10;
    voci.forEach((nome, k) => {
      const larg = ctx.measureText(nome).width + 24;
      if (x + larg > w - 8) { x = 16; y -= 16; }
      ctx.fillStyle = COLORI_SERIE[k % COLORI_SERIE.length]; ctx.fillRect(x, y - 9, 10, 10);
      ctx.fillStyle = '#3c4043'; ctx.fillText(nome, x + 15, y);
      x += larg;
    });
  };
  // la legenda va a capo quando non sta in una riga: si contano le righe prima, perché lasciano spazio sotto il grafico
  const nomiLegenda = tipo === 'torta' ? dati.righe.map((r) => r.etichetta) : dati.serie;
  ctx.font = carattere(11);
  let righeLegenda = 1; let xl = 16;
  for (const nome of nomiLegenda) { const larg = ctx.measureText(nome).width + 24; if (xl + larg > w - 8) { righeLegenda++; xl = 16; } xl += larg; }
  const basso = conLegenda ? 20 + righeLegenda * 16 : 12;

  if (tipo === 'torta') {
    const valori = dati.righe.map((r) => Math.max(0, r.valori[0]));
    const totale = valori.reduce((s, v) => s + v, 0);
    const cx = w / 2; const cy = alto + (h - alto - basso) / 2; const r = Math.max(10, Math.min((h - alto - basso) / 2 - 4, w / 2 - 20));
    if (totale <= 0) { ctx.fillStyle = '#5f6368'; ctx.font = carattere(13); ctx.textAlign = 'center'; ctx.fillText('Nessun valore positivo da mostrare', cx, cy); legenda(); return; }
    let a = -Math.PI / 2;
    valori.forEach((v, k) => {
      const ang = (v / totale) * Math.PI * 2;
      ctx.fillStyle = COLORI_SERIE[k % COLORI_SERIE.length];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a + ang); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (v / totale >= 0.04) {
        const m = a + ang / 2;
        ctx.fillStyle = '#ffffff'; ctx.font = carattere(12, true); ctx.textAlign = 'center';
        ctx.fillText(`${Math.round((v / totale) * 100)}%`, cx + Math.cos(m) * r * 0.65, cy + Math.sin(m) * r * 0.65 + 4);
      }
      a += ang;
    });
    legenda();
    return;
  }

  const tutti = dati.righe.flatMap((r) => r.valori);
  const scala = calcolaScala(Math.min(...tutti), Math.max(...tutti));
  const orizzontale = tipo === 'barre';
  const sx = orizzontale ? 90 : 56; const dx = 18; const sy = alto + 6; const base = h - basso - (orizzontale ? 22 : 26);
  const areaW = w - sx - dx; const areaH = base - sy;
  const n = dati.righe.length; const ns = dati.serie.length;
  const posVal = (v: number): number => (orizzontale ? sx + ((v - scala.min) / (scala.max - scala.min)) * areaW : base - ((v - scala.min) / (scala.max - scala.min)) * areaH);

  ctx.font = carattere(11); ctx.lineWidth = 1;
  const linee = Math.round((scala.max - scala.min) / scala.passo);
  for (let k = 0; k <= linee; k++) {
    const v = scala.min + k * scala.passo; // a indice, non sommando il passo: niente errori di arrotondamento sull'asse dello zero
    const p = posVal(v);
    ctx.strokeStyle = Math.abs(v) < scala.passo / 1e6 ? '#80868b' : '#e0e0e0';
    ctx.beginPath();
    if (orizzontale) { ctx.moveTo(p, sy); ctx.lineTo(p, base); } else { ctx.moveTo(sx, p); ctx.lineTo(sx + areaW, p); }
    ctx.stroke();
    ctx.fillStyle = '#5f6368';
    if (orizzontale) { ctx.textAlign = 'center'; ctx.fillText(etichettaNumero(v, scala.passo), p, base + 15); } else { ctx.textAlign = 'right'; ctx.fillText(etichettaNumero(v, scala.passo), sx - 6, p + 4); }
  }
  const zero = posVal(0);
  const banda = (orizzontale ? areaH : areaW) / n;
  dati.righe.forEach((riga, i) => {
    const c = (orizzontale ? sy : sx) + banda * (i + 0.5);
    ctx.fillStyle = '#3c4043'; ctx.font = carattere(11);
    if (orizzontale) { ctx.textAlign = 'right'; ctx.fillText(riga.etichetta.length > 14 ? `${riga.etichetta.slice(0, 13)}…` : riga.etichetta, sx - 6, c + 4); }
    else { ctx.textAlign = 'center'; ctx.fillText(riga.etichetta.length > Math.max(6, Math.floor(banda / 6)) ? `${riga.etichetta.slice(0, Math.max(5, Math.floor(banda / 6) - 1))}…` : riga.etichetta, c, base + 16); }
    if (tipo === 'linee') return;
    const spessore = (banda * 0.7) / ns;
    riga.valori.forEach((v, s) => {
      ctx.fillStyle = COLORI_SERIE[s % COLORI_SERIE.length];
      const off = -banda * 0.35 + spessore * s;
      const p = posVal(v);
      if (orizzontale) ctx.fillRect(Math.min(zero, p), c + off, Math.abs(p - zero), spessore - 1);
      else ctx.fillRect(c + off, Math.min(zero, p), spessore - 1, Math.abs(p - zero));
    });
  });
  if (tipo === 'linee') {
    for (let s = 0; s < ns; s++) {
      const colore = COLORI_SERIE[s % COLORI_SERIE.length];
      ctx.strokeStyle = colore; ctx.fillStyle = colore; ctx.lineWidth = 2.5; ctx.beginPath();
      dati.righe.forEach((riga, i) => { const x = sx + banda * (i + 0.5); const y = posVal(riga.valori[s]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      dati.righe.forEach((riga, i) => { ctx.beginPath(); ctx.arc(sx + banda * (i + 0.5), posVal(riga.valori[s]), 3.5, 0, Math.PI * 2); ctx.fill(); });
    }
  }
  if (conLegenda) legenda();
}

/** Disegna il grafico su un canvas nuovo a risoluzione doppia; null se il canvas non c'è. */
export function graficoSuTela(tipo: TipoGrafico, titolo: string, dati: DatiGrafico, w = 560, h = 340, scala = 2): HTMLCanvasElement | null {
  const tela = document.createElement('canvas');
  tela.width = w * scala; tela.height = h * scala;
  const ctx = tela.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scala, scala);
  disegnaGrafico(ctx, w, h, tipo, titolo, dati);
  return tela;
}
