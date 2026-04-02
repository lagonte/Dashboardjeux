' ============================================================
' Lancer DashboardJeux.vbs
' Lance le serveur en arrière-plan (fenêtre terminal cachée)
' puis ouvre le dashboard dans le navigateur par défaut.
' Double-cliquer sur ce fichier suffit.
' ============================================================

Dim oShell, oFso, strDir

Set oShell = CreateObject("WScript.Shell")
Set oFso   = CreateObject("Scripting.FileSystemObject")

' Dossier du lanceur (= dossier du .exe)
strDir = oFso.GetParentFolderName(WScript.ScriptFullName)

' Démarrer DashboardJeux.exe sans fenêtre visible (style 0)
oShell.Run Chr(34) & strDir & "\DashboardJeux.exe" & Chr(34), 0, False

' Attendre que le serveur Node soit prêt (2,5 secondes)
WScript.Sleep 2500

' Ouvrir le dashboard dans le navigateur par défaut
oShell.Run "http://localhost:3000"
