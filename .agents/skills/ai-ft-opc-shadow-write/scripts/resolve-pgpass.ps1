[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Fail([string]$Code) {
  [Console]::Error.WriteLine($Code)
  exit 1
}

$appData = [Environment]::GetFolderPath(
  [Environment+SpecialFolder]::ApplicationData
)

if ([string]::IsNullOrWhiteSpace($appData)) {
  Fail "PGPASS_PATH_UNAVAILABLE"
}

$pgpass = Join-Path $appData "postgresql\pgpass.conf"
if (-not (Test-Path -LiteralPath $pgpass -PathType Leaf)) {
  Fail "PGPASS_FILE_NOT_FOUND"
}

try {
  $pgpassFile = Get-Item -LiteralPath $pgpass -Force -ErrorAction Stop
} catch {
  Fail "PGPASS_FILE_NOT_FOUND"
}

if (-not ($pgpassFile -is [System.IO.FileInfo])) {
  Fail "PGPASS_FILE_NOT_FOUND"
}
if ($pgpassFile.Length -le 0) {
  Fail "PGPASS_FILE_EMPTY"
}

Write-Output $pgpass
