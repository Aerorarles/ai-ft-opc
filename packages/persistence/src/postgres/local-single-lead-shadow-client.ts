// @ts-check

const { Client } = require("pg");
const { executeApprovedSingleLeadShadowWrite } = require("./single-lead-shadow-writer.ts");

const LOCAL_SHADOW_CONNECTION = Object.freeze({
  host: "127.0.0.1",
  port: 15432,
  database: "aiopc",
  user: "aiopc_shadow_writer_m1",
});

/** @param {unknown} candidate */
function validateLocalShadowConnection(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("local_shadow_connection_required");
  }
  const options = /** @type {Record<string, unknown>} */ (candidate);
  const allowedKeys = ["host", "port", "database", "user"];
  const unknownKeys = Object.keys(options).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) throw new Error("local_shadow_connection_unknown_option");
  for (const [key, expected] of Object.entries(LOCAL_SHADOW_CONNECTION)) {
    if (options[key] !== expected) throw new Error(`local_shadow_connection_mismatch:${key}`);
  }
  if (process.env.PGPASSWORD) throw new Error("pgpassword_prohibited");
  if (!process.env.PGPASSFILE) throw new Error("pgpassfile_required");
  return /** @type {{host:string,port:number,database:string,user:string}} */ ({ ...options });
}

/**
 * Creates the only real PostgreSQL client allowed for the M1 closeout writer.
 * It never accepts a password, connection string, SSL override, SQL, or table name.
 * @param {unknown} options
 * @param {typeof Client=} ClientConstructor
 */
function createLocalSingleLeadShadowClient(options, ClientConstructor = Client) {
  const connection = validateLocalShadowConnection(options);
  return new ClientConstructor({
    ...connection,
    application_name: "ai-ft-opc-m1-shadow-closeout",
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
  });
}

/**
 * Connects once, runs the reviewed single-lead writer once, and always closes.
 * No retry path exists.
 * @param {unknown} approvedRequest
 * @param {unknown} options
 */
async function executeApprovedSingleLeadShadowWriteLocally(approvedRequest, options) {
  const request = /** @type {any} */ (approvedRequest);
  const connection = validateLocalShadowConnection(options);
  if (!request || request.writer?.database_role !== connection.user) {
    throw new Error("writer_database_role_mismatch");
  }
  const client = createLocalSingleLeadShadowClient(connection);
  try {
    await client.connect();
    return await executeApprovedSingleLeadShadowWrite(client, approvedRequest);
  } finally {
    await client.end();
  }
}

module.exports = {
  LOCAL_SHADOW_CONNECTION,
  createLocalSingleLeadShadowClient,
  executeApprovedSingleLeadShadowWriteLocally,
  validateLocalShadowConnection,
};
