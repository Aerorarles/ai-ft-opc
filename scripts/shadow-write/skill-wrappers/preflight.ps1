$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\preflight.ps1")).Path
& $core @args
exit $LASTEXITCODE
