# Node / TypeScript Runtime Standardization Review

日期：2026-07-02
范围：Windows 本地工作树 `C:\Users\Jklee\Documents\ai-ft-opc`
状态：本地 npm 依赖安装完成，runtime scripts 已标准化，demo/test 运行通过，typecheck 仍受现有 CommonJS-style `.ts` 结构限制。

## 1. 修改文件清单

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `docs/reviews/node-typescript-runtime-standardization-review.md`

## 2. 新增依赖

新增项目级开发依赖：

- `tsx`

实际安装结果：

```text
tsx@4.22.4
```

未安装全局 npm 包；未添加 pnpm、yarn、turborepo 或 Docker 相关依赖。

## 3. package-lock.json

`package-lock.json` 已生成。

安装过程说明：

- 第一次 `npm install` 失败，原因是 npm 子进程执行 `node install.js` 时当前 PowerShell PATH 未包含 `C:\Program Files\nodejs`。
- 未修改系统 PATH。
- 使用进程级临时 PATH 后重新执行 `npm install` 成功。

成功命令：

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' install
```

结果：

```text
added 325 packages, and audited 326 packages
found 0 vulnerabilities
```

## 4. Node / npm 使用方式

当前 shell 通过绝对路径使用：

- Node：`C:\Program Files\nodejs\node.exe`
- npm：`C:\Program Files\nodejs\npm.cmd`
- npx：`C:\Program Files\nodejs\npx.cmd`

版本：

- Node：`v24.18.0`
- npm：`11.16.0`
- npx：`11.16.0`

本次未修改 Windows 系统环境变量。所有验证命令均通过当前 PowerShell 进程临时 PATH 执行。

## 5. package.json scripts

当前 scripts：

```json
{
  "dev": "tsx apps/api-server/demo.ts",
  "demo:replay": "tsx apps/api-server/replay-demo.ts",
  "test:orchestration": "tsx apps/api-server/replay-tests.ts",
  "demo:scoring": "tsx scoring-engine/src/example.ts",
  "test:scoring": "tsx scoring-engine/src/test-cases.ts",
  "demo:trace": "tsx scoring-engine/src/trace-example.ts",
  "typecheck": "tsc -p tsconfig.json --noEmit"
}
```

## 6. tsconfig.json 变更

保留 CommonJS：

- `module = CommonJS`
- `moduleResolution = node`
- `strict = false`
- `skipLibCheck = true`

最小新增：

- `moduleDetection = force`，避免 CommonJS-style `.ts` 文件被全局脚本合并。
- `types = ["node"]`，声明 Node 类型环境。
- `include` 增加 `scoring-engine/**/*.ts`。

未添加 path alias，未改成 ESM。

## 7. 验证命令与结果

所有 npm run 命令均使用以下临时 PATH 前缀执行：

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
```

### 7.1 npm run dev

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

结果：通过。

关键输出：

```text
✔ orchestration started
✔ task executed (codex)
✔ task executed (db)
✔ orchestration complete
✔ event stream captured
✔ all tasks emitted events
✔ execution fully traceable
✔ replay-compatible structure confirmed
```

### 7.2 npm run demo:replay

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run demo:replay
```

结果：通过。

关键输出：

```text
replay event_count: 9
replay task_states: {"task-codex-build-scoring-engine":"COMPLETED","task-db-design-event-store":"COMPLETED"}
replay is_consistent: true
replay consistency_errors: []
```

### 7.3 npm run test:orchestration

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run test:orchestration
```

结果：通过。

通过项：

- normal completed execution can be replayed
- TASK_STARTED without TASK_CREATED is detected
- task double terminal state is detected
- execution without EXECUTION_COMPLETED is incomplete
- sequence_index disorder is detected
- replay does not re-run agent execution
- normal demo replay is_consistent=true

### 7.4 npm run demo:scoring

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run demo:scoring
```

结果：通过。

关键输出：

```text
total_score: 21
breakdown: relevance=30, trust=15, capability=10, risk=0
```

### 7.5 npm run test:scoring

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run test:scoring
```

结果：通过。

覆盖范围：

- v1 config validation；
- total_score=21；
- risk 不双重扣分；
- rule precedence；
- event trace；
- replay consistency；
- persistence interface；
- replay router；
- API facade；
- tenant isolation；
- shadow / preview / idempotency。

### 7.6 npm run demo:trace

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run demo:trace
```

结果：通过。

关键输出：

```text
event_count: 11
replay_consistency: true
recomputed_total_score: 21
consistency_errors: []
```

### 7.7 npm run typecheck

命令：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
```

结果：失败。

失败原因归类：

1. 现有 `.ts` 文件大量使用 CommonJS JavaScript 风格，类属性未声明，例如：
   - `EventEmitter.events`
   - `EventEmitter.sequenceIndex`
   - `Scheduler.eventEmitter`
   - `Scheduler.executionId`
   - `OrchestrationEngine.graphBuilder`
   - `ShadowEventStore.inner`
   - `FakeEventStore.events / snapshots / idempotency / replayResults`

2. 测试 helper 的对象结构被 TypeScript 推断过窄，例如：
   - `task_id`
   - `agent_type`
   - `result`
   - `error`

3. 部分函数在 CommonJS/JSDoc 风格下被 TypeScript 推断为更严格的参数数量，例如：
   - `transition(...)`
   - `scoreLead(...)`
   - `replayExecution(...)`

4. 已通过 `moduleDetection = force` 消除了大部分全局 redeclare 类错误，但剩余错误属于现有 CommonJS-style `.ts` 静态类型声明不足。

本次未继续批量添加 `// @ts-nocheck` 或大规模重写类型声明，因为这会超出“最小运行方式标准化”的范围，并可能变成业务代码风格重构。

## 8. 当前推荐运行命令

推荐使用 npm scripts：

```powershell
npm run dev
npm run demo:replay
npm run test:orchestration
npm run demo:scoring
npm run test:scoring
npm run demo:trace
```

如果当前 PowerShell PATH 尚未包含 Node，可在当前进程临时执行：

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
```

不建议继续把 `node some-file.ts` 作为推荐运行方式。当前推荐 runner 是项目级 `tsx`。

## 9. 已知限制

- `npm run typecheck` 当前失败。
- 当前代码仍是 CommonJS-compatible `.ts` 风格，不是完整静态类型化 TypeScript。
- `typecheck` 要通过，需要后续单独做类型声明补强或 TypeScript 模块化整理。
- 本次未启动 HTTP server。
- Orchestration replay 仍是内存级，不是持久化 event store。
- Lead Scoring persistence 仍是 interface/stub，不连接真实 PostgreSQL。

## 10. 本次未涉及

- 数据库：未涉及；
- SQL / migration / Trigger：未涉及；
- n8n：未涉及；
- Docker / Portainer / 服务器配置：未涉及；
- Git add / commit / push / pull / merge：未涉及；
- secrets / configs / credentials / API Key / Cookie / 数据卷：未读取；
- 外部业务 API：未访问；
- Lead Scoring 算法、规则、评分结果：未改变。

## 11. 下一步需用户明确批准

以下动作需要用户明确批准：

- 对现有 CommonJS-style `.ts` 文件做类型声明补强；
- 批量添加或移除 `// @ts-check` / `// @ts-nocheck`；
- 将 runtime 代码正式改写为 TypeScript import/export；
- 调整 `typecheck` 范围或拆分多个 tsconfig；
- 执行 Git add / commit / push；
- 接入数据库、n8n、Docker、服务器或外部 API。
