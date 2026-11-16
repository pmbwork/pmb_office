// T450: cambio nome free_docs -> pmb_docs: i dati salvati con le chiavi vecchie passano alle nuove senza perderli, e i file .fdoc si aprono ancora.
import { describe, it, expect } from 'vitest';
import { migraChiavi } from '../../src/guscio/migrazione';
import { CHIAVE_PREFERENZE, leggiPreferenze } from '../../src/guscio/preferenze';
import { CHIAVE_RECUPERO } from '../../src/formati/recupero';
import { PREFISSO_CHIAVE_VERSIONI } from '../../src/formati/versioni';
import { FORMATI, esporta, formatoDaNome, importa, nomeFile } from '../../src/formati/file';
import { daTesto } from '../../src/modello/documento';

function deposito(iniziale: Record<string, string> = {}): Storage {
  const m = new Map<string, string>(Object.entries(iniziale));
  return {
    get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(),
  } as Storage;
}
const chiavi = (d: Storage): string[] => Array.from({ length: d.length }, (_, i) => d.key(i) as string).sort();

describe('T450: chiavi di salvataggio locale', () => {
  it('le chiavi nuove cominciano con pmb_docs.', () => {
    expect([CHIAVE_PREFERENZE, CHIAVE_RECUPERO, PREFISSO_CHIAVE_VERSIONI]).toEqual(['pmb_docs.preferenze', 'pmb_docs.recupero', 'pmb_docs.versioni:']);
  });
  it('si spostano preferenze, copia di emergenza e versioni; le chiavi vecchie spariscono', () => {
    const d = deposito({ 'free_docs.preferenze': '{"tema":"scuro"}', 'free_docs.recupero': 'R', 'free_docs.versioni:Doc': 'V', 'altro.programma': 'X' });
    expect(migraChiavi(d, 'free_docs.', 'pmb_docs.')).toBe(3);
    expect(chiavi(d)).toEqual(['altro.programma', 'pmb_docs.preferenze', 'pmb_docs.recupero', 'pmb_docs.versioni:Doc']);
    expect(d.getItem('pmb_docs.preferenze')).toBe('{"tema":"scuro"}');
    expect(leggiPreferenze(d).tema).toBe('scuro'); // le preferenze vecchie si leggono come prima
  });
  it('non sovrascrive una chiave nuova già presente, e una seconda volta non fa niente', () => {
    const d = deposito({ 'free_docs.preferenze': 'vecchia', 'pmb_docs.preferenze': 'nuova' });
    migraChiavi(d, 'free_docs.', 'pmb_docs.');
    expect(d.getItem('pmb_docs.preferenze')).toBe('nuova');
    expect(d.getItem('free_docs.preferenze')).toBeNull();
    expect(migraChiavi(d, 'free_docs.', 'pmb_docs.')).toBe(0);
  });
  it('un deposito mancante o che dà errore non rompe niente', () => {
    expect(migraChiavi(null, 'a.', 'b.')).toBe(0);
    const rotto = { get length(): number { throw new Error('negato'); } } as unknown as Storage;
    expect(() => migraChiavi(rotto, 'a.', 'b.')).not.toThrow();
  });
});

describe('T450: estensione .pdoc e vecchio .fdoc', () => {
  it('si salva come .pdoc con l\'etichetta pmb_docs; si aprono sia .pdoc sia .fdoc', async () => {
    const f = FORMATI.find((x) => x.id === 'fdoc')!;
    expect([f.estensione, f.etichetta]).toEqual(['pdoc', 'Documento pmb_docs (.pdoc)']);
    expect(nomeFile('Lettera', 'fdoc')).toBe('Lettera.pdoc');
    expect([formatoDaNome('a.pdoc'), formatoDaNome('a.fdoc'), formatoDaNome('A.PDOC')]).toEqual(['fdoc', 'fdoc', 'fdoc']);
    const bytes = await esporta(daTesto('ciao'), 'fdoc');
    for (const nome of ['x.pdoc', 'x.fdoc']) {
      const r = await importa(bytes, nome);
      expect(r.formato).toBe('fdoc');
      expect(r.doc.paragrafi[0].runs[0].t).toBe('ciao');
    }
  });
});
