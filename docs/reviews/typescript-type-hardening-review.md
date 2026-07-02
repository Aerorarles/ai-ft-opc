# TypeScript 类型补强验收记录

版本：v0.1
日期：2026-07-02
状态：已完成本地验收
适用范围：AI FT-OPC 本地 TypeScript 类型检查与运行验证
禁止事项：本次未涉及数据库、SQL、migration、n8n、Docker、服务器、Git 写操作、secrets 或外部 API。

## 1. 修改文件清单

- `apps/api-server/replay-tests.ts`
- `packages/orchestration/src/event-emitter.ts`
- `packages/orchestration/src/scheduler.ts`
- `packages/orchestration/src/engine.ts`
- `scoring-engine/src/api/scoring-service.ts`
- `scoring-engine/src/persistence/postgres-adapter.ts`
- `scoring-engine/src/engine.ts`
- `scoring-engine/src/test-cases.ts`
- `docs/reviews/typescript-type-hardening-review.md`

## 2. 类型错误根因

- CommonJS 风格 `.ts` 文件中，运行时存在的 class 属性没有显式声明，例如事件列表、序号、调度器依赖和 fake store 内部 Map。
- 测试 helper 中的事件对象被 TypeScript 推断为窄对象，后续追加 `task_id`、`result`、`error` 时被判定为不存在。
- 部分函数参数在运行时可省略，但类型层没有默认值或可选声明。
- PostgreSQL adapter stub 与 shadow event store 仅作为接口占位，但缺少属性类型声明。

## 3. 修复方式

- 为 class 补充属性声明和 JSDoc 类型，保持 CommonJS-compatible 运行方式。
- 为 orchestration replay 测试事件 helper 增加明确的 TypeScript 测试事件类型。
- 为可省略的 helper 参数增加默认值，不改变调用结果。
- 为测试 fake event store 的内部 Map 增加明确类型，避免 TypeScript 将运行时属性视为不存在。

未使用 `@ts-nocheck`；未缩小 `tsconfig.json` 的 typecheck 范围；未修改 typecheck script；未改变 Lead Scoring 算法、规则、权重、评分结果；未改变 orchestration DAG、事件类型、状态机或 replay 语义。

## 4. 实际验证命令与结果

- `npm run typecheck`：通过，退出码 0。
- `npm run dev`：通过，orchestration demo 完成，事件流可见。
- `npm run demo:replay`：通过，`replay is_consistent: true`。
- `npm run test:orchestration`：通过，7 项 replay 测试全部 PASS。
- `npm run demo:scoring`：通过，`total_score: 21`。
- `npm run test:scoring`：通过，52 项 scoring 测试全部 PASS。
- `npm run demo:trace`：通过，`replay_consistency: true`，`recomputed_total_score: 21`。

## 5. 静态安全审查

- 数据库：未涉及。
- SQL / migration / Trigger：未涉及。
- n8n：未涉及。
- Docker / 服务器 / Portainer：未涉及。
- Git 写操作：未执行。
- secrets / `.env` / Credentials / API Key / Cookie / 数据卷：未读取。
- 外部 API：未调用。

## 6. 当前已知限制

- 当前代码仍保留 CommonJS 风格与 JSDoc/TypeScript 混合写法；本次只做类型补强，没有进行 ESM 迁移或结构重构。
- orchestration event store 与 scoring event store 仍是本地内存或 stub 级能力，不代表生产级持久化。

## 7. 下一步必须由用户批准的事项

- 任何 Git 暂存、提交或推送。
- 任何数据库 schema、SQL 草案落地、migration 或 Trigger 修改。
- 任何 n8n 导入、发布、激活或服务器部署。
- 任何进一步重构、模块化迁移或生产化持久化接入。
