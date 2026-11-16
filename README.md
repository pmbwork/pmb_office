# pmb_office

**pmb_docs** (documenti di testo) e **pmb_sheets** (fogli di calcolo): la suite per ufficio di PMB che lavora sul tuo computer, senza bisogno di Internet. I documenti restano sul tuo computer.

**pmb_docs** (text documents) and **pmb_sheets** (spreadsheets): PMB's office suite that works on your computer, offline. Your documents stay on your computer.

## Scarica · Download

Dalla pagina **[Releases](../../releases/latest)** scarica il file per il tuo sistema:

| Sistema · System | File | |
|---|---|---|
| Windows 10 / 11 (64 bit) | `pmb_office_<versione>_x64-setup.exe` | durante l'installazione scegli i programmi · choose the programs during setup |
| macOS 11 o successivo (Apple Silicon e Intel) | `pmb_office_<versione>_universal.pkg` | nella schermata «Personalizza» scegli i programmi · choose the programs in «Customize» |

L'impronta SHA-256 di ogni file è scritta nella descrizione della release, per controllare che il file scaricato sia integro.
The SHA-256 of each file is listed in the release notes, to check the download.

### Al primo avvio · First start

I programmi non sono ancora firmati con un certificato a pagamento:
- **Windows** può mostrare «Windows ha protetto il PC»: *Ulteriori informazioni › Esegui comunque*.
- **macOS** può bloccare il pacchetto: tasto destro sul file › *Apri*, oppure *Impostazioni di Sistema › Privacy e sicurezza › Apri comunque*.

The programs are not yet signed with a paid certificate: on Windows choose *More info › Run anyway*; on macOS right-click the file › *Open*, or *System Settings › Privacy & Security › Open anyway*.

## Lingue · Languages

Italiano e inglese: la lingua si sceglie in *Strumenti › Preferenze* (Automatica segue la lingua del sistema).
Italian and English: choose in *Tools › Preferences* (Automatic follows the system language).

## Licenza · Licence

pmb_docs e pmb_sheets sono **software libero** con licenza **GNU GPL v3** (file [LICENSE](LICENSE)). Il **codice sorgente completo** è in questo repository (vedi sotto). Il nome PMB, il logo PMB e i nomi pmb_office, pmb_docs e pmb_sheets appartengono a PMB e non sono coperti dalla licenza.

pmb_docs and pmb_sheets are **free software** under the **GNU GPL v3** licence ([LICENSE](LICENSE)). The **complete source code** is in this repository (see below). The PMB name and logo and the names pmb_office, pmb_docs and pmb_sheets belong to PMB and are not covered by the licence.

Le licenze dei componenti di terze parti sono nei programmi: *Informazioni › Licenze di terze parti*.
Third-party licences are in the programs: *About › Third-party licences*.

## Codice sorgente · Source code

| Cartella · Folder | Contenuto · Contents |
|---|---|
| [`pmb_docs/`](pmb_docs) | documenti di testo · text documents (Tauri 2 + TypeScript) |
| [`pmb_sheets/pmb_sheets/`](pmb_sheets/pmb_sheets) | fogli di calcolo · spreadsheets (Tauri 2 + TypeScript) |
| [`comune/`](comune) | codice in comune ai due programmi · code shared by both programs |
| [`suite/`](suite) | installatori della suite · suite installers (Windows NSIS, macOS pkg) |
| [`media/`](media) | loghi ufficiali · official logos |

Per compilare servono Node.js 22, Rust e, su Windows, Visual Studio Build Tools: in ogni programma `npm install`, `npm test`, `npx tauri build`. Manuale tecnico: [MANUALE-UTENTE.md](MANUALE-UTENTE.md).
To build you need Node.js 22, Rust and, on Windows, Visual Studio Build Tools: in each program run `npm install`, `npm test`, `npx tauri build`. Technical manual (Italian): [MANUALE-UTENTE.md](MANUALE-UTENTE.md).

Le licenze dei componenti di terze parti sono nei programmi: *Informazioni › Licenze di terze parti*.
## Segnalazioni · Feedback

Usa la voce *Segnala un bug o invia un feedback* dei programmi (menu *Informazioni*, o il pulsante *Segnalazione bug*).
Use *Report a bug or send feedback* in the programs (menu *About*, or the *Report a bug* button).
