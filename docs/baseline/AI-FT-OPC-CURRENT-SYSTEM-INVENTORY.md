# AI FT-OPC Current System Inventory

版本：M0-WP01 v1.0
日期：2026-07-11
状态：基线盘点完成
适用范围：本地工作树事实、已验证本地测试、已确认的 Lead Agent v0.1 历史生产事实
禁止事项：本文件不授权数据库连接或写入、migration 执行、n8n 发布/激活、Docker/服务器操作、真实外联或 Git 写操作。

## 1. Repository Overview

当前仓库是 AI FT-OPC 的本地实验与产品化工作树。最新主体架构权威文件为 `docs/project-context/AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md`。当前 Milestone 为 M0 Architecture Freeze & Baseline；本盘点不把本地 demo、迁移草案或架构文档表述为生产完成。

## 2. Current Runtime Modes

| 模式 | 状态 | 事实 |
|---|---|---|
| Lead Agent v0.1 正式事实 | PRODUCTION_VERIFIED | 仅依据已确认的项目权威文档；本 WP 未连接数据库或 n8n 复验。v0.1 score / grade / priority 仍是生产评分事实。 |
| Phase 1 本地链路 | LOCAL_WORKING | 内存 Lead ingestion、dedup、decision、review queue 与 API facade。 |
| Phase 2 本地链路 | LOCAL_WORKING | 内存 v0.2 shadow scoring、diff、review、API facade 与静态 workbench。 |
| Lead Scoring v0.2-v0.7 | LOCAL_WORKING | 配置驱动评分、解释、trace、replay、persistence abstraction 与 API facade。 |
| Orchestration v0.8.x | LOCAL_WORKING | DAG scheduler、事件流、replay/audit 与本地 scoring task adapter。 |
| PostgreSQL persistence | DRAFT | adapter 为 guard/stub；DRAFT migration 未执行。 |
| n8n 工作流 | PARTIAL | 仓库有导出 JSON；真实实例与凭据不完整导出，不能以仓库 JSON 替代生产配置。 |
| HTTP 服务 | PARTIAL | 有本地 handler 与显式启用入口；默认不监听，未作为生产服务验证。 |

默认安全运行约束：`APP_STORAGE_MODE=memory`、`SHADOW_WRITER_ENABLED=false`、`HTTP_SERVER_ENABLED=false`。

## 3. Major Directories

| 名称 | 路径 | 用途 | 状态 |
|---|---|---|---|
| 产品 API/demo | `apps/api-server` | Phase 1/2 内存 API、demo、测试、编排演示 | LOCAL_WORKING |
| 静态工作台 | `apps/workbench` | Lead、shadow diff、review queue 的本地 UI 原型 | PARTIAL |
| 标准化 | `packages/ingestion` | company/domain/country/industry/signals 标准化 | LOCAL_WORKING |
| 去重 | `packages/dedup` | 同域与简单名称相似度去重 | LOCAL_WORKING |
| 决策 | `packages/decision` | HOT/WARM/COLD 决策 | LOCAL_WORKING |
| 审核队列 | `packages/review-queue` | Phase 1 内存审核状态转换 | LOCAL_WORKING |
| Phase 2 领域层 | `packages/phase2-domain` | shadow run、diff、review 业务编排 | LOCAL_WORKING |
| 持久化 | `packages/persistence` | 内存仓储、PostgreSQL adapter 草案与 guard | PARTIAL |
| 编排 | `packages/orchestration` | task graph、scheduler、事件、replay、scoring adapter | LOCAL_WORKING |
| 评分内核 | `scoring-engine` | v0.2-v0.7 配置评分与 replay 控制面 | LOCAL_WORKING |
| 评分配置 | `scoring-config` | `v1.json`、非法配置测试样本 | LOCAL_WORKING |
| 数据库草案 | `database/migrations` | v0.1 历史 migration 与 v0.2/Phase 2 DRAFT | DRAFT |
| n8n 导出 | `workflows/n8n` | 历史与草案 JSON 导出 | PARTIAL |
| 项目文档 | `docs` | 架构、设计、验收、上下文、基线 | LOCAL_WORKING |

## 4. Modules

| Name | Path | Purpose | Status | Runtime | Persistence | Dependencies | Tests | Production Readiness | Known Limitations |
|---|---|---|---|---|---|---|---|---|---|
| Lead Agent v0.1 | `docs/*v0.1*`, `database/migrations/001-004` | Candidate→Review→Promote→Lead、v0.1 评分与 enrichment 历史事实 | PRODUCTION_VERIFIED | 已确认历史生产链路 | PostgreSQL | n8n、PostgreSQL | 本 WP 未运行生产验证 | 已封存事实 | 实际 n8n 凭据与运行态未完整导出。 |
| Ingestion | `packages/ingestion/src/index.ts` | 输入清洗、domain、country、industry、signals | LOCAL_WORKING | Node/tsx | 无 | Node | `phase1:test` | 本地 MVP | country/industry 规则为简单启发式。 |
| Dedup | `packages/dedup/src/index.ts` | 同域、公司名 Jaccard 相似度 | LOCAL_WORKING | Node/tsx | 无 | ingestion 输出 | `phase1:test` | 本地 MVP | 无跨运行持久化、无实体合并审计。 |
| Decision | `packages/decision/src/index.ts` | 基于 v0.1 与 shadow score 输出 HOT/WARM/COLD | LOCAL_WORKING | Node/tsx | 无 | normalized lead、shadow score | `phase1:test` | 本地 MVP | 非正式销售政策引擎。 |
| Review Queue | `packages/review-queue/src/index.ts` | pending/approved/rejected 内存审核队列 | LOCAL_WORKING | Node/tsx | 内存 Map | decision | `phase1:test` | 本地 MVP | 无角色、审批审计、重启留存。 |
| Shadow Service | `packages/phase2-domain/src/shadow-service.ts` | 单 Lead preview/write 分支、diff、review item | LOCAL_WORKING | Node/tsx | memory repo；Postgres 仅草案 | scoring API、repositories | `phase2:test` | Shadow-only | 不写 `public.leads`，未连生产 DB。 |
| Persistence | `packages/persistence/src` | memory repositories、guarded PostgreSQL adapter surface | PARTIAL | Node/tsx | 内存；PostgreSQL placeholder | phase2 domain | `phase2:test` | 设计准备 | placeholder query 不可视作生产实现。 |
| Scoring Engine | `scoring-engine/src` | config validation、rule evaluation、trace、replay、API facade | LOCAL_WORKING | Node/tsx | 内存 trace/event store abstraction | local JSON config | `test:scoring` | Shadow-ready | 非生产持久化；v0.2 不得覆盖 v0.1。 |
| Orchestration | `packages/orchestration/src` | DAG、scheduler、event emitter、replay/audit、scoring adapter | LOCAL_WORKING | Node/tsx | 内存事件流 | scoring facade | `test:orchestration`, `test:orchestration-scoring` | 本地 MVP | 重启后事件丢失；不是队列/worker 服务。 |
| API Facades | `apps/api-server/phase1-api.ts`, `phase2-api.ts` | 内存 JSON request handler | LOCAL_WORKING | Node/tsx | 内存 | modules above | Phase 1/2 tests | 本地 MVP | 未部署、无认证、无真实 HTTP 服务验证。 |
| Workbench | `apps/workbench` | 静态操作台原型 | PARTIAL | 浏览器静态页面 | 依赖本地 `/api/*` | phase2 API | 间接覆盖 | 原型 | 不等于生产 Dashboard。 |

## 5. APIs

| API facade | Input | Output | 状态 |
|---|---|---|---|
| `POST /lead/ingest` | 原始 lead 输入 | normalized record / duplicate 标记 | LOCAL_WORKING |
| `GET /lead/:id` | 本地 record id | 内存 lead record | LOCAL_WORKING |
| `POST /lead/decide` | lead_id | decision | LOCAL_WORKING |
| `POST /lead/review` | review_item_id、action、note | 更新后的审核项 | LOCAL_WORKING |
| `GET /leads` | 无 | 内存记录 | LOCAL_WORKING |
| `GET /api/health` | 无 | 本地 memory 健康状态 | LOCAL_WORKING |
| `GET /api/leads`, `GET /api/leads/:id` | 查询路径 | 脱敏 lead snapshot | LOCAL_WORKING |
| `POST /api/shadow-runs/single-lead/preview` | lead_id、config、预览控制参数 | shadow run/result/diff/decision | LOCAL_WORKING |
| `GET/POST /api/review-queue*` | queue filters / review action | review item(s) | LOCAL_WORKING |

## 6. Workflows

仓库可见 n8n JSON 包括 lead search、hunter、intake、candidate triage/promotion、Lead Enrichment v0.1.x 和 v0.2 shadow draft。静态文件存在不证明其已导入、激活或与生产凭据一致。以权威文档为准：Lead Enrichment v0.1.7 是已封存验证事实；所有新 n8n 接入仍须设计→静态审查→inactive 导入→局部验证→回写审查→单条验证→去凭据导出→精确 Git 归档。

## 7. Database / Migration State

- `001-004`：历史 v0.1 migration 文件存在；本 WP 未读取或执行生产数据库。
- `DRAFT-005-lead-scoring-v0.2-shadow-mode.sql`：仅草案，设计 `lead_scoring_shadow_runs/results/diff/explanations` 与索引；明确不改 `public.leads` 官方评分字段与 v0.1 trigger/function。
- `DRAFT-006-phase2-review-queue.sql`：仅草案，设计 `lead_review_queue/lead_review_decisions` 与索引。
- `packages/persistence/src/postgres/*`：注入 client 的 placeholder adapter，写入路径有显式 guard；不构成可执行生产持久化。

## 8. Tests

2026-07-11 本地运行并通过：

- `npm.cmd run typecheck`
- `npm.cmd run phase1:test`：6 项通过。
- `npm.cmd run phase2:test`：13 项通过。
- `npm.cmd run test:scoring`：54 项通过。
- `npm.cmd run test:orchestration`：7 项通过。
- `npm.cmd run test:orchestration-scoring`：8 项通过。

PowerShell 的 `npm.ps1` 被本机 execution policy 阻止；改用 `npm.cmd` 后正常运行。这是终端调用差异，不是项目测试失败。

## 9. Current Safety Defaults

- 无数据库连接、无 migration 执行、无生产写入。
- Phase 2 默认 memory mode；PostgreSQL shadow write 默认拒绝。
- v0.2 shadow 不覆盖 v0.1 官方 score / grade / priority。
- 不自动外联；真实邮件、WhatsApp、LinkedIn、表单、报价均须独立审批。
- 不读取或提交 `.env`、credentials、API key、token、cookie、连接串或原始客户数据。

## 10. Architecture Layer Mapping

| Layer | 已有资产 | 当前判断 |
|---|---|---|
| L1 Human Control Plane | Review queue 状态、手工 review 文档边界 | PARTIAL：缺少角色、审批与权限持久化。 |
| L2 AI OPC Control Plane | scoring execution context/trace/replay、orchestration DAG/events/replay | PARTIAL：policy/approval/RBAC/audit 多为设计或本地实现。 |
| L3 Business Capability | intake、normalization、dedup、scoring shadow、decision、review | PARTIAL：candidate intelligence、CRM export、outreach/suppression 缺失。 |
| L4 Execution & Integration | local API facades、scheduler、n8n exports | PARTIAL：无受控 n8n runtime、queue/worker、外部 adapter。 |
| L5 Data & Trust | JSON config、memory repositories、DRAFT migrations | PARTIAL：生产 persistence、audit/evidence、Redis/Qdrant 均未落地。 |
| L6 Product Experience | static workbench | PARTIAL：无正式 Dashboard、Candidate/Lead/Audit/Settings centers。 |

## 验收标准

- 目录、模块、API、测试与持久化状态均能追溯至当前工作树或权威 master architecture。
- 每项状态仅使用 `PRODUCTION_VERIFIED`、`LOCAL_WORKING`、`PARTIAL`、`DRAFT`、`ARCHITECTURE_ONLY`、`MISSING`。

## 风险

本库存不替代生产环境核验；未导出的 n8n 凭据与生产数据库状态必须通过单独的受控只读审查确认。

## 回滚原则

本文件是新增文档；如后续基线被证伪，应以新的受审计修订替代，不改写历史运行事实。

## 下一步入口

阅读 `AI-FT-OPC-COMMERCIAL-V1-GAP-REGISTER.md` 与 `M1-PRODUCTION-DATA-FOUNDATION-PLAN.md`，由用户批准具体 M1 Work Package 后再实施。
