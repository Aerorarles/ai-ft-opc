# AI FT-OPC Interface Map

版本：M0-WP01 v1.0
日期：2026-07-11
状态：当前本地接口映射
适用范围：代码可见接口与权威文档确认的 v0.1 事实
禁止事项：不据此调用生产数据库、n8n、外部服务或真实触达。

| Module | Input Contract | Output Contract | Calls / Dependencies | Persistence | Failure Model |
|---|---|---|---|---|---|
| Ingestion | `LeadInput`：company_name/company、website、country、industry、email、phone、notes、signals | `LeadNormalized`：id、company_name、domain、country、industry、signals 等 | 无外部依赖 | 无 | 空名称回退 Unknown Company；无效 domain 返回 null。 |
| Dedup | 两个 `{company_name, domain}` | `DedupResult`：duplicate、reason、confidence | ingestion 输出 | 无 | 同域为重复；名称相似度阈值 0.75；否则非重复。 |
| v0.1 score snapshot | 本地 normalized lead 的 `legacy_v01_score` 或 Phase 2 `ExistingLeadSnapshot` | `v1_score/v01_score`、grade、priority 快照 | Phase 1/2 domain | 内存 snapshot；历史生产事实在 PostgreSQL | 本地不重算 v0.1；缺值为受控本地默认，不得替代生产事实。 |
| v0.2 Shadow Scoring | canonical lead、tenant、config version、run mode、trace/idempotency | total_score、breakdown、applied_rules、replay metadata | `scoreLeadAPI`、`v1.json`、memory trace | 内存；event store abstraction | 无效 config 返回 null score/blocked；不得写 v0.1 官方字段。 |
| Decision | v1 score、v2 shadow score、lead signals/contact/website | HOT/WARM/COLD、confidence、reasons、risk_flags、next_step | Phase 1 score / Phase 2 decision service | 无 | 无 website→COLD；冲突信号→WARM；只推荐人工 review。 |
| Review Queue | lead/diff/decision 或 Phase 2 review item | pending/approved/rejected/skipped item | decision、repositories | Phase 1 Map；Phase 2 memory repo | 不存在项或重复关闭为错误；无角色/审批权限控制。 |
| Persistence | repository interfaces：lead/shadow/review | memory entities；Postgres adapter 方法面 | Phase 2 domain | memory repository；Postgres placeholder | guard 默认拒绝 PostgreSQL shadow write；adapter 非生产 SQL 实现。 |
| API | Phase 1 `/lead/*`；Phase 2 `/api/*` method/path/body | `{status,json}` | module services / repositories | 内存 | 不存在资源返回 404；无认证、无网络部署。 |
| Workbench | `/api/*` 本地 endpoint | 静态页面显示脱敏 lead、diff、review | 浏览器、Phase 2 API | 无 | 本地原型；无正式 session/RBAC。 |
| Orchestration | `OrchestrationTaskInput`，包括 mock 或 `lead_scoring` task_kind | execution_id、results、events、final state | task graph、scheduler、event emitter、scoring adapter | 内存 events | 任务失败事件；replay 仅重建状态，不重跑 agent/scoring。 |
| n8n production workflows | 历史 workflow 输入及节点配置 | Candidate/Lead/enrichment 历史流程 | n8n、PostgreSQL、人工 review | 生产事实仅据文档确认 | 仓库导出不完整，凭据未导出；不可根据文件推断运行态。 |
| PostgreSQL scoring | `public.leads` 与 v0.1 trigger/function 历史边界 | 官方 v0.1 score/grade/priority | PostgreSQL、Lead Agent v0.1 | PostgreSQL | 本 WP 未连接；v0.2 shadow 不得改写。 |
| Lead Enrichment | 单 UUID、公开站点与最多一个同根域 Contact 页面 | 安全的 enrichment 摘要/状态 | n8n、PostgreSQL、人工 review | PostgreSQL 历史事实 | v0.1.7 已封存验证；禁止绕过访问控制或自动触达。 |

## 接口边界要点

1. scoring engine 负责评分、解释、trace/replay；它不是 API server、数据库或 n8n workflow。
2. orchestration 负责本地任务依赖和事件；它不替代数据库队列、worker 或真实 Agent runtime。
3. Phase 2 API 是内存 facade，不是已部署的生产 HTTP API。
4. PostgreSQL adapter 和 DRAFT migration 是未来接口/结构草案，不能作为当前 production persistence。
5. n8n 是执行层；真实 workflow 与凭据没有完整导出，必须在实例内另行审查。

## 验收标准

所有接口均标明输入、输出、依赖、持久化和失败模型，且没有把草案接口写成生产服务。

## 风险

从内存接口迁移至 PostgreSQL 时，实体命名、事务、幂等、审计与 v0.1 不变式需单独设计和批准。

## 回滚原则

本映射不改变运行时。未来接口改动须保持 v0.1 官方评分和 Candidate→Review→Promote 边界不变。

## 下一步入口

按 M1 plan 先定义生产 persistence contract，再准备 intake/shadow/review 的受审计 migration 草案。
