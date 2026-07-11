// @ts-check

const { MemoryLeadRepository } = require("./memory/memory-lead-repository.ts");
const { MemoryShadowRepository } = require("./memory/memory-shadow-repository.ts");
const { MemoryReviewRepository } = require("./memory/memory-review-repository.ts");
const { MemoryIntakeRepository } = require("./memory/memory-intake-repository.ts");
const { PostgresLeadRepository } = require("./postgres/postgres-lead-repository.ts");
const { PostgresShadowRepository } = require("./postgres/postgres-shadow-repository.ts");
const { PostgresReviewRepository } = require("./postgres/postgres-review-repository.ts");
const { assertPostgresShadowWriteAllowed, DISABLED_MESSAGE } = require("./guards.ts");
const {
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
} = require("./production-persistence-contract.ts");

module.exports = {
  MemoryLeadRepository,
  MemoryShadowRepository,
  MemoryReviewRepository,
  MemoryIntakeRepository,
  PostgresLeadRepository,
  PostgresShadowRepository,
  PostgresReviewRepository,
  assertPostgresShadowWriteAllowed,
  DISABLED_MESSAGE,
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
};
