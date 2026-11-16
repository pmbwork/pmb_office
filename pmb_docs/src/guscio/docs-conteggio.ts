import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import type { StatisticheTesto } from '../editor/docs-editor';
import { t } from '../i18n/lingua';

@customElement('docs-conteggio')
export class DocsConteggio extends LinguaElement {
  @property({ attribute: false }) dati: StatisticheTesto = {
    pagine: 1,
    parole: 0,
    caratteri: 0,
    caratteriNoSpazi: 0,
    haSelezione: false,
  };

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo {
      width: 380px;
      box-sizing: border-box;
      padding: 24px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 500;
      color: #1f1f1f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    td {
      padding: 8px 0;
      border-bottom: 1px solid #f1f3f4;
      font-size: 14px;
    }
    td.valore {
      text-align: right;
      font-weight: 500;
      color: #444746;
    }
    .pulsanti {
      display: flex;
      justify-content: flex-end;
    }
    button.chiudi {
      height: 36px;
      padding: 0 24px;
      border: 0;
      border-radius: 18px;
      background: #0b57d0;
      color: #ffffff;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    button.chiudi:hover {
      background: #0842a0;
    }
  `;

  private chiudi = (): void => {
    this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true }));
  };

  focalizza(): void {
    (this.renderRoot as ParentNode | undefined)?.querySelector<HTMLButtonElement>('button.chiudi')?.focus();
  }

  render() {
    const d = this.dati;
    const formatta = (tot: number, sel?: number) => {
      if (d.haSelezione && sel !== undefined) {
        return t('{} di {}', sel, tot);
      }
      return `${tot}`;
    };

    return html`
      <div class="dialogo" role="dialog" aria-labelledby="titolo-conteggio">
        <h2 id="titolo-conteggio">Conteggio parole</h2>
        <table>
          <tbody>
            <tr>
              <td>Pagine</td>
              <td class="valore" data-campo="pagine">${d.pagine}</td>
            </tr>
            <tr>
              <td>Parole</td>
              <td class="valore" data-campo="parole">${formatta(d.parole, d.paroleSel)}</td>
            </tr>
            <tr>
              <td>Caratteri</td>
              <td class="valore" data-campo="caratteri">${formatta(d.caratteri, d.caratteriSel)}</td>
            </tr>
            <tr>
              <td>Caratteri (spazi esclusi)</td>
              <td class="valore" data-campo="caratteri-no-spazi">${formatta(d.caratteriNoSpazi, d.caratteriNoSpaziSel)}</td>
            </tr>
          </tbody>
        </table>
        <div class="pulsanti">
          <button class="chiudi" @click=${this.chiudi}>Chiudi</button>
        </div>
      </div>
    `;
  }
}