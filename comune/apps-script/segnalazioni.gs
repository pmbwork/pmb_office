/**
 * Servizio di ricezione di bug e feedback di pmb_office (pmb_docs e pmb_sheets).
 * Va pubblicato come «Applicazione web» dall'account che deve ricevere i messaggi:
 *   Esegui come: me  ·  Chi ha accesso: Chiunque.
 * Riceve un POST con JSON (inviato come text/plain per evitare la richiesta di verifica CORS) e lo inoltra per email
 * a chi ha pubblicato il servizio. Nell'app non c'è nessuna password: solo l'indirizzo pubblico di questo servizio.
 * Difese contro gli abusi: campo trappola, lunghezze massime, elenco dei programmi ammessi, nessun doppione negli ultimi 10 minuti,
 * tetto globale di 15 messaggi all'ora e margine sulla quota giornaliera di Gmail (un abuso non deve consumare le email del giorno:
 * gli account gratuiti ne hanno circa 100, e 30 all'ora ne avrebbero consumate 720).
 */
/**
 * Prova manuale: si lancia dall'editor di Apps Script (menu «Esegui») dopo aver scelto questa funzione.
 * Serve a concedere il permesso di invio posta la prima volta e a leggere l'errore vero se qualcosa non va.
 */
function provaInvio() {
  var destinatario = Session.getEffectiveUser().getEmail();
  console.log('Destinatario: ' + destinatario);
  MailApp.sendEmail({ to: destinatario, subject: '[pmb_office] prova del servizio segnalazioni', body: 'Se leggi questa mail, il servizio può inviare posta.' });
  console.log('Invio riuscito');
}

var PROGRAMMI = ['pmb_docs', 'pmb_sheets'];
var MAX_TESTO = 4000;
var MIN_TESTO = 10;
var MAX_ORA = 15;
/** invii giornalieri da tenere sempre liberi: sotto questa soglia il servizio risponde «riprova domani» */
var MARGINE_GIORNO = 10;

function rispondi_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return rispondi_({ ok: true, servizio: 'pmb_office segnalazioni' });
}

function pulisci_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
}

function impronta_(app, testo) {
  return 'm_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, app + '|' + testo)).slice(0, 40);
}

function doPost(e) {
  try {
    var dati = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (dati.sito) return rispondi_({ ok: true }); // campo trappola: un robot lo riempie, un utente no; finge di aver accettato
    var app = pulisci_(dati.app, 20);
    var testo = pulisci_(dati.testo, MAX_TESTO + 1);
    if (PROGRAMMI.indexOf(app) < 0) return rispondi_({ ok: false, errore: 'programma non valido' });
    if (testo.length < MIN_TESTO) return rispondi_({ ok: false, errore: 'messaggio troppo corto' });
    if (testo.length > MAX_TESTO) return rispondi_({ ok: false, errore: 'messaggio troppo lungo' });
    var versione = pulisci_(dati.versione, 20).replace(/[^0-9A-Za-z._-]/g, '');
    var contatto = pulisci_(dati.contatto, 200).replace(/[\r\n]+/g, ' ').trim();
    var sistema = pulisci_(dati.sistema, 300).replace(/[\r\n]+/g, ' ');

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var cache = CacheService.getScriptCache();
      var ora = Number(cache.get('conteggio_ora') || 0);
      if (ora >= MAX_ORA) return rispondi_({ ok: false, errore: 'troppi messaggi, riprova più tardi' });
      if (MailApp.getRemainingDailyQuota() <= MARGINE_GIORNO) return rispondi_({ ok: false, errore: 'troppi messaggi oggi, riprova domani' });
      var impronta = impronta_(app, testo);
      if (cache.get(impronta)) return rispondi_({ ok: true }); // doppione: già ricevuto
    } finally {
      lock.releaseLock();
    }

    var corpo = testo + '\n\n---\n' +
      'Programma: ' + app + ' ' + versione + '\n' +
      (dati.includiDati ? 'Sistema: ' + (sistema || 'non indicato') + '\n' : 'Dati tecnici: non inclusi dall\'utente\n') +
      'Contatto indicato: ' + (contatto || 'nessuno') + '\n';
    var opzioni = { to: Session.getEffectiveUser().getEmail(), subject: '[pmb_office] ' + app + ' ' + versione + ': segnalazione', body: corpo, name: 'pmb_office segnalazioni' };
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contatto)) opzioni.replyTo = contatto;
    MailApp.sendEmail(opzioni);
    // segna come ricevuto SOLO dopo l'invio riuscito: se l'invio fallisce, il messaggio si può rimandare subito
    var cache2 = CacheService.getScriptCache();
    cache2.put(impronta_(app, testo), '1', 600);
    cache2.put('conteggio_ora', String(Number(cache2.get('conteggio_ora') || 0) + 1), 3600);
    return rispondi_({ ok: true });
  } catch (err) {
    console.error('doPost: ' + err + (err && err.stack ? ' | ' + err.stack : ''));
    return rispondi_({ ok: false, errore: 'errore del servizio' });
  }
}
