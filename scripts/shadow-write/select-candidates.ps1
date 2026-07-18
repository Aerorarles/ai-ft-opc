[CmdletBinding()]
param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 15432,
  [string]$Database = "aiopc",
  [string]$ReadonlyUser = "aiopc_readonly",
  [ValidateRange(1, 3)][int]$Limit = 3,
  [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$TenantId = "local",
  [ValidatePattern('^[a-zA-Z0-9._-]+$')][string]$ConfigVersion = "v1",
  [ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ConfigChecksum,
  [ValidatePattern('^[0-9.]+$')][string]$EngineVersion = "0.6"
)

$ErrorActionPreference = "Stop"
if (-not $ConfigChecksum) { throw "ConfigChecksum is required" }
function Fail([string]$Code) { [Console]::Error.WriteLine($Code); exit 1 }
function ClassifyDatabaseFailure([object[]]$FailureOutput) {
  $message = ($FailureOutput | ForEach-Object { [string]$_ }) -join "`n"
  if ($message -match '(?i)no password supplied') { Fail "PGPASS_ENTRY_NOT_MATCHED" }
  if ($message -match '(?i)password authentication failed') { Fail "DATABASE_PASSWORD_MISMATCH" }
  if ($message -match '(?i)could not connect|connection (?:refused|timed out)|server closed the connection|no route to host') {
    Fail "DATABASE_CONNECTION_FAILED"
  }
  if ($message -match '(?i)permission denied') { Fail "READONLY_PERMISSION_DENIED" }
  if ($message -match '(?i)(?:relation|column).*(?:does not exist)|syntax error') { Fail "CANDIDATE_QUERY_SCHEMA_MISMATCH" }
  Fail "CANDIDATE_QUERY_FAILED"
}
$historicalTechnicalLeadIds = @(
  "18a32777-f886-4441-98d9-e2b06a5586ab",
  "eb5ca404-e70a-4c7f-8551-add018490cd5",
  "cdabf717-3c57-4586-befa-c5ee66953547"
)
$protectedIdSql = ($historicalTechnicalLeadIds | ForEach-Object { "'$_'::uuid" }) -join ","
$query = @"
BEGIN READ ONLY;
WITH classified AS (
  SELECT l.id AS lead_id, l.company_name, l.score AS v01_score,
         l.grade AS v01_grade, l.priority AS v01_priority,
         l.enrichment_status, l.status AS business_status, l.website, l.country,
         l.industry, (NULLIF(btrim(COALESCE(l.email, '')), '') IS NOT NULL) AS has_email,
         (NULLIF(btrim(COALESCE(l.phone, '')), '') IS NOT NULL) AS has_phone,
         (lower(COALESCE(l.status, '')) LIKE '%competitor%') AS competitor_flag,
         (l.id IN ($protectedIdSql) OR lower(COALESCE(l.source, '')) ~ '(test|demo|sample)') AS test_sample_flag,
         (lower(COALESCE(l.status, '')) ~ '(suppressed|do[_ -]?not[_ -]?contact)') AS suppression_flag,
         'eligible_for_shadow_review'::text AS recommendation
  FROM public.leads l
  WHERE NULLIF(btrim(l.company_name), '') IS NOT NULL
    AND (NULLIF(btrim(COALESCE(l.website, '')), '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(l.country, '')), '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(l.industry, '')), '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(l.email, '')), '') IS NOT NULL
      OR NULLIF(btrim(COALESCE(l.phone, '')), '') IS NOT NULL)
    AND lower(COALESCE(l.status, '')) NOT LIKE '%competitor%'
    AND lower(COALESCE(l.status, '')) NOT LIKE '%rejected%'
    AND lower(COALESCE(l.status, '')) !~ '(suppressed|do[_ -]?not[_ -]?contact)'
    AND l.id NOT IN ($protectedIdSql)
    AND lower(COALESCE(l.source, '')) !~ '(test|demo|sample)'
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_scoring_shadow_results r
      WHERE r.tenant_id = '$TenantId' AND r.lead_id = l.id
        AND r.config_version = '$ConfigVersion' AND r.engine_version = '$EngineVersion')
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_operation_idempotency_claims c
      WHERE c.tenant_id = '$TenantId' AND c.operation_type = 'shadow_run'
        AND c.entity_id = l.id::text)
)
SELECT lead_id, company_name, v01_score, v01_grade, v01_priority,
       enrichment_status, business_status, competitor_flag,
       test_sample_flag, suppression_flag, recommendation, website, country,
       industry, has_email, has_phone
FROM classified
ORDER BY CASE v01_grade WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
         v01_score DESC NULLS LAST, lead_id
LIMIT $Limit;
ROLLBACK;
"@
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$csv = @(& psql -X -w -v ON_ERROR_STOP=1 --csv --quiet `
  -h $HostName -p $Port -U $ReadonlyUser -d $Database -c $query 2>&1)
$psqlExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($psqlExitCode -ne 0) { ClassifyDatabaseFailure $csv }
$rows = @($csv | ConvertFrom-Csv)
if ($rows.Count -gt $Limit -or $rows.Count -gt 3) { throw "BLOCKED_CANDIDATE_LIMIT_EXCEEDED" }
function CanonicalToken([object]$Value) {
  if ($null -eq $Value) { return "" }
  return ([string]$Value).Trim().Replace("|", "/")
}
function HashCandidate([object]$Row) {
  $parts = @(
    $Row.lead_id, $Row.company_name, $Row.v01_score, $Row.v01_grade,
    $Row.v01_priority, $Row.enrichment_status, $Row.business_status,
    ([string]$Row.competitor_flag).ToLowerInvariant(),
    ([string]$Row.test_sample_flag).ToLowerInvariant(),
    ([string]$Row.suppression_flag).ToLowerInvariant(), $Row.recommendation
  ) | ForEach-Object { CanonicalToken $_ }
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($parts -join "|"))))).Replace("-", "").ToLowerInvariant()
  } finally { $sha.Dispose() }
}
function HashInputSnapshot([object]$Row) {
  $parts = @(
    $Row.lead_id, $Row.company_name, $Row.website, $Row.country, $Row.industry,
    ([string]$Row.has_email).ToLowerInvariant(), ([string]$Row.has_phone).ToLowerInvariant(),
    $Row.v01_score, $Row.v01_grade, $Row.v01_priority,
    $Row.business_status, $Row.enrichment_status
  ) | ForEach-Object { CanonicalToken $_ }
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($parts -join "|"))))).Replace("-", "").ToLowerInvariant()
  } finally { $sha.Dispose() }
}
$output = foreach ($row in $rows) {
  if ($row.competitor_flag -ne "f" -or $row.test_sample_flag -ne "f" -or $row.suppression_flag -ne "f") {
    throw "BLOCKED_EXCLUDED_CANDIDATE_RETURNED"
  }
  [ordered]@{
    lead_id = $row.lead_id; company_name = $row.company_name
    v01_score = $row.v01_score; v01_grade = $row.v01_grade
    v01_priority = $row.v01_priority; enrichment_status = $row.enrichment_status
    business_status = $row.business_status; competitor_flag = $false
    test_sample_flag = $false; suppression_flag = $false
    recommendation = $row.recommendation; candidate_evidence_hash = HashCandidate $row
    input_snapshot_hash = HashInputSnapshot $row
  }
}
$output | ConvertTo-Json -Depth 4
