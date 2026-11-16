; Punti di aggancio dell'installer NSIS di pmb_docs (ASCII soltanto: NSIS non vuole accenti in un file senza BOM).
;
; 1) pmb_docs compare nell'elenco "Apri con" per .docx .odt .txt .md SENZA diventare il programma predefinito
;    (le voci vanno solo sotto Applications\ e OpenWithList: non si tocca mai il valore predefinito di .docx/.txt di Word o Blocco note).
;    Solo .pdoc e .fdoc, formati propri, sono associati da Tauri con fileAssociations.
; 2) alla disinstallazione si tolgono quelle voci e, se e' vuota, la cartella madre pmb_office.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".docx" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".odt" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".txt" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".md" ""
  WriteRegStr SHCTX "Software\Classes\.docx\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  WriteRegStr SHCTX "Software\Classes\.odt\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  WriteRegStr SHCTX "Software\Classes\.txt\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  WriteRegStr SHCTX "Software\Classes\.md\OpenWithList\${MAINBINARYNAME}.exe" "" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.docx\OpenWithList\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.odt\OpenWithList\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.txt\OpenWithList\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\.md\OpenWithList\${MAINBINARYNAME}.exe"
  ; .pdoc e .fdoc sono formati solo nostri: si tolgono del tutto (Tauri ripristinerebbe il valore precedente, che dopo una reinstallazione e' il nostro stesso)
  DeleteRegKey SHCTX "Software\Classes\.pdoc"
  DeleteRegKey SHCTX "Software\Classes\.fdoc"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ; cartella madre pmb_office: si toglie solo se l'installazione era in ...\pmb_office\<programma> e la madre e' rimasta vuota
  StrLen $R1 "\pmb_office\${PRODUCTNAME}"
  StrCpy $R2 "$INSTDIR" "" -$R1
  ${If} $R2 == "\pmb_office\${PRODUCTNAME}"
    RMDir "$INSTDIR\.."
  ${EndIf}
!macroend
