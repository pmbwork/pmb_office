// Testi della finestra "Informazioni" di pmb_docs e pmb_sheets: che cos'è il programma, condizioni d'uso (licenza GPL-3.0 dal 2026-11-14; prima: gratuito e non commerciabile), garanzie, marchi, privacy e premessa alle licenze di terze parti.
// Sono testi informativi scritti per mettere in chiaro come si può usare il programma; non sostituiscono una consulenza legale.

export interface Sezione { titolo: string; paragrafi: string[] }
export interface OpzioniInformazioni {
  app: 'pmb_docs' | 'pmb_sheets';
  versione: string;
  /** pmb_docs usa il correttore ortografico di Windows: va detto nella parte sulla privacy */
  correttore?: boolean;
  /** lingua del testo: italiano se manca (pmb_sheets non ha ancora l'inglese) */
  lingua?: 'it' | 'en';
}
export type PaginaInformazioni = 'info' | 'condizioni' | 'licenze';
export const PAGINE_INFORMAZIONI: ReadonlyArray<readonly [PaginaInformazioni, string]> = [['info', 'Informazioni'], ['condizioni', 'Condizioni d\'uso'], ['licenze', 'Licenze di terze parti']];

export const ANNO = '2026';

export function sezioniInformazioni(o: OpzioniInformazioni): Record<PaginaInformazioni, Sezione[]> {
  if (o.lingua === 'en') return sezioniInformazioniEn(o);
  const altra = o.app === 'pmb_docs' ? 'pmb_sheets (fogli di calcolo)' : 'pmb_docs (documenti di testo)';
  const questa = o.app === 'pmb_docs' ? 'pmb_docs (documenti di testo)' : 'pmb_sheets (fogli di calcolo)';
  return {
    info: [
      { titolo: `Informazioni su ${o.app}`, paragrafi: [
        `${o.app} è un programma per Windows che funziona sul tuo computer, senza bisogno di Internet. Fa parte di pmb_office, la suite per ufficio di PMB, composta da ${questa} e ${altra}.`,
        `Versione ${o.versione}. © ${ANNO} PMB. ${o.app} è software libero: puoi ridistribuirlo e modificarlo secondo i termini della GNU General Public License, versione 3 (GPL-3.0), pubblicata dalla Free Software Foundation.`,
      ] },
      { titolo: 'Software gratuito e open source', paragrafi: [
        `${o.app} è un software gratuito e open source, offerto da PMB senza scopo di lucro, con licenza GPL-3.0 (vedi le condizioni d'uso). Il codice sorgente completo si può chiedere a PMB dalla voce «Segnala un bug o invia un feedback».`,
      ] },
      { titolo: 'Nome e logo', paragrafi: [
        'Il nome PMB, il logo PMB e i nomi pmb_office, pmb_docs e pmb_sheets appartengono a PMB. La licenza GPL-3.0 riguarda il codice del programma, non i marchi: non dà il diritto di usare questi nomi e questo logo su altri prodotti o servizi senza il consenso scritto di PMB.',
      ] },
    ],
    condizioni: [
      { titolo: 'Condizioni d\'uso', paragrafi: [
        `${o.app} è distribuito con la licenza GNU General Public License, versione 3 (GPL-3.0). Puoi installarlo, usarlo, copiarlo e condividerlo liberamente, per uso personale o all'interno della tua attività, su quanti computer vuoi.`,
        `Puoi anche studiarne il codice, modificarlo e distribuire versioni modificate, gratis o a pagamento, purché rispetti la GPL-3.0: chi riceve il programma, anche modificato, deve poter avere il codice sorgente e le stesse libertà, con la stessa licenza. Il testo completo della licenza è su https://www.gnu.org/licenses/gpl-3.0.html.`,
        'Chi distribuisce una versione modificata deve indicarlo in modo chiaro e non può presentarla con il nome o il logo PMB, né far credere che sia la versione originale. Non si possono togliere gli avvisi di copyright e le informazioni sulle licenze.',
        'Eventuali donazioni a PMB sono volontarie: sono un gesto di sostegno, non il prezzo del programma, e non danno diritto a funzioni, assistenza, garanzie o aggiornamenti.',
      ] },
      { titolo: 'Nessuna garanzia', paragrafi: [
        `Nei limiti consentiti dalla legge, ${o.app} è fornito «così com'è», senza garanzie di alcun tipo: né di funzionamento senza errori o interruzioni, né di idoneità a uno scopo particolare, né di assenza di difetti.`,
        `PMB non risponde di perdite di dati, di danni diretti o indiretti, di mancato guadagno o di qualsiasi altro danno derivante dall'uso del programma o dall'impossibilità di usarlo. Fai sempre copie di sicurezza dei tuoi file.`,
        o.app === 'pmb_docs'
          ? 'Il programma non fornisce consulenza legale, fiscale o professionale: i testi che scrivi e i modelli che inserisci vanno verificati da te.'
          : 'Il programma non fornisce consulenza legale, fiscale, contabile o finanziaria: i calcoli, le formule e i risultati vanno verificati da te prima di usarli per decisioni importanti.',
      ] },
      { titolo: 'Marchi e compatibilità dei file', paragrafi: [
        'Windows, Microsoft, Word, Excel, Google, Google Documenti, Google Fogli e gli altri nomi e marchi citati appartengono ai rispettivi proprietari. pmb_office non è affiliato, approvato né sponsorizzato da loro.',
        `${o.app} legge e scrive file in formati aperti o documentati (${o.app === 'pmb_docs' ? '.docx, .odt, .txt, .pdf' : '.xlsx, .ods, .csv, .pdf'}) per permetterti di scambiare documenti con altri programmi. Non garantisce che ogni file si veda o si comporti identico in tutti i programmi.`,
      ] },
      { titolo: 'Privacy e dati', paragrafi: [
        `${o.app} funziona in locale: non invia i tuoi documenti né altri dati a nessun server e non raccoglie statistiche. Fa eccezione solo il messaggio che decidi tu di inviare dalla voce «Segnala un bug o invia un feedback».`,
        `Preferenze, copia di emergenza${o.app === 'pmb_docs' ? ', versioni e dizionario personale' : ' e simili'} si salvano sul tuo computer, non cifrati, nel profilo dell'utente di Windows: chi può usare il tuo account può leggerli. Si cancellano da soli quando salvi o apri un altro file.`,
        `La voce «Segnala un bug o invia un feedback» apre una finestra in cui scrivi un messaggio. Parte via Internet solo quando premi Invia, verso un servizio di Google gestito da PMB che lo inoltra per email a PMB. Contiene solo quello che scrivi, l'email che indichi se vuoi una risposta e, se lasci la spunta, nome e versione del programma e il sistema; mai i tuoi documenti. Se non c'è collegamento puoi usare il tuo programma di posta.`,
        ...(o.correttore ? ['Il controllo ortografico usa le funzioni di Windows e i dizionari che hai installato in Windows: il testo non lascia il computer.'] : []),
      ] },
      { titolo: 'Nota', paragrafi: ['Questi testi sono informativi e non sostituiscono una consulenza legale.'] },
    ],
    licenze: [
      { titolo: 'Componenti di terze parti', paragrafi: [
        `${o.app} contiene componenti scritti da altri autori, ciascuno con la propria licenza. L'elenco completo e i testi delle licenze sono qui sotto. Quelle licenze valgono per quei componenti e restano in vigore: non cambiano le condizioni d'uso del resto del programma.`,
        'Per i componenti con più licenze alternative (indicate con OR) si può usare una qualsiasi delle licenze elencate. I componenti con licenza MPL-2.0 sono usati senza modifiche; il loro codice sorgente è disponibile presso i rispettivi autori (per le librerie Rust, su crates.io).',
        o.app === 'pmb_docs'
          ? 'I caratteri inclusi nel programma (Roboto con licenza Apache-2.0, Inter e le altre famiglie con licenza SIL OFL 1.1) e le icone Material Symbols (Apache-2.0, Google LLC) sono distribuiti con le loro licenze. Per i componenti senza un avviso di copyright scritto nel loro pacchetto, il titolare è l\'autore indicato dal pacchetto stesso.'
          : 'I caratteri Roboto (Apache-2.0) e Inter (SIL OFL 1.1) e le icone Material Symbols (Apache-2.0, Google LLC) sono distribuiti con le loro licenze. Per i componenti senza un avviso di copyright scritto nel loro pacchetto, il titolare è l\'autore indicato dal pacchetto stesso.',
      ] },
    ],
  };
}

/** Gli stessi testi in inglese. Devono dire le stesse cose di quelli italiani: se ne cambi uno, cambia anche l'altro. */
function sezioniInformazioniEn(o: OpzioniInformazioni): Record<PaginaInformazioni, Sezione[]> {
  const altra = o.app === 'pmb_docs' ? 'pmb_sheets (spreadsheets)' : 'pmb_docs (text documents)';
  const questa = o.app === 'pmb_docs' ? 'pmb_docs (text documents)' : 'pmb_sheets (spreadsheets)';
  return {
    info: [
      { titolo: `About ${o.app}`, paragrafi: [
        `${o.app} is a Windows program that runs on your computer, with no need for the Internet. It is part of pmb_office, PMB's office suite, made up of ${questa} and ${altra}.`,
        `Version ${o.versione}. © ${ANNO} PMB. ${o.app} is free software: you can redistribute it and modify it under the terms of the GNU General Public License, version 3 (GPL-3.0), published by the Free Software Foundation.`,
      ] },
      { titolo: 'Free software', paragrafi: [
        `${o.app} is free software and open source, offered by PMB on a non-profit basis, under the GPL-3.0 licence (see the terms of use). The complete source code can be requested from PMB through the "Report a bug or send feedback" item.`,
      ] },
      { titolo: 'Name and logo', paragrafi: [
        "The PMB name, the PMB logo and the names pmb_office, pmb_docs and pmb_sheets belong to PMB. The GPL-3.0 licence covers the program's code, not the trademarks: it does not give the right to use these names and this logo on other products or services without PMB's written consent.",
      ] },
    ],
    condizioni: [
      { titolo: 'Terms of use', paragrafi: [
        `${o.app} is distributed under the GNU General Public License, version 3 (GPL-3.0). You may install, use, copy and share it freely, for personal use or within your business, on as many computers as you like.`,
        `You may also study its code, modify it and distribute modified versions, free of charge or for a fee, provided you comply with the GPL-3.0: anyone who receives the program, even modified, must be able to get the source code and the same freedoms, under the same licence. The full text of the licence is at https://www.gnu.org/licenses/gpl-3.0.html.`,
        'Anyone who distributes a modified version must say so clearly and may not present it with the PMB name or logo, nor make it look like the original version. The copyright notices and the licence information may not be removed.',
        'Any donations to PMB are voluntary: they are a gesture of support, not the price of the program, and do not entitle you to features, support, warranties or updates.',
      ] },
      { titolo: 'No warranty', paragrafi: [
        `To the extent permitted by law, ${o.app} is provided "as is", without warranties of any kind: neither of error-free or uninterrupted operation, nor of fitness for a particular purpose, nor of absence of defects.`,
        'PMB is not liable for loss of data, direct or indirect damages, loss of profit or any other damage arising from the use of the program or from the inability to use it. Always keep backup copies of your files.',
        o.app === 'pmb_docs'
          ? 'The program does not provide legal, tax or professional advice: the texts you write and the templates you insert are for you to verify.'
          : 'The program does not provide legal, tax, accounting or financial advice: calculations, formulas and results are for you to verify before using them for important decisions.',
      ] },
      { titolo: 'Trademarks and file compatibility', paragrafi: [
        'Windows, Microsoft, Word, Excel, Google, Google Docs, Google Sheets and the other names and trademarks mentioned belong to their respective owners. pmb_office is not affiliated with, endorsed by or sponsored by them.',
        `${o.app} reads and writes files in open or documented formats (${o.app === 'pmb_docs' ? '.docx, .odt, .txt, .pdf' : '.xlsx, .ods, .csv, .pdf'}) so that you can exchange documents with other programs. It does not guarantee that every file will look or behave identically in all programs.`,
      ] },
      { titolo: 'Privacy and data', paragrafi: [
        `${o.app} works locally: it does not send your documents or any other data to any server and does not collect statistics. The only exception is the message you yourself decide to send from the "Report a bug or send feedback" item.`,
        `Preferences, the emergency copy${o.app === 'pmb_docs' ? ', versions and personal dictionary' : ' and the like'} are saved on your computer, unencrypted, in the Windows user profile: anyone who can use your account can read them. They are deleted automatically when you save or open another file.`,
        'The "Report a bug or send feedback" item opens a window where you write a message. It is sent over the Internet only when you press Send, to a Google service managed by PMB that forwards it to PMB by email. It contains only what you write, the email you give if you want a reply and, if you leave the tick, the program name and version and the system; never your documents. If there is no connection you can use your own mail program.',
        ...(o.correttore ? ['Spell checking uses Windows features and the dictionaries you have installed in Windows: the text does not leave your computer.'] : []),
      ] },
      { titolo: 'Note', paragrafi: ['These texts are informational and are not a substitute for legal advice.'] },
    ],
    licenze: [
      { titolo: 'Third-party components', paragrafi: [
        `${o.app} contains components written by other authors, each with its own licence. The complete list and the licence texts are below. Those licences apply to those components and remain in force: they do not change the terms of use of the rest of the program.`,
        'For components with several alternative licences (marked OR) you may use any one of the licences listed. Components under the MPL-2.0 licence are used unmodified; their source code is available from their authors (for Rust libraries, on crates.io).',
        o.app === 'pmb_docs'
          ? 'The fonts included in the program (Roboto under Apache-2.0, Inter and the other families under SIL OFL 1.1) and the Material Symbols icons (Apache-2.0, Google LLC) are distributed with their licences. For components without a copyright notice written in their package, the holder is the author indicated by the package itself.'
          : 'The Roboto (Apache-2.0) and Inter (SIL OFL 1.1) fonts and the Material Symbols icons (Apache-2.0, Google LLC) are distributed with their licences. For components without a copyright notice written in their package, the holder is the author indicated by the package itself.',
      ] },
    ],
  };
}
