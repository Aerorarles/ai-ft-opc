"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const policy = fs.readFileSync(path.join(root, ".project-control", "EXECUTION-POLICY.yaml"), "utf8");
const next = fs.readFileSync(path.join(root, ".project-control", "NEXT-ACTION.yaml"), "utf8");

for (const required of ["storage_mode: memory", "shadow_writer_enabled: false", "http_server_enabled: false", "git_direct_push_main: false", "git_force_push: false", "git_auto_merge: false"]) {
  if (!policy.includes(required)) throw new Error(`safe_state_validation_failed:${required}`);
}

if (!/type:\s*(WAIT_FOR_REVIEW|STOP|EXECUTE_WORK_PACKAGE|RUN_TESTS)/.test(next)) {
  throw new Error("safe_state_validation_failed:next_action_type");
}

console.log("SAFE_STATE_VALIDATION_PASS");
