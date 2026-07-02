$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $scriptDir "codex\interchange"

if (-not (Test-Path $source)) {
  throw "Cannot find Codex skill source at $source"
}

$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$skillsDir = Join-Path $codexHome "skills"
$target = Join-Path $skillsDir "interchange"

New-Item -ItemType Directory -Force $skillsDir | Out-Null
Copy-Item -Recurse -Force $source $target

Write-Host "Installed Interchange Codex skill to $target"
Write-Host "Restart Codex if the skill list does not refresh automatically, then invoke it as `$interchange."
