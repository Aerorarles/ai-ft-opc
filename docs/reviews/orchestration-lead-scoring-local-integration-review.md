# Orchestration x Lead Scoring 本地集成验收包

版本：v0.1
日期：2026-07-02
状态：本地验证通过
适用范围：AI FT-OPC 本地 orchestration runtime 调用 Lead Scoring facade 的最小集成
禁止事项：不涉及数据库、SQL、migration、Trigger、n8n、Docker、服务器、Git 写操作、secrets 或外部 API。

## 1. 修改 / 新增文件清单

- `packages/orchestration/src/lead-scoring-adapter.ts`
- `packages/orchestration/src/scheduler.ts`
- `packages/orchestration/src/engine.ts`
- `packages/orchestration/src/index.ts`
- `apps/api-server/orchestration-scoring-demo.ts`
- `apps/api-server/orchestration-scoring-tests.ts`
- `package.json`
- `docs/ORCHESTRATION-LEAD-SCORING-LOCAL-INTEGRATION.md`
- `docs/reviews/orchestration-lead-scoring-local-integration-review.md`

## 2. 实际验证命令与结果

- `npm run typecheck`：通过。
- `npm run dev`：通过，既有 orchestration demo 正常完成。
- `npm run demo:replay`：通过，`replay is_consistent: true`。
- `npm run test:orchestration`：通过，7 项测试全部 PASS。
- `npm run demo:scoring`：通过，`total_score: 21`。
- `npm run test:scoring`：通过，52 项测试全部 PASS。
- `npm run demo:trace`：通过，`replay_consistency: true`。
- `npm run demo:orchestration-scoring`：通过，集成 demo 输出 `total_score: 21`，orchestration replay 一致。
- `npm run test:orchestration-scoring`：通过，9 项集成测试全部 PASS。

## 3. 集成 demo 输出摘要

- orchestration task：`task-score-demo-lead`
- task 状态：`COMPLETED`
- `total_score`：`21`
- `breakdown`：`{"relevance":30,"trust":15,"capability":10,"risk":0}`
- `applied_rule_count`：`4`
- scoring replay consistency：`true`
- orchestration replay consistency：`true`
- replay 重建 task 最终状态：`COMPLETED`

## 4. 已验证能力

- `lead_scoring` task 可经过 DAG 和 scheduler 执行。
- adapter 调用现有 `scoreLeadAPI()` facade。
- `TASK_COMPLETED.result` 写入脱敏评分摘要。
- 普通 mock task 不会误触发 Lead Scoring。
- invalid config 不会生成伪成功评分，结果为 `total_score = null` 且 `scoring_blocked = true`。
- orchestration replay 不重新调用 scoring facade，只重建任务完成状态。
- 既有 scoring 结果保持 `total_score = 21`。

## 5. 脱敏检查

集成测试已检查 `TASK_COMPLETED.result` 不包含：

- 完整 email；
- 完整 phone；
- HTML；
- headers；
- cookies；
- secrets；
- password；
- authorization；
- 原始 event stream；
- scoring rule execution path。

## 6. 当前未涉及

- 数据库；
- SQL；
- migration；
- PostgreSQL Trigger；
- n8n；
- Docker；
- 服务器 / Portainer；
- Git 写操作；
- secrets / `.env` / Credentials / API Key / Cookie / 数据卷；
- 外部 API；
- HTTP server；
- 生产部署。

## 7. 已知限制

- 当前是本地内存级集成，不是生产持久化 event sourcing。
- orchestration replay 不重算评分，只读取已记录的脱敏任务结果。
- adapter 目前仅支持本地 `scoreLeadAPI()` facade，不代表已具备网络 API、数据库配置仓库或 n8n 调用能力。

## 8. 回滚方式

- 删除或停用 `task_kind = "lead_scoring"` 的 scheduler 分发；
- 删除或停用 `lead-scoring-adapter.ts`；
- 删除新增 demo/test scripts；
- 不影响原有 Lead Scoring 算法与配置；
- 不影响原有 mock orchestration task；
- 不涉及生产数据回滚。

## 9. 下一步需用户明确批准的事项

- Git 暂存、提交或推送；
- API server 化；
- 数据库持久化；
- n8n 接入；
- 真实 Agent 执行；
- 多租户配置仓库接入；
- 生产部署或服务器操作。
