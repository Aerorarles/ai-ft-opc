# AI FT-OPC 主体架构、路线与长期上下文（Lead Agent v0.1 封存后）

> **用途**：供 ChatGPT、Codex 与未来受控 Agent 在继续 AI FT-OPC 项目前快速准确理解项目目标、架构边界、当前状态、接入顺序与安全要求。
> **权威性**：本文件是《AI FT-OPC 项目交接与长期上下文（最新版）》的后续补充。两份文件同时阅读；如有冲突，以更新日期更晚、且经用户确认的文件为准。
> **更新时间**：2026-07-01
> **当前阶段**：Lead Agent v0.1 已稳定闭环、归档并同步服务器；下一阶段为 v0.2 的**架构设计与审查**，尚未授权任何 v0.2 数据库、Docker、n8n 或服务器写操作。

---

## 0. 新对话启动指令

```text
你现在是我的 AI FT-OPC 项目协作助手。

请先完整阅读：
1. 《AI FT-OPC 项目交接与长期上下文（最新版）》；
2. 《AI FT-OPC 主体架构、路线与长期上下文（Lead Agent v0.1 封存后）》。

它们共同构成当前项目上下文。未阅读和理解前，不修改代码、数据库、Docker、n8n 工作流、Git 或服务器配置。

当前项目状态：
- Lead Agent v0.1 已完成稳定闭环、Git 归档与服务器同步；
- 允许开始 v0.2 的架构设计、数据模型草案、权限与审计设计；
- 未经用户明确批准，不执行 migration、数据库写入、Docker、服务器命令、n8n 发布、Git commit/push 或真实客户触达。

所有后续方案均必须检查：
是否服务 AI OPC 主体结构；
是否模块化可复用；
是否可维护、可审计、可人工审核；
是否为未来可视化、多租户、双向撮合与产品化保留正确边界。
```

---

## 1. 用户、业务与长期方向

### 1.1 用户与当前业务

用户经营中国印刷工厂，主营：

- 亚克力、纸张等材料的 UV 印刷；
- 丝网印刷；
- 展示、标识、POP、零售陈列类定制制造；
- 面向海外 B2B 市场拓展业务。

用户编程基础较弱，需要低风险、分步骤、可验证的指导。长期希望以“一人公司 + AI 助手矩阵”降低海外拓客、内容、网站、数据管理和外贸运营成本；未来可能雇佣 2–3 名外贸人员，但系统控制权始终保留在用户手中。

### 1.2 产品长期定位

不把项目局限为“中国工厂获客工具”，而定位为：

```text
AI-powered B2B sourcing and trade operations platform
面向跨境制造、采购、核验与撮合的 AI 运营平台
```

长期支持双向场景：

```text
A. 中国工厂 → 发现、筛选并服务海外买家
B. 海外买家 / 品牌 / 经销商 → 发现、核验并匹配中国工厂 / 供应商
```

---

## 2. AI OPC 主体结构（最高架构约束）

```text
人工 / 企业负责人
        ↓
AI FT-OPC 中枢
├─ ChatGPT
│  ├─ 战略、产品、架构、业务判断
│  ├─ 风险审查、验收标准、路线规划
│  └─ 生成给 Codex 的受限执行提示
│
├─ Codex
│  ├─ 本地项目工作树内写代码、JSON、SQL、文档
│  ├─ 静态审查、差异说明、受限 Git 操作
│  └─ 默认不读 secrets、不连接服务器、不写生产数据库
│
├─ n8n
│  ├─ 稳定、可视化、可审计的流程执行层
│  ├─ 搜索、筛选、Promote、Enrichment、报告、提醒
│  └─ 不作为最终客户管理后台
│
├─ PostgreSQL
│  ├─ 业务事实源：对象、状态、评分、审计、配置
│  ├─ 未来承载规则、权限、核验与多租户边界
│  └─ 不允许随意手工修改数据
│
├─ GitHub
│  ├─ 可审查版本归档
│  └─ 本地与服务器同步来源
│
├─ Docker / Portainer
│  └─ 运行环境与服务管理
│
├─ MCP（未来）
│  └─ 受控工具权限：文档、GitHub、浏览器、数据库、CRM 等
│
└─ 管理后台（未来）
   ├─ Lead / Buyer / Supplier Center
   ├─ Scoring / Verification / Matching Rules
   ├─ Workflow / Logs
   ├─ Review / Approval
   ├─ 权限与审计
   └─ 客户部署与多租户管理
```

核心原则：

```text
AI 负责发现、归纳、建议与草案；
n8n 负责稳定执行；
数据库负责业务事实与审计；
人工负责审批、商业判断、客户关系与外部行为。
```

每次设计或改动必须验证：

1. 是否服务 AI OPC 主体结构，而不是孤立修节点；
2. 是否能模块化复用到 Lead / SEO / Content / Sales / Analytics；
3. 是否可维护、可解释、可审计、可人工审核；
4. 是否为可视化后台、双向撮合、多租户和产品化留出正确边界。

---

## 3. 当前已完成：Lead Agent v0.1

### 3.1 已完成业务闭环

```text
产品 + 国家 + 行业
→ 创建搜索任务
→ Serper / Google 公开网页搜索
→ candidate_leads 候选库
→ 规则初筛
→ 人工审核
→ Promote 成正式 leads
→ PostgreSQL 自动评分
→ 单条 Lead Enrichment
→ 人工审核后决定下一步
```

### 3.2 Candidate 与 Formal Lead 的边界

```text
Candidate Lead
= 由公开来源发现的候选对象，未确认价值、真实性或适配性。

Formal Lead
= 经人工审核后允许进入正式业务系统、参与评分与后续人工跟进的对象。
```

任何来源（搜索、目录、社交媒体、人工导入、核验平台）都不能绕过 `Candidate → Review → Promote` 的控制点。

### 3.3 已验证的 Lead Enrichment v0.1.7

归档工作流：

```text
workflows/n8n/lead-enrichment-v0.1.7-single-lead-test-contact-candidate-quality-hardening.json
```

归档历史污染修正脚本：

```text
scripts/manual/fix-smurfit-westrock-enrichment-v0.1.7-history.sql
```

归档 Git 提交：

```text
b0aafb87e7daffdfb3f9e0f6ba5a8e9f599b9d39
feat(lead-enrichment): archive verified v0.1.7 workflow
```

已完成并验收：

```text
手动 UUID 触发
→ 公开官网页面
→ 最多一个同 root domain Contact 页面
→ 提取公司简介、公开邮箱、公开电话、联系人线索
→ 只补空字段
→ 回写 enrichment 状态与 raw_data.enrichment_v01
→ 既有 PostgreSQL Trigger 自动评分
```

安全能力已验证：

- Cloudflare 403、timeout 等失败安全分类；
- 正确选择 `/contact`，拒绝产品页、投资者页、外域、伪链接；
- 纯连续数字不作为电话写入；
- 仅高置信度电话才允许进入写入候选；
- 产品、导航、面包屑、品牌、部门标签不作为联系人姓名/职务；
- 无高质量信息时返回空值并标记 `partial`，而不是制造假数据；
- 不覆盖人工字段；
- 不保存 HTML、headers、cookies、stack 或原始响应对象；
- 无自动邮件、表单、WhatsApp、LinkedIn 或其他触达；
- 归档 JSON inactive 且无 credentials。

### 3.4 已修正的历史污染样本

Smurfit Westrock 技术正向测试样本：

```text
Lead UUID:
cdabf717-3c57-4586-befa-c5ee66953547
```

该记录仅用于技术验证，属于 competitor_review 范围，禁止真实外联、销售跟进或自动联系。

已单独、严格条件修正 v0.1.4 遗留污染：

```text
phone: 2026052712 → NULL
contact_name: Packaging Industrial → NULL
contact_page_url:
.../products/packaging/food-contact
→ https://www.smurfitwestrock.com/contact
```

最终 v0.1.7 回写验收状态：

```text
enrichment_status = partial
enrichment_error = NULL
email = NULL
phone = NULL
contact_name = NULL
contact_title = NULL
contact_page_url = https://www.smurfitwestrock.com/contact
score = 20
grade = C
priority = low
raw_data.enrichment_v01 不含 HTML / headers / cookies / stack / response
```

### 3.5 环境与仓库

本地项目：

```text
C:\\Users\\Jklee\\Documents\\ai-ft-opc
```

服务器项目：

```text
/opt/ai-opc
```

GitHub：

```text
git@github.com:Aerorarles/ai-ft-opc.git
branch: main
```

服务器服务曾正常运行：

```text
aiopc-n8n
aiopc-postgres
aiopc-qdrant
aiopc-redis
```

服务实时状态必须通过实时命令验证，不依赖历史记忆。

---

## 4. 当前优点、限制与风险

### 4.1 已建立的优点

1. **没有过早自动外联**：系统先做发现、筛选、补全与人工审核。
2. **数据质量优先**：接受“无结果”而不是将垃圾数据写入 Lead。
3. **有清晰状态边界**：Candidate、Review、Promote、Lead、Enrichment 可追溯。
4. **人工字段保护有效**：公开爬取结果不随意覆盖人工确认数据。
5. **版本和回滚意识成熟**：本地审查 → 局部验证 → 单条回写 → Git 归档 → 服务器 fast-forward 同步。
6. **业务执行与最终产品界面分离**：n8n 是执行层，不是用户后台。
7. **未来平台化边界清楚**：评分、审计、权限、后台、MCP 都有明确方向。

### 4.2 当前限制

1. 评分主要硬编码于 PostgreSQL `score_lead_v01()`，不适合长期由业务人员配置。
2. Contact 页、电话、联系人规则仍主要存在于 n8n Code Node，不适合最终用户直接维护。
3. Enrichment 当前只适合单条、人工触发验证；不应直接扩展为大规模抓取。
4. Lead 来源当前以 Google / Serper 公开网页为主，来源多样性尚不足。
5. 尚无管理后台、多租户、权限系统、配置审计、批量质量监控。
6. 尚未实现双向 Buyer–Supplier 数据模型与 Match Score。

### 4.3 已形成的关键经验

```text
浏览器能打开 ≠ n8n 服务器可访问
HTTP 200 ≠ 解析逻辑正确
页面出现 contact ≠ 真正公司 Contact 页面
数字串 ≠ 电话号码
更多数据 ≠ 更高质量数据
来源信息 ≠ 已验证业务事实
自动化成功 ≠ 可安全写入数据库
```

---

## 5. v0.2：当前允许做什么、不允许做什么

### 5.1 当前允许

v0.2 当前仅允许：

- 架构设计；
- 数据模型与字段草案；
- 评分配置化方案；
- 权限、审计、回滚设计；
- 管理后台 MVP 信息架构；
- Safe Change Skill 规则设计；
- MCP 最小权限接入规划；
- 文档、只读静态审查、原型说明。

### 5.2 当前未经批准不得做

未经用户明确批准，禁止：

- 修改数据库 schema、执行 migration；
- 修改或替换现有评分 Trigger；
- 导入、发布、激活新 n8n workflow；
- 批量 Enrichment；
- 自动外联、邮件、WhatsApp、LinkedIn、表单、报价；
- Docker、Portainer、服务器配置变更；
- Git commit、push、pull、merge、rebase、reset；
- 接入付费企业信息源并实际消耗额度；
- 接入社交媒体批量采集或绕过平台限制。

---

## 6. v0.2 的优先开发顺序

```text
1. Lead Scoring 配置化的业务边界与规则模型
2. 配置表草案、权限审计、变更影响与回滚设计
3. 管理后台 MVP 信息架构
4. AI FT-OPC Safe Change Skill 规则与模板
5. MCP 第一阶段最小权限、只读接入规划
6. 再评估 Social Signal Intake 与企业核验层的最小可行接入
```

### 6.1 评分配置化目标

当前：

```text
硬编码评分函数 / Trigger
```

未来：

```text
Config UI
→ scoring_rules / keyword_rules / country_rules 等配置表
→ PostgreSQL 评分函数读取配置
→ 自动重新评分
→ Lead 列表、等级、优先级、仪表盘变化
```

评分配置变更必须包含：

```text
修改人
修改时间
旧值
新值
适用租户 / 业务范围
受影响 Lead 数量
是否触发重新评分
变更审批状态
回滚记录
```

### 6.2 评分维度应逐步拆分

不要长期只保留单一 `score`。未来逻辑上拆为：

```text
Lead Relevance Score
= 是否与目标产品、市场、行业和商业机会相关

Verification Trust Score
= 主体是否真实、稳定、可核验

Supplier Capability Score
= 工艺、材料、产能、MOQ、认证、案例、交期等能力

Match Score
= 买家需求与供应商能力之间的适配程度
```

各维度不可混淆。工商核验结果不应直接替代获客相关性评分。

---

## 7. 长期双向平台数据模型方向

当前 `leads` 合理，但未来不能将买家、供应商、工厂、需求和撮合全部塞进 Lead 表。

建议逐步演化：

```text
organizations
organization_profiles
organization_roles
buyer_requirements
supplier_capabilities
products
certifications
markets
opportunities
match_scores
match_explanations
verification_runs
verification_evidence
audit_logs
```

组织角色可以包括：

```text
buyer
supplier
manufacturer
trader
distributor
brand
retailer
agent
competitor
```

未来两条业务路径：

```text
中国工厂找海外客户：
Factory Profile
→ Buyer Discovery
→ Candidate Qualification
→ Lead Relevance Score
→ Human Review
→ Sales Follow-up

海外买家找中国工厂：
Buyer Requirement
→ Supplier Discovery
→ Supplier Verification
→ Capability / Trust / Match Score
→ Human Review
→ RFQ / 沟通 / 报价
```

### 7.1 多租户与数据隔离（必须预留）

未来面向不同工厂、海外买家和平台运营人员时，必须支持：

```text
tenant_id
organization_id
user_id
role
data_scope
audit_log
```

至少要明确三类数据：

```text
平台公共数据
客户私有数据
撮合后经授权可共享的数据
```

严禁不同工厂、买家或平台客户默认互相看到其 Lead、供应商资料、评分规则、付费核验结果或内部审核记录。

---

## 8. 社交媒体来源：未来的 Social Signal Layer

### 8.1 定位

社交媒体不是可直接信任的正式企业数据库，而是：

```text
Social Signal Source
= 弱信号、活跃度、产品能力、案例、采购/供货意图与圈层关系来源
```

官网、企业目录、注册信息更适合确认主体；社交媒体适合发现与补强证据。

### 8.2 建议数据流

```text
Source Item
（一条公开帖子、视频、账号页、人工提交 URL）
→ Signal Extraction
（产品、地区、能力、意图、联系方式线索、活跃度）
→ Entity Resolution
（与官网、既有 Lead、Supplier、域名、电话、名称去重）
→ Candidate Organization
→ Human Review
→ Formal Lead / Buyer / Supplier
```

不要将一条帖子、一个视频或一个账号直接视作正式公司。

### 8.3 可承担的角色

```text
发现型：
发现官网弱或没有官网的小工厂、小品牌、小采购商。

验证型：
用公开产线视频、案例、参展内容、员工信息交叉验证公司能力和真实性。

意图型：
识别“找代理、支持 OEM/ODM、参展、找供应商、新品、采购需求”等近期商业信号。
```

### 8.4 合规边界

允许：

```text
官方 API
平台授权数据
用户主动授权数据
人工提交的公开 URL
合法公开、有限、非绕过式页面分析
```

禁止：

```text
登录后批量抓取
绕过验证码、Cloudflare 或反爬
代理池规避平台限制
抓取私密内容
批量抓取评论、私信
自动私信、自动评论、自动加好友
```

### 8.5 推荐接入顺序

```text
v0.2：
仅预留 source_type、source_platform、source_url、evidence_summary、evidence_confidence、source_captured_at 等字段逻辑。

后续最小版 Social Signal Intake v0.1：
人工粘贴公开 URL
→ AI 提取公开页面摘要
→ 生成候选信号
→ 人工审核
→ 决定是否进入 Candidate

最后才评估：
按平台授权和条款接入更自动化的官方 API 或合规数据源。
```

不要将抖音、小红书、TikTok、LinkedIn 等平台的“全量信息流抓取”作为近期目标。

---

## 9. 企业工商与可信度核验：未来的 Trust Intelligence Layer

### 9.1 定位

未来可加入中国与海外企业登记、工商、商业情报、认证、贸易或协会数据来源，但应作为独立能力：

```text
Business Verification / Trust Intelligence
企业主体核验与可信度情报层
```

它回答：

```text
这家公司是否真实存在？
主体是否存续？
是制造商、贸易商、品牌方还是经销商？
经营多久？
官网、社交媒体和注册信息是否一致？
是否存在公开风险信号，需要人工复核？
```

### 9.2 不要直接塞入 Lead 或 Supplier 表

建议独立数据模型：

```text
verification_sources
organization_verifications
verification_runs
verification_evidence
verification_signals
verification_reviews
```

建议字段概念：

```text
organization_id
source_provider
source_country
source_type
source_record_id
legal_name
registration_number
legal_status
incorporation_date
registered_address
legal_representative
beneficial_owner_summary
industry_code
risk_flags
source_captured_at
source_confidence
evidence_hash
review_status
reviewed_by
reviewed_at
```

每项证据都必须记录来源、时间、适用许可与可信度，不能混成“绝对事实”。

### 9.3 使用边界与评分原则

核验信号只能辅助人工复核，不得自动断言某公司“可靠”或“不可靠”。

推荐拆分：

```text
Lead Relevance Score
Verification Trust Score
Supplier Capability Score
Match Score
```

不能因为工商资料较多就简单加高 Lead Score；也不能因某公开风险数据不完整就自动拒绝。

### 9.4 付费与授权数据的安全原则

未来可考虑合规接入中国商业数据服务、海外官方注册系统或授权商业数据库。但必须：

```text
先确认服务条款、授权范围、地区覆盖、费用模式、再分发限制
API Key 仅放受控 Secret / Credential 管理
不得进入 Git、workflow JSON、数据库审计摘要或前台页面
每次查询记录发起人、数据源、额度/费用、结果摘要、审核状态
付费结果不得默认跨租户共享
```

### 9.5 推荐接入顺序

```text
阶段 1：
人工输入公司名 / 官网 / 注册号
→ 记录“待核验”
→ 人工填写或上传核验摘要
→ 不自动查询

阶段 2：
接入一个低风险、官方或明确授权的数据源
→ 单条查询
→ 保存最小必要摘要
→ 人工审核

阶段 3：
接入中国商业数据源或合规开放平台
→ 配额、费用、权限与审计
→ 单条或小批量核验

阶段 4：
按目标市场建立国家适配器
→ 标准化字段映射
→ 统一 Trust Score
```

---

## 10. 哪些工作最适合 AI Agent 提效

### 10.1 ChatGPT：战略、判断、审查

适合：

```text
模块拆分
业务流程与状态机设计
数据库边界
验收标准
风险审查
评分规则与后台逻辑
数据质量复盘
给 Codex 的受限操作提示
```

### 10.2 Codex：本地受限开发执行

适合：

```text
工作流 JSON 草案
静态审查
SQL migration 草案
手动 SQL 脚本
文档
差异分析
受限 Git 归档
```

默认不适合：

```text
服务器运维
未授权数据库写入
读取 secrets
自动外联
无审批的生产变更
```

### 10.3 n8n：稳定、重复、可审计流程

适合：

```text
搜索任务
Lead 去重
Candidate 初筛
人工审核提醒
单条 / 未来受控小批量 Enrichment
失败分类
每周统计报告
工作流归档一致性检查
```

### 10.4 AI 审核辅助：高价值、低风险方向

优先考虑：

```text
Candidate 相似公司去重建议
相关性初筛与审核队列排序
Lead 研究摘要卡片
Enrichment 失败原因分布
每周 Lead 质量报告
公开官网 / 社交 URL 的结构化摘要
Buyer / Supplier / Competitor 类型建议
核验信息一致性检查建议
```

AI 不应自动：

```text
删除 Lead
触达客户
报价
修改评分规则
写生产数据库
发布工作流
消耗付费核验额度
```

---

## 11. 安全与变更规则（持续有效）

### 11.1 默认禁止，需用户明确批准

- 读取、展示、复制、提交 `configs/.env`、API Key、密码、Credentials、数据库数据卷；
- Docker、服务器、数据库 migration、生产数据库写入；
- Git commit、push、pull、merge、rebase、reset；
- n8n workflow 发布或激活；
- 自动或真实客户触达；
- 付费数据源真实查询与额度消耗；
- `rm -rf`、`docker compose down`、`docker system prune`、`DROP`、`TRUNCATE`、大范围 `DELETE`、未审查批量 `UPDATE`。

### 11.2 数据库变更要求

每次 schema 或数据变更必须：

```text
先给 SQL
→ 说明影响范围
→ 说明回滚建议
→ 等待用户确认
→ 最小范围执行
→ 立即只读复核
```

必须优先：

```text
WHERE id = ...
状态条件
参数化
RETURNING
```

### 11.3 n8n 变更要求

```text
先给可审查设计
→ 静态审查
→ 导入但 inactive
→ 逐节点局部验证
→ 回写前审查
→ 单条验证
→ 导出最终 JSON
→ 移除 credentials
→ Git 归档
```

### 11.4 Git 与服务器同步顺序

仅在用户批准 Git 操作时：

```bash
# 本地
git status --short
git fetch origin
git log --oneline HEAD..origin/main
# 精确 git add -- 指定文件
git diff --cached --check
git diff --cached --name-only
git commit ...
git push origin main
```

服务器同步固定：

```bash
cd /opt/ai-opc
git status
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
git status
git log --oneline -5
```

若服务器工作树不干净、远程分叉、冲突或异常，停止，不自行 rebase、merge 或 reset。

---

## 12. 最后的战略判断

当前阶段最重要的不是继续堆叠更多 Agent，而是将已验证的 Lead Agent 升级为：

```text
可配置
可审计
可视化
可安全迭代
可被员工使用
未来可按租户隔离
未来可服务买家与供应商双边场景
```

长期护城河不只是“找到公司”，而是：

```text
发现企业
→ 结构化事实
→ 多来源证据
→ 信任核验
→ 能力与需求匹配
→ 人工可解释审核
→ 可审计的跨境 B2B 决策与运营
```
