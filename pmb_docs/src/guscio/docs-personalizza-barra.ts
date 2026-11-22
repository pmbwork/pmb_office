// Finestra «Personalizza la barra degli strumenti» (come «Personalizza» di Firefox): in alto la barra com'è, sotto tutte le funzioni.
// Si trascina una funzione nella barra (o fuori dalla barra per toglierla), si riordina trascinando; per chi non usa il mouse ci sono i pulsanti
// ◀ ▶ ✕ e «Aggiungi». Ogni modifica si applica subito alla barra vera (evento «barra-cambiata»).
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { catalogo, funzione, barraPredefinita, ripulisciBarra, sposta, SEPARATORE, type Funzione } from './barra-personalizzata';
import { iconaDi } from './icone';
import { t, tVoce } from '../i18n/lingua';

/** Il nome di una funzione nella lingua corrente (per le voci di sottomenu: «Grafico › A barre»). */
export function nomeFunzione(f: Funzione): string { return f.etichetta.split(' › ').map((p) => tVoce(p)).join(' › '); }

@customElement('docs-personalizza-barra')
export class DocsPersonalizzaBarra extends LinguaElement {
  /** la barra com'è adesso */
  @property({ attribute: false }) barra: string[] = barraPredefinita();
  @state() private filtro = '';
  /** cosa si sta trascinando: un elemento della barra (indice) o una funzione del catalogo (id) */
  private trascinato: { indice?: number; id?: string } | null = null;

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: min(860px, calc(100vw - 48px)); max-height: calc(100vh - 80px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 500; }
    h3 { margin: 4px 0 0; font-size: 14px; font-weight: 500; color: var(--pmb-testo-2, #444746); }
    p.aiuto { margin: 0; color: var(--pmb-testo-2, #444746); font-size: 13px; }
    /* come in pmb_sheets: con tanti pulsanti il riquadro scorre al suo interno (max-height + overflow) e non si restringe (flex-shrink: 0),
       altrimenti i pulsanti uscivano dal bordo e coprivano «Funzioni disponibili» e la ricerca (trovato nella prova fisica del 2026-11-18) */
    .barra { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px; min-height: 44px; max-height: 180px; overflow-y: auto; flex-shrink: 0; box-sizing: border-box; padding: 8px; border: 2px dashed var(--pmb-bordo, #c4c7c5); border-radius: 12px; background: var(--pmb-superficie-2, #f0f4f9); }
    .barra.sopra { border-color: #0b57d0; }
    .elemento { display: inline-flex; align-items: center; gap: 2px; height: 32px; padding: 0 4px 0 8px; border-radius: 16px; background: var(--pmb-superficie, #ffffff); border: 1px solid var(--pmb-bordo, #c4c7c5); cursor: grab; user-select: none; }
    .elemento.separatore { padding: 0 4px; background: none; border-style: dashed; }
    .elemento.separatore .nome { width: 1px; height: 20px; background: #747775; display: inline-block; margin: 0 6px; }
    .elemento.sopra { outline: 2px solid #0b57d0; }
    .elemento .icona { display: inline-flex; width: 18px; height: 18px; margin-right: 4px; }
    .elemento .icona svg { width: 18px; height: 18px; }
    .elemento button, .riga button.aggiungi { border: 0; background: none; border-radius: 12px; height: 24px; min-width: 24px; padding: 0 6px; font: inherit; color: var(--pmb-testo-2, #444746); cursor: default; }
    .elemento button:hover, .riga button:hover { background: var(--pmb-hover, #e8eaed); }
    .cerca { flex-shrink: 0; box-sizing: border-box; height: 32px; padding: 0 12px; border: 1px solid var(--pmb-bordo-forte, #747775); border-radius: 16px; font: inherit; width: 280px; }
    .catalogo { overflow-y: auto; flex: 1 1 auto; min-height: 120px; max-height: 42vh; border: 1px solid var(--pmb-bordo, #e3e3e3); border-radius: 8px; padding: 4px 8px; }
    .catalogo.sopra { border-color: #0b57d0; background: var(--pmb-superficie-2, #f8fbff); }
    .gruppo { margin: 8px 0 2px; font-weight: 500; color: var(--pmb-testo-2, #444746); font-size: 13px; }
    .riga { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 4px; border-radius: 6px; cursor: grab; }
    .riga:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    .riga .nome { flex: 1; }
    .riga.nella-barra { color: var(--pmb-testo-2, #747775); cursor: default; }
    .pulsanti { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .pulsanti button { height: 36px; padding: 0 20px; border: 1px solid var(--pmb-bordo-forte, #747775); border-radius: 18px; background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); font: inherit; font-weight: 500; cursor: default; }
    .pulsanti button.primario { background: #0b57d0; border-color: #0b57d0; color: #ffffff; }
    .pulsanti .spazio { flex: 1; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input.cerca')?.focus(); }

  private cambia(nuova: string[]): void {
    this.barra = ripulisciBarra(nuova) ?? [];
    this.dispatchEvent(new CustomEvent('barra-cambiata', { detail: { barra: this.barra }, bubbles: true, composed: true }));
  }
  private chiudi = (): void => { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); };

  // ---- trascinamento ----
  private inizia(e: DragEvent, x: { indice?: number; id?: string }): void {
    this.trascinato = x;
    e.dataTransfer?.setData('text/plain', JSON.stringify(x));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  private sopra(e: DragEvent): void { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('sopra'); }
  private fuori(e: DragEvent): void { (e.currentTarget as HTMLElement).classList.remove('sopra'); }
  private letto(e: DragEvent): { indice?: number; id?: string } | null {
    try { return this.trascinato ?? JSON.parse(e.dataTransfer?.getData('text/plain') || 'null'); } catch { return null; }
  }
  /** Lasciato su un elemento della barra: va prima di quell'elemento; lasciato sulla barra vuota: va in fondo. */
  private lasciaInBarra(e: DragEvent, prima?: number): void {
    e.preventDefault(); e.stopPropagation();
    this.renderRoot.querySelectorAll('.sopra').forEach((x) => x.classList.remove('sopra'));
    const x = this.letto(e); this.trascinato = null;
    if (!x) return;
    const dove = prima ?? this.barra.length;
    if (x.indice !== undefined) this.cambia(sposta(this.barra, x.indice, x.indice < dove ? dove - 1 : dove));
    else if (x.id) { const b = [...this.barra]; if (x.id !== SEPARATORE && b.includes(x.id)) return; b.splice(dove, 0, x.id); this.cambia(b); }
  }
  /** Lasciato sull'elenco delle funzioni: esce dalla barra. */
  private lasciaInCatalogo(e: DragEvent): void {
    e.preventDefault();
    this.renderRoot.querySelectorAll('.sopra').forEach((x) => x.classList.remove('sopra'));
    const x = this.letto(e); this.trascinato = null;
    if (x?.indice !== undefined) this.togli(x.indice);
  }

  // ---- pulsanti ----
  private togli(i: number): void { this.cambia(this.barra.filter((_, k) => k !== i)); }
  private aggiungi(id: string): void { if (id !== SEPARATORE && this.barra.includes(id)) return; this.cambia([...this.barra, id]); }

  private icona(f: Funzione | undefined) { const svg = f ? iconaDi(f) : ''; return svg ? html`<span class="icona">${unsafeHTML(svg)}</span>` : ''; }

  render() {
    const filtro = this.filtro.trim().toLowerCase();
    const gruppi = new Map<string, Funzione[]>();
    for (const f of catalogo()) {
      if (filtro && !nomeFunzione(f).toLowerCase().includes(filtro)) continue;
      (gruppi.get(f.gruppo) ?? gruppi.set(f.gruppo, []).get(f.gruppo)!).push(f);
    }
    const n = this.barra.length;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-personalizza" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); } }}>
        <h2 id="titolo-personalizza">Personalizza la barra degli strumenti</h2>
        <p class="aiuto">Trascina una funzione nella barra per aggiungerla, trascinala nella barra per spostarla, trascinala fuori per toglierla. Le modifiche si vedono subito.</p>
        <h3>La tua barra</h3>
        <div class="barra" role="list" aria-label="La tua barra" @dragover=${this.sopra} @dragleave=${this.fuori} @drop=${(e: DragEvent) => this.lasciaInBarra(e)}>
          ${this.barra.map((id, i) => {
            const f = funzione(id);
            const sep = id === SEPARATORE;
            const nome = sep ? t('Separatore') : f ? nomeFunzione(f) : id;
            return html`<div class=${sep ? 'elemento separatore' : 'elemento'} role="listitem" data-id=${id} draggable="true" title=${nome}
                @dragstart=${(e: DragEvent) => this.inizia(e, { indice: i })} @dragover=${(e: DragEvent) => { e.stopPropagation(); this.sopra(e); }} @dragleave=${this.fuori}
                @drop=${(e: DragEvent) => this.lasciaInBarra(e, i)}>
              ${sep ? html`<span class="nome" aria-label=${nome}></span>` : html`${this.icona(f)}<span class="nome">${nome}</span>`}
              <button class="sinistra" aria-label=${t('Sposta {} a sinistra', nome)} title="Sposta a sinistra" ?disabled=${i === 0} @click=${() => this.cambia(sposta(this.barra, i, i - 1))}>◀</button>
              <button class="destra" aria-label=${t('Sposta {} a destra', nome)} title="Sposta a destra" ?disabled=${i === n - 1} @click=${() => this.cambia(sposta(this.barra, i, i + 1))}>▶</button>
              <button class="togli" aria-label=${t('Togli {} dalla barra', nome)} title="Togli dalla barra" @click=${() => this.togli(i)}>✕</button>
            </div>`;
          })}
        </div>
        <h3>Funzioni disponibili</h3>
        <input class="cerca" type="search" placeholder="Cerca una funzione" aria-label="Cerca una funzione" .value=${this.filtro} @input=${(e: Event) => { this.filtro = (e.target as HTMLInputElement).value; }} />
        <div class="catalogo" role="list" aria-label="Funzioni disponibili" @dragover=${this.sopra} @dragleave=${this.fuori} @drop=${this.lasciaInCatalogo}>
          ${[...gruppi.entries()].map(([gruppo, voci]) => html`
            <div class="gruppo">${tVoce(gruppo)}</div>
            ${voci.map((f) => {
              const dentro = this.barra.includes(f.id);
              return html`<div class=${dentro ? 'riga nella-barra' : 'riga'} role="listitem" data-id=${f.id} draggable=${dentro ? 'false' : 'true'}
                  @dragstart=${(e: DragEvent) => this.inizia(e, { id: f.id })}>
                ${this.icona(f)}<span class="nome">${nomeFunzione(f)}</span>
                ${dentro ? html`<span class="stato">Nella barra</span>` : html`<button class="aggiungi" aria-label=${t('Aggiungi {} alla barra', nomeFunzione(f))} @click=${() => this.aggiungi(f.id)}>Aggiungi</button>`}
              </div>`;
            })}`)}
        </div>
        <div class="pulsanti">
          <button class="separatore" @click=${() => this.aggiungi(SEPARATORE)}>Aggiungi separatore</button>
          <button class="ripristina" @click=${() => this.cambia(barraPredefinita())}>Ripristina predefinita</button>
          <span class="spazio"></span>
          <button class="primario fatto" @click=${this.chiudi}>Fatto</button>
        </div>
      </div>`;
  }
}
