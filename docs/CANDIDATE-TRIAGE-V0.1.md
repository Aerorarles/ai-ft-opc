# Candidate Triage V0.1

## 实验状态

本文档描述一个本地手动测试用的 n8n 工作流，用于对 `candidate_leads` 表中 `candidate_status = 'new'` 的候选线索进行透明、可解释的规则评分。

当前版本为实验流程，不代表最终业务判断，不会自动联系真实 leads，不会发送邮件、私信、表单或任何外部触达。所有进入 `review`、`competitor_review`、`low_priority` 或 `rejected` 的结果都应由人工按需复核。

## 文件

- `workflows/n8n/candidate-triage-v0.1.json`

## 工作流目的

工作流从 PostgreSQL 读取最多 50 条新候选线索，使用 Code 节点中的规则逻辑计算：

- `relevance_score`
- `candidate_status`
- `review_notes`
- `reviewed_at`

随后通过参数化 PostgreSQL 查询更新 `candidate_leads`，并返回更新后的字段。

## 流程

1. Manual Trigger：人工启动，仅用于本地测试。
2. PostgreSQL：读取最多 50 条 `candidate_status = 'new'` 的记录。
3. Code：根据 title、URL、snippet 计算分数、状态和审核说明。
4. PostgreSQL：使用参数化查询更新 `candidate_leads`。
5. 返回 PostgreSQL `RETURNING` 的更新结果字段。

## 四种状态

### rejected

用于明显不是公司线索的内容，例如文章、榜单、资源页、搜索页、分类页、新闻页或招聘页。常见命中词包括：

- `top 10`
- `top 100`
- `list`
- `article`
- `resource hub`
- `blog`
- `search`
- `category`
- `news`
- `careers`
- `jobs`

这些页面通常不是目标公司官网或可审核的潜在线索入口，因此保留直接拒绝逻辑。

### competitor_review

用于可能是竞争方、制造商、供应商、工厂、批发商或分销商的公司网站。常见命中词包括：

- `manufacturer`
- `manufacturing`
- `supplier`
- `factory`
- `wholesale`
- `wholesaler`
- `distributor`

这类结果不应自动进入 `rejected`。它们可能不是目标客户，但仍然有业务判断价值，例如识别竞争格局、渠道关系、供应链信息或误判的真实目标公司。因此只要不是明显非公司内容，并且 URL 形态像真实公司官网，工作流会将其保留为 `competitor_review`，交给人工复核。

### review

用于看起来是真实目标公司，并且与展示、零售、亚克力、标识或店铺陈列高度相关的候选线索。正向关键词包括：

- `retail display`
- `display fixtures`
- `acrylic display`
- `merchandising`
- `signage`
- `custom displays`
- `store fixtures`

### low_priority

用于有一定相关性但信息较弱、不完整或不足以直接进入重点审核的候选线索。例如只命中少量正向词、URL 形态像公司官网但业务描述不足，或缺少清晰 snippet。

## 评分规则

### 显式状态优先级

状态判定按固定顺序执行：

1. 先检查明显非公司内容。如果标题或 URL 命中文章、榜单、目录、搜索、分类、新闻或招聘类词语，状态为 `rejected`。
2. 如果不是明显非公司内容，并且 URL 形态像真实公司官网，同时 title 或 snippet 命中制造商、供应商、工厂、批发商或分销商相关词，状态为 `competitor_review`。这些公司型结果不能仅因为 `manufacturer`、`supplier`、`factory`、`wholesale`、`wholesaler` 或 `distributor` 而进入 `rejected`。
3. 如果不是竞争/渠道公司，并且疑似真实目标公司且业务相关性较强，状态为 `review`。
4. 其余未被拒绝的候选保留为 `low_priority`。

### 正向关键词加分

如果标题或 snippet 命中业务相关词，每个命中词都会增加相关性分数。命中多个展示、零售、亚克力、标识或店铺陈列词时，更可能进入 `review`。

### 公司官网形态加分

如果 URL 可以解析出 hostname、路径较短，并且不属于明显搜索、社交或目录平台，会增加分数。该规则只是启发式判断，不能替代人工确认。

### 竞争/渠道词中度扣分但不自动拒绝

如果 title 或 snippet 命中制造商、供应商、工厂、批发商或分销商相关词，会进行中度扣分，但不会因为这些词自动拒绝。只要不是明显非公司内容，并且 URL 形态像真实公司官网，竞争/渠道公司优先进入 `competitor_review`。若同时存在强展示相关词和竞争/渠道词，`competitor_review` 优先于 `review`、`low_priority` 和 `rejected`。

## 状态映射

- `rejected`：明显非公司内容，例如文章、榜单、目录、搜索、分类、新闻或招聘页。
- `competitor_review`：疑似竞争方、制造商、供应商、工厂、批发商或分销商的公司网站。
- `review`：疑似真实目标公司，且展示、零售、亚克力、标识或店铺陈列相关性强。
- `low_priority`：有一定相关性但较弱、不完整或需要低优先级人工查看。

## 人工审核点

该流程只做规则预筛选。人工审核应重点确认：

- 页面是否为真实公司官网。
- 公司是否与目标业务匹配。
- `competitor_review` 是否确实为竞争方、制造商、供应商、工厂、批发商或分销商。
- 是否存在误判，例如博客文章中提到目标关键词但不是潜在线索。
- 是否可以安全进入后续人工确认流程。

## 安全限制

- 不包含 credentials、API key、password、token、cookie 或其他密钥。
- 不导出真实 n8n credentials。
- 不修改 Docker 配置、数据库迁移、`.env` 文件或既有 n8n 工作流。
- 不运行数据库迁移。
- 不自动联系真实 leads。
- 不自动推送到远端仓库。

## 导入和测试注意事项

导入 n8n 后，需要人工在 n8n UI 中为 PostgreSQL 节点选择本地测试用 credentials。仓库中的 JSON 不包含任何 credentials。

首次测试前建议人工确认：

- `candidate_leads` 表存在目标字段。
- `candidate_status` 允许写入 `review`、`competitor_review`、`low_priority` 和 `rejected`。
- 测试数据为本地实验数据。
- 查询和更新仅针对 `candidate_status = 'new'` 的候选记录。
- 本流程用于手动测试，不应挂接自动定时触发或真实外部触达步骤。
