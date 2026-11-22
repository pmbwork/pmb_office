// T546 (pmb_docs): le funzioni dei menu messe nella barra sono pulsanti a icona, non scritte (segnalazione dell'utente del 2026-11-19:
// «l'aggiunta di icone nella personalizzazione stravolge la grafica»: «Nuovo», «Document (.docx)», «Italiano»… diventavano testi lunghi).
// L'icona si sceglie dal nome con la regola comune della suite (comune/src/icone-funzioni.ts); lo stesso controllo c'è in pmb_sheets (T547).
// Anche il campo «Cerca una funzione» della finestra Personalizza non deve schiacciarsi (era alto la metà con la barra piena).
import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-toolbar';
import '../../src/guscio/docs-personalizza-barra';
import { catalogo, barraPredefinita } from '../../src/guscio/barra-personalizzata';
import { iconaDi } from '../../src/guscio/icone';
import { nomeIconaFunzione, ICONA_GENERICA } from '@comune/icone-funzioni';

const CASELLE = ['zoom', 'stile-paragrafo', 'carattere', 'corpo'];

describe('T546 (pmb_docs): funzioni dei menu nella barra come icone', () => {
  it('ogni funzione del catalogo (tranne le quattro caselle di testo) ha un\'icona, e nessuna voce finisce sull\'icona generica', () => {
    const senza = catalogo().filter((f) => !CASELLE.includes(f.id) && !iconaDi(f).includes('<svg')).map((f) => f.etichetta);
    expect(senza).toEqual([]);
    const generiche = catalogo().filter((f) => f.menu && nomeIconaFunzione(f.etichetta) === ICONA_GENERICA).map((f) => f.etichetta);
    expect(generiche).toEqual([]);
  });
  it('la barra con 30 voci di menu aggiunte mostra solo pulsanti a icona (niente pulsanti di testo), con il nome nel suggerimento', async () => {
    const menu = catalogo().filter((f) => f.menu).slice(0, 30).map((f) => f.id);
    const tb: any = document.createElement('docs-toolbar');
    tb.larghezza = 6000;
    tb.barra = [...barraPredefinita(), ...menu];
    document.body.appendChild(tb);
    await tb.updateComplete;
    const r: ShadowRoot = tb.shadowRoot;
    expect(r.querySelectorAll('button.comando.testo').length).toBe(0);
    for (const id of menu) {
      const b = r.querySelector<HTMLButtonElement>(`button[data-id="${CSS.escape(id)}"]`);
      expect(b, id).not.toBeNull();
      expect(b!.querySelector('.icona svg'), id).not.toBeNull();
      expect((b!.textContent ?? '').trim(), id).toBe('');
      expect(b!.title.length, id).toBeGreaterThan(0);
    }
    tb.remove();
  });
  it('la finestra Personalizza mostra l\'icona anche per le voci di menu, e il campo di ricerca non si restringe', async () => {
    const menu = catalogo().filter((f) => f.menu).slice(0, 5).map((f) => f.id);
    const d: any = document.createElement('docs-personalizza-barra');
    d.barra = [...barraPredefinita(), ...menu];
    document.body.appendChild(d);
    await d.updateComplete;
    const elementi = [...d.shadowRoot.querySelectorAll('.barra .elemento')].slice(-5);
    for (const e of elementi) expect((e as Element).querySelector('.icona svg')).not.toBeNull();
    const stile = (d.constructor as any).styles.cssText as string;
    expect(stile).toMatch(/\.cerca \{[^}]*flex-shrink: 0/);
    d.remove();
  });
});
