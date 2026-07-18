[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet("local")][string]$TenantId,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F-]{36}$')][string]$LeadId,
  [Parameter(Mandatory = $true)][string]$CompanyName,
  [Parameter(Mandatory = $true)][ValidateSet("v1")][string]$ConfigVersion,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ConfigArtifactSha256,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ConfigChecksum,
  [Parameter(Mandatory = $true)][ValidateSet("0.6")][string]$EngineVersion,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$CandidateEvidenceHash,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$InputSnapshotHash,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$WriterPackageHash,
  [ValidateSet("aiopc_shadow_writer_m1")][string]$WriterDatabaseRole = "aiopc_shadow_writer_m1",
  [string]$RollbackOwner = "Jiaolong Li",
  [ValidateRange(1, 24)][int]$ExpiresInHours = 24,
  [string]$OutputPath = ".project-control/runtime/M1-SHADOW-WRITE-REQUEST.yaml"
)

$ErrorActionPreference = "Stop"
try { [void][guid]::Parse($LeadId) } catch { throw "LeadId must be UUID" }
if ($CompanyName -match "[\r\n]") { throw "CompanyName must be a single line" }
$requestId = "swr-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-" + ([guid]::NewGuid().ToString("N").Substring(0, 8))
$traceId = [guid]::NewGuid().ToString()
$created = (Get-Date).ToUniversalTime().ToString("o")
$expires = (Get-Date).AddHours($ExpiresInHours).ToUniversalTime().ToString("o")
function Hash([string]$Value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace("-", "").ToLowerInvariant()
  } finally { $sha.Dispose() }
}
function CanonicalToken([object]$Value) {
  if ($null -eq $Value) { return "" }
  return ([string]$Value).Trim().Replace("|", "/")
}
$idempotencyKey = Hash ((@($TenantId, $LeadId, $ConfigVersion, $ConfigChecksum.ToLowerInvariant(), $EngineVersion, "shadow-only") | ForEach-Object { CanonicalToken $_ }) -join "|")
$rowLimits = [ordered]@{
  "public.lead_operation_idempotency_claims" = 1
  "public.lead_scoring_shadow_runs" = 1
  "public.lead_scoring_shadow_results" = 1
  "public.lead_scoring_shadow_diff" = 1
  "public.lead_scoring_shadow_explanations" = 5
  "public.lead_audit_events" = 1
}
$tableScope = (($rowLimits.Keys | Sort-Object) | ForEach-Object { "$_`:$($rowLimits[$_])" }) -join ","
$scopeParts = @(
  $requestId, $TenantId, $LeadId, $ConfigVersion, $ConfigArtifactSha256.ToLowerInvariant(),
  $ConfigChecksum.ToLowerInvariant(),
  $EngineVersion, "not-configured", $CandidateEvidenceHash.ToLowerInvariant(),
  $InputSnapshotHash.ToLowerInvariant(),
  $WriterPackageHash.ToLowerInvariant(), $WriterDatabaseRole, $tableScope
) | ForEach-Object { CanonicalToken $_ }
$scopeHash = Hash ($scopeParts -join "|")
$template = Join-Path $PSScriptRoot "assets\M1-SHADOW-WRITE-REQUEST.template.yaml"
$content = Get-Content -LiteralPath $template -Raw -Encoding utf8
$replacements = [ordered]@{
  "__REQUEST_ID__" = $requestId
  "__TRACE_ID__" = $traceId
  "__IDEMPOTENCY_KEY__" = $idempotencyKey
  "__CREATED_AT__" = $created
  "__EXPIRES_AT__" = $expires
  "__CANDIDATE_EVIDENCE_HASH__" = $CandidateEvidenceHash.ToLowerInvariant()
  "__INPUT_SNAPSHOT_HASH__" = $InputSnapshotHash.ToLowerInvariant()
  "__TENANT_ID__" = $TenantId
  "__LEAD_ID__" = $LeadId.ToLowerInvariant()
  "__COMPANY_NAME__" = $CompanyName.Replace('"', "'")
  "__CONFIG_VERSION__" = $ConfigVersion
  "__CONFIG_ARTIFACT_SHA256__" = $ConfigArtifactSha256.ToLowerInvariant()
  "__CONFIG_CHECKSUM__" = $ConfigChecksum.ToLowerInvariant()
  "__ENGINE_VERSION__" = $EngineVersion
  "__WRITER_PACKAGE_HASH__" = $WriterPackageHash.ToLowerInvariant()
  "__WRITER_DATABASE_ROLE__" = $WriterDatabaseRole
  "__APPROVAL_SCOPE_HASH__" = $scopeHash
  "__ROLLBACK_OWNER__" = $RollbackOwner.Replace('"', "'")
}
foreach ($key in $replacements.Keys) { $content = $content.Replace($key, $replacements[$key]) }
$parent = Split-Path $OutputPath -Parent
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
Set-Content -LiteralPath $OutputPath -Value $content -Encoding utf8
Write-Output "Created $OutputPath"
Write-Output "Request ID: $requestId"
Write-Output "Trace ID: $traceId"
Write-Output "Idempotency key: $idempotencyKey"
Write-Output "Approval scope hash: $scopeHash"
