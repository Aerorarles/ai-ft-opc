# M1-WP06 Idempotency and Replay Safety Design

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：本地内存 Intake、Shadow、Review、Audit 的统一幂等与审计型 replay 契约。
禁止事项：不连接或写入数据库，不创建或执行 SQL migration，不修改 v0.1 评分事实，不激活 n8n，不操作 Docker/服务器，不进行真实外联。

## 目标

为 `intake_submission`、`shadow_run`、`review_action` 和 `audit_event` 统一规定 tenant、trace、idempotency key 与 replay 行为。重复请求必须复用既有安全结果或被终态规则拒绝，不能制造重复候选、Shadow run、Review decision 或 Audit event。

## 统一契约

每个可写入口在变更 repository 前校验：

- `tenant_id`：隔离边界；
- `request_trace_id`：跨 Intake、Shadow、Review、Audit 的关联标识；
- `idempotency_key`：同 tenant、同操作的重复保护标识；
- `operation`：四类受支持操作之一；
- `replay_behavior`：业务写入仅允许 `reuse_existing`；审计 replay 仅允许 `audit_only`。

缺失或不合法时只返回标准错误代码，不写入 repository，也不暴露原始输入。

## 重复与失败策略

| 操作 | 相同 tenant/key | 不同 key 的终态重试 | 处理 |
| --- | --- | --- | --- |
| Intake | 复用既有 intake run | 允许新受控请求 | 不产生重复 candidate |
| Shadow | 复用既有 shadow run/result | 允许独立受控 shadow run | 不改写 v0.1 score/grade/priority |
| Review | 复用既有 decision | 终态 item 拒绝再次决定 | 保留 append-only decision history |
| Audit | 复用既有 event | 允许新事件 | 保持 trace sequence |

默认生成的 Shadow key 对实体标识做哈希，不把实体标识写入 key 文本。

## 审计型 Replay

`auditReplaySafety` 仅读取已存在的脱敏 Audit event，检查：

- 请求 trace 不混入其他 trace；
- sequence 从零连续递增；
- tenant + idempotency key 不重复；
- Intake → Shadow → Review 的事件顺序；
- 调用方要求的事件类型是否缺失。

该 replay 不运行 Intake、Scoring、Review、Agent 或任何外部行为，也不重新计算业务结果。异常只生成一致性错误并要求人工复核。

## 已知限制

当前为进程内 memory repository。没有数据库事务、跨进程锁、持久化唯一索引、保留策略或 RLS/RBAC。生产级分布式重试、队列投递和数据库唯一约束必须在后续 SQL 草案审查、影响分析、回滚设计及用户明确批准后单独实施。

## 验收标准

- 统一契约在所有四个入口先于本地写入校验；
- 相同 tenant/key 的 Intake、Shadow、Review、Audit 请求可解释地复用；
- 审计 replay 能识别缺失、重复和顺序异常，且不执行任何业务动作；
- Shadow 路径不修改 v0.1 生产评分事实；
- 不涉及数据库、SQL、n8n、Docker、服务器、secrets 或真实触达。

## 风险与回滚

风险是本地内存实现无法提供跨进程唯一性。回滚时移除新增契约调用和本地审计器即可；不需要回滚生产数据，也不影响既有 v0.1 评分。

## 下一步入口

完成本地验证、PR 审查和用户批准后，才可进入 M1-WP07 Migration Draft Review Package；任何 migration 执行仍需独立授权。
