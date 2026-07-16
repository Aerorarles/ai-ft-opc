[CmdletBinding()]
param(
  [string]$RequestPath = ".project-control/runtime/M1-SHADOW-WRITE-REQUEST.yaml",
  [ValidateSet("127.0.0.1")][string]$HostName = "127.0.0.1",
  [ValidateSet(15432)][int]$Port = 15432,
  [ValidateSet("aiopc")][string]$Database = "aiopc",
  [ValidateSet("aiopc_shadow_writer_m1")][string]$WriterUser = "aiopc_shadow_writer_m1"
)

$ErrorActionPreference = "Stop"
$pgpass = . (Join-Path $PSScriptRoot "resolve-pgpass.ps1")
if ([string]::IsNullOrWhiteSpace($pgpass)) { exit 1 }
$env:PGPASSFILE = $pgpass
if (-not [string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
  [Console]::Error.WriteLine("PGPASSWORD_PROHIBITED")
  exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$entry = Join-Path $PSScriptRoot "execute-approved-single-lead.ts"
& npx.cmd tsx $entry --request (Join-Path $repoRoot $RequestPath) `
  --host $HostName --port $Port --database $Database --user $WriterUser
exit $LASTEXITCODE
