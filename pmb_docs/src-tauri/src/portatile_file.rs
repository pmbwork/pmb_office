// File e cartelle per la finestra «Apri / Salva con nome» interna della versione pocket (comune/src/file-portatile.ts).
// Sul device portatile (AI_PRO) le finestre di Windows non si usano: Windows annoterebbe nel PC ospite gli ultimi file e cartelle
// (Elementi recenti, registro). Qui il programma legge e scrive da sé, senza passare dalla shell di Windows, quindi niente resta sul PC.
// Tutti i comandi funzionano SOLO in modalità portatile (crate::portatile()); altrimenti rispondono NON_PORTATILE.
// Lo stesso file c'è in pmb_sheets/pmb_sheets/src-tauri/src/portatile_file.rs: tenerli uguali.

use serde::Serialize;
use std::path::{Path, PathBuf};

/// Un file oltre questa dimensione non si apre (i programmi non ne gestiscono di più grandi).
const DIMENSIONE_MASSIMA: u64 = 100 * 1024 * 1024;
/// Quante voci si mostrano al massimo in una cartella (una cartella enorme non deve bloccare la finestra).
const VOCI_MASSIME: usize = 5000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Voce {
    pub nome: String,
    pub cartella: bool,
    pub dimensione: u64,
    /// millisecondi dal 1970 (0 se non si sa)
    pub modificato: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Elenco {
    /// il percorso completo e normalizzato della cartella
    pub cartella: String,
    /// la cartella sopra (vuoto alla radice di un'unità)
    pub sopra: String,
    pub voci: Vec<Voce>,
    /// true se le voci erano più di VOCI_MASSIME e se ne mostra solo una parte
    pub troncato: bool,
}

fn solo_portatile() -> Result<(), String> {
    if crate::portatile() { Ok(()) } else { Err("NON_PORTATILE".to_string()) }
}

/// Un percorso accettato: completo (con l'unità), senza caratteri di controllo e non troppo lungo.
fn percorso(p: &str) -> Result<PathBuf, String> {
    if p.is_empty() || p.len() > 4000 || p.chars().any(|c| c.is_control()) { return Err("PERCORSO_NON_VALIDO".to_string()); }
    let pb = PathBuf::from(p);
    if !pb.is_absolute() { return Err("PERCORSO_NON_VALIDO".to_string()); }
    Ok(pb)
}

fn millisecondi(t: std::io::Result<std::time::SystemTime>) -> u64 {
    t.ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Le unità presenti (C:\, F:\ ...), per la casella «Unità» della finestra.
#[tauri::command]
pub fn portatile_unita() -> Result<Vec<String>, String> {
    solo_portatile()?;
    Ok((b'A'..=b'Z').map(|l| format!("{}:\\", l as char)).filter(|u| Path::new(u).is_dir()).collect())
}

/// Le cartelle e i file di una cartella: prima le cartelle, poi i file, in ordine alfabetico. I file nascosti o di sistema non si mostrano.
#[tauri::command]
pub fn portatile_elenca(cartella: String) -> Result<Elenco, String> {
    solo_portatile()?;
    let dir = percorso(&cartella)?;
    let lettura = std::fs::read_dir(&dir).map_err(|e| format!("CARTELLA: {e}"))?;
    let mut voci = Vec::new();
    let mut troncato = false;
    for v in lettura.flatten() {
        if voci.len() >= VOCI_MASSIME { troncato = true; break; }
        let nome = v.file_name().to_string_lossy().into_owned();
        let Ok(meta) = v.metadata() else { continue };
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const NASCOSTO: u32 = 0x2;
            const SISTEMA: u32 = 0x4;
            if meta.file_attributes() & (NASCOSTO | SISTEMA) != 0 { continue; }
        }
        if nome.starts_with('$') { continue; } // $RECYCLE.BIN e simili
        voci.push(Voce { nome, cartella: meta.is_dir(), dimensione: if meta.is_dir() { 0 } else { meta.len() }, modificato: millisecondi(meta.modified()) });
    }
    voci.sort_by(|a, b| b.cartella.cmp(&a.cartella).then_with(|| a.nome.to_lowercase().cmp(&b.nome.to_lowercase())));
    let sopra = dir.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Elenco { cartella: dir.to_string_lossy().into_owned(), sopra, voci, troncato })
}

/// I byte di un file (fino a 100 MB).
#[tauri::command]
pub fn portatile_leggi(percorso_file: String) -> Result<tauri::ipc::Response, String> {
    solo_portatile()?;
    let p = percorso(&percorso_file)?;
    let meta = std::fs::metadata(&p).map_err(|e| format!("FILE: {e}"))?;
    if !meta.is_file() { return Err("NON_E_UN_FILE".to_string()); }
    if meta.len() > DIMENSIONE_MASSIMA { return Err("TROPPO_GRANDE".to_string()); }
    std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| format!("FILE: {e}"))
}

/// Scrive un file: i byte arrivano grezzi, il percorso nell'intestazione «percorso» (codificato come in un indirizzo web).
/// Si scrive prima un file temporaneo accanto e poi lo si rinomina: un errore a metà non rovina il file che c'era.
#[tauri::command]
pub fn portatile_scrivi(richiesta: tauri::ipc::Request<'_>) -> Result<(), String> {
    solo_portatile()?;
    let tauri::ipc::InvokeBody::Raw(byte) = richiesta.body() else { return Err("DATI_MANCANTI".to_string()) };
    let codificato = richiesta.headers().get("percorso").and_then(|v| v.to_str().ok()).ok_or_else(|| "PERCORSO_MANCANTE".to_string())?;
    let p = percorso(&decodifica(codificato)?)?;
    if p.is_dir() { return Err("E_UNA_CARTELLA".to_string()); }
    let cartella = p.parent().ok_or_else(|| "PERCORSO_NON_VALIDO".to_string())?;
    if !cartella.is_dir() { return Err("CARTELLA_MANCANTE".to_string()); }
    let nome = p.file_name().ok_or_else(|| "PERCORSO_NON_VALIDO".to_string())?.to_string_lossy().into_owned();
    let temporaneo = cartella.join(format!(".{nome}.pmb-salvataggio"));
    std::fs::write(&temporaneo, byte).map_err(|e| format!("SCRITTURA: {e}"))?;
    std::fs::rename(&temporaneo, &p).map_err(|e| { let _ = std::fs::remove_file(&temporaneo); format!("SCRITTURA: {e}") })
}

/// Crea una cartella nuova dentro una cartella esistente.
#[tauri::command]
pub fn portatile_nuova_cartella(cartella: String, nome: String) -> Result<String, String> {
    solo_portatile()?;
    let dir = percorso(&cartella)?;
    let nome = nome.trim();
    if nome.is_empty() || nome.len() > 200 || nome.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']) || nome == "." || nome == ".." {
        return Err("NOME_NON_VALIDO".to_string());
    }
    let nuova = dir.join(nome);
    std::fs::create_dir(&nuova).map_err(|e| format!("CARTELLA: {e}"))?;
    Ok(nuova.to_string_lossy().into_owned())
}

/// Da quale cartella parte la finestra: l'ultima usata (annotata nella cartella data sul device), altrimenti la radice del device.
#[tauri::command]
pub fn portatile_cartella_iniziale() -> Result<String, String> {
    solo_portatile()?;
    let annotata = std::fs::read_to_string(file_ultima_cartella()).ok().map(|s| s.trim().to_string()).filter(|s| Path::new(s).is_dir());
    if let Some(c) = annotata { return Ok(c); }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let radice = exe.ancestors().last().map(Path::to_path_buf).unwrap_or(exe);
    Ok(radice.to_string_lossy().into_owned())
}

/// Annota l'ultima cartella usata (solo sul device, nella cartella data del programma).
#[tauri::command]
pub fn portatile_ricorda_cartella(cartella: String) -> Result<(), String> {
    solo_portatile()?;
    let dir = percorso(&cartella)?;
    if !dir.is_dir() { return Ok(()); }
    let file = file_ultima_cartella();
    if let Some(c) = file.parent() { let _ = std::fs::create_dir_all(c); }
    std::fs::write(file, dir.to_string_lossy().as_bytes()).map_err(|e| e.to_string())
}

fn file_ultima_cartella() -> PathBuf { crate::get_portable_data_dir().join("ultima_cartella.txt") }

/// Toglie la codifica %XX (UTF-8) di un percorso passato in un'intestazione.
fn decodifica(s: &str) -> Result<String, String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let h = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|x| u8::from_str_radix(x, 16).ok()).ok_or_else(|| "PERCORSO_NON_VALIDO".to_string())?;
            out.push(h);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| "PERCORSO_NON_VALIDO".to_string())
}

#[cfg(test)]
mod prove {
    #[test]
    fn decodifica_i_percorsi_con_spazi_accenti_e_simboli() {
        assert_eq!(super::decodifica("F%3A%5C1.%20I%20MIEI%20FILE%5Cperch%C3%A9%2B.docx").unwrap(), "F:\\1. I MIEI FILE\\perché+.docx");
        assert_eq!(super::decodifica("C%3A%5Ca.txt").unwrap(), "C:\\a.txt");
        assert!(super::decodifica("%ZZ").is_err());
        assert!(super::decodifica("%C3").is_err());
    }

    #[test]
    fn rifiuta_percorsi_relativi_vuoti_o_con_caratteri_di_controllo() {
        assert!(super::percorso("").is_err());
        assert!(super::percorso("documento.docx").is_err());
        assert!(super::percorso("..\\..\\x").is_err());
        assert!(super::percorso("C:\\a\u{0}b").is_err());
        #[cfg(windows)]
        assert!(super::percorso("C:\\Users").is_ok());
    }

    #[test]
    fn fuori_dalla_modalita_portatile_i_comandi_non_fanno_niente() {
        // nei test il programma non ha accanto la cartella webview2: non è portatile
        assert_eq!(super::portatile_unita().unwrap_err(), "NON_PORTATILE");
        assert_eq!(super::portatile_elenca("C:\\".into()).err().unwrap(), "NON_PORTATILE");
        assert_eq!(super::portatile_nuova_cartella("C:\\".into(), "x".into()).unwrap_err(), "NON_PORTATILE");
    }
}
