// Finestre «Apri» e «Salva con nome» di Windows e del Mac e lettura/scrittura dei file per percorso (versione installata, non pocket).
// Il browser integrato (WebView2) apre i file in sola lettura e non sa chiedere il permesso di scrittura: «Salva» ripiegava su
// «Salva con nome». Con le finestre di Windows chiamate da qui il programma conosce il percorso del file e lo riscrive sul posto.
// Si leggono e si scrivono SOLO i file che l'utente ha scelto in una di queste finestre o con cui ha aperto il programma (doppio clic,
// «Apri con»): l'elenco sta in CONCESSI. La scrittura passa da un file temporaneo accanto (portatile_file::scrivi_sicuro).
// Scritto per pmb_office (2026-11-18). Lo stesso file c'è in pmb_sheets/pmb_sheets/src-tauri/src/file_nativi.rs: tenerli uguali.

use serde::Deserialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

static CONCESSI: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);

/// Quante finestre «Apri» / «Salva con nome» sono aperte. Il comando che le mostra tiene occupato il filo principale finché l'utente non
/// sceglie: intanto le richieste della pagina aspettano, compresa quella che dice alla parte nativa «la domanda di uscita è comparsa»
/// (proteggi_chiusura). Una seconda X entro 10 s sembrava allora una pagina bloccata e il programma si chiudeva senza salvare
/// (prova fisica del 2026-11-19). Ora, finché una di queste finestre è aperta, la finestra principale non si chiude (come in Office).
static DIALOGHI_APERTI: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
struct DialogoAperto;
impl DialogoAperto {
    fn nuovo() -> DialogoAperto { DIALOGHI_APERTI.fetch_add(1, std::sync::atomic::Ordering::SeqCst); DialogoAperto }
}
impl Drop for DialogoAperto {
    fn drop(&mut self) { DIALOGHI_APERTI.fetch_sub(1, std::sync::atomic::Ordering::SeqCst); }
}
/// true mentre una finestra «Apri» o «Salva con nome» è aperta (la usa la chiusura della finestra in lib.rs).
pub(crate) fn dialogo_aperto() -> bool { DIALOGHI_APERTI.load(std::sync::atomic::Ordering::SeqCst) > 0 }

#[cfg(test)]
mod prove_dialogo_aperto {
    use super::{dialogo_aperto, DialogoAperto};
    #[test]
    fn segna_la_finestra_aperta_finche_esiste_anche_se_si_esce_con_un_errore() {
        assert!(!dialogo_aperto());
        {
            let _a = DialogoAperto::nuovo();
            assert!(dialogo_aperto());
            let esito: Result<(), String> = (|| { let _b = DialogoAperto::nuovo(); Err("errore".to_string()) })();
            assert!(esito.is_err());
            assert!(dialogo_aperto(), "la prima finestra è ancora aperta");
        }
        assert!(!dialogo_aperto());
    }
}

/// Un file che l'utente ha scelto: da qui in poi il programma può leggerlo e riscriverlo.
pub(crate) fn concedi(p: &std::path::Path) {
    if let Ok(mut c) = CONCESSI.lock() { c.get_or_insert_with(HashSet::new).insert(p.to_path_buf()); }
}
fn concesso(p: &std::path::Path) -> bool {
    CONCESSI.lock().map(|c| c.as_ref().map(|s| s.contains(p)).unwrap_or(false)).unwrap_or(false)
}

/// Un tipo di file per l'elenco «Tipo» della finestra: nome da mostrare ed estensioni senza punto.
#[derive(Deserialize)]
pub struct Filtro {
    pub nome: String,
    pub estensioni: Vec<String>,
}

#[cfg(windows)]
mod win {
    use super::Filtro;
    use windows::core::{Interface, HSTRING, PCWSTR};
    use windows::Win32::Foundation::{ERROR_CANCELLED, HWND};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::Common::COMDLG_FILTERSPEC;
    use windows::Win32::UI::Shell::{
        FileOpenDialog, FileSaveDialog, IFileDialog, IFileOpenDialog, IFileSaveDialog, IShellItem, SHCreateItemFromParsingName,
        FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM, FOS_OVERWRITEPROMPT, FOS_PATHMUSTEXIST, SIGDN_FILESYSPATH,
    };

    struct Com(bool);
    impl Com {
        fn nuovo() -> Com { Com(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok()) }
    }
    impl Drop for Com {
        fn drop(&mut self) { if self.0 { unsafe { CoUninitialize() } } }
    }

    /// Tipi di file della finestra; le stringhe devono restare vive finché la finestra è aperta.
    fn imposta_tipi(d: &IFileDialog, filtri: &[Filtro]) -> Result<Vec<HSTRING>, String> {
        let mut stringhe: Vec<HSTRING> = Vec::new();
        for f in filtri {
            let schema = f.estensioni.iter()
                .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_alphanumeric()))
                .map(|e| format!("*.{}", e)).collect::<Vec<_>>().join(";");
            if schema.is_empty() { continue; }
            stringhe.push(HSTRING::from(f.nome.as_str()));
            stringhe.push(HSTRING::from(schema));
        }
        if stringhe.is_empty() { return Ok(stringhe); }
        let specifiche: Vec<COMDLG_FILTERSPEC> = stringhe.chunks(2)
            .map(|c| COMDLG_FILTERSPEC { pszName: PCWSTR(c[0].as_ptr()), pszSpec: PCWSTR(c[1].as_ptr()) }).collect();
        unsafe { d.SetFileTypes(&specifiche) }.map_err(|e| e.to_string())?;
        Ok(stringhe)
    }

    /// Mostra la finestra; None se l'utente annulla.
    fn mostra(d: &IFileDialog, finestra: HWND) -> Result<Option<String>, String> {
        if let Err(e) = unsafe { d.Show(Some(finestra)) } {
            if e.code() == ERROR_CANCELLED.to_hresult() { return Ok(None); }
            return Err(e.to_string());
        }
        let voce: IShellItem = unsafe { d.GetResult() }.map_err(|e| e.to_string())?;
        let p = unsafe { voce.GetDisplayName(SIGDN_FILESYSPATH) }.map_err(|e| e.to_string())?;
        let s = unsafe { p.to_string() }.unwrap_or_default();
        unsafe { CoTaskMemFree(Some(p.0 as *const _)) };
        Ok(if s.is_empty() { None } else { Some(s) })
    }

    pub fn apri(finestra: HWND, titolo: &str, filtri: &[Filtro]) -> Result<Option<String>, String> {
        let _com = Com::nuovo();
        let d: IFileOpenDialog = unsafe { CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER) }.map_err(|e| e.to_string())?;
        let base: IFileDialog = d.cast().map_err(|e| e.to_string())?;
        unsafe {
            let o = base.GetOptions().map_err(|e| e.to_string())?;
            base.SetOptions(o | FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST).map_err(|e| e.to_string())?;
            if !titolo.is_empty() { base.SetTitle(&HSTRING::from(titolo)).map_err(|e| e.to_string())?; }
        }
        let _vive = imposta_tipi(&base, filtri)?;
        mostra(&base, finestra)
    }

    pub fn salva(finestra: HWND, titolo: &str, nome: &str, cartella: Option<&str>, filtri: &[Filtro]) -> Result<Option<String>, String> {
        let _com = Com::nuovo();
        let d: IFileSaveDialog = unsafe { CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER) }.map_err(|e| e.to_string())?;
        let base: IFileDialog = d.cast().map_err(|e| e.to_string())?;
        unsafe {
            let o = base.GetOptions().map_err(|e| e.to_string())?;
            base.SetOptions(o | FOS_FORCEFILESYSTEM | FOS_OVERWRITEPROMPT | FOS_PATHMUSTEXIST).map_err(|e| e.to_string())?;
            if !titolo.is_empty() { base.SetTitle(&HSTRING::from(titolo)).map_err(|e| e.to_string())?; }
            if !nome.is_empty() { base.SetFileName(&HSTRING::from(nome)).map_err(|e| e.to_string())?; }
            if let Some(e) = filtri.first().and_then(|f| f.estensioni.first()) { let _ = base.SetDefaultExtension(&HSTRING::from(e.as_str())); }
            if let Some(c) = cartella.filter(|c| !c.is_empty()) {
                if let Ok(voce) = SHCreateItemFromParsingName::<_, _, IShellItem>(&HSTRING::from(c), None) { let _ = base.SetFolder(&voce); }
            }
        }
        let _vive = imposta_tipi(&base, filtri)?;
        mostra(&base, finestra)
    }
}

/// Le stesse finestre sul Mac (NSOpenPanel / NSSavePanel attraverso rfd, la libreria del plugin dei dialoghi di Tauri). Senza di loro il Mac
/// ripiegava su uno «scaricamento» che WKWebView senza gestore annulla: Salva e Salva con nome non facevano niente.
#[cfg(target_os = "macos")]
mod mac {
    use super::Filtro;

    fn prepara(finestra: &tauri::Window, titolo: &str, filtri: &[Filtro]) -> rfd::FileDialog {
        let mut d = rfd::FileDialog::new().set_parent(finestra);
        if !titolo.is_empty() { d = d.set_title(titolo); }
        for f in filtri {
            let estensioni: Vec<&str> = f.estensioni.iter().map(|e| e.as_str())
                .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_alphanumeric())).collect();
            if !estensioni.is_empty() { d = d.add_filter(f.nome.as_str(), &estensioni); }
        }
        d
    }

    pub fn apri(finestra: &tauri::Window, titolo: &str, filtri: &[Filtro]) -> Option<String> {
        prepara(finestra, titolo, filtri).pick_file().map(|p| p.to_string_lossy().into_owned())
    }

    pub fn salva(finestra: &tauri::Window, titolo: &str, nome: &str, cartella: Option<&str>, filtri: &[Filtro]) -> Option<String> {
        let mut d = prepara(finestra, titolo, filtri);
        if !nome.is_empty() { d = d.set_file_name(nome); }
        if let Some(c) = cartella.filter(|c| !c.is_empty()) { d = d.set_directory(c); }
        d.save_file().map(|p| p.to_string_lossy().into_owned())
    }
}

#[cfg(windows)]
fn maniglia(finestra: &tauri::Window) -> windows::Win32::Foundation::HWND {
    windows::Win32::Foundation::HWND(finestra.hwnd().map(|h| h.0 as *mut core::ffi::c_void).unwrap_or(std::ptr::null_mut()))
}

/// La finestra «Apri» di Windows o del Mac. Restituisce il percorso scelto, o null se si annulla. Altrove (pocket, Linux): NON_DISPONIBILE.
#[tauri::command]
pub fn file_apri_finestra(window: tauri::Window, titolo: String, filtri: Vec<Filtro>) -> Result<Option<String>, String> {
    if crate::portatile() { return Err("NON_DISPONIBILE".to_string()); }
    let _aperta = DialogoAperto::nuovo();
    #[cfg(windows)]
    {
        let scelto = win::apri(maniglia(&window), &titolo, &filtri)?;
        if let Some(p) = &scelto { concedi(std::path::Path::new(p)); }
        return Ok(scelto);
    }
    #[cfg(target_os = "macos")]
    {
        let scelto = mac::apri(&window, &titolo, &filtri);
        if let Some(p) = &scelto { concedi(std::path::Path::new(p)); }
        return Ok(scelto);
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    { let _ = (window, titolo, filtri); Err("NON_DISPONIBILE".to_string()) }
}

/// La finestra «Salva con nome» di Windows o del Mac, con il nome proposto e (se c'è) la cartella da cui partire.
#[tauri::command]
pub fn file_salva_finestra(window: tauri::Window, titolo: String, nome: String, cartella: Option<String>, filtri: Vec<Filtro>) -> Result<Option<String>, String> {
    if crate::portatile() { return Err("NON_DISPONIBILE".to_string()); }
    let _aperta = DialogoAperto::nuovo();
    #[cfg(windows)]
    {
        let scelto = win::salva(maniglia(&window), &titolo, &nome, cartella.as_deref(), &filtri)?;
        if let Some(p) = &scelto { concedi(std::path::Path::new(p)); }
        return Ok(scelto);
    }
    #[cfg(target_os = "macos")]
    {
        let scelto = mac::salva(&window, &titolo, &nome, cartella.as_deref(), &filtri);
        if let Some(p) = &scelto { concedi(std::path::Path::new(p)); }
        return Ok(scelto);
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    { let _ = (window, titolo, nome, cartella, filtri); Err("NON_DISPONIBILE".to_string()) }
}

/// I byte di un file scelto dall'utente.
#[tauri::command]
pub fn file_leggi(percorso_file: String) -> Result<tauri::ipc::Response, String> {
    let p = crate::portatile_file::percorso(&percorso_file)?;
    if !concesso(&p) { return Err("NON_CONCESSO".to_string()); }
    crate::portatile_file::leggi_limitato(&p).map(tauri::ipc::Response::new)
}

/// Riscrive un file scelto dall'utente: i byte arrivano grezzi, il percorso nell'intestazione «percorso» (codificato come in un indirizzo web).
#[tauri::command]
pub fn file_scrivi(richiesta: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(byte) = richiesta.body() else { return Err("DATI_MANCANTI".to_string()) };
    let codificato = richiesta.headers().get("percorso").and_then(|v| v.to_str().ok()).ok_or_else(|| "PERCORSO_MANCANTE".to_string())?;
    let p = crate::portatile_file::percorso(&crate::portatile_file::decodifica(codificato)?)?;
    if !concesso(&p) { return Err("NON_CONCESSO".to_string()); }
    crate::portatile_file::scrivi_sicuro(&p, byte)
}

#[cfg(test)]
mod prove {
    #[test]
    fn si_legge_e_si_scrive_solo_un_file_scelto_dall_utente() {
        let cartella = std::env::temp_dir().join(format!("pmb-file-nativi-{}", std::process::id()));
        std::fs::create_dir_all(&cartella).unwrap();
        let file = cartella.join("prova é.txt");
        std::fs::write(&file, b"vecchio").unwrap();
        assert!(!super::concesso(&file));
        assert_eq!(super::file_leggi(file.to_string_lossy().into_owned()).err().as_deref(), Some("NON_CONCESSO"));
        super::concedi(&file);
        assert!(super::concesso(&file));
        // la scrittura sicura sostituisce il file intero e non lascia il temporaneo
        crate::portatile_file::scrivi_sicuro(&file, b"nuovo contenuto").unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), b"nuovo contenuto");
        assert!(!cartella.join(".prova é.txt.pmb-salvataggio").exists());
        // un altro file della stessa cartella resta non concesso
        assert!(!super::concesso(&cartella.join("altro.txt")));
        let _ = std::fs::remove_dir_all(&cartella);
    }
}
