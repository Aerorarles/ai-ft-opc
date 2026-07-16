[CmdletBinding()]
param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 15432,
  [string]$Database = "aiopc",
  [string]$ReadonlyUser = "aiopc_readonly"
)

$ErrorActionPreference = "Stop"
function Fail([string]$Message) { [Console]::Error.WriteLine($Message); exit 1 }
function ClassifyDatabaseFailure([object[]]$FailureOutput) {
  $message = ($FailureOutput | ForEach-Object { [string]$_ }) -join "`n"
  if ($message -match '(?i)no password supplied') { Fail "PGPASS_ENTRY_NOT_MATCHED" }
  if ($message -match '(?i)password authentication failed') { Fail "DATABASE_PASSWORD_MISMATCH" }
  Fail "DATABASE_CONNECTION_FAILED"
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$required = @(
  "docs/project-context/AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md",
  "docs/project-status/AI-FT-OPC-CURRENT-STATUS.md",
  ".project-control/PROJECT-CONTROL.yaml",
  ".project-control/EXECUTION-POLICY.yaml",
  ".project-control/APPROVAL-GATES.yaml",
  ".project-control/NEXT-ACTION.yaml",
  ".project-control/CURRENT-WORK-PACKAGE.yaml"
)
foreach ($relativePath in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
    Fail "BLOCKED_MASTER_OR_AUTHORITY_MISSING: $relativePath"
  }
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { Fail "BLOCKED_PSQL_MISSING" }
if (-not (Get-Command pg_isready -ErrorAction SilentlyContinue)) { Fail "BLOCKED_PG_ISREADY_MISSING" }
$psqlCommand = Get-Command psql -ErrorAction Stop
$appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$pgpassExists = -not [string]::IsNullOrWhiteSpace($env:PGPASSFILE) -and (Test-Path -LiteralPath $env:PGPASSFILE -PathType Leaf)
$pgpassNonEmpty = $false
if ($pgpassExists) {
  $pgpassItem = Get-Item -LiteralPath $env:PGPASSFILE -Force -ErrorAction Stop
  $pgpassNonEmpty = ($pgpassItem -is [System.IO.FileInfo]) -and $pgpassItem.Length -gt 0
}
Write-Output ("WINDOWS_IDENTITY={0}" -f [Security.Principal.WindowsIdentity]::GetCurrent().Name)
Write-Output ("APPLICATION_DATA={0}" -f $appData)
Write-Output ("PSQL_SOURCE={0}" -f $psqlCommand.Source)
Write-Output ("PGPASSFILE={0}" -f $env:PGPASSFILE)
Write-Output ("PGPASS_EXISTS={0}" -f $pgpassExists.ToString().ToLowerInvariant())
Write-Output ("PGPASS_NONEMPTY={0}" -f $pgpassNonEmpty.ToString().ToLowerInvariant())
if (-not $pgpassExists) { Fail "PGPASS_FILE_NOT_FOUND" }
if (-not $pgpassNonEmpty) { Fail "PGPASS_FILE_EMPTY" }
$psqlVersion = @(& $psqlCommand.Source --version 2>&1)
Write-Output ("PSQL_VERSION={0}" -f (($psqlVersion | ForEach-Object { [string]$_ }) -join " "))
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$readiness = @(& pg_isready -h $HostName -p $Port -d $Database 2>&1)
$readinessExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($readinessExitCode -ne 0) { Fail "DATABASE_CONNECTION_FAILED" }
$readiness | Out-Host
$identitySql = @"
BEGIN READ ONLY;
SELECT current_user AS database_user,
       current_database() AS database_name,
       current_setting('transaction_read_only') AS transaction_read_only;
ROLLBACK;
"@
$ErrorActionPreference = "Continue"
$identity = @(& psql -X -w -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $ReadonlyUser -d $Database -c $identitySql 2>&1)
$identityExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
Write-Output ("PSQL_EXIT_CODE={0}" -f $identityExitCode)
if ($identityExitCode -ne 0) { ClassifyDatabaseFailure $identity }
$identity | Out-Host
Write-Output "CURRENT_USER_DATABASE_OK=true"
Write-Output "PASS: authority files, PostgreSQL tools, endpoint, identity, and read-only transaction are available."
