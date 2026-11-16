; Punti di aggancio dell'installer NSIS di pmb_sheets (ASCII soltanto: NSIS non vuole accenti in un file senza BOM).
; Come pmb_docs (la suite pmb_office si comporta allo stesso modo):
; 1) pmb_sheets compare nell'elenco "Apri con" per .xlsx .ods .csv SENZA diventare il programma predefinito
;    (le voci vanno solo sotto Applications\ e OpenWithList: non si tocca il valore predefinito di .xlsx/.csv di Excel).
;    Solo .psheet, formato proprio, e' associato da Tauri con fileAssociations.
; 2) riparazione: fino alla 0.2.4 Tauri associava anche .xlsx e .ods a pmb_sheets (classi "Cartella di lavoro Excel" e
;    "Foglio OpenDocument"), togliendo .xlsx a Excel. Se il valore e' ancora quello, .xlsx torna a Excel.Sheet.12 (se Excel
;    c'e') e .ods resta senza programma predefinito; le due classi improprie si cancellano.
; 3) alla disinstallazione si tolgono le voci di "Apri con" e, se e' vuota, la cartella madre pmb_office.

!macro PMB_SHEETS_RIPARA_ASSOCIAZIONI
  ReadRegStr $R3 SHCTX "Software\Classes\.xlsx" ""
  ${If} $R3 == "Cartella di lavoro Excel"
    ReadRegStr $R4 HKCR "Excel.Sheet.12\shell\open\command" ""
    ${If} $R4 != ""
      WriteRegStr SHCTX "Software\Classes\.xlsx" "" "Excel.Sheet.12"
    ${Else}
      DeleteRegValue SHCTX "Software\Classes\.xlsx" ""
    ${EndIf}
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.xlsx" "Cartella di lavoro Excel_backup"
  ReadRegStr $R3 SHCTX "Software\Classes\.ods" ""
  ${If} $R3 == "Foglio OpenDocument"
    DeleteRegValue SHCTX "Software\Classes\.ods" ""
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.ods" "Foglio OpenDocument_backup"
  DeleteRegKey SHCTX "Software\Classes\Cartella di lavoro Excel"
  DeleteRegKey SHCTX "Software\Classes\Foglio OpenDocument"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro PMB_SHEETS_RIPARA_ASSOCIAZIONI
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".xlsx" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".ods" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".csv" ""
  WriteRegStr SHCTX "Software\Classes\.xlsx\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  WriteRegStr SHCTX "Software\Classes\.ods\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  WriteRegStr SHCTX "Software\Classes\.csv\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.xlsx\OpenWithList\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.ods\OpenWithList\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.csv\OpenWithList\${MAINBINARYNAME}.exe"
  !insertmacro PMB_SHEETS_RIPARA_ASSOCIAZIONI
  ; .psheet e' un formato solo nostro: si toglie del tutto (Tauri ripristinerebbe il valore precedente, che dopo una reinstallazione e' il nostro stesso)
  DeleteRegKey SHCTX "Software\Classes\.psheet"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ; cartella madre pmb_office: si toglie solo se l'installazione era in ...\pmb_office\<programma> e la madre e' rimasta vuota
  StrLen $R1 "\pmb_office\${PRODUCTNAME}"
  StrCpy $R2 "$INSTDIR" "" -$R1
  ${If} $R2 == "\pmb_office\${PRODUCTNAME}"
    RMDir "$INSTDIR\.."
  ${EndIf}
!macroend
