$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\validate-request.ps1")).Path
& $core @args
exit $LASTEXITCODE
