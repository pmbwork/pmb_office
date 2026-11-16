// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { analizzaXml, escapaXml, escapaAttributo, elemento, figliElemento, trova, testoXml, type NodoXml } from '@comune/formati/xml';

function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('T051: lettura', () => {
  it('elementi, attributi con virgolette doppie e singole, elementi vuoti, testo', () => {
    const r = analizzaXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a x="1" y='due'><b/><c k = "v">ciao</c> <d></d></a>\n`);
    expect(r.nome).toBe('a');
    expect(r.attributi).toEqual({ x: '1', y: 'due' });
    expect(r.figli.map((f) => (typeof f === 'string' ? `"${f}"` : f.nome))).toEqual(['b', 'c', '" "', 'd']);
    const c = figliElemento(r, 'c')[0];
    expect(c.attributi).toEqual({ k: 'v' });
    expect(c.figli).toEqual(['ciao']);
    expect((figliElemento(r, 'd')[0]).figli).toEqual([]);
    expect(analizzaXml('﻿<x/>').nome).toBe('x');
  });

  it('entità predefinite e riferimenti a caratteri, anche negli attributi', () => {
    const r = analizzaXml('<a t="&lt;&amp;&gt;&quot;&apos; &#65;&#x42;&#x1F600;">&lt;tag&gt; &amp; &#233; &#xE8; &#10;fine</a>');
    expect(r.attributi.t).toBe('<&>"\' AB😀');
    expect(testoXml(r)).toBe('<tag> & é è \nfine');
  });

  it('CDATA, commenti, istruzioni e DOCTYPE vengono gestiti; il testo spezzato da un commento si riunisce', () => {
    const r = analizzaXml('<!DOCTYPE a [<!ELEMENT a ANY>]><!-- inizio --><a><!-- c1 -->uno<![CDATA[ <non> & tag ]]><?pi dati?>due</a><!-- fine -->');
    expect(r.figli).toEqual(['uno <non> & tag due']);
  });

  it('i nomi con prefisso e i punti restano come scritti; gli spazi nel testo si conservano', () => {
    const r = analizzaXml('<w:p xmlns:w="http://x" w:rsidR="0A1"><w:r><w:t xml:space="preserve">  due  spazi  </w:t></w:r></w:p>');
    expect(r.nome).toBe('w:p');
    expect(r.attributi['xmlns:w']).toBe('http://x');
    expect(trova(r, 'w:r/w:t')!.figli).toEqual(['  due  spazi  ']);
    expect(trova(r, 'w:r/w:zzz')).toBeUndefined();
    expect(trova(r, 'w:q/w:t')).toBeUndefined();
  });

  it('un a capo dentro un attributo diventa spazio, a meno che sia scritto &#10;', () => {
    const r = analizzaXml('<a v="uno\ndue\ttre" w="uno&#10;due"/>');
    expect(r.attributi.v).toBe('uno due tre');
    expect(r.attributi.w).toBe('uno\ndue');
  });

  it('documenti sbagliati: errore chiaro con la riga', () => {
    const male: Array<[string, RegExp]> = [
      ['', /nessun elemento/], ['solo testo', /fuori/], ['<a>', /non chiuso/], ['<a></b>', /non corrisponde/], ['</a>', /senza apertura/],
      ['<a/><b/>', /più di un/], ['<a x=1/>', /virgolette/], ['<a x="1" x="2"/>', /ripetuto/], ['<a x="<"/>', /</], ['<a x="1/>', /non chiuso/],
      ['<a>&foo;</a>', /entità sconosciuta/], ['<a>A & B</a>', /&/], ['<a>&#0;</a>', /non ammesso/], ['<a>&#xD800;</a>', /non ammesso/],
      ['<a><!-- aperto</a>', /commento/], ['<a><![CDATA[x</a>', /CDATA/], ['<1a/>', /nome/], ['<a b/>', /manca =/], ['<a></a>testo', /fuori/],
      ['<a>\n\n<b></c></a>', /riga 3/],
    ];
    for (const [x, ex] of male) expect(() => analizzaXml(x), x).toThrow(ex);
    for (const [x] of male) expect(() => analizzaXml(x), x).toThrow(/^XML non valido/);
  });

  it('non espande entità dichiarate nel file e regge annidamenti molto profondi', () => {
    const bomba = '<!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><l>&b;</l>';
    expect(() => analizzaXml(bomba)).toThrow(/entità sconosciuta/);
    const N = 20000;
    const profondo = analizzaXml('<a>'.repeat(N) + 'x' + '</a>'.repeat(N));
    let d = 0;
    let cur: NodoXml | string = profondo;
    while (typeof cur !== 'string') { d++; cur = cur.figli[0]; }
    expect(d).toBe(N);
    expect(cur).toBe('x');
  });
});

describe('T051: scrittura', () => {
  it('escapaXml e escapaAttributo', () => {
    expect(escapaXml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d "e"');
    expect(escapaAttributo('a "b" & <c>\n\t\r')).toBe('a &quot;b&quot; &amp; &lt;c&gt;&#10;&#9;&#13;');
    expect(escapaXml('a\u0000b\u0001c\u000Bd￾e\tf\ng\rh')).toBe('abcde\tf\ng\rh');
    expect(escapaXml('è€😀')).toBe('è€😀');
  });

  it('elemento: attributi saltati se undefined, vuoto con barra, figli già pronti', () => {
    expect(elemento('w:b')).toBe('<w:b/>');
    expect(elemento('w:sz', { 'w:val': 22 })).toBe('<w:sz w:val="22"/>');
    expect(elemento('a', { x: undefined, y: 'q"r' })).toBe('<a y="q&quot;r"/>');
    expect(elemento('w:t', { 'xml:space': 'preserve' }, [escapaXml('a < b')])).toBe('<w:t xml:space="preserve">a &lt; b</w:t>');
    expect(elemento('p', {}, [elemento('r'), elemento('r', { n: 1 })])).toBe('<p><r/><r n="1"/></p>');
  });

  it('prova casuale: 300 alberi scritti con elemento() e riletti sono uguali', () => {
    const NOMI = ['a', 'w:p', 'x.y', 'b-c', 'è', '_u'];
    const STRANI = ['<', '>', '&', '"', "'", '\n', '\t', '  ', 'è', '😀', 'x', ' '];
    for (let seme = 1; seme <= 300; seme++) {
      const r = generatore(seme * 13);
      const testoCasuale = (): string => { let s = ''; for (let k = Math.floor(r() * 6); k > 0; k--) s += STRANI[Math.floor(r() * STRANI.length)]; return s; };
      const costruisci = (profondita: number): { xml: string; nodo: NodoXml } => {
        const nome = NOMI[Math.floor(r() * NOMI.length)];
        const attributi: Record<string, string> = {};
        for (let k = Math.floor(r() * 3); k > 0; k--) attributi[`at${k}`] = testoCasuale();
        const figli: string[] = [];
        const nodi: Array<NodoXml | string> = [];
        for (let k = Math.floor(r() * 4); profondita < 4 && k > 0; k--) {
          if (r() < 0.5) {
            const t = testoCasuale();
            if (t === '') continue;
            if (typeof nodi[nodi.length - 1] === 'string') { nodi[nodi.length - 1] += t; figli[figli.length - 1] += escapaXml(t); continue; }
            nodi.push(t); figli.push(escapaXml(t));
          } else { const f = costruisci(profondita + 1); nodi.push(f.nodo); figli.push(f.xml); }
        }
        return { xml: elemento(nome, attributi, figli), nodo: { nome, attributi: Object.fromEntries(Object.entries(attributi).map(([k, v]) => [k, v])), figli: nodi } };
      };
      const { xml, nodo } = costruisci(0);
      const letto = analizzaXml(`<?xml version="1.0"?>\n${xml}`);
      expect(letto, `seme ${seme}: ${xml}`).toEqual(nodo);
    }
  });
});
