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
import * as distribuzioni from './distribuzioni';
import * as altre from './altre-excel';
import * as complessi from './complessi';
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

    // Funzioni di Excel che mancavano (2026-11-20, confrontate con Excel installato): distribuzioni e statistiche, con i vecchi nomi
    // di Excel 2007 che i file vecchi usano ancora
    this.register('BINOM.DIST', distribuzioni.fnBINOM_DIST, ['BINOMDIST']);
    this.register('BINOM.DIST.RANGE', distribuzioni.fnBINOM_DIST_RANGE);
    this.register('BINOM.INV', distribuzioni.fnBINOM_INV, ['CRITBINOM']);
    this.register('POISSON.DIST', distribuzioni.fnPOISSON_DIST, ['POISSON']);
    this.register('CHISQ.DIST', distribuzioni.fnCHISQ_DIST);
    this.register('CHISQ.DIST.RT', distribuzioni.fnCHISQ_DIST_RT, ['CHIDIST']);
    this.register('CHISQ.INV', distribuzioni.fnCHISQ_INV);
    this.register('CHISQ.INV.RT', distribuzioni.fnCHISQ_INV_RT, ['CHIINV']);
    this.register('CHISQ.TEST', distribuzioni.fnCHISQ_TEST, ['CHITEST']);
    this.register('F.DIST', distribuzioni.fnF_DIST);
    this.register('F.DIST.RT', distribuzioni.fnF_DIST_RT, ['FDIST']);
    this.register('F.INV', distribuzioni.fnF_INV);
    this.register('F.INV.RT', distribuzioni.fnF_INV_RT, ['FINV']);
    this.register('F.TEST', distribuzioni.fnF_TEST, ['FTEST']);
    this.register('EXPON.DIST', distribuzioni.fnEXPON_DIST, ['EXPONDIST']);
    this.register('GAMMA.DIST', distribuzioni.fnGAMMA_DIST, ['GAMMADIST']);
    this.register('GAMMA.INV', distribuzioni.fnGAMMA_INV, ['GAMMAINV']);
    this.register('LOGNORM.DIST', distribuzioni.fnLOGNORM_DIST);
    this.register('LOGNORMDIST', distribuzioni.fnLOGNORMDIST);
    this.register('LOGNORM.INV', distribuzioni.fnLOGNORM_INV, ['LOGINV']);
    this.register('BETA.DIST', distribuzioni.fnBETA_DIST);
    this.register('BETADIST', distribuzioni.fnBETADIST);
    this.register('BETA.INV', distribuzioni.fnBETA_INV, ['BETAINV']);
    this.register('WEIBULL.DIST', distribuzioni.fnWEIBULL_DIST, ['WEIBULL']);
    this.register('HYPGEOM.DIST', distribuzioni.fnHYPGEOM_DIST);
    this.register('HYPGEOMDIST', distribuzioni.fnHYPGEOMDIST);
    this.register('NEGBINOM.DIST', distribuzioni.fnNEGBINOM_DIST);
    this.register('NEGBINOMDIST', distribuzioni.fnNEGBINOMDIST);
    this.register('Z.TEST', distribuzioni.fnZ_TEST, ['ZTEST']);
    this.register('CONFIDENCE.NORM', distribuzioni.fnCONFIDENCE_NORM, ['CONFIDENCE']);
    this.register('CONFIDENCE.T', distribuzioni.fnCONFIDENCE_T);
    this.register('TDIST', distribuzioni.fnTDIST);
    this.register('GAMMA', distribuzioni.fnGAMMA);
    this.register('GAMMALN', distribuzioni.fnGAMMALN, ['GAMMALN.PRECISE']);
    this.register('FISHER', distribuzioni.fnFISHER);
    this.register('FISHERINV', distribuzioni.fnFISHERINV);
    this.register('PHI', distribuzioni.fnPHI);
    this.register('GAUSS', distribuzioni.fnGAUSS);
    this.register('STANDARDIZE', distribuzioni.fnSTANDARDIZE);
    this.register('DEVSQ', distribuzioni.fnDEVSQ);
    this.register('STEYX', distribuzioni.fnSTEYX);
    this.register('PERMUTATIONA', distribuzioni.fnPERMUTATIONA);
    this.register('SKEW.P', distribuzioni.fnSKEW_P);
    this.register('PROB', distribuzioni.fnPROB);
    this.register('PERCENTRANK.EXC', distribuzioni.fnPERCENTRANK_EXC);
    this.register('ERF', distribuzioni.fnERF);
    this.register('ERF.PRECISE', distribuzioni.fnERF_PRECISE);
    this.register('ERFC', distribuzioni.fnERFC, ['ERFC.PRECISE']);
    this.register('MODE.MULT', distribuzioni.fnMODE_MULT);
    // vecchi nomi di funzioni che c'erano già con il nome nuovo
    for (const [vecchio, nuovo] of [['NORMDIST', 'NORM.DIST'], ['NORMINV', 'NORM.INV'], ['NORMSDIST', 'NORM.S.DIST'], ['NORMSINV', 'NORM.S.INV'],
      ['TINV', 'T.INV.2T'], ['TTEST', 'T.TEST'], ['COVAR', 'COVARIANCE.P'], ['FORECAST.LINEAR', 'FORECAST']] as const) {
      this.aliases.set(vecchio, nuovo);
    }
    // matematiche, finanziarie, testo
    this.register('ACOT', altre.fnACOT);
    this.register('ACOTH', altre.fnACOTH);
    this.register('COTH', altre.fnCOTH);
    this.register('CSCH', altre.fnCSCH);
    this.register('SECH', altre.fnSECH);
    this.register('CEILING.PRECISE', altre.fnCEILING_PRECISE, ['ISO.CEILING']);
    this.register('FLOOR.PRECISE', altre.fnFLOOR_PRECISE);
    this.register('MUNIT', altre.fnMUNIT);
    this.register('VDB', altre.fnVDB);
    this.register('ISPMT', altre.fnISPMT);
    this.register('FVSCHEDULE', altre.fnFVSCHEDULE);
    this.register('PDURATION', altre.fnPDURATION);
    this.register('RRI', altre.fnRRI);
    this.register('DOLLARDE', altre.fnDOLLARDE);
    this.register('DOLLARFR', altre.fnDOLLARFR);
    this.register('TEXTBEFORE', altre.fnTEXTBEFORE);
    this.register('TEXTAFTER', altre.fnTEXTAFTER);
    this.register('VALUETOTEXT', altre.fnVALUETOTEXT);
    this.register('ARRAYTOTEXT', altre.fnARRAYTOTEXT);
    // numeri complessi, Bessel, basi, ENCODEURL (2026-11-20); FINDB, SEARCHB, REPLACEB: con una lingua senza caratteri doppi sono FIND, SEARCH, REPLACE
    this.register('COMPLEX', complessi.fnCOMPLEX);
    this.register('IMABS', complessi.fnIMABS);
    this.register('IMAGINARY', complessi.fnIMAGINARY);
    this.register('IMREAL', complessi.fnIMREAL);
    this.register('IMARGUMENT', complessi.fnIMARGUMENT);
    this.register('IMCONJUGATE', complessi.fnIMCONJUGATE);
    this.register('IMSUM', complessi.fnIMSUM);
    this.register('IMSUB', complessi.fnIMSUB);
    this.register('IMPRODUCT', complessi.fnIMPRODUCT);
    this.register('IMDIV', complessi.fnIMDIV);
    this.register('IMPOWER', complessi.fnIMPOWER);
    this.register('IMSQRT', complessi.fnIMSQRT);
    this.register('IMEXP', complessi.fnIMEXP);
    this.register('IMLN', complessi.fnIMLN);
    this.register('IMLOG10', complessi.fnIMLOG10);
    this.register('IMLOG2', complessi.fnIMLOG2);
    this.register('IMSIN', complessi.fnIMSIN);
    this.register('IMCOS', complessi.fnIMCOS);
    this.register('IMTAN', complessi.fnIMTAN);
    this.register('IMSEC', complessi.fnIMSEC);
    this.register('IMCSC', complessi.fnIMCSC);
    this.register('IMCOT', complessi.fnIMCOT);
    this.register('IMSINH', complessi.fnIMSINH);
    this.register('IMCOSH', complessi.fnIMCOSH);
    this.register('IMSECH', complessi.fnIMSECH);
    this.register('IMCSCH', complessi.fnIMCSCH);
    this.register('BESSELJ', complessi.fnBESSELJ);
    this.register('BESSELY', complessi.fnBESSELY);
    this.register('BESSELI', complessi.fnBESSELI);
    this.register('BESSELK', complessi.fnBESSELK);
    this.register('HEX2OCT', complessi.fnHEX2OCT);
    this.register('OCT2HEX', complessi.fnOCT2HEX);
    this.register('ENCODEURL', complessi.fnENCODEURL);
    for (const [b, n] of [['FINDB', 'FIND'], ['SEARCHB', 'SEARCH'], ['REPLACEB', 'REPLACE']] as const) this.aliases.set(b, n);

    // Registra alias italiani (i18n)
    for (const [en, it] of Object.entries(EN_TO_IT_FUNCTIONS)) {
      // un vecchio nome (BINOMDIST) è già un alias del nuovo (BINOM.DIST): il nome italiano va alla funzione vera
      const canonical = this.aliases.get(en.toUpperCase()) ?? en.toUpperCase();
      const alias = it.toUpperCase();
      // un nome italiano non deve mai coprire il nome inglese di un'altra funzione
      if (alias !== canonical && !this.functions.has(alias)) {
        this.aliases.set(alias, canonical);
      }
    }
  }
}

export const defaultFunctionRegistry = new FunctionRegistry();
