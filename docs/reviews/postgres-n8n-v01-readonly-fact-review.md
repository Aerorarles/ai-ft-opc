# PostgreSQL / n8n / Lead Agent v0.1 只读事实审查

版本：v0.1
日期：2026-07-02
状态：只读审查完成
适用范围：本地仓库中的 PostgreSQL migration/init SQL、n8n JSON 导出、Lead Agent v0.1 文档与本地 Lead Scoring 代码
禁止事项：本次未连接数据库，未执行 SQL，未修改 n8n，未读取 `configs/.env`、Credentials、API Key、Cookie 或数据卷，未执行 Git 写操作。

## 1. 审查方式

本次仅检查本地项目文件：

- `database/init.sql`
- `database/migrations/001-lead-scoring-v0.1.sql`
- `database/migrations/002-lead-auto-scoring-v0.1.sql`
- `database/migrations/003-candidate-leads-v0.1.sql`
- `database/migrations/004-lead-enrichment-v0.1.sql`
- `workflows/n8n/*.json`
- `docs/LEAD-SCORING-V0.1.md`
- `docs/LEAD-ENRICHMENT-V0.1.md`
- `docs/CANDIDATE-PROMOTION-V0.1.md`
- `scoring-engine/src/**`
- `scoring-config/v1.json`

未读取 `configs/`，未读取真实 n8n credentials，未连接 PostgreSQL，因此以下 PostgreSQL 结论是“仓库 SQL 草案与导出文件事实”，不是实时数据库 introspection 结果。

## 2. PostgreSQL 本地仓库事实

### 2.1 `public.leads` 基础字段

根据 `database/init.sql`，`leads` 基础表字段包括：

- `id`
- `company_name`
- `website`
- `country`
- `city`
- `industry`
- `contact_name`
- `contact_title`
- `email`
- `phone`
- `linkedin_url`
- `source`
- `score`
- `grade`
- `status`
- `notes`
- `raw_data`
- `created_at`
- `updated_at`

基础索引包括：

- `idx_leads_website_unique`
- `idx_leads_country`
- `idx_leads_status`
- `idx_leads_score`

### 2.2 v0.1 scoring 扩展字段

根据 `database/migrations/001-lead-scoring-v0.1.sql`，`leads` 追加：

- `product_id`
- `source_url`
- `company_size`
- `import_signals`
- `lead_score_breakdown`
- `priority`
- `last_scored_at`
- `first_contacted_at`
- `next_follow_up_at`

相关索引包括：

- `idx_leads_product_id`
- `idx_leads_grade`
- `idx_leads_priority`
- `idx_leads_email`

### 2.3 v0.1 scoring function 与 trigger

根据 `database/migrations/002-lead-auto-scoring-v0.1.sql`，存在函数草案：

- `score_lead_v01()`

存在 trigger 草案：

- `leads_score_v01`

触发时机：

- `BEFORE INSERT OR UPDATE OF product_id, country, industry, website, company_size, email, contact_title, import_signals, notes ON leads`

触发结果：

- 写入 `NEW.score`
- 写入 `NEW.lead_score_breakdown`
- 写入 `NEW.last_scored_at`
- 根据总分写入 `NEW.grade`
- 根据总分写入 `NEW.priority`

v0.1 评分维度来自 SQL 函数：

- industry fit
- company quality
- contactability
- purchase signal
- market fit

grade / priority 映射：

- `score >= 70`：`grade='A'`，`priority='high'`
- `score >= 40`：`grade='B'`，`priority='normal'`
- 其他：`grade='C'`，`priority='low'`

### 2.4 enrichment 字段

根据 `database/migrations/004-lead-enrichment-v0.1.sql`，`public.leads` 追加：

- `company_description`
- `contact_page_url`
- `enrichment_status`
- `enriched_at`
- `enrichment_error`

并新增：

- `leads_enrichment_status_check`
- `idx_leads_enrichment_status`

`enrichment_status` 允许值：

- `pending`
- `running`
- `succeeded`
- `partial`
- `failed`
- `skipped`

### 2.5 candidate 与 task 相关表

根据 `database/init.sql` 和 `database/migrations/003-candidate-leads-v0.1.sql`，仓库中存在以下表草案：

- `products`
- `agent_tasks`
- `activity_logs`
- `candidate_leads`

`candidate_leads` 包括候选状态、候选评分、review notes、raw_data、promoted lead 引用等字段。

### 2.6 当前未确认的实时数据库事实

未连接 PostgreSQL，因此无法确认：

- 实时数据库是否已执行全部 migration；
- 实时 `public.leads` 是否与仓库 SQL 完全一致；
- 实时 trigger/function 是否存在、是否被手工修改；
- 实时是否存在额外 audit/log/run/config/rule/scoring snapshot 表；
- 实时是否存在 `tenant_id`、`organization_id`、`user_id` 相关字段；
- 实时索引、约束、权限、函数定义是否与仓库一致。

如需确认实时数据库，必须由用户提供只读连接方式，并在 `BEGIN READ ONLY; ... ROLLBACK;` 内仅查询 metadata。

## 3. n8n 本地 JSON 事实

### 3.1 本地 workflow 清单

本地 `workflows/n8n` 中可解析的 JSON 包括：

- `Candidate Promotion V0.1 - Single Test`
- `Candidate Triage v0.2.1 - Precedence Fix Test`
- `Lead Enrichment v0.1 - Single Lead Test`
- `Lead Enrichment v0.1.1 - Single Lead Test`
- `Lead Enrichment v0.1.2 - Single Lead Test`
- `Lead Enrichment v0.1.3 - Single Lead Test`
- `Lead Enrichment v0.1.4 - Single Lead Test`
- `Lead Enrichment v0.1.5 - Single Lead Test`
- `Lead Enrichment v0.1.6 - Single Lead Test`
- `Lead Enrichment v0.1.7 - Single Lead Test`
- `Lead Hunter Executor v0.2.1 - URL Normalization Test`
- `Lead Intake Form v0.1`
- `Lead Search Task Generator v0.1`

所有本地 JSON 的 `active` 均为 `false`。

### 3.2 触发方式

- Candidate Promotion：Manual Trigger
- Candidate Triage：Manual Trigger
- Lead Enrichment v0.1.x：Manual Trigger
- Lead Hunter Executor：Manual Trigger
- Lead Intake Form：Form Trigger
- Lead Search Task Generator：Form Trigger

### 3.3 PostgreSQL 写入节点

本地 JSON 中可确认的 PostgreSQL 写入路径：

- `Lead Intake Form v0.1`：`Save Lead & Score` 写入 `leads`，依赖数据库 trigger 自动评分。
- `Candidate Promotion V0.1 - Single Test`：`Promote Into Leads` 写入或更新 `leads`；`Mark Candidate Promoted` 更新 `candidate_leads`。
- `Candidate Triage v0.2.1 - Precedence Fix Test`：更新 `candidate_leads` 的候选评分与状态。
- `Lead Hunter Executor v0.2.1`：写入 `candidate_leads`。
- `Lead Search Task Generator v0.1`：写入 `agent_tasks`。
- `Lead Enrichment v0.1.x`：读取单条 `public.leads`，安全更新 enrichment 字段与 `raw_data.enrichment_v01`，读取更新后的 lead。

### 3.4 当前 scoring 依赖关系

本地 workflow 没有发现直接调用 v0.2 TypeScript scoring engine 的节点。

v0.1 正式评分路径根据 SQL 和文档判断为：

- n8n 写入或更新 `leads`；
- PostgreSQL trigger `leads_score_v01` 自动执行 `score_lead_v01()`；
- 数据库写入 `score`、`grade`、`priority`、`lead_score_breakdown`、`last_scored_at`。

### 3.5 credentials 字段事实

只做键名扫描，不输出任何 credential 内容：

- `candidate-promotion-v0.1.json` 包含 `credentials` 字段；
- `candidate-triage-v0.1.json` 包含 `credentials` 字段；
- `lead-hunter-executor-v0.2.json` 包含 `credentials` 字段；
- `lead-intake-form-v0.1.json` 包含 `credentials` 字段；
- `lead-search-task-generator-v0.1.json` 包含 `credentials` 字段；
- `lead-enrichment-v0.1.7-single-lead-test-contact-candidate-quality-hardening.json` 未发现实际 `credentials` 字段，仅 notes 中提到人工选择 PostgreSQL Credential。

本次未读取、展示或复制 credentials 内容。

## 4. Lead Agent v0.1 封存事实

可确认 v0.1 能力：

- Lead intake：通过 n8n form 写入 `leads`，由 PostgreSQL trigger 自动评分。
- Candidate triage：从 `candidate_leads` 读取候选，进行候选优先级评估并更新候选状态。
- Candidate promotion：将人工 review 或 competitor_review 的候选提升为正式 lead，正式评分依赖 DB trigger。
- Lead enrichment：单条手动触发，访问公开官网首页和最多一个同域 Contact 页面，写入 enrichment 字段与 `raw_data.enrichment_v01`，不覆盖人工非空字段。
- Lead Hunter：从任务读取搜索计划，生成 candidate leads。

v0.1 当前生产事实来源：

- `public.leads.score`
- `public.leads.grade`
- `public.leads.priority`
- `public.leads.lead_score_breakdown`
- `score_lead_v01()` 与 `leads_score_v01` trigger

v0.2 shadow 不得破坏：

- 不写 `leads.score`
- 不写 `leads.grade`
- 不写 `leads.priority`
- 不修改 `score_lead_v01()`
- 不修改 `leads_score_v01`
- 不改变现有 n8n 生产路径
- 不自动触达真实 leads

## 5. 本地 Lead Scoring v0.2-v0.7 可复用事实

可确认能力：

- `scoreLeadAPI()` 本地 facade 可用；
- `scoring-config/v1.json` 为配置驱动规则集；
- baseline 示例 `ABC Displays` 输出 `total_score=21`；
- 支持 config validation；
- 支持 explanation；
- 支持 execution context；
- 支持 event trace；
- 支持 replay consistency；
- 支持 replay router 与 API facade；
- 支持本地 orchestration task 通过 adapter 调用 `scoreLeadAPI()` 并写入脱敏 task result。

当前仍只能作为本地或 shadow-ready 能力：

- persistence adapter 是 stub / interface；
- 没有真实 PostgreSQL event store；
- 没有 n8n 生产接入；
- 没有 HTTP server；
- 没有生产配置仓库；
- 没有写回 `public.leads` 正式评分字段。

## 6. 适合 v0.2 shadow mode 读取的字段

建议只读输入字段：

- `id`
- `company_name`
- `website`
- `country`
- `industry`
- `email` 是否存在
- `phone` 是否存在
- `notes` 的脱敏摘要或关键词
- `source`
- `source_url` 是否存在
- `company_size`
- `import_signals`
- `company_description`
- `contact_page_url`
- `enrichment_status`
- v0.1 当前 `score`
- v0.1 当前 `grade`
- v0.1 当前 `priority`
- v0.1 当前 `lead_score_breakdown`

不得覆盖或写入：

- `score`
- `grade`
- `priority`
- `lead_score_breakdown`
- `last_scored_at`
- 任何人工字段如 `email`、`phone`、`contact_name`、`contact_title`
- `raw_data.enrichment_v01`
- v0.1 trigger/function/table structure

## 7. 风险等级

风险等级：中。

原因：

- 本地仓库可确认 v0.1 trigger 和 workflow 草案，但未确认实时数据库状态；
- 部分本地 n8n JSON 仍包含 `credentials` 字段，后续归档或审查必须脱敏；
- v0.2 shadow 需要数据库新增表才能落地，一旦误写正式评分字段会污染 v0.1 生产事实。

## 8. 下一步建议

下一步仅建议用户审查 `LEAD-SCORING-V0.2-SHADOW-MODE-MINIMAL-DESIGN.md`，确认是否允许进入 SQL 草案审查阶段。未经明确批准，不得执行 SQL，不得导入 n8n，不得连接或写入数据库。
