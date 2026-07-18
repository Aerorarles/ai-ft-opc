// @ts-check

const fs = require("node:fs");
const path = require("node:path");
const { parseShadowWriteRequestYaml } = require("../../packages/persistence/src/shadow-write-request.ts");

const args = process.argv.slice(2);
const requestPath = args.find((arg) => !arg.startsWith("--"));
const requireApproved = args.includes("--require-approved");
if (!requestPath) throw new Error("Request path is required");
const absolutePath = path.resolve(requestPath);
const result = parseShadowWriteRequestYaml(fs.readFileSync(absolutePath, "utf8"), { requireApproved });
if (!result.valid) {
  process.stderr.write(`BLOCKED_REQUEST_INVALID: ${result.errors.join(",")}\n`);
  process.exit(1);
}
process.stdout.write("PASS: structured request schema, scope, expiry, and approval invariants are valid. No database write was executed.\n");
