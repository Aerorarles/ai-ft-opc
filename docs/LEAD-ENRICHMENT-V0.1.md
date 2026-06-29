# Lead Agent 信息补全 v0.1

本文档描述 `ai-ft-opc` 项目中 Lead Agent 信息补全能力的 v0.1 设计边界。该模块属于 AI OPC 主体结构中的 Lead Agent 信息补全能力，目标是在人工确认的前提下，为单条 Lead 补充公开官网可见的公司简介和联系页面线索。

## 设计原则

每次设计和修改本模块时，都必须检查以下三点：

1. 是否服务 AI OPC 主体结构，而不是形成脱离主线的临时脚本或孤立流程。
2. 是否模块化可复用，方便后续接入不同来源的 Lead、不同审核节点和不同评分策略。
3. 是否方便后期维护与交付，包括状态可追踪、错误可解释、人工可复核、回滚路径明确。

## 触发方式

- v0.1 仅支持单条 Lead 手动触发。
- 不支持批量自动抓取。
- 不支持定时全量扫描。
- 不自动联系真实 leads。
- 不自动发送邮件、私信、表单或任何外部触达。

## 抓取范围

允许访问的页面范围仅限：

- 公开官网首页。
- 与官网同域的 `Contact`、`Contact Us`、`Request Quote` 页面。

明确禁止：

- 不登录任何网站。
- 不绕过验证码、访问控制、付费墙或反爬机制。
- 不批量抓取。
- 不访问无关第三方页面。
- 不自动提交表单。
- 不自动触达真实 leads。

## 字段写入规则

迁移文件仅向 `public.leads` 新增以下字段：

- `company_description text`
- `contact_page_url text`
- `enrichment_status text NOT NULL DEFAULT 'pending'`
- `enriched_at timestamptz`
- `enrichment_error text`

`enrichment_status` 允许值：

- `pending`
- `running`
- `succeeded`
- `partial`
- `failed`
- `skipped`

同时创建索引：

- `idx_leads_enrichment_status`

该迁移不删除或修改现有字段、数据、Trigger、索引或约束。

## 人工字段保护

信息补全过程不得覆盖人工已填写的非空字段：

- `email`
- `phone`
- `contact_name`
- `contact_title`

如果公开页面提取到这些信息，但目标字段已经存在非空人工值，应保留人工值。提取结果可以作为候选信息写入 `raw_data.enrichment_v01`，供人工审核，不应直接覆盖。

## raw_data 记录约定

补全结果写入 `raw_data.enrichment_v01`。该结构应至少保留：

- 来源 URL。
- 页面类型，例如 `homepage`、`contact`、`request_quote`。
- 提取时间。
- 提取到的公司简介。
- 提取到的联系页面 URL。
- 候选 email、phone、contact_name、contact_title。
- 失败原因或跳过原因。
- 人工审核所需的原始摘要。

示例结构：

```json
{
  "enrichment_v01": {
    "sources": [
      {
        "url": "https://example.com",
        "page_type": "homepage",
        "extracted_at": "2026-06-29T00:00:00Z"
      }
    ],
    "company_description": "公开官网中提取的公司简介",
    "contact_page_url": "https://example.com/contact",
    "candidates": {
      "email": null,
      "phone": null,
      "contact_name": null,
      "contact_title": null
    },
    "error": null
  }
}
```

## 状态流转

建议状态流转如下：

1. `pending`：默认状态，等待人工选择单条 Lead 触发补全。
2. `running`：人工触发后进入执行中。
3. `succeeded`：公开页面抓取成功，并得到可用公司简介或联系页面 URL。
4. `partial`：部分页面访问或解析成功，但信息不完整。
5. `failed`：执行失败，例如官网 URL 缺失、网络错误、页面不可访问或解析异常。
6. `skipped`：因安全边界、域名不匹配、需要登录、疑似批量风险或人工判断不适合处理而跳过。

## 失败处理

- 失败时写入 `enrichment_error`，说明失败原因。
- 失败或跳过时仍应在 `raw_data.enrichment_v01` 中记录可审计信息，例如来源 URL、失败阶段、错误摘要和提取时间。
- 不应自动无限重试。
- 重新执行必须由人工对单条 Lead 手动触发。
- 对于需要登录、验证码、访问限制或表单提交的页面，应立即停止并标记为 `skipped`。

## 与现有自动评分 Trigger 的关系

本模块只负责 Lead 信息补全，不替代现有自动评分 Trigger。

需要注意：

- 新增字段可能被后续评分逻辑读取，但 v0.1 不主动修改评分 Trigger。
- 不在本迁移中修改已有 Trigger。
- 不在本迁移中重算历史评分。
- 如果未来评分需要使用 `company_description`、`contact_page_url` 或 `raw_data.enrichment_v01`，应单独设计、审查并明确人工确认步骤。
- 信息补全结果应作为评分输入之一，而不是绕过人工审核直接改变业务动作。

## n8n 节点草图

v0.1 的 n8n 工作流建议保持人工触发和只读抓取边界：

1. Manual Trigger：人工选择单条 Lead。
2. PostgreSQL Read Lead：读取指定 Lead 的官网 URL、当前补全状态和人工字段。
3. Guard Check：检查是否单条触发、是否存在官网 URL、是否允许处理。
4. PostgreSQL Update Running：将 `enrichment_status` 更新为 `running`。
5. HTTP Request Homepage：请求公开官网首页。
6. Extract Homepage Summary：提取公司简介候选内容。
7. Discover Contact URL：仅在同域内识别 `Contact`、`Contact Us`、`Request Quote` 页面。
8. HTTP Request Contact Page：请求允许范围内的联系页面。
9. Extract Contact Candidates：提取候选联系信息，但不覆盖人工已填写的非空字段。
10. Merge raw_data.enrichment_v01：保留来源 URL、提取时间、候选结果和错误摘要。
11. PostgreSQL Update Result：写入新增字段、`raw_data.enrichment_v01`、`enriched_at` 和最终状态。
12. Manual Review：由人工复核结果，决定是否进入后续评分或销售动作。

## 测试标准

上线或交付前至少验证：

- 单条 Lead 手动触发可以完成。
- 缺少官网 URL 时标记为 `failed` 或 `skipped`，并写入原因。
- 官网首页可访问时能记录来源 URL 和提取时间。
- 同域 Contact 页面可识别并写入 `contact_page_url`。
- 跨域页面不会被抓取。
- 需要登录或验证码的页面会被跳过。
- 已有非空 `email`、`phone`、`contact_name`、`contact_title` 不会被覆盖。
- 失败时不会自动批量重试。
- 不会发送邮件、私信、表单或其他外部触达。
- `enrichment_status` 只能写入约束允许的状态值。

## 回滚说明

该迁移只新增字段、约束和索引，不修改现有数据和既有逻辑。若需要回滚，应由人工在维护窗口中确认影响，并单独编写回滚 SQL。

回滚前必须确认：

- 是否已有流程依赖新增字段。
- 是否已有人工审核记录依赖 `raw_data.enrichment_v01`。
- 是否需要先导出或备份新增字段中的补全结果。
- 是否会影响后续评分、报表或交付流程。

不得在未确认的情况下执行破坏性 SQL。不得执行无条件 `DROP`、`TRUNCATE`、`DELETE` 或 `UPDATE`。

## 安全边界

- 本模块处于实验状态。
- 默认只读访问公开网页。
- 默认单条手动触发。
- 默认保留人工审核点。
- 默认不触达真实 leads。
- 默认不替代 n8n 实例中的真实工作流和 credentials 备份。
