mod aggiorna;
mod chiave_pubblica;
mod ortografia;
mod portatile_file;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Window;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub window_width: u32,
    pub window_height: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            window_width: 1200,
            window_height: 800,
        }
    }
}

/// La cartella dei dati del programma (impostazioni, file recenti):
/// - sul Mac la cartella standard ~/Library/Application Support/com.pmb.docs (il pacchetto .app non si può modificare,
///   e un'app scaricata parte da una copia di sola lettura);
/// - su Windows "data" accanto all'eseguibile, se lì si può scrivere (copia portatile, chiavetta, C:\AI_system...);
/// - altrimenti (installazione in Programmi, dove un programma senza permessi di amministratore non scrive) %APPDATA%\com.pmb.docs.
/// Si sceglie una volta sola per avvio.
fn get_portable_data_dir() -> PathBuf {
    static CARTELLA: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    CARTELLA.get_or_init(scegli_cartella_dati).clone()
}

fn scegli_cartella_dati() -> PathBuf {
    #[cfg(target_os = "macos")]
    if let Some(casa) = std::env::var_os("HOME") {
        return PathBuf::from(casa).join("Library").join("Application Support").join("com.pmb.docs");
    }
    let accanto = std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.join("data")));
    // sul device portatile i dati restano sempre accanto al programma, mai in %APPDATA% del PC ospite
    if portatile() {
        if let Some(d) = &accanto { let _ = fs::create_dir_all(d); return d.clone(); }
    }
    if let Some(d) = &accanto {
        if si_puo_scrivere(d) { return d.clone(); }
    }
    if let Some(utente) = std::env::var_os("APPDATA") {
        return PathBuf::from(utente).join("com.pmb.docs");
    }
    accanto.unwrap_or_else(|| PathBuf::from("data"))
}

/// Prova davvero a scrivere nella cartella (creandola se manca): i permessi di Windows non si leggono in modo affidabile in anticipo.
fn si_puo_scrivere(cartella: &std::path::Path) -> bool {
    if fs::create_dir_all(cartella).is_err() { return false; }
    let prova = cartella.join(".prova-scrittura");
    let ok = fs::write(&prova, b"").is_ok();
    let _ = fs::remove_file(&prova);
    ok
}

#[cfg(test)]
mod prove_cartella_dati {
    #[test]
    fn una_cartella_scrivibile_lo_e_e_una_impossibile_no() {
        let d = std::env::temp_dir().join(format!("pmb-prova-dati-{}", std::process::id()));
        assert!(super::si_puo_scrivere(&d));
        assert!(!d.join(".prova-scrittura").exists(), "il file di prova non deve restare");
        let _ = std::fs::remove_dir_all(&d);
        // una "cartella" dentro un file non si può creare
        let f = std::env::temp_dir().join(format!("pmb-prova-file-{}", std::process::id()));
        std::fs::write(&f, b"x").unwrap();
        assert!(!super::si_puo_scrivere(&f.join("data")));
        let _ = std::fs::remove_file(&f);
    }
}

/// Modalità portatile (un device esterno come AI_PRO, dove tutto deve stare sul device e niente sul PC ospite):
/// accanto al programma, o nella cartella sopra (pmb_office\webview2, una sola copia per i due programmi), c'è la "versione fissa"
/// di WebView2 distribuita da Microsoft. Allora il programma usa quella invece del WebView2 del PC, e tiene sul device anche i dati
/// della finestra (preferenze, copie di emergenza, cache), che altrimenti finirebbero in %LOCALAPPDATA% del PC.
static WEBVIEW_PORTATILE: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();

fn webview_portatile() -> Option<PathBuf> {
    WEBVIEW_PORTATILE.get_or_init(|| {
        if !cfg!(windows) { return None; }
        let exe = std::env::current_exe().ok()?;
        let qui = exe.parent()?;
        let mut posti = vec![qui.join("webview2")];
        if let Some(sopra) = qui.parent() { posti.push(sopra.join("webview2")); }
        posti.into_iter().find(|d| d.join("msedgewebview2.exe").is_file())
    }).clone()
}

/// Vero se il programma gira in modalità portatile (vedi sopra).
pub(crate) fn portatile() -> bool { webview_portatile().is_some() }

/// Crea la finestra principale (in tauri.conf.json ha "create": false). In modalità portatile WebView2 è quello del device
/// e i dati della finestra vanno in data\webview accanto al programma; la pagina lo sa da window.__PMB_PORTATILE__.
fn crea_finestra(app: &tauri::App) -> tauri::Result<()> {
    let conf = app.config().app.windows.iter().find(|w| w.label == "main").cloned().ok_or(tauri::Error::WindowNotFound)?;
    let mut b = tauri::WebviewWindowBuilder::from_config(app.handle(), &conf)?;
    if portatile() {
        b = b.data_directory(get_portable_data_dir().join("webview")).initialization_script("window.__PMB_PORTATILE__ = true;");
    }
    b.build()?;
    Ok(())
}

/// Su Mac il Finder non passa il file come argomento del programma: lo manda con un evento (RunEvent::Opened), conservato qui
/// finché la pagina non lo chiede.
static FILE_DAL_FINDER: std::sync::Mutex<Option<PathBuf>> = std::sync::Mutex::new(None);

/// Il file mandato dal Finder (solo Mac), se c'è ancora; `consuma` lo toglie, così non si apre due volte.
fn file_dal_finder(consuma: bool) -> Option<PathBuf> {
    let mut g = FILE_DAL_FINDER.lock().ok()?;
    if consuma { g.take() } else { g.clone() }
}

/// Esegue il programma; su Mac raccoglie anche i file aperti dal Finder (doppio clic, «Apri con», trascinati sull'icona).
fn esegui(app: tauri::App) {
    app.run(|_app, _evento| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &_evento {
            if let Some(p) = urls.iter().find_map(|u| u.to_file_path().ok()) {
                if let Ok(mut g) = FILE_DAL_FINDER.lock() { *g = Some(p); }
                // se la pagina è già aperta la si avvisa; se non lo è ancora, lo chiederà lei appena pronta
                use tauri::Manager;
                if let Some(w) = _app.get_webview_window("main") { let _ = w.eval("window.dispatchEvent(new CustomEvent('file-dal-finder'))"); }
            }
        }
    });
}

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn get_settings() -> Result<AppSettings, String> {
        let data_dir = get_portable_data_dir();
        let settings_path = data_dir.join("impostazioni.json");

        if !settings_path.exists() {
            let default_settings = AppSettings::default();
            let _ = save_settings(default_settings.clone());
            return Ok(default_settings);
        }

        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Impossibile leggere impostazioni.json: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Formato JSON non valido in impostazioni.json: {}", e))
    }

    #[tauri::command]
    pub fn save_settings(settings: AppSettings) -> Result<(), String> {
        let data_dir = get_portable_data_dir();
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Impossibile creare la cartella data: {}", e))?;
        }

        let settings_path = data_dir.join("impostazioni.json");
        let json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Impossibile serializzare le impostazioni: {}", e))?;

        fs::write(&settings_path, json)
            .map_err(|e| format!("Impossibile scrivere impostazioni.json: {}", e))
    }

    #[tauri::command]
    pub fn get_recent_files() -> Result<Vec<String>, String> {
        let data_dir = get_portable_data_dir();
        let recent_path = data_dir.join("recenti.json");

        if !recent_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&recent_path)
            .map_err(|e| format!("Impossibile leggere recenti.json: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Formato JSON non valido in recenti.json: {}", e))
    }

    #[tauri::command]
    pub fn save_recent_files(files: Vec<String>) -> Result<(), String> {
        let data_dir = get_portable_data_dir();
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Impossibile creare la cartella data: {}", e))?;
        }

        let recent_path = data_dir.join("recenti.json");
        let json = serde_json::to_string_pretty(&files)
            .map_err(|e| format!("Impossibile serializzare i file recenti: {}", e))?;

        fs::write(&recent_path, json)
            .map_err(|e| format!("Impossibile scrivere recenti.json: {}", e))
    }

    /// Apre un link nel programma predefinito di Windows. Accetta solo http, https e mailto, senza spazi né caratteri di controllo.
    #[tauri::command]
    pub fn open_url(url: String) -> Result<bool, String> {
        let minuscolo = url.to_lowercase();
        let schema_ok = minuscolo.starts_with("http://") || minuscolo.starts_with("https://") || minuscolo.starts_with("mailto:");
        let strano = url.len() > 2000 || url.chars().any(|c| c.is_control() || c.is_whitespace());
        if !schema_ok || strano {
            return Err("Indirizzo non ammesso".to_string());
        }
        // http e https vogliono un nome di computer dopo "//"; mailto vuole un indirizzo e nessun parametro
        let resto = if minuscolo.starts_with("https://") { &url[8..] } else if minuscolo.starts_with("http://") { &url[7..] } else { &url[7..] };
        let fine_host = resto.find(|c| c == '/' || c == '?' || c == '#').unwrap_or(resto.len());
        let (host_o_indirizzo, _) = resto.split_at(fine_host);
        let ammesso = if minuscolo.starts_with("mailto:") {
            host_o_indirizzo.contains('@') && !host_o_indirizzo.starts_with('@') && !host_o_indirizzo.ends_with('@')
        } else {
            !host_o_indirizzo.is_empty() && !host_o_indirizzo.starts_with('.') && !url.contains('\\') && !host_o_indirizzo.contains('@')
        };
        if !ammesso {
            return Err("Indirizzo non ammesso".to_string());
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("rundll32")
                .arg("url.dll,FileProtocolHandler")
                .arg(&url)
                .creation_flags(0x0800_0000)
                .spawn()
                .map_err(|e| format!("Impossibile aprire il link: {}", e))?;
            Ok(true)
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("/usr/bin/open")
                .arg(&url)
                .spawn()
                .map_err(|e| format!("Impossibile aprire il link: {}", e))?;
            Ok(true)
        }
        #[cfg(not(any(windows, target_os = "macos")))]
        {
            Err("Apertura dei link non disponibile su questo sistema".to_string())
        }
    }

    /// Controlla l'ortografia di una lista di paragrafi con il correttore di Windows. Le posizioni sono in unità UTF-16.
    #[tauri::command]
    pub async fn ortografia_controlla(paragrafi: Vec<String>, lingua: String) -> Result<Vec<Vec<crate::ortografia::ErroreOrtografico>>, String> {
        crate::ortografia::controlla(&paragrafi, &lingua)
    }

    /// Suggerimenti di Windows per una parola errata.
    #[tauri::command]
    pub async fn ortografia_suggerisci(parola: String, lingua: String) -> Result<Vec<String>, String> {
        crate::ortografia::suggerisci(&parola, &lingua)
    }

    /// Dice se Windows ha il dizionario di quella lingua (per esempio it-IT).
    #[tauri::command]
    pub async fn ortografia_lingua(lingua: String) -> bool {
        crate::ortografia::lingua_supportata(&lingua)
    }

    /// Il file che Windows ha passato al programma («Apri con», doppio clic): primo argomento, solo se è un file vero,
    /// di un formato che pmb_docs apre e non più grande di 50 MB. Il programma non legge mai altri percorsi.
    fn file_di_avvio() -> Option<std::path::PathBuf> {
        let p = crate::file_dal_finder(false).or_else(|| std::env::args_os().nth(1).map(std::path::PathBuf::from))?;
        let est = p.extension()?.to_string_lossy().to_lowercase();
        if !["docx", "odt", "txt", "md", "pdoc", "fdoc"].contains(&est.as_str()) { return None; }
        let meta = std::fs::metadata(&p).ok()?;
        if !meta.is_file() || meta.len() > 50 * 1024 * 1024 { return None; }
        Some(p)
    }

    /// Nome (senza cartella) del file con cui è stato avviato il programma, se c'è.
    #[tauri::command]
    pub fn nome_file_di_avvio() -> Option<String> {
        file_di_avvio().and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
    }

    /// Contenuto (byte grezzi) del file con cui è stato avviato il programma.
    #[tauri::command]
    pub fn leggi_file_di_avvio() -> Result<tauri::ipc::Response, String> {
        let p = file_di_avvio().ok_or_else(|| "Nessun file di avvio".to_string())?;
        let _ = crate::file_dal_finder(true); // letto: un altro evento del Finder porterà il file successivo
        std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| format!("Impossibile leggere il file: {}", e))
    }

    #[tauri::command]
    pub fn minimize_window(window: Window) -> Result<(), String> {
        window.minimize().map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn maximize_window(window: Window) -> Result<(), String> {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())
        } else {
            window.maximize().map_err(|e| e.to_string())
        }
    }

    #[tauri::command]
    pub fn close_window(window: Window) -> Result<(), String> {
        window.close().map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // modalità portatile: WebView2 è quello del device (la variabile la legge WebView2 quando crea la finestra)
    if let Some(cartella) = webview_portatile() { std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", cartella); }
    let app = tauri::Builder::default()
        .manage(aggiorna::StatoAggiornamento::default())
        .setup(|_app| {
            crea_finestra(_app)?;
            aggiorna::pulisci_vecchi();
            // Assicura l'inizializzazione immediata di data/impostazioni.json accanto all'eseguibile
            let _ = commands::get_settings();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::get_recent_files,
            commands::save_recent_files,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
            commands::open_url,
            aggiorna::aggiornamento_leggi,
            aggiorna::aggiornamento_installa,
            commands::nome_file_di_avvio,
            commands::leggi_file_di_avvio,
            commands::ortografia_controlla,
            commands::ortografia_suggerisci,
            commands::ortografia_lingua,
            portatile_file::portatile_unita,
            portatile_file::portatile_elenca,
            portatile_file::portatile_leggi,
            portatile_file::portatile_scrivi,
            portatile_file::portatile_nuova_cartella,
            portatile_file::portatile_cartella_iniziale,
            portatile_file::portatile_ricorda_cartella
        ])
        .build(tauri::generate_context!())
        .expect("Errore durante l'avvio della shell Tauri di pmb_docs");
    esegui(app);
}
