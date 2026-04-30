; League install folder — runs at start of install section (after user chose app directory and clicked Install).
; Silent (/S) installs skip the dialog; user can set the path in app onboarding.
; Writes UTF-8 path to %APPDATA%\Lelanation\Companion\league-path-from-installer.txt (consumed on first app launch).

!include nsDialogs.nsh

!macro NSIS_HOOK_PREINSTALL
  ; IfSilent: jump when silent → skip dialog; when not silent → ask for League folder
  IfSilent lelanationLeagueDirDone lelanationAskLeagueDir
  lelanationAskLeagueDir:
    nsDialogs::SelectFolderDialog "League of Legends — select the game root folder (e.g. …\Riot Games\League of Legends)" "C:\Riot Games\League of Legends"
    Pop $R9
    StrCmp $R9 "error" lelanationLeagueDirDone
    StrCmp $R9 "" lelanationLeagueDirDone
    ReadEnvStr $R8 "APPDATA"
    StrCmp $R8 "" lelanationLeagueDirDone
    CreateDirectory "$R8\Lelanation\Companion"
    ClearErrors
    FileOpen $4 "$R8\Lelanation\Companion\league-path-from-installer.txt" w
    IfErrors lelanationLeagueDirDone
    FileWrite $4 $R9
    FileClose $4
  lelanationLeagueDirDone:
!macroend
