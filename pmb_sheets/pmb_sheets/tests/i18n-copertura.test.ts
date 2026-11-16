// Ogni testo visibile dell'interfaccia di pmb_sheets ha la traduzione inglese (stesso controllo del test T463 di pmb_docs).
// Legge il codice con il compilatore TypeScript, estrae i testi (testo fisso dei modelli html``, title/aria-label/placeholder/alt, argomenti di t() e tVoce(),
// proprietà come label/etichetta/nome) e li cerca nel dizionario: aggiungere un testo italiano senza tradurlo fa fallire questo test, e il messaggio dice quale.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { EN } from '../src/i18n/en';

const SRC = path.resolve(__dirname, '../src');
// anche la finestra «Apri / Salva» comune della versione pocket: i suoi testi si traducono con il t() del programma
const FINESTRA_COMUNE = path.resolve(__dirname, '../../../comune/src/file-portatile.ts');
const PROP = new Set(['etichetta', 'titolo', 'descrizione', 'nome', 'testo', 'placeholder', 'motivoDisabilitata', 'messaggio', 'sottotitolo', 'aiuto', 'tooltip', 'label', 'title', 'description', 'hint']);
const haLettere = (s: string): boolean => /[A-Za-zÀ-ÿ]{2,}/.test(s.replace(/\{\}/g, ''));
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** Stringhe che compaiono nel codice ma non sono testo per l'utente. */
const NON_DA_TRADURRE = new Set(['mimetype']);

function file(dir: string, acc: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) file(p, acc); else if (p.endsWith('.ts') && !p.includes('# ')) acc.push(p); // «# Edit conflict»: copie di Proton Drive
  }
  return acc;
}

function chiavi(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const aggiungi = (k: string, dove: string): void => { const n = norm(k); if (n && haLettere(n) && !NON_DA_TRADURRE.has(n)) (out.get(n) ?? out.set(n, []).get(n)!).push(dove); };
  for (const p of [...file(SRC), FINESTRA_COMUNE]) {
    const rel = path.relative(SRC, p).replace(/\\/g, '/');
    if (rel.startsWith('i18n/') || rel === 'components/licenze-terze.ts') continue;
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    const dove = (n: ts.Node): string => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visita = (n: ts.Node): void => {
      if (ts.isTaggedTemplateExpression(n) && ts.isIdentifier(n.tag) && n.tag.text === 'html') {
        const parti = ts.isNoSubstitutionTemplateLiteral(n.template) ? [n.template.text] : [n.template.head.text, ...n.template.templateSpans.map((s) => s.literal.text)];
        const unito = '>' + parti.join('\u0001') + '<';
        for (const m of unito.matchAll(/>([^<>]*)</g)) aggiungi(m[1].replace(/\u0001/g, '{}'), dove(n));
        for (const m of unito.matchAll(/\b(?:title|aria-label|placeholder|alt|aria-description)="([^"]*)"/g)) aggiungi(m[1].replace(/\u0001/g, '{}'), dove(n));
      }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tVoce') && n.arguments.length > 0) {
        const a = n.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) aggiungi(a.text, dove(a));
      }
      if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && PROP.has(n.name.text) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
        aggiungi(n.initializer.text, dove(n));
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return out;
}

describe('pmb_sheets in inglese: copertura delle traduzioni', () => {
  const trovati = chiavi();
  it("trova un numero credibile di testi (se scende di molto l'estrattore è rotto)", () => {
    expect(trovati.size).toBeGreaterThan(700);
  });
  it('ogni testo visibile ha la traduzione inglese', () => {
    const mancanti = [...trovati.entries()].filter(([k]) => EN[k] === undefined).map(([k, dove]) => `${JSON.stringify(k)}  ←  ${dove[0]}`);
    expect(mancanti, `Testi senza traduzione in src/i18n/en.ts:\n${mancanti.join('\n')}`).toEqual([]);
  });
  it('ogni traduzione non è vuota e ha gli stessi {} del testo italiano', () => {
    const sbagliate = Object.entries(EN).filter(([k, v]) => v.trim() === '' || (k.match(/\{\}/g) ?? []).length !== (v.match(/\{\}/g) ?? []).length).map(([k]) => k);
    expect(sbagliate).toEqual([]);
  });
  it('nessuna traduzione è rimasta in italiano per sbaglio', () => {
    const PAROLE_IT = /\b(il|la|le|lo|gli|di|del|della|per|non|che|con|nel|una|è|può|solo|nessun|nessuna|troppo|prima|dopo|sono|tutto|errore|aggiungi|apri|chiudi|salva|nome|testo|foglio|file)\b/i;
    const LEGITTIME = new Set(['File']);
    const uguali = Object.entries(EN).filter(([k, v]) => k === v && PAROLE_IT.test(k) && !LEGITTIME.has(k)).map(([k]) => k);
    expect(uguali).toEqual([]);
  });
  it('le voci di menu e i nomi che passano da t(variabile) hanno la traduzione', () => {
    for (const k of ['Annulla|azione', 'Automatica (come Windows)', 'Barra degli strumenti', 'Menu {}', 'gennaio', 'dicembre', 'Chiaro', 'Scuro', 'Come il sistema', 'Punto medio', 'il massimo'])
      expect(EN[k], k).toBeDefined();
  });
});
