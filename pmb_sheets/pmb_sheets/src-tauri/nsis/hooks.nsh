; Punti di aggancio dell'installer NSIS di pmb_sheets (ASCII soltanto: NSIS non vuole accenti in un file senza BOM).
; Come pmb_docs (la suite pmb_office ha la stessa disinstallazione): alla disinstallazione si toglie la cartella madre pmb_office,
; ma solo se l'installazione era in ...\pmb_office\<programma> e la madre e' rimasta vuota.

!macro NSIS_HOOK_POSTUNINSTALL
  StrLen $R1 "\pmb_office\${PRODUCTNAME}"
  StrCpy $R2 "$INSTDIR" "" -$R1
  ${If} $R2 == "\pmb_office\${PRODUCTNAME}"
    RMDir "$INSTDIR\.."
  ${EndIf}
!macroend
