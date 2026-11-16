; Installer della suite pmb_office: una sola finestra per installare pmb_docs, pmb_sheets o tutti e due.
; Dentro ci sono gli installer di sempre dei due programmi (quelli in RILASCI), lanciati in silenzio: ognuno resta un programma separato,
; con la sua versione, il suo aggiornamento e la sua voce in "App installate" per disinstallarlo. La suite non ha un disinstallatore suo.
; Si costruisce con crea-suite.ps1 (che passa versioni, percorsi e icona): non lanciare makensis a mano.
Unicode true
ManifestDPIAware true
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

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

!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ControllaScelta
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Italian"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_RESERVEFILE_LANGDLL

LangString TestoBenvenuto ${LANG_ITALIAN} "Questo programma installa la suite per ufficio ${NOME} sul computer.$\r$\n$\r$\nNella pagina seguente scegli quali programmi installare: pmb_docs (documenti di testo) e pmb_sheets (fogli di calcolo). Ognuno resta un programma separato, che si aggiorna e si disinstalla da solo.$\r$\n$\r$\nI programmi funzionano sul tuo computer, senza bisogno di Internet."
LangString TestoBenvenuto ${LANG_ENGLISH} "This program installs the ${NOME} office suite on your computer.$\r$\n$\r$\nOn the next page choose which programs to install: pmb_docs (text documents) and pmb_sheets (spreadsheets). Each one stays a separate program, updated and uninstalled on its own.$\r$\n$\r$\nThe programs work on your computer, with no need for the Internet."
LangString DescrDocs ${LANG_ITALIAN} "pmb_docs ${VERSIONE_DOCS}: documenti di testo (DOCX, ODT, PDF e altri)."
LangString DescrDocs ${LANG_ENGLISH} "pmb_docs ${VERSIONE_DOCS}: text documents (DOCX, ODT, PDF and more)."
LangString DescrSheets ${LANG_ITALIAN} "pmb_sheets ${VERSIONE_SHEETS}: fogli di calcolo (XLSX, ODS, CSV e altri)."
LangString DescrSheets ${LANG_ENGLISH} "pmb_sheets ${VERSIONE_SHEETS}: spreadsheets (XLSX, ODS, CSV and more)."
LangString NessunaScelta ${LANG_ITALIAN} "Scegli almeno un programma da installare."
LangString NessunaScelta ${LANG_ENGLISH} "Choose at least one program to install."
LangString Installo ${LANG_ITALIAN} "Installazione di"
LangString Installo ${LANG_ENGLISH} "Installing"
LangString Fallito ${LANG_ITALIAN} "L'installazione non è riuscita (codice"
LangString Fallito ${LANG_ENGLISH} "The installation failed (code"
LangString FallitoAvviso ${LANG_ITALIAN} "Uno dei programmi non si è installato: i dettagli sono nell'elenco. Puoi riprovare con l'installer di quel programma."
LangString FallitoAvviso ${LANG_ENGLISH} "One of the programs was not installed: the details are in the list. You can try again with that program's installer."

!define MUI_WELCOMEPAGE_TEXT "$(TestoBenvenuto)"

Var errori

; ---- un programma: copia il suo installer nella cartella temporanea della suite e lo lancia in silenzio nella sua sottocartella ----
!macro InstallaProgramma NOME_PROG FILE_SETUP
  DetailPrint "$(Installo) ${NOME_PROG}…"
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
  ${EndIf}
  Delete "$PLUGINSDIR\${NOME_PROG}-setup.exe"
!macroend

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
  !insertmacro InstallaProgramma "pmb_docs" "${SETUP_DOCS}"
SectionEnd

Section "pmb_sheets ${VERSIONE_SHEETS}" SezSheets
  !insertmacro InstallaProgramma "pmb_sheets" "${SETUP_SHEETS}"
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
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "pmb_office: Windows 64 bit."
    Abort
  ${EndIf}
  SetRegView 64
  StrCpy $errori 0
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
