# Phase 1 Productization Full Chain Report

版本：v0.1
日期：2026-07-02
状态：本地最小链路验证通过
适用范围：Lead Ingestion -> Dedup -> Scoring(v0.1 baseline + v0.2 shadow) -> Decision -> Human Review Queue -> API Layer
禁止事项：本次未使用 database、SQL、migration、n8n、Docker、外部 API、Git 写操作；未修改 scoring formula；未修改 orchestration engine。

## 1. Implemented Modules

新增模块：

- `packages/ingestion/src/index.ts`
  - `normalizeLead(input)`
  - company name normalization
  - domain extraction
  - rule-based country guess
  - simple industry mapping

- `packages/dedup/src/index.ts`
  - `isDuplicate(leadA, leadB)`
  - same-domain duplicate detection
  - simple company-name similarity fallback

- `packages/decision/src/index.ts`
  - `decideLeadAction(v1Score, v2ShadowScore, lead)`
  - output: `HOT / WARM / COLD`
  - confidence, reasons, risk flags, next step

- `packages/review-queue/src/index.ts`
  - `addToQueue()`
  - `approveLead()`
  - `rejectLead()`
  - in-memory queue with `pending / approved / rejected`

- `apps/api-server/phase1-api.ts`
  - in-memory JSON API facade
  - `POST /lead/ingest`
  - `GET /lead/:id`
  - `POST /lead/decide`
  - `POST /lead/review`
  - `GET /leads`

新增运行入口：

- `apps/api-server/phase1-demo.ts`
- `apps/api-server/phase1-tests.ts`

新增 package scripts：

- `npm run phase1:demo`
- `npm run phase1:test`

## 2. Pipeline Flow

```text
Raw Lead
  -> normalizeLead()
  -> isDuplicate()
  -> scoreLeadAPI() for v0.2 shadow score
  -> v0.1 baseline score from input fixture
  -> decideLeadAction()
  -> ReviewQueue.addToQueue()
  -> JSON API output
```

说明：

- v0.1 baseline 在本地 demo 中作为输入 fixture，不修改数据库 v0.1 trigger。
- v0.2 shadow scoring 通过现有 `scoreLeadAPI()` 本地 facade 执行。
- API Layer 是内存 handler，不启动长期 HTTP server。

## 3. Demo Results

命令：

`npm run phase1:demo`

结果：

- total leads processed: `10`
- duplicates removed: `2`
- HOT/WARM/COLD distribution: `{"HOT":4,"WARM":3,"COLD":1}`
- review queue sample: pending queue items generated

输出确认：

- `✔ ingestion working`
- `✔ dedup working`
- `✔ decision working`
- `✔ review queue working`
- `✔ api working`

## 4. Test Results

命令：

`npm run phase1:test`

结果：

- PASS ingestion correctness
- PASS dedup correctness
- PASS decision output correctness
- PASS review queue state transitions
- PASS API endpoints return valid JSON
- PASS end-to-end pipeline works

输出确认：

- `✔ ingestion working`
- `✔ dedup working`
- `✔ decision working`
- `✔ review queue working`
- `✔ api working`

## 5. Hot / Warm / Cold Distribution

Demo distribution:

- HOT: `4`
- WARM: `3`
- COLD: `1`

Decision examples:

- HOT: v2 shadow much higher than v1, or email + factory signal.
- WARM: conflicting signals or default manual review.
- COLD: no website.

## 6. Duplicates Found

Demo removed `2` duplicates:

- duplicate domain example: `abcdisplays.com`
- duplicate domain example: `fixtureworks.co.uk`

Dedup rules:

- same domain -> duplicate
- similar company name -> duplicate when similarity >= 0.75
- otherwise not duplicate

## 7. Known Limitations

- No database persistence.
- No SQL or migration.
- No n8n integration.
- No Docker or server deployment.
- No external API.
- No production-grade fuzzy matching.
- No persistent review queue across process restarts.
- No real v0.1 database trigger execution; demo uses local fixture values for v0.1 baseline.
- API layer is an in-memory handler, not a long-running HTTP server.

## 8. Safety Review

Not involved:

- database
- SQL
- migration
- n8n
- Docker
- external API
- Git commit / push
- scoring formula changes
- orchestration engine changes

## 9. Next Step Recommendation

Recommended next step:

Design Phase 1 persistence boundary before any production use:

1. Define which in-memory records become tables.
2. Keep review queue and shadow scoring separate from `public.leads` official score.
3. Add audit and retention policy.
4. Require user approval before any SQL draft or API server deployment.
