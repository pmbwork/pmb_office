// La «password per aprire» dei file, uguale per pmb_docs e pmb_sheets: all'apertura si riconosce un file cifrato (Office «agile» o
// OpenDocument) e lo si decifra con la password; al salvataggio in .docx/.xlsx/.odt/.ods con una password il file si cifra.
// La password resta solo in memoria finché il documento è aperto: non si scrive da nessuna parte.
import { eOfficeCifrato, decifraOffice, cifraOffice, PasswordSbagliata, CifraturaNonSupportata } from './cifratura-agile';
import { eOdfCifrato, decifraOdf, cifraOdf } from './cifratura-odf';
import { leggiZip } from '../formati/zip';

export { CifraturaNonSupportata } from './cifratura-agile';

/** Il file ha la password per aprire: serve (o era sbagliata) la password. Il guscio la chiede e riprova. */
export class PasswordRichiesta extends Error {
  constructor(public readonly sbagliata: boolean) { super(sbagliata ? 'il file è protetto da password e la password non è giusta' : 'il file è protetto da password: serve la password'); this.name = 'PasswordRichiesta'; }
}

/** Lunghezza massima della password (come Office). */
export const LUNGHEZZA_MASSIMA_PASSWORD = 255;

/**
 * Se i byte sono un file cifrato lo decifra con la password e dà il file in chiaro; se non sono cifrati li dà così come sono.
 * PasswordRichiesta senza password o con quella sbagliata; CifraturaNonSupportata per cifrature che pmb_office non legge.
 */
export async function decifraSeServe(bytes: Uint8Array, password?: string): Promise<{ bytes: Uint8Array; cifrato: boolean }> {
  const ooxml = eOfficeCifrato(bytes);
  let odf = false;
  if (!ooxml && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    try { odf = eOdfCifrato(await leggiZip(bytes)); } catch { odf = false; }
  }
  if (!ooxml && !odf) return { bytes, cifrato: false };
  if (password === undefined || password === '') throw new PasswordRichiesta(false);
  try {
    return { bytes: ooxml ? await decifraOffice(bytes, password) : await decifraOdf(bytes, password), cifrato: true };
  } catch (e) {
    if (e instanceof PasswordSbagliata) throw new PasswordRichiesta(true);
    if (e instanceof CifraturaNonSupportata) throw e;
    throw new CifraturaNonSupportata(e instanceof Error ? e.message : String(e));
  }
}

/** Cifra i byte di un file appena scritto: «ooxml» per .docx/.xlsx, «odf» per .odt/.ods. */
export function cifraFile(bytes: Uint8Array, tipo: 'ooxml' | 'odf', password: string): Promise<Uint8Array> {
  return tipo === 'ooxml' ? cifraOffice(bytes, password) : cifraOdf(bytes, password);
}
