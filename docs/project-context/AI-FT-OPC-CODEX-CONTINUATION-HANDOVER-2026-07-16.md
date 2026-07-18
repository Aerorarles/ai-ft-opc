# AI FT-OPC Codex Continuation Handover

版本：v1.0
日期：2026-07-16
状态：当前续接入口
适用范围：供新的 ChatGPT/Codex 对话快速理解并安全续接 AI FT-OPC 项目。
禁止事项：本文不包含密码、连接串、`pgpass`、备份内容、凭据、完整联系方式、`raw_data` 或其他敏感业务数据。

## 1. 必读顺序与事实优先级

按以下顺序读取：

1. `docs/project-context/AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md`
2. `docs/project-status/AI-FT-OPC-CURRENT-STATUS.md`
3. `.project-control/PROJECT-CONTROL.yaml`
4. `.project-control/CURRENT-WORK-PACKAGE.yaml`
5. `.project-control/NEXT-ACTION.yaml`
6. `.project-control/runtime/M1-SHADOW-WRITE-REQUEST.yaml`
7. `docs/reviews/m1-production-migration-execution-report.md`

冲突时遵循：用户最新明确指令 → 最新 Master Architecture → 当前 Project Control / Execution Report → 历史文档。历史 handover、roadmap、review 与 progress 文件用于理解已发生事实，不能替代当前控制状态。

## 2. 项目定位与已完成能力

AI FT-OPC 是面向跨境 B2B 采购、核验、获客、评分和人工审核的 AI 运营平台；当前商业化优先方向是外贸获客与 Lead Agent。人工始终拥有商业判断、审批、客户关系和真实外部行为的最终控制权。

已完成或已具备的资产：

- Lead Agent v0.1 / Lead Enrichment v0.1.7 的已验证、封存事实；v0.1 的 `score`、`grade`、`priority` 仍是生产事实来源。
- Phase 1 / Phase 2 本地 memory MVP：Ingestion、Dedup、Decision、Review Queue、Shadow Scoring 与本地 API/workbench 验证。
- Lead Scoring v0.2-v0.7：配置驱动评分、配置校验、解释输出、execution context、trace/replay、persistence/replay control plane 与本地 API facade。
- Orchestration v0.8.x：本地 DAG、事件、replay/audit 与 scoring adapter 集成；非持久化 runtime。
- M1 的 Shadow、Review、Intake、Idempotency、Audit 数据契约、静态审查和本地测试资产。

## 3. 已确认的 M1 数据库事实

- M1 Production Data Foundation Release Candidate：`database/release-candidates/M1-PRODUCTION-DATA-FOUNDATION-v1.sql`。
- 已执行候选 SHA-256：`F22BFF9EF0AF52F630BC8AF9B09951B6CAF692522B7F3B0F75F11C02E3E34237`。
- 该候选已在受控授权下以单一事务成功提交；11 个 M1 `lead_*` 表、候选定义的约束与索引已通过系统目录复核。
- 既有 `public.leads` 的 `leads_score_v01` Trigger 保持不变；未修改 v0.1 函数或正式评分字段，未读取或修改业务记录。
- 迁移角色的临时 `CREATE`、`public.leads(id)` 列级读取/引用和 `LOGIN` 权限已由数据库管理员回收。不可自行恢复权限。
- 详细证据、回滚原则与权限回收记录见 `docs/reviews/m1-production-migration-execution-report.md`。

## 4. 当前控制状态

- 当前 Milestone：`M1 - Production Data Foundation`，仍为 `IN_PROGRESS`。
- 当前 Work Package：`M1-SHADOW-WRITER-HARDENING`，状态 `READY_FOR_READONLY_CANDIDATE_APPROVAL`。
- 旧 Shadow Write 请求 target 为 `UNSELECTED`，已失效且不可批准/复用；实时筛选出合格候选后必须使用严格 schema 重新生成。
- 未授权 PostgreSQL writer、Review Queue 写入、Intake 写入、`public.leads` 修改、n8n 激活、Docker/服务器变更或真实外联。
- 当前评分锚点：`config_version=v1`、`engine_version=0.6`；尚无已发布 outcome policy，任何未来 Shadow 的 grade/priority diff 必须为 `not_evaluated`。

## 5. Shadow Write 当前阻断

1. `aiopc_readonly` 可连接数据库，但没有 `public.leads` 的 `SELECT` 权限。受限候选筛选未返回任何业务记录，候选数为 0。
2. 合规候选必须排除 competitor、历史技术测试样本、rejected、suppressed 与最小评分输入不足的 Lead。不得用历史测试样本或归档快照替代实时筛选。
3. 本地 TypeScript no-review writer、严格请求校验、六表/10 行限制和 fake-client 测试已完成；但 dedicated writer role、权限和真实执行仍未批准。现有 Phase 2 写入分支仍不得用于本次范围，因为它会创建 Review Queue。
4. 迁移角色已按最小权限原则回收；不得自行创建、恢复或授予 writer 角色及数据库权限。
5. 当前请求的 ID、trace、幂等键、scope hash 和过期时间仅适用于准备状态。任何过期、未绑定精确 `lead_id`/`tenant_id` 或版本锚点变化的请求都必须废弃并重新生成。

## 6. 新 Agent 的下一步动作

1. 先读取本文件第 1 节所列权威文件，并确认 Project Control 仍为 `READY_FOR_READONLY_CANDIDATE_APPROVAL`。
2. 不因“继续”推断真实 Lead 读取或数据库写入授权。
3. 获得独立批准后，使用最小字段只读路径筛选最多 3 条候选；输出不得包含完整联系方式或 `raw_data`。
4. 只在实时筛选完成后生成新的、精确绑定一个 `lead_id` 与 `tenant_id=local` 的请求，并绑定候选/输入/config/writer/scope hash 和有效期。
5. 在任何写入前，另行审查临时最小权限 writer role、批准请求、事务范围、写后验证和停止/回滚负责人。
6. 只有用户对精确 Lead、tenant、六表范围、10 行上限、版本/hash 和回滚边界作出明确批准后，才可进入执行验证；不得写 `public.leads` 或创建 Review Queue。

## 7. 不可突破的安全边界

- 不读取、展示、复制、提交或上传 `.env`、`pgpass`、密码、token、API Key、credentials、Cookie、私钥或数据库备份内容。
- 不执行 migration、破坏性 SQL、`public.leads` 写入、v0.1 Trigger/函数改动、批量写入、自动权限授予或数据库角色变更，除非获得当前任务中的独立明确批准。
- 不启用 n8n、Docker、服务器配置、真实外部 API、邮件、WhatsApp、LinkedIn、表单、报价或任何客户触达。
- 不自动 Git push、force push、merge 或修改远端历史；Git 仅在用户明确批准后精确暂存指定文件。
- 出现权限不足、请求过期、版本/hash 不匹配、候选不合格、角色缺失、数据库写入异常或范围变化时，立即停止并报告。

## 8. 文档一致性提示

部分较早的 `Current Status`、`AGENT-START-HERE` 或历史 progress 段落仍可能显示 M1 migration “待执行”或使用旧工作包名称。这些是历史快照；实际 M1 migration 成功与权限回收事实以 Project Control 和 `m1-production-migration-execution-report.md` 为准。

在获得用户对文档整理范围的批准后，应统一修订这些旧快照，避免新 Agent 误判当前阶段。该整理不应同时包含数据库、n8n、权限或 Git 写操作。

## 9. 续接验收标准

新对话在不读取敏感信息的前提下，应能回答：

1. 当前项目阶段、当前 Work Package 与下一审批门；
2. M1 migration 已执行的事实及其不变量；
3. 当前 Shadow Write 为什么不能执行；
4. 未来单条 Shadow Write 必须获得哪些明确批准；
5. 哪些动作仍被禁止。
