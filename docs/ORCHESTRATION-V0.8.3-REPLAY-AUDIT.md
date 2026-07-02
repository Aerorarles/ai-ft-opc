# Orchestration v0.8.3 Replay Audit

版本：v0.8.3
日期：2026-07-02
状态：本地内存级 orchestration replay / audit 已实现
适用范围：`packages/orchestration` 的本地事件流重放、任务状态重建和一致性审计
禁止事项：不连接数据库，不写 SQL 或 migration，不接 n8n，不修改 Docker 或服务器配置，不访问外部 API，不读取 secrets，不执行 Git 写操作。

## 1. 定位

v0.8.3 是 orchestration runtime 的本地内存级 replay / audit 能力。

它只做三件事：

- 根据已产生的 `OrchestrationEvent` 重建 execution 状态；
- 审计事件顺序和任务状态转换是否一致；
- 输出 replay summary 与 consistency errors。

它不做：

- 不重新执行 Codex、DB、n8n 或任何 Agent；
- 不重算业务结果；
- 不连接数据库；
- 不提供生产级持久化 event sourcing；
- 不跨进程查询历史事件。

## 2. Replay 边界

Replay 的含义是：

```text
events -> reconstruct execution state
```

`TASK_COMPLETED.result` 只作为已记录结果摘要读取。Replay 不得假设 Agent 输出完全 deterministic，也不得重新调用 Agent。

## 3. 事件状态机

基础状态：

- `PENDING`
- `READY`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `SKIPPED`，当前事件模型未实际 emit，仅作为未来兼容状态保留。

当前支持事件：

- `TASK_CREATED`
- `TASK_READY`
- `TASK_STARTED`
- `TASK_COMPLETED`
- `TASK_FAILED`
- `EXECUTION_COMPLETED`

状态重建规则：

- `TASK_CREATED` -> `PENDING`
- `TASK_READY` -> `READY`
- `TASK_STARTED` -> `RUNNING`
- `TASK_COMPLETED` -> `COMPLETED`
- `TASK_FAILED` -> `FAILED`
- `EXECUTION_COMPLETED` -> execution 尝试进入 completed

## 4. 一致性规则

Replay 必须检测：

- 空事件流；
- 缺少 `TASK_CREATED`；
- `TASK_STARTED` 前没有 `TASK_CREATED`；
- `TASK_COMPLETED` 或 `TASK_FAILED` 前没有 `TASK_STARTED`；
- 同一 task 出现 `COMPLETED` 与 `FAILED` 双终态；
- 同一 task 重复完成；
- `EXECUTION_COMPLETED` 前仍有 `RUNNING` / `READY` / `PENDING` task；
- `sequence_index` 缺失、重复或不递增；
- 混入其他 `execution_id` 的事件；
- 有 task 事件但没有 `EXECUTION_COMPLETED` 时标记为 `incomplete`，不是 `completed`。

## 5. 输出结构

`replayOrchestrationExecution(executionId, events)` 输出：

- `execution_id`
- `execution_status`
- `task_states`
- `task_order`
- `event_count`
- `started_task_ids`
- `completed_task_ids`
- `failed_task_ids`
- `consistency_errors`
- `is_consistent`
- `replay_summary`

`auditOrchestrationExecution(executionId, events, originalSummary?)` 在 replay 基础上额外比较可选原始摘要。

## 6. Engine 集成边界

`OrchestrationEngine` 仍只负责：

- 构建 DAG；
- 调用 scheduler；
- 产生事件；
- 返回当前 execution 的事件流。

Replay 逻辑位于 `packages/orchestration/src/replay.ts`，audit 逻辑位于 `packages/orchestration/src/audit.ts`。Replay 不塞进 engine。

## 7. 已知限制

- 当前 event stream 只在内存中存在；
- 进程重启后事件丢失；
- 无数据库持久化；
- 无跨进程查询；
- 无跨机器 replay；
- 无生产级 event store、索引、权限或审计表；
- 当前 demo 使用 mock task，不执行真实 Agent。

## 8. 未来持久化要求

未来如需持久化，必须单独提供：

- SQL 草案；
- 影响范围；
- 回滚方案；
- 权限与审计设计；
- 用户明确批准。

未经批准不得连接 PostgreSQL、创建 migration、接入 n8n、修改 Docker 或部署服务器。

## 9. 验收标准

- 正常 completed execution 可被 replay；
- 异常事件序列可被识别；
- 无 `EXECUTION_COMPLETED` 时标记为 incomplete；
- Replay 不重新执行 Agent；
- Demo 输出 execution id、event count、task states、consistency result；
- 不涉及数据库、n8n、Docker、服务器、secrets 或外部 API。

## 10. 下一步入口

下一步可以继续设计 orchestration runtime 的持久化边界或生产部署架构，但必须先获得用户明确批准。
