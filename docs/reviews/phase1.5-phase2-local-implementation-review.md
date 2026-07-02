# Phase 1.5 + Phase 2 Local Implementation Review

版本：v0.1
日期：2026-07-02
状态：本地实现与验证完成
适用范围：本地内存级产品化链路、API handler、静态 Workbench、migration draft
禁止事项：未批准不得执行 migration；不得连接真实 PostgreSQL；不得修改 n8n、Docker、服务器；不得触达真实客户；不得写入正式 Lead 评分字段。

## 1. 修改/新增文件清单

### Phase 2 domain 与 persistence

- `packages/phase2-domain/src/types.ts`
- `packages/phase2-domain/src/decision-service.ts`
- `packages/phase2-domain/src/review-service.ts`
- `packages/phase2-domain/src/shadow-service.ts`
- `packages/phase2-domain/src/index.ts`
- `packages/persistence/src/types.ts`
- `packages/persistence/src/repositories.ts`
- `packages/persistence/src/guards.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/memory/memory-lead-repository.ts`
- `packages/persistence/src/memory/memory-shadow-repository.ts`
- `packages/persistence/src/memory/memory-review-repository.ts`
- `packages/persistence/src/postgres/postgres-lead-repository.ts`
- `packages/persistence/src/postgres/postgres-shadow-repository.ts`
- `packages/persistence/src/postgres/postgres-review-repository.ts`

### API / demo / tests

- `apps/api-server/phase2-seed.ts`
- `apps/api-server/phase2-api.ts`
- `apps/api-server/phase2-http-server.ts`
- `apps/api-server/phase2-demo.ts`
- `apps/api-server/phase2-tests.ts`

### Static workbench

- `apps/workbench/index.html`
- `apps/workbench/app.js`
- `apps/workbench/styles.css`
- `apps/workbench/README.md`

### Migration draft

- `database/migrations/DRAFT-005-lead-scoring-v0.2-shadow-mode.sql`
- `database/migrations/DRAFT-006-phase2-review-queue.sql`

### Scripts and docs

- `package.json`
- `docs/PHASE-1.5-PHASE-2-IMPLEMENTATION.md`
- `docs/reviews/phase1.5-phase2-local-implementation-review.md`

## 2. 已实现能力

- 本地 memory repository 支持 Lead snapshot、shadow run/result/diff、review queue。
- PostgreSQL adapter 只保留注入式接口，不自动连接数据库。
- Shadow Writer guard 默认拒绝 PostgreSQL 写入。
- 单条 Lead shadow preview 默认不持久化。
- 显式内存写入可生成 shadow run、result、diff、review item。
- Decision Layer 输出 HOT / WARM / COLD、confidence、reasons、risk_flags、next_step。
- Review Queue 支持 pending / approved / rejected / skipped。
- API handler 返回 JSON，统一标记 `mode: "local_mvp"`。
- HTTP server 默认不启动。
- Static Workbench 可展示 Lead Inbox、Lead Detail、Review Queue。

## 3. Demo 输出摘要

命令：

```bash
npm run phase2:demo
```

结果摘要：

- seeded leads count: 6
- preview result: local_mvp, shadow_score 21, persisted false
- memory shadow run 已生成
- v0.1 score / grade / priority 前后一致
- shadow score: 21
- score delta: 18
- review queue status counts: approved 1
- no official lead fields changed: true
- no secrets persisted: true

## 4. 测试结果

### Typecheck

```bash
npm run typecheck
```

结果：PASS

### Phase 1

```bash
npm run phase1:test
```

结果：PASS

- ingestion working
- dedup working
- decision working
- review queue working
- api working

### Phase 2

```bash
npm run phase2:test
```

结果：PASS，13 项通过。

覆盖：

- Lead snapshot 脱敏。
- Memory repository 存储。
- Preview 不持久化。
- Shadow run/result/diff/review 生成。
- v0.1 score/grade/priority 不变。
- invalid config 阻断。
- replay inconsistency 进入人工复核。
- approve/reject/skip 只影响 review item。
- API health/list/detail/history/queue。
- API 不返回敏感字段。
- PostgreSQL adapter 默认拒绝写入。
- HTTP server 默认不启动。
- End-to-end memory flow。

### 既有 Scoring / Trace / Orchestration

```bash
npm run demo:scoring
npm run test:scoring
npm run demo:trace
npm run test:orchestration
npm run test:orchestration-scoring
```

结果：全部 PASS。

关键确认：

- scoring example total_score 仍为 21。
- scoring test-cases 全部通过。
- trace replay_consistency 为 true。
- orchestration replay tests 通过。
- orchestration-scoring integration tests 通过。

## 5. 高风险动作确认

- PostgreSQL adapter 是否连接真实数据库：否。
- Migration 是否执行：否。
- n8n 是否修改：否。
- Docker / 服务器 / Portainer 是否修改：否。
- Git 写操作是否执行：否。
- secrets 是否读取：否。
- 外部 API 是否调用：否。
- `public.leads` 是否修改：否。
- `score_lead_v01()` 是否修改：否。
- `leads_score_v01` 是否修改：否。
- leads official score / grade / priority 是否修改：否。
- HTTP server 是否启动监听：否。

## 6. 已知限制

- 当前数据只在内存中保存，进程退出后丢失。
- Workbench 是静态 MVP，不含认证、租户隔离、权限、审计。
- PostgreSQL adapter 尚未绑定真实 SQL 审查结果。
- Migration 文件是草案，不是可执行批准版本。
- Shadow scoring 仅用于对比和人工审查，不可写入正式 `leads.score`。

## 7. 进入真实单条 Lead Shadow Run 前必须批准

1. 指定真实 Lead UUID 与只读预检范围。
2. 批准正式 migration SQL 草案。
3. 批准 PostgreSQL adapter 的真实 SQL 与权限模型。
4. 批准 shadow writer 开关与执行令牌。
5. 批准单条 shadow run 的写入表范围。
6. 明确失败回滚与审计保留方式。
7. 确认仍不修改 `public.leads` 正式评分字段。

## 8. 验收结论

Phase 1.5 + Phase 2 本地最小产品链路已完成：

Lead snapshot → v0.2 shadow preview/run → v0.1/v0.2 diff → decision → review queue → local API → static workbench。

当前实现满足本地 MVP 验收，但尚不允许进入生产数据库或 n8n 集成。
