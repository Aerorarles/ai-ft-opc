$resolver = Join-Path $PSScriptRoot "resolve-pgpass.ps1"
$pgpass = . $resolver
if ([string]::IsNullOrWhiteSpace($pgpass)) { exit 1 }
$env:PGPASSFILE = $pgpass

$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\preflight.ps1")).Path
& $core @args
exit $LASTEXITCODE
