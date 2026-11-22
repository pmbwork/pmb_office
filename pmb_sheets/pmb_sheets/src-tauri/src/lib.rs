mod portatile_file;
mod file_nativi;

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
    /// lingua dell'interfaccia: "auto" (come Windows), "it" o "en"; manca nei file scritti dalle versioni precedenti
    #[serde(default = "lingua_predefinita")]
    pub language: String,
}

fn lingua_predefinita() -> String {
    "auto".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            window_width: 1200,
            window_height: 800,
            language: lingua_predefinita(),
        }
    }
}

/// La cartella dei dati del programma (impostazioni, dimensione della finestra):
/// - sul Mac la cartella standard ~/Library/Application Support/com.pmb.sheets (il pacchetto .app non si può modificare,
///   e un'app scaricata parte da una copia di sola lettura);
/// - su Windows "data" accanto all'eseguibile, se lì si può scrivere (copia portatile, chiavetta, C:\AI_system...);
/// - altrimenti (installazione in Programmi, dove un programma senza permessi di amministratore non scrive) %APPDATA%\com.pmb.sheets.
/// Si sceglie una volta sola per avvio.
fn get_portable_data_dir() -> PathBuf {
    static CARTELLA: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    CARTELLA.get_or_init(scegli_cartella_dati).clone()
}

fn scegli_cartella_dati() -> PathBuf {
    #[cfg(target_os = "macos")]
    if let Some(casa) = std::env::var_os("HOME") {
        return PathBuf::from(casa).join("Library").join("Application Support").join("com.pmb.sheets");
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
        return PathBuf::from(utente).join("com.pmb.sheets");
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

    /// I formati che pmb_sheets apre quando il sistema gli passa un file: quelli dell'«Apri con» dell'installatore (nsis/hooks.nsh,
    /// wix/apri-con.wxs, tauri.macos.conf.json), quelli della finestra Apri e i formati propri.
    const ESTENSIONI_APRIBILI: [&str; 20] = ["xlsx", "xlsm", "xltx", "xltm", "xlsb", "xls", "xlt", "ods", "ots", "fods", "csv", "tsv", "txt", "html", "htm", "dif", "slk", "xml", "psheet", "fsheet"];

    /// Il file che il sistema ha passato al programma («Apri con», doppio clic; sul Mac il Finder): nome e percorso. La pagina lo legge con
    /// file_leggi (byte grezzi: un elenco JSON di numeri era 4 volte più lento) e «Salva» lo riscrive sul posto con file_scrivi.
    /// Se il file c'è ma non si apre, `problema` dice perché (FORMATO_NON_SUPPORTATO, NON_TROVATO, TROPPO_GRANDE oltre i 100 MB delle
    /// finestre Apri): la pagina lo dice, invece di aprirsi vuota senza spiegazioni. Uguale in pmb_docs e pmb_sheets (cambia solo l'elenco).
    #[derive(Serialize)]
    pub struct FileAvvio {
        pub nome: String,
        pub percorso: String,
        pub problema: Option<String>,
    }

    #[tauri::command]
    pub fn file_di_avvio() -> Option<FileAvvio> {
        // sul Mac il file arriva dal Finder (e si toglie, così non si riapre); su Windows è il primo argomento che non è un'opzione.
        // args_os e non args: args si ferma con un errore se il nome del file non è Unicode valido
        let percorso = crate::file_dal_finder(true)
            .or_else(|| std::env::args_os().skip(1).find(|a| !a.to_string_lossy().starts_with('-')).map(PathBuf::from))?;
        let nome = percorso.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let estensione = percorso.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        let problema = if !ESTENSIONI_APRIBILI.contains(&estensione.as_str()) {
            Some("FORMATO_NON_SUPPORTATO")
        } else {
            match fs::metadata(&percorso) {
                Ok(m) if m.is_file() && m.len() <= crate::portatile_file::DIMENSIONE_MASSIMA => None,
                Ok(m) if m.is_file() => Some("TROPPO_GRANDE"),
                _ => Some("NON_TROVATO"),
            }
        };
        if problema.is_none() { crate::file_nativi::concedi(&percorso); }
        Some(FileAvvio { nome, percorso: percorso.to_string_lossy().into_owned(), problema: problema.map(str::to_string) })
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

    /// Mette o toglie lo schermo intero della finestra (Visualizza › Schermo intero, F11; Esc ne esce). Lo stato lo dice la pagina, così non si
    /// perde il passo. Uguale in pmb_docs (prima qui c'era un comando che invertiva lo stato della finestra).
    #[tauri::command]
    pub fn imposta_schermo_intero(window: Window, attivo: bool) -> Result<(), String> {
        window.set_fullscreen(attivo).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn close_window(window: Window) -> Result<(), String> {
        window.close().map_err(|e| e.to_string())
    }

    /// Chiude davvero la finestra, senza ripassare dal controllo dei fogli non salvati (lo ha già fatto la pagina).
    #[tauri::command]
    pub fn destroy_window(window: Window) -> Result<(), String> {
        window.destroy().map_err(|e| e.to_string())
    }

    /// La pagina dice se vuole decidere lei la chiusura (finché è caricata e può chiedere di salvare). La pagina la richiama anche
    /// quando ha risposto a una richiesta di chiusura (per esempio con «Annulla»): la pagina è viva, quindi una nuova X entro 10 secondi
    /// deve chiedere di nuovo, non chiudere senza domande.
    #[tauri::command]
    pub fn proteggi_chiusura(attiva: bool) {
        super::PROTEGGI_CHIUSURA.store(attiva, std::sync::atomic::Ordering::SeqCst);
        super::ULTIMA_RICHIESTA.store(0, std::sync::atomic::Ordering::SeqCst);
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
}

/// Ricorda la dimensione della finestra (in punti logici) per riaprirla uguale: non la salva se è ingrandita a tutto schermo o ridotta a icona.
fn salva_dimensione_finestra(finestra: &tauri::Window) {
    if finestra.is_maximized().unwrap_or(false) || finestra.is_minimized().unwrap_or(false) || finestra.is_fullscreen().unwrap_or(false) {
        return;
    }
    if let (Ok(dim), Ok(fattore)) = (finestra.inner_size(), finestra.scale_factor()) {
        let larghezza = (dim.width as f64 / fattore).round() as u32;
        let altezza = (dim.height as f64 / fattore).round() as u32;
        if larghezza >= 800 && altezza >= 600 {
            if let Ok(mut impostazioni) = commands::get_settings() {
                impostazioni.window_width = larghezza;
                impostazioni.window_height = altezza;
                let _ = commands::save_settings(impostazioni);
            }
        }
    }
}

static PROTEGGI_CHIUSURA: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
/// Quando (ms dall'epoca) è stata bloccata la richiesta di chiusura da ricordare (0 = nessuna): vedi decidi_chiusura.
static ULTIMA_RICHIESTA: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Decide una richiesta di chiusura della finestra (X, Alt+F4, barra delle applicazioni). Restituisce (si chiude?, nuovo valore di ULTIMA_RICHIESTA).
/// - Se la pagina non protegge la chiusura, si chiude.
/// - La pagina azzera ULTIMA_RICHIESTA (proteggi_chiusura) quando mostra la sua domanda e quando l'utente risponde: finché la pagina è viva,
///   una nuova richiesta è una richiesta nuova e trova la domanda, non chiude senza salvare.
/// - Se la pagina non risponde (bloccata), chi insiste chiude: una seconda richiesta fra 1,5 e 10 secondi dopo la prima chiude comunque.
/// - Due richieste a meno di 1,5 secondi (doppio clic sulla X, due Alt+F4 di fila) non chiudono: la seconda vale come la prima.
pub(crate) fn decidi_chiusura(protetta: bool, ultima: u64, adesso: u64) -> (bool, u64) {
    if !protetta { return (true, ultima); }
    let trascorso = adesso.saturating_sub(ultima);
    if ultima != 0 && (1_500..10_000).contains(&trascorso) { return (true, ultima); }
    let nuova = if ultima == 0 || trascorso >= 10_000 { adesso } else { ultima };
    (false, nuova)
}

#[cfg(test)]
mod prove_chiusura {
    use super::decidi_chiusura;
    #[test]
    fn senza_protezione_si_chiude() { assert_eq!(decidi_chiusura(false, 0, 50_000), (true, 0)); }
    #[test]
    fn la_prima_richiesta_passa_alla_pagina() { assert_eq!(decidi_chiusura(true, 0, 50_000), (false, 50_000)); }
    #[test]
    fn il_doppio_clic_non_chiude() {
        let (chiudi, ultima) = decidi_chiusura(true, 0, 50_000);
        assert!(!chiudi);
        assert_eq!(decidi_chiusura(true, ultima, 50_300), (false, 50_000), "la seconda richiesta subito dopo vale come la prima");
    }
    #[test]
    fn con_la_pagina_bloccata_chi_insiste_chiude() {
        assert_eq!(decidi_chiusura(true, 50_000, 52_000), (true, 50_000));
        assert_eq!(decidi_chiusura(true, 50_000, 59_999), (true, 50_000));
    }
    #[test]
    fn dopo_10_secondi_e_una_richiesta_nuova() { assert_eq!(decidi_chiusura(true, 50_000, 61_000), (false, 61_000)); }
    #[test]
    fn la_pagina_viva_azzera_e_la_x_trova_la_domanda() {
        // la pagina ha mostrato la domanda e ha chiamato proteggi_chiusura: ULTIMA_RICHIESTA torna 0
        assert_eq!(decidi_chiusura(true, 0, 53_000), (false, 53_000));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // modalità portatile: WebView2 è quello del device (la variabile la legge WebView2 quando crea la finestra)
    if let Some(cartella) = webview_portatile() { std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", cartella); }
    let app = tauri::Builder::default()
        .on_window_event(|finestra, evento| {
            // Chiusura chiesta dalla finestra (X, Alt+F4, barra delle applicazioni): se la pagina la gestisce, decide lei dopo aver controllato i fogli non salvati
            if let tauri::WindowEvent::CloseRequested { api, .. } = evento {
                // con la finestra «Apri» o «Salva con nome» aperta la finestra principale non si chiude (file_nativi.rs, dialogo_aperto)
                if crate::file_nativi::dialogo_aperto() { api.prevent_close(); return; }
                use std::sync::atomic::Ordering::SeqCst;
                salva_dimensione_finestra(finestra);
                let adesso = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
                let (chiudi, ultima) = decidi_chiusura(PROTEGGI_CHIUSURA.load(SeqCst), ULTIMA_RICHIESTA.load(SeqCst), adesso);
                if !chiudi {
                    use tauri::Manager;
                    ULTIMA_RICHIESTA.store(ultima, SeqCst);
                    // la pagina ascolta un evento del documento (non serve l'API eventi di Tauri, che richiede permessi)
                    if let Some(web) = finestra.app_handle().get_webview_window(finestra.label()) {
                        if web.eval("window.dispatchEvent(new CustomEvent('chiusura-richiesta'))").is_ok() {
                            api.prevent_close();
                        }
                    }
                }
            }
        })
        .setup(|_app| {
            crea_finestra(_app)?;
            // Assicura l'inizializzazione immediata di data/impostazioni.json accanto all'eseguibile
            let impostazioni = commands::get_settings();
            // la finestra si riapre grande come era stata lasciata (ma mai più grande dello schermo)
            if let Ok(imp) = impostazioni {
                use tauri::Manager;
                if let Some(web) = _app.get_webview_window("main") {
                    let (mut l, mut a) = (imp.window_width.max(800) as f64, imp.window_height.max(600) as f64);
                    if let Ok(Some(schermo)) = web.current_monitor() {
                        let fattore = schermo.scale_factor();
                        l = l.min(schermo.size().width as f64 / fattore);
                        a = a.min(schermo.size().height as f64 / fattore);
                    }
                    let _ = web.set_size(tauri::LogicalSize::new(l, a));
                    let _ = web.center();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::minimize_window,
            commands::maximize_window,
            commands::imposta_schermo_intero,
            commands::close_window,
            commands::destroy_window,
            commands::proteggi_chiusura,
            commands::file_di_avvio,
            commands::open_url,
            file_nativi::file_apri_finestra,
            file_nativi::file_salva_finestra,
            file_nativi::file_leggi,
            file_nativi::file_scrivi,
            portatile_file::portatile_unita,
            portatile_file::portatile_elenca,
            portatile_file::portatile_leggi,
            portatile_file::portatile_scrivi,
            portatile_file::portatile_nuova_cartella,
            portatile_file::portatile_cartella_iniziale,
            portatile_file::portatile_ricorda_cartella
        ])
        .build(tauri::generate_context!())
        .expect("Errore durante l'avvio della shell Tauri di pmb_office");
    esegui(app);
}
