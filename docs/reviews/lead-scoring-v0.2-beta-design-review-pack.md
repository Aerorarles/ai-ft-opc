# Lead Scoring v0.2-beta 设计审查包

版本：v0.2-beta-design-review-r2
日期：2026-07-01
状态：人工审核包，待用户确认
适用范围：Lead Scoring v0.2-beta 本地实现、配置、设计文档、评分结果策略和下一阶段审批入口
禁止事项：不得执行数据库写入、migration、Trigger 修改、n8n 导入/发布/激活、Docker/服务器操作、Git 写操作、外部 API 调用或真实客户触达。

## 1. 当前实现文件清单

本地评分内核：

- `scoring-engine/src/types.ts`
- `scoring-engine/src/features.ts`
- `scoring-engine/src/rules.ts`
- `scoring-engine/src/config.ts`
- `scoring-engine/src/engine.ts`
- `scoring-engine/src/preview.ts`
- `scoring-engine/src/example.ts`
- `scoring-engine/src/preview-example.ts`
- `scoring-engine/src/test-cases.ts`

配置文件：

- `scoring-config/v1.json`
- `scoring-config/v1-invalid.json`

本轮未修改上述代码或 JSON。

## 2. 当前本地测试结果摘要

沿用上一轮本地 bundled Node 验证结果：

- `example.ts`：通过，`total_score = 21`；
- `preview-example.ts`：通过，生成固定模板中文摘要；
- `test-cases.ts`：15 项通过。

本轮仅补强设计文档，未重新运行或修改测试。

## 3. v1.json 配置摘要

配置版本：`v1`

权重：

- relevance：0.5
- trust：0.2
- capability：0.3
- risk：0.2

规则：

- `keyword-display`：industry_keywords contains display，relevance +20；
- `country-target-markets`：country in US/UK/DE，relevance +10；
- `contact-email-exists`：has_email exists，trust +15；
- `signal-factory`：signals contains factory，capability +10；
- `risk-wordpress`：website contains wordpress，risk -10。

## 4. v1-invalid.json 覆盖的校验错误类型

故意无效配置覆盖：

- 重复 rule id；
- 非法 operator；
- 负 weight；
- `operator = in` 但 value 不是数组；
- 未知 field。

预期行为：

- `is_valid = false`；
- `scoreLead` 不计算正式分数；
- `total_score = null`；
- 返回完整 validation errors；
- 不抛出未捕获异常；
- 不使用默认规则继续评分。

## 5. 本轮补齐内容

本轮设计补强新增或明确：

- scoring_outcome_policies 概念实体；
- total_score 到 grade 的映射；
- total_score 到 priority 的映射；
- A/B/C 阈值；
- high/medium/low 阈值；
- 规则版本与 outcome policy 的绑定关系；
- 不同租户可使用不同 outcome policy；
- outcome policy 发布后不可直接编辑，只能复制为新 draft；
- total score 和维度分数边界；
- clamp 策略；
- rounding mode；
- 空规则、无命中规则、全部风险规则命中的预期行为；
- rule_value_normalized 与 rule_value_summary 分离；
- config_schema_version、engine_version、config_checksum、canonical_config_snapshot；
- 历史评分可重放要求；
- risk 规则默认 `score_delta <= 0`；
- risk 正分例外必须审批；
- shadow diff 必须记录 config/outcome/engine 版本与 checksum；
- 无 outcome policy 时不得输出 grade / priority diff。

## 6. 本次新增或更新设计文档清单

- `docs/LEAD-SCORING-V0.2-ARCHITECTURE-DESIGN.md`
- `docs/LEAD-SCORING-V0.2-DATA-MODEL-DRAFT.md`
- `docs/LEAD-SCORING-V0.2-PERMISSION-AUDIT-AND-ROLLBACK.md`
- `docs/LEAD-SCORING-V0.2-SHADOW-ROLLOUT-PLAN.md`
- `docs/LEAD-SCORING-V0.2-SCORING-POLICY-DRAFT.md`
- `docs/reviews/lead-scoring-v0.2-beta-design-review-pack.md`

## 7. 本次明确未涉及的内容

本次仍未涉及：

- 数据库连接；
- 数据库写入；
- SQL 编写；
- migration；
- PostgreSQL Trigger；
- PostgreSQL 函数；
- n8n 导入、发布、激活或修改；
- Docker；
- 服务器命令；
- Git 写操作；
- secrets；
- configs/.env；
- Credentials；
- API Key；
- Cookie；
- 数据卷；
- 外部 API；
- scoring-engine 代码；
- scoring-config JSON；
- 真实客户触达。

## 8. 下一阶段需要用户明确批准的事项

下一阶段仍是“SQL 草案审查”，不是执行。

进入 SQL 草案前，必须由用户明确批准：

- 是否接受本轮补强后的设计包；
- 是否允许进入 SQL 草案审查；
- 是否允许把 scoring_outcome_policies 纳入 SQL 草案；
- 是否允许把 config checksum / canonical snapshot 纳入 SQL 草案；
- 是否允许设计 shadow snapshot 存储；
- 是否允许设计管理后台 MVP 信息架构；
- 是否允许设计 n8n preview/shadow 工作流；
- 是否允许后续 Git 归档。

即使获得 SQL 草案审查批准，也不代表可以执行 migration、写数据库、修改 Trigger、导入 n8n 或 push Git。

## 9. 验收标准

- 审查包列出当前实现、测试、配置和本轮补强内容；
- 明确 outcome policy、score boundary、normalization、replay integrity、risk policy；
- 明确本次未涉及的高风险操作；
- 明确下一阶段是 SQL 草案审查而非执行；
- 不包含可执行 SQL、真实客户数据、secrets 或凭据。

## 10. 风险

- 若未经过设计审核就进入 SQL，可能过早固化错误模型；
- 若没有 outcome policy 版本，grade / priority 历史比较会失真；
- 若没有 checksum 和 canonical snapshot，历史评分难以重放；
- 若 shadow 输出被误当成正式评分，可能污染 v0.1 生产事实。

## 11. 回滚原则

当前阶段只有文档变更，无生产状态变更。若用户不接受本设计包，可删除或修订这些文档；不影响 v0.1 评分事实来源。

## 12. 下一步入口

用户确认本设计包后，下一步应仅进入“SQL 草案审查”，先产出 SQL 草案、影响范围和回滚方案；未经批准不得执行。
