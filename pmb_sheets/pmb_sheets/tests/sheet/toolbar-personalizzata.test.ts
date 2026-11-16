import { describe, it, expect } from 'vitest';
import {
  catalogo,
  funzione,
  barraPredefinita,
  ripulisciBarra,
  spostaElementoBarra,
  SEPARATORE,
} from '../../src/sheet/barra-personalizzata';
import { FreeToolbar } from '../../src/components/toolbar';
import { FreeDialogoPersonalizzaBarra } from '../../src/components/dialogo-personalizza-barra';

describe('Barra degli strumenti personalizzabile', () => {
  it('il catalogo contiene sia elementi della toolbar che voci di menu', () => {
    const voci = catalogo();
    expect(voci.length).toBeGreaterThan(30);

    const grassetto = voci.find((v) => v.id === 'bold');
    expect(grassetto).toBeDefined();
    expect(grassetto?.etichetta).toBe('Grassetto');

    const salva = voci.find((v) => v.id.startsWith('menu:file'));
    expect(salva).toBeDefined();
    expect(salva?.gruppo).toBe('Menu File');
  });

  it('funzione(id) trova correttamente la funzione richiesta', () => {
    const f = funzione('format-currency');
    expect(f).toBeDefined();
    expect(f?.etichetta).toBe('Valuta');

    const nonEsiste = funzione('non-esistente-xyz');
    expect(nonEsiste).toBeUndefined();
  });

  it('barraPredefinita restituisce la configurazione iniziale con separatori', () => {
    const barra = barraPredefinita();
    expect(barra.length).toBeGreaterThan(15);
    expect(barra).toContain('undo');
    expect(barra).toContain('redo');
    expect(barra).toContain(SEPARATORE);
    expect(barra).toContain('bold');
  });

  it('ripulisciBarra elimina id sconosciuti, doppioni e separatori multipli/alle estremità', () => {
    const sporca = [
      SEPARATORE,
      'bold',
      'id-farlocco-123',
      'bold',
      SEPARATORE,
      SEPARATORE,
      'italic',
      SEPARATORE,
    ];
    const pulita = ripulisciBarra(sporca);
    expect(pulita).toEqual(['bold', SEPARATORE, 'italic']);
  });

  it('spostaElementoBarra riordina correttamente gli indici', () => {
    const iniziale = ['bold', 'italic', 'underline'];
    const spostata = spostaElementoBarra(iniziale, 0, 2);
    expect(spostata).toEqual(['italic', 'underline', 'bold']);
  });

  it('FreeToolbar crea correttamente i gruppi effettivi da barra custom', () => {
    const tb = new FreeToolbar();
    expect(tb.gruppiEffettivi.length).toBeGreaterThan(0);

    // Con configurazione personalizzata
    tb.barra = ['bold', 'italic', SEPARATORE, 'format-currency'];
    const gruppi = tb.gruppiEffettivi;
    expect(gruppi.length).toBe(2);
    expect(gruppi[0].items.map((i) => i.id)).toEqual(['bold', 'italic']);
    expect(gruppi[1].items.map((i) => i.id)).toEqual(['format-currency']);
  });

  it('FreeDialogoPersonalizzaBarra inizializza e risponde agli eventi', () => {
    const dlg = new FreeDialogoPersonalizzaBarra();
    expect(dlg.barra.length).toBeGreaterThan(0);
    let eventoBarra: any = null;
    dlg.addEventListener('barra-cambiata', (e: any) => {
      eventoBarra = e.detail;
    });

    // Simula aggiunta
    (dlg as any).aggiungi('menu:file›save');
    expect(eventoBarra).not.toBeNull();
    expect(eventoBarra.barra).toContain('menu:file›save');
  });
});

