// T547 (pmb_sheets): le funzioni dei menu messe nella barra sono pulsanti a icona, non scritte (segnalazione dell'utente del 2026-11-19,
// vista in pmb_docs; pmb_sheets mostrava allo stesso modo il nome della voce al posto dell'icona). Regola comune: comune/src/icone-funzioni.ts.
// Lo stesso controllo c'è in pmb_docs (T546).
import { describe, it, expect } from 'vitest';
import { catalogo } from '../../src/sheet/barra-personalizzata';
import { nomeIconaFunzione, ICONA_GENERICA } from '@comune/icone-funzioni';

describe('T547 (pmb_sheets): funzioni dei menu nella barra come icone', () => {
  it('ogni funzione del catalogo che non è una casella a tendina ha un\'icona SVG', () => {
    const senza = catalogo().filter((f) => !f.tipoSelect && !(f.icona ?? '').includes('<svg')).map((f) => f.etichetta);
    expect(senza).toEqual([]);
  });
  it('nessuna voce dei menu finisce sull\'icona generica', () => {
    const generiche = catalogo().filter((f) => f.id.startsWith('menu:') && nomeIconaFunzione(f.etichetta) === ICONA_GENERICA).map((f) => f.etichetta);
    expect(generiche).toEqual([]);
  });
});

// Trovati con la stessa prova fisica (2026-11-19): (1) con la barra predefinita la finestra Personalizza riceveva una barra vuota e la prima
// funzione aggiunta cancellava tutti i pulsanti predefiniti; (2) una barra senza separatori era un solo gruppo che, con la finestra stretta,
// non passava sotto «Altri strumenti» e usciva dalla barra coprendo il pulsante Funzioni.
import '../../src/components/toolbar';
import { barraPredefinita, SEPARATORE } from '../../src/sheet/barra-personalizzata';
import { readFileSync } from 'node:fs';

describe('T547 (pmb_sheets): barra predefinita nella finestra e gruppi lunghi', () => {
  it('la finestra Personalizza parte dalla barra predefinita, non da una barra vuota', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toMatch(/<free-dialogo-personalizza-barra\s+\.barra=\$\{this\.barraPersonalizzata \?\? barraPredefinita\(\)\}/);
    expect(main).not.toMatch(/\.barra=\$\{this\.barraPersonalizzata \?\? \[\]\}/);
  });
  it('ogni elemento della barra personalizzata è un pezzo a sé: solo l\'ultimo di ogni tratto chiude con la linea', () => {
    const menu = catalogo().filter((f) => f.id.startsWith('menu:')).slice(0, 6).map((f) => f.id);
    const tb: any = document.createElement('free-toolbar');
    tb.barra = [menu[0], menu[1], menu[2], SEPARATORE, menu[3], menu[4], menu[5]];
    const g = tb.gruppiEffettivi as Array<{ items: unknown[]; continua?: boolean }>;
    expect(g.map((x) => x.items.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(g.map((x) => !!x.continua)).toEqual([true, true, false, true, true, false]);
  });
  it('la barra predefinita salvata come personalizzata si divide allo stesso modo (nessun gruppo con più elementi)', () => {
    const tb: any = document.createElement('free-toolbar');
    tb.barra = barraPredefinita();
    expect((tb.gruppiEffettivi as Array<{ items: unknown[] }>).every((x) => x.items.length === 1)).toBe(true);
  });
});
