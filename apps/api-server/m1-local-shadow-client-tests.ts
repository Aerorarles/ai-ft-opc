// @ts-check

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  LOCAL_SHADOW_CONNECTION,
  createLocalSingleLeadShadowClient,
  validateLocalShadowConnection,
} = require("../../packages/persistence/src/postgres/local-single-lead-shadow-client.ts");

class FakePgClient {
  static latestConfig = null;
  constructor(config) { FakePgClient.latestConfig = config; }
}

const previousPgpass = process.env.PGPASSFILE;
const previousPassword = process.env.PGPASSWORD;
try {
  process.env.PGPASSFILE = "metadata-only-test-path";
  delete process.env.PGPASSWORD;
  assert.deepEqual(validateLocalShadowConnection(LOCAL_SHADOW_CONNECTION), LOCAL_SHADOW_CONNECTION);
  createLocalSingleLeadShadowClient(LOCAL_SHADOW_CONNECTION, FakePgClient);
  assert.equal(FakePgClient.latestConfig.host, "127.0.0.1");
  assert.equal(FakePgClient.latestConfig.port, 15432);
  assert.equal(FakePgClient.latestConfig.database, "aiopc");
  assert.equal(FakePgClient.latestConfig.user, "aiopc_shadow_writer_m1");
  assert.equal("password" in FakePgClient.latestConfig, false);
  assert.equal("connectionString" in FakePgClient.latestConfig, false);

  for (const invalid of [
    { ...LOCAL_SHADOW_CONNECTION, host: "localhost" },
    { ...LOCAL_SHADOW_CONNECTION, port: 5432 },
    { ...LOCAL_SHADOW_CONNECTION, database: "other" },
    { ...LOCAL_SHADOW_CONNECTION, user: "postgres" },
    { ...LOCAL_SHADOW_CONNECTION, password: "not-accepted" },
  ]) assert.throws(() => validateLocalShadowConnection(invalid));

  process.env.PGPASSWORD = "prohibited-test-value";
  assert.throws(() => validateLocalShadowConnection(LOCAL_SHADOW_CONNECTION), /pgpassword_prohibited/);
} finally {
  if (previousPgpass === undefined) delete process.env.PGPASSFILE;
  else process.env.PGPASSFILE = previousPgpass;
  if (previousPassword === undefined) delete process.env.PGPASSWORD;
  else process.env.PGPASSWORD = previousPassword;
}

const repoRoot = path.resolve(__dirname, "../..");
const launcher = fs.readFileSync(path.join(repoRoot, "scripts/shadow-write/execute-approved-single-lead.ps1"), "utf8");
const cli = fs.readFileSync(path.join(repoRoot, "scripts/shadow-write/execute-approved-single-lead.ts"), "utf8");
assert.ok(launcher.indexOf("resolve-pgpass.ps1") < launcher.indexOf("$env:PGPASSFILE = $pgpass"));
assert.ok(launcher.indexOf("$env:PGPASSFILE = $pgpass") < launcher.indexOf("npx.cmd tsx"));
assert.doesNotMatch(launcher, /Get-Content|\.env|PGPASSWORD\s*=/i);
assert.doesNotMatch(cli, /INSERT INTO|UPDATE public\.leads|DELETE FROM|CREATE ROLE|GRANT /i);
assert.match(cli, /requireApproved:\s*true/);

console.log("PASS: local pg client accepts only the fixed M1 writer connection, inherits pgpass, and exposes no password or arbitrary SQL input.");
