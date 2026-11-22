import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "./assets/fonts/fonts.css";
import "./assets/fonts/caratteri-extra.css";
import "./guscio/docs-guscio";
import { installaFinestraFilePortatile } from "@comune/file-portatile";
import { installaFinestreNative } from "@comune/file-nativi";
import { t, localeCorrente } from "./i18n/lingua";

// versione pocket (device come AI_PRO): Apri e Salva con la finestra interna, così Windows non annota niente nel PC ospite
installaFinestraFilePortatile({ t, locale: localeCorrente });
// versione installata su Windows: Apri e Salva con le finestre di Windows, così «Salva» riscrive il file sul posto (file_nativi.rs)
installaFinestreNative({ t });

// Scheletro di pmb_docs: per ora una pagina A4 vuota. L'editor vero arriva in M5.
@customElement("docs-app")
export class DocsApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: #f9fbfd;
      font-family: Roboto, Arial, sans-serif;
    }
    .pagina {
      width: 816px;
      min-height: 1056px;
      margin: 24px 0;
      background: #ffffff;
      border: 1px solid #c7c7c7;
      box-sizing: border-box;
    }
  ` as any;

  render() {
    return html`<div class="pagina" role="textbox" aria-label="Documento"></div>`;
  }
}