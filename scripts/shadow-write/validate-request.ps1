[CmdletBinding()]
param(
  [string]$RequestPath = ".project-control/runtime/M1-SHADOW-WRITE-REQUEST.yaml",
  [switch]$RequireApproved
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$tsx = Join-Path $repoRoot "node_modules\.bin\tsx.cmd"
if (-not (Test-Path -LiteralPath $tsx)) { throw "BLOCKED_TSX_RUNTIME_MISSING" }
if (-not (Test-Path -LiteralPath $RequestPath)) { throw "BLOCKED_REQUEST_NOT_FOUND" }
$cli = Join-Path $PSScriptRoot "validate-request-cli.ts"
$arguments = @($cli, $RequestPath)
if ($RequireApproved) { $arguments += "--require-approved" }
& $tsx @arguments
if ($LASTEXITCODE -ne 0) { throw "BLOCKED_REQUEST_VALIDATION_FAILED" }
