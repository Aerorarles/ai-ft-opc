# Lead Scoring v0.2 架构设计

版本：v0.2-beta-design-r2
日期：2026-07-01
状态：设计草案，供人工审核
适用范围：AI FT-OPC Lead Agent 的本地配置化评分内核、未来 shadow 运行、评分结果策略和后续数据库设计审查
禁止事项：不得执行数据库写入、migration、Trigger 修改、n8n 发布、Docker/服务器操作、Git 写操作、外部 API 调用或真实客户触达。

## 1. 当前边界

v0.1 仍是当前生产评分事实来源。现有生产评分逻辑负责正式 `leads.score`、`grade`、`priority` 的业务语义。

v0.2-beta 当前仅为本地 shadow-ready 评分内核，已具备 JSON 配置、配置校验、评分预览、解释输出和错误阻断能力，但不得写回正式评分字段，不得替换 v0.1。

历史上下文文档在当前终端读取时出现中文编码显示异常。本文不改写历史文档，不自行判断冲突优先级；如发现状态冲突，标记为“待用户确认”。

## 2. 核心逻辑链

```text
Lead
-> Feature Extraction
-> Config Validation
-> Rule Evaluation
-> Score Breakdown
-> Outcome Policy Preview
-> Preview / Snapshot
```

### 2.1 Lead

Lead 输入只应包含评分所需的结构化字段，例如公司名、网站、国家、行业、邮箱是否存在、电话是否存在和 signals。

不得把 HTML、headers、cookies、stack、完整响应体、API Key、credentials 或原始外部响应传入评分持久化路径。

### 2.2 Feature Extraction

Feature Extraction 将 Lead 转换为稳定特征：

- `has_email`
- `has_phone`
- `country`
- `industry_keywords`
- `signals`
- 其他允许字段摘要

正式字段优先使用 `company_name`，旧字段 `company` 仅作为兼容层。

### 2.3 Config Validation

配置校验在评分前执行，检查版本、metadata、权重、规则字段、operator、dimension、score_delta 和重复 rule id。

存在 validation errors 时不得计算正式分数，必须返回 `total_score = null` 和完整错误列表。

### 2.4 Rule Evaluation

规则计算只基于已声明字段和已校验配置。n8n 不负责评分规则计算，数据库也不应直接成为规则编辑界面。

### 2.5 Score Breakdown

评分输出保留四个维度：

- relevance
- trust
- capability
- risk

总分由配置权重聚合，不在代码中硬编码业务规则。

### 2.6 Outcome Policy Preview

Outcome Policy 负责把 `total_score` 映射为 `grade` 和 `priority`。当前阶段仅设计，不实现，不写回数据库。

grade / priority 的对比必须基于版本化 outcome policy。无法确定 policy 时，只允许输出 score diff，不得输出 grade / priority diff。

### 2.7 Preview / Snapshot

Preview 用于人工审核和 shadow compare。未来 Snapshot 用于保存一次评分运行的最小必要结果和解释摘要，不保存原始敏感数据。

## 3. 四维度定义

### 3.1 relevance

衡量 Lead 与目标产品、目标国家、目标行业和业务机会的相关性。

### 3.2 trust

衡量基础可联系性和可验证程度。风险减缓、验证增强或正向可信信号应进入 trust，而不是给 risk 正分。

### 3.3 capability

衡量供应、制造、服务或履约能力相关信号。当前 beta 只实现基础 signal 规则。

### 3.4 risk

衡量负向或需人工复核的风险信号。risk 规则默认 `score_delta <= 0`。

如果未来确需 risk 正分例外，必须通过审批，并在配置校验中用明确字段标记为例外，不得静默允许。

## 4. 未来评分边界

### 4.1 Lead Relevance Score

回答“这个对象是否值得作为目标 Lead 继续跟进”。当前 v0.2 只实现 Lead Scoring 基础能力，主要对应 Lead Relevance 的早期版本。

### 4.2 Verification Trust Score

回答“主体是否真实、稳定、可核验”。应独立于获客相关性，来源可能包括官网一致性、企业注册或第三方核验摘要。

### 4.3 Supplier Capability Score

回答“供应商是否具备制造、工艺、认证、产能、交付能力”。应作为供应商能力层，不等同于 Lead 价值。

### 4.4 Match Score

回答“买家需求与供应商能力是否匹配”。这是未来 Buyer-Supplier 双向平台的匹配层，不属于当前 v0.2 Lead Scoring 的实现范围。

## 5. 未来架构职责边界

### 5.1 n8n

n8n 是稳定流程执行层，适合触发单条或受控小批量评分预览、记录任务状态和生成审核队列。

n8n 不负责评分规则计算，不应让业务人员通过修改 n8n Code Node 维护评分规则。

### 5.2 PostgreSQL

PostgreSQL 是业务事实、配置版本、快照、审批和审计记录的持久化层。

数据库不应直接成为规则编辑界面。未来规则编辑应通过管理后台、权限控制和审批流程写入配置草稿。

### 5.3 管理后台

管理后台负责可视化配置、预览、差异比较、审批、激活和回滚。它不直接绕过校验写 active 配置。

### 5.4 AI Agent

AI Agent 可辅助解释规则、生成草案、汇总风险和建议调整，但不得自动批准、激活配置、写正式评分或触达客户。

## 6. 验收标准

- 明确 v0.1 是生产评分事实来源；
- 明确 v0.2-beta 仅 shadow-ready；
- 明确 Lead 到 Preview / Snapshot 的逻辑链；
- 明确 outcome policy 独立负责 grade / priority 映射；
- 明确 risk 默认非正 delta；
- 明确 n8n、PostgreSQL、管理后台、AI Agent 边界。

## 7. 风险

- 过早让 v0.2 写回正式评分会污染现有生产事实；
- 未版本化 outcome policy 会导致 grade / priority 差异比较失真；
- 把评分规则放在 n8n Code Node 或数据库手工编辑中会降低可审计性；
- 把 Trust、Capability、Match 混为单一分数会影响后续产品化。

## 8. 回滚原则

当前阶段只产生文档，不需要生产回滚。未来若接入数据库，应保留 v0.1 生产评分作为最终安全回退，并通过切换 active config version 和 active outcome policy version 指针回滚。

## 9. 下一步入口

进入 `LEAD-SCORING-V0.2-DATA-MODEL-DRAFT.md` 与 `LEAD-SCORING-V0.2-SCORING-POLICY-DRAFT.md` 进行概念模型与评分结果策略审核。未经用户批准，不进入 SQL 草案审查。
