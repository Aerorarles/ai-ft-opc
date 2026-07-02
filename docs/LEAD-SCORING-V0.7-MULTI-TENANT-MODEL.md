# Lead Scoring v0.7 Multi-Tenant Model

版本：v0.7-draft
日期：2026-07-01
状态：SaaS 多租户隔离设计草案，仅供本地审查
适用范围：Lead Scoring API 服务层、多租户配置隔离、事件与快照隔离、replay 隔离
禁止事项：不写 SQL migration，不连接 PostgreSQL，不接 n8n、Docker、服务器或外部 API，不读取 secrets，不执行 Git 操作。

## 1. Tenant Isolation Scope

`tenant_id` 是 v0.7 SaaS scoring backend 的第一隔离边界。所有 API 请求、配置读取、event trace、snapshot、replay 和审计结果都必须限定在同一 `tenant_id` 内。

基本原则：

- 请求必须显式携带 `tenant_id`；
- 配置必须按 tenant 分区；
- event store 查询必须限定 tenant；
- snapshot 查询必须限定 tenant；
- replay 不能跨 tenant 读取 event stream；
- API 响应不能暴露其他 tenant 的配置、规则、事件或评分结果。

## 2. Config Separation Per Tenant

每个 tenant 应拥有独立配置版本空间：

```text
tenant_id + config_version_id -> scoring config
```

同名 `config_version_id` 在不同 tenant 中可以指向不同配置，但同一 tenant 内必须唯一。

当前本地 `scoreLeadAPI` 使用内存配置注册表模拟该行为，不读取数据库，不访问外部配置服务。

## 3. Tenant-Level Config Versioning

未来配置版本应包含：

- tenant_id；
- config_version_id；
- config_checksum；
- config_schema_version；
- engine_version；
- status：draft / review / approved / active / archived；
- published_by；
- approved_by；
- published_at。

已发布版本不可直接编辑，只能复制为新的 draft。

## 4. Tenant-Level Outcome Policy

Outcome policy 也必须按 tenant 隔离：

- tenant 可拥有自己的 grade / priority 阈值；
- scoring config version 必须绑定明确 outcome policy version；
- replay metadata 必须记录 outcome policy checksum；
- policy 缺失时只能输出 score，不得输出 grade / priority diff。

## 5. Event Store Partitioning Strategy

逻辑设计：

- 所有 event 必须带 `tenant_id`；
- 主查询路径为 `tenant_id + execution_id + sequence_index`；
- 高写入场景可按 tenant hash 或时间分区；
- OLAP 分析应使用只读副本或离线聚合，不直接压迫 OLTP 写入路径。

当前阶段不创建真实表，不写 SQL。

## 6. Snapshot Isolation

Snapshot 是读取优化，不是事实来源。每条 snapshot 必须绑定：

- tenant_id；
- execution_id；
- config_version_id；
- config_checksum；
- engine_version；
- replay consistency 状态。

API 读取 snapshot 前必须确认 tenant 匹配。tenant 不匹配时必须拒绝，而不是 fallback 到跨 tenant 查询。

## 7. No Cross-Tenant Replay Leakage

Replay 必须满足：

- 只在同一 tenant 内选择 snapshot；
- 只在同一 tenant 内读取 event stream；
- replay output 不包含其他 tenant 的 rule set 或 config metadata；
- consistency arbitration 不比较跨 tenant 事件；
- request_trace_id 不得作为跨 tenant 查询授权依据。

## 8. Tenant-Level Replay Consistency

Replay consistency 必须按 tenant 记录：

- checksum mismatch；
- engine version mismatch；
- missing events；
- snapshot mismatch；
- event order corruption。

同一 execution_id 若未来跨 tenant 理论上冲突，必须以 `tenant_id + execution_id` 作为逻辑唯一键。

## 9. 验收标准

- API 请求必须携带 tenant_id；
- tenant A 不能读取 tenant B 的 config；
- event、snapshot、replay 都有 tenant 隔离模型；
- 文档不包含真实客户数据或 secrets；
- 不涉及数据库执行。

## 10. 风险

- 未强制 tenant 过滤会导致跨租户数据泄漏；
- 共享 config registry 若无命名空间会造成配置串用；
- snapshot 若缺少 tenant_id 会破坏 SaaS 边界。

## 11. 回滚原则

当前仅为本地 API 层与设计文档。若发现隔离规则不足，可停止使用 API facade，继续使用本地 scoring engine。

## 12. 下一步入口

下一步可进入 v0.8 production architecture design。任何数据库、API server、n8n 或部署实现前必须获得用户明确批准。
