# M1 Shadow Write request schema

The YAML request is parsed structurally and must bind one live-selected Lead to:

- request ID, trace ID, deterministic idempotency key, creation time, and expiry;
- `tenant_id=local`, one UUID `lead_id`, and the reviewed company name;
- candidate evidence hash and sanitized input snapshot hash;
- config version, config artifact SHA-256, runtime config checksum, engine version, and outcome policy;
- the SHA-256 of the writer, local client, execution CLI, and launcher package, plus `database_role=aiopc_shadow_writer_m1`;
- the exact six-table allowlist and per-table row limits totaling at most 10 rows;
- explicit no-leads, no-v0.1-mutation, no-review, no-migration, no-outreach prohibitions;
- approval identity/time, scope hash, expiry, and rollback owner.

`PENDING_APPROVAL` requests must have null approval identity/time. Execution requires
`APPROVED_FOR_SINGLE_WRITE` and non-null approval identity/time. Any changed field,
expired request, unknown key, table drift, version drift, or hash mismatch invalidates approval.
