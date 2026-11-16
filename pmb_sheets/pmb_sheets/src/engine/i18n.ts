/**
 * Modulo di Internazionalizzazione (i18n) delle Formule per pmb_office Fogli.
 * Gestisce:
 * 1. Mappatura bidirezionale nomi funzioni Inglese (canonico) <-> Italiano.
 * 2. Separatori di argomenti (, in EN vs ; in IT).
 * 3. Separatori decimali (. in EN vs , in IT).
 * 4. Traduzione senza perdita di informazione (lossless round-trip).
 */

export interface LocaleConfig {
  argSeparator: string;
  decimalSeparator: string;
}

export const EN_LOCALE: LocaleConfig = {
  argSeparator: ',',
  decimalSeparator: '.',
};

export const IT_LOCALE: LocaleConfig = {
  argSeparator: ';',
  decimalSeparator: ',',
};

/**
 * Dizionario bidirezionale Funzioni EN (Canonico) <-> IT.
 */
export const EN_TO_IT_FUNCTIONS: Record<string, string> = {
  'COUNTUNIQUE': 'CONTA.VALORI.UNICI',
  'SUBTOTAL': 'SUBTOTALE',
  'AGGREGATE': 'AGGREGA',
  'XIRR': 'TIR.X',
  'XNPV': 'VAN.X',
  'MIRR': 'TIR.C',
  'CUMIPMT': 'INT.CUMUL',
  'CUMPRINC': 'CAP.CUM',
  'EFFECT': 'EFFETTIVO',
  'NOMINAL': 'NOMINALE',
  'NORM.DIST': 'DISTRIB.NORM.N',
  'NORM.S.DIST': 'DISTRIB.NORM.ST.N',
  'NORM.INV': 'INV.NORM.N',
  'NORM.S.INV': 'INV.NORM.ST',
  'T.DIST': 'DISTRIB.T.N',
  'T.DIST.2T': 'DISTRIB.T.2T',
  'T.DIST.RT': 'DISTRIB.T.DS',
  'T.INV': 'INV.T',
  'T.INV.2T': 'INV.T.2T',
  'T.TEST': 'TEST.T',
  'TREND': 'TENDENZA',
  'LINEST': 'REGR.LIN',
  'AVERAGEA': 'MEDIA.VALORI',
  'MAXA': 'MAX.VALORI',
  'MINA': 'MIN.VALORI',
  'COMBINA': 'COMBINAZIONE.VALORI',
  'NETWORKDAYS.INTL': 'GIORNI.LAVORATIVI.TOT.INTL',
  'WORKDAY.INTL': 'GIORNO.LAVORATIVO.INTL',
  'ISFORMULA': 'VAL.FORMULA',
  'FORMULATEXT': 'TESTO.FORMULA',
  'CELL': 'CELLA',
  'TEXTSPLIT': 'DIVIDI.TESTO',
  'VSTACK': 'STACK.VERT',
  'HSTACK': 'STACK.ORIZ',
  'RANDARRAY': 'MATR.CASUALE',
  'MDETERM': 'MATR.DETERM',
  'MINVERSE': 'MATR.INVERSA',
  SIN: 'SEN',
  ASIN: 'ARCSEN',
  ACOS: 'ARCCOS',
  ATAN: 'ARCTAN',
  ATAN2: 'ARCTAN.2',
  SINH: 'SENH',
  ASINH: 'ARCSENH',
  ACOSH: 'ARCCOSH',
  ATANH: 'ARCTANH',
  DEGREES: 'GRADI',
  RADIANS: 'RADIANTI',
  SQRTPI: 'RADQ.PI.GRECO',
  // Matematiche & Trigonometriche
  SUM: 'SOMMA',
  PRODUCT: 'PRODOTTO',
  ABS: 'ASS',
  ROUND: 'ARROTONDA',
  ROUNDUP: 'ARROTONDA.PER.ECC',
  ROUNDDOWN: 'ARROTONDA.PER.DIF',
  INT: 'INT',
  MOD: 'RESTO',
  POWER: 'POTENZA',
  SQRT: 'RADQ',
  SIGN: 'SEGNO',
  CEILING: 'ARROTONDA.ECCESSO',
  FLOOR: 'ARROTONDA.DIFETTO',
  'CEILING.MATH': 'ARROTONDA.ECCESSO.MAT',
  'FLOOR.MATH': 'ARROTONDA.DIFETTO.MAT',
  PI: 'PI.GRECO',
  SUMIF: 'SOMMA.SE',
  SUMIFS: 'SOMMA.PIÙ.SE',
  SUMPRODUCT: 'MATR.SOMMA.PRODOTTO',
  SUMSQ: 'SOMMA.Q',
  SUMX2MY2: 'SOMMA.DIFF.Q',
  SUMX2PY2: 'SOMMA.SOMMA.Q',
  SUMXMY2: 'SOMMA.Q.DIFF',
  SERIESSUM: 'SOMMA.SERIE',
  TRUNC: 'TRONCA',
  EVEN: 'PARI',
  ODD: 'DISPARI',
  MROUND: 'ARROTONDA.MULTIPLO',
  QUOTIENT: 'QUOZIENTE',
  GCD: 'MCD',
  LCM: 'MCM',
  FACT: 'FATTORIALE',
  FACTDOUBLE: 'FATT.DOPPIO',
  COMBIN: 'COMBINAZIONE',
  PERMUT: 'PERMUTAZIONE',
  MULTINOMIAL: 'MULTINOMIALE',
  RAND: 'CASUALE',
  RANDBETWEEN: 'CASUALE.TRA',
  ROMAN: 'ROMANO',
  ARABIC: 'ARABO',
  BASE: 'BASE',
  DECIMAL: 'DECIMALE',

  // Statistiche
  AVERAGE: 'MEDIA',
  AVERAGEIF: 'MEDIA.SE',
  AVERAGEIFS: 'MEDIA.PIÙ.SE',
  MIN: 'MIN',
  MAX: 'MAX',
  COUNT: 'CONTA.NUMERI',
  COUNTA: 'CONTA.VALORI',
  COUNTBLANK: 'CONTA.VUOTE',
  COUNTIF: 'CONTA.SE',
  COUNTIFS: 'CONTA.PIÙ.SE',
  MEDIAN: 'MEDIANA',
  MODE: 'MODA',
  'MODE.SNGL': 'MODA.SNGL',
  VAR: 'VAR',
  'VAR.S': 'VAR.C',
  VARP: 'VAR.POP',
  'VAR.P': 'VAR.P',
  VARA: 'VAR.VALORI',
  VARPA: 'VAR.POP.VALORI',
  STDEV: 'DEV.ST',
  'STDEV.S': 'DEV.ST.C',
  STDEVP: 'DEV.ST.POP',
  'STDEV.P': 'DEV.ST.P',
  STDEVA: 'DEV.ST.VALORI',
  STDEVPA: 'DEV.ST.POP.VALORI',
  LARGE: 'GRANDE',
  SMALL: 'PICCOLO',
  RANK: 'RANGO',
  'RANK.EQ': 'RANGO.UG',
  'RANK.AVG': 'RANGO.MEDIA',
  PERCENTILE: 'PERCENTILE',
  'PERCENTILE.INC': 'PERCENTILE.INC',
  'PERCENTILE.EXC': 'PERCENTILE.ESC',
  QUARTILE: 'QUARTILE',
  'QUARTILE.INC': 'QUARTILE.INC',
  'QUARTILE.EXC': 'QUARTILE.ESC',
  PERCENTRANK: 'PERCENT.RANGO',
  'PERCENTRANK.INC': 'PERCENT.RANGO.INC',
  CORREL: 'CORRELAZIONE',
  PEARSON: 'PEARSON',
  'COVARIANCE.P': 'COVARIANZA.P',
  'COVARIANCE.S': 'COVARIANZA.C',
  AVEDEV: 'DEV.MED',
  GEOMEAN: 'MEDIA.GEOMETRICA',
  HARMEAN: 'MEDIA.ARMONICA',
  TRIMMEAN: 'MEDIA.TRONCATA',
  FREQUENCY: 'FREQUENZA',
  SKEW: 'ASIMMETRIA',
  KURT: 'CURTOSI',

  // Logiche
  IF: 'SE',
  IFS: 'PIÙ.SE',
  AND: 'E',
  OR: 'O',
  NOT: 'NON',
  XOR: 'XOR',
  IFERROR: 'SE.ERRORE',
  IFNA: 'SE.NON.DISP',
  TRUE: 'VERO',
  FALSE: 'FALSO',
  SWITCH: 'SWITCH',

  // Testo
  CONCAT: 'CONCAT',
  CONCATENATE: 'CONCATENA',
  LEFT: 'SINISTRA',
  RIGHT: 'DESTRA',
  MID: 'STRINGA.ESTRAI',
  LEN: 'LUNGH',
  UPPER: 'MAIUSC',
  LOWER: 'MINUSC',
  TRIM: 'ANNULLA.SPAZI',
  SUBSTITUTE: 'SOSTITUISCI',
  FIND: 'TROVA',
  SEARCH: 'RICERCA',
  VALUE: 'VALORE',
  TEXTJOIN: 'TESTO.UNISCI',
  REPT: 'RIPETI',
  PROPER: 'MAIUSC.INIZ',
  CLEAN: 'LIBERA',
  EXACT: 'IDENTICO',
  SPLIT: 'DIVIDI',
  REGEXMATCH: 'CONFRONTA.REGEXP',
  REGEXEXTRACT: 'ESTRAI.REGEXP',
  REGEXREPLACE: 'SOSTITUISCI.REGEXP',
  CHAR: 'CODICE.CARATT',
  CODE: 'CODICE',
  UNICHAR: 'CARATT.UNI',
  UNICODE: 'UNICODE',
  T: 'T',
  REPLACE: 'RIMPIAZZA',
  TEXT: 'TESTO',
  FIXED: 'FISSO',
  DOLLAR: 'VALUTA',
  NUMBERVALUE: 'NUMERO.VALORE',
  LENB: 'LUNGH.B',
  LEFTB: 'SINISTRA.B',
  RIGHTB: 'DESTRA.B',
  MIDB: 'STRINGA.ESTRAI.B',

  // Ricerca & Riferimento
  VLOOKUP: 'CERCA.VERT',
  HLOOKUP: 'CERCA.ORIZZ',
  INDEX: 'INDICE',
  MATCH: 'CONFRONTA',
  XLOOKUP: 'CERCA.X',
  XMATCH: 'CONFRONTA.X',
  CHOOSE: 'SCEGLI',
  ROW: 'RIF.RIGA',
  COLUMN: 'RIF.COLONNA',
  ROWS: 'RIGHE',
  COLUMNS: 'COLONNE',
  AREAS: 'AREE',
  HYPERLINK: 'COLLEG.IPERTESTUALE',
  ADDRESS: 'INDIRIZZO',
  LOOKUP: 'CERCA',
  OFFSET: 'SCARTO',
  INDIRECT: 'INDIRETTO',

  // Data & Ora
  DATE: 'DATA',
  YEAR: 'ANNO',
  MONTH: 'MESE',
  DAY: 'GIORNO',
  WEEKDAY: 'GIORNO.SETTIMANA',
  EDATE: 'DATA.MESE',
  TODAY: 'OGGI',
  NOW: 'ADESSO',
  TIME: 'ORARIO',
  HOUR: 'ORA',
  MINUTE: 'MINUTO',
  SECOND: 'SECONDO',
  EOMONTH: 'FINE.MESE',
  DAYS: 'GIORNI',
  DAYS360: 'GIORNO360',
  DATEDIF: 'DATA.DIFF',
  NETWORKDAYS: 'GIORNI.LAVORATIVI.TOT',
  WORKDAY: 'GIORNO.LAVORATIVO',
  ISOWEEKNUM: 'NUM.SETTIMANA.ISO',
  WEEKNUM: 'NUM.SETTIMANA',
  DATEVALUE: 'DATA.VALORE',
  TIMEVALUE: 'ORARIO.VALORE',
  YEARFRAC: 'FRAZIONE.ANNO',

  // Informazione
  ISBLANK: 'VAL.VUOTO',
  ISNUMBER: 'VAL.NUMERO',
  ISTEXT: 'VAL.TESTO',
  ISERROR: 'VAL.ERRORE',
  ISERR: 'VAL.ERR',
  ISNA: 'VAL.NON.DISP',
  ISLOGICAL: 'VAL.LOGICO',
  ISNONTEXT: 'VAL.NON.TESTO',
  ISODD: 'VAL.DISPARI',
  ISEVEN: 'VAL.PARI',
  TYPE: 'TIPO',
  'ERROR.TYPE': 'TIPO.ERRORE',
  N: 'NUM',
  NA: 'NON.DISP',
  SHEET: 'FOGLIO',
  SHEETS: 'FOGLI',

  // Finanziarie
  PMT: 'RATA',
  FV: 'VAL.FUT',
  PV: 'VA',
  NPER: 'NUM.RATE',
  IPMT: 'INTERESSI',
  PPMT: 'P.RATA',
  NPV: 'VAN',
  IRR: 'TIR.COST',
  RATE: 'TASSO',
  SLN: 'AMMORT.COST',
  SYD: 'AMMORT.ANNUO',
  DB: 'AMMORT',
  DDB: 'AMMORT.DIFF',

  // Ingegneristiche
  BIN2DEC: 'BIN.DEC',
  DEC2BIN: 'DEC.BIN',
  HEX2DEC: 'ESAD.DEC',
  DEC2HEX: 'DEC.ESAD',
  OCT2DEC: 'OTT.DEC',
  DEC2OCT: 'DEC.OTT',
  BIN2HEX: 'BIN.ESAD',
  BIN2OCT: 'BIN.OTT',
  HEX2BIN: 'ESAD.BIN',
  OCT2BIN: 'OTT.BIN',
  DELTA: 'DELTA',
  GESTEP: 'MAGGIORE.UGUALE',
  BITAND: 'BIT.AND',
  BITOR: 'BIT.OR',
  BITXOR: 'BIT.XOR',
  BITLSHIFT: 'BIT.SPOSTA.SX',
  BITRSHIFT: 'BIT.SPOSTA.DX',

  // Database
  DSUM: 'DB.SOMMA',
  DCOUNT: 'DB.CONTA.NUMERI',
  DCOUNTA: 'DB.CONTA.VALORI',
  DAVERAGE: 'DB.MEDIA',
  DMIN: 'DB.MIN',
  DMAX: 'DB.MAX',
  DPRODUCT: 'DB.PRODOTTO',
  DVAR: 'DB.VAR',
  DVARP: 'DB.VAR.POP',
  DSTDEV: 'DB.DEV.ST',
  DSTDEVP: 'DB.DEV.ST.POP',
  DGET: 'DB.VALORI',

  // Matriciali
  ARRAYFORMULA: 'FORMULA.MATRICIALE',
  SEQUENCE: 'SEQUENZA',
  TRANSPOSE: 'MATR.TRASPOSTA',
  FILTER: 'FILTRO',
  UNIQUE: 'UNICI',
  SORT: 'DATI.ORDINA',
  SORTBY: 'DATI.ORDINA.PER',
  MMULT: 'MATR.PRODOTTO',
  FLATTEN: 'APPIATTISCI',
  CHOOSEROWS: 'SCEGLI.RIGHE',
  CHOOSECOLS: 'SCEGLI.COLONNE',
  TOCOL: 'A.COL',
  TOROW: 'A.RIGA',
  TAKE: 'PRENDI',
  DROP: 'ESCLUDI',
  EXPAND: 'ESPANDI',
  WRAPROWS: 'A.CAPO.RIGA',
  WRAPCOLS: 'A.CAPO.COL',
  SLOPE: 'PENDENZA', // [T001-3]
  INTERCEPT: 'INTERCETTA',
  FORECAST: 'PREVISIONE',
  RSQ: 'RQ',
  MAXIFS: 'MAX.PIÙ.SE', // [T002-3]
  MINIFS: 'MIN.PIÙ.SE',
  CONVERT: 'CONVERTI', // [T003-3]
  SPARKLINE: 'SPARKLINE',
};

// Dizionario inverso IT -> EN (normalizzato maiuscolo)
export const IT_TO_EN_FUNCTIONS: Record<string, string> = {};
for (const [en, it] of Object.entries(EN_TO_IT_FUNCTIONS)) {
  IT_TO_EN_FUNCTIONS[it.toUpperCase()] = en;
}
// altri nomi con cui le persone le scrivono (Excel e Fogli Google in italiano usano LUNGHEZZA; "m.c.m" era il vecchio nome nella nostra tabella)
IT_TO_EN_FUNCTIONS['LUNGHEZZA'] = 'LEN';
IT_TO_EN_FUNCTIONS['SOMMA.PRODOTTO'] = 'SUMPRODUCT';
IT_TO_EN_FUNCTIONS['M.C.M'] = 'LCM';

// ---- formati di TESTO scritti all'italiana ----
// In italiano il codice di formato usa i separatori italiani ("#.##0,00") e le lettere italiane per le date ("gg/mm/aaaa"); il motore conosce solo la forma inglese
// ("#,##0.00", "dd/mm/yyyy"). Dentro TESTO(...) il testo del formato si converte, in entrambi i versi, quando si traduce la formula.
function convertiCodiceFormato(codice: string, verso: 'it-en' | 'en-it'): string {
  let out = '';
  for (let i = 0; i < codice.length; i++) {
    const ch = codice[i];
    if (ch === '"') { const fine = codice.indexOf('"', i + 1); const f = fine === -1 ? codice.length : fine + 1; out += codice.slice(i, f); i = f - 1; continue; }
    if (ch === '[') { const fine = codice.indexOf(']', i); const f = fine === -1 ? codice.length : fine + 1; out += codice.slice(i, f); i = f - 1; continue; }
    if (ch === '\\' && i + 1 < codice.length) { out += ch + codice[i + 1]; i++; continue; }
    if (/^(AM\/PM|A\/P)/i.test(codice.slice(i))) { const m = /^(AM\/PM|A\/P)/i.exec(codice.slice(i)) as RegExpExecArray; out += m[0]; i += m[0].length - 1; continue; }
    if (ch === '.') { out += ','; continue; }
    if (ch === ',') { out += '.'; continue; }
    if (verso === 'it-en') {
      if (ch === 'g' || ch === 'G') { out += ch === 'g' ? 'd' : 'D'; continue; }
      if (ch === 'a' || ch === 'A') { out += ch === 'a' ? 'y' : 'Y'; continue; }
    } else {
      if (ch === 'd' || ch === 'D') { out += ch === 'd' ? 'g' : 'G'; continue; }
      if (ch === 'y' || ch === 'Y') { out += ch === 'y' ? 'a' : 'A'; continue; }
    }
    out += ch;
  }
  return out;
}

/** Nelle chiamate a `nome(...)` della formula, se il secondo argomento è un testo tra virgolette ne converte il contenuto con `conv`. */
function convertiSecondoArgomento(formula: string, nome: string, separatore: string, conv: (testo: string) => string): string {
  const re = new RegExp(`(^|[^A-Za-z0-9_.])${nome}\\s*\\(`, 'gi');
  let out = '';
  let da = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const inizio = m.index + m[0].length;
    let profondita = 0;
    let virgolette = false;
    let startSecondo = -1;
    let fine = -1;
    for (let k = inizio; k < formula.length; k++) {
      const c = formula[k];
      if (c === '"') { virgolette = !virgolette; continue; }
      if (virgolette) continue;
      if (c === '(') profondita++;
      else if (c === ')') { if (profondita === 0) { fine = k; break; } profondita--; }
      else if (c === separatore && profondita === 0) {
        if (startSecondo === -1) startSecondo = k + 1;
        else { fine = k; break; }
      }
    }
    if (startSecondo === -1 || fine === -1) continue;
    const secondo = formula.slice(startSecondo, fine);
    const t = /^(\s*)"((?:[^"]|"")*)"(\s*)$/.exec(secondo);
    if (!t) continue;
    out += formula.slice(da, startSecondo) + t[1] + '"' + conv(t[2]) + '"' + t[3];
    da = fine;
    re.lastIndex = fine;
  }
  return out + formula.slice(da);
}

/**
 * Traduce una formula tra lingue 'it' ed 'en'.
 * Rispetta:
 * - Stringhe tra virgolette (inalterate)
 * - Nomi delle funzioni (EN <-> IT)
 * - Separatori di argomenti (, in EN <-> ; in IT)
 * - Separatori decimali (. in EN <-> , in IT)
 */
export function translateFormula(
  formula: string,
  fromLocale: 'it' | 'en',
  toLocale: 'it' | 'en'
): string {
  if (fromLocale === toLocale || !formula) {
    return formula;
  }

  // il formato di TESTO è scritto con le regole della lingua della formula: prima di tradurre va convertito (dall'italiano) o dopo (verso l'italiano)
  if (fromLocale === 'it' && toLocale === 'en') {
    formula = convertiSecondoArgomento(formula, 'TESTO', ';', (t) => convertiCodiceFormato(t, 'it-en'));
  }
  const hasLeadingEq = formula.startsWith('=');
  const body = hasLeadingEq ? formula.substring(1) : formula;

  let result = '';
  let inString = false;
  let stringChar = '';
  let i = 0;
  const len = body.length;

  while (i < len) {
    const ch = body[i];

    // Gestione stringhe letterali (es. "test; value")
    if (inString) {
      result += ch;
      if (ch === stringChar) {
        // Controllo virgolette escape raddoppiate ("")
        if (i + 1 < len && body[i + 1] === stringChar) {
          result += body[i + 1];
          i += 2;
          continue;
        }
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }

    // 1. Identificatore o nome funzione (A-Z, lettere con accento, punto o underscore)
    // Es. SOMMA.SE, CERCA.VERT, A1, B$5
    if (/[a-zA-ZÀ-ÿ_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9À-ÿ_.]/.test(body[i])) {
        ident += body[i];
        i++;
      }

      // Verifichiamo se è seguito da '(' -> è una funzione!
      let lookAhead = i;
      while (lookAhead < len && /\s/.test(body[lookAhead])) {
        lookAhead++;
      }
      const isFunctionCall = lookAhead < len && body[lookAhead] === '(';

      if (isFunctionCall) {
        const upper = ident.toUpperCase();
        if (fromLocale === 'en' && toLocale === 'it') {
          const translated = EN_TO_IT_FUNCTIONS[upper] || ident;
          result += translated;
        } else if (fromLocale === 'it' && toLocale === 'en') {
          const translated = IT_TO_EN_FUNCTIONS[upper] || ident;
          result += translated;
        } else {
          result += ident;
        }
      } else {
        // Valori letterali booleani o costanti (TRUE/FALSE <-> VERO/FALSO)
        const upper = ident.toUpperCase();
        if (fromLocale === 'en' && toLocale === 'it') {
          if (upper === 'TRUE') result += 'VERO';
          else if (upper === 'FALSE') result += 'FALSO';
          else result += ident;
        } else if (fromLocale === 'it' && toLocale === 'en') {
          if (upper === 'VERO') result += 'TRUE';
          else if (upper === 'FALSO') result += 'FALSE';
          else result += ident;
        } else {
          result += ident;
        }
      }
      continue;
    }

    // 2. Numeri decimali
    // EN: 12.34 -> IT: 12,34
    // IT: 12,34 -> EN: 12.34
    if (fromLocale === 'en' && toLocale === 'it') {
      if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (i < len && (/[0-9]/.test(body[i]) || body[i] === '.')) {
          numStr += body[i];
          i++;
        }
        // Sostituisce il punto decimale con la virgola
        result += numStr.replace(/\./g, ',');
        continue;
      }

      // Separatore argomenti: virgola in EN -> punto e virgola in IT
      if (ch === ',') {
        result += ';';
        i++;
        continue;
      }
    } else if (fromLocale === 'it' && toLocale === 'en') {
      // In IT un numero decimale può essere 12,34 (purché non preceduto/seguito da identificatori)
      if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (i < len && (/[0-9]/.test(body[i]) || body[i] === ',')) {
          // Se troviamo una virgola, assicuriamoci che sia seguita da una cifra per essere decimale
          if (body[i] === ',') {
            if (i + 1 < len && /[0-9]/.test(body[i + 1])) {
              numStr += '.';
              i++;
              continue;
            } else {
              break;
            }
          }
          numStr += body[i];
          i++;
        }
        result += numStr;
        continue;
      }

      // Separatore argomenti: punto e virgola in IT -> virgola in EN
      if (ch === ';') {
        result += ',';
        i++;
        continue;
      }
    }

    result += ch;
    i++;
  }

  const finale = (hasLeadingEq ? '=' : '') + result;
  return fromLocale === 'en' && toLocale === 'it' ? convertiSecondoArgomento(finale, 'TESTO', ';', (x) => convertiCodiceFormato(x, 'en-it')) : finale;
}
