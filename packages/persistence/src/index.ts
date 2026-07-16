// @ts-check

const { MemoryLeadRepository } = require("./memory/memory-lead-repository.ts");
const { MemoryShadowRepository } = require("./memory/memory-shadow-repository.ts");
const { MemoryReviewRepository } = require("./memory/memory-review-repository.ts");
const { MemoryIntakeRepository } = require("./memory/memory-intake-repository.ts");
const { MemoryAuditRepository } = require("./memory/memory-audit-repository.ts");
const { PostgresLeadRepository } = require("./postgres/postgres-lead-repository.ts");
const { PostgresShadowRepository } = require("./postgres/postgres-shadow-repository.ts");
const { PostgresReviewRepository } = require("./postgres/postgres-review-repository.ts");
const { executeApprovedSingleLeadShadowWrite } = require("./postgres/single-lead-shadow-writer.ts");
const {
  createLocalSingleLeadShadowClient,
  executeApprovedSingleLeadShadowWriteLocally,
} = require("./postgres/local-single-lead-shadow-client.ts");
const { assertPostgresShadowWriteAllowed, DISABLED_MESSAGE } = require("./guards.ts");
const {
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
  validateShadowPersistenceEnvelope,
  validateReviewPersistenceEnvelope,
  validateAuditPersistenceEnvelope,
} = require("./production-persistence-contract.ts");
const {
  IDEMPOTENCY_OPERATIONS,
  REPLAY_EVENT_ORDER,
  buildIdempotencyKey,
  validateIdempotencyReplayEnvelope,
  auditReplaySafety,
} = require("./idempotency-replay-safety.ts");

module.exports = {
  MemoryLeadRepository,
  MemoryShadowRepository,
  MemoryReviewRepository,
  MemoryIntakeRepository,
  MemoryAuditRepository,
  PostgresLeadRepository,
  PostgresShadowRepository,
  PostgresReviewRepository,
  executeApprovedSingleLeadShadowWrite,
  createLocalSingleLeadShadowClient,
  executeApprovedSingleLeadShadowWriteLocally,
  assertPostgresShadowWriteAllowed,
  DISABLED_MESSAGE,
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
  validateShadowPersistenceEnvelope,
  validateReviewPersistenceEnvelope,
  validateAuditPersistenceEnvelope,
  IDEMPOTENCY_OPERATIONS,
  REPLAY_EVENT_ORDER,
  buildIdempotencyKey,
  validateIdempotencyReplayEnvelope,
  auditReplaySafety,
};
