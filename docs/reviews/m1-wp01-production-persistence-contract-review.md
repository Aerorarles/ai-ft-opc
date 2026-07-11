# M1-WP01 Production Persistence Contract Review Pack

版本：v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：M1-WP01 的本地 contract、测试与 DRAFT migration 对齐审查
禁止事项：未执行数据库连接、migration、生产写入、n8n、Docker、服务器、真实外联或 Git main merge。

## 范围

- 新增纯本地 `production-persistence-contract` 模块。
- 新增 M1 contract 自测。
- 记录逻辑实体与 DRAFT migration 的对齐差距。
- 更新项目控制状态至 M1-WP01 READY_FOR_REVIEW。

## 变更清单

- `packages/persistence/src/production-persistence-contract.ts`
- `packages/persistence/src/index.ts`
- `apps/api-server/m1-persistence-contract-tests.ts`
- `package.json`
- `docs/persistence/M1-WP01-PRODUCTION-PERSISTENCE-CONTRACT.md`
- `docs/progress/M1-WP01-progress.md`
- M0.5 closeout 与 Project Control 状态文件。

## 验证

- `npm.cmd run test:m1-contract`：验证逻辑实体、完整脱敏 envelope、缺失版本锚点、禁止键名。
- `npm.cmd run typecheck`：保证新增 TypeScript/JSDoc 契约可检查。
- 既有 memory repository 与 scoring/orchestration 回归命令需继续通过。
- 仅静态读取 DRAFT-005/006；未修改、未执行 SQL。

## 已确认不变式

- v0.1 score / grade / priority 不受影响。
- v0.2 shadow 仍不写回 `public.leads` 正式评分字段。
- 不保存 HTML、headers、cookies、stack、response、credential 或 secrets。
- PostgreSQL adapter 仍为 guard/stub；无数据库连接。

## 待后续 Work Package 决策

- 物理表命名与逻辑实体映射的最终冻结。
- tenant/organization/actor/idempotency 的真实数据库约束。
- intake persistence、shadow persistence、review persistence、audit foundation 的拆分与 migration 顺序。

## 风险

本 contract 是本地接口约束，不是数据库 schema。若后续 migration 未按此 contract 对齐，必须回到 WP01/WP07 重新审查。

## 回滚原则

可撤销新增本地 contract、测试和文档；不涉及生产数据或数据库回滚。

## 下一步入口

等待 M1-WP01 审查与用户对下一 M1 Work Package 的明确批准。
