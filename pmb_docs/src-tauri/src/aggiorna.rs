//! Aggiornamento di pmb_docs da un file (`.pmbup`) firmato.
//!
//! Il file contiene il nuovo installer e una firma digitale (Ed25519) fatta con la chiave privata di PMB. Il programma la controlla con la chiave
//! pubblica che ha dentro (`chiave_pubblica.rs`): senza la chiave privata nessuno può costruire un aggiornamento che il programma accetti.
//!
//! Formato del file:
//! ```text
//! "PMBUP1\n" (7 byte) | lunghezza dell'intestazione (u32, little endian) | intestazione (JSON UTF-8) | firma (64 byte, sull'intestazione) | installer
//! ```
//! L'intestazione dice a quale programma serve (`app`), la `versione`, le `note`, la `dimensione` e lo `sha256` dell'installer: la firma
//! copre l'intestazione, e l'intestazione lega l'installer con dimensione e impronta, quindi cambiare un solo byte invalida il pacchetto.

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;

use crate::chiave_pubblica::CHIAVE_PUBBLICA;

const MAGIC: &[u8; 7] = b"PMBUP1\n";
const MAX_INTESTAZIONE: usize = 16 * 1024;
const MAX_INSTALLER: usize = 300 * 1024 * 1024;
const PROGRAMMA: &str = "pmb_docs";

#[derive(Deserialize)]
struct Intestazione {
    app: String,
    versione: String,
    #[serde(default)]
    note: String,
    /// le stesse note in inglese (facoltative: i pacchetti più vecchi non le hanno, i programmi più vecchi le ignorano)
    #[serde(default)]
    note_en: String,
    dimensione: usize,
    sha256: String,
}

/// Un pacchetto di aggiornamento già controllato (firma, programma, dimensione, impronta).
pub struct Pacchetto {
    pub versione: String,
    pub note: String,
    pub note_en: String,
    pub installer: Vec<u8>,
}

/// Perché un file non è accettato. I codici arrivano all'interfaccia, che li traduce.
#[derive(Debug, PartialEq, Eq)]
pub enum Errore {
    NonPacchetto,
    Danneggiato,
    FirmaNonValida,
    AltroProgramma,
    VersioneNonValida,
}

impl Errore {
    pub fn codice(&self) -> &'static str {
        match self {
            Errore::NonPacchetto => "NON_PACCHETTO",
            Errore::Danneggiato => "DANNEGGIATO",
            Errore::FirmaNonValida => "FIRMA_NON_VALIDA",
            Errore::AltroProgramma => "ALTRO_PROGRAMMA",
            Errore::VersioneNonValida => "VERSIONE_NON_VALIDA",
        }
    }
}

fn esadecimale(byte: &[u8]) -> String {
    byte.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Legge e controlla un pacchetto. La firma si verifica PRIMA di guardare l'intestazione: dati non firmati non si interpretano.
pub fn leggi(byte: &[u8], chiave: &[u8; 32]) -> Result<Pacchetto, Errore> {
    if byte.len() < MAGIC.len() + 4 + 64 || &byte[..MAGIC.len()] != MAGIC {
        return Err(Errore::NonPacchetto);
    }
    let lunghezza = u32::from_le_bytes(byte[7..11].try_into().map_err(|_| Errore::Danneggiato)?) as usize;
    if lunghezza == 0 || lunghezza > MAX_INTESTAZIONE || 11 + lunghezza + 64 > byte.len() {
        return Err(Errore::Danneggiato);
    }
    let intestazione = &byte[11..11 + lunghezza];
    let firma_byte: [u8; 64] = byte[11 + lunghezza..11 + lunghezza + 64].try_into().map_err(|_| Errore::Danneggiato)?;
    let installer = &byte[11 + lunghezza + 64..];

    let verificatore = VerifyingKey::from_bytes(chiave).map_err(|_| Errore::FirmaNonValida)?;
    verificatore.verify(intestazione, &Signature::from_bytes(&firma_byte)).map_err(|_| Errore::FirmaNonValida)?;

    let h: Intestazione = serde_json::from_slice(intestazione).map_err(|_| Errore::Danneggiato)?;
    if h.app != PROGRAMMA {
        return Err(Errore::AltroProgramma);
    }
    if !versione_valida(&h.versione) {
        return Err(Errore::VersioneNonValida);
    }
    if installer.is_empty() || installer.len() > MAX_INSTALLER || installer.len() != h.dimensione {
        return Err(Errore::Danneggiato);
    }
    if esadecimale(&Sha256::digest(installer)) != h.sha256.to_lowercase() {
        return Err(Errore::Danneggiato);
    }
    Ok(Pacchetto { versione: h.versione, note: h.note.chars().take(2000).collect(), note_en: h.note_en.chars().take(2000).collect(), installer: installer.to_vec() })
}

fn versione_valida(v: &str) -> bool {
    let parti: Vec<&str> = v.split('.').collect();
    (1..=4).contains(&parti.len()) && parti.iter().all(|p| !p.is_empty() && p.len() <= 6 && p.chars().all(|c| c.is_ascii_digit()))
}

fn numeri(v: &str) -> Vec<u64> {
    v.split('.').map(|p| p.parse::<u64>().unwrap_or(0)).collect()
}

/// true se `nuova` è una versione più recente di `attuale` (confronto numerico: 0.10.0 > 0.9.0).
pub fn piu_nuova(nuova: &str, attuale: &str) -> bool {
    let (mut a, mut b) = (numeri(nuova), numeri(attuale));
    let n = a.len().max(b.len());
    a.resize(n, 0);
    b.resize(n, 0);
    a > b
}

/// Il pacchetto controllato in attesa che l'utente confermi l'installazione.
#[derive(Default)]
pub struct StatoAggiornamento(pub Mutex<Option<Pacchetto>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoAggiornamento {
    pub versione_attuale: String,
    pub versione_nuova: String,
    pub note: String,
    pub note_en: String,
    pub piu_nuova: bool,
}

/// Legge il file scelto dall'utente (i byte grezzi del file), lo controlla e lo tiene in attesa. Non installa niente.
#[tauri::command]
pub fn aggiornamento_leggi(app: tauri::AppHandle, richiesta: tauri::ipc::Request<'_>, stato: tauri::State<'_, StatoAggiornamento>) -> Result<InfoAggiornamento, String> {
    let tauri::ipc::InvokeBody::Raw(byte) = richiesta.body() else { return Err(Errore::NonPacchetto.codice().to_string()) };
    let pacchetto = leggi(byte, &CHIAVE_PUBBLICA).map_err(|e| e.codice().to_string())?;
    let attuale = app.package_info().version.to_string();
    let info = InfoAggiornamento { versione_attuale: attuale.clone(), versione_nuova: pacchetto.versione.clone(), note: pacchetto.note.clone(), note_en: pacchetto.note_en.clone(), piu_nuova: piu_nuova(&pacchetto.versione, &attuale) };
    *stato.0.lock().map_err(|_| "ERRORE".to_string())? = if info.piu_nuova { Some(pacchetto) } else { None };
    Ok(info)
}

/// Avvia l'installer del pacchetto in attesa (con richiesta di permessi di amministratore, in modalità aggiornamento: salta le domande, mostra
/// l'avanzamento, riapre il programma) e chiude il programma perché l'installer possa sostituire i file.
#[tauri::command]
pub fn aggiornamento_installa(app: tauri::AppHandle, stato: tauri::State<'_, StatoAggiornamento>) -> Result<(), String> {
    // sul device portatile non si installa niente nel PC ospite: si aggiorna sostituendo la cartella del programma
    if crate::portatile() { return Err("NON_SUPPORTATO".to_string()); }
    let pacchetto = stato.0.lock().map_err(|_| "ERRORE".to_string())?.take().ok_or_else(|| "NESSUN_PACCHETTO".to_string())?;
    if !piu_nuova(&pacchetto.versione, &app.package_info().version.to_string()) {
        return Err("NON_PIU_NUOVO".to_string());
    }
    let cartella = std::env::temp_dir().join(format!("pmb_docs_aggiornamento_{}", std::process::id()));
    std::fs::create_dir_all(&cartella).map_err(|_| "SCRITTURA".to_string())?;
    let file = cartella.join("pmb_docs-aggiornamento-setup.exe");
    std::fs::write(&file, &pacchetto.installer).map_err(|_| "SCRITTURA".to_string())?;
    lancia_come_amministratore(&file, "/P /UPDATE /R")?;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        app.exit(0);
    });
    Ok(())
}

#[cfg(windows)]
fn lancia_come_amministratore(file: &std::path::Path, argomenti: &str) -> Result<(), String> {
    use windows::core::{w, HSTRING};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let esito = unsafe { ShellExecuteW(None, w!("runas"), &HSTRING::from(file.as_os_str()), &HSTRING::from(argomenti), None, SW_SHOWNORMAL) };
    // più di 32 = avviato; altrimenti l'utente ha rifiutato la richiesta di permessi o l'avvio è fallito
    if (esito.0 as isize) > 32 { Ok(()) } else { Err("ANNULLATO".to_string()) }
}

#[cfg(not(windows))]
fn lancia_come_amministratore(_file: &std::path::Path, _argomenti: &str) -> Result<(), String> {
    Err("NON_SUPPORTATO".to_string())
}

/// Toglie dal disco gli installer lasciati da aggiornamenti precedenti (se sono ancora in uso non si riesce: pazienza).
pub fn pulisci_vecchi() {
    if let Ok(voci) = std::fs::read_dir(std::env::temp_dir()) {
        for v in voci.flatten() {
            if v.file_name().to_string_lossy().starts_with("pmb_docs_aggiornamento_") {
                let _ = std::fs::remove_dir_all(v.path());
            }
        }
    }
}

#[cfg(test)]
mod prove {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn chiavi() -> (SigningKey, [u8; 32]) {
        let privata = SigningKey::from_bytes(&[7u8; 32]);
        let pubblica = privata.verifying_key().to_bytes();
        (privata, pubblica)
    }

    fn pacchetto(privata: &SigningKey, app: &str, versione: &str, installer: &[u8]) -> Vec<u8> {
        let intestazione = format!(
            "{{\"app\":\"{}\",\"versione\":\"{}\",\"note\":\"Novità\",\"dimensione\":{},\"sha256\":\"{}\"}}",
            app, versione, installer.len(), esadecimale(&Sha256::digest(installer))
        );
        let firma = privata.sign(intestazione.as_bytes());
        let mut v = MAGIC.to_vec();
        v.extend_from_slice(&(intestazione.len() as u32).to_le_bytes());
        v.extend_from_slice(intestazione.as_bytes());
        v.extend_from_slice(&firma.to_bytes());
        v.extend_from_slice(installer);
        v
    }

    #[test]
    fn accetta_un_pacchetto_valido() {
        let (privata, pubblica) = chiavi();
        let p = leggi(&pacchetto(&privata, "pmb_docs", "0.2.0", b"installer finto"), &pubblica).unwrap();
        assert_eq!((p.versione.as_str(), p.note.as_str(), p.note_en.as_str(), p.installer.as_slice()), ("0.2.0", "Novità", "", &b"installer finto"[..]));
    }

    #[test]
    fn legge_le_note_in_inglese() {
        let (privata, pubblica) = chiavi();
        let installer = b"installer finto";
        let intestazione = format!("{{\"app\":\"pmb_docs\",\"versione\":\"0.2.0\",\"note\":\"Novità\",\"note_en\":\"What's new\",\"dimensione\":{},\"sha256\":\"{}\"}}", installer.len(), esadecimale(&Sha256::digest(installer)));
        let firma = privata.sign(intestazione.as_bytes());
        let mut v = MAGIC.to_vec();
        v.extend_from_slice(&(intestazione.len() as u32).to_le_bytes());
        v.extend_from_slice(intestazione.as_bytes());
        v.extend_from_slice(&firma.to_bytes());
        v.extend_from_slice(installer);
        let p = leggi(&v, &pubblica).unwrap();
        assert_eq!((p.note.as_str(), p.note_en.as_str()), ("Novità", "What's new"));
    }

    #[test]
    fn rifiuta_file_che_non_sono_pacchetti() {
        let (_, pubblica) = chiavi();
        assert_eq!(leggi(b"", &pubblica).err(), Some(Errore::NonPacchetto));
        assert_eq!(leggi(&[0u8; 200], &pubblica).err(), Some(Errore::NonPacchetto));
        assert_eq!(leggi(b"MZ\x90\x00 un file exe qualunque, non un pacchetto di aggiornamento, abbastanza lungo da superare le soglie minime", &pubblica).err(), Some(Errore::NonPacchetto));
    }

    #[test]
    fn rifiuta_la_firma_di_un_altro() {
        let (_, pubblica) = chiavi();
        let altra = SigningKey::from_bytes(&[9u8; 32]);
        assert_eq!(leggi(&pacchetto(&altra, "pmb_docs", "0.2.0", b"x"), &pubblica).err(), Some(Errore::FirmaNonValida));
    }

    #[test]
    fn un_solo_byte_cambiato_invalida_il_pacchetto() {
        let (privata, pubblica) = chiavi();
        let buono = pacchetto(&privata, "pmb_docs", "0.2.0", b"installer finto con qualche byte");
        // nell'installer: l'impronta non torna
        let mut a = buono.clone(); let n = a.len(); a[n - 3] ^= 1;
        assert_eq!(leggi(&a, &pubblica).err(), Some(Errore::Danneggiato));
        // nell'intestazione: la firma non torna
        let mut b = buono.clone(); b[20] ^= 1;
        assert_eq!(leggi(&b, &pubblica).err(), Some(Errore::FirmaNonValida));
        // nella firma
        let mut c = buono.clone(); let k = 11 + u32::from_le_bytes(buono[7..11].try_into().unwrap()) as usize; c[k + 5] ^= 1;
        assert_eq!(leggi(&c, &pubblica).err(), Some(Errore::FirmaNonValida));
        // troncato
        for fine in [12usize, 30, 80, buono.len() - 1] { assert!(leggi(&buono[..fine], &pubblica).is_err()); }
    }

    #[test]
    fn rifiuta_un_pacchetto_per_un_altro_programma_o_con_versione_strana() {
        let (privata, pubblica) = chiavi();
        assert_eq!(leggi(&pacchetto(&privata, "pmb_sheets", "0.2.0", b"x"), &pubblica).err(), Some(Errore::AltroProgramma));
        for v in ["", "a.b", "1..2", "1.2.3.4.5", "0.2.0-beta", "9999999.1"] {
            assert_eq!(leggi(&pacchetto(&privata, "pmb_docs", v, b"x"), &pubblica).err(), Some(Errore::VersioneNonValida), "{}", v);
        }
    }

    #[test]
    fn confronta_le_versioni_come_numeri() {
        assert!(piu_nuova("0.2.0", "0.1.0"));
        assert!(piu_nuova("0.10.0", "0.9.0"));
        assert!(piu_nuova("1.0", "0.9.9"));
        assert!(piu_nuova("0.1.0.1", "0.1.0"));
        assert!(!piu_nuova("0.1.0", "0.1.0"));
        assert!(!piu_nuova("0.1", "0.1.0"));
        assert!(!piu_nuova("0.0.9", "0.1.0"));
    }
}
