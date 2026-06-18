; Add install directory to user PATH on install, remove on uninstall.
; Gives 'sb' CLI access from any terminal without manual setup.

!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $0 HKCU "Environment" "PATH"
  ${StrLoc} $1 "$0" "$INSTDIR" ">"
  StrCmp $1 "" 0 sb_path_done
    StrCmp $0 "" sb_path_empty
      WriteRegExpandStr HKCU "Environment" "PATH" "$0;$INSTDIR"
      Goto sb_path_written
    sb_path_empty:
      WriteRegExpandStr HKCU "Environment" "PATH" "$INSTDIR"
    sb_path_written:
      SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  sb_path_done:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $0 HKCU "Environment" "PATH"
  ${WordReplace} "$0" ";$INSTDIR" "" "+" $0
  ${WordReplace} "$0" "$INSTDIR;" "" "+" $0
  ${WordReplace} "$0" "$INSTDIR"  "" "+" $0
  WriteRegExpandStr HKCU "Environment" "PATH" "$0"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend
