$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\build-request.ps1")).Path
& $core @args
exit $LASTEXITCODE
