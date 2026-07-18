---
name: ai-ft-opc-shadow-write
description: Prepare, approve, execute, verify, and audit a single controlled AI FT-OPC PostgreSQL shadow-scoring write. Use when continuing M1 shadow persistence, selecting a safe lead candidate, creating a Shadow Write approval request, validating writer permissions, or verifying an approved one-lead shadow write. Never use for bulk writes, public.leads mutation, v0.1 score replacement, production migration, or outreach.
---

# AI FT-OPC Controlled Shadow Write

## Purpose

Use this skill to move one reviewed AI FT-OPC Lead through a controlled Shadow Write workflow:

```text
Read project state
→ read-only candidate selection
→ derive technical parameters
→ build request
→ request human approval
→ validate exact approval
→ execute one transactional shadow write
→ verify rows
→ report and close permissions
```

The skill automates technical preparation. It does not replace human authorization for a real database write.

## Required authority

Read in this order:

1. `AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md`
2. `docs/project-status/AI-FT-OPC-CURRENT-STATUS.md`
3. `.project-control/PROJECT-CONTROL.yaml`
4. `.project-control/EXECUTION-POLICY.yaml`
5. `.project-control/APPROVAL-GATES.yaml`
6. `.project-control/NEXT-ACTION.yaml`
7. the active M1 Work Package and progress report

If the master architecture is missing, stop with `BLOCKED_MASTER_ARCHITECTURE_MISSING`.

## Non-negotiable boundaries

Never:

- read, print, copy, commit, or upload `.env`, `pgpass.conf`, passwords, tokens, credentials, cookies, or database dumps;
- mutate `public.leads`;
- update v0.1 `score`, `grade`, `priority`, its trigger, or `score_lead_v01()`;
- perform bulk writes;
- execute a migration;
- activate n8n;
- perform outreach;
- infer human approval;
- reuse an expired approval;
- widen the table scope after approval;
- auto-grant database privileges.

The intended first-run limit is one tenant and one lead.

## Runtime expectations

- Windows client tools: `psql`, `pg_isready`
- Connection through an already established SSH tunnel, normally `127.0.0.1:15432`
- Authentication is supplied automatically by the local PostgreSQL client through `pgpass.conf`
- Every Skill entry point that invokes `psql` or `pg_isready` must dot-source `scripts/resolve-pgpass.ps1`, set `PGPASSFILE`, and invoke the database client in the same PowerShell process
- The resolver locates the file through the Windows ApplicationData API and checks only that it exists, is a regular file, and is non-empty
- The resolver returns only the full path on standard output; it must never read, hash, copy, search, or commit the authentication file, and must never read `.env`
- The calling entry point sets `PGPASSFILE` only for the current PowerShell process; `psql -w` prohibits interactive password fallback
- Read-only candidate discovery uses `aiopc_readonly`
- An approved write uses a dedicated least-privilege writer role
- The only M1 live writer role is `aiopc_shadow_writer_m1`, bound inside the request scope hash
- Live execution uses `scripts/execute-approved-single-lead.ps1`, which accepts only the fixed local endpoint and an already approved request
- The skill must not create roles or grant privileges

## Local-only pgpass authentication

This Skill must run in a local Codex environment on the Windows machine that owns the PostgreSQL client configuration. Codex Cloud must not use or attempt to access the machine's local `pgpass.conf`.

The PostgreSQL client consumes `pgpass.conf` automatically. The Skill only resolves the path and performs metadata checks; it does not inspect file contents. The resolver and `psql` must never be split across separate Codex shell commands or PowerShell processes. Safe preflight diagnostics may show Windows identity, ApplicationData path, `psql.exe` path/version, `PGPASSFILE` path, existence/non-empty booleans, exit code, and identity/database verification. Authentication and connection failures must be reported as one of: `PGPASS_PATH_UNAVAILABLE`, `PGPASS_FILE_NOT_FOUND`, `PGPASS_FILE_EMPTY`, `PGPASS_ENTRY_NOT_MATCHED`, `DATABASE_PASSWORD_MISMATCH`, or `DATABASE_CONNECTION_FAILED`.

## Workflow modes

### Mode A — PREPARE

Use when no approved Shadow Write request exists.

1. Run `scripts/preflight.ps1`.
2. Read project-controlled versions from repository files:
   - scoring config version;
   - engine version;
   - outcome policy.
3. Run `scripts/select-candidates.ps1` with the read-only role.
4. Select at most three candidates.
5. Exclude competitors, historical test samples, rejected or suppressed records, prior identical idempotency scopes, and records missing minimum scoring input.
6. Create:
   - `.project-control/runtime/M1-SHADOW-WRITE-REQUEST.yaml`
   - `docs/approvals/M1-SHADOW-WRITE-APPROVAL-REQUEST.md`
   - `docs/progress/M1-shadow-write-preparation.md`
7. Set request status to `PENDING_APPROVAL`.
8. Stop and ask the human to approve only the exact `lead_id`, exact `tenant_id`, one single Shadow Write, and the displayed version/table scope.

Do not write to the database in PREPARE mode.

### Mode B — VALIDATE_APPROVAL

Use after the user explicitly approves the exact request.

1. Run `scripts/validate-request.ps1`.
2. Confirm approval is explicit, unexpired, for the same request, tenant, lead, versions, table list, and maximum row counts.
3. Confirm the candidate SQL or writer package hash still matches the approved hash.
4. Check the writer role and privileges using read-only metadata queries.
5. If any value differs, stop with `APPROVAL_SCOPE_MISMATCH`.

### Mode C — EXECUTE

Only enter when request status is `APPROVED_FOR_SINGLE_WRITE` and the approval document contains the exact approval.

Before execution verify tunnel, database, writer identity, unused idempotency key, target eligibility, transaction support, required tables, and row limits.

Execution requirements:

- one database transaction;
- `ON_ERROR_STOP=1`;
- write only approved Shadow tables;
- never write to `public.leads`;
- include request ID, trace ID, tenant, lead, config version, engine version, and input snapshot hash;
- abort if an insert count exceeds the approved maximum;
- rollback on any error;
- no Review Queue insertion unless separately approved.

Do not invent SQL. Use the repository's reviewed writer implementation or approved execution package.
The local execution adapter must not accept passwords, connection strings, arbitrary SQL, arbitrary table names, retries, or a database role other than the role bound in the request.

### Mode D — VERIFY

After successful commit:

1. Run approved read-only verification queries.
2. Verify rows by request ID, trace ID, tenant, and lead.
3. Verify no `public.leads` business field changed.
4. Verify v0.1 score facts remain unchanged.
5. Verify row counts are within the approved maximum.
6. Record IDs, timestamps, versions, hashes, and verification outcome.
7. Update execution report, current status, M1 progress, and project-control state.

If verification fails after commit, create a rollback approval request. Do not perform ad-hoc cleanup.

## Request generation

Use `scripts/build-request.ps1` to generate request IDs, trace IDs, and an idempotency key. See `references/request-schema.md`.

## Allowed table scope

Derive exact physical table names from the deployed schema. Conceptual scope is Shadow Run, Shadow Result, Diff, Explanation, and Review Queue only when separately approved.

## Candidate output

Show only lead ID, company name, v0.1 score/grade/priority, enrichment status, business status, competitor/test/suppression flags, and recommendation/exclusion reason. Do not expose unnecessary contact details or complete `raw_data`.

## Stop conditions

Stop for missing authority files, missing tunnel, unknown database, missing roles, secret requirement, approval ambiguity/expiry/scope mismatch, version/hash mismatch, unresolved test failure, more than one entity, missing rollback owner, missing idempotency, Git conflict, production scoring mutation, migration, or outreach.

## Required reports

- `docs/progress/M1-shadow-write-preparation.md`
- `docs/approvals/M1-SHADOW-WRITE-APPROVAL-REQUEST.md`
- `docs/progress/M1-shadow-write-execution.md`

Final reply format:

```text
STATUS:
PREPARED | REQUEST_APPROVAL | APPROVED_NOT_EXECUTED | EXECUTED_VERIFIED | BLOCKED

SKILL:
ai-ft-opc-shadow-write

REQUEST:
<request_id>

TARGET:
<tenant_id> / <lead_id>

MODE:
PREPARE | VALIDATE_APPROVAL | EXECUTE | VERIFY

DATABASE WRITES:
NONE | SINGLE_TRANSACTION_COMMITTED | ROLLED_BACK

PUBLIC.LEADS CHANGED:
NO

V0.1 FACTS CHANGED:
NO

FILES UPDATED:
...

VERIFICATION:
...

APPROVAL REQUIRED:
YES | NO

NEXT ACTION:
...
```
