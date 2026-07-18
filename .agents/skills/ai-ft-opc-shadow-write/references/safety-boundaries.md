# Safety boundaries

## Automatically allowed in local hardening

- Read non-sensitive repository and Project Control files.
- Run local static validation, type checks, and fake-client tests.
- Generate local request examples that contain no real business target.

## Human approval required

- Any query of real Lead business rows, including the at-most-three candidate selection.
- Exact production `lead_id` and `tenant_id` approval.
- Enabling or granting a writer role.
- The first real Shadow Write and every changed/renewed request.
- Review Queue insertion, committed cleanup, or wider table/row/entity/duration scope.

## Always forbidden

- Reading secrets, credentials, `pgpass.conf`, or database dumps.
- Mutating `public.leads`, v0.1 score facts, or scoring triggers/functions.
- Bulk writes, migration execution, automatic privilege changes, n8n activation, or outreach.
