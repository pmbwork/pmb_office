// Aiuto dei test di pmb_docs e pmb_sheets: costruisce in memoria un file composto (specifica pubblica [MS-CFB]) con i flussi dati.
// Non fa parte dei programmi.
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const unisci = (...parti: Array<number[] | Uint8Array>): Uint8Array => {
  const out = new Uint8Array(parti.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
};

/** Un file composto (versione 3, settori da 512 byte) con i flussi dati; i percorsi con "/" creano le cartelle interne. */
export function creaCfb(flussi: Array<[string, Uint8Array]>): Uint8Array {
  const SETTORE = 512, MINI = 64, SOGLIA = 4096, FINE = 0xfffffffe, LIBERO = 0xffffffff, NESSUNO = 0xffffffff;
  interface Voce { nome: string; tipo: number; figli: Voce[]; dati?: Uint8Array; inizio: number; dimensione: number; indice: number }
  const radice: Voce = { nome: 'Root Entry', tipo: 5, figli: [], inizio: FINE, dimensione: 0, indice: 0 };
  for (const [percorso, dati] of flussi) {
    const parti = percorso.split('/');
    let qui = radice;
    for (const p of parti.slice(0, -1)) {
      let c = qui.figli.find((x) => x.nome === p && x.tipo === 1);
      if (!c) { c = { nome: p, tipo: 1, figli: [], inizio: 0, dimensione: 0, indice: 0 }; qui.figli.push(c); }
      qui = c;
    }
    qui.figli.push({ nome: parti[parti.length - 1], tipo: 2, figli: [], dati, inizio: FINE, dimensione: dati.length, indice: 0 });
  }
  const voci: Voce[] = [];
  const elenca = (v: Voce): void => { v.indice = voci.length; voci.push(v); v.figli.forEach(elenca); };
  elenca(radice);
  // flussi piccoli nel mini flusso
  const mini: number[] = [];
  const miniFat: number[] = [];
  for (const v of voci) {
    if (v.tipo !== 2 || !v.dati || v.dati.length >= SOGLIA || v.dati.length === 0) continue;
    const n = Math.ceil(v.dati.length / MINI);
    v.inizio = miniFat.length;
    for (let k = 0; k < n; k++) miniFat.push(k === n - 1 ? FINE : miniFat.length + 1);
    const pieno = new Uint8Array(n * MINI); pieno.set(v.dati);
    mini.push(...pieno);
  }
  radice.dimensione = mini.length;
  const blocchi: Array<{ dati: Uint8Array; voce?: Voce; cosa: string }> = [];
  const cartella = new Uint8Array(Math.max(1, Math.ceil((voci.length * 128) / SETTORE)) * SETTORE);
  blocchi.push({ dati: cartella, cosa: 'cartella' });
  if (miniFat.length > 0) blocchi.push({ dati: unisci(...miniFat.map(u32)), cosa: 'minifat' });
  if (mini.length > 0) blocchi.push({ dati: Uint8Array.from(mini), cosa: 'mini', voce: radice });
  for (const v of voci) if (v.tipo === 2 && v.dati && v.dati.length >= SOGLIA) blocchi.push({ dati: v.dati, voce: v, cosa: 'flusso' });
  const settoriDi = (b: Uint8Array): number => Math.max(1, Math.ceil(b.length / SETTORE));
  const datiSettori = blocchi.reduce((t, b) => t + settoriDi(b.dati), 0);
  let settoriFat = 1;
  while (settoriFat * (SETTORE / 4) < settoriFat + datiSettori) settoriFat++;
  const fat: number[] = new Array(settoriFat * (SETTORE / 4)).fill(LIBERO);
  for (let i = 0; i < settoriFat; i++) fat[i] = 0xfffffffd;
  let prossimo = settoriFat;
  const inizi = new Map<string, number>();
  for (const b of blocchi) {
    const n = settoriDi(b.dati);
    const primo = prossimo;
    for (let k = 0; k < n; k++) fat[primo + k] = k === n - 1 ? FINE : primo + k + 1;
    prossimo += n;
    inizi.set(b.cosa + (b.voce ? b.voce.indice : ''), primo);
    if (b.voce) b.voce.inizio = primo;
  }
  // la cartella: ogni cartella ha i figli in fila sul lato destro
  const cd = new DataView(cartella.buffer);
  for (const v of voci) {
    const p = v.indice * 128;
    for (let i = 0; i < v.nome.length; i++) cd.setUint16(p + i * 2, v.nome.charCodeAt(i), true);
    cd.setUint16(p + 64, (v.nome.length + 1) * 2, true);
    cartella[p + 66] = v.tipo; cartella[p + 67] = 1;
    cd.setUint32(p + 68, NESSUNO, true); cd.setUint32(p + 72, NESSUNO, true); cd.setUint32(p + 76, v.figli.length > 0 ? v.figli[0].indice : NESSUNO, true);
    cd.setUint32(p + 116, v.tipo === 5 ? (mini.length > 0 ? v.inizio : FINE) : v.inizio, true);
    cd.setUint32(p + 120, v.dimensione, true);
  }
  for (const v of voci) v.figli.forEach((f, i) => { if (i + 1 < v.figli.length) cd.setUint32(f.indice * 128 + 72, v.figli[i + 1].indice, true); });
  const testa = new Uint8Array(SETTORE);
  const hd = new DataView(testa.buffer);
  testa.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  hd.setUint16(24, 0x3e, true); hd.setUint16(26, 3, true); hd.setUint16(28, 0xfffe, true); hd.setUint16(30, 9, true); hd.setUint16(32, 6, true);
  hd.setUint32(44, settoriFat, true); hd.setUint32(48, inizi.get('cartella')!, true); hd.setUint32(56, SOGLIA, true);
  hd.setUint32(60, miniFat.length > 0 ? inizi.get('minifat')! : FINE, true); hd.setUint32(64, miniFat.length > 0 ? Math.ceil((miniFat.length * 4) / SETTORE) : 0, true);
  hd.setUint32(68, FINE, true); hd.setUint32(72, 0, true);
  for (let i = 0; i < 109; i++) hd.setUint32(76 + i * 4, i < settoriFat ? i : LIBERO, true);
  const settori: Uint8Array[] = [];
  for (let i = 0; i < settoriFat; i++) settori.push(unisci(...fat.slice(i * 128, (i + 1) * 128).map(u32)));
  for (const b of blocchi) { const s = new Uint8Array(settoriDi(b.dati) * SETTORE); s.set(b.dati); settori.push(s); }
  return unisci(testa, ...settori);
}

