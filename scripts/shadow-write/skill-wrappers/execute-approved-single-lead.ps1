$pgpass = . (Join-Path $PSScriptRoot "resolve-pgpass.ps1")
if ([string]::IsNullOrWhiteSpace($pgpass)) { exit 1 }
$env:PGPASSFILE = $pgpass

$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\execute-approved-single-lead.ps1")).Path
& $core @args
exit $LASTEXITCODE
