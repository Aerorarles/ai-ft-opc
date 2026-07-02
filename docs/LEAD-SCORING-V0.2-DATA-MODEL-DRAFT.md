# Lead Scoring v0.2 数据模型草案

版本：v0.2-beta-design-r2
日期：2026-07-01
状态：概念数据模型草案，禁止直接实施
适用范围：未来配置化评分、评分结果策略、shadow 运行、审批、审计和快照的概念实体设计
禁止事项：本文不包含 SQL，不创建 migration，不修改数据库、Trigger、函数或任何生产数据。

## 1. 总体原则

本草案只描述概念实体和字段字典，不代表现有数据库已经存在这些表或字段。

所有未来数据模型必须遵守：

- 不保存 HTML、headers、cookies、stack、原始响应体、API Key 或 credentials；
- 评分历史只保存最小必要 input summary 与规则命中摘要；
- 规则版本和 outcome policy 发布后不可直接编辑，只能复制为新 draft；
- 不允许直接覆盖 active 配置；
- 所有变更必须可审计、可审批、可回滚。

## 2. scoring_config_sets

业务用途：表示一组评分配置集合，例如 Lead Scoring、Supplier Capability Scoring 或未来 Match Scoring。

推荐主键：`config_set_id`

推荐关键字段：

- `config_set_id`
- `tenant_id`
- `organization_id`
- `name`
- `description`
- `scoring_domain`
- `active_version_id`
- `active_outcome_policy_id`
- `status`
- `created_by_user_id`
- `created_at`
- `updated_at`

未来关系：通过 `tenant_id`、`organization_id`、`user_id` 支持租户隔离、组织归属和用户审计。

历史与草稿边界：config set 可编辑名称和描述，但 active version 指针与 active outcome policy 指针只能通过审批后的激活动作切换。

与 `public.leads` 的关系：不直接关联单条 Lead，是评分规则集合的上层容器。

是否需要 `lead_id`：否。

允许保存：配置集合名称、描述、状态、active version 指针、active outcome policy 指针。
不得保存：原始 Lead 内容、外部响应、secrets、credentials。

## 3. scoring_config_versions

业务用途：表示某个配置集合的一次具体规则版本，包括 draft、approved、active、archived 等状态。

推荐主键：`config_version_id`

推荐关键字段：

- `config_version_id`
- `config_set_id`
- `version_label`
- `config_schema_version`
- `engine_version`
- `config_checksum`
- `canonical_config_snapshot`
- `status`
- `weights_summary`
- `validation_status`
- `validation_errors_summary`
- `change_reason`
- `created_by_user_id`
- `submitted_by_user_id`
- `approved_by_user_id`
- `activated_by_user_id`
- `created_at`
- `submitted_at`
- `approved_at`
- `activated_at`
- `archived_at`

未来关系：继承 `config_set` 的 `tenant_id` 与 `organization_id`；所有用户动作引用 `user_id`。

历史与草稿边界：

- draft 可编辑；
- review requested 后应限制编辑；
- approved 和 active 不可直接编辑；
- 修改已发布版本必须复制为新 draft。

可重放与完整性：

`Lead + config_version + config_checksum + engine_version` 必须可以重放历史评分结果。
`canonical_config_snapshot` 应保存标准化、脱敏、可重放的配置快照；`config_checksum` 用于证明评分时使用的配置未被篡改。

与 `public.leads` 的关系：不直接修改 Lead，但评分运行快照会引用具体 config version。

是否需要 `lead_id`：否。

允许保存：版本状态、权重摘要、校验摘要、审批元数据、标准化配置快照和 checksum。
不得保存：完整 HTML、原始响应、API Key、credentials、客户敏感正文。

## 4. scoring_rules

业务用途：保存某个配置版本下的规则定义。

推荐主键：`config_rule_id`

推荐关键字段：

- `config_rule_id`
- `config_version_id`
- `rule_key`
- `rule_type`
- `field`
- `operator`
- `rule_value_normalized`
- `rule_value_summary`
- `dimension`
- `score_delta`
- `enabled`
- `sort_order`
- `created_at`
- `updated_at`

规则值与审计值分离：

- `rule_value_normalized` 是实际可执行的结构化规则值；
- `rule_value_summary` 是供审计、预览、展示使用的脱敏摘要；
- 不允许把 `rule_value_summary` 当作评分执行数据；
- 执行引擎只能读取 `rule_value_normalized` 或等价结构化字段。

未来关系：通过 `config_version_id` 归属于某一版本，并通过版本间接归属 `tenant_id`、`organization_id`。

历史与草稿边界：published version 下的 rules 不可直接编辑，只能在新 draft 中复制后修改。

与 `public.leads` 的关系：不直接关联 Lead。

是否需要 `lead_id`：否。

允许保存：字段名、operator、标准化 value、展示摘要、dimension、score_delta。
不得保存：原始邮箱、电话全文、HTML、headers、cookies、stack、API Key、credentials。

## 5. scoring_rule_groups

业务用途：可选实体，用于将规则按业务维度分组，例如国家规则、行业规则、联系信息规则、风险规则。

推荐主键：`rule_group_id`

推荐关键字段：

- `rule_group_id`
- `config_version_id`
- `group_key`
- `name`
- `description`
- `dimension`
- `enabled`
- `sort_order`

历史与草稿边界：与 scoring_rules 一致，已发布版本不可直接编辑。

与 `public.leads` 的关系：不直接关联 Lead。

是否需要 `lead_id`：否。

允许保存：分组名称、说明、维度、顺序。
不得保存：Lead 原始内容、外部响应、secrets。

## 6. scoring_outcome_policies

业务用途：定义 `total_score` 到 `grade` 和 `priority` 的映射策略。

推荐主键：`outcome_policy_id`

推荐关键字段：

- `outcome_policy_id`
- `config_set_id`
- `policy_version`
- `policy_schema_version`
- `status`
- `grade_thresholds_summary`
- `priority_thresholds_summary`
- `score_min`
- `score_max`
- `clamp_enabled`
- `rounding_mode`
- `policy_checksum`
- `canonical_policy_snapshot`
- `created_by_user_id`
- `approved_by_user_id`
- `activated_by_user_id`
- `created_at`
- `approved_at`
- `activated_at`

未来关系：与 scoring_config_sets 绑定，可按 tenant/organization 提供不同 policy。一个规则版本必须明确绑定一个 outcome policy version，才能生成 grade / priority。

历史与草稿边界：policy 发布后不可直接编辑，只能复制为新 draft；不得直接覆盖 active policy。

与 `public.leads` 的关系：不直接关联 Lead。未来写正式字段前必须经过单独审批。

是否需要 `lead_id`：否。

允许保存：阈值摘要、分数边界、rounding mode、checksum、标准化 policy snapshot。
不得保存：Lead 原始内容、HTML、headers、cookies、secrets、credentials。

## 7. scoring_run_snapshots

业务用途：保存一次评分运行的最小必要快照，用于 shadow compare、人工审核和未来审计。

推荐主键：`scoring_run_id`

推荐关键字段：

- `scoring_run_id`
- `config_version_id`
- `config_checksum`
- `engine_version`
- `outcome_policy_id`
- `outcome_policy_version`
- `lead_id`
- `run_mode`
- `total_score`
- `grade_preview`
- `priority_preview`
- `breakdown_summary`
- `input_summary`
- `validation_status`
- `created_by_user_id`
- `created_at`

未来关系：必须支持 `tenant_id` 与 `organization_id`；可通过 `lead_id` 关联 `public.leads`。

历史与草稿边界：评分快照应不可变，不因配置回滚或 Lead 后续变化而修改历史。

与 `public.leads` 的关系：可关联单条 Lead，但不得写回正式 `score`。

是否需要 `lead_id`：是，未来 shadow run 需要。

允许保存：最小 input summary、分数、breakdown、版本、checksum、预览 grade / priority。
不得保存：HTML、headers、cookies、stack、原始响应体、完整邮箱、完整电话、API Key、credentials。

## 8. scoring_explanations

业务用途：保存一次评分命中的规则解释摘要。

推荐主键：`scoring_explanation_id`

推荐关键字段：

- `scoring_explanation_id`
- `scoring_run_id`
- `rule_key`
- `rule_type`
- `field`
- `operator`
- `expected_value_summary`
- `actual_value_summary`
- `dimension`
- `raw_delta`
- `weight`
- `effective_delta`

历史与草稿边界：解释记录应随 run snapshot 不可变。

与 `public.leads` 的关系：通过 `scoring_run_snapshots.lead_id` 间接关联。

是否需要 `lead_id`：不直接需要。

允许保存：脱敏后的 expected/actual 摘要。
不得保存：完整邮箱、完整电话、HTML、headers、cookies、stack、response、secrets。

## 9. scoring_change_requests

业务用途：记录评分配置或 outcome policy 变更申请。

推荐主键：`change_request_id`

推荐关键字段：

- `change_request_id`
- `config_set_id`
- `draft_version_id`
- `draft_outcome_policy_id`
- `requested_by_user_id`
- `change_reason`
- `impact_summary`
- `validation_result_summary`
- `status`
- `created_at`
- `submitted_at`

与 `public.leads` 的关系：不直接关联；影响评估可引用 Lead 数量摘要。

是否需要 `lead_id`：否。

允许保存：变更原因、影响摘要、校验结果。
不得保存：客户敏感原文、外部响应、secrets。

## 10. scoring_approvals

业务用途：记录审批动作。

推荐主键：`approval_id`

推荐关键字段：

- `approval_id`
- `change_request_id`
- `approved_version_id`
- `approved_outcome_policy_id`
- `approver_user_id`
- `decision`
- `decision_reason`
- `decided_at`

历史与草稿边界：审批记录不可变，不覆盖，不删除。

与 `public.leads` 的关系：不直接关联。

是否需要 `lead_id`：否。

允许保存：审批结论、原因、时间。
不得保存：secrets、完整原始数据。

## 11. scoring_audit_logs

业务用途：记录所有评分配置、outcome policy、预览、激活、回滚和审批相关动作。

推荐主键：`audit_log_id`

推荐关键字段：

- `audit_log_id`
- `tenant_id`
- `organization_id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `old_value_summary`
- `new_value_summary`
- `reason`
- `created_at`

历史与草稿边界：审计日志不可编辑、不可删除，只允许追加。

与 `public.leads` 的关系：评分运行审计可间接关联 `lead_id`，配置变更审计不直接关联。

是否需要 `lead_id`：可选，仅评分运行或 Lead preview 时需要。

允许保存：动作摘要、旧值摘要、新值摘要、原因。
不得保存：HTML、headers、cookies、stack、原始响应、API Key、credentials。

## 12. 验收标准

- 覆盖全部既有实体，并新增 scoring_outcome_policies；
- 明确 rule_value_normalized 与 rule_value_summary 的执行/审计边界；
- 明确 config_schema_version、engine_version、config_checksum、canonical_config_snapshot；
- 明确可重放条件；
- 明确允许保存与不得保存内容；
- 全文不包含可执行 SQL。

## 13. 风险

- 如果没有不可变版本，规则修改会破坏历史可解释性；
- 如果没有 checksum 和 canonical snapshot，历史评分难以重放；
- 如果把 summary 当执行值，会导致展示摘要与评分行为不一致；
- 如果 active policy 可被直接覆盖，grade / priority 历史比较会失真。

## 14. 回滚原则

未来回滚只切换 active config version 与 active outcome policy version 指针，不修改历史版本，不删除评分运行快照，不删除审计日志。

## 15. 下一步入口

进入 `LEAD-SCORING-V0.2-SCORING-POLICY-DRAFT.md` 审核评分结果策略。未经用户批准，不进入 SQL 草案审查。
