# Orchestration x Lead Scoring 本地最小集成说明

版本：v0.1
日期：2026-07-02
状态：本地验证通过
适用范围：AI FT-OPC 本地 orchestration runtime 与 Lead Scoring facade 的内存级集成
禁止事项：不涉及数据库、SQL、migration、Trigger、n8n、Docker、服务器、HTTP server、真实 Agent、secrets 或外部 API。

## 1. 集成目标

本次集成只验证一条 orchestration task 可以通过现有 DAG 和 scheduler 调度，调用本地 `scoreLeadAPI()` facade，拿到评分结果，并把脱敏评分摘要写入 `TASK_COMPLETED.result`。

本次不改变 Lead Scoring 的算法、配置、规则、权重、grade / priority 策略，也不改变 orchestration replay 的语义。

## 2. 调用路径

调用链如下：

`Orchestration Task -> lead-scoring-adapter -> scoreLeadAPI -> sanitized scoring summary -> TASK_COMPLETED`

新增 adapter：

`packages/orchestration/src/lead-scoring-adapter.ts`

adapter 只负责：

- 接收 `task_kind = "lead_scoring"` 的任务；
- 调用现有本地 `scoreLeadAPI()`；
- 返回脱敏摘要；
- 不读取环境变量；
- 不发起网络请求；
- 不连接数据库；
- 不复制评分内部逻辑。

## 3. 任务识别规则

只有明确设置：

`task_kind: "lead_scoring"`

才会触发 Lead Scoring。

普通 `codex` / `db` mock task 不会通过 agent 名称、prompt 文本或字符串模糊匹配误触发评分。

## 4. TASK_COMPLETED 结果边界

允许写入 orchestration `TASK_COMPLETED.result` 的字段包括：

- `execution_id`
- `scoring_execution_id`
- `total_score`
- `breakdown`
- `applied_rule_count`
- `scoring_run_mode`
- `replay_consistency`
- `inconsistency_type`
- `config_version_id`
- `tenant_id`
- `scoring_blocked`

禁止写入：

- 完整 email；
- 完整 phone；
- HTML；
- headers；
- cookies；
- stack；
- 原始 scoring event stream；
- 完整规则值；
- secrets；
- 原始 Lead 对象。

## 5. Replay 边界

orchestration replay 只根据 orchestration 事件重建任务状态。

它不会重新调用 `scoreLeadAPI()`，不会重新运行 scoring engine，也不会重算业务评分。评分结果只作为 `TASK_COMPLETED.result` 中已经记录的脱敏摘要被读取。

## 6. 职责边界

- Orchestration：负责 DAG、scheduler、任务状态、事件发射、任务完成摘要。
- Lead Scoring：负责规则校验、评分、解释、评分 replay consistency。
- Adapter：负责两者之间的本地、脱敏、最小桥接。
- Replay：负责重建 orchestration execution 状态，不负责重新执行业务任务。

## 7. 当前限制

- 仅本地内存级集成；
- 无数据库持久化；
- 无 n8n 接入；
- 无 HTTP server；
- 无真实 Agent 执行；
- 无跨进程事件保存；
- 无生产数据写入。

## 8. 风险

- `TASK_COMPLETED.result` 是摘要，不包含完整评分解释；后续如需审计完整 scoring trace，必须通过单独设计持久化边界。
- 当前 adapter 依赖本地 `scoreLeadAPI()` facade；未来如引入 API server 或多租户配置仓库，需要另行审查权限和隔离。
- 当前 invalid config 以 `scoring_blocked = true` 和 `total_score = null` 表示阻断，不生成伪成功分数。

## 9. 验收标准

- `npm run typecheck` 通过；
- 既有 orchestration demo/test 通过；
- 既有 scoring demo/test 通过；
- 新 orchestration scoring demo 输出 `total_score = 21`；
- 新 orchestration scoring tests 全部通过；
- `TASK_COMPLETED.result` 不包含完整 email、phone、HTML、headers、cookies、stack、secrets 或原始 event stream；
- orchestration replay 不重新调用 scoring。

## 10. 回滚方式

- 删除或停用 `task_kind = "lead_scoring"` 的 scheduler 分发分支；
- 删除或停用 `packages/orchestration/src/lead-scoring-adapter.ts`；
- 删除新增 demo / test scripts；
- 不影响原有 `scoring-engine`；
- 不影响原有 mock orchestration task；
- 不涉及生产数据回滚。

## 11. 下一步入口

下一步如需进入持久化、API server、n8n、数据库、真实 Agent 或多租户配置接入，必须先获得用户明确批准，并单独提供影响范围、验收标准和回滚方式。
