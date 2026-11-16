// T460: caratteri: nomi nel proprio carattere, elenco ampio, importazione di caratteri personali.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-popup';
import '../../src/guscio/docs-caratteri';
import { CARATTERI_INCLUSI } from '../../src/guscio/caratteri-dati';
import {
  CARATTERI_WINDOWS_BASE, LIMITE_FACCE, LIMITE_FILE, caricaPersonali, elencoCaratteri, famigliaCss, famigliePersonali, faccePersonali, impostaRegistratore,
  importaCaratteri, leggiInfoFont, registratore as registratoreOriginale, rimuoviFamiglia, type DepositoCaratteri, type FacciaPersonale,
} from '../../src/guscio/caratteri';
import { popupPerComando } from '../../src/guscio/popup-dati';
import { disegna } from '../../src/editor/render';

// ---- un file di carattere (sfnt) minimo, costruito a mano: solo le tabelle «name» e «OS/2» ----
function sfnt(opz: { famiglia?: string; tipografica?: string; sotto?: string; peso?: number; corsivo?: boolean; firma?: number }): Uint8Array {
  const stringhe: Array<[number, string]> = [];
  if (opz.famiglia) stringhe.push([1, opz.famiglia]);
  if (opz.sotto) stringhe.push([2, opz.sotto]);
  if (opz.tipografica) stringhe.push([16, opz.tipografica]);
  const nStr = stringhe.length;
  const lenNome = 6 + nStr * 12 + stringhe.reduce((s, [, x]) => s + x.length * 2, 0);
  const nome = new Uint8Array(lenNome); const vn = new DataView(nome.buffer);
  vn.setUint16(2, nStr); vn.setUint16(4, 6 + nStr * 12);
  let off = 0;
  stringhe.forEach(([id, testo], i) => {
    const r = 6 + i * 12;
    vn.setUint16(r, 3); vn.setUint16(r + 2, 1); vn.setUint16(r + 4, 0x409); vn.setUint16(r + 6, id); vn.setUint16(r + 8, testo.length * 2); vn.setUint16(r + 10, off);
    for (let k = 0; k < testo.length; k++) vn.setUint16(6 + nStr * 12 + off + k * 2, testo.charCodeAt(k));
    off += testo.length * 2;
  });
  const os2 = new Uint8Array(78); const vo = new DataView(os2.buffer);
  if (opz.peso !== undefined) vo.setUint16(4, opz.peso);
  vo.setUint16(62, opz.corsivo ? 1 : 0);
  const nT = 2, inizio = 12 + nT * 16;
  const tot = new Uint8Array(inizio + nome.length + os2.length); const v = new DataView(tot.buffer);
  v.setUint32(0, opz.firma ?? 0x00010000); v.setUint16(4, nT);
  const scrivi = (i: number, tag: string, dati: Uint8Array, offset: number): void => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) tot[r + k] = tag.charCodeAt(k);
    v.setUint32(r + 8, offset); v.setUint32(r + 12, dati.length); tot.set(dati, offset);
  };
  scrivi(0, 'name', nome, inizio); scrivi(1, 'OS/2', os2, inizio + nome.length);
  return tot;
}

class DepositoInMemoria implements DepositoCaratteri {
  facce = new Map<string, FacciaPersonale>();
  async leggi(): Promise<FacciaPersonale[]> { return [...this.facce.values()]; }
  async salva(f: FacciaPersonale): Promise<void> { this.facce.set(f.id, f); }
  async elimina(id: string): Promise<void> { this.facce.delete(id); }
}

async function svuotaPersonali(): Promise<void> {
  const d = new DepositoInMemoria();
  for (const f of famigliePersonali()) await rimuoviFamiglia(f.famiglia, d);
}

beforeEach(async () => { document.body.innerHTML = ''; impostaRegistratore(async () => {}); await svuotaPersonali(); });
afterEach(async () => { await svuotaPersonali(); impostaRegistratore(registratoreOriginale); });

describe('lettura di un file di carattere', () => {
  it('ricava famiglia, peso e corsivo (famiglia tipografica prima di quella semplice)', () => {
    expect(leggiInfoFont(sfnt({ famiglia: 'Mia Font', sotto: 'Bold Italic', peso: 700, corsivo: true }))).toEqual({ famiglia: 'Mia Font', famigliaSemplice: 'Mia Font', sottofamiglia: 'Bold Italic', peso: 700, corsivo: true });
    expect(leggiInfoFont(sfnt({ famiglia: 'Mia Font SemiBold', tipografica: 'Mia Font', sotto: 'Regular', peso: 600 }))).toMatchObject({ famiglia: 'Mia Font', famigliaSemplice: 'Mia Font SemiBold', peso: 600, corsivo: false });
  });
  it('ignora i dati sbagliati senza mai lanciare eccezioni', () => {
    expect(leggiInfoFont(new Uint8Array(0))).toBeNull();
    expect(leggiInfoFont(new Uint8Array(40))).toBeNull();
    expect(leggiInfoFont(new TextEncoder().encode('wOF2 non è sfnt, è un altro formato di carattere'))).toBeNull();
    const buono = sfnt({ famiglia: 'X' });
    for (let n = 0; n < buono.length; n += 7) expect(() => leggiInfoFont(buono.slice(0, n))).not.toThrow();
    const casuale = new Uint8Array(500).map((_, i) => (i * 131 + 17) & 255); casuale[0] = 0; casuale[1] = 1; casuale[2] = 0; casuale[3] = 0; casuale[5] = 3;
    expect(() => leggiInfoFont(casuale)).not.toThrow();
  });
});

describe('famigliaCss', () => {
  it('mette il nome tra virgolette (anche con numeri) e sceglie la famiglia generica giusta', () => {
    expect(famigliaCss('Source Sans 3')).toBe('"Source Sans 3", sans-serif');
    expect(famigliaCss('Times New Roman')).toBe('"Times New Roman", serif');
    expect(famigliaCss('Merriweather')).toBe('"Merriweather", serif');
    expect(famigliaCss('Courier New')).toBe('"Courier New", monospace');
    expect(famigliaCss('Source Code Pro')).toBe('"Source Code Pro", monospace');
    expect(famigliaCss('Evil", x: "')).toBe('"Evil, x: ", sans-serif');
  });
  it('il testo di un documento usa il carattere tra virgolette (i nomi con numeri funzionano)', () => {
    const c = document.createElement('div');
    disegna(c, { paragrafi: [{ runs: [{ t: 'ciao', f: 'Source Sans 3' }] }] } as never);
    expect(c.querySelector('span')!.style.fontFamily).toContain('Source Sans 3');
  });
});

describe('elenco dei caratteri', () => {
  it('ha i caratteri di Windows e molte famiglie incluse, senza doppioni', () => {
    const sezioni = elencoCaratteri();
    expect(sezioni.map((s) => s.titolo)).toEqual(['Windows', 'Sans serif', 'Serif', 'Monospazio', 'Decorativo']);
    expect(sezioni[0].nomi.slice(0, CARATTERI_WINDOWS_BASE.length)).toEqual(CARATTERI_WINDOWS_BASE);
    const tutti = sezioni.flatMap((s) => s.nomi);
    expect(new Set(tutti).size).toBe(tutti.length);
    expect(tutti.length).toBeGreaterThanOrEqual(CARATTERI_WINDOWS_BASE.length + CARATTERI_INCLUSI.length);
    for (const n of ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Merriweather', 'Playfair Display', 'Inconsolata', 'Pacifico']) expect(tutti).toContain(n);
  });
});

describe('importazione di caratteri personali', () => {
  const file = (nome: string, byte: Uint8Array) => ({ nome, byte });

  it('importa un file, lo salva, lo mette per primo nell\'elenco e nel menu a tendina, con il nome nel proprio carattere', async () => {
    const dep = new DepositoInMemoria();
    const r = await importaCaratteri([file('MiaFont-Regular.ttf', sfnt({ famiglia: 'Mia Font', peso: 400 })), file('MiaFont-Bold.ttf', sfnt({ famiglia: 'Mia Font', sotto: 'Bold', peso: 700 }))], dep);
    expect(r).toEqual({ importati: ['Mia Font'], errori: [] });
    expect(dep.facce.size).toBe(2);
    expect(famigliePersonali()).toMatchObject([{ famiglia: 'Mia Font', facce: 2 }]);
    expect(elencoCaratteri()[0]).toEqual({ titolo: 'Personali', nomi: ['Mia Font'] });
    const voci = popupPerComando('carattere')!.voci;
    expect(voci[0]).toMatchObject({ etichetta: 'Personali', intestazione: true });
    expect(voci[1]).toMatchObject({ etichetta: 'Mia Font', carattere: 'Mia Font', azione: { tipo: 'attributo', chiave: 'f', valore: 'Mia Font' } });
  });
  it('un file con lo stesso nome, peso e stile sostituisce il precedente', async () => {
    const dep = new DepositoInMemoria();
    await importaCaratteri([file('a.ttf', sfnt({ famiglia: 'Doppia', peso: 400 }))], dep);
    await importaCaratteri([file('b.ttf', sfnt({ famiglia: 'Doppia', peso: 400 }))], dep);
    expect(faccePersonali().length).toBe(1);
    expect(dep.facce.size).toBe(1);
  });
  it('se il nome tipografico è già di un carattere esistente (Arial Black → «Arial») usa il nome semplice', async () => {
    const dep = new DepositoInMemoria();
    const r = await importaCaratteri([file('ariblk.ttf', sfnt({ famiglia: 'Arial Black', tipografica: 'Arial', sotto: 'Black', peso: 900 }))], dep);
    expect(r).toEqual({ importati: ['Arial Black'], errori: [] });
    expect(faccePersonali()[0]).toMatchObject({ famiglia: 'Arial Black', peso: 900 });
  });
  it('senza nome dentro il file (.woff2) usa il nome del file; il peso si capisce da «bold» e «italic»', async () => {
    const dep = new DepositoInMemoria();
    await importaCaratteri([file('Bella_Font-BoldItalic.woff2', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))], dep);
    expect(faccePersonali()[0]).toMatchObject({ famiglia: 'Bella Font', peso: 700, corsivo: true });
  });
  it('rifiuta, spiegando perché: estensione, file vuoto o enorme, nome già usato, file non valido, troppi file', async () => {
    const dep = new DepositoInMemoria();
    const r1 = await importaCaratteri([file('x.pdf', new Uint8Array([1])), file('v.ttf', new Uint8Array(0)), file('Arial.ttf', sfnt({ famiglia: 'Arial' })), file('Open.ttf', sfnt({ famiglia: 'open sans' }))], dep);
    expect(r1.importati).toEqual([]);
    expect(r1.errori.map((e) => e.motivo)).toEqual([
      'Formato non ammesso: servono file .ttf, .otf, .woff o .woff2', 'Il file è vuoto', 'Esiste già un carattere chiamato «Arial»', 'Esiste già un carattere chiamato «open sans»',
    ]);
    const enorme = new Uint8Array(LIMITE_FILE + 1);
    expect((await importaCaratteri([file('g.ttf', enorme)], dep)).errori[0].motivo).toBe('Il file è troppo grande (al massimo 10 MB)');
    impostaRegistratore(async () => { throw new Error('non è un carattere'); });
    expect((await importaCaratteri([file('rotto.ttf', sfnt({ famiglia: 'Rotto' }))], dep)).errori[0].motivo).toBe('Il file non è un carattere valido');
    expect(dep.facce.size).toBe(0);
    impostaRegistratore(async () => {});
    const tanti = Array.from({ length: LIMITE_FACCE + 3 }, (_, i) => file(`f${i}.ttf`, sfnt({ famiglia: `Famiglia ${i}`, peso: 400 })));
    const r2 = await importaCaratteri(tanti, dep);
    expect(r2.importati.length).toBe(LIMITE_FACCE);
    expect(r2.errori.length).toBe(3);
    expect(r2.errori[0].motivo).toBe('Troppi caratteri personali (al massimo 60 file)');
  });
  it('se il salvataggio sul computer fallisce non resta niente a metà', async () => {
    const dep = new DepositoInMemoria();
    dep.salva = async () => { throw new Error('disco pieno'); };
    const r = await importaCaratteri([file('a.ttf', sfnt({ famiglia: 'Mai Salvato' }))], dep);
    expect(r.importati).toEqual([]);
    expect(r.errori[0].motivo).toBe('Non riesco a salvare il carattere su questo computer');
    expect(famigliePersonali()).toEqual([]);
  });
  it('rimuovere una famiglia la toglie dal deposito e dal menu; avvisa chi ascolta', async () => {
    const dep = new DepositoInMemoria();
    await importaCaratteri([file('a.ttf', sfnt({ famiglia: 'Da Togliere', peso: 400 })), file('b.ttf', sfnt({ famiglia: 'Da Togliere', peso: 700 }))], dep);
    await rimuoviFamiglia('Da Togliere', dep);
    expect(dep.facce.size).toBe(0);
    expect(elencoCaratteri().map((s) => s.titolo)).not.toContain('Personali');
  });
  it('al riavvio i caratteri salvati si ricaricano; un file rovinato si salta senza fermare gli altri', async () => {
    const dep = new DepositoInMemoria();
    await importaCaratteri([file('a.ttf', sfnt({ famiglia: 'Buono' })), file('b.ttf', sfnt({ famiglia: 'Cattivo' }))], dep);
    await svuotaPersonali();
    expect(famigliePersonali()).toEqual([]);
    impostaRegistratore(async (f) => { if (f.famiglia === 'Cattivo') throw new Error('rovinato'); });
    await caricaPersonali(dep);
    expect(famigliePersonali().map((f) => f.famiglia)).toEqual(['Buono']);
  });
});

describe('menu a tendina e finestra', () => {
  it('il menu scrive ogni nome con il proprio carattere e mostra i titoli delle sezioni', async () => {
    const p: any = document.createElement('docs-popup');
    p.popup = popupPerComando('carattere');
    document.body.appendChild(p);
    await p.updateComplete;
    const bottoni = Array.from(p.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[];
    const georgia = bottoni.find((b) => b.textContent!.includes('Georgia'))!;
    expect(georgia.style.fontFamily).toContain('Georgia');
    const sans = bottoni.find((b) => b.textContent!.includes('Source Sans 3'))!;
    expect(sans.style.fontFamily).toContain('"Source Sans 3"');
    expect(Array.from(p.shadowRoot.querySelectorAll('.intestazione')).map((x: any) => x.textContent.trim())).toEqual(['Windows', 'Sans serif', 'Serif', 'Monospazio', 'Decorativo']);
    const ultimo = bottoni[bottoni.length - 1];
    expect(ultimo.textContent).toContain('Caratteri personali…');
    expect(ultimo.style.fontFamily).toBe('');
  });
  it('scegliere un carattere avvisa con l\'azione giusta; «Caratteri personali…» apre la finestra', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'strumenti', voce: 'Caratteri personali' }, bubbles: true, composed: true }));
    await g.updateComplete;
    const d: any = g.shadowRoot.querySelector('docs-caratteri');
    expect(d).not.toBeNull();
    await d.updateComplete;
    expect(d.shadowRoot.textContent).toContain('Nessun carattere personale importato.');
    d.shadowRoot.querySelector('button:not(.primario)').click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-caratteri')).toBeNull();
  });
  it('la finestra importa i file scelti, elenca i caratteri ognuno nel proprio carattere, e li toglie', async () => {
    const d: any = document.createElement('docs-caratteri');
    d.deposito = new DepositoInMemoria();
    document.body.appendChild(d);
    await d.updateComplete;
    const cambi = vi.fn(); d.addEventListener('cambiato', cambi);
    const campo = d.shadowRoot.querySelector('input[type=file]') as HTMLInputElement;
    expect(campo.accept).toBe('.ttf,.otf,.woff,.woff2');
    expect(campo.multiple).toBe(true);
    const f1 = new File([sfnt({ famiglia: 'Mia Calligrafia', peso: 400 })], 'calligrafia.ttf');
    const f2 = new File([new Uint8Array([1])], 'foto.png');
    Object.defineProperty(campo, 'files', { value: [f1, f2], configurable: true });
    campo.dispatchEvent(new Event('change'));
    for (let i = 0; i < 40 && cambi.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    await d.updateComplete;
    expect(cambi).toHaveBeenCalledTimes(1);
    const stato = d.shadowRoot.querySelector('.stato').textContent;
    expect(stato).toContain('Importati: Mia Calligrafia');
    expect(stato).toContain('foto.png: Formato non ammesso');
    const nome = d.shadowRoot.querySelector('[data-campione="Mia Calligrafia"]') as HTMLElement;
    expect(nome.style.fontFamily).toContain('Mia Calligrafia');
    (d.shadowRoot.querySelector('li button') as HTMLButtonElement).click();
    for (let i = 0; i < 40 && famigliePersonali().length > 0; i++) await new Promise((r) => setTimeout(r, 10));
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('li')).toBeNull();
    expect(cambi).toHaveBeenCalledTimes(2);
  });
});
