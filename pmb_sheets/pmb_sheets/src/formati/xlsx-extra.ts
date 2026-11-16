// Parti di un file .xlsx oltre a celle e stili: convalide dei dati, formattazioni condizionali, commenti e nomi definiti.
// Scrittura e lettura stanno qui insieme così le due direzioni restano uguali. Puro: testo XML in entrata e in uscita.
import { elemento, escapaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import { MAX_COLS, MAX_ROWS, parseCellAddress } from '../engine/address';
import type { DataValidationRule, ValidationOperator } from '../sheet/data-validation';
import type { ConditionalFormatRule, Soglia, SoglieRegola, TipoSoglia } from '../sheet/conditional-format';

// le soglie delle scale di colore e delle barre dati: <cfvo type="min|max|num|percent|percentile" val="..."/>
const CFVO_SCRIVI: Record<TipoSoglia, string> = { min: 'min', max: 'max', numero: 'num', percentuale: 'percent', percentile: 'percentile' };
const CFVO_LEGGI: Record<string, TipoSoglia> = { min: 'min', max: 'max', num: 'numero', percent: 'percentuale', percentile: 'percentile' };
function cfvo(s: Soglia | undefined, predefinita: Soglia): string {
  const x = s ?? predefinita;
  return elemento('cfvo', x.tipo === 'min' || x.tipo === 'max' ? { type: CFVO_SCRIVI[x.tipo] } : { type: CFVO_SCRIVI[x.tipo], val: x.valore ?? 0 });
}
/** Una soglia letta dal file; undefined se è quella di partenza o se non si sa leggere (per esempio una formula). */
function leggiCfvo(n: NodoXml | undefined, predefinita: Soglia): Soglia | undefined {
  const tipo = n ? CFVO_LEGGI[n.attributi.type ?? ''] : undefined;
  if (!tipo || tipo === 'min' || tipo === 'max') return undefined;
  const v = Number(n!.attributi.val);
  if (!Number.isFinite(v)) return undefined;
  if (tipo === predefinita.tipo && v === predefinita.valore) return undefined;
  return { tipo, valore: v };
}
function soglieLette(min: Soglia | undefined, mid: Soglia | undefined, max: Soglia | undefined): { soglie?: SoglieRegola } {
  const s: SoglieRegola = { ...(min ? { min } : {}), ...(mid ? { mid } : {}), ...(max ? { max } : {}) };
  return Object.keys(s).length > 0 ? { soglie: s } : {};
}
import type { CommentoScambio, ConvalidaScambio, FiltroScambio, FoglioScambio, NomeScambio } from './scambio';
import { indirizzoCella } from './scambio';
import { urlAmmesso } from '../sheet/link';

const elenco = (n: NodoXml | undefined, nome: string): NodoXml[] => (n ? figliElemento(n, nome) : []);
const intero = (v: number, min: number, max: number): boolean => Number.isInteger(v) && v >= min && v <= max;
const argb = (c: string | undefined): string | undefined => (c !== undefined && /^#[0-9a-fA-F]{6}$/.test(c) ? `FF${c.slice(1).toUpperCase()}` : undefined);
const daArgb = (rgb: string | undefined): string | undefined => {
  if (rgb !== undefined && /^[0-9a-fA-F]{8}$/.test(rgb)) return `#${rgb.slice(2).toLowerCase()}`;
  if (rgb !== undefined && /^[0-9a-fA-F]{6}$/.test(rgb)) return `#${rgb.toLowerCase()}`;
  return undefined;
};
const numeroOTesto = (v: string | number | undefined): string => (typeof v === 'number' ? String(v) : v === undefined ? '' : /^[+-]?\d+(\.\d+)?$/.test(v.trim()) ? v.trim() : `"${v.replace(/"/g, '""')}"`);

// ---- area di celle ("A1:C3" o "A1")

interface Area { startRow: number; endRow: number; startCol: number; endCol: number }
export function leggiArea(testo: string): Area | null {
  const t = testo.replace(/\$/g, '');
  const parti = t.split(':');
  if (parti.length > 2) return null;
  const a = parseCellAddress(parti[0]);
  const b = parseCellAddress(parti[parti.length - 1]);
  if (!a || !b || !intero(a.row, 1, MAX_ROWS) || !intero(b.row, 1, MAX_ROWS) || !intero(a.col, 1, MAX_COLS) || !intero(b.col, 1, MAX_COLS)) return null;
  return { startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) };
}
const scriviArea = (a: Area): string => (a.startRow === a.endRow && a.startCol === a.endCol ? indirizzoCella(a.startRow, a.startCol) : `${indirizzoCella(a.startRow, a.startCol)}:${indirizzoCella(a.endRow, a.endCol)}`);

// ---- convalide dei dati

const OPERATORI_SCRITTURA: Record<string, string> = {
  between: 'between', not_between: 'notBetween', equal_to: 'equal', not_equal_to: 'notEqual',
  greater_than: 'greaterThan', greater_equal: 'greaterThanOrEqual', less_than: 'lessThan', less_equal: 'lessThanOrEqual',
};
const OPERATORI_LETTURA: Record<string, ValidationOperator> = Object.fromEntries(Object.entries(OPERATORI_SCRITTURA).map(([k, v]) => [v, k as ValidationOperator]));

/** Celle con la stessa regola riunite in intervalli (una riga alla volta: "A1:C1 A2:C2"). */
function intervalliDiCelle(celle: Array<{ r: number; c: number }>): string {
  const perRiga = new Map<number, number[]>();
  for (const { r, c } of celle) perRiga.set(r, [...(perRiga.get(r) ?? []), c]);
  const parti: string[] = [];
  for (const [r, colonne] of [...perRiga].sort((x, y) => x[0] - y[0])) {
    const ordinate = [...new Set(colonne)].sort((x, y) => x - y);
    let inizio = ordinate[0];
    let prec = inizio;
    for (const c of [...ordinate.slice(1), Infinity]) {
      if (c !== prec + 1) { parti.push(scriviArea({ startRow: r, endRow: r, startCol: inizio, endCol: prec })); inizio = c; }
      prec = c;
    }
  }
  return parti.join(' ');
}

export function convalideXml(f: FoglioScambio): string[] {
  const gruppi = new Map<string, { regola: DataValidationRule; celle: Array<{ r: number; c: number }> }>();
  for (const v of f.convalide ?? []) {
    const { id: _id, ...senzaId } = v.regola;
    const chiave = JSON.stringify(senzaId);
    const g = gruppi.get(chiave) ?? { regola: v.regola, celle: [] };
    for (let r = v.intervallo.startRow; r <= v.intervallo.endRow; r++) for (let c = v.intervallo.startCol; c <= v.intervallo.endCol; c++) g.celle.push({ r, c });
    gruppi.set(chiave, g);
  }
  const voci: string[] = [];
  for (const { regola, celle } of gruppi.values()) {
    const sqref = intervalliDiCelle(celle);
    const operatore = OPERATORI_SCRITTURA[regola.operator ?? 'between'] ?? 'between';
    let tipo: string;
    let formule: string[] = [];
    switch (regola.type) {
      case 'list': {
        tipo = 'list';
        const voce = regola.listRange
          ? (regola.listRange.startsWith('=') ? regola.listRange : `=${regola.listRange}`)
          : (regola.listItems && regola.listItems.length > 0
              ? `"${regola.listItems.join(',').replace(/"/g, '""')}"`
              : String(regola.value1 ?? ''));
        formule = [voce];
        break;
      }
      case 'checkbox': tipo = 'list'; formule = ['"TRUE,FALSE"']; break;
      case 'number': tipo = 'decimal'; formule = [numeroOTesto(regola.value1), ...(operatore === 'between' || operatore === 'notBetween' ? [numeroOTesto(regola.value2)] : [])]; break;
      case 'date': tipo = 'date'; formule = [numeroOTesto(regola.value1), ...(operatore === 'between' || operatore === 'notBetween' ? [numeroOTesto(regola.value2)] : [])]; break;
      case 'text_length': tipo = 'textLength'; formule = [numeroOTesto(regola.value1), ...(operatore === 'between' || operatore === 'notBetween' ? [numeroOTesto(regola.value2)] : [])]; break;
      case 'custom': tipo = 'custom'; formule = [String(regola.value1 ?? '').replace(/^=/, '')]; break;
      default: continue;
    }
    if (formule.some((x) => x === '')) continue;
    voci.push(elemento('dataValidation', {
      type: tipo, operator: tipo === 'list' || tipo === 'custom' ? undefined : operatore, allowBlank: regola.allowEmpty === false ? undefined : 1,
      showInputMessage: regola.helpText ? 1 : undefined, showErrorMessage: 1, errorStyle: regola.action === 'warn' ? 'warning' : undefined,
      promptTitle: undefined, prompt: regola.helpText, sqref,
    }, formule.map((x, i) => elemento(`formula${i + 1}`, {}, [escapaXml(x)]))));
  }
  return voci.length > 0 ? [elemento('dataValidations', { count: voci.length }, voci)] : [];
}

export function leggiConvalide(radice: NodoXml): ConvalidaScambio[] {
  const out: ConvalidaScambio[] = [];
  for (const v of elenco(trova(radice, 'dataValidations'), 'dataValidation')) {
    const tipoFile = v.attributi.type ?? 'none';
    const f1 = trova(v, 'formula1') ? testoXml(trova(v, 'formula1') as NodoXml).trim() : '';
    const f2 = trova(v, 'formula2') ? testoXml(trova(v, 'formula2') as NodoXml).trim() : '';
    const valore = (t: string): string | number => (t !== '' && Number.isFinite(Number(t)) ? Number(t) : t.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const regola: Partial<DataValidationRule> = {
      // celle vuote ammesse è la regola di base: nel modello si scrive solo il caso contrario
      ...(v.attributi.allowBlank === '1' || v.attributi.allowBlank === 'true' ? {} : { allowEmpty: false }),
      action: v.attributi.errorStyle === 'warning' || v.attributi.errorStyle === 'information' ? 'warn' : 'reject',
    };
    if (v.attributi.prompt) regola.helpText = v.attributi.prompt;
    const operatore = OPERATORI_LETTURA[v.attributi.operator ?? 'between'] ?? 'between';
    if (tipoFile === 'list') {
      regola.type = 'list';
      if (/^".*"$/.test(f1)) {
        regola.listItems = f1.slice(1, -1).replace(/""/g, '"').split(',').map((x) => x.trim()).filter((x) => x !== '');
      } else {
        regola.value1 = f1;
        regola.listRange = f1.replace(/^=/, '');
      }
    } else if (tipoFile === 'whole' || tipoFile === 'decimal') { regola.type = 'number'; regola.operator = operatore; regola.value1 = valore(f1); if (f2 !== '') regola.value2 = valore(f2); }
    else if (tipoFile === 'date') { regola.type = 'date'; regola.operator = operatore; regola.value1 = valore(f1); if (f2 !== '') regola.value2 = valore(f2); }
    else if (tipoFile === 'textLength') { regola.type = 'text_length'; regola.operator = operatore; regola.value1 = valore(f1); if (f2 !== '') regola.value2 = valore(f2); }
    else if (tipoFile === 'custom') { regola.type = 'custom'; regola.value1 = f1; }
    else continue;
    for (const rif of (v.attributi.sqref ?? '').split(/\s+/).filter((x) => x !== '')) {
      const area = leggiArea(rif);
      if (area) out.push({ intervallo: area, regola: { id: '', ...regola } as DataValidationRule });
    }
  }
  return out;
}

// ---- formattazioni condizionali

type StileCondizionale = NonNullable<ConditionalFormatRule['style']>;

/** Un elemento `dxf` (stile differenziale): font e riempimento della regola. */
export function dxfXml(stile: StileCondizionale | undefined): string {
  const font = stile && (stile.bold || stile.italic || stile.underline || stile.textColor)
    ? [elemento('font', {}, [...(stile.bold ? ['<b/>'] : []), ...(stile.italic ? ['<i/>'] : []), ...(stile.underline ? ['<u/>'] : []), ...(argb(stile.textColor) ? [elemento('color', { rgb: argb(stile.textColor) })] : [])])]
    : [];
  const colore = argb(stile?.backgroundColor);
  const riempimento = colore ? [elemento('fill', {}, [elemento('patternFill', { patternType: 'solid' }, [elemento('fgColor', { rgb: colore }), elemento('bgColor', { rgb: colore })])])] : [];
  return elemento('dxf', {}, [...font, ...riempimento]);
}

export function leggiDxfs(stili: NodoXml | undefined): StileCondizionale[] {
  return elenco(trova(stili ?? ({ nome: '', attributi: {}, figli: [] } as NodoXml), 'dxfs'), 'dxf').map((d) => {
    const s: StileCondizionale = {};
    const font = trova(d, 'font');
    if (font) {
      const acceso = (n: NodoXml | undefined) => n !== undefined && n.attributi.val !== '0' && n.attributi.val !== 'false';
      if (acceso(trova(font, 'b'))) s.bold = true;
      if (acceso(trova(font, 'i'))) s.italic = true;
      const u = trova(font, 'u');
      if (u && u.attributi.val !== 'none') s.underline = true;
      const c = daArgb(trova(font, 'color')?.attributi.rgb);
      if (c) s.textColor = c;
    }
    const motivo = trova(d, 'fill/patternFill');
    if (motivo) {
      const c = daArgb(trova(motivo, 'bgColor')?.attributi.rgb) ?? daArgb(trova(motivo, 'fgColor')?.attributi.rgb);
      if (c) s.backgroundColor = c;
    }
    return s;
  });
}

const OPERATORI_CF_SCRITTURA = OPERATORI_SCRITTURA;
const OPERATORI_CF_LETTURA = OPERATORI_LETTURA as Record<string, string>;

const virgolette = (t: string) => `"${t.replace(/"/g, '""')}"`;

export function condizionaliXml(f: FoglioScambio, dxf: (s: StileCondizionale | undefined) => number): string[] {
  const out: string[] = [];
  let priorita = 1;
  for (const r of f.condizionali ?? []) {
    const area = r.range;
    if (!(intero(area.startRow, 1, MAX_ROWS) && intero(area.endRow, 1, MAX_ROWS) && intero(area.startCol, 1, MAX_COLS) && intero(area.endCol, 1, MAX_COLS))) continue;
    const sqref = scriviArea(area);
    const cima = indirizzoCella(area.startRow, area.startCol);
    let regola: string | null = null;
    if (r.type === 'cell_value') {
      const op = OPERATORI_CF_SCRITTURA[r.operator ?? 'greater_than'];
      if (op && r.value1 !== undefined) {
        const doppio = op === 'between' || op === 'notBetween';
        if (!doppio || r.value2 !== undefined) {
          regola = elemento('cfRule', { type: 'cellIs', dxfId: dxf(r.style), priority: priorita, operator: op },
            [elemento('formula', {}, [escapaXml(numeroOTesto(r.value1))]), ...(doppio ? [elemento('formula', {}, [escapaXml(numeroOTesto(r.value2))])] : [])]);
        }
      }
    } else if (r.type === 'text') {
      const q = String(r.value1 ?? '');
      const op = r.operator ?? 'contains';
      const base = { dxfId: dxf(r.style), priority: priorita };
      if (op === 'contains' && q !== '') regola = elemento('cfRule', { type: 'containsText', ...base, operator: 'containsText', text: q }, [elemento('formula', {}, [escapaXml(`NOT(ISERROR(SEARCH(${virgolette(q)},${cima})))`)])]);
      else if (op === 'not_contains' && q !== '') regola = elemento('cfRule', { type: 'notContainsText', ...base, operator: 'notContains', text: q }, [elemento('formula', {}, [escapaXml(`ISERROR(SEARCH(${virgolette(q)},${cima}))`)])]);
      else if (op === 'starts_with' && q !== '') regola = elemento('cfRule', { type: 'beginsWith', ...base, operator: 'beginsWith', text: q }, [elemento('formula', {}, [escapaXml(`LEFT(${cima},LEN(${virgolette(q)}))=${virgolette(q)}`)])]);
      else if (op === 'ends_with' && q !== '') regola = elemento('cfRule', { type: 'endsWith', ...base, operator: 'endsWith', text: q }, [elemento('formula', {}, [escapaXml(`RIGHT(${cima},LEN(${virgolette(q)}))=${virgolette(q)}`)])]);
      else if (op === 'empty') regola = elemento('cfRule', { type: 'containsBlanks', ...base }, [elemento('formula', {}, [escapaXml(`LEN(TRIM(${cima}))=0`)])]);
      else if (op === 'not_empty') regola = elemento('cfRule', { type: 'notContainsBlanks', ...base }, [elemento('formula', {}, [escapaXml(`LEN(TRIM(${cima}))>0`)])]);
    } else if (r.type === 'formula' && r.value1 !== undefined && String(r.value1).trim() !== '') {
      regola = elemento('cfRule', { type: 'expression', dxfId: dxf(r.style), priority: priorita }, [elemento('formula', {}, [escapaXml(String(r.value1).replace(/^=/, ''))])]);
    } else if (r.type === 'color_scale' && r.colorScale) {
      const { minColor, midColor, maxColor } = r.colorScale;
      const colori = [minColor, ...(midColor ? [midColor] : []), maxColor].map((c) => argb(c));
      if (colori.every((c) => c !== undefined)) {
        regola = elemento('cfRule', { type: 'colorScale', priority: priorita }, [elemento('colorScale', {}, [
          cfvo(r.colorScale.soglie?.min, { tipo: 'min' }), ...(midColor ? [cfvo(r.colorScale.soglie?.mid, { tipo: 'percentile', valore: 50 })] : []), cfvo(r.colorScale.soglie?.max, { tipo: 'max' }),
          ...colori.map((c) => elemento('color', { rgb: c })),
        ])]);
      }
    } else if (r.type === 'data_bar' && r.dataBar) {
      const colore = argb(r.dataBar.color);
      if (colore !== undefined) {
        regola = elemento('cfRule', { type: 'dataBar', priority: priorita }, [elemento('dataBar', {}, [
          cfvo(r.dataBar.soglie?.min, { tipo: 'min' }), cfvo(r.dataBar.soglie?.max, { tipo: 'max' }), elemento('color', { rgb: colore }),
        ])]);
      }
    } else if (r.type === 'icon_set' && r.iconSet) {
      // tre fasce uguali dell'intervallo, come quelle che disegna la griglia
      regola = elemento('cfRule', { type: 'iconSet', priority: priorita }, [elemento('iconSet', { iconSet: r.iconSet.type === 'arrows' ? '3Arrows' : '3TrafficLights1' }, [
        elemento('cfvo', { type: 'percent', val: 0 }), elemento('cfvo', { type: 'percent', val: 33 }), elemento('cfvo', { type: 'percent', val: 67 }),
      ])]);
    }
    if (regola) { out.push(elemento('conditionalFormatting', { sqref }, [regola])); priorita++; }
  }
  return out;
}

export function leggiCondizionali(radice: NodoXml, dxfs: StileCondizionale[]): { regole: ConditionalFormatRule[]; nonImportate: number } {
  const regole: ConditionalFormatRule[] = [];
  let nonImportate = 0;
  for (const blocco of elenco(radice, 'conditionalFormatting')) {
    const aree = (blocco.attributi.sqref ?? '').split(/\s+/).map(leggiArea).filter((a): a is Area => a !== null);
    for (const cf of elenco(blocco, 'cfRule')) {
      const stile = cf.attributi.dxfId !== undefined ? dxfs[Number(cf.attributi.dxfId)] : undefined;
      const formule = elenco(cf, 'formula').map((x) => testoXml(x).trim());
      const numero = (t: string | undefined): number | undefined => (t !== undefined && t !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined);
      let base: Omit<ConditionalFormatRule, 'id' | 'range'> | null = null;
      const tipo = cf.attributi.type;
      if (tipo === 'cellIs') {
        const op = OPERATORI_CF_LETTURA[cf.attributi.operator ?? ''];
        const v1 = numero(formule[0]);
        const v2 = numero(formule[1]);
        if (op && v1 !== undefined && (v2 !== undefined || (op !== 'between' && op !== 'not_between'))) base = { type: 'cell_value', operator: op, value1: v1, ...(v2 !== undefined ? { value2: v2 } : {}), style: stile };
      } else if (tipo === 'containsText' || tipo === 'notContainsText' || tipo === 'beginsWith' || tipo === 'endsWith') {
        const testo = cf.attributi.text;
        const operatore = { containsText: 'contains', notContainsText: 'not_contains', beginsWith: 'starts_with', endsWith: 'ends_with' }[tipo];
        if (testo !== undefined) base = { type: 'text', operator: operatore, value1: testo, style: stile };
      } else if (tipo === 'containsBlanks') base = { type: 'text', operator: 'empty', style: stile };
      else if (tipo === 'notContainsBlanks') base = { type: 'text', operator: 'not_empty', style: stile };
      else if (tipo === 'expression' && formule[0]) base = { type: 'formula', value1: `=${formule[0]}`, style: stile };
      else if (tipo === 'colorScale') {
        const scala = trova(cf, 'colorScale');
        const colori = elenco(scala, 'color').map((c) => daArgb(c.attributi.rgb));
        if (scala && (colori.length === 2 || colori.length === 3) && colori.every((c) => c !== undefined)) {
          const v = elenco(scala, 'cfvo');
          const tre = colori.length === 3;
          const soglie = soglieLette(leggiCfvo(v[0], { tipo: 'min' }), tre ? leggiCfvo(v[1], { tipo: 'percentile', valore: 50 }) : undefined, leggiCfvo(v[tre ? 2 : 1], { tipo: 'max' }));
          base = { type: 'color_scale', colorScale: { ...(tre ? { minColor: colori[0]!, midColor: colori[1]!, maxColor: colori[2]! } : { minColor: colori[0]!, maxColor: colori[1]! }), ...soglie } };
        }
      } else if (tipo === 'dataBar') {
        const barra = trova(cf, 'dataBar');
        const colore = barra ? daArgb(trova(barra, 'color')?.attributi.rgb) : undefined;
        if (barra && colore !== undefined) {
          const v = elenco(barra, 'cfvo');
          base = { type: 'data_bar', dataBar: { color: colore, ...soglieLette(leggiCfvo(v[0], { tipo: 'min' }), undefined, leggiCfvo(v[1], { tipo: 'max' })) } };
        }
      } else if (tipo === 'iconSet') {
        // si leggono solo i due set che la griglia sa disegnare; le soglie diverse dalle tre fasce uguali non si importano
        const nome = trova(cf, 'iconSet')?.attributi.iconSet ?? '3TrafficLights1';
        if (nome === '3Arrows' || nome === '3ArrowsGray') base = { type: 'icon_set', iconSet: { type: 'arrows' } };
        else if (nome === '3TrafficLights1' || nome === '3TrafficLights2') base = { type: 'icon_set', iconSet: { type: 'traffic_lights' } };
      }
      if (!base || aree.length === 0) { nonImportate++; continue; }
      if (base.style === undefined) delete (base as { style?: unknown }).style;
      for (const area of aree) regole.push({ id: '', range: { ...area }, ...JSON.parse(JSON.stringify(base)) } as ConditionalFormatRule);
    }
  }
  return { regole, nonImportate };
}

// ---- commenti

export function commentiXml(f: FoglioScambio): string | null {
  const commenti = (f.commenti ?? []).filter((c) => intero(c.riga, 1, MAX_ROWS) && intero(c.colonna, 1, MAX_COLS));
  if (commenti.length === 0) return null;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${elemento('comments', { xmlns: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main' }, [
    elemento('authors', {}, [elemento('author', {}, ['pmb_sheets'])]),
    elemento('commentList', {}, commenti.map((c) => elemento('comment', { ref: indirizzoCella(c.riga, c.colonna), authorId: 0 }, [
      elemento('text', {}, [elemento('r', {}, [elemento('t', { 'xml:space': 'preserve' }, [escapaXml(c.testo)])])]),
    ]))),
  ])}`;
}

/** Il disegno "legacy" (VML) che Excel vuole per mostrare le note: una forma nascosta per commento. */
export function vmlCommentiXml(f: FoglioScambio): string {
  const commenti = (f.commenti ?? []).filter((c) => intero(c.riga, 1, MAX_ROWS) && intero(c.colonna, 1, MAX_COLS));
  const forme = commenti.map((c, i) => {
    const r = c.riga - 1;
    const col = c.colonna - 1;
    return `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:5pt;width:140pt;height:60pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${col + 1}, 15, ${r}, 2, ${col + 3}, 15, ${r + 4}, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${r}</x:Row><x:Column>${col}</x:Column></x:ClientData></v:shape>`;
  });
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${forme.join('')}</xml>`;
}

export function leggiCommenti(radice: NodoXml | undefined): CommentoScambio[] {
  const out: CommentoScambio[] = [];
  for (const c of elenco(trova(radice ?? ({ nome: '', attributi: {}, figli: [] } as NodoXml), 'commentList'), 'comment')) {
    const coord = c.attributi.ref !== undefined ? parseCellAddress(c.attributi.ref) : null;
    const testoNodo = trova(c, 'text');
    if (!coord || !testoNodo) continue;
    let testo = '';
    for (const p of testoNodo.figli) {
      if (typeof p === 'string') continue;
      if (p.nome === 't') testo += testoXml(p);
      else if (p.nome === 'r') { const t = trova(p, 't'); if (t) testo += testoXml(t); }
    }
    if (testo.trim() !== '') out.push({ riga: coord.row, colonna: coord.col, testo });
  }
  return out;
}

// ---- link (collegamenti ipertestuali)

export interface CollegamentoFoglio { ref: string; url: string }

/** I link di un foglio, uno per cella (stanno nello stile della cella), in ordine di riga e colonna. */
export function collegamentiFoglio(f: FoglioScambio): CollegamentoFoglio[] {
  const out: Array<CollegamentoFoglio & { r: number; c: number }> = [];
  for (const [a, st] of Object.entries(f.stili)) {
    const coord = parseCellAddress(a);
    if (!coord || !intero(coord.row, 1, MAX_ROWS) || !intero(coord.col, 1, MAX_COLS)) continue;
    if (typeof st.link === 'string' && st.link !== '' && urlAmmesso(st.link)) out.push({ ref: indirizzoCella(coord.row, coord.col), url: st.link, r: coord.row, c: coord.col });
  }
  return out.sort((x, y) => x.r - y.r || x.c - y.c).map(({ ref, url }) => ({ ref, url }));
}

/** L'elemento `hyperlinks` del foglio: gli indirizzi stanno nelle relazioni del foglio (rIdL1, rIdL2, ...). */
export function collegamentiXml(links: CollegamentoFoglio[]): string[] {
  if (links.length === 0) return [];
  return [elemento('hyperlinks', {}, links.map((l, i) => elemento('hyperlink', { ref: l.ref, 'r:id': `rIdL${i + 1}` })))];
}

/** Le relazioni dei link di un foglio, da unire a quelle degli altri contenuti del foglio. */
export function relazioniCollegamenti(links: CollegamentoFoglio[], tipo: string): string[] {
  return links.map((l, i) => elemento('Relationship', { Id: `rIdL${i + 1}`, Type: tipo, Target: l.url, TargetMode: 'External' }));
}

/** Legge i link esterni di un foglio: `destinazioni` dice, per ogni id di relazione, l'indirizzo a cui punta. Restituisce i link ammessi e quanti ne ha scartati
 *  (link dentro il file, indirizzi non ammessi). */
export function leggiCollegamenti(radice: NodoXml | undefined, destinazioni: Map<string, string>): { link: Array<{ riga: number; colonna: number; url: string }>; scartati: number } {
  const link: Array<{ riga: number; colonna: number; url: string }> = [];
  let scartati = 0;
  if (!radice) return { link, scartati };
  for (const h of elenco(trova(radice, 'hyperlinks'), 'hyperlink')) {
    const id = h.attributi['r:id'];
    const url = id !== undefined ? destinazioni.get(id) : undefined;
    const area = h.attributi.ref !== undefined ? leggiArea(h.attributi.ref) : null;
    if (url === undefined || !urlAmmesso(url) || area === null) { scartati++; continue; }
    if ((area.endRow - area.startRow + 1) * (area.endCol - area.startCol + 1) > 1000) { scartati++; continue; }
    for (let r = area.startRow; r <= area.endRow; r++) for (let c = area.startCol; c <= area.endCol; c++) link.push({ riga: r, colonna: c, url });
  }
  return { link, scartati };
}

// ---- nomi definiti

const quota = (foglio: string): string => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(foglio) ? foglio : `'${foglio.replace(/'/g, "''")}'`);
const assoluto = (rif: string): string => rif.replace(/\$/g, '').split(':').map((x) => x.replace(/^([A-Za-z]+)(\d+)$/, '$$$1$$$2')).join(':');

/** I nomi definiti; `filtri` aggiunge per ogni foglio con un filtro automatico il nome nascosto _xlnm._FilterDatabase che Excel vuole accanto. */
export function nomiXml(nomi: NomeScambio[], nomiFoglioNelFile: Map<string, string>, filtri: Array<{ indice: number; foglio: string; area: Area }> = []): string[] {
  const voci = nomi.filter((n) => nomiFoglioNelFile.has(n.foglio) && leggiArea(n.riferimento) !== null)
    .map((n) => elemento('definedName', { name: n.nome }, [escapaXml(`${quota(nomiFoglioNelFile.get(n.foglio) as string)}!${assoluto(n.riferimento)}`)]));
  for (const f of filtri) {
    const rif = `${indirizzoCella(f.area.startRow, f.area.startCol)}:${indirizzoCella(f.area.endRow, f.area.endCol)}`;
    voci.push(elemento('definedName', { name: '_xlnm._FilterDatabase', localSheetId: f.indice, hidden: 1 }, [escapaXml(`${quota(f.foglio)}!${assoluto(rif)}`)]));
  }
  return voci.length > 0 ? [elemento('definedNames', {}, voci)] : [];
}

// ---- filtro automatico

/** Il filtro del foglio come autoFilter di Excel: la tabella e, per colonna, i valori spuntati (una cella vuota spuntata è blank="1"). */
export function autoFiltroXml(f: FoglioScambio): string[] {
  const filtro = f.filtro;
  if (!filtro) return [];
  const a = filtro.area;
  const colonne = filtro.colonne
    .filter((c) => c.valori && c.col >= a.startCol && c.col <= a.endCol)
    .sort((x, y) => x.col - y.col)
    .map((c) => elemento('filterColumn', { colId: c.col - a.startCol }, [elemento('filters', c.valori!.includes('') ? { blank: 1 } : {}, c.valori!.filter((v) => v !== '').map((v) => elemento('filter', { val: v })))]));
  return [elemento('autoFilter', { ref: `${indirizzoCella(a.startRow, a.startCol)}:${indirizzoCella(a.endRow, a.endCol)}` }, colonne)];
}

/** Il filtro automatico letto dal file: la tabella e i valori spuntati; i criteri che il programma non sa rappresentare (condizioni, colori, primi 10...) si contano. */
export function leggiAutoFiltro(radice: NodoXml): { filtro?: FiltroScambio; nonImportati: number } {
  const af = trova(radice, 'autoFilter');
  const area = af ? leggiArea(af.attributi.ref ?? '') : null;
  if (!af || !area) return { nonImportati: af ? 1 : 0 };
  let nonImportati = 0;
  const colonne: FiltroScambio['colonne'] = [];
  for (const fc of elenco(af, 'filterColumn')) {
    const id = Number(fc.attributi.colId);
    if (!Number.isInteger(id) || id < 0 || area.startCol + id > area.endCol) { nonImportati++; continue; }
    const filters = trova(fc, 'filters');
    const altri = fc.figli.filter((x): x is NodoXml => typeof x !== 'string' && x.nome !== 'filters');
    if (!filters || altri.length > 0 || elenco(filters, 'dateGroupItem').length > 0) { nonImportati++; continue; }
    const valori = elenco(filters, 'filter').map((x) => x.attributi.val ?? '');
    if (filters.attributi.blank === '1' || filters.attributi.blank === 'true') valori.push('');
    colonne.push({ col: area.startCol + id, valori });
  }
  return { filtro: { area, colonne }, nonImportati };
}

/** I nomi definiti semplici (un solo intervallo di un foglio del file); gli altri restano fuori e si contano. */
export function leggiNomi(cartella: NodoXml, nomiFoglio: string[]): { nomi: NomeScambio[]; nonImportati: number } {
  const nomi: NomeScambio[] = [];
  let nonImportati = 0;
  for (const n of elenco(trova(cartella, 'definedNames'), 'definedName')) {
    const nome = n.attributi.name ?? '';
    if (nome.startsWith('_xlnm.') || n.attributi.localSheetId !== undefined) { if (!nome.startsWith('_xlnm.')) nonImportati++; continue; }
    const testo = testoXml(n).trim();
    const m = /^(?:'((?:[^']|'')+)'|([^'!]+))!(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/.exec(testo);
    const foglio = m ? (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]) : undefined;
    if (!m || foglio === undefined || !nomiFoglio.includes(foglio) || leggiArea(m[3]) === null || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nome)) { nonImportati++; continue; }
    nomi.push({ nome, foglio, riferimento: m[3].replace(/\$/g, '') });
  }
  return { nomi, nonImportati };
}
