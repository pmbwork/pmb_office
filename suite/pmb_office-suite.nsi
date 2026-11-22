; Installer della suite pmb_office: una sola finestra per installare pmb_docs, pmb_sheets o tutti e due.
; Dentro ci sono gli installer di sempre dei due programmi (quelli in RILASCI), lanciati in silenzio: ognuno resta un programma separato,
; con la sua versione, il suo aggiornamento e la sua voce in "App installate" per disinstallarlo. La suite non ha un disinstallatore suo.
; Prima di installare si leggono e si accettano (con una casella) la licenza di pmb_office e le licenze dei componenti di terze parti;
; nella pagina delle scelte, oltre ai programmi, si scelgono i collegamenti (Desktop, menu Start).
; Si costruisce con crea-suite.ps1 (che passa versioni, percorsi, icona e testi delle licenze): non lanciare makensis a mano.
Unicode true
ManifestDPIAware true
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "Sections.nsh"
!include "x64.nsh"
!include "StrFunc.nsh"
${StrStr}

; ---- valori passati da crea-suite.ps1 ----
!ifndef VERSIONE_SUITE
  !error "Manca VERSIONE_SUITE: costruire con crea-suite.ps1"
!endif
!define NOME "pmb_office"

Name "${NOME}"
OutFile "${USCITA}"
InstallDir "$PROGRAMFILES64\pmb_office"
BrandingText "${NOME} ${VERSIONE_SUITE}"
VIProductVersion "${VERSIONE_SUITE_NUMERICA}"
VIAddVersionKey /LANG=1040 "ProductName" "${NOME}"
VIAddVersionKey /LANG=1040 "FileDescription" "Installer della suite ${NOME} (pmb_docs ${VERSIONE_DOCS}, pmb_sheets ${VERSIONE_SHEETS})"
VIAddVersionKey /LANG=1040 "FileVersion" "${VERSIONE_SUITE}"
VIAddVersionKey /LANG=1040 "ProductVersion" "${VERSIONE_SUITE}"
VIAddVersionKey /LANG=1040 "CompanyName" "PMB"
VIAddVersionKey /LANG=1040 "LegalCopyright" "© PMB"

!define MUI_ICON "${ICONA}"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!ifdef IMMAGINE_LATERALE
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${IMMAGINE_LATERALE}"
!endif
!ifdef IMMAGINE_TESTATA
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "${IMMAGINE_TESTATA}"
!endif
; la lingua delle finestre: si chiede all'avvio (proposta quella di Windows), come l'installer di pmb_docs
!define MUI_LANGDLL_ALLLANGUAGES

; il testo va definito prima della pagina (MUI lo legge quando la inserisce)
!define MUI_WELCOMEPAGE_TEXT "$(TestoBenvenuto)"
!insertmacro MUI_PAGE_WELCOME
; le due licenze: il pulsante Avanti si accende solo con la casella «Accetto»
!define MUI_PAGE_HEADER_TEXT "$(TitoloLicenza)"
!define MUI_PAGE_HEADER_SUBTEXT "$(SottotitoloLicenza)"
!define MUI_LICENSEPAGE_TEXT_TOP "$(SopraLicenza)"
!define MUI_LICENSEPAGE_CHECKBOX
!define MUI_LICENSEPAGE_CHECKBOX_TEXT "$(AccettoLicenza)"
!insertmacro MUI_PAGE_LICENSE "${LICENZA}"
!define MUI_PAGE_HEADER_TEXT "$(TitoloTerzi)"
!define MUI_PAGE_HEADER_SUBTEXT "$(SottotitoloTerzi)"
!define MUI_LICENSEPAGE_TEXT_TOP "$(SopraTerzi)"
!define MUI_LICENSEPAGE_CHECKBOX
!define MUI_LICENSEPAGE_CHECKBOX_TEXT "$(AccettoTerzi)"
!insertmacro MUI_PAGE_LICENSE "${LICENZE_TERZI}"
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ControllaScelta
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Italian"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString TestoBenvenuto ${LANG_ITALIAN} "Questo programma installa la suite per ufficio ${NOME} sul computer.$\r$\n$\r$\nPrima leggi e accetta le licenze; poi scegli quali programmi installare, pmb_docs (documenti di testo) e pmb_sheets (fogli di calcolo), e dove mettere i collegamenti (Desktop, menu Start). Ognuno resta un programma separato, che si aggiorna e si disinstalla da solo.$\r$\n$\r$\nI programmi funzionano sul tuo computer, senza bisogno di Internet."
LangString TestoBenvenuto ${LANG_ENGLISH} "This program installs the ${NOME} office suite on your computer.$\r$\n$\r$\nFirst read and accept the licenses; then choose which programs to install, pmb_docs (text documents) and pmb_sheets (spreadsheets), and where to put the shortcuts (Desktop, Start menu). Each one stays a separate program, updated and uninstalled on its own.$\r$\n$\r$\nThe programs work on your computer, with no need for the Internet."
LangString DescrDocs ${LANG_ITALIAN} "pmb_docs ${VERSIONE_DOCS}: documenti di testo (DOCX, ODT, PDF e altri)."
LangString DescrDocs ${LANG_ENGLISH} "pmb_docs ${VERSIONE_DOCS}: text documents (DOCX, ODT, PDF and more)."
LangString DescrSheets ${LANG_ITALIAN} "pmb_sheets ${VERSIONE_SHEETS}: fogli di calcolo (XLSX, ODS, CSV e altri)."
LangString DescrSheets ${LANG_ENGLISH} "pmb_sheets ${VERSIONE_SHEETS}: spreadsheets (XLSX, ODS, CSV and more)."
LangString TitoloLicenza ${LANG_ITALIAN} "Licenza di ${NOME}"
LangString TitoloLicenza ${LANG_ENGLISH} "${NOME} license"
LangString SottotitoloLicenza ${LANG_ITALIAN} "Leggi le condizioni prima di installare."
LangString SottotitoloLicenza ${LANG_ENGLISH} "Please read the terms before installing."
LangString SopraLicenza ${LANG_ITALIAN} "${NOME} si usa secondo la licenza GNU GPL versione 3. Scorri il testo per leggerlo tutto."
LangString SopraLicenza ${LANG_ENGLISH} "${NOME} is used under the GNU GPL version 3 license. Scroll to read the whole text."
LangString AccettoLicenza ${LANG_ITALIAN} "Accetto le condizioni della licenza di ${NOME}"
LangString AccettoLicenza ${LANG_ENGLISH} "I accept the terms of the ${NOME} license"
LangString TitoloTerzi ${LANG_ITALIAN} "Componenti di terze parti"
LangString TitoloTerzi ${LANG_ENGLISH} "Third-party components"
LangString SottotitoloTerzi ${LANG_ITALIAN} "I programmi contengono componenti di altri autori, con le loro licenze."
LangString SottotitoloTerzi ${LANG_ENGLISH} "The programs contain components by other authors, under their own licenses."
LangString SopraTerzi ${LANG_ITALIAN} "Componenti inclusi e testi delle loro licenze (anche in Aiuto > Informazioni)."
LangString SopraTerzi ${LANG_ENGLISH} "Included components and their license texts (also in Help > About)."
LangString AccettoTerzi ${LANG_ITALIAN} "Accetto le condizioni delle licenze dei componenti di terze parti"
LangString AccettoTerzi ${LANG_ENGLISH} "I accept the license terms of the third-party components"
LangString GruppoCollegamenti ${LANG_ITALIAN} "Collegamenti"
LangString GruppoCollegamenti ${LANG_ENGLISH} "Shortcuts"
LangString CollDesktop ${LANG_ITALIAN} "Sul Desktop"
LangString CollDesktop ${LANG_ENGLISH} "On the Desktop"
LangString CollStart ${LANG_ITALIAN} "Nel menu Start"
LangString CollStart ${LANG_ENGLISH} "In the Start menu"
LangString DescrCollegamenti ${LANG_ITALIAN} "Dove mettere i collegamenti per aprire i programmi scelti."
LangString DescrCollegamenti ${LANG_ENGLISH} "Where to put the shortcuts that open the chosen programs."
LangString DescrDesktop ${LANG_ITALIAN} "Un'icona per ogni programma sul Desktop (per tutti gli utenti del computer)."
LangString DescrDesktop ${LANG_ENGLISH} "An icon for each program on the Desktop (for all users of the computer)."
LangString DescrStart ${LANG_ITALIAN} "Una voce per ogni programma nel menu Start, nella cartella ${NOME}."
LangString DescrStart ${LANG_ENGLISH} "An entry for each program in the Start menu, in the ${NOME} folder."
LangString NessunaScelta ${LANG_ITALIAN} "Scegli almeno un programma da installare."
LangString NessunaScelta ${LANG_ENGLISH} "Choose at least one program to install."
LangString Installo ${LANG_ITALIAN} "Installazione di"
LangString Installo ${LANG_ENGLISH} "Installing"
LangString Fallito ${LANG_ITALIAN} "L'installazione non è riuscita (codice"
LangString Fallito ${LANG_ENGLISH} "The installation failed (code"
LangString FallitoAvviso ${LANG_ITALIAN} "Uno dei programmi non si è installato: i dettagli sono nell'elenco. Puoi riprovare con l'installer di quel programma."
LangString FallitoAvviso ${LANG_ENGLISH} "One of the programs was not installed: the details are in the list. You can try again with that program's installer."
LangString ProgrammaAperto ${LANG_ITALIAN} "è aperto. Chiudilo (salvando il lavoro) e premi Riprova. Con Annulla quel programma non si installa e resta com'è."
LangString ProgrammaAperto ${LANG_ENGLISH} "is open. Close it (saving your work) and press Retry. With Cancel that program is not installed and stays as it is."
LangString NonInstallatoAperto ${LANG_ITALIAN} "non installato: il programma era aperto"
LangString NonInstallatoAperto ${LANG_ENGLISH} "not installed: the program was open"


Var errori
Var fattoDocs
Var fattoSheets

; ---- un programma: copia il suo installer nella cartella temporanea della suite e lo lancia in silenzio nella sua sottocartella ----
!macro InstallaProgramma NOME_PROG FILE_SETUP ESEGUIBILE FATTO
  DetailPrint "$(Installo) ${NOME_PROG}…"
  ; il programma aperto si chiude prima, chiedendolo: in silenzio l'installer di Tauri lo chiuderebbe a forza (lavoro non salvato perso)
  StrCpy $R8 "${NOME_PROG}"
  StrCpy $R7 "${ESEGUIBILE}"
  Call ControllaAperto
  ${If} $R6 == 0
    DetailPrint "${NOME_PROG}: $(NonInstallatoAperto)"
    IntOp $errori $errori + 1
  ${Else}
    ; in silenzio l'installer di Tauri non toglie una vecchia installazione fatta con l'MSI: lo fa la suite, se no restano due voci in "App installate"
    StrCpy $R9 "${NOME_PROG}"
    Call TogliInstallazioneMsi
    SetOutPath "$PLUGINSDIR"
    File "/oname=${NOME_PROG}-setup.exe" "${FILE_SETUP}"
    ; /D va per ultimo e senza virgolette (regola di NSIS)
    ExecWait '"$PLUGINSDIR\${NOME_PROG}-setup.exe" /S /D=$INSTDIR\${NOME_PROG}' $0
    ${If} $0 != 0
      DetailPrint "${NOME_PROG}: $(Fallito) $0)"
      IntOp $errori $errori + 1
    ${Else}
      DetailPrint "${NOME_PROG}: OK"
      StrCpy ${FATTO} 1
    ${EndIf}
    Delete "$PLUGINSDIR\${NOME_PROG}-setup.exe"
  ${EndIf}
!macroend

; $R8 = nome del programma, $R7 = il suo eseguibile. Se è aperto chiede di chiuderlo (Riprova / Annulla); $R6 = 1 se si può installare,
; 0 se l'utente ha annullato. Nella suite lanciata in silenzio (/S) la risposta è Annulla: un programma aperto non si chiude mai a forza.
Function ControllaAperto
  StrCpy $R6 1
  controlla:
    nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq $R7" /NH /FO CSV'
    Pop $0
    Pop $1
    ${StrStr} $2 $1 "$R7"
    ${If} $2 != ""
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$R8 $(ProgrammaAperto)" /SD IDCANCEL IDRETRY controlla
      StrCpy $R6 0
    ${EndIf}
FunctionEnd

; $R9 = nome del programma. Cerca in "App installate" (per tutto il computer) una voce con quel nome installata da Windows Installer e la toglie;
; i dati del programma (cartella data, impostazioni) non sono file dell'MSI e restano.
Function TogliInstallazioneMsi
  StrCpy $3 0
  cerca:
    EnumRegKey $4 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $3
    StrCmp $4 "" fatto
    IntOp $3 $3 + 1
    ReadRegStr $5 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$4" "DisplayName"
    StrCmp $5 $R9 0 cerca
    ReadRegDWORD $6 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$4" "WindowsInstaller"
    IntCmp $6 1 0 cerca cerca
    DetailPrint "$R9: MSI $4 → msiexec /x"
    ExecWait 'msiexec.exe /x $4 /qn /norestart' $7
    DetailPrint "$R9: msiexec $7"
    StrCpy $3 0   ; le chiavi sono cambiate: si ricomincia l'elenco
    Goto cerca
  fatto:
FunctionEnd

Section "pmb_docs ${VERSIONE_DOCS}" SezDocs
  !insertmacro InstallaProgramma "pmb_docs" "${SETUP_DOCS}" "pmb-docs-shell.exe" $fattoDocs
SectionEnd

Section "pmb_sheets ${VERSIONE_SHEETS}" SezSheets
  !insertmacro InstallaProgramma "pmb_sheets" "${SETUP_SHEETS}" "pmb-sheets-shell.exe" $fattoSheets
SectionEnd

; I collegamenti: l'installer di ogni programma, lanciato in silenzio, li crea sempre tutti e due (Desktop e menu Start, per tutti gli
; utenti, con l'identità del programma per la barra delle applicazioni). La suite toglie quelli che non sono stati scelti: così i
; collegamenti restano proprio quelli del programma e la sua disinstallazione li toglie. Gli aggiornamenti dei programmi non li ricreano.
SectionGroup /e "$(GruppoCollegamenti)" SezCollegamenti
  Section "$(CollDesktop)" SezDesktop
  SectionEnd
  Section "$(CollStart)" SezStart
  SectionEnd
SectionGroupEnd

!macro TogliCollegamenti NOME_PROG FATTO
  ${If} ${FATTO} == 1
    ${IfNot} ${SectionIsSelected} ${SezDesktop}
      Delete "$DESKTOP\${NOME_PROG}.lnk"
      DetailPrint "${NOME_PROG}: nessun collegamento sul Desktop"
    ${EndIf}
    ${IfNot} ${SectionIsSelected} ${SezStart}
      Delete "$SMPROGRAMS\${NOME}\${NOME_PROG}.lnk"
      DetailPrint "${NOME_PROG}: nessun collegamento nel menu Start"
    ${EndIf}
  ${EndIf}
!macroend

Section "-collegamenti"
  SetShellVarContext all
  !insertmacro TogliCollegamenti "pmb_docs" $fattoDocs
  !insertmacro TogliCollegamenti "pmb_sheets" $fattoSheets
  RMDir "$SMPROGRAMS\${NOME}"   ; solo se è rimasta vuota
SectionEnd

Section "-fine"
  ${If} $errori > 0
    SetDetailsView show
    IfSilent +2
      MessageBox MB_ICONEXCLAMATION "$(FallitoAvviso)"
    SetErrorLevel 2
  ${EndIf}
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SezDocs} "$(DescrDocs)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SezSheets} "$(DescrSheets)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SezCollegamenti} "$(DescrCollegamenti)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SezDesktop} "$(DescrDesktop)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SezStart} "$(DescrStart)"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "pmb_office: Windows 64 bit."
    Abort
  ${EndIf}
  SetRegView 64
  StrCpy $errori 0
  StrCpy $fattoDocs 0
  StrCpy $fattoSheets 0
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

; uscendo dalla pagina dei componenti: almeno un programma scelto
Function ControllaScelta
  SectionGetFlags ${SezDocs} $1
  SectionGetFlags ${SezSheets} $2
  IntOp $1 $1 & ${SF_SELECTED}
  IntOp $2 $2 & ${SF_SELECTED}
  ${If} $1 == 0
  ${AndIf} $2 == 0
    MessageBox MB_ICONEXCLAMATION "$(NessunaScelta)"
    Abort
  ${EndIf}
FunctionEnd
