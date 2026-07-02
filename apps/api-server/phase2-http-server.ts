const http = require("http");
const fs = require("fs");
const path = require("path");
const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { createPhase2Api } = require("./phase2-api.ts");

async function startPhase2HttpServer(options) {
  if (!options || options.enabled !== true) {
    console.log("Phase 2 HTTP server not started. Pass { enabled: true } from a local dev entrypoint to listen on 127.0.0.1.");
    return null;
  }
  const host = options.host || "127.0.0.1";
  const port = options.port || 3092;
  const repositories = createSeedRepositories();
  await seedPhase2(repositories);
  const api = createPhase2Api(repositories);
  const workbenchDir = path.resolve(__dirname, "../workbench");

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url && req.url.startsWith("/api/")) {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", async () => {
          const body = raw ? JSON.parse(raw) : {};
          const response = await api.request(req.method || "GET", req.url || "/", body);
          res.writeHead(response.status, { "content-type": "application/json" });
          res.end(JSON.stringify(response.json));
        });
        return;
      }
      const file = req.url === "/" ? "index.html" : String(req.url || "").replace(/^\//, "");
      const fullPath = path.join(workbenchDir, file);
      if (!fullPath.startsWith(workbenchDir) || !fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200);
      res.end(fs.readFileSync(fullPath));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ mode: "local_mvp", error: String(error && error.message ? error.message : error) }));
    }
  });
  server.listen(port, host);
  console.log(`Phase 2 local server listening on http://${host}:${port}`);
  return server;
}

if (require.main === module) {
  startPhase2HttpServer({ enabled: false });
}

module.exports = {
  startPhase2HttpServer,
};
