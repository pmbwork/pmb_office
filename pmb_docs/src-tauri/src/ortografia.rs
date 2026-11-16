// Correttore ortografico: usa quello del sistema, già installato, offline e con le lingue del sistema:
// su Windows la Spell Checking API, sul Mac NSSpellChecker.
// Nessun dizionario è incluso nel programma.

use serde::Serialize;

/// Un errore trovato in un paragrafo: posizione in unità UTF-16 (come le stringhe di JavaScript) e che cosa suggerisce Windows.
/// Quanti paragrafi si controllano in una chiamata, quanto può essere lungo un paragrafo (oltre non si controlla) e quanti errori si restituiscono in tutto.
pub const PARAGRAFI_MASSIMI: usize = 500;
pub const CARATTERI_MASSIMI: usize = 20_000;
pub const ERRORI_MASSIMI: usize = 5_000;
pub const LUNGHEZZA_PAROLA_MASSIMA: usize = 100;

/// Una lingua come it-IT: solo lettere, cifre e trattini, al massimo 16 caratteri.
pub fn lingua_valida(lingua: &str) -> bool {
    !lingua.is_empty() && lingua.len() <= 16 && lingua.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ErroreOrtografico {
    pub da: u32,
    pub a: u32,
    /// 0 = parola errata (si chiedono i suggerimenti), 1 = da togliere (parola ripetuta), 2 = da sostituire con `sostituto`
    pub azione: u8,
    pub sostituto: String,
}

#[cfg(windows)]
mod win {
    use super::ErroreOrtografico;
    use windows::core::{Result as WinResult, HSTRING, PWSTR};
    use windows::Win32::Globalization::{ISpellChecker, ISpellCheckerFactory, ISpellingError, SpellCheckerFactory, CORRECTIVE_ACTION_DELETE, CORRECTIVE_ACTION_REPLACE};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};

    /// Tiene viva l'inizializzazione di COM per il thread che chiama.
    struct Com(bool);
    impl Com {
        fn nuovo() -> Com { Com(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok()) }
    }
    impl Drop for Com {
        fn drop(&mut self) { if self.0 { unsafe { CoUninitialize() } } }
    }

    fn stringa(p: PWSTR) -> String {
        if p.is_null() { return String::new(); }
        let s = unsafe { p.to_string() }.unwrap_or_default();
        unsafe { CoTaskMemFree(Some(p.0 as *const _)) };
        s
    }

    fn correttore(lingua: &str) -> Result<ISpellChecker, String> {
        let fabbrica: ISpellCheckerFactory = unsafe { CoCreateInstance(&SpellCheckerFactory, None, CLSCTX_INPROC_SERVER) }
            .map_err(|e| format!("Il correttore di Windows non è disponibile: {e}"))?;
        let l = HSTRING::from(lingua);
        let ok = unsafe { fabbrica.IsSupported(&l) }.map_err(|e| e.to_string())?;
        if !ok.as_bool() { return Err(format!("Windows non ha il dizionario per la lingua {lingua}: aggiungila nelle impostazioni di lingua di Windows")); }
        unsafe { fabbrica.CreateSpellChecker(&l) }.map_err(|e| e.to_string())
    }

    pub fn lingua_supportata(lingua: &str) -> bool { if !super::lingua_valida(lingua) { return false; } let _com = Com::nuovo(); correttore(lingua).is_ok() }

    pub fn controlla(paragrafi: &[String], lingua: &str) -> Result<Vec<Vec<ErroreOrtografico>>, String> {
        if !super::lingua_valida(lingua) { return Err("Lingua non valida".to_string()); }
        if paragrafi.len() > super::PARAGRAFI_MASSIMI { return Err(format!("Troppi paragrafi in una volta (al massimo {})", super::PARAGRAFI_MASSIMI)); }
        let _com = Com::nuovo();
        let c = correttore(lingua)?;
        let mut tutti = Vec::with_capacity(paragrafi.len());
        let mut totale = 0usize;
        for testo in paragrafi {
            let mut errori = Vec::new();
            // un paragrafo enorme non si controlla (bloccherebbe il computer): resta senza errori, la posizione nell'elenco si mantiene
            if !testo.trim().is_empty() && testo.chars().count() <= super::CARATTERI_MASSIMI && totale < super::ERRORI_MASSIMI {
                let elenco = unsafe { c.Check(&HSTRING::from(testo.as_str())) }.map_err(|e| e.to_string())?;
                loop {
                    let mut voce: Option<ISpellingError> = None;
                    let r = unsafe { elenco.Next(&mut voce) };
                    if r.0 != 0 { break; } // S_FALSE: non ce ne sono altri
                    let e = match voce { Some(e) => e, None => break };
                    let inizio = unsafe { e.StartIndex() }.map_err(|x| x.to_string())?;
                    let lunghezza = unsafe { e.Length() }.map_err(|x| x.to_string())?;
                    let azione = unsafe { e.CorrectiveAction() }.map_err(|x| x.to_string())?;
                    let (codice, sostituto) = if azione == CORRECTIVE_ACTION_DELETE { (1, String::new()) }
                        else if azione == CORRECTIVE_ACTION_REPLACE { (2, stringa(unsafe { e.Replacement() }.unwrap_or(PWSTR::null()))) }
                        else { (0, String::new()) };
                    errori.push(ErroreOrtografico { da: inizio, a: inizio + lunghezza, azione: codice, sostituto });
                    totale += 1;
                    if errori.len() >= 2000 || totale >= super::ERRORI_MASSIMI { break; }
                }
            }
            tutti.push(errori);
        }
        Ok(tutti)
    }

    pub fn suggerisci(parola: &str, lingua: &str) -> Result<Vec<String>, String> {
        if !super::lingua_valida(lingua) { return Err("Lingua non valida".to_string()); }
        if parola.chars().count() > super::LUNGHEZZA_PAROLA_MASSIMA { return Ok(Vec::new()); }
        let _com = Com::nuovo();
        let c = correttore(lingua)?;
        let elenco = unsafe { c.Suggest(&HSTRING::from(parola)) }.map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        loop {
            let mut voce = [PWSTR::null()];
            let mut presi = 0u32;
            let r: WinResult<()> = unsafe { elenco.Next(&mut voce, Some(&mut presi)) }.ok();
            if r.is_err() || presi == 0 { break; }
            out.push(stringa(voce[0]));
            if out.len() >= 8 { break; }
        }
        Ok(out)
    }
}

#[cfg(windows)]
pub use win::{controlla, lingua_supportata, suggerisci};

/// Sul Mac: il correttore del sistema (NSSpellChecker), con le lingue che il Mac ha già. Le posizioni che restituisce sono in unità UTF-16,
/// come quelle di Windows e di JavaScript. Il Mac non segnala le parole ripetute: lì gli errori sono solo parole errate (azione 0).
#[cfg(target_os = "macos")]
mod mac {
    use super::ErroreOrtografico;
    use objc2::rc::Retained;
    use objc2_app_kit::NSSpellChecker;
    use objc2_foundation::{NSRange, NSString};

    /// Il correttore del Mac è uno solo per tutto il programma: una chiamata alla volta.
    static IN_USO: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// La lingua come la chiama il Mac: «it-IT» diventa «it_IT» se il Mac ce l'ha, altrimenti «it»; None se il Mac non ha quella lingua.
    fn lingua_mac(c: &NSSpellChecker, lingua: &str) -> Option<String> {
        let disponibili: Vec<String> = c.availableLanguages().to_vec().iter().map(|l| l.to_string()).collect();
        let completa = lingua.replace('-', "_");
        let base = lingua.split('-').next().unwrap_or(lingua).to_string();
        [completa, base].into_iter().find(|l| disponibili.iter().any(|d| d.eq_ignore_ascii_case(l)))
    }

    fn correttore(lingua: &str) -> Result<(Retained<NSSpellChecker>, Retained<NSString>), String> {
        let c = NSSpellChecker::sharedSpellChecker();
        let l = lingua_mac(&c, lingua).ok_or_else(|| format!("Il Mac non ha il dizionario per la lingua {lingua}: aggiungila in Impostazioni di Sistema › Tastiera › Testo"))?;
        Ok((c, NSString::from_str(&l)))
    }

    pub fn lingua_supportata(lingua: &str) -> bool {
        if !super::lingua_valida(lingua) { return false; }
        let _uno = IN_USO.lock();
        correttore(lingua).is_ok()
    }

    pub fn controlla(paragrafi: &[String], lingua: &str) -> Result<Vec<Vec<ErroreOrtografico>>, String> {
        if !super::lingua_valida(lingua) { return Err("Lingua non valida".to_string()); }
        if paragrafi.len() > super::PARAGRAFI_MASSIMI { return Err(format!("Troppi paragrafi in una volta (al massimo {})", super::PARAGRAFI_MASSIMI)); }
        let _uno = IN_USO.lock();
        let (c, l) = correttore(lingua)?;
        let mut tutti = Vec::with_capacity(paragrafi.len());
        let mut totale = 0usize;
        for testo in paragrafi {
            let mut errori = Vec::new();
            // un paragrafo enorme non si controlla (bloccherebbe il computer): resta senza errori, la posizione nell'elenco si mantiene
            if !testo.trim().is_empty() && testo.chars().count() <= super::CARATTERI_MASSIMI && totale < super::ERRORI_MASSIMI {
                let ns = NSString::from_str(testo);
                let lunghezza = ns.length();
                let mut da = 0usize;
                while da < lunghezza {
                    // SAFETY: il contatore delle parole non serve e il puntatore nullo è ammesso
                    let r: NSRange = unsafe { c.checkSpellingOfString_startingAt_language_wrap_inSpellDocumentWithTag_wordCount(&ns, da as isize, Some(&l), false, 0, std::ptr::null_mut()) };
                    // nessun errore: il Mac risponde con una posizione fuori dal testo (NSNotFound) e lunghezza 0
                    if r.length == 0 || r.location >= lunghezza || r.location < da { break; }
                    errori.push(ErroreOrtografico { da: r.location as u32, a: (r.location + r.length) as u32, azione: 0, sostituto: String::new() });
                    totale += 1;
                    da = r.location + r.length;
                    if errori.len() >= 2000 || totale >= super::ERRORI_MASSIMI { break; }
                }
            }
            tutti.push(errori);
        }
        Ok(tutti)
    }

    pub fn suggerisci(parola: &str, lingua: &str) -> Result<Vec<String>, String> {
        if !super::lingua_valida(lingua) { return Err("Lingua non valida".to_string()); }
        if parola.chars().count() > super::LUNGHEZZA_PAROLA_MASSIMA || parola.trim().is_empty() { return Ok(Vec::new()); }
        let _uno = IN_USO.lock();
        let (c, l) = correttore(lingua)?;
        let ns = NSString::from_str(parola);
        let tutta = NSRange::new(0, ns.length());
        let elenco = c.guessesForWordRange_inString_language_inSpellDocumentWithTag(tutta, &ns, Some(&l), 0);
        Ok(elenco.map(|a| a.to_vec().iter().take(8).map(|s| s.to_string()).collect()).unwrap_or_default())
    }

    #[cfg(test)]
    mod prove {
        // si eseguono sul Mac di GitHub (workflow build-mac): il Mac ha sempre l'inglese
        #[test]
        fn trova_le_parole_errate_con_le_posizioni_utf16() {
            let r = super::controlla(&["This sentnce has one mistake".to_string(), "".to_string(), "Caffè and an errror".to_string()], "en-US").unwrap();
            assert_eq!(r.len(), 3);
            assert_eq!(r[0].len(), 1, "{:?}", r[0]);
            assert_eq!((r[0][0].da, r[0][0].a), (5, 12)); // «sentnce»
            assert!(r[1].is_empty());
            let errror: Vec<_> = r[2].iter().map(|e| (e.da, e.a)).collect();
            assert!(errror.contains(&(13, 19)), "{errror:?}"); // «errror», dopo la è (una sola unità UTF-16)
        }

        #[test]
        fn suggerisce_la_parola_giusta() {
            let s = super::suggerisci("sentnce", "en-US").unwrap();
            assert!(s.iter().any(|x| x == "sentence"), "suggerimenti: {s:?}");
        }

        #[test]
        fn conosce_l_inglese_e_rifiuta_una_lingua_inventata() {
            assert!(super::lingua_supportata("en-US"));
            assert!(!super::lingua_supportata("xx-QQ"));
            assert!(!super::lingua_supportata("en US; rm"));
        }
    }
}

#[cfg(target_os = "macos")]
pub use mac::{controlla, lingua_supportata, suggerisci};

#[cfg(not(any(windows, target_os = "macos")))]
pub fn controlla(_p: &[String], _l: &str) -> Result<Vec<Vec<ErroreOrtografico>>, String> { Err("Il correttore ortografico non è disponibile su questo sistema".to_string()) }
#[cfg(not(any(windows, target_os = "macos")))]
pub fn suggerisci(_p: &str, _l: &str) -> Result<Vec<String>, String> { Err("Il correttore ortografico non è disponibile su questo sistema".to_string()) }
#[cfg(not(any(windows, target_os = "macos")))]
pub fn lingua_supportata(_l: &str) -> bool { false }
