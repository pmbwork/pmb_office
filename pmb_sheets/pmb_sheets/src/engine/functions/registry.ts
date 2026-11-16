/**
 * Registro centrale delle funzioni di calcolo.
 * Completamente disaccoppiato dal parser per supportare future localizzazioni (i18n).
 */

import { CellValue } from '../values';
import { EvalArg } from './utils';
import { FunctionContext } from './lookup';

import * as math from './math';
import * as stats from './stats';
import * as logical from './logical';
import * as text from './text';
import * as lookup from './lookup';
import * as date from './date';
import * as info from './info';
import * as financial from './financial';
import * as engineering from './engineering';
import * as database from './database';
import * as array from './array';
import * as extra from './extra';
import * as student from './student';
import * as query from './query';
import { EN_TO_IT_FUNCTIONS } from '../i18n';

export type FunctionImpl = (args: EvalArg[], context?: FunctionContext) => CellValue;

const VOLATILE_FUNCTIONS = new Set<string>([
  'NOW',
  'TODAY',
  'RAND',
  'RANDBETWEEN',
  'OFFSET',
  'INDIRECT',
  'RANDARRAY',
]);

class FunctionRegistry {
  private functions = new Map<string, FunctionImpl>();
  private aliases = new Map<string, string>();

  constructor() {
    this.registerDefaults();
  }

  public register(name: string, impl: FunctionImpl, aliasList?: string[]): void {
    const canonical = name.toUpperCase();
    this.functions.set(canonical, impl);
    if (aliasList) {
      for (const a of aliasList) {
        this.aliases.set(a.toUpperCase(), canonical);
      }
    }
  }

  public get(name: string): FunctionImpl | undefined {
    const upper = name.toUpperCase();
    const canonical = this.aliases.get(upper) || upper;
    return this.functions.get(canonical);
  }

  public has(name: string): boolean {
    const upper = name.toUpperCase();
    const canonical = this.aliases.get(upper) || upper;
    return this.functions.has(canonical);
  }

  public isVolatile(name: string): boolean {
    const upper = name.toUpperCase();
    const canonical = this.aliases.get(upper) || upper;
    return VOLATILE_FUNCTIONS.has(canonical);
  }

  public listAll(): string[] {
    return Array.from(this.functions.keys()).sort();
  }

  private registerDefaults(): void {
    // 1. Matematiche & Trigonometriche (62)
    this.register('SUM', math.fnSUM);
    this.register('PRODUCT', math.fnPRODUCT);
    this.register('ABS', math.fnABS);
    this.register('ROUND', math.fnROUND);
    this.register('ROUNDUP', math.fnROUNDUP);
    this.register('ROUNDDOWN', math.fnROUNDDOWN);
    this.register('INT', math.fnINT);
    this.register('MOD', math.fnMOD);
    this.register('POWER', math.fnPOWER);
    this.register('SQRT', math.fnSQRT);
    this.register('SIGN', math.fnSIGN);
    this.register('CEILING', math.fnCEILING);
    this.register('FLOOR', math.fnFLOOR);
    this.register('PI', math.fnPI);
    this.register('SUMIF', math.fnSUMIF);
    this.register('SUMPRODUCT', math.fnSUMPRODUCT);
    this.register('SIN', math.fnSIN);
    this.register('COS', math.fnCOS);
    this.register('TAN', math.fnTAN);
    this.register('ASIN', math.fnASIN);
    this.register('ACOS', math.fnACOS);
    this.register('ATAN', math.fnATAN);
    this.register('ATAN2', math.fnATAN2);
    this.register('SINH', math.fnSINH);
    this.register('COSH', math.fnCOSH);
    this.register('TANH', math.fnTANH);
    this.register('ASINH', math.fnASINH);
    this.register('ACOSH', math.fnACOSH);
    this.register('ATANH', math.fnATANH);
    this.register('RADIANS', math.fnRADIANS);
    this.register('DEGREES', math.fnDEGREES);
    this.register('LN', math.fnLN);
    this.register('LOG', math.fnLOG);
    this.register('LOG10', math.fnLOG10);
    this.register('EXP', math.fnEXP);
    this.register('SQRTPI', math.fnSQRTPI);
    this.register('TRUNC', math.fnTRUNC);
    this.register('EVEN', math.fnEVEN);
    this.register('ODD', math.fnODD);
    this.register('MROUND', math.fnMROUND);
    this.register('CEILING.MATH', math.fnCEILING_MATH);
    this.register('FLOOR.MATH', math.fnFLOOR_MATH);
    this.register('QUOTIENT', math.fnQUOTIENT);
    this.register('GCD', math.fnGCD);
    this.register('LCM', math.fnLCM);
    this.register('FACT', math.fnFACT);
    this.register('FACTDOUBLE', math.fnFACTDOUBLE);
    this.register('COMBIN', math.fnCOMBIN);
    this.register('PERMUT', math.fnPERMUT);
    this.register('MULTINOMIAL', math.fnMULTINOMIAL);
    this.register('SUMIFS', math.fnSUMIFS);
    this.register('SUMSQ', math.fnSUMSQ);
    this.register('SUMX2MY2', math.fnSUMX2MY2);
    this.register('SUMX2PY2', math.fnSUMX2PY2);
    this.register('SUMXMY2', math.fnSUMXMY2);
    this.register('SERIESSUM', math.fnSERIESSUM);
    this.register('RAND', math.fnRAND);
    this.register('RANDBETWEEN', math.fnRANDBETWEEN);
    this.register('ROMAN', math.fnROMAN);
    this.register('ARABIC', math.fnARABIC);
    this.register('BASE', math.fnBASE);
    this.register('DECIMAL', math.fnDECIMAL);

    // 2. Statistiche (49)
    this.register('AVERAGE', stats.fnAVERAGE);
    this.register('MIN', stats.fnMIN);
    this.register('MAX', stats.fnMAX);
    this.register('COUNT', stats.fnCOUNT);
    this.register('COUNTA', stats.fnCOUNTA);
    this.register('COUNTBLANK', stats.fnCOUNTBLANK);
    this.register('MEDIAN', stats.fnMEDIAN);
    this.register('COUNTIF', stats.fnCOUNTIF);
    this.register('AVERAGEIF', stats.fnAVERAGEIF);
    this.register('VAR', stats.fnVAR);
    this.register('VAR.S', stats.fnVAR_S);
    this.register('VARP', stats.fnVARP);
    this.register('VAR.P', stats.fnVAR_P);
    this.register('VARA', stats.fnVARA);
    this.register('VARPA', stats.fnVARPA);
    this.register('STDEV', stats.fnSTDEV);
    this.register('STDEV.S', stats.fnSTDEV_S);
    this.register('STDEVP', stats.fnSTDEVP);
    this.register('STDEV.P', stats.fnSTDEV_P);
    this.register('STDEVA', stats.fnSTDEVA);
    this.register('STDEVPA', stats.fnSTDEVPA);
    this.register('LARGE', stats.fnLARGE);
    this.register('SMALL', stats.fnSMALL);
    this.register('RANK', stats.fnRANK);
    this.register('RANK.EQ', stats.fnRANK_EQ);
    this.register('RANK.AVG', stats.fnRANK_AVG);
    this.register('PERCENTILE', stats.fnPERCENTILE);
    this.register('PERCENTILE.INC', stats.fnPERCENTILE_INC);
    this.register('PERCENTILE.EXC', stats.fnPERCENTILE_EXC);
    this.register('QUARTILE', stats.fnQUARTILE);
    this.register('QUARTILE.INC', stats.fnQUARTILE_INC);
    this.register('QUARTILE.EXC', stats.fnQUARTILE_EXC);
    this.register('PERCENTRANK', stats.fnPERCENTRANK);
    this.register('PERCENTRANK.INC', stats.fnPERCENTRANK_INC);
    this.register('CORREL', stats.fnCORREL);
    this.register('SLOPE', stats.fnSLOPE); // [T001-2]
    this.register('INTERCEPT', stats.fnINTERCEPT);
    this.register('FORECAST', stats.fnFORECAST);
    this.register('RSQ', stats.fnRSQ);
    this.register('PEARSON', stats.fnPEARSON);
    this.register('COVARIANCE.P', stats.fnCOVARIANCE_P);
    this.register('COVARIANCE.S', stats.fnCOVARIANCE_S);
    this.register('COUNTIFS', stats.fnCOUNTIFS);
    this.register('AVERAGEIFS', stats.fnAVERAGEIFS);
    this.register('MAXIFS', stats.fnMAXIFS); // [T002-2]
    this.register('MINIFS', stats.fnMINIFS);
    this.register('MODE', stats.fnMODE);
    this.register('MODE.SNGL', stats.fnMODE_SNGL);
    this.register('AVEDEV', stats.fnAVEDEV);
    this.register('GEOMEAN', stats.fnGEOMEAN);
    this.register('HARMEAN', stats.fnHARMEAN);
    this.register('TRIMMEAN', stats.fnTRIMMEAN);
    this.register('FREQUENCY', stats.fnFREQUENCY);
    this.register('SKEW', stats.fnSKEW);
    this.register('KURT', stats.fnKURT);

    // 3. Logiche (11)
    this.register('IF', logical.fnIF);
    this.register('IFS', logical.fnIFS);
    this.register('AND', logical.fnAND);
    this.register('OR', logical.fnOR);
    this.register('NOT', logical.fnNOT);
    this.register('IFERROR', logical.fnIFERROR);
    this.register('IFNA', logical.fnIFNA);
    this.register('TRUE', logical.fnTRUE);
    this.register('FALSE', logical.fnFALSE);
    this.register('SWITCH', logical.fnSWITCH);
    this.register('XOR', logical.fnXOR);

    // 4. Testo (36)
    this.register('CONCAT', text.fnCONCAT);
    this.register('CONCATENATE', text.fnCONCATENATE);
    this.register('LEFT', text.fnLEFT);
    this.register('RIGHT', text.fnRIGHT);
    this.register('MID', text.fnMID);
    this.register('LEN', text.fnLEN);
    this.register('UPPER', text.fnUPPER);
    this.register('LOWER', text.fnLOWER);
    this.register('TRIM', text.fnTRIM);
    this.register('SUBSTITUTE', text.fnSUBSTITUTE);
    this.register('FIND', text.fnFIND);
    this.register('SEARCH', text.fnSEARCH);
    this.register('VALUE', text.fnVALUE);
    this.register('TEXTJOIN', text.fnTEXTJOIN);
    this.register('REPT', text.fnREPT);
    this.register('PROPER', text.fnPROPER);
    this.register('CLEAN', text.fnCLEAN);
    this.register('EXACT', text.fnEXACT);
    this.register('SPLIT', text.fnSPLIT);
    this.register('REGEXMATCH', text.fnREGEXMATCH);
    this.register('REGEXEXTRACT', text.fnREGEXEXTRACT);
    this.register('REGEXREPLACE', text.fnREGEXREPLACE);
    this.register('CHAR', text.fnCHAR);
    this.register('CODE', text.fnCODE);
    this.register('UNICHAR', text.fnUNICHAR);
    this.register('UNICODE', text.fnUNICODE);
    this.register('T', text.fnT);
    this.register('REPLACE', text.fnREPLACE);
    this.register('TEXT', text.fnTEXT);
    this.register('FIXED', text.fnFIXED);
    this.register('DOLLAR', text.fnDOLLAR);
    this.register('NUMBERVALUE', text.fnNUMBERVALUE);
    this.register('LENB', text.fnLENB);
    this.register('LEFTB', text.fnLEFTB);
    this.register('RIGHTB', text.fnRIGHTB);
    this.register('MIDB', text.fnMIDB);

    // 5. Ricerca & Riferimento (17)
    this.register('VLOOKUP', lookup.fnVLOOKUP);
    this.register('HLOOKUP', lookup.fnHLOOKUP);
    this.register('INDEX', lookup.fnINDEX);
    this.register('MATCH', lookup.fnMATCH);
    this.register('XLOOKUP', lookup.fnXLOOKUP);
    this.register('CHOOSE', lookup.fnCHOOSE);
    this.register('ROW', lookup.fnROW);
    this.register('COLUMN', lookup.fnCOLUMN);
    this.register('COLUMNS', lookup.fnCOLUMNS);
    this.register('ROWS', lookup.fnROWS);
    this.register('AREAS', lookup.fnAREAS);
    this.register('HYPERLINK', lookup.fnHYPERLINK);
    this.register('ADDRESS', lookup.fnADDRESS);
    this.register('LOOKUP', lookup.fnLOOKUP);
    this.register('XMATCH', lookup.fnXMATCH);
    this.register('OFFSET', lookup.fnOFFSET);
    this.register('INDIRECT', lookup.fnINDIRECT);

    // 6. Data & Ora (23)
    this.register('DATE', date.fnDATE);
    this.register('YEAR', date.fnYEAR);
    this.register('MONTH', date.fnMONTH);
    this.register('DAY', date.fnDAY);
    this.register('WEEKDAY', date.fnWEEKDAY);
    this.register('EDATE', date.fnEDATE);
    this.register('TODAY', date.fnTODAY);
    this.register('NOW', date.fnNOW);
    this.register('TIME', date.fnTIME);
    this.register('HOUR', date.fnHOUR);
    this.register('MINUTE', date.fnMINUTE);
    this.register('SECOND', date.fnSECOND);
    this.register('EOMONTH', date.fnEOMONTH);
    this.register('DAYS', date.fnDAYS);
    this.register('DAYS360', date.fnDAYS360);
    this.register('DATEDIF', date.fnDATEDIF);
    this.register('NETWORKDAYS', date.fnNETWORKDAYS);
    this.register('WORKDAY', date.fnWORKDAY);
    this.register('ISOWEEKNUM', date.fnISOWEEKNUM);
    this.register('WEEKNUM', date.fnWEEKNUM);
    this.register('DATEVALUE', date.fnDATEVALUE);
    this.register('TIMEVALUE', date.fnTIMEVALUE);
    this.register('YEARFRAC', date.fnYEARFRAC);

    // 7. Informazione (16)
    this.register('ISBLANK', info.fnISBLANK);
    this.register('ISNUMBER', info.fnISNUMBER);
    this.register('ISTEXT', info.fnISTEXT);
    this.register('ISERROR', info.fnISERROR);
    this.register('ISERR', info.fnISERR);
    this.register('ISNA', info.fnISNA);
    this.register('ISLOGICAL', info.fnISLOGICAL);
    this.register('ISNONTEXT', info.fnISNONTEXT);
    this.register('ISODD', info.fnISODD);
    this.register('ISEVEN', info.fnISEVEN);
    this.register('TYPE', info.fnTYPE);
    this.register('ERROR.TYPE', info.fnERROR_TYPE);
    this.register('N', info.fnN);
    this.register('NA', info.fnNA);
    this.register('SHEET', info.fnSHEET);
    this.register('SHEETS', info.fnSHEETS);

    // 8. Finanziarie (13)
    this.register('PMT', financial.fnPMT);
    this.register('FV', financial.fnFV);
    this.register('PV', financial.fnPV);
    this.register('NPER', financial.fnNPER);
    this.register('IPMT', financial.fnIPMT);
    this.register('PPMT', financial.fnPPMT);
    this.register('NPV', financial.fnNPV);
    this.register('IRR', financial.fnIRR);
    this.register('RATE', financial.fnRATE);
    this.register('SLN', financial.fnSLN);
    this.register('SYD', financial.fnSYD);
    this.register('DB', financial.fnDB);
    this.register('DDB', financial.fnDDB);

    // 9. Ingegneristiche (17)
    this.register('BIN2DEC', engineering.fnBIN2DEC);
    this.register('DEC2BIN', engineering.fnDEC2BIN);
    this.register('HEX2DEC', engineering.fnHEX2DEC);
    this.register('DEC2HEX', engineering.fnDEC2HEX);
    this.register('CONVERT', engineering.fnCONVERT); // [T003-2]
    this.register('OCT2DEC', engineering.fnOCT2DEC);
    this.register('DEC2OCT', engineering.fnDEC2OCT);
    this.register('BIN2HEX', engineering.fnBIN2HEX);
    this.register('BIN2OCT', engineering.fnBIN2OCT);
    this.register('HEX2BIN', engineering.fnHEX2BIN);
    this.register('OCT2BIN', engineering.fnOCT2BIN);
    this.register('DELTA', engineering.fnDELTA);
    this.register('GESTEP', engineering.fnGESTEP);
    this.register('BITAND', engineering.fnBITAND);
    this.register('BITOR', engineering.fnBITOR);
    this.register('BITXOR', engineering.fnBITXOR);
    this.register('BITLSHIFT', engineering.fnBITLSHIFT);
    this.register('BITRSHIFT', engineering.fnBITRSHIFT);

    // 10. Database (12)
    this.register('DSUM', database.fnDSUM);
    this.register('DCOUNT', database.fnDCOUNT);
    this.register('DCOUNTA', database.fnDCOUNTA);
    this.register('DAVERAGE', database.fnDAVERAGE);
    this.register('DMIN', database.fnDMIN);
    this.register('DMAX', database.fnDMAX);
    this.register('DPRODUCT', database.fnDPRODUCT);
    this.register('DVAR', database.fnDVAR);
    this.register('DVARP', database.fnDVARP);
    this.register('DSTDEV', database.fnDSTDEV);
    this.register('DSTDEVP', database.fnDSTDEVP);
    this.register('DGET', database.fnDGET);

    // 11. Matriciali e Array dinamici (19)
    this.register('ARRAYFORMULA', array.fnARRAYFORMULA);
    this.register('FORMULA.MATRICIALE', array.fnARRAYFORMULA);
    this.register('SEQUENCE', array.fnSEQUENCE);
    this.register('TRANSPOSE', array.fnTRANSPOSE);
    this.register('FILTER', array.fnFILTER);
    this.register('UNIQUE', array.fnUNIQUE);
    this.register('SORT', array.fnSORT);
    this.register('SORTBY', array.fnSORTBY);
    this.register('MMULT', array.fnMMULT);
    this.register('FLATTEN', array.fnFLATTEN);
    this.register('CHOOSEROWS', array.fnCHOOSEROWS);
    this.register('CHOOSECOLS', array.fnCHOOSECOLS);
    this.register('TOCOL', array.fnTOCOL);
    this.register('TOROW', array.fnTOROW);
    this.register('TAKE', array.fnTAKE);
    this.register('DROP', array.fnDROP);
    this.register('EXPAND', array.fnEXPAND);
    this.register('WRAPROWS', array.fnWRAPROWS);
    this.register('WRAPCOLS', array.fnWRAPCOLS);
    this.register('SPARKLINE', array.fnSPARKLINE);

    // 12. Funzioni aggiunte: statistiche, riepiloghi, finanza, calendario, matrici
    this.register('COUNTUNIQUE', extra.fnCOUNTUNIQUE);
    this.register('AVERAGEA', extra.fnAVERAGEA);
    this.register('MAXA', extra.fnMAXA);
    this.register('MINA', extra.fnMINA);
    this.register('COMBINA', extra.fnCOMBINA);
    this.register('NORM.DIST', extra.fnNORM_DIST);
    this.register('NORM.S.DIST', extra.fnNORM_S_DIST);
    this.register('NORM.INV', extra.fnNORM_INV);
    this.register('NORM.S.INV', extra.fnNORM_S_INV);
    this.register('T.DIST', student.fnT_DIST);
    this.register('T.DIST.2T', student.fnT_DIST_2T);
    this.register('T.DIST.RT', student.fnT_DIST_RT);
    this.register('T.INV', student.fnT_INV);
    this.register('T.INV.2T', student.fnT_INV_2T);
    this.register('T.TEST', student.fnT_TEST);
    this.register('QUERY', query.fnQUERY);
    this.register('LINEST', extra.fnLINEST);
    this.register('TREND', extra.fnTREND);
    this.register('SUBTOTAL', (args, ctx) => extra.fnSUBTOTAL(args, (n) => this.get(n) as never, ctx));
    this.register('AGGREGATE', (args, ctx) => extra.fnAGGREGATE(args, (n) => this.get(n) as never, ctx));
    this.register('XNPV', extra.fnXNPV);
    this.register('XIRR', extra.fnXIRR);
    this.register('MIRR', extra.fnMIRR);
    this.register('CUMIPMT', extra.fnCUMIPMT);
    this.register('CUMPRINC', extra.fnCUMPRINC);
    this.register('EFFECT', extra.fnEFFECT);
    this.register('NOMINAL', extra.fnNOMINAL);
    this.register('NETWORKDAYS.INTL', extra.fnNETWORKDAYS_INTL);
    this.register('WORKDAY.INTL', extra.fnWORKDAY_INTL);
    this.register('VSTACK', extra.fnVSTACK);
    this.register('HSTACK', extra.fnHSTACK);
    this.register('TEXTSPLIT', extra.fnTEXTSPLIT);
    this.register('RANDARRAY', extra.fnRANDARRAY);
    this.register('MDETERM', extra.fnMDETERM);
    this.register('MINVERSE', extra.fnMINVERSE);
    this.register('SEC', extra.fnSEC);
    this.register('CSC', extra.fnCSC);
    this.register('COT', extra.fnCOT);

    // Registra alias italiani (i18n)
    for (const [en, it] of Object.entries(EN_TO_IT_FUNCTIONS)) {
      const canonical = en.toUpperCase();
      const alias = it.toUpperCase();
      if (alias !== canonical) {
        this.aliases.set(alias, canonical);
      }
    }
  }
}

export const defaultFunctionRegistry = new FunctionRegistry();
