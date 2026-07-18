$core = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\scripts\shadow-write\select-candidates.ps1")).Path
& $core @args
exit $LASTEXITCODE
