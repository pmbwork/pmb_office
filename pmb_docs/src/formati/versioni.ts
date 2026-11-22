// Gestione della cronologia versioni locale di pmb_docs.
import { deserializza, serializza, testoDi, type Documento } from '../modello/documento';

export const PREFISSO_CHIAVE_VERSIONI = 'pmb_docs.versioni:';
export const MASSIMO_VERSIONI_PER_DOCUMENTO = 50;

export interface VersioneSalvata {
  id: string;
  titolo: string;
  salvato: number;
  nome?: string;
  doc: Documento;
  parole: number;
  caratteri: number;
}

interface VersioneSerializzata {
  id: string;
  titolo: string;
  salvato: number;
  nome?: string;
  doc: string;
  parole: number;
  caratteri: number;
}

type Deposito = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function chiaveVersioni(titolo: string): string {
  const normalizzato = (titolo || 'Documento senza titolo').trim().toLowerCase();
  return `${PREFISSO_CHIAVE_VERSIONI}${normalizzato}`;
}

function calcolaStatistiche(doc: Documento): { parole: number; caratteri: number } {
  const testo = testoDi(doc);
  const caratteri = testo.length;
  const parole = testo.trim() === '' ? 0 : testo.trim().split(/\s+/).length;
  return { parole, caratteri };
}

export function leggiVersioni(deposito: Deposito | null | undefined, titolo: string): VersioneSalvata[] {
  if (!deposito) return [];
  try {
    const raw = deposito.getItem(chiaveVersioni(titolo));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersioneSerializzata[];
    if (!Array.isArray(parsed)) return [];
    const out: VersioneSalvata[] = [];
    for (const v of parsed) {
      if (!v || typeof v.id !== 'string' || typeof v.doc !== 'string') continue;
      try {
        const doc = deserializza(v.doc);
        out.push({
          id: v.id,
          titolo: v.titolo,
          salvato: v.salvato,
          nome: v.nome,
          doc,
          parole: v.parole ?? 0,
          caratteri: v.caratteri ?? 0,
        });
      } catch {
        // ignora elementi corrotti
      }
    }
    // Ordine cronologico discendente (la più recente prima)
    return out.sort((a, b) => b.salvato - a.salvato);
  } catch {
    return [];
  }
}

function scriviVersioni(deposito: Deposito | null | undefined, titolo: string, versioni: VersioneSalvata[]): boolean {
  if (!deposito) return false;
  try {
    const serializzate: VersioneSerializzata[] = versioni.slice(0, MASSIMO_VERSIONI_PER_DOCUMENTO).map((v) => ({
      id: v.id,
      titolo: v.titolo,
      salvato: v.salvato,
      nome: v.nome,
      doc: serializza(v.doc),
      parole: v.parole,
      caratteri: v.caratteri,
    }));
    deposito.setItem(chiaveVersioni(titolo), JSON.stringify(serializzate));
    return true;
  } catch {
    return false;
  }
}

/**
 * Salva una versione. `titolo` è il nome mostrato; `chiave` dice di quale documento è la cronologia (il percorso del file quando si conosce,
 * vedi docs-guscio idVersioni); senza chiave si usa il titolo, come prima.
 */
export function salvaNuovaVersione(
  deposito: Deposito | null | undefined,
  titolo: string,
  doc: Documento,
  nome?: string,
  adesso: number = Date.now(),
  chiave: string = titolo
): VersioneSalvata | null {
  if (!deposito) return null;
  const { parole, caratteri } = calcolaStatistiche(doc);
  const nuova: VersioneSalvata = {
    id: adesso.toString(36) + Math.random().toString(36).substring(2, 6),
    titolo: titolo || 'Documento senza titolo',
    salvato: adesso,
    nome: nome?.trim() || undefined,
    doc,
    parole,
    caratteri,
  };

  const attuali = leggiVersioni(deposito, chiave);
  attuali.unshift(nuova);
  const ok = scriviVersioni(deposito, chiave, attuali);
  return ok ? nuova : null;
}

/**
 * Le versioni salvate con il solo titolo passano al file (una volta, se il file non ne ha ancora): prima la cronologia era legata al titolo,
 * e due documenti con lo stesso nome mescolavano le loro versioni.
 */
export function migraVersioni(deposito: Deposito | null | undefined, daTitolo: string, aChiave: string): void {
  if (!deposito || daTitolo === aChiave) return;
  try {
    if (deposito.getItem(chiaveVersioni(aChiave))) return;
    const vecchie = deposito.getItem(chiaveVersioni(daTitolo));
    if (!vecchie) return;
    deposito.setItem(chiaveVersioni(aChiave), vecchie);
    deposito.removeItem(chiaveVersioni(daTitolo));
  } catch {
    // deposito pieno o non disponibile: le versioni restano dove sono
  }
}

export function rinominaVersione(
  deposito: Deposito | null | undefined,
  titolo: string,
  id: string,
  nuovoNome: string
): boolean {
  if (!deposito) return false;
  const attuali = leggiVersioni(deposito, titolo);
  const v = attuali.find((x) => x.id === id);
  if (!v) return false;
  v.nome = nuovoNome.trim() || undefined;
  return scriviVersioni(deposito, titolo, attuali);
}

export function eliminaVersione(
  deposito: Deposito | null | undefined,
  titolo: string,
  id: string
): boolean {
  if (!deposito) return false;
  const attuali = leggiVersioni(deposito, titolo);
  const filtrate = attuali.filter((x) => x.id !== id);
  if (filtrate.length === attuali.length) return false;
  return scriviVersioni(deposito, titolo, filtrate);
}

export function svuotaVersioni(deposito: Deposito | null | undefined, titolo: string): void {
  if (!deposito) return;
  try {
    deposito.removeItem(chiaveVersioni(titolo));
  } catch {
    // no-op
  }
}
