// Lettura e scrittura di XML (serve ai formati .docx, .xlsx, .ods): analizzatore senza dipendenze.
// Gestisce elementi, attributi, testo, CDATA, riferimenti a caratteri e le cinque entità predefinite.
// Salta dichiarazione, commenti, istruzioni e DOCTYPE; NON espande entità definite dal file (nessun attacco "billion laughs").
// I nomi restano com'è scritto nel file, con il prefisso (per esempio "w:p").

export interface NodoXml { nome: string; attributi: Record<string, string>; figli: Array<NodoXml | string> }

function errore(testo: string, pos: number, messaggio: string): Error {
  let riga = 1;
  for (let i = 0; i < pos && i < testo.length; i++) if (testo[i] === '\n') riga++;
  return new Error(`XML non valido (riga ${riga}): ${messaggio}`);
}

const ENTITA: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const INIZIO_NOME = /[A-Za-z_:À-￿]/;
const CARATTERE_NOME = /[A-Za-z0-9_:.\-·À-￿]/;

function decodifica(testo: string, sorgente: string, pos: number): string {
  if (!testo.includes('&')) return testo;
  return testo.replace(/&(?:([^;&\s]{1,12});)?/g, (tutto, nome: string | undefined) => {
    if (nome === undefined) throw errore(sorgente, pos, 'carattere & non valido');
    if (Object.prototype.hasOwnProperty.call(ENTITA, nome)) return ENTITA[nome];
    const m = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(nome);
    if (m) {
      const cp = m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10);
      if (!(cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) && cp !== 0xfffe && cp !== 0xffff))) {
        throw errore(sorgente, pos, `carattere non ammesso ${tutto}`);
      }
      return String.fromCodePoint(cp);
    }
    throw errore(sorgente, pos, `entità sconosciuta ${tutto}`);
  });
}

export function analizzaXml(sorgente: string): NodoXml {
  const t = sorgente.charCodeAt(0) === 0xfeff ? sorgente.slice(1) : sorgente;
  let i = 0;
  const n = t.length;
  const pila: NodoXml[] = [];
  let radice: NodoXml | null = null;
  let testoCorrente = '';

  const chiudiTesto = (): void => {
    if (testoCorrente === '') return;
    const top = pila[pila.length - 1];
    if (top) top.figli.push(testoCorrente);
    else if (testoCorrente.trim() !== '') throw errore(t, i, 'testo fuori dall\'elemento principale');
    testoCorrente = '';
  };
  const leggiNome = (): string => {
    const inizio = i;
    if (i >= n || !INIZIO_NOME.test(t[i])) throw errore(t, i, 'nome non valido');
    i++;
    while (i < n && CARATTERE_NOME.test(t[i])) i++;
    return t.slice(inizio, i);
  };
  const saltaSpazi = (): void => { while (i < n && /\s/.test(t[i])) i++; };

  while (i < n) {
    if (t[i] !== '<') {
      const fine = t.indexOf('<', i);
      const pezzo = t.slice(i, fine < 0 ? n : fine);
      testoCorrente += pila.length > 0 ? decodifica(pezzo, t, i) : pezzo;
      i = fine < 0 ? n : fine;
      continue;
    }
    if (t.startsWith('<!--', i)) {
      const f = t.indexOf('-->', i + 4);
      if (f < 0) throw errore(t, i, 'commento non chiuso');
      i = f + 3;
    } else if (t.startsWith('<![CDATA[', i)) {
      if (pila.length === 0) throw errore(t, i, 'CDATA fuori dall\'elemento principale');
      const f = t.indexOf(']]>', i + 9);
      if (f < 0) throw errore(t, i, 'CDATA non chiuso');
      testoCorrente += t.slice(i + 9, f);
      i = f + 3;
    } else if (t.startsWith('<?', i)) {
      const f = t.indexOf('?>', i + 2);
      if (f < 0) throw errore(t, i, 'istruzione non chiusa');
      i = f + 2;
    } else if (t.startsWith('<!', i)) {
      // DOCTYPE: si salta, anche con sottoinsieme interno tra parentesi quadre
      let profondita = 0;
      let j = i + 2;
      for (; j < n; j++) {
        if (t[j] === '[') profondita++;
        else if (t[j] === ']') profondita--;
        else if (t[j] === '>' && profondita <= 0) break;
      }
      if (j >= n) throw errore(t, i, 'dichiarazione non chiusa');
      i = j + 1;
    } else if (t.startsWith('</', i)) {
      chiudiTesto();
      i += 2;
      const nome = leggiNome();
      saltaSpazi();
      if (t[i] !== '>') throw errore(t, i, 'tag di chiusura non valido');
      i++;
      const aperto = pila.pop();
      if (!aperto) throw errore(t, i, `chiusura </${nome}> senza apertura`);
      if (aperto.nome !== nome) throw errore(t, i, `</${nome}> non corrisponde a <${aperto.nome}>`);
    } else {
      chiudiTesto();
      i++;
      const nome = leggiNome();
      const el: NodoXml = { nome, attributi: {}, figli: [] };
      for (;;) {
        saltaSpazi();
        if (i >= n) throw errore(t, i, `tag <${nome}> non chiuso`);
        if (t[i] === '>' || t.startsWith('/>', i)) break;
        const an = leggiNome();
        saltaSpazi();
        if (t[i] !== '=') throw errore(t, i, `manca = dopo l'attributo ${an}`);
        i++;
        saltaSpazi();
        const q = t[i];
        if (q !== '"' && q !== "'") throw errore(t, i, `valore dell'attributo ${an} senza virgolette`);
        const f = t.indexOf(q, i + 1);
        if (f < 0) throw errore(t, i, `valore dell'attributo ${an} non chiuso`);
        const grezzo = t.slice(i + 1, f);
        if (grezzo.includes('<')) throw errore(t, i, `carattere < nel valore dell'attributo ${an}`);
        if (an in el.attributi) throw errore(t, i, `attributo ${an} ripetuto`);
        el.attributi[an] = decodifica(grezzo.replace(/[\t\n\r]/g, ' '), t, i);
        i = f + 1;
      }
      const vuoto = t.startsWith('/>', i);
      i += vuoto ? 2 : 1;
      const padre = pila[pila.length - 1];
      if (padre) padre.figli.push(el);
      else if (radice) throw errore(t, i, 'più di un elemento principale');
      else radice = el;
      if (!vuoto) pila.push(el);
    }
  }
  chiudiTesto();
  if (pila.length > 0) throw errore(t, n, `<${pila[pila.length - 1].nome}> non chiuso`);
  if (!radice) throw errore(t, n, 'nessun elemento');
  return radice;
}

// ---- scrittura ----
// Toglie i caratteri che l'XML 1.0 non ammette (controlli tranne tab, a capo e ritorno carrello).
function pulisci(testo: string): string {
  return testo.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}
export function escapaXml(testo: string): string {
  return pulisci(testo).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function escapaAttributo(testo: string): string {
  return escapaXml(testo).replace(/"/g, '&quot;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');
}

/** Costruisce un elemento: gli attributi con valore undefined si saltano; i figli sono testi XML già pronti (usa escapaXml per il testo). */
export function elemento(nome: string, attributi: Record<string, string | number | undefined> = {}, figli: string[] = []): string {
  const a = Object.entries(attributi)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapaAttributo(String(v))}"`)
    .join('');
  return figli.length === 0 ? `<${nome}${a}/>` : `<${nome}${a}>${figli.join('')}</${nome}>`;
}

// ---- ricerca nell'albero ----
export function figliElemento(nodo: NodoXml, nome: string): NodoXml[] {
  return nodo.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === nome);
}
/** Primo elemento lungo un percorso di nomi separati da "/", per esempio trova(radice, "w:body/w:p"). */
export function trova(nodo: NodoXml, percorso: string): NodoXml | undefined {
  let cur: NodoXml | undefined = nodo;
  for (const nome of percorso.split('/')) {
    if (!cur) return undefined;
    cur = figliElemento(cur, nome)[0];
  }
  return cur;
}
export function testoXml(nodo: NodoXml): string {
  let s = '';
  for (const f of nodo.figli) s += typeof f === 'string' ? f : testoXml(f);
  return s;
}

/** Profondità di annidamento di un albero XML, calcolata senza ricorsione (chi legge l'albero con funzioni ricorsive può rifiutare quello troppo profondo). */
export function profonditaXml(radice: NodoXml): number {
  let massima = 0;
  const pila: Array<[NodoXml, number]> = [[radice, 1]];
  while (pila.length > 0) {
    const [n, d] = pila.pop() as [NodoXml, number];
    if (d > massima) massima = d;
    for (const f of n.figli) if (typeof f !== 'string') pila.push([f, d + 1]);
  }
  return massima;
}
