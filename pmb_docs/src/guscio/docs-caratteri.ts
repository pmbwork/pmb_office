import { css } from 'lit';
import { portatile } from '@comune/piattaforma';
import { scegliFilePortatili } from '@comune/file-portatile';

import { customElement, property, state } from 'lit/decorators.js';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t } from '../i18n/lingua';
import { LIMITE_FILE, depositoIndexedDb, famigliaCss, famigliePersonali, importaCaratteri, rimuoviFamiglia, sulCambio, type DepositoCaratteri } from './caratteri';

/** I file di caratteri che si possono importare. */
const ACCETTA_CARATTERI = '.ttf,.otf,.woff,.woff2';

/**
 * Finestra «Caratteri personali»: importa uno o più file di caratteri (.ttf, .otf, .woff, .woff2), elenca quelli importati e permette di toglierli.
 * Eventi: `chiudi`, `cambiato` (l'elenco dei caratteri è cambiato: l'editor deve rivedere l'impaginazione).
 */
@customElement('docs-caratteri')
export class DocsCaratteri extends LinguaElement {
  @property({ attribute: false }) deposito: DepositoCaratteri | null = null;
  @state() private messaggio = '';
  @state() private errore = false;
  @state() private occupato = false;
  private smetti: (() => void) | null = null;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 520px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
    p { margin: 0 0 10px; line-height: 1.45; }
    .nota { color: #5f6368; font-size: 12.5px; }
    ul { list-style: none; margin: 0 0 12px; padding: 0; max-height: 220px; overflow-y: auto; border-top: 1px solid #e8eaed; }
    li { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-bottom: 1px solid #e8eaed; }
    li .testo { flex: 1; min-width: 0; }
    li .nome { font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li .dettaglio { font-size: 12px; color: #5f6368; }
    .vuoto { color: #5f6368; }
    .stato { min-height: 20px; margin: 0 0 8px; }
    .stato.errore { color: #b3261e; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid #dadce0; background: #ffffff; color: #0b57d0; }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.piccolo { height: 28px; padding: 0 12px; }
    button:disabled { opacity: 0.5; cursor: default; }
    .pulsanti { display: flex; justify-content: space-between; gap: 8px; }
    input[type=file] { display: none; }
  `;

  connectedCallback(): void { super.connectedCallback(); this.smetti = sulCambio(() => this.requestUpdate()); }
  disconnectedCallback(): void { this.smetti?.(); this.smetti = null; super.disconnectedCallback(); }
  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('button.primario')?.focus(); }

  private dep(): DepositoCaratteri { return (this.deposito ??= depositoIndexedDb()); }
  private invia(nome: string): void { this.dispatchEvent(new CustomEvent(nome, { bubbles: true, composed: true })); }

  private async suFile(e: Event): Promise<void> {
    const campo = e.target as HTMLInputElement;
    const scelti = Array.from(campo.files ?? []);
    campo.value = '';
    await this.importa(scelti);
  }
  /** Nella versione pocket i file si scelgono con la finestra interna (quella di Windows annoterebbe i file nel PC ospite). */
  private async scegliPortatili(): Promise<void> { await this.importa(await scegliFilePortatili(ACCETTA_CARATTERI, true)); }
  private async importa(scelti: File[]): Promise<void> {
    if (scelti.length === 0) return;
    this.occupato = true; this.errore = false; this.messaggio = t('Importazione in corso…');
    const file = [];
    for (const f of scelti) {
      if (f.size > LIMITE_FILE) { file.push({ nome: f.name, byte: new Uint8Array(0) }); continue; }
      file.push({ nome: f.name, byte: new Uint8Array(await f.arrayBuffer()) });
    }
    const r = await importaCaratteri(file, this.dep());
    this.occupato = false;
    const righe: string[] = [];
    if (r.importati.length > 0) righe.push(t('Importati: {}', r.importati.join(', ')));
    for (const x of r.errori) righe.push(`${x.file}: ${x.motivo}`);
    this.errore = r.errori.length > 0 && r.importati.length === 0;
    this.messaggio = righe.join(' · ');
    if (r.importati.length > 0) this.invia('cambiato');
  }

  private async togli(famiglia: string): Promise<void> {
    await rimuoviFamiglia(famiglia, this.dep());
    this.errore = false;
    this.messaggio = t('Rimosso: {}', famiglia);
    this.invia('cambiato');
  }

  private dimensione(byte: number): string { return byte >= 1048576 ? `${(byte / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`; }

  render() {
    const mie = famigliePersonali();
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-caratteri">
        <h2 id="titolo-caratteri">Caratteri personali</h2>
        <p>Importa un carattere da un file (.ttf, .otf, .woff, .woff2) per usarlo nei documenti. Resta salvato su questo computer e compare nel menu dei caratteri, nella sezione «Personali».</p>
        ${mie.length === 0
          ? html`<p class="vuoto">Nessun carattere personale importato.</p>`
          : html`<ul>${mie.map((f) => html`<li data-famiglia=${f.famiglia}>
              <div class="testo"><div class="nome" data-campione=${f.famiglia}>${f.famiglia}</div>
                <div class="dettaglio">${t('{} file · {}', f.facce, this.dimensione(f.dimensione))}</div></div>
              <button class="piccolo" @click=${() => { void this.togli(f.famiglia); }}>Rimuovi</button>
            </li>`)}</ul>`}
        <p class="nota">Importa solo caratteri che hai il diritto di usare: il programma non controlla la licenza. I documenti mostrano un carattere personale solo dove quel carattere è installato o importato; i file .docx e .odt ne scrivono il nome ma non lo includono, e il PDF scaricato usa sempre il carattere standard.</p>
        <p class="stato ${this.errore ? 'errore' : ''}" role="status" aria-live="polite">${this.messaggio}</p>
        <div class="pulsanti">
          <button class="primario" ?disabled=${this.occupato} @click=${() => this.renderRoot.querySelector<HTMLInputElement>('input[type=file]')?.click()}>Importa file…</button>
          <button @click=${() => this.invia('chiudi')}>Chiudi</button>
        </div>
        ${portatile()
          ? html`<button type="button" class="scegli-portatile" @click=${() => { void this.scegliPortatili(); }}>Scegli i file…</button>`
          : html`<input type="file" multiple accept=".ttf,.otf,.woff,.woff2" @change=${(e: Event) => { void this.suFile(e); }} />`}
      </div>`;
  }

  protected updated(): void {
    // ogni nome si scrive con il suo carattere
    this.renderRoot.querySelectorAll<HTMLElement>('[data-campione]').forEach((n) => { n.style.fontFamily = famigliaCss(n.dataset.campione ?? ''); });
  }
}
