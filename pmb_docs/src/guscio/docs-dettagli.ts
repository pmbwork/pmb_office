import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

export interface DettagliDocumento {
  titolo: string;
  formato: string;
  pagine: number;
  parole: number;
  caratteri: number;
  dataCreazione?: string;
  dataModifica?: string;
}

@customElement('docs-dettagli')
export class DocsDettagli extends LinguaElement {
  @property({ attribute: false }) dati: DettagliDocumento = {
    titolo: 'Documento senza titolo',
    formato: 'Documento (.docx)',
    pagine: 1,
    parole: 0,
    caratteri: 0,
    dataModifica: 'Non ancora salvato',
  };

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo {
      width: 420px;
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
    td.etichetta {
      color: #5f6368;
      width: 40%;
    }
    td.valore {
      text-align: right;
      font-weight: 500;
      color: #1f1f1f;
      word-break: break-all;
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
    this.renderRoot.querySelector<HTMLButtonElement>('button.chiudi')?.focus();
  }

  render() {
    const d = this.dati;
    return html`
      <div class="dialogo" role="dialog" aria-labelledby="titolo-dettagli">
        <h2 id="titolo-dettagli">Dettagli del documento</h2>
        <table>
          <tbody>
            <tr>
              <td class="etichetta">Nome</td>
              <td class="valore" data-campo="titolo">${d.titolo}</td>
            </tr>
            <tr>
              <td class="etichetta">Formato</td>
              <td class="valore" data-campo="formato">${t(d.formato)}</td>
            </tr>
            <tr>
              <td class="etichetta">Pagine</td>
              <td class="valore" data-campo="pagine">${d.pagine}</td>
            </tr>
            <tr>
              <td class="etichetta">Parole</td>
              <td class="valore" data-campo="parole">${d.parole}</td>
            </tr>
            <tr>
              <td class="etichetta">Caratteri</td>
              <td class="valore" data-campo="caratteri">${d.caratteri}</td>
            </tr>
            <tr>
              <td class="etichetta">Ultima modifica</td>
              <td class="valore" data-campo="modifica">${t(d.dataModifica ?? 'Locale')}</td>
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
