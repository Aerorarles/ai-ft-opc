"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const requireMatch = (text, pattern, label) => {
  if (!pattern.test(text)) throw new Error(`project_control_validation_failed:${label}`);
};

const control = read(".project-control/PROJECT-CONTROL.yaml");
const milestone = read(".project-control/CURRENT-MILESTONE.yaml");
const workPackage = read(".project-control/CURRENT-WORK-PACKAGE.yaml");
const nextAction = read(".project-control/NEXT-ACTION.yaml");

for (const relativePath of [
  ".project-control/EXECUTION-POLICY.yaml",
  ".project-control/APPROVAL-GATES.yaml",
  ".project-control/GIT-AUTOMATION-POLICY.yaml",
  ".project-control/CONTINUATION-PROTOCOL.md",
  "docs/project-status/AI-FT-OPC-CURRENT-STATUS.md",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`project_control_validation_failed:missing:${relativePath}`);
  }
}

requireMatch(control, /id:\s*ai-ft-opc/, "project_id");
requireMatch(milestone, /id:\s*M\d+(?:\.\d+)?/, "milestone_id");
requireMatch(workPackage, /status:\s*(PASSED|READY_FOR_REVIEW|IN_PROGRESS|BLOCKED)/, "work_package_status");
requireMatch(nextAction, /type:\s*(WAIT_FOR_REVIEW|STOP|EXECUTE_WORK_PACKAGE|RUN_TESTS)/, "next_action_type");

console.log("PROJECT_CONTROL_VALIDATION_PASS");
