import { noChange } from "lit";
import { directive, Directive, PartInfo, PartType } from "lit/directive.js";

/**
 * Direttiva Lit styleMap conforme alla Content Security Policy (CSP).
 *
 * A differenza dello styleMap standard di lit-html, che al primo render
 * restituisce una stringa applicata direttamente all'attributo HTML di stile
 * facendo scattare le violazioni CSP di Blink in presenza di nonce/hash,
 * questa direttiva restituisce sempre `noChange` a Lit e applica tutte
 * le proprietà direttamente su `element.style` tramite CSSOM (setProperty),
 * garantendo zero violazioni CSP e piena compatibilità.
 */
class CspSafeStyleMapDirective extends Directive {
  private _previousKeys?: Set<string>;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ATTRIBUTE || partInfo.name !== "style") {
      throw new Error("styleMap must be used in the style attribute");
    }
  }

  render(_styleInfo: Record<string, string | number | undefined | null>) {
    return noChange;
  }

  update(part: any, [styleInfo]: [Record<string, string | number | undefined | null>]) {
    const element = part.element as HTMLElement;
    if (!element || !element.style) return noChange;

    const style = element.style;

    // Rimuovi proprietà rimosse rispetto al render precedente
    if (this._previousKeys) {
      for (const key of this._previousKeys) {
        if (!styleInfo || !(key in styleInfo) || styleInfo[key] == null) {
          if (key.startsWith("--") || key.includes("-")) {
            style.removeProperty(key);
          } else {
            (style as any)[key] = "";
          }
        }
      }
    }

    const currentKeys = new Set<string>();
    if (styleInfo) {
      for (const [key, val] of Object.entries(styleInfo)) {
        if (val != null) {
          currentKeys.add(key);
          const valStr = String(val);
          if (key.startsWith("--") || key.includes("-")) {
            style.setProperty(key, valStr);
          } else {
            (style as any)[key] = valStr;
          }
        }
      }
    }

    this._previousKeys = currentKeys;
    return noChange;
  }
}

export const safeStyleMap = directive(CspSafeStyleMapDirective);
export const styleMap = safeStyleMap;
