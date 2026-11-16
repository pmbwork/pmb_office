// Pulsanti della finestra (riduci a icona, ingrandisci, chiudi) in alto a destra. Su Windows la finestra nativa non ha la barra del titolo;
// su Mac sì (src-tauri/tauri.macos.conf.json), con i suoi tre pulsanti colorati: lì questi non si mostrano.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement } from 'lit/decorators.js';
import { chiamaTauri } from './tauri';
import { suMac } from '@comune/piattaforma';

@customElement('docs-finestra')
export class DocsFinestra extends LinguaElement {
  static styles = css`
    :host { position: absolute; top: 0; right: 0; z-index: 30; display: flex; height: 32px; -webkit-app-region: no-drag; }
    button { width: 46px; height: 32px; border: 0; padding: 0; background: transparent; color: #1f1f1f; display: flex; align-items: center; justify-content: center; cursor: default; }
    button:hover { background: rgba(0, 0, 0, 0.08); }
    button.chiudi:hover { background: #c42b1c; color: #ffffff; }
    svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1; }
  `;

  render() {
    if (suMac()) return html``;
    return html`
      <button class="riduci" aria-label="Riduci a icona" title="Riduci a icona" @click=${() => { void chiamaTauri('minimize_window'); }}>
        <svg viewBox="0 0 10 10"><path d="M0 5.5h10"/></svg>
      </button>
      <button class="ingrandisci" aria-label="Ingrandisci" title="Ingrandisci" @click=${() => { void chiamaTauri('maximize_window'); }}>
        <svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
      </button>
      <button class="chiudi" aria-label="Chiudi" title="Chiudi" @click=${() => { void chiamaTauri('close_window'); }}>
        <svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10"/></svg>
      </button>
    `;
  }
}
