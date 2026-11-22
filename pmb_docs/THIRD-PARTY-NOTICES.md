# Componenti di terze parti di pmb_docs

Documento aggiornato il 2026-11-22. Il codice di pmb_docs (cartelle `src`, `src-tauri/src`, `tests`) è scritto per questo progetto; i componenti di altri che entrano nel programma sono elencati, con versione, licenza e titolare del copyright, in un elenco **generato** dalle dipendenze reali (`cargo metadata` e `package-lock.json`) con `comune/scripts/genera-licenze.mjs`:

- nel programma: **Informazioni › Licenze di terze parti** (con i testi completi delle licenze);
- nel codice: `src/guscio/licenze-terze.ts`.

Quell'elenco è l'unico valido: l'agente `agente-suite-office` controlla a ogni invio di codice che corrisponda alle dipendenze di oggi e che tutte le licenze siano compatibili con la GPL v3 di pmb_office (prima questo documento conteneva una copia dell'elenco, rimasta indietro).

## Da conservare con attenzione

- **MPL-2.0** (licenza a livello di file): `cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`. Usati senza modifiche; il testo della MPL-2.0 è allegato e il loro codice è su crates.io. Se un giorno si modificano quei file, le modifiche a quei file vanno rese disponibili con la MPL-2.0.
- **Icone**: tracciati di Material Symbols e Material Icons (Google LLC), Apache-2.0, incorporati nel codice.
- **Caratteri**: i file in `src/assets/fonts` vengono dai pacchetti `@fontsource/*` (caratteri di Google Fonts): Roboto con licenza Apache-2.0, Inter e tutte le altre famiglie con licenza SIL OFL 1.1. Ognuna è nell'elenco dei componenti; la OFL consente l'incorporamento in un programma, non la vendita del carattere da solo.
- **Modelli degli installatori** (`comune/installatore`): derivati dai modelli NSIS e WiX del bundler di Tauri (MIT OR Apache-2.0), con l'avviso di copyright conservato in testa ai file.
- **Correttore ortografico**: usa le funzioni del sistema (Windows e macOS); nessun dizionario di terzi è incluso nel programma.
