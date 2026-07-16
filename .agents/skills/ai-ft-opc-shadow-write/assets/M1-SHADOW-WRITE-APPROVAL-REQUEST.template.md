# M1 Single Lead Shadow Write Approval Request

- Status: `PENDING_APPROVAL`
- Tenant / Lead: `__TENANT_ID__` / `__LEAD_ID__`
- Request / Trace: `__REQUEST_ID__` / `__TRACE_ID__`
- Expires: `__EXPIRES_AT__`
- Candidate evidence hash: `__CANDIDATE_EVIDENCE_HASH__`
- Input snapshot hash: `__INPUT_SNAPSHOT_HASH__`
- Config: `__CONFIG_VERSION__` / `__CONFIG_ARTIFACT_SHA256__` / `__CONFIG_CHECKSUM__`
- Engine / outcome: `__ENGINE_VERSION__` / `not-configured`
- Writer package SHA-256: `__WRITER_PACKAGE_HASH__`
- Writer database role: `aiopc_shadow_writer_m1`
- Approval scope hash: `__APPROVAL_SCOPE_HASH__`

Requested scope is one transaction, one tenant, one Lead, the six listed Shadow/Audit
tables, and at most 10 rows. It excludes `public.leads`, Review/Decision, Intake,
migration, permission changes, n8n, Docker, server changes, and outreach.

Approval is valid only after the live candidate read and an explicit owner confirmation
of the exact target and all displayed hashes and limits.
