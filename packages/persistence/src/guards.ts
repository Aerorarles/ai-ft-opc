// @ts-check

const DISABLED_MESSAGE = "PostgreSQL shadow write is disabled in local MVP mode.";

/**
 * @param {{ appStorageMode?: string, shadowWriterEnabled?: boolean, executionToken?: string | null }} options
 */
function assertPostgresShadowWriteAllowed(options) {
  if (
    !options ||
    options.appStorageMode !== "postgres" ||
    options.shadowWriterEnabled !== true ||
    !options.executionToken
  ) {
    throw new Error(DISABLED_MESSAGE);
  }
}

module.exports = {
  DISABLED_MESSAGE,
  assertPostgresShadowWriteAllowed,
};
