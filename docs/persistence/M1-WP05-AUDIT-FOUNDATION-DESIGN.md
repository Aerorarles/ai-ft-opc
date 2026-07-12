# M1-WP05 Audit Foundation Design

版本：M1-WP05 v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：本地内存跨 Intake、Shadow、Review 的最小审计事件契约、查询与保留边界。
禁止事项：不连接数据库，不创建或执行 SQL/migration，不修改 `public.leads`，不激活 n8n，不操作服务器，不进行真实外联。

## 目标

提供跨模块的最小审计骨架。每个事件以 `request_trace_id` 关联，以 entity ID 定位，以 `tenant_id + idempotency_key` 去重；事件只保存可解释的摘要，不重放业务动作、不保存原始客户数据。

## 事件模型

- `intake_completed`：关联 intake run，保存计数与布尔摘要。
- `shadow_persisted`：关联 shadow run/result，保存分数、replay consistency 等摘要。
- `review_decided`：关联 review item/decision，保存终态与是否有备注的摘要。

每个事件有稳定 audit event ID、scope、entity type/id、可选跨模块关联 ID、`sequence_index`、时间戳和 `payload_summary`。

## 查询与保留边界

- 按 `request_trace_id` 查询时按 `sequence_index` 递增返回，用于本地审计时间线。
- 按 entity type/id 查询时只返回该实体相关事件。
- 同一 tenant/idempotency key 重试复用既有 event，不生成重复记录。
- 当前为进程内 memory repository；进程重启即丢失。未来持久化必须先单独审查 schema、索引、保留期限、访问权限、影响范围和回滚。

## 脱敏规则

不保存完整 email、phone、contact_name、raw_data、HTML、headers、cookies、stack、response、credentials、API key、password、token、connection string、人工备注原文或客户原始资料。契约只检查键名并返回标准化错误代码，避免在验证路径暴露值。

## 已知限制

本 WP 不会自动在 Intake、Shadow、Review 运行时写审计事件；它提供可复用的 audit adapter 和契约。未来接入点必须经独立审批，且不能将 replay 误实现为重新执行业务逻辑。

## 验收标准

- trace 时间线顺序稳定；按 entity 可查询。
- 幂等重试不重复写事件。
- 禁止字段键名被阻断，原始值不进入事件。
- 不连接数据库、不修改 DRAFT SQL、不中断既有 Phase 1/2 与 scoring/orchestration 行为。

## 风险与回滚

内存存储不能证明生产审计的保留、并发、权限或不可篡改性。移除 local audit module/repository/test/doc 即可回滚，无生产数据副作用。

## 下一步入口

等待 M1-WP05 第二层审查和用户批准。M1-WP06 Idempotency & Replay Safety 以及任何数据库、SQL、n8n 或服务器动作需新的明确授权。
