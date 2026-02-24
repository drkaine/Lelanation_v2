$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$companionDir = Join-Path $repoRoot "companion-app"
$installerDir = Join-Path $repoRoot "installer"
$vcvarsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$linkerPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe"
$outputExe = Join-Path $installerDir "Lelanation.exe"

if (-not (Test-Path $vcvarsPath)) {
  throw "vcvars64.bat introuvable: $vcvarsPath"
}

if (-not (Test-Path $linkerPath)) {
  throw "link.exe MSVC introuvable: $linkerPath"
}

$buildCmd = "`"$vcvarsPath`" && set PATH=%USERPROFILE%\.cargo\bin;%PATH% && set CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=$linkerPath && npm --prefix `"$companionDir`" run tauri build"
cmd /c $buildCmd
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$candidateA = Join-Path $companionDir "src-tauri\target\release\lelanation-companion.exe"
$bundleDir = Join-Path $companionDir "src-tauri\target\release\bundle"
$candidateB = $null

if (Test-Path $bundleDir) {
  $candidateB = Get-ChildItem -Path $bundleDir -Recurse -Filter *.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}

$sourceExe = $null
if (Test-Path $candidateA) {
  $sourceExe = $candidateA
} elseif ($candidateB -and (Test-Path $candidateB)) {
  $sourceExe = $candidateB
}

if (-not $sourceExe) {
  throw "Aucun .exe trouve apres le build Tauri."
}

New-Item -ItemType Directory -Force -Path $installerDir | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $outputExe -Force
Write-Host "Copie: $sourceExe -> $outputExe"
