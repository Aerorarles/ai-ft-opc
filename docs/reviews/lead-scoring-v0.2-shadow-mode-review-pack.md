# Lead Scoring v0.2 Shadow Mode 审查包

版本：v0.1
日期：2026-07-02
状态：只读审查与最小设计完成
适用范围：PostgreSQL / n8n / Lead Agent v0.1 本地事实审查与 v0.2 shadow mode 最小落地设计
禁止事项：未执行 SQL，未连接数据库，未修改 n8n，未读取 secrets，未执行 Git 写操作。

## 1. 本次只读审查结果摘要

可确认：

- 本地仓库存在 `public.leads` 基础 schema 草案；
- 本地 migration 中存在 `score_lead_v01()` 与 `leads_score_v01` trigger 草案；
- v0.1 正式评分字段为 `score`、`grade`、`priority`，并有 `lead_score_breakdown` 与 `last_scored_at`；
- Lead Enrichment v0.1.7 本地 JSON 为 inactive，单条手动触发，不包含实际 `credentials` 字段；
- 本地 n8n JSON 均为 `active=false`；
- 早期若干 n8n JSON 包含 `credentials` 字段键名，本次未读取或输出其内容；
- v0.2-v0.7 本地 scoring engine 已具备 config-driven scoring、validation、explanation、trace、replay、API facade；
- baseline scoring demo 输出 `total_score=21`；
- Orchestration x Lead Scoring 本地集成可通过 orchestration task 调用 `scoreLeadAPI()` 并保存脱敏摘要。

无法确认：

- 实时 PostgreSQL 是否已执行全部 migration；
- 实时 trigger/function/table 是否与仓库一致；
- 实时是否存在额外 audit/log/run/config/rule/scoring snapshot 表；
- 实时 n8n 实例中 workflow 与 credentials 状态；
- 生产环境是否已存在 tenant / organization / user 相关字段。

## 2. v0.2 shadow mode 设计摘要

最小方案：

- 新建独立 shadow run/result/diff/explanation 表；
- v0.2 只保存 shadow score 与脱敏 explanation；
- 与 v0.1 `score` 做 diff；
- 不写 `leads.score`、`leads.grade`、`leads.priority`；
- 不改 v0.1 trigger/function；
- n8n 以独立 inactive workflow 旁路运行；
- 先单条 Lead 手动验证，再申请小批量。

## 3. 文件清单

本次新增：

- `docs/reviews/postgres-n8n-v01-readonly-fact-review.md`
- `docs/LEAD-SCORING-V0.2-SHADOW-MODE-MINIMAL-DESIGN.md`
- `docs/reviews/lead-scoring-v0.2-shadow-mode-review-pack.md`

## 4. 本次是否执行写操作

仅创建文档文件。

未执行：

- 数据库写入；
- SQL；
- migration；
- Trigger 修改；
- n8n 修改；
- Docker / 服务器操作；
- Git 写操作；
- 外部 API 调用。

## 5. 是否读取 secrets

否。

未读取：

- `configs/.env`
- Credentials 内容
- API Key
- Cookie
- 数据卷
- 数据库连接串

## 6. 是否连接数据库

否。

本次 PostgreSQL 结论来自本地 SQL 文件，不是实时数据库 introspection。

## 7. 是否修改 n8n

否。

仅只读解析本地 `workflows/n8n/*.json`。未导入、未发布、未激活、未执行 workflow。

## 8. 是否运行外部 API

否。

本地验证仅运行 npm scripts。

## 9. 下一阶段必须由用户明确批准

- 是否允许只读连接 PostgreSQL 做 metadata 审查；
- 是否允许将 SQL 草案整理为正式 migration draft；
- 是否允许设计 n8n shadow workflow JSON；
- 是否允许导入 n8n 但保持 inactive；
- 是否允许单条 Lead shadow run；
- 是否允许小批量 shadow run；
- 是否允许 Git 暂存、提交、推送。

## 10. 风险等级

风险等级：中。

主要风险：

- shadow 结果被误当作正式评分；
- 误写 `public.leads` 正式评分字段；
- n8n 旁路误接入生产路径；
- 未记录 config checksum / engine version 导致 diff 不可追溯；
- 早期 workflow JSON 中 credentials 字段需要后续归档脱敏审查。
