# AI FT-OPC 最新主体架构、商业化路线与协作协议

> **文件名**：`AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md`
> **版本**：v1.0 — LATEST / 当前最高版本
> **更新时间**：2026-07-11
> **状态**：已由用户确认采用，作为后续项目推进的最高主体架构约束
> **适用对象**：ChatGPT、Codex、未来受控 Agent、开发者、运维人员、项目审查者
> **项目阶段**：Lead Agent v0.1 已封存；Phase 1 + Phase 2 本地产品化 MVP 已完成；Phase 3 安全架构已完成设计；当前进入 **M0 Architecture Freeze → M1 Production Data Foundation** 的商业化推进阶段。

---

# 0. 文档权威性与使用规则

## 0.1 本文件的地位

本文件整合并升级以下历史上下文：

1. `AGENT-START-HERE.md`
2. `AI-FT-OPC-project-handover.md`
3. `AI-FT-OPC-architecture-roadmap.md`
4. `AI-FT-OPC-MASTER-MEMORY.md`
5. `AI-FT-OPC-PHASE-3-安全架构设计-v0.1.md`
6. Lead Agent v0.1 / Lead Enrichment v0.1.7 的已验证事实
7. Phase 1 / Phase 1.5 / Phase 2 的本地产品化实现
8. 2026-07-11 确认的新主体架构与 Commercialization Roadmap

从本版本开始：

```text
本文件
= 主体架构
+ 产品边界
+ 商业化路线
+ 角色职责
+ Milestone Gate
+ 自动化协作协议
+ 安全审批原则
```

历史文件继续保留，用于：

```text
历史事实
具体实现细节
工作流版本
SQL / migration 历史
阶段验收记录
测试样本
故障经验
```

若发生冲突：

```text
1. 用户最新明确指令
2. 本文件最新版本
3. 更新日期更晚且已确认的专项设计
4. 历史项目文件
```

---

# 1. 项目长期定位

AI FT-OPC 不应被限制为：

```text
爬虫
获客工具
邮件群发器
n8n 工作流集合
Lead Scoring 工具
单一 AI Agent
```

项目长期定位为：

> **AI-powered B2B Sourcing & Trade Operations Platform**
> 面向跨境制造、采购、核验、获客、撮合与外贸运营的 AI 运营平台。

长期支持两个业务方向：

```text
方向 A：Sell-side / Export Growth

中国工厂
→ 发现海外买家
→ Candidate
→ Qualification
→ Enrichment
→ Scoring
→ Review
→ Sales Operations
→ Outreach
→ Opportunity
→ 成交


方向 B：Buy-side / Supplier Sourcing

海外买家 / 品牌 / 经销商
→ 提交采购需求
→ Supplier Discovery
→ Supplier Verification
→ Capability Assessment
→ Match Score
→ Human Review
→ RFQ
→ 沟通 / 报价
→ 撮合
```

Commercial v1.0 优先聚焦方向 A：

> **帮助中国 B2B 制造企业更高效地发现、筛选、理解并跟进潜在海外客户。**

方向 B 必须预留数据和模块边界，但不作为当前 Commercial v1.0 的阻塞条件。

---

# 2. 顶层设计原则

所有后续代码、工作流、数据库、UI、Agent 与商业功能都必须遵守以下原则。

## 2.1 Human-in-Control

```text
AI 负责：
发现
归纳
分析
建议
草案
解释
自动化执行低风险步骤

人工负责：
商业策略
高风险审批
客户关系
关键数据确认
真实外联授权
报价与商业承诺
```

AI 不拥有最终商业授权。

---

## 2.2 Agent 可替换，Control Plane 不可丢失

ChatGPT、Codex、OpenClaw、Claude Code、Hermes、未来模型都只是执行者或能力提供者。

真正需要长期沉淀的产品资产是：

```text
业务对象
状态
任务
策略
规则
审批
权限
审计
工作流
数据
历史
版本
```

因此：

```text
Agent 可以替换
模型可以升级
n8n 可以部分替换
外部 API 可以替换

但业务状态、审计、权限和数据事实必须持续存在
```

---

## 2.3 Database as Business Source of Truth

PostgreSQL 是业务事实源。

外部来源只能先成为：

```text
Source
Evidence
Signal
Candidate
```

不得直接自动成为：

```text
Verified Fact
Formal Lead
Trusted Contact
Approved Outreach Target
```

---

## 2.4 Candidate → Review → Promote 不得绕过

任何来源：

```text
Google / Serper
CSV
人工 URL
公开目录
社交媒体
工商数据
第三方 API
未来 Agent
```

都必须遵守：

```text
Source Item
→ Normalize
→ Dedup
→ Candidate
→ Review
→ Promote
→ Formal Business Object
```

---

## 2.5 n8n 是执行层，不是最终产品后台

n8n 的职责：

```text
编排
重试
定时
队列
失败分类
审批等待
调用 API
稳定业务流程
```

n8n 不负责：

```text
最终客户 UI
复杂权限管理
用户直接编辑业务规则
最终业务事实
完整商业后台
```

---

## 2.6 可解释优先于“看起来智能”

必须能够回答：

```text
为什么发现这家公司？
来源是什么？
为什么判定重复？
为什么评分变化？
为什么进入 Review？
谁批准了？
使用了哪一版规则？
发送了什么？
谁批准发送？
失败在哪里？
```

---

# 3. AI FT-OPC 最新主体架构

```text
┌──────────────────────────────────────────────────────────┐
│  L1 Human Control Plane                                  │
│  企业负责人 / Owner / Reviewer / Sales Approver         │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  L2 AI OPC Control Plane                                 │
│  Task / Policy / Approval / Permission / Audit           │
│  Agent Runtime / Workflow Trigger / Decision Context     │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  L3 Business Capability Layer                            │
│  Lead / Trust / Match / Sales / Content / Analytics      │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  L4 Execution & Integration Layer                        │
│  n8n / API / Queue / Scheduler / Worker / Adapters       │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  L5 Data & Trust Layer                                   │
│  PostgreSQL / Redis / Qdrant / Evidence / Audit / Config │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  L6 Product Experience Layer                             │
│  Web App / Operator Console / Client Portal / SaaS       │
└──────────────────────────────────────────────────────────┘
```

---

# 4. L1 — Human Control Plane

## 4.1 节点：Owner / 企业负责人

### 主要工作

```text
确定商业目标
选择目标产品 / 市场 / 行业
批准高风险操作
批准真实外联
批准生产 migration
批准权限升级
批准付费数据源
决定商业策略
```

### 不应承担

```text
手工修改数据库
手工编写 n8n Code Node
手工处理所有数据
手工部署每次代码更新
```

目标是让 Owner 从“操作员”逐步变成“审批者 + 决策者”。

---

## 4.2 节点：Operator

负责：

```text
查看 Candidate
处理异常
启动受控任务
维护业务数据
查看流程状态
```

---

## 4.3 节点：Reviewer

负责：

```text
Candidate Review
证据审查
Promote / Reject / Skip
评分差异审查
低置信度信息审核
```

---

## 4.4 节点：Sales Approver

负责：

```text
确认外联目标
确认渠道
确认消息版本
确认批次
确认发送上限
确认时间窗口
批准真实发送
```

---

## 4.5 节点：Admin

负责：

```text
用户
角色
权限
租户
配置
系统级审计
```

---

# 5. L2 — AI OPC Control Plane

这是未来 AI OPC 最重要的中枢层。

## 5.1 节点：Task / Job Manager

负责定义：

```text
任务是什么
输入是什么
输出是什么
当前状态
谁创建
谁执行
重试次数
超时
失败原因
```

典型任务：

```text
lead_intake
lead_enrichment
shadow_scoring
review_generation
crm_export
outreach_draft
approved_dispatch
```

---

## 5.2 节点：Policy Engine

负责系统级政策：

```text
哪些操作允许自动执行
哪些必须审批
哪些数据禁止保存
哪些来源允许访问
批次上限
速率限制
租户边界
渠道规则
```

Policy 不等同于 Lead Scoring Rule。

```text
Scoring Rule
= 业务评分

Policy
= 系统是否允许执行
```

---

## 5.3 节点：Approval Engine

统一管理：

```text
数据库高风险变更批准
CRM Export 批准
Outreach 批准
批量操作批准
付费查询批准
```

审批记录至少包含：

```text
approval_id
tenant_id
action_type
target_scope
channel
content_version
batch_limit
approved_by
approved_at
expires_at
status
```

---

## 5.4 节点：Permission / RBAC

角色：

```text
owner
operator
reviewer
sales_approver
admin
system_agent
```

未来所有 Agent 都必须拥有明确的：

```text
identity
role
scope
allowed_actions
denied_actions
```

不能因为“是 AI Agent”就默认拥有管理员权限。

---

## 5.5 节点：Audit Service

统一记录：

```text
谁
在什么时候
对什么对象
做了什么
为什么
使用什么 workflow / rule version
之前是什么
之后是什么
结果是什么
```

核心审计事件：

```text
source_captured
candidate_created
dedup_decided
score_computed
review_decided
lead_promoted
config_changed
crm_export_requested
crm_export_completed
outreach_draft_created
outreach_approved
outreach_blocked
outreach_sent
outreach_failed
suppression_added
```

---

## 5.6 节点：Agent Runtime / Agent Registry

管理：

```text
ChatGPT
Codex
未来专业 Agent
Agent 能力
Agent 版本
权限
输入输出 Contract
```

原则：

```text
Agent 是执行者
不是最终事实源
不是默认审批者
```

---

## 5.7 节点：Workflow Trigger / Orchestration

负责：

```text
任务依赖
DAG
事件
重试
Replay
暂停
继续
失败恢复
```

已有 Phase 1 / Phase 2 的 DAG scheduler、event stream、replay / audit 能力属于该节点的早期技术资产。

---

# 6. L3 — Business Capability Layer

## 6.1 Lead Intelligence

### 6.1.1 Source Intake

负责：

```text
CSV / Excel
Serper / Google 结果
人工 URL
合规目录
官方 API
未来 Social Signal
```

统一输出 Intake Contract。

---

### 6.1.2 Normalization

负责：

```text
公司名标准化
URL 标准化
域名标准化
国家 / 行业映射
字段类型校验
payload hash
```

---

### 6.1.3 Entity Resolution / Dedup

负责判断：

```text
是否已存在
是否同一家公司
是否同域
是否新 Candidate
是否需要人工复核
```

必须保留：

```text
deduplication_reason
matching_evidence
normalization_version
```

---

### 6.1.4 Candidate Intelligence

Candidate 是：

```text
已被发现
但尚未被业务确认
```

保存：

```text
来源
证据
标准化结果
去重结果
评分建议
风险
```

不能绕过 Review。

---

### 6.1.5 Lead Enrichment

当前已验证 v0.1.7。

负责：

```text
公开官网
最多受控页面
公司简介
公开联系方式
Contact 页面
公开联系人线索
```

硬边界：

```text
不登录
不绕过验证码
不绕过 Cloudflare
不抓取私密内容
不自动触达
不保存完整 HTML / Cookie / Header / Stack
不覆盖人工字段
```

---

### 6.1.6 Scoring

当前：

```text
v0.1 = Production Fact
v0.2 = Shadow
```

未来评分拆分：

```text
Lead Relevance Score
Verification Trust Score
Supplier Capability Score
Match Score
```

必须支持：

```text
配置版本
解释
Diff
Replay
输入快照
审计
```

---

## 6.2 Trust Intelligence

未来独立能力。

负责：

```text
工商主体
注册状态
企业存在性
公开风险信号
官网与主体一致性
认证
企业证据
```

数据来源可能包括：

```text
官方企业注册系统
授权商业数据库
企查查类服务
行业协会
认证机构
```

不能简单把“工商资料多”直接等同于高 Lead Score。

---

## 6.3 Match Intelligence

未来支持：

```text
Buyer Requirement
Supplier Capability
Product Requirement
Capability Matching
Match Explanation
```

用于方向 B：

```text
海外买家
→ 中国供应商发现与匹配
```

---

## 6.4 Sales Operations

### Review Queue

```text
open
in_review
approved
rejected
skipped
expired
```

### CRM Export

```text
Approved Lead
→ Preview
→ Approval
→ Export
→ Audit
```

### Outreach Drafting

AI 可以：

```text
生成邮件草稿
生成 LinkedIn 草稿
生成 WhatsApp 草稿
生成跟进建议
```

生成草稿 ≠ 已批准发送。

### Outreach Approval

必须明确：

```text
对象
渠道
消息版本
批次
上限
时间窗口
批准人
```

### Outreach Delivery

初期顺序：

```text
1. Draft + 人工发送辅助
2. CRM Task / CSV Export
3. 受控 Email API 单条 / 小批次
4. 再评估 WhatsApp / LinkedIn / Form
```

### Response / Suppression

负责：

```text
reply
bounce
unsubscribe
do-not-contact
suppression
stop rule
```

---

## 6.5 Content / Website / SEO

未来能力：

```text
Website Agent
SEO Agent
Content Agent
```

Commercial v1.0 不要求完整实现。

它们未来通过同一 Control Plane 接入：

```text
Task
Policy
Approval
Audit
```

---

## 6.6 Analytics

负责：

```text
Candidate → Lead 转化率
Source 质量
人工审核时间
Lead 质量
Enrichment 成功率
评分分布
外联结果
转化漏斗
成本
ROI
```

Analytics 应读取业务事实，不直接修改业务数据。

---

# 7. L4 — Execution & Integration Layer

## 7.1 n8n

推荐拆分：

```text
P3-01 Source Intake
P3-02 Normalize + Dedup
P3-03 Candidate Triage
P3-04 Shadow Scoring
P3-05 Review Queue Sync
P3-06 CRM Export Package
P3-07 Outreach Draft Generation
P3-08 Approved Outreach Dispatch
P3-09 Audit / Failure Report
```

共同要求：

```text
默认 inactive
JSON 无 credentials
每批有上限
可局部测试
失败可解释
无审批不外发
```

---

## 7.2 API Layer

负责：

```text
UI 访问
业务查询
受控命令
权限检查
审计上下文
```

API 不应直接绕过 Domain / Policy / Approval。

---

## 7.3 Queue / Scheduler / Worker

负责：

```text
异步任务
重试
延迟任务
定时任务
批次控制
失败恢复
```

Redis 可以承担：

```text
queue
cache
temporary coordination
```

---

## 7.4 External Adapter

统一适配：

```text
Search Provider
CRM
Email
Business Verification
Storage
Future Social API
```

所有 Adapter 必须：

```text
可替换
最小权限
失败隔离
可审计
不泄露 Secret
```

---

# 8. L5 — Data & Trust Layer

## 8.1 PostgreSQL

当前与未来承载：

```text
products
candidate_leads
leads
lead_source_items
lead_ingestion_runs
candidate_intelligence
shadow_scoring_runs
shadow_score_results
review_queue_items
crm_export_jobs
outreach_drafts
outreach_approvals
outreach_delivery_attempts
suppression_records
audit_logs
config_versions
```

未来双向平台：

```text
organizations
organization_profiles
organization_roles
buyer_requirements
supplier_capabilities
opportunities
verification_runs
verification_evidence
match_scores
match_explanations
```

---

## 8.2 Redis

负责：

```text
队列
缓存
任务协调
短期状态
```

不得成为最终业务事实源。

---

## 8.3 Qdrant

未来负责：

```text
产品知识
RAG
语义搜索
供应商 / 买家语义匹配
知识检索
```

Qdrant 结果仍需业务层校验。

---

## 8.4 Evidence Store

所有重要外部数据应保存：

```text
source_type
source_platform
source_url
captured_at
payload_hash
evidence_summary
evidence_confidence
```

---

# 9. L6 — Product Experience Layer

## 9.1 Overview

展示：

```text
Intake
Candidate
Review
Formal Lead
Shadow Score
Failure
Outreach
```

---

## 9.2 Candidate Center

负责：

```text
来源
证据
标准化
重复判断
评分建议
Review
Promote / Reject
```

---

## 9.3 Lead Center

负责：

```text
正式 Lead
Enrichment
评分
状态
历史
销售动作
```

---

## 9.4 Review Queue

统一处理：

```text
Candidate Review
评分差异
低置信度信息
CRM Export
Outreach Approval
```

---

## 9.5 Scoring Lab

负责：

```text
规则版本
解释
Replay
Compare
Shadow
```

---

## 9.6 Outreach Center

负责：

```text
联系人
草稿
审批
发送
失败
回复
退订
Suppression
```

---

## 9.7 Audit & Settings

负责：

```text
用户
角色
权限
规则
工作流版本
审计
租户
```

---

# 10. 当前已完成的技术资产

## 10.1 Lead Agent v0.1

已完成：

```text
产品 + 国家 + 行业
→ Search Task
→ Serper
→ candidate_leads
→ Triage
→ Review
→ Promote
→ leads
→ v0.1 PostgreSQL scoring
→ Lead Enrichment
```

---

## 10.2 Lead Enrichment v0.1.7

已封存并验证：

```text
单 UUID
公开官网
最多一个同 root domain Contact 页面
高质量信息提取
失败安全
人工字段保护
不保存敏感运行数据
无自动触达
```

---

## 10.3 Phase 1 + Phase 2 Local MVP

已具备：

```text
Lead Ingestion
Dedup
v0.1 official snapshot
v0.2 shadow scoring
Diff
Decision
Human Review Queue
Memory Persistence
PostgreSQL Adapter Draft
Local API
Static Workbench
```

---

## 10.4 Scoring Engine

已有：

```text
Config-driven Scoring
Explanation
Execution Context
Trace
Replay
Persistence Abstraction
Control Plane / API Facade
```

---

## 10.5 Orchestration

已有：

```text
DAG Scheduler
Event Stream
Replay
Audit Concept
Scoring Task Integration
```

---

## 10.6 Phase 3 Security Architecture

已完成设计：

```text
Real Data Intake
Shadow Persistence
Review
Controlled n8n
Dashboard
CRM Export
Outreach Draft
Approval
Dispatch
Audit
Suppression
```

尚未等同于生产完成。

---

# 11. 当前不可破坏的生产边界

```text
Candidate → Review → Promote 不能绕过

v0.1 score / grade / priority
仍是当前生产评分事实

v0.2 只能 Shadow
不得覆盖 v0.1

public.leads 人工字段保护继续有效

n8n 是执行层
不是最终后台

数据库是事实源

真实外联必须审批
```

---

# 12. 安全边界

## 12.1 Secret

禁止：

```text
读取 / 展示 / 提交 configs/.env
API Key
密码
Credential
Cookie
数据库数据卷
```

---

## 12.2 数据库

生产数据库变更必须：

```text
先 SQL
影响说明
索引说明
权限说明
Rollback SQL
审查
批准
再执行
```

禁止：

```text
DROP
TRUNCATE
未审查大范围 DELETE
未审查大范围 UPDATE
```

---

## 12.3 n8n

固定流程：

```text
设计
→ 静态审查
→ inactive 导入
→ 局部测试
→ 回写前检查
→ 单条 / 小批量验证
→ 导出 JSON
→ 去凭据
→ Git 归档
```

---

## 12.4 Git

默认精确文件范围。

禁止：

```text
git add .
git add -A
git commit -a
force push
```

出现：

```text
冲突
远程分叉
工作树异常
权限不确定
```

必须停止并报告。

---

## 12.5 External Outreach

未经明确批准，不允许：

```text
自动 Email
自动 WhatsApp
自动 LinkedIn
自动表单
自动报价
```

审批必须明确：

```text
渠道
对象 / 批次
内容版本
发送上限
时间窗口
```

---

# 13. Commercialization Roadmap

以后同时保留两种体系：

```text
Engineering Phase
= 技术实施编号

Product Milestone
= 商业成熟度编号
```

完成 Phase 3 不等于完成商业化。

---

# M0 — Architecture Freeze & Baseline

## 目标

```text
统一最高主体架构
统一商业化终点
盘点当前真实模块
建立 Gap List
冻结 v1.0 范围
```

## Deliverables

```text
本文件
Current System Map
Commercial v1.0 Scope
Gap Register
Engineering Workstream Mapping
```

## Exit Criteria

```text
所有后续 Agent 使用同一架构
不再并行发明新的顶层路线
v1.0 Must / Later / Not Now 明确
```

---

# M1 — Production Data Foundation

对应：

```text
P3.1
P3.2
```

## 目标

从：

```text
Local Memory MVP
```

升级为：

```text
Controlled Production Persistence
```

## 工作

```text
Intake Persistence
Candidate Intelligence
Shadow Scoring Persistence
Review Queue Persistence
Audit
Idempotency
Migration / Rollback
```

## Gate

```text
服务重启数据不丢
可按 run / entity / version 追溯
重复执行不产生污染
v0.2 不影响 v0.1
```

---

# M2 — Controlled Workflow Runtime

对应：

```text
P3.3
```

## 目标

形成：

```text
Source
→ Intake
→ Normalize
→ Dedup
→ Candidate
→ Shadow Score
→ Review Queue
→ Human Decision
```

## Gate

至少对受控真实数据完成完整链路验证。

不得：

```text
自动 Promote
自动外联
```

---

# M3 — Operator Product MVP

对应：

```text
P3.4
```

## 目标

Owner / Operator 不再依赖：

```text
PostgreSQL CLI
n8n 编辑器
Codex
```

完成日常业务操作。

## MVP 页面

```text
Overview
Candidate Center
Lead Center
Review Queue
Scoring Comparison
Audit
```

## Gate

用户可以通过 UI 完成：

```text
查看
审核
决策
追溯
```

---

# M4 — Internal Alpha

## 第一真实客户

用户自己的印刷工厂。

## 第一场景

```text
Custom Acrylic Display
United States
Retail / POP / Display
```

## 核心指标

```text
Candidate → Formal Lead
Qualified Lead Rate
Review Time
Enrichment Success
Source Quality
Failure Rate
```

---

# M5 — Sales Operations & Outreach Pilot

对应：

```text
P3.5
P3.6
```

## 顺序

```text
CRM Export
→ Draft
→ Approval
→ Suppression
→ Dry Run
→ Controlled Email
```

## Gate

极小规模真实闭环：

```text
5–20 个明确 Lead
→ Review
→ Draft
→ Approval
→ Email
→ Audit
→ Reply / Bounce / Unsubscribe
→ Suppression
```

---

# M6 — Product Hardening

## Security

```text
Authentication
RBAC
Tenant Isolation
Secret Management
Rate Limit
```

## Reliability

```text
Backup
Restore Test
Health Check
Monitoring
Alerting
Queue Recovery
```

## Operations

```text
Deployment
Upgrade
Migration
Rollback
Environment Separation
```

## Quality

```text
Integration Test
E2E Test
Permission Test
Failure Test
```

## Gate

完成恢复演练：

```text
服务故障
→ 恢复
→ 数据完整
→ 任务状态可解释
→ 审计保留
```

---

# M7 — Design Partner Beta

## 目标

```text
1–3 个真实外部客户
```

优先部署方式：

```text
Managed Single-Tenant
或
Private Deployment
```

而不是立即建设复杂 SaaS。

## 验证

```text
客户是否持续使用
是否产生 Qualified Leads
是否节省时间
系统是否需要频繁人工救火
客户是否愿意付费
```

---

# M8 — Commercial v1.0

## 商业产品定义

> **AI FT-OPC Lead Intelligence & Controlled Outreach Platform**

## v1.0 必须有

```text
Lead Source Intake
Candidate Management
Dedup
Enrichment
Scoring
Review
Formal Lead
Dashboard
Audit
CRM Export
Email Draft
Controlled Email Outreach
Suppression
```

## v1.0 不要求

```text
完整 SEO Agent
完整 Website Agent
完整 Content Agent
WhatsApp 自动化
LinkedIn 自动化
全球工商数据库
完整 Buyer-Supplier Marketplace
完全自主 Multi-Agent
完整 SaaS Billing
```

---

# 14. v1.0 Scope Control

## Must Build Now

```text
Production Persistence
Controlled Workflow
Dashboard
Review
Audit
CRM Export
Controlled Email Pilot
Security / Recovery
```

## Architecture Reserved

```text
Multi-tenant
Trust Intelligence
Match Intelligence
Buyer → Supplier
Social Signal
MCP
Additional Agents
```

## Not Now

```text
全自动销售 Agent
多渠道大规模自动外联
全平台社交抓取
复杂 Marketplace
全球企业数据聚合
```

---

# 15. ChatGPT ↔ Codex 新协作协议

从本版本开始，项目推进采用：

> **Semi-Autonomous Delivery Loop / 半自动持续交付循环**

目标：

```text
用户不再逐行指导 Codex

ChatGPT
→ 定义架构、任务包、验收和风险

Codex
→ 在受限范围内连续实现、测试、自审、产出报告

ChatGPT
→ 审查结果、发现架构偏差、决定下一任务包

用户
→ 只处理重要审批和商业决策
```

---

## 15.1 ChatGPT 的职责

```text
维护本主体架构
定义 Milestone
拆解 Work Package
定义 Acceptance Criteria
定义禁止事项
审查 Codex 报告
进行第二层架构审查
识别风险
生成下一步执行指令
```

---

## 15.2 Codex 的职责

在明确授权的本地工作树范围内，可以连续执行：

```text
读取项目非敏感文件
代码实现
单元测试
类型检查
本地 demo
静态审查
文档更新
生成 migration 草案
生成 n8n JSON 草案
生成测试报告
生成 diff summary
生成 progress report
```

---

## 15.3 Codex 默认不得自动执行

```text
读取 secrets
生产 DB 写入
migration 执行
服务器写操作
Docker / Portainer 生产操作
激活 n8n
真实外联
付费 API 消耗
危险 Git 操作
```

---

## 15.4 Work Package 结构

每次交给 Codex 的任务包必须包含：

```text
WORK PACKAGE ID
Milestone
目标
允许修改文件
禁止修改文件
安全边界
实施步骤
测试命令
验收标准
停止条件
输出报告格式
```

---

## 15.5 Codex Continuous Local Loop

在单个已批准 Work Package 内，Codex 可自行：

```text
Inspect
→ Plan
→ Implement
→ Test
→ Fix
→ Re-test
→ Static Review
→ Report
```

不需要用户对每一行代码单独确认。

但一旦遇到：

```text
需要扩大文件范围
需要生产 DB
需要 server / Docker
需要 Secret
需要真实外联
测试失败无法解释
发现架构冲突
Git 冲突
```

必须停止。

---

## 15.6 双层审核

### 第一层：Codex Self Review

输出：

```text
Changed Files
Tests
Risks
Known Limitations
Security Check
Architecture Check
```

### 第二层：ChatGPT Review

重点审查：

```text
是否符合主体架构
是否扩大 Scope
是否破坏 Candidate / Review 边界
是否影响 v0.1 Production Fact
是否存在权限或审计缺口
是否达到 Milestone Gate
```

---

# 16. 项目进度报告制度

Codex 每个 Work Package 完成后必须生成：

```text
docs/progress/
```

建议文件：

```text
M1-WP01-progress.md
M1-WP02-progress.md
M1-status.md
```

每份 Progress Report 包含：

```text
1. 当前 Milestone
2. 本次目标
3. 已完成
4. 修改文件
5. 测试结果
6. 未完成
7. 风险
8. 阻塞项
9. 是否需要用户批准
10. 推荐下一步
```

---

## 16.1 Milestone Status

每个 Milestone 保留一个状态：

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
READY_FOR_GATE
PASSED
```

---

## 16.2 建议统一状态文件

```text
docs/project-status/
AI-FT-OPC-CURRENT-STATUS.md
```

只记录：

```text
当前 Milestone
当前 Work Package
最近完成
当前阻塞
待批准事项
下一步
最新测试
```

避免所有 Agent 每次重新阅读全部历史才能知道“现在做到哪里”。

---

# 17. 关于“后台自动推进”的现实边界

理想目标：

```text
用户给商业目标
↓
ChatGPT 规划
↓
Codex 连续本地开发
↓
自动测试
↓
生成进度报告
↓
ChatGPT 审查
↓
进入下一 Work Package
```

当前必须明确：

```text
Codex App 是否持续运行
是否拥有本地工作树
是否能够连续执行
取决于 Codex 运行环境本身

ChatGPT 当前不能从本对话直接远程操控本地 Codex App
让它无限期在后台持续执行
```

因此当前最佳实施模式是：

```text
ChatGPT 生成 Master Execution Prompt / Work Package
↓
Codex 在本地连续完成已批准范围
↓
Codex 将结果写入项目文件 / Git
↓
ChatGPT 读取报告或 GitHub 结果
↓
进行第二层审查
↓
继续下一 Work Package
```

未来当 Agent Runtime / MCP / GitHub / CI 权限成熟后，可进一步升级为更自动化的闭环。

---

# 18. 推荐下一步

当前正式路线：

```text
M0 Architecture Freeze
→ 归档本文件
→ 更新 Agent Start Here 指向本文件
→ 生成 Current System Inventory
→ 生成 Commercial v1.0 Gap Register
→ 定义 M1 Work Packages
```

M1 第一批建议任务：

```text
M1-WP01
Current System Inventory & Interface Map

M1-WP02
Production Persistence Gap Analysis

M1-WP03
P3.1 Intake Adapter Local Implementation

M1-WP04
P3.2 Production Migration Draft

M1-WP05
Audit & Idempotency Foundation
```

在 M1 期间继续保持：

```text
不执行生产 migration
不写生产 DB
不激活生产 workflow
不真实外联
```

直到相应 Gate 和审批完成。

---

# 19. 新 Agent 标准启动方式

任何新的 ChatGPT / Codex / Agent 必须先阅读：

```text
1. AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md
2. AI-FT-OPC-CURRENT-STATUS.md（存在时）
3. 当前 Milestone / Work Package 文件
4. 必要时再查历史 handover / roadmap / master-memory / Phase 3 文档
```

启动后先输出：

```text
当前 Milestone
当前 Work Package
任务是否符合主体架构
影响范围
风险
是否需要审批
验收标准
停止条件
```

---

# 20. 最终目标

AI FT-OPC 的最终目标不是：

```text
拥有最多 Agent
拥有最多自动化
拥有最复杂架构
```

而是：

> **构建一个用户可以控制、企业愿意使用、数据可信、流程可审计、能够持续创造外贸业务价值并可商业交付的 AI 运营平台。**

当前主路径：

```text
Architecture Freeze
→ Production Data
→ Controlled Workflow
→ Operator Product
→ Internal Alpha
→ Outreach Pilot
→ Product Hardening
→ Design Partner Beta
→ Commercial v1.0
```

---

# 版本声明

```text
Version: v1.0-LATEST
Date: 2026-07-11
Status: CURRENT HIGHEST-LEVEL ARCHITECTURE
```

后续如更新：

```text
v1.1
v1.2
v2.0
```

必须记录：

```text
变更原因
架构影响
Milestone 影响
兼容性
迁移要求
```

旧版本不得直接覆盖删除，应保留历史归档。
