# Lead Scoring v0.2 评分结果策略草案

版本：v0.2-beta-policy-draft
日期：2026-07-01
状态：评分结果策略草案，禁止直接实施
适用范围：Lead Scoring v0.2 的 total_score、grade、priority、分数边界、归一化和跨版本比较规则
禁止事项：本文仅为设计文档，不写 SQL，不创建 migration，不修改数据库、Trigger、n8n、Docker、服务器、Git、scoring-engine 代码或 scoring-config JSON。

## 1. scoring_outcome_policies 概念实体

`scoring_outcome_policies` 用于定义评分结果如何从 `total_score` 映射到 `grade` 和 `priority`。

业务用途：

- 管理 `total_score -> grade` 映射；
- 管理 `total_score -> priority` 映射；
- 支持 A/B/C 阈值；
- 支持 high/medium/low 阈值；
- 支持不同租户使用不同 outcome policy；
- 让 v0.1 与 v0.2 的 grade / priority 差异比较可重放。

推荐关键字段：

- `outcome_policy_id`
- `config_set_id`
- `tenant_id`
- `organization_id`
- `policy_version`
- `policy_schema_version`
- `status`
- `score_min`
- `score_max`
- `clamp_enabled`
- `rounding_mode`
- `grade_thresholds`
- `priority_thresholds`
- `policy_checksum`
- `canonical_policy_snapshot`
- `created_by_user_id`
- `approved_by_user_id`
- `activated_by_user_id`

当前阶段仅设计，不实现。

## 2. total_score 到 grade 的映射

建议默认草案：

- A：`total_score >= 70`
- B：`40 <= total_score < 70`
- C：`total_score < 40`

该阈值继承 v0.1 文档中的业务直觉，但未来必须作为 versioned outcome policy 管理，不应硬编码到 engine。

## 3. total_score 到 priority 的映射

建议默认草案：

- high：`total_score >= 70`
- medium：`40 <= total_score < 70`
- low：`total_score < 40`

priority 与 grade 可以共享阈值，也可以在未来拆分。若不同租户有不同销售节奏，允许租户级 policy 差异，但必须有独立 policy version 和审批记录。

## 4. 规则版本与 outcome policy 的绑定关系

每次评分必须明确绑定：

- scoring config version；
- config checksum；
- engine version；
- outcome policy version；
- outcome policy checksum。

如果缺少 outcome policy，则只能输出 `total_score` 和 breakdown，不得输出 grade / priority。

## 5. 发布与编辑边界

- draft policy 可编辑；
- review_requested 后原则上冻结；
- approved / active policy 不可直接编辑；
- 修改 active policy 必须复制为新 draft；
- 不允许直接覆盖 active policy；
- 回滚只切换 active outcome policy 指针。

## 6. 分数边界与归一化策略

### 6.1 total score 边界

建议默认：

- `score_min = 0`
- `score_max = 100`
- `clamp_enabled = true`

如果未启用 clamp，必须在差异报告中明确 total_score 可能低于 0 或高于 100。

### 6.2 维度边界

建议为每个维度定义概念边界：

- relevance：0 到 100；
- trust：0 到 100；
- capability：0 到 100；
- risk：-100 到 0。

risk 默认非正。风险减缓、验证增强或正向信号应进入 trust，不应给 risk 正分。

### 6.3 rounding mode

建议默认：

- 维度分数保留两位小数；
- total_score 保留两位小数；
- grade / priority 映射使用 rounding 后的 total_score。

rounding mode 必须进入 outcome policy，未来不得由不同调用方自行决定。

### 6.4 空规则

规则数组为空且配置校验通过时：

- breakdown 全部为 0；
- total_score 为 0；
- grade / priority 由 outcome policy 决定；
- 需要 validation warning 提示“无规则配置”。

### 6.5 无命中规则

规则存在但没有命中时：

- breakdown 全部为 0；
- total_score 为 0；
- applied_rules 为空；
- 不视为错误。

### 6.6 全部风险规则命中

若只命中风险规则：

- risk 维度累计为非正值；
- total_score 可能低于 0；
- 若 clamp enabled，最终 total_score 可被限制到 `score_min`；
- 差异报告必须保留 unclamped_score 或风险摘要，避免隐藏风险来源。

## 7. 跨版本差异比较

为了保证跨版本差异比较有意义，必须记录：

- config_version；
- config_checksum；
- engine_version；
- outcome_policy_version；
- outcome_policy_checksum；
- score_min / score_max / clamp_enabled / rounding_mode；
- grade_thresholds；
- priority_thresholds。

只有当 outcome policy 可确定时，才允许输出 grade / priority diff。

## 8. 风险维度规范

risk 规则默认 `score_delta <= 0`。

风险减缓、验证增强、公开联系方式、可信主体、人工确认等正向信号应进入 trust 或 relevance，不应通过 risk 正分抵消。

若未来确需 risk 正分例外，必须：

- 明确配置字段标记；
- 通过审批；
- 在配置校验中识别；
- 在解释输出中显示；
- 在审计中记录原因。

## 9. 验收标准

- 明确 scoring_outcome_policies 概念实体；
- 明确 total_score 到 grade / priority 映射；
- 明确 A/B/C 与 high/medium/low 阈值；
- 明确规则版本与 outcome policy 绑定；
- 明确不同租户可使用不同 policy；
- 明确分数边界、clamp、rounding、空规则、无命中、全部风险命中行为；
- 明确 risk 默认非正和例外审批。

## 10. 风险

- 未版本化 outcome policy 会导致历史 grade / priority 不可重放；
- 不定义 clamp 会导致不同调用方展示结果不一致；
- risk 正分会混淆风险与可信度；
- 空规则或无命中规则若不定义行为，可能被误判为系统失败。

## 11. 回滚原则

当前阶段只有文档，无生产状态变化。未来实施后，回滚只切换 active outcome policy 指针，不修改历史 policy，不删除评分快照。

## 12. 下一步入口

进入数据库设计前，需用户明确批准是否将 outcome policy 纳入 SQL 草案审查。未经批准，不编写 SQL 草案。
