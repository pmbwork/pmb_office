// "Inserisci › Componenti di base": modelli di testo pronti (appunti di riunione, bozza di email, elenco di controllo, tabelle) da mettere nel documento.
// Il testo che entra nel documento è nella lingua dell'interfaccia al momento dell'inserimento. Il `nome` resta in italiano: è l'identificativo della voce di menu.

import type { Paragrafo, Run } from '../modello/documento';
import { t as tr, localeCorrente } from '../i18n/lingua';

export interface Componente { nome: string; costruisci: (idTabella: number, oggi: Date) => Paragrafo[] }

const r = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const p = (testo: string, extra: Partial<Paragrafo> = {}, run: Partial<Run> = {}): Paragrafo => ({ ...extra, runs: testo === '' ? [] : [r(testo, run)] });
const titolo = (t: string): Paragrafo => p(t, { st: '1' });
const sezione = (t: string): Paragrafo => p(t, { st: '2' });
const voce = (t: string, extra: Partial<Paragrafo> = {}): Paragrafo => p(t, extra);
const campo = (etichetta: string): Paragrafo => ({ runs: [r(`${etichetta}: `, { g: true })] });

function tabella(id: number, righe: string[][]): Paragrafo[] {
  const out: Paragrafo[] = [];
  righe.forEach((riga, ri) => riga.forEach((testo, ci) => out.push({ tb: { i: id, r: ri, c: ci }, runs: testo === '' ? [] : [r(testo, ri === 0 ? { g: true } : {})] })));
  return out;
}

/** La data per esteso nella lingua corrente (il nome della funzione è rimasto quello di quando c'era solo l'italiano). */
export function dataInItaliano(d: Date): string {
  return d.toLocaleDateString(localeCorrente(), { day: 'numeric', month: 'long', year: 'numeric' });
}

export const COMPONENTI: Componente[] = [
  {
    nome: 'Appunti di riunione',
    costruisci: (_id, oggi) => [
      titolo(tr('Appunti di riunione')),
      { runs: [r(tr('Data: '), { g: true }), r(dataInItaliano(oggi))] },
      campo(tr('Partecipanti')),
      sezione(tr('Ordine del giorno')),
      voce(tr('Primo punto'), { el: 'n' }), voce(tr('Secondo punto'), { el: 'n' }), voce(tr('Terzo punto'), { el: 'n' }),
      sezione(tr('Decisioni')),
      voce('', { el: 'p' }),
      sezione(tr('Azioni da fare')),
      voce(tr('Cosa fare — chi — entro quando'), { el: 't' }),
      voce('', { el: 't' }),
    ],
  },
  {
    nome: 'Bozza di email',
    costruisci: () => [campo(tr('A')), campo('Cc'), campo(tr('Oggetto')), p(''), p(tr('Gentile …,')), p(''), p(tr('Scrivi qui il messaggio.')), p(''), p(tr('Cordiali saluti,')), p(tr('Il tuo nome'))],
  },
  {
    nome: 'Elenco di controllo',
    costruisci: () => [titolo(tr('Elenco di controllo')), voce(tr('Primo passo'), { el: 't' }), voce(tr('Secondo passo'), { el: 't' }), voce(tr('Terzo passo'), { el: 't' }), voce(tr('Quarto passo'), { el: 't' })],
  },
  {
    nome: 'Pianificazione settimanale',
    costruisci: (id) => [titolo(tr('Pianificazione settimanale')), ...tabella(id, [[tr('Giorno'), tr('Impegni')], [tr('Lunedì'), ''], [tr('Martedì'), ''], [tr('Mercoledì'), ''], [tr('Giovedì'), ''], [tr('Venerdì'), '']])],
  },
  {
    nome: 'Tabella delle attività',
    costruisci: (id) => [sezione(tr('Attività')), ...tabella(id, [[tr('Attività'), tr('Responsabile'), tr('Scadenza'), tr('Stato')], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']])],
  },
  {
    nome: 'Data di oggi',
    costruisci: (_id, oggi) => [p(dataInItaliano(oggi))],
  },
];
