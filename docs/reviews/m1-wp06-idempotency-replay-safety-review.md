# M1-WP06 Idempotency and Replay Safety Review Pack

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：本地内存 Intake、Shadow、Review、Audit 的幂等与审计型 replay 安全增强。
禁止事项：不连接数据库，不执行 SQL/migration，不修改 v0.1 评分事实，不修改 n8n、Docker 或服务器，不进行真实外联。

## 实现清单

- `packages/persistence/src/idempotency-replay-safety.ts`：统一操作契约、脱敏默认 key、审计型 replay 检查；
- Intake、Shadow、Review、Audit 入口：在 repository 写入前校验统一幂等作用域；
- `apps/api-server/m1-idempotency-replay-safety-tests.ts`：验证重复保护、终态冲突、审计顺序、缺失事件与 v0.1 不变式；
- `docs/persistence/M1-WP06-IDEMPOTENCY-REPLAY-SAFETY-DESIGN.md`：边界、失败策略与回滚说明。

## 验收要求

- 同 tenant/key 的 Intake、Shadow、Review 和 Audit 操作不会生成重复记录；
- Review 终态不允许用新 key 改写；
- 审计型 replay 只读取脱敏事件，识别顺序、重复、trace 混入和缺失事件；
- replay 不调用 Scoring、Agent、数据库或外部系统；
- v0.1 score、grade、priority 不发生变化；
- 全部本地测试和 typecheck 通过。

## 已知限制

当前仅为内存模型，不具备跨进程锁、数据库唯一约束、事务或持久化 replay。生产实现必须在 M1-WP07 SQL 草案审查、影响范围和回滚设计完成，并取得用户明确批准后才可讨论。

## 回滚原则

移除新增本地契约模块及其入口调用即可恢复 M1-WP05 行为；不涉及生产数据、数据库或 v0.1 评分回滚。

## 下一步入口

M1-WP06 完成后需经过 PR、CI、第二层审查和用户批准。M1-WP07 Migration Draft Review Package 以及任何数据库、SQL、n8n、服务器或真实外联动作均需单独授权。
