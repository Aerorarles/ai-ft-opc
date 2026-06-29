# Candidate Promotion V0.1

## 实验状态

本文档描述一个本地手动测试用的 n8n 工作流，用于把一条已经人工审核过的 `candidate_leads` 记录提升到正式 `leads` 表。

当前版本只用于安全验证，不会自动批量提升，不会联系真实 leads，不会发送邮件、私信、表单或任何外部触达。导入后必须由人工在 n8n UI 中选择 PostgreSQL credentials，并在 Code 节点中明确指定一个测试候选。

## 文件

- `workflows/n8n/candidate-promotion-v0.1.json`

## 工作流目的

工作流从 `candidate_leads` 中读取状态为 `review` 或 `competitor_review` 的候选线索，然后只选择一个明确指定的候选，写入或更新正式 `leads` 表。正式表的 A/B/C 评分由现有数据库 trigger 自动计算，本工作流不手工写入 `score` 或 `grade`。

提升成功后，工作流会回写 `candidate_leads`：

- `promoted_to_lead_id`
- `candidate_status = 'promoted'`
- `reviewed_at`
- `review_notes`

最后返回：

- `company_name`
- `lead_score`
- `grade`
- `priority`
- `promoted_lead_id`

## 流程

1. Manual Trigger：人工启动。
2. PostgreSQL：读取最多 50 条 `candidate_status IN ('review', 'competitor_review')` 的候选。
3. Code：只选择一个明确测试候选，按 `TEST_CANDIDATE_ID` 或 `TEST_WEBSITE` 匹配。
4. PostgreSQL：将该候选插入或更新到 `leads` 表。
5. 数据库 trigger：自动计算正式 lead 的 `score` 和 `grade`。
6. PostgreSQL：回写 `candidate_leads.promoted_to_lead_id`，并把 `candidate_status` 改为 `promoted`。
7. 返回提升结果字段。

## 手动选择测试候选

导入 workflow 后，必须打开 `Select One Explicit Candidate` Code 节点，并填写以下两个常量之一：

- `TEST_CANDIDATE_ID`：候选记录的 UUID。
- `TEST_WEBSITE`：候选记录的 website。

默认这两个值都是空字符串。若未填写，工作流会直接报错并停止，不会提升任何记录。

如果同时填写二者，优先按 `TEST_CANDIDATE_ID` 精确匹配。

## 安全边界

### 不提升 rejected

工作流的读取 SQL 只读取：

- `review`
- `competitor_review`

Code 节点也会再次检查状态。如果候选不是这两个状态，会停止并报错。因此 `rejected` 不会被提升。

### 不自动批量提升

PostgreSQL 读取节点最多取 50 条待选候选，但 Code 节点只允许输出一个明确匹配的候选。没有明确候选 ID 或 website 时不会输出任何待提升记录。

### 人工审核仍然必需

`review` 和 `competitor_review` 只是候选分层状态，不代表可以自动进入正式 lead。人工在提升前应确认：

- 公司是否真实存在。
- website 是否为公司官网。
- `competitor_review` 是否适合作为正式 lead，或仅应作为竞争/渠道情报保留。
- source URL、搜索词、页面标题和 snippet 是否支持该判断。
- 不涉及任何自动外部触达。

## 字段保留策略

正式 `leads` 表当前已知字段包括：

- `company_name`
- `website`
- `country`
- `industry`
- `source`
- `notes`
- `raw_data`

候选中的以下信息会尽量保留到 `leads.raw_data` 中：

- `candidate_lead_id`
- `source_url`
- `search_query`
- `page_title`
- `page_snippet`
- `candidate_status`
- `candidate_relevance_score`
- `candidate_review_notes`
- `candidate_raw_data`

这样不会要求修改正式 `leads` 表结构，也不会新增数据库 migration。

## PostgreSQL 安全约定

- 所有 SQL 使用 `$1`、`$2` 等参数化占位符。
- JSON 中不包含 credentials、API key、password、token、cookie 或其他密钥。
- 导入 n8n 后，需要人工选择本地测试用 PostgreSQL credentials。
- 不修改 Docker 配置、数据库 migration、`.env` 文件或既有 workflow。
- 不运行数据库迁移。
- 不自动联系真实 leads。
- 不自动推送远端仓库。

## Insert/Update 说明

正式 `leads` 表按 `website` 有唯一索引。workflow 使用 `INSERT ... ON CONFLICT (website) WHERE website IS NOT NULL DO UPDATE`，用于本地手动测试中避免重复创建相同 website 的 lead。

该 SQL 不写入 `score` 或 `grade`，让现有数据库 trigger 自动计算 A/B/C 评分。返回结果中 `priority` 是根据 `grade` 和 `score` 派生的输出别名，用于人工查看，不要求 `leads` 表存在单独的 `priority` 字段。

## 测试前人工确认

运行前请人工确认：

- `candidate_leads` 表存在 `promoted_to_lead_id` 字段。
- `candidate_leads` 中目标记录已完成审核，状态为 `review` 或 `competitor_review`。
- `leads` 表存在现有 A/B/C 评分 trigger。
- 当前测试不会触发任何外部触达步骤。
