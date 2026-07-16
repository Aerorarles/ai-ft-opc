// @ts-check

const fs = require("node:fs");
const path = require("node:path");
const { parseShadowWriteRequestYaml } = require("../../packages/persistence/src/shadow-write-request.ts");
const {
  LOCAL_SHADOW_CONNECTION,
  executeApprovedSingleLeadShadowWriteLocally,
} = require("../../packages/persistence/src/postgres/local-single-lead-shadow-client.ts");

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const allowed = new Set(["--request", "--host", "--port", "--database", "--user"]);
  /** @type {Record<string,string>} */
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value) fail("EXECUTION_ARGUMENT_INVALID");
    parsed[key] = value;
  }
  if (Object.keys(parsed).length !== allowed.size) fail("EXECUTION_ARGUMENT_INVALID");
  return parsed;
}

function classify(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/approval|request|scope|hash|version|role|expired/i.test(message)) return "APPROVAL_SCOPE_MISMATCH";
  if (/permission denied/i.test(message)) return "WRITER_PERMISSION_DENIED";
  if (/password authentication failed/i.test(message)) return "DATABASE_PASSWORD_MISMATCH";
  if (/no password supplied|pgpass/i.test(message)) return "PGPASS_ENTRY_NOT_MATCHED";
  if (/row_limit/i.test(message)) return "ROW_LIMIT_VIOLATION_ROLLED_BACK";
  if (/sensitive/i.test(message)) return "SENSITIVE_DATA_CHECK_ROLLED_BACK";
  return "SHADOW_WRITE_FAILED_ROLLED_BACK";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connection = {
    host: args["--host"],
    port: Number(args["--port"]),
    database: args["--database"],
    user: args["--user"],
  };
  if (JSON.stringify(connection) !== JSON.stringify(LOCAL_SHADOW_CONNECTION)) fail("EXECUTION_CONNECTION_SCOPE_MISMATCH");
  const requestPath = path.resolve(args["--request"]);
  const parsed = parseShadowWriteRequestYaml(fs.readFileSync(requestPath, "utf8"), { requireApproved: true });
  if (!parsed.valid || !parsed.request) fail("APPROVAL_SCOPE_MISMATCH");
  try {
    const result = await executeApprovedSingleLeadShadowWriteLocally(parsed.request, connection);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    fail(classify(error));
  }
}

main().catch(() => fail("SHADOW_WRITE_FAILED_ROLLED_BACK"));
