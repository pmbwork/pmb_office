// Base dei componenti di pmb_docs: come LitElement, ma si ridisegna da solo quando cambia la lingua dell'interfaccia.
import { LitElement } from 'lit';

export class LinguaElement extends LitElement {
  private suCambioLingua = (): void => { this.requestUpdate(); };
  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('lingua-cambiata', this.suCambioLingua);
  }
  disconnectedCallback(): void {
    window.removeEventListener('lingua-cambiata', this.suCambioLingua);
    super.disconnectedCallback();
  }
}
