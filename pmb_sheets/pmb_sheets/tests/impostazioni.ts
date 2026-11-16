// Impostazioni comuni a tutti i test: il computer di prova si comporta come un Windows in italiano (altrimenti la lingua «automatica» sceglierebbe l'inglese
// e quasi tutti i test, che controllano i testi italiani, fallirebbero), e ogni test parte con l'interfaccia in italiano.
import { beforeEach } from 'vitest';
import { impostaLingua } from '../src/i18n/lingua';

if (typeof navigator !== 'undefined') {
  try { Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true }); } catch { /* niente */ }
}
beforeEach(() => { impostaLingua('it'); });
