// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MENU } from '../../src/guscio/menu-dati';

// Formato compatto: etichetta, * se ha sottomenu, @scorciatoia se c'è.
const comp = (id: string) => {
  const m = MENU.find((x) => x.id === id);
  if (!m) throw new Error('menu mancante: ' + id);
  return m.voci.map((v) => v.etichetta + (v.figli ? '*' : '') + (v.scorciatoia ? '@' + v.scorciatoia : '')).join('|');
};

describe('T021: menu di pmb_docs', () => {
  it('gli otto menu, in ordine, con le etichette giuste', () => {
    expect(MENU.map((m) => m.id)).toEqual(['file', 'modifica', 'visualizza', 'inserisci', 'formato', 'strumenti', 'informazioni', 'segnalazione']);
    expect(MENU.map((m) => m.etichetta)).toEqual(['File', 'Modifica', 'Visualizza', 'Inserisci', 'Formato', 'Strumenti', 'Informazioni', 'Segnalazione bug']);
  });
  it('menu File', () => {
    expect(comp('file').split('|')).toEqual('Nuovo|Apri@Ctrl+O|Salva@Ctrl+S|Salva con nome@Ctrl+Maiusc+S|Scarica*|Rinomina|Cronologia versioni|Dettagli|Correttore lingua*|Impostazione pagina|Anteprima di stampa|Stampa@Ctrl+P'.split('|'));
  });
  it('menu Modifica', () => {
    expect(comp('modifica').split('|')).toEqual('Annulla@Ctrl+Z|Ripeti@Ctrl+Y|Taglia@Ctrl+X|Copia@Ctrl+C|Incolla@Ctrl+V|Incolla senza formattazione@Ctrl+Maiusc+V|Seleziona tutto@Ctrl+A|Elimina|Trova e sostituisci@Ctrl+H'.split('|'));
  });
  it('menu Visualizza', () => {
    expect(comp('visualizza').split('|')).toEqual('Modalità*|Mostra layout di stampa|Mostra righello|Mostra barra degli strumenti delle equazioni|Mostra caratteri non stampabili@Ctrl+Maiusc+P|Schermo intero|Nascondi i menu@Ctrl+Maiusc+F|Personalizza barra degli strumenti'.split('|'));
  });
  it('menu Inserisci', () => {
    expect(comp('inserisci').split('|')).toEqual('Immagine|Tabella|Componenti di base*|Link@Ctrl+K|Disegno*|Grafico*|Simboli|Equazione|Tab@Maiusc+F11|Linea orizzontale|Interruzione*|Segnalibro|Elementi di pagina*'.split('|'));
  });
  it('menu Formato', () => {
    expect(comp('formato').split('|')).toEqual('Testo*|Stili paragrafo|Allinea e applica rientro|Interlinea e spaziatura paragrafo|Colonne*|Elenchi puntati e numerati|Intestazioni e piè di pagina|Numeri di pagina|Orientamento pagina|Passa al formato Senza pagine|Tabella|Immagine|Bordi e linee*|Cancella formattazione@Ctrl+\\'.split('|'));
  });
  it('menu Strumenti', () => {
    expect(comp('strumenti').split('|')).toEqual('Ortografia e grammatica*|Conteggio parole@Ctrl+Maiusc+C|Numeri di riga|Dizionario@Ctrl+Maiusc+Y|Caratteri personali|Preferenze|Accessibilità'.split('|'));
  });
  it('nessuna voce vietata (condivisione, AI, estensioni)', () => {
    const tutte = MENU.flatMap((m) => m.voci.map((v) => v.etichetta.toLowerCase())).join('|');
    for (const vietata of ['condividi', 'email', 'commento', 'gemini', 'estensioni', 'guida', 'firma', 'smart chip', 'drive']) {
      expect(tutte.includes(vietata), vietata).toBe(false);
    }
  });
});
