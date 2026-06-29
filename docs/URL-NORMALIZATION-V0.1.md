# URL Normalization V0.1

本文档记录 `lead-hunter-executor-v0.2-serper-smoke-test` 在保存候选线索前对 Google/Serper 搜索结果 URL 的规范化约定。

## 实验状态与安全边界

当前规则用于本地 `ai-ft-opc` 实验流程，目标是提高候选线索去重质量。该流程不应自动联系真实 leads，不应自动发送邮件、私信、表单或任何外部触达。涉及真实数据清理时，必须先人工审查 SQL 和影响行数，再由人工决定是否执行。

## 为什么需要 canonical URL

Google/Serper 返回的 `link` 经常带有查询字符串、片段和追踪参数，例如 `srsltid`、`utm_source`、`utm_medium`、`utm_campaign`、`gclid`、`fbclid`。这些参数通常不代表公司官网本身，只代表搜索、广告或分享来源。

如果直接把完整搜索结果 URL 保存为 `website`，同一个公司官网可能因为不同查询参数被保存成多条候选线索。例如：

```text
https://example.com/?utm_source=google
https://example.com/?srsltid=abc123
https://example.com/#about
```

规范化后统一保存为：

```text
https://example.com/
```

这样 `website` 更适合作为候选线索的唯一识别字段。

## 当前规范化规则

在保存 `candidate_leads` 前，工作流会把 Serper 结果中的原始 `link` 转换为干净的 `website`：

- 只接受 `http://` 和 `https://` URL。
- 保留协议、主机名和有意义的路径。
- 移除所有查询字符串和片段。
- 对首页类路径保存为根路径，例如 `https://domain.com/`。
- 对非首页路径保留路径本身，并移除末尾多余 `/`。

示例：

```text
https://domain.com/?utm_source=google
=> https://domain.com/

https://domain.com/products/?gclid=abc#details
=> https://domain.com/products
```

## duplicate prevention 如何工作

`candidate_leads` 的保存步骤使用规范化后的 `website` 作为冲突判断依据：

```sql
ON CONFLICT (website) WHERE website IS NOT NULL
DO UPDATE SET ...
```

因此，多个 Serper 结果只要规范化后指向同一个 `website`，就会更新同一条候选线索，而不是插入重复记录。这个机制依赖 `website` 足够稳定、干净，所以规范化必须发生在写入数据库之前。

## source_url 保留搜索证据

规范化不会覆盖原始搜索证据。工作流会继续把 Serper 返回的原始 `link` 原样保存到 `source_url`。

字段职责如下：

- `website`：用于去重、展示和后续人工审核的 canonical URL。
- `source_url`：保留 Serper/Google 原始结果 URL，用于追溯该候选线索来自哪条搜索结果。

这样可以同时获得稳定的去重键和可审计的来源证据。

## 仅供文档参考的安全 SQL

以下 SQL 仅作为文档示例，不应由自动化助手执行。执行前必须人工备份数据，并先用 `SELECT` 预览影响范围。

预览 candidate_leads：

```sql
SELECT id, website, regexp_replace(website, '[?#].*$', '') AS normalized_website
FROM candidate_leads
WHERE website ~ '[?#]';
```

预览 leads：

```sql
SELECT id, website, regexp_replace(website, '[?#].*$', '') AS normalized_website
FROM leads
WHERE website ~ '[?#]';
```

人工确认后，可用以下语句仅移除 `?` 或 `#` 之后的内容：

```sql
UPDATE candidate_leads
SET website = regexp_replace(website, '[?#].*$', '')
WHERE website ~ '[?#]';

UPDATE leads
SET website = regexp_replace(website, '[?#].*$', '')
WHERE website ~ '[?#]';
```

注意：如果表上存在唯一约束，清理前必须先检查规范化后是否会产生重复值。发现重复时，应由人工决定合并策略，不能自动删除或覆盖真实数据。
