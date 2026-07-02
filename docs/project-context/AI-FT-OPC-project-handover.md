# AI FT-OPC 项目交接与长期上下文（最新版）

> **用途**：在新的 ChatGPT / Codex 对话中，先完整阅读本文件，再继续 AI FT-OPC 项目。
> **权威性**：本文件是当前项目的唯一权威上下文；未阅读前，不修改代码、数据库、Docker、n8n 工作流或服务器配置。
> **更新时间**：2026-06-30
> **当前阶段**：Lead Enrichment v0.1.5 已生成，尚未完成静态审查、导入、正向验证、最终回写与 Git 归档。

---

# 0. 新对话启动提示（直接复制）

```text
你现在是我的 AI FT-OPC 项目协作助手。

请先完整阅读我提供的《AI FT-OPC 项目交接与长期上下文（最新版）》文件。该文件是当前项目的唯一权威上下文；在未阅读并理解前，不要修改代码、数据库、Docker、n8n 工作流或服务器配置。

项目核心目标：
我正在搭建一个可复用、未来可交付给中国工厂客户的 AI 外贸运营平台（AI FT-OPC / AI OPC）。当前优先完成 Lead Agent 的稳定闭环，再逐步平台化、配置化、可视化。

所有解释、方案、文件说明和最终回复必须使用中文。

严格遵守：
1. 不读取、不展示、不复制、不提交 configs/.env、API Key、密码、Credentials 或数据库数据卷。
2. 未经我明确批准，不运行 Docker、数据库 migration、Git commit、Git push、服务器部署命令。
3. 未经我明确批准，不发送开发邮件、WhatsApp、LinkedIn 消息或任何真实客户触达。
4. 未经我明确批准，不自动发布 n8n workflow。
5. 不执行 rm -rf、docker compose down、docker system prune、DROP/TRUNCATE/大范围 DELETE 等破坏性命令。
6. 数据库改动必须先给出 migration SQL、影响范围、回滚建议，等待我确认。
7. n8n 工作流变更必须先给出可审查设计；测试成功后，必须导出 JSON 并保存到 workflows/n8n。
8. 优先构建稳定、可解释、可人工审核的半自动流程，不要直接堆叠复杂自主 Agent。
9. 不要重复问本文件中已经明确的信息。
10. 所有后续设计必须先检查：是否服务 AI OPC 主体结构、是否模块化可复用、是否便于维护、是否可配置、是否支持未来可视化和产品化交付。

用户偏好：
- 能由 Codex 在本地项目工作树内安全完成的文件、JSON、文档或受限 Git 操作，优先直接提供可复制给 Codex 的提示。
- 服务器、数据库、Docker、部署和真实触达仍需用户明确授权，默认由用户人工执行。
- 不擅自执行写操作；先给出影响、限制、验收与回滚建议。
```

---

# 1. 用户背景、业务与长期目标

## 1.1 用户与业务

用户是一家中国印刷工厂经营者，主营：

- 亚克力、纸张等材质的 UV 印刷；
- 丝网印刷；
- 相关展示、标识、POP、零售陈列类定制制造；
- 面向海外 B2B 客户拓展业务。

用户目前编程基础较弱，需要分步骤、低风险、可验证的操作指导。用户希望以“一人公司”的方式，通过 AI 降低海外拓客、内容、网站、数据管理与外贸运营的人力成本；未来可能雇佣 2–3 名外贸人员，但希望系统始终由自己掌控。

## 1.2 AI FT-OPC 总目标

搭建一个可复用、未来可交付给中国工厂客户的 **AI 外贸运营平台（AI FT-OPC / AI OPC）**。

短期目标：

```text
搭建稳定的 Lead Agent
→ 找客户
→ 筛选
→ 人工审核
→ Promote
→ 信息补全
→ 自动评分
```

中长期目标：

```text
AI OPC 主体结构
→ Lead Agent
→ SEO Agent
→ Website Agent
→ Content Agent
→ Sales Agent
→ Analytics Agent
→ 可视化后台
→ 客户部署 / 私有化交付 / 小程序或 Web 版
```

---

# 2. AI OPC 主体结构（最高架构约束）

## 2.1 核心理念

不是“很多 AI 都能聊天”，而是：

```text
中枢负责判断与调度
Agent 负责特定能力
MCP 提供受控工具权限
n8n 提供稳定业务流程
数据库提供状态、评分与审计
人工负责审批、商业判断与客户关系
```

## 2.2 当前与未来角色分工

```text
AI OPC 中枢
├─ ChatGPT
│  ├─ 战略、产品设计、架构
│  ├─ 业务判断、风险审查
│  ├─ 流程拆解、验收标准
│  └─ 长期路线与模块边界
│
├─ Codex
│  ├─ 本地项目工作树内写代码、JSON、SQL、文档
│  ├─ 静态审查与改动摘要
│  ├─ 受限 Git 操作（仅明确授权时）
│  └─ 不读取 secrets，不自行连接服务器或操作生产数据库
│
├─ n8n
│  ├─ 稳定、可视化、可审计的业务流程执行层
│  ├─ Lead 搜索、筛选、Promote、Enrichment 等
│  └─ 不是最终用户管理后台
│
├─ PostgreSQL
│  ├─ 产品、Candidate、Lead、评分、状态、审计
│  ├─ 未来承载配置化规则与权限数据
│  └─ 是业务状态源，不是用来随意手工改数据的工具
│
├─ OpenClaw / Hermes / Claude Code（未来）
│  ├─ Agent 调度、任务路由、专业子 Agent
│  └─ 权限体系成熟后再接入
│
├─ MCP（未来）
│  ├─ GitHub、文档、浏览器、数据库、CRM 等受控工具连接
│  └─ 初期最小权限，优先只读
│
└─ 管理后台（未来）
   ├─ Lead Center
   ├─ Keyword / Weight Config
   ├─ Enrichment Center
   ├─ Workflow / Logs
   ├─ CRM / Sales 审批
   └─ 用户权限与审计
```

## 2.3 每次设计或修改都必须验证

1. 是否服务于 AI OPC 主体结构，而非只修一个孤立节点？
2. 是否可模块化复用到未来 SEO / Sales / Content / Analytics Agent？
3. 是否可维护、可审计、可人工审核、可配置？
4. 是否为未来可视化后台与产品化交付保留正确边界？

---

# 3. 安全与工作规则（硬约束）

## 3.1 禁止事项

未经用户明确批准，禁止：

- 读取、展示、复制、提交 `configs/.env`；
- 读取、展示 API Key、密码、Credential、数据库数据卷；
- 运行 Docker、数据库 migration、Git commit、Git push、服务器部署；
- 发布 n8n workflow；
- 发送任何真实客户触达：
  - 邮件；
  - WhatsApp；
  - LinkedIn；
  - 表单；
  - 自动报价；
  - 任何外部消息；
- 执行破坏性命令：
  - `rm -rf`
  - `docker compose down`
  - `docker system prune`
  - `DROP`
  - `TRUNCATE`
  - 大范围 `DELETE`
  - 未审查批量 `UPDATE`。

## 3.2 数据库改动要求

每次数据库 schema 或数据修改：

1. 先提供 SQL；
2. 说明影响范围；
3. 说明回滚建议；
4. 等待用户确认；
5. 使用最小范围；
6. 优先 `WHERE id = ...`、状态条件、`RETURNING`；
7. 无法确认 UUID / URL / 公司记录时，必须先做只读 `SELECT`；
8. 不从截图猜 UUID，不凭推测修改数据库。

## 3.3 n8n 规则

- 改动前先给可审查设计；
- 逐节点测试，不要一开始整条跑到底；
- 测试成功后导出 JSON，保存到 `workflows/n8n/`；
- 工作流默认 inactive；
- JSON 不含 credentials；
- 不自动批量运行；
- 不自动触达；
- 失败必须安全、可解释、可人工复核；
- 优先稳定工作流，不堆复杂自主 Agent。

## 3.4 Git 规则

当用户明确授权 Git 操作时：

- 仅添加指定文件；
- 禁止 `git add .`、`git add -A`、`git commit -a`、`git push --force`；
- 远程有新增提交、分叉、冲突时停止，不自行 rebase / merge / reset；
- push 前检查：
  - 目标文件存在；
  - staged 文件清单；
  - `git diff --cached --check`；
  - 没有 `.env` / secrets / credentials；
- Codex 能做时优先让 Codex 做受限 Git 操作；
- 服务器同步顺序固定：
  ```bash
  git status
  git fetch origin
  git log --oneline HEAD..origin/main
  git pull --ff-only origin main
  ```

---

# 4. 项目环境与仓库

## 4.1 本地项目路径

```text
C:\Users\Jklee\Documents\ai-ft-opc
```

Codex 应在这个项目工作树内操作。

## 4.2 服务器路径

```text
/opt/ai-opc
```

## 4.3 GitHub

```text
git@github.com:Aerorarles/ai-ft-opc.git
```

主分支：

```text
main
```

## 4.4 服务器服务

已安装并曾正常运行：

```text
aiopc-n8n
aiopc-postgres
aiopc-qdrant
aiopc-redis
```

服务状态必须每次通过实时命令验证，不依赖历史记忆。

## 4.5 关键目录

```text
ai-ft-opc/
├─ database/
│  └─ migrations/
├─ docs/
├─ workflows/
│  └─ n8n/
├─ scripts/
│  └─ manual/
├─ configs/
│  └─ .env  ← 严禁读取、展示、提交
└─ ...
```

---

# 5. 已跑通的 Lead Agent 闭环

## 5.1 当前业务闭环

```text
产品 + 国家 + 行业
→ 创建搜索任务
→ Serper 搜索
→ candidate_leads 候选库
→ 规则初筛
→ 人工确认
→ Promote 到 leads
→ PostgreSQL 自动 A/B/C 评分
→ Lead Enrichment（单条、公开页面、人工审核）
```

## 5.2 当前验证场景

```text
产品：Custom Acrylic Display
市场：United States
行业：Retail displays
```

## 5.3 已归档工作流

主要已归档的 n8n 工作流：

```text
workflows/n8n/
├─ lead-intake-form-v0.1.json
├─ lead-search-task-generator-v0.1.json
├─ lead-hunter-executor-v0.2.json
├─ candidate-triage-v0.1.json
├─ candidate-promotion-v0.1.json
└─ lead-enrichment-v0.1.3-single-lead-test-blocked-response-sanitization.json
```

备注：

- 部分历史文件名可能存在版本差异，操作前应检查当前目录和 Git 状态；
- v0 / v0.1.1 / v0.1.2 的 Enrichment 中间版本曾保留为未跟踪文件，不应随意提交或删除；
- 当前是否仍未跟踪应以 `git status --short` 为准。

---

# 6. PostgreSQL 状态

## 6.1 `public.leads` 的关键字段

已确认存在：

```text
id
company_name
website
country
city
industry
contact_name
contact_title
email
phone
linkedin_url
source
score
grade
status
notes
raw_data
created_at
updated_at
product_id
source_url
company_size
import_signals
lead_score_breakdown
priority
last_scored_at
first_contacted_at
next_follow_up_at
```

## 6.2 已执行 Lead Enrichment migration

已创建、Git 归档、服务器同步并成功执行：

```text
database/migrations/004-lead-enrichment-v0.1.sql
docs/LEAD-ENRICHMENT-V0.1.md
```

为 `public.leads` 新增：

```text
company_description text
contact_page_url text
enrichment_status text NOT NULL DEFAULT 'pending'
enriched_at timestamptz
enrichment_error text
```

并已创建：

```text
CHECK CONSTRAINT:
leads_enrichment_status_check

INDEX:
idx_leads_enrichment_status
```

允许状态：

```text
pending
running
succeeded
partial
failed
skipped
```

## 6.3 自动评分 Trigger

已确认原有 Trigger：

```text
leads_score_v01
```

它会调用 `score_lead_v01()` 自动重算评分。

关键原则：

- Enrichment 不手动写 `score / grade / priority`；
- Enrichment 回写可评分字段后，由 Trigger 自动重算；
- 不得修改或破坏现有评分 Trigger，除非走完整 migration 设计与确认流程。

---

# 7. Lead Enrichment 的定位和安全边界

## 7.1 模块位置

```text
Lead Hunter
→ Candidate Triage
→ Candidate Promotion
→ Lead Enrichment
→ Lead Scoring
→ 未来 CRM / Sales Agent / Analytics Agent
```

Lead Enrichment 是“信息补全能力”，不是外联能力。

## 7.2 v0.1 的范围

每次仅处理一条正式 Lead：

```text
手动 UUID 触发
→ 公开官网首页
→ 最多一个同域 Contact 页面
→ 提取公司简介、公开邮箱、公开电话、联系人线索
→ 只补空字段
→ 回写 enrichment 状态与 raw_data.enrichment_v01
→ 触发既有 PostgreSQL 自动评分
```

禁止：

```text
不批量抓取
不登录
不绕过 Cloudflare
不绕过验证码
不使用代理绕过限制
不自动提交表单
不自动发送邮件、WhatsApp、LinkedIn
不自动触达
不抓取不该访问的内容
```

## 7.3 安全回写原则

已有人工字段不得覆盖：

```text
email
phone
contact_name
contact_title
company_description
contact_page_url
```

使用 `COALESCE` / `NULLIF` 或等价保护。

`raw_data.enrichment_v01`：

允许保存：

```text
处理时间
首页 URL
Contact URL
访问状态
HTTP 状态码
标准化失败代码
已验证公开邮箱 / 电话
合规公开页面摘要
```

严禁保存：

```text
整段 HTML
Cookie
response headers
Cloudflare token / challenge 参数
Axios stack
原始错误对象
完整响应体
homepage_html
contact_page_html
```

---

# 8. Lead Enrichment 版本历史

## 8.1 v0.1.0

文件：

```text
workflows/n8n/lead-enrichment-v0.1-single-lead-test.json
```

问题：

```text
URL is not defined
```

原因：n8n Code Node 沙箱中不能依赖全局 `URL` 对象。

## 8.2 v0.1.1

文件：

```text
workflows/n8n/lead-enrichment-v0.1.1-single-lead-test-url-sandbox-fix.json
```

修复：

- 禁止 `new URL()` / `URL()` / `URLSearchParams`；
- 用纯字符串与正则实现 URL 校验、hostname、root domain、同域判断；
- inactive；
- 无 credentials。

## 8.3 v0.1.2

文件：

```text
workflows/n8n/lead-enrichment-v0.1.2-single-lead-test-access-block-handling.json
```

新增：

- Homepage / Contact 页阻断识别；
- Cloudflare、401、403、429、5xx、timeout 等安全分支；
- `Never Error`；
- 失败安全回写。

问题：

- Cloudflare 403 被泛化为 `request_failed`；
- 未正确保留 HTTP 403；
- 后续升级 v0.1.3。

## 8.4 v0.1.3（已验证、已归档）

文件：

```text
workflows/n8n/lead-enrichment-v0.1.3-single-lead-test-blocked-response-sanitization.json
```

已验证：

```text
enrichment_status = failed
enrichment_error = blocked_by_cloudflare_403
homepage_accessible = false
homepage_http_status = 403
homepage_block_reason = blocked_by_cloudflare_403
errors = ["blocked_by_cloudflare_403"]
```

并确认：

- 不保存 Cloudflare HTML；
- 不保存 Cookie、headers、token、stack；
- Show Result 显示人工审核提示；
- inactive，无 credentials。

### 负面样本 A：Acrylic Displays

正式 Lead UUID：

```text
18a32777-f886-4441-98d9-e2b06a5586ab
```

公司：

```text
Acrylic Displays
https://www.shoppopdisplays.com/
```

结果：

```text
Cloudflare 403
blocked_by_cloudflare_403
```

用途：网站保护 / Cloudflare 阻断标准负面测试样本。

### 负面样本 B：Retail Display USA

Candidate 真实记录：

```text
candidate UUID:
9d724526-bd22-45c8-97e4-df05280ae204

company_name:
Retail Display USA: Slatwall Displays & Retail Fixtures

website:
https://retaildisplayusa.com/
```

已 Promote 成正式 Lead：

```text
eb5ca404-e70a-4c7f-8551-add018490cd5
```

结果：

```text
timeout / ECONNABORTED
enrichment_status = failed
enrichment_error = request_failed
score = 20
grade = C
priority = low
```

用途：浏览器可访问但 n8n 服务器请求超时的负面样本。

不应反复延长超时、使用代理或绕过访问限制。

## 8.5 v0.1.4

文件：

```text
workflows/n8n/lead-enrichment-v0.1.4-single-lead-test-success-response-routing.json
```

解决问题：

- v0.1.3 把 HTTP 200 成功响应错误识别为 `request_failed`；
- n8n HTTP Request 的成功结构是：
  - `$json.data`：HTML
  - `$json.statusCode`：状态码；
- 需将 HTML 作为仅运行期字段 `homepage_html` 传给后续提取节点。

静态审查已通过：

- JSON 可解析；
- inactive；
- 无 credentials；
- 不使用 URL/new URL；
- Merge / Safe Update 会清除 `homepage_html` / `contact_page_html`；
- 数据库路径不保存 HTML、headers、cookies、stack 或原始响应对象。

已局部验证：

```text
Smurfit 首页：
homepage_accessible = true
homepage_http_status = 200
homepage_block_reason = null
homepage_html 仅在运行期存在
Extract Homepage Signals 可读取真实 HTML
```

但发现两个质量问题：

1. Contact 页选择错误；
2. 电话提取误报。

因此进入 v0.1.5。

## 8.6 v0.1.5（当前暂停点）

已由 Codex 创建本地文件：

```text
workflows/n8n/lead-enrichment-v0.1.5-single-lead-test-contact-selection-and-phone-quality.json
```

当前状态：

```text
已生成
未静态审查
未导入 n8n
未执行
未 Git 归档
```

Codex 声称修改节点：

```text
Find Same-Domain Contact Page
Extract Homepage Signals
Extract Contact Signals
Merge And Clean Result
Prepare Safe Lead Update
```

### v0.1.5 目标 A：Contact 页面选择修复

v0.1.4 错误选中：

```text
https://www.smurfitwestrock.com/products/packaging/food-contact
```

这是产品 / 行业页，不是公司联系页。

正确候选应为：

```text
https://www.smurfitwestrock.com/contact
```

应实施的规则：

```text
仅允许同 root domain
拒绝 javascript:
拒绝 mailto:
拒绝 tel:
拒绝 #
拒绝空 URL
拒绝外域
拒绝 social media
拒绝 investor / stock information

拒绝：
/products/
/product/
/solutions/
/industries/
/resources/
/news/
/blog/
food-contact
contact-packaging
contact-material
```

排序优先级：

```text
最高：
/contact
/contact-us
/contactus

次高：
/contact/
/contact-us/
label 精确为 Contact / Contact Us / Get in Touch / Request a Quote

较低：
label 包含 contact / quote / inquiry / get in touch
但必须不是产品、行业、资源或投资者页面

同分：
更短路径优先
无 query string 优先
根域 contact 页优先
```

输出应包含：

```text
contact_page_url_candidate
has_contact_page
contact_page_selection_reason
contact_page_candidates_considered
```

### v0.1.5 目标 B：电话误报修复

v0.1.4 从 Smurfit 首页提取了不可信纯数字，例如：

```text
2026052712
6391841788
8054744799
...
```

这些可能是日期、产品编号、脚本数字或追踪号，禁止作为电话写入。

规则：

```text
只接受类似：
+1 123 456 7890
(123) 456-7890
123-456-7890
123 456 7890
```

纯连续 8–12 位数字默认拒绝，除非：

```text
来源于 tel: 链接
或上下文明确有 Phone / Tel / Telephone / Call
```

每个候选电话应有：

```text
normalized_phone
source_url
extraction_context
confidence
```

只有：

```text
confidence = high
```

可进入回写候选。

中低置信度电话：

```text
仅运行期审查
不能进入 leads.phone
不能进入 raw_data.enrichment_v01
不能进入数据库其他字段
```

---

# 9. 当前正向测试样本：Smurfit Westrock

## 9.1 Candidate

Candidate UUID：

```text
8e3cef84-b403-4054-b36c-ebc72d54e876
```

已通过人工审核脚本改为：

```text
competitor_review
```

业务边界：

```text
同行 / 竞争方
仅允许作为 Lead Enrichment 正向技术测试样本
禁止真实外联、销售跟进、自动联系
```

审核脚本已创建、提交、推送并在服务器执行成功：

```text
scripts/manual/review-smurfit-westrock-for-enrichment-test.sql
```

## 9.2 正式 Lead

通过 Candidate Promotion v0.1 单条 Promote 后：

```text
Lead UUID:
cdabf717-3c57-4586-befa-c5ee66953547
```

公司名：

```text
Retail displays
```

网站：

```text
https://www.smurfitwestrock.com/products/retail-displays-and-signage/retail-displays
```

初始评分：

```text
score = 20
grade = C
priority = low
```

## 9.3 已完成局部测试

在 v0.1.4 已完成：

```text
Fetch Homepage
→ Detect Homepage Access Result
→ IF Homepage Accessible
→ Extract Homepage Signals
→ Find Same-Domain Contact Page
→ IF Contact Page Found
```

确认：

```text
HTTP 200
homepage_accessible = true
homepage_http_status = 200
homepage_block_reason = null
```

并发现：

- `Extract Homepage Signals` 能输出公司简介候选；
- 能找出多个 Contact 候选；
- 但选错了 `food-contact` 产品页；
- 电话候选被明显数字污染；
- 所以不应继续执行 v0.1.4 的 Contact 抓取与写库。

---

# 10. 当前最优先待办（P0）

**第一任务不是 v0.2 架构，也不是继续修改数据库，而是完成 v0.1.5 的正向闭环。**

## 10.1 下一步顺序

1. 让 Codex 对 v0.1.5 做只读静态审查；
2. 审查通过后，再导入 n8n；
3. 保持 inactive；
4. 在三个 PostgreSQL 节点手动重选原有 Credential：
   - Fetch One Lead
   - Update Lead Safely
   - Fetch Updated Lead
5. 在 `Set Test Lead UUID` 设置：
   ```text
   cdabf717-3c57-4586-befa-c5ee66953547
   ```
6. 先仅执行：
   ```text
   Fetch Homepage
   → Detect Homepage Access Result
   → Extract Homepage Signals
   → Find Same-Domain Contact Page
   → IF Contact Page Found
   ```
7. 验收：
   ```text
   contact_page_url_candidate =
   https://www.smurfitwestrock.com/contact

   has_contact_page = true
   ```
8. 验收首页电话：
   - 不应包含低置信度纯数字；
   - 不应误把日期 / ID / 跟踪号写入 `extracted_phones`；
9. 通过后继续：
   ```text
   Fetch Contact Page
   → Detect Contact Page Access Result
   → Extract Contact Signals
   ```
10. 在数据库回写前检查 Merge 结果；
11. 最后才执行：
   ```text
   Merge And Clean Result
   → Decide Enrichment Status
   → Prepare Safe Lead Update
   → Update Lead Safely
   → Fetch Updated Lead
   → Show Result
   ```
12. 用服务器 PostgreSQL 只读查询验证：
   - 不覆盖人工字段；
   - `raw_data.enrichment_v01` 不含 HTML / headers / cookies / stack；
   - enrichment 状态合理；
   - 自动评分 Trigger 正常；
   - score / grade / priority 是否变动合理。
13. 最终导出稳定 JSON、Git 归档、服务器同步。

## 10.2 v0.1.5 静态审查应要求 Codex 检查

```text
1. JSON 可解析；
2. active = false；
3. 无 credentials / API Key / password；
4. 不使用 new URL / URL / URLSearchParams / require('url')；
5. Contact 路径排序和排除规则正确；
6. 电话质量规则正确；
7. homepage_html / contact_page_html 只运行期存在；
8. Merge / Safe Update 明确删除 HTML、headers、cookies、response、stack；
9. Update Lead Safely 保留：
   WHERE id = $1::uuid
   参数化
   COALESCE / NULLIF
   无 DELETE / TRUNCATE / DROP / ALTER
10. 单 UUID、首页 + 最多一个同域 Contact 页、无自动触达。
```

---

# 11. 可视化后台与配置化目标

## 11.1 n8n 不是最终用户界面

n8n 是后台执行、调试与审计层。未来不应让用户通过改 n8n Code Node、SQL 或 PostgreSQL Trigger 调整业务规则。

最终应有：

```text
AI FT-OPC Dashboard
├─ Lead Center
│  ├─ Search Tasks
│  ├─ Candidate Leads
│  ├─ Formal Leads
│  ├─ Review / Promote
│  └─ Enrichment Status
│
├─ Lead Scoring Rules
│  ├─ 产品关键词
│  ├─ 国家权重
│  ├─ 行业权重
│  ├─ 公司属性权重
│  ├─ 联系方式加分
│  ├─ 风险 / 竞争方减分
│  └─ A/B/C 阈值
│
├─ Enrichment Center
│  ├─ 单条补全
│  ├─ 失败原因分布
│  ├─ Cloudflare / timeout / login 分类
│  ├─ 待人工审核
│  └─ 数据来源与处理时间
│
├─ Workflow Center
│  ├─ n8n 执行日志
│  ├─ 失败节点
│  ├─ 测试模式
│  └─ 工作流版本
│
├─ Sales / CRM
│  ├─ 客户标签
│  ├─ 跟进阶段
│  ├─ 询盘 / 报价
│  └─ 人工批准后的触达
│
└─ Settings
   ├─ Keyword / Weight Config
   ├─ 国家、行业、目标客户规则
   ├─ 用户与权限
   ├─ Agent / MCP 权限
   └─ 审计日志
```

## 11.2 评分配置化

当前评分主要硬编码在 PostgreSQL `score_lead_v01()` Trigger / 函数中，适合 v0.1 稳定验证。

未来应改为：

```text
Config UI
→ scoring_rules / keyword_rules / country_rules 等配置表
→ PostgreSQL 评分函数读取配置表
→ 自动重新评分
→ Lead 列表、等级、仪表盘变化
```

每次配置变更需要审计：

```text
修改人
修改时间
旧值
新值
影响多少 Leads
是否触发重新评分
```

## 11.3 正确开发顺序

```text
1. 完成 Lead Enrichment v0.1.5 正向闭环
2. 固化 Lead Agent v0.1 最终稳定版并归档
3. 建立 AI FT-OPC Lead Agent Safe Change Skill
4. 设计评分配置表与 migration 草案
5. 设计管理后台 MVP
6. 接入 SEO / Content / Sales / Analytics Agent
7. 形成客户可部署的 AI FT-OPC 产品
```

---

# 12. Codex、MCP、Plugins、Automations 路线

## 12.1 Codex 的定位

Codex 是本地项目中的开发执行 Agent：

```text
写 JSON / SQL / 文档 / 代码
做静态审查
做限定 Git 归档
```

Codex 不是：

```text
自动生产运维 Agent
未授权数据库写入 Agent
未授权服务器 Shell Agent
自动外联 Agent
```

## 12.2 优先建设的 Skill

第一个正式 Skill：

```text
ai-ft-opc-safe-change-review
```

它应在所有变更前检查：

```text
是否服务主体结构
是否模块化
是否影响 n8n / DB / Docker / Git
是否需要 migration
是否存在批量 / secrets / 自动触达风险
是否需人工批准
```

后续 Skills：

```text
n8n-workflow-static-review
database-migration-review
git-safe-archive
lead-enrichment-acceptance
server-sync-check
```

## 12.3 MCP 接入优先级

第一阶段：

```text
GitHub MCP
官方文档 MCP
本地项目文档 MCP
只读 PostgreSQL MCP
```

第二阶段：

```text
Playwright / Browser MCP
HTTP / Website inspection MCP
Google Drive / Notion MCP
CRM 只读 MCP
```

第三阶段（权限成熟后）：

```text
n8n MCP
PostgreSQL 写入 MCP
Docker / Portainer MCP
CRM 写入 MCP
邮件 / WhatsApp / LinkedIn MCP
```

原则：

```text
数据库 MCP 初期仅 SELECT
浏览器仅公开页面
不登录、不绕过验证
触达必须人工批准
服务器 / Docker / DB 写入必须权限分级与审计
```

## 12.4 Plugin 产品化

未来可以打包：

```text
AI FT-OPC Lead Agent Plugin
```

包括：

```text
Skills
MCP 配置
n8n 工作流
数据库规则
文档
审核机制
测试模板
```

未来模块：

```text
Lead Agent Plugin
SEO Agent Plugin
Website Content Plugin
Sales Follow-up Plugin
Analytics Plugin
```

## 12.5 Automations

初期只读提醒：

```text
每日 GitHub 同步检查
每周 Lead Agent 测试报告
每周 enrichment failed 原因分布
每日 candidate / review / promoted 数量汇总
n8n 工作流归档一致性检查
```

后期才考虑：

```text
自动创建 Issue
自动生成修复草案
自动跑测试
自动生成 PR
自动部署 / 自动触达最后才考虑
```

---

# 13. 常用安全命令模板

## 13.1 服务器 Git 同步

```bash
cd /opt/ai-opc

git status
git fetch origin
git log --oneline HEAD..origin/main

# 仅在 clean、无分叉后：
git pull --ff-only origin main
git status
git log --oneline -5
```

## 13.2 PostgreSQL 只读查询

```bash
cd /opt/ai-opc

docker compose --env-file configs/.env exec -T postgres \
  psql -U aiopc -d aiopc \
  -c "
SELECT ...
FROM public.some_table
WHERE id = '明确 UUID'::uuid;
"
```

## 13.3 执行已审查的单条 SQL 脚本

仅在：

```text
用户已明确批准
已同步 GitHub
已确认 UUID
SQL 已审查
脚本有明确 WHERE 条件
```

时执行：

```bash
docker compose --env-file configs/.env exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U aiopc -d aiopc \
  < scripts/manual/approved-script.sql
```

执行后必须立即 `SELECT` 复核。

---

# 14. 关键经验与质量标准

```text
1. 浏览器可打开 ≠ n8n 服务器可访问。
2. HTTP 200 ≠ 解析逻辑一定正确。
3. 文字有 contact ≠ 真正公司联系页。
4. 数字串 ≠ 电话号码。
5. 数据越多不等于数据越好；宁可少写，不可污染 Lead。
6. 所有对外行为默认停止，信息发现不代表允许触达。
7. 每个工作流版本先局部验证，最后才回写。
8. 只归档已验证版本；中间版本不要混入正式交付。
9. 未来目标不是 n8n 图，而是可配置、可审计、可交付的 AI OPC 平台。
```

---

# 15. 新对话的第一轮正确行动

新助手完成阅读后，应：

1. 用不超过 12 条要点总结对 AI OPC 主体结构与当前状态的理解；
2. 明确当前暂停点是 Lead Enrichment v0.1.5；
3. 给出 P0 最小行动清单；
4. 明确不在审查前导入、运行或写库；
5. 首先帮助生成 v0.1.5 的 Codex 静态审查提示；
6. 不要跳过 v0.1.5 直接讨论大规模 v0.2 改造。
