# Current Runtime Baseline Review

日期：2026-07-02
范围：Lead Scoring v0.2-v0.7 与 Orchestration v0.8.1-v0.8.3 的本地代码、文档、运行方式基线审查
执行方式：只读检查与本地 demo/test 运行验证；除创建本审查文档外，未修改业务代码。
安全边界：未读取 `configs/.env`、Credentials、API Key、Cookie 或数据卷；未执行 Git 写操作、数据库、Docker、n8n、服务器配置或外部 API 操作。

## 1. 实际目录树与关键文件路径

根目录关键文件：

- `package.json`：存在
- `package-lock.json`：不存在
- `tsconfig.json`：存在

Orchestration runtime：

- `apps/api-server/demo.ts`
- `apps/api-server/replay-demo.ts`
- `apps/api-server/replay-tests.ts`
- `packages/orchestration/src/audit.ts`
- `packages/orchestration/src/engine.ts`
- `packages/orchestration/src/event-emitter.ts`
- `packages/orchestration/src/events.ts`
- `packages/orchestration/src/index.ts`
- `packages/orchestration/src/replay.ts`
- `packages/orchestration/src/scheduler.ts`
- `packages/orchestration/src/task-graph.ts`
- `packages/orchestration/src/types.ts`

Lead Scoring runtime：

- `scoring-engine/src/api/scoring-service.ts`
- `scoring-engine/src/config.ts`
- `scoring-engine/src/engine.ts`
- `scoring-engine/src/example.ts`
- `scoring-engine/src/execution-context.ts`
- `scoring-engine/src/execution-events.ts`
- `scoring-engine/src/execution-trace-store.ts`
- `scoring-engine/src/features.ts`
- `scoring-engine/src/persistence/event-store.interface.ts`
- `scoring-engine/src/persistence/postgres-adapter.ts`
- `scoring-engine/src/preview.ts`
- `scoring-engine/src/preview-example.ts`
- `scoring-engine/src/replay.ts`
- `scoring-engine/src/replay-consistency.ts`
- `scoring-engine/src/replay-contract.ts`
- `scoring-engine/src/replay-router.ts`
- `scoring-engine/src/rules.ts`
- `scoring-engine/src/test-cases.ts`
- `scoring-engine/src/trace-example.ts`
- `scoring-engine/src/types.ts`

Scoring config：

- `scoring-config/v1.json`
- `scoring-config/v1-invalid.json`

相关文档：

- `docs/LEAD-SCORING-V0.2-ARCHITECTURE-DESIGN.md`
- `docs/LEAD-SCORING-V0.2-BETA-LOCAL-DESIGN.md`
- `docs/LEAD-SCORING-V0.2-DATA-MODEL-DRAFT.md`
- `docs/LEAD-SCORING-V0.2-PERMISSION-AUDIT-AND-ROLLBACK.md`
- `docs/LEAD-SCORING-V0.2-SCORING-POLICY-DRAFT.md`
- `docs/LEAD-SCORING-V0.2-SHADOW-ROLLOUT-PLAN.md`
- `docs/LEAD-SCORING-V0.3-EXECUTION-MODEL.md`
- `docs/LEAD-SCORING-V0.4-EXECUTION-TRACE.md`
- `docs/LEAD-SCORING-V0.5-EVENT-STORE-SCHEMA.md`
- `docs/LEAD-SCORING-V0.5-PERSISTENCE-ARCHITECTURE.md`
- `docs/LEAD-SCORING-V0.6-REPLAY-CONTROL-PLANE.md`
- `docs/LEAD-SCORING-V0.7-ADMIN-RULE-LAYER.md`
- `docs/LEAD-SCORING-V0.7-API-CONTRACT.md`
- `docs/LEAD-SCORING-V0.7-MULTI-TENANT-MODEL.md`
- `docs/LEAD-SCORING-V0.7-SYSTEM-ARCHITECTURE.md`
- `docs/LEAD-SCORING-V0.7-TRANSITION-FROM-V0.6.md`
- `docs/ORCHESTRATION-V0.8.3-REPLAY-AUDIT.md`
- `docs/reviews/lead-scoring-v0.2-beta-design-review-pack.md`
- `docs/reviews/lead-scoring-v0.4-trace-review-pack.md`
- `docs/reviews/orchestration-v0.8.3-replay-review-pack.md`

## 2. 实际代码与设计文档边界

实际代码：

- Lead Scoring v0.2-v0.7：`scoring-engine/src/` 下存在可运行本地代码，包含 config-driven engine、validation、preview、execution context、rule precedence、event trace、memory replay、persistence interface stub、replay router、API facade。
- Scoring config：`scoring-config/v1.json` 与 `v1-invalid.json` 存在。
- Orchestration v0.8.1-v0.8.3：`packages/orchestration/src/` 下存在可运行本地代码，包含 DAG builder、scheduler、state machine、event emitter、memory replay、audit。
- Demo/test：`apps/api-server/` 与 `scoring-engine/src/` 下存在可运行 demo/test 文件。

仅设计文档或 stub：

- Lead Scoring v0.5 PostgreSQL event store schema：只有文档草案，未实现真实数据库。
- `scoring-engine/src/persistence/postgres-adapter.ts`：stub，不连接数据库，不执行 SQL。
- Lead Scoring v0.7 SaaS / API / admin / multi-tenant 文档：大部分是产品化与架构设计；本地仅有 `scoreLeadAPI()` facade，不是 HTTP server。
- Orchestration v0.8.3 replay：是内存级 replay/audit，不是生产级持久化 event sourcing。

## 3. Node / npm / npx / ts-node 可用性

当前 PATH 检查结果：

- `node`：PATH 未发现。
- `npm`：PATH 未发现。
- `npx`：PATH 未发现。
- `ts-node`：PATH 未发现。

Codex 本地运行时提供的 Node 可用：

- 路径：`C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- 版本：`v24.14.0`

结论：

- 当前 shell 不能直接运行 `npm run dev` 或 `npx ts-node ...`。
- 可以使用 Codex bundled Node 直接执行当前 CommonJS-compatible `.ts` 文件。
- `package.json` 声明了 `ts-node` / `typescript` 等依赖，但由于 `package-lock.json` 不存在且当前 PATH 无 npm，未验证 `npm install`。

## 4. package.json scripts 可用性

`package.json` 内容合法，当前 scripts：

```json
{
  "dev": "ts-node -P tsconfig.json apps/api-server/demo.ts"
}
```

风险：

- `dev` script 依赖 `ts-node`。
- 当前 PATH 未发现 `npm` / `ts-node`，因此在当前工作树环境不能直接验证 `npm run dev`。
- 若目标环境先执行 `npm install` 并使 `node_modules/.bin` 可用，该 script 设计上应可运行。

## 5. 实际运行命令与结果

由于当前 PATH 缺少 `npm` / `npx` / `ts-node`，以下命令使用 Codex bundled Node 执行。

### 5.1 Lead Scoring example

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scoring-engine/src/example.ts
```

结果：

- 成功。
- `total_score: 21`
- breakdown：
  - relevance：30
  - trust：15
  - capability：10
  - risk：0

### 5.2 Lead Scoring test cases

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scoring-engine/src/test-cases.ts
```

结果：

- 成功。
- v0.2-v0.7 本地测试全部 PASS。
- 覆盖 config validation、risk scoring、rule precedence、event trace、replay、persistence interface、replay router、API facade、tenant isolation、shadow/preview/idempotency。

### 5.3 Lead Scoring trace example

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scoring-engine/src/trace-example.ts
```

结果：

- 成功。
- `event_count: 11`
- `replay_consistency: true`
- `recomputed_total_score: 21`
- `consistency_errors: []`

### 5.4 Orchestration demo

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe apps/api-server/demo.ts
```

结果：

- 成功。
- 输出：
  - orchestration started
  - TASK_CREATED / TASK_READY / TASK_STARTED / TASK_COMPLETED / EXECUTION_COMPLETED events
  - task executed (codex)
  - task executed (db)
  - event stream captured
  - execution fully traceable

### 5.5 Orchestration replay demo

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe apps/api-server/replay-demo.ts
```

结果：

- 成功。
- `event_count: 9`
- task states：
  - `task-codex-build-scoring-engine = COMPLETED`
  - `task-db-design-event-store = COMPLETED`
- `is_consistent: true`
- `consistency_errors: []`

### 5.6 Orchestration replay tests

命令：

```text
C:\Users\Jklee\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe apps/api-server/replay-tests.ts
```

结果：

- 成功。
- 7 项 PASS，0 失败。
- 覆盖：
  - completed execution replay；
  - TASK_STARTED 缺少 TASK_CREATED；
  - task 双终态；
  - 无 EXECUTION_COMPLETED 标记 incomplete；
  - sequence_index 错乱；
  - replay 不重新执行 agent；
  - 正常 demo replay `is_consistent=true`。

## 6. Windows 与 Linux 工作树一致性

当前实际工作树路径：

```text
C:\Users\Jklee\Documents\ai-ft-opc
```

审查环境表现为 Windows 本地工作树。当前会话没有提供 Linux 服务器工作树路径，也没有授权登录服务器或读取远端文件。

结论：

- 无法证明 Linux 服务器工作树与当前 Windows 工作树一致。
- 存在环境描述不一致风险：用户历史请求曾提到服务器环境，但当前工具实际访问的是 Windows 路径。
- 若需要确认 Linux 服务器一致性，必须由用户明确授权服务器只读检查，并给出服务器路径与允许命令范围。

## 7. .ts 文件被 Node 直接当 JavaScript 运行的情况

存在。

当前以下 `.ts` 文件可以被 Node 直接运行，原因是它们实际采用 CommonJS-compatible JavaScript 写法：

- `scoring-engine/src/example.ts`
- `scoring-engine/src/test-cases.ts`
- `scoring-engine/src/trace-example.ts`
- `apps/api-server/demo.ts`
- `apps/api-server/replay-demo.ts`
- `apps/api-server/replay-tests.ts`
- `packages/orchestration/src/*.ts` 大部分运行时代码

风险：

- 这不是标准 TypeScript 编译运行方式。
- 当前能运行依赖于这些 `.ts` 文件没有使用需要编译的 TS 语法。
- `packages/orchestration/src/events.ts` 包含 `export type`，属于 TypeScript-only 声明文件风格，不能作为普通 CommonJS runtime 文件直接由 Node require。
- 当前 demo/test 未直接 require `events.ts`，所以不影响运行。
- `package.json` 的正式 script 仍是 `ts-node -P tsconfig.json apps/api-server/demo.ts`，但当前环境缺少 `ts-node`。

## 8. 发现的问题

1. `package-lock.json` 缺失。
   - 无法证明依赖版本已锁定。
   - 无法在当前环境验证 `npm install` 的实际结果。

2. 当前 PATH 缺少 `node` / `npm` / `npx` / `ts-node`。
   - Codex bundled Node 可用，但这不是项目本身的 npm runtime。
   - `npm run dev` 当前不可直接执行。

3. `.ts` 文件被当作 CommonJS JavaScript 直接运行。
   - 短期可运行；
   - 长期会混淆 TypeScript 编译边界。

4. v0.5-v0.7 的部分能力是 interface / stub / facade / design。
   - 没有真实数据库 event store；
   - 没有 HTTP API server；
   - 没有生产 SaaS runtime；
   - 没有 n8n integration。

5. Windows / Linux 工作树一致性无法确认。

## 9. 风险等级

风险等级：中。

原因：

- 核心本地 demo/test 可运行；
- 但 npm 工具链在当前 PATH 不可用，`package-lock.json` 缺失；
- 运行方式依赖 Node 直接执行 `.ts` 的兼容写法；
- 文档中的部分阶段名称可能让人误以为已有生产级持久化/API/server，但实际仍是本地 runtime 和设计层。

## 10. 当前唯一建议的下一步

唯一建议下一步：

在用户明确批准后，做一次“Node/npm 工具链与 TypeScript 运行方式标准化”修复：

- 确认目标环境使用 Windows 还是 Linux；
- 执行或准备 `npm install`；
- 生成并审查 `package-lock.json`；
- 验证 `npm run dev`；
- 决定 orchestration runtime 是否继续 CommonJS-compatible `.ts`，还是改为标准 TypeScript + ts-node/tsc 路径。

## 11. 必须先获得用户明确批准的动作

以下动作必须先获得用户明确批准：

- 执行 `npm install` 或生成 `package-lock.json`；
- 修改 package scripts；
- 标准化 / 重写 TypeScript 模块风格；
- 连接或检查 Linux 服务器工作树；
- 执行任何 Git add / commit / push / pull；
- 连接数据库或设计真实 migration；
- 接入 n8n；
- 修改 Docker / server 配置；
- 接入外部 API；
- 读取 secrets、env、credentials、Cookie 或数据卷。

## 12. 明确未涉及

- 未读取 `configs/.env`；
- 未读取 Credentials、API Key、Cookie 或数据卷；
- 未连接数据库；
- 未执行 SQL 或 migration；
- 未执行 Docker；
- 未执行 n8n；
- 未修改服务器配置；
- 未访问外部 API；
- 未执行 Git 写操作。
