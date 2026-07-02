# AI FT-OPC Master Memory

版本：Phase 1 + Phase 2 MVP baseline
日期：2026-07-02
状态：本地产品化 MVP 可运行，未接生产数据库、n8n 或外部 API

## 1. 当前项目定位

AI FT-OPC 当前是本地外贸获客产品化实验工作树，已具备：

- Phase 1：Lead Ingestion、Dedup、Rule-based Decision、Review Queue、JSON API、本地 demo/test。
- Phase 1.5 + Phase 2：v0.1 official score snapshot、v0.2 shadow scoring、本地 diff、decision、human review queue、memory persistence、PostgreSQL adapter 草案、静态 workbench。
- Lead Scoring：配置驱动评分、解释输出、execution context、trace/replay、persistence/replay control plane/API facade 设计与本地实现。
- Orchestration：DAG scheduler、event stream、replay/audit、本地 scoring task 集成。

## 2. 本地默认安全模式

默认运行模式必须保持：

- `APP_STORAGE_MODE=memory`
- `SHADOW_WRITER_ENABLED=false`
- `HTTP_SERVER_ENABLED=false`

当前本地 demo/test 不读取 `.env`，不连接数据库，不启动生产服务。

## 3. Phase 1 + Phase 2 核心链路

```text
Lead Ingestion
→ Dedup
→ v0.1 official score snapshot
→ v0.2 shadow scoring
→ Shadow diff
→ Decision Layer
→ Human Review Queue
→ Local API
→ Static Workbench
```

## 4. 关键目录

- `packages/ingestion`：Lead 标准化。
- `packages/dedup`：本地去重。
- `packages/decision`：HOT / WARM / COLD 决策。
- `packages/review-queue`：Phase 1 内存审核队列。
- `packages/persistence`：memory adapter 与 PostgreSQL adapter 草案。
- `packages/phase2-domain`：Phase 2 shadow run、diff、decision、review 编排。
- `apps/api-server`：本地 demo、测试、API handler。
- `apps/workbench`：静态本地工作台。
- `scoring-engine`：Lead Scoring v0.2-v0.7 本地核心。
- `scoring-config`：评分 JSON 配置。
- `database/migrations`：仅 DRAFT 草案，不得自动执行。

## 5. 推荐本地验证命令

```bash
npm run typecheck
npm run phase1:test
npm run phase2:demo
npm run phase2:test
npm run demo:scoring
npm run test:scoring
npm run demo:trace
npm run test:orchestration
npm run test:orchestration-scoring
```

## 6. 硬性禁止

- 不读取或提交 `configs/.env`、secrets、credentials、API Key、密码、Cookie。
- 不自动执行 SQL、migration、PostgreSQL Trigger 或数据库写入。
- 不修改 `public.leads` 正式评分字段。
- 不修改 `score_lead_v01()` 或 `leads_score_v01`。
- 不修改 n8n workflow 或 credentials。
- 不运行 Docker、服务器、Portainer 生产操作。
- 不自动邮件、WhatsApp、LinkedIn、表单提交、报价或任何真实客户触达。

## 7. Migration 状态

当前 `database/migrations` 中 Phase 2 相关文件均为 DRAFT：

- `DRAFT-005-lead-scoring-v0.2-shadow-mode.sql`
- `DRAFT-006-phase2-review-queue.sql`

这些文件仅用于人工审查，不是批准后的生产 migration。

## 8. 下一阶段需要批准

进入真实单条 Lead Shadow Run 前，必须由用户明确批准：

1. 真实目标 Lead UUID 与只读预检范围。
2. 正式 migration SQL。
3. PostgreSQL adapter 的真实 SQL 与权限模型。
4. Shadow writer 开关、执行令牌和回滚策略。
5. 单条 shadow run 写入范围。
6. 明确仍不修改 `public.leads` 正式评分字段。
