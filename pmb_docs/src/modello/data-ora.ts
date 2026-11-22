// Inserisci › Data e ora (come «Data e ora» di Word e «Campo › Data» di LibreOffice): la data e l'ora di adesso in vari formati, da
// mettere nel testo come testo (non si aggiornano da sole). In italiano o in inglese, come l'interfaccia. Modulo puro.
const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const GIORNI_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** I formati della data e dell'ora di d, dal più usato. */
export function formatiDataOra(d: Date, inglese = false): string[] {
  const due = (x: number): string => String(x).padStart(2, '0');
  const g = d.getDate(), m = d.getMonth(), a = d.getFullYear(), gs = d.getDay();
  const ora = `${due(d.getHours())}:${due(d.getMinutes())}`;
  if (inglese) {
    return [`${due(m + 1)}/${due(g)}/${a}`, `${MESI_EN[m]} ${g}, ${a}`, `${GIORNI_EN[gs]}, ${MESI_EN[m]} ${g}, ${a}`, `${g} ${MESI_EN[m]} ${a}`, `${a}-${due(m + 1)}-${due(g)}`, ora, `${due(m + 1)}/${due(g)}/${a} ${ora}`];
  }
  return [`${due(g)}/${due(m + 1)}/${a}`, `${g} ${MESI_IT[m]} ${a}`, `${GIORNI_IT[gs]} ${g} ${MESI_IT[m]} ${a}`, `${due(g)}/${due(m + 1)}/${String(a).slice(2)}`, `${a}-${due(m + 1)}-${due(g)}`, ora, `${due(g)}/${due(m + 1)}/${a} ${ora}`];
}
