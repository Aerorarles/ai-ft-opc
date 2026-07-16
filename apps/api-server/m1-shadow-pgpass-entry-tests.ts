// @ts-check

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../..");
const skillScripts = path.join(repoRoot, ".agents/skills/ai-ft-opc-shadow-write/scripts");
const resolverPath = path.join(skillScripts, "resolve-pgpass.ps1");
const resolver = fs.readFileSync(resolverPath, "utf8");
const preflightEntry = fs.readFileSync(path.join(skillScripts, "preflight.ps1"), "utf8");
const candidateEntry = fs.readFileSync(path.join(skillScripts, "select-candidates.ps1"), "utf8");
const preflightCore = fs.readFileSync(path.join(repoRoot, "scripts/shadow-write/preflight.ps1"), "utf8");
const candidateCore = fs.readFileSync(path.join(repoRoot, "scripts/shadow-write/select-candidates.ps1"), "utf8");

assert.match(resolver, /GetFolderPath\s*\(/);
assert.match(resolver, /SpecialFolder\]::ApplicationData/);
assert.match(resolver, /Join-Path\s+\$appData\s+"postgresql\\pgpass\.conf"/);
assert.match(resolver, /Test-Path[^\r\n]+-PathType\s+Leaf/);
assert.match(resolver, /\.Length\s+-le\s+0/);
assert.match(resolver, /Write-Output\s+\$pgpass/);
assert.doesNotMatch(resolver, /\$env:PGPASSFILE\s*=/);

for (const forbidden of [
  /Get-Content/i, /ReadAllText/i, /ReadAllBytes/i, /Get-FileHash/i,
  /Copy-Item/i, /Select-String/i, /\.env/i,
]) {
  assert.doesNotMatch(resolver, forbidden);
}

for (const entry of [preflightEntry, candidateEntry]) {
  const resolverIndex = entry.indexOf("resolve-pgpass.ps1");
  const dotSourceIndex = entry.indexOf(". $resolver");
  const envIndex = entry.indexOf("$env:PGPASSFILE = $pgpass");
  const coreIndex = entry.indexOf("scripts\\shadow-write");
  assert.ok(
    resolverIndex >= 0 && dotSourceIndex > resolverIndex && envIndex > dotSourceIndex && coreIndex > envIndex,
    "resolver, PGPASSFILE assignment, and database core must remain in one ordered PowerShell process",
  );
  assert.doesNotMatch(entry, /powershell(?:\.exe)?\s+.*resolve-pgpass/i);
}

for (const core of [preflightCore, candidateCore]) {
  assert.match(core, /psql\s+-X\s+-w\s+-v\s+ON_ERROR_STOP=1/);
  for (const code of ["PGPASS_ENTRY_NOT_MATCHED", "DATABASE_PASSWORD_MISMATCH", "DATABASE_CONNECTION_FAILED"]) {
    assert.ok(core.includes(code), `missing ${code}`);
  }
}
const sqlBlocks = [preflightCore, candidateCore].flatMap((source) => source.match(/@"[\s\S]*?"@/g) || []);
for (const sql of sqlBlocks) {
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
}
assert.match(preflightCore, /BEGIN READ ONLY;/);
assert.match(candidateCore, /BEGIN READ ONLY;/);

for (const code of ["PGPASS_PATH_UNAVAILABLE", "PGPASS_FILE_NOT_FOUND", "PGPASS_FILE_EMPTY"]) {
  assert.ok(resolver.includes(code), `missing ${code}`);
}

const resolverRuntime = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", resolverPath],
  { cwd: repoRoot, encoding: "utf8", windowsHide: true },
);
assert.equal(resolverRuntime.status, 0, `resolver failed with a classified metadata error: ${resolverRuntime.stderr.trim()}`);
const resolvedPath = resolverRuntime.stdout.trim();
assert.ok(path.isAbsolute(resolvedPath));
assert.equal(path.basename(resolvedPath).toLowerCase(), "pgpass.conf");
assert.doesNotMatch(resolverRuntime.stderr, /password\s*[=:]|credential|secret|token/i);

if (process.argv.includes("--live")) {
  const preflightRuntime = spawnSync(
    "powershell.exe",
    [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
      path.join(skillScripts, "preflight.ps1"), "-HostName", "127.0.0.1", "-Port", "15432",
      "-Database", "aiopc", "-ReadonlyUser", "aiopc_readonly",
    ],
    { cwd: repoRoot, encoding: "utf8", windowsHide: true },
  );
  assert.equal(preflightRuntime.status, 0, `read-only preflight failed: ${preflightRuntime.stderr.trim()}`);
  assert.match(preflightRuntime.stdout, /PSQL_SOURCE=.*psql\.exe/i);
  assert.match(preflightRuntime.stdout, /PSQL_VERSION=psql \(PostgreSQL\)/i);
  assert.match(preflightRuntime.stdout, /PGPASS_EXISTS=true/i);
  assert.match(preflightRuntime.stdout, /PGPASS_NONEMPTY=true/i);
  assert.match(preflightRuntime.stdout, /PSQL_EXIT_CODE=0/i);
  assert.match(preflightRuntime.stdout, /aiopc_readonly\s*\|\s*aiopc\s*\|\s*on/i);
  assert.match(preflightRuntime.stdout, /CURRENT_USER_DATABASE_OK=true/i);
  assert.doesNotMatch(`${preflightRuntime.stdout}\n${preflightRuntime.stderr}`, /password\s*[=:]|credential\s*[=:]|secret\s*[=:]|token\s*[=:]/i);
  console.log("PASS: live same-process pgpass authentication, aiopc_readonly identity, aiopc database, and zero-write preflight verified.");
} else {
  console.log("PASS: same-process pgpass resolution, safe logging, and zero-write SQL guards verified.");
}
