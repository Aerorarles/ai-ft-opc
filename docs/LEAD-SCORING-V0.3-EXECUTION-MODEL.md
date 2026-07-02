# Lead Scoring v0.3 Execution Model

版本：v0.3-design
日期：2026-07-01
状态：本地评分内核执行语义设计，已用于 scoring-engine additive upgrade
适用范围：Lead Scoring v0.3 的 execution context、rule precedence、blocking、override、replay 和解释输出
禁止事项：本文不包含 SQL，不创建 migration，不修改数据库、Trigger、n8n、Docker、服务器、Git，不访问外部 API，不读取 secrets。

## 1. 设计目标

v0.3 在 v0.2-beta 的 config-driven scoring 基础上，增加运行时语义：

- 每次评分都有明确 execution context；
- 规则执行顺序可解释；
- 高优先级规则可覆盖低优先级规则；
- blocking rule 可停止同维度后续评分；
- replay 可以复现同一次评分上下文；
- explainability 能说明规则为何命中、为何跳过、为何被阻断。

## 2. Scoring Execution Context

Execution Context 是评分系统的 runtime backbone。它把一次评分从“函数调用”提升为“可追踪、可重放、可审计的运行实例”。

字段定义：

- `execution_id`：本次评分唯一 ID；
- `lead_id`：可选，未来关联正式 Lead；
- `config_version_id`：评分配置版本；
- `config_checksum`：配置校验摘要；
- `outcome_policy_id`：结果策略 ID；
- `outcome_policy_version`：结果策略版本；
- `engine_version`：评分引擎版本；
- `trigger_source`：`api`、`n8n`、`manual`、`replay`、`shadow`；
- `run_mode`：`live`、`shadow`、`replay`、`preview`；
- `idempotency_key`：避免重复执行；
- `request_trace_id`：链路追踪；
- `tenant_id`：未来多租户边界。

当前实现为纯本地结构，不接数据库，不写审计表。

## 3. Rule Precedence Model

v0.3 规则新增三个运行时字段：

- `priority`：数字，越大越先执行；
- `blocking`：布尔值，命中后停止同维度后续评分；
- `override_group`：字符串或 null，同组只允许最高优先级规则生效。

旧 v0.2 配置不包含这些字段时：

- `priority` 默认为 0；
- `blocking` 默认为 false；
- `override_group` 默认为 null。

因此 v0.3 是追加能力，不破坏 v0.2 配置。

## 4. 执行顺序

规则执行顺序：

1. 按 `priority DESC` 排序；
2. 同优先级保持原配置顺序；
3. 先处理 `override_group`，同组只保留最高优先级规则；
4. 执行规则匹配；
5. blocking rule 命中后，将该 dimension 标记为 blocked；
6. 后续同 dimension 规则记录为 skipped，原因是 `blocked_rule`。

## 5. Blocking 语义

blocking rule 用于表达“此维度已经由高优先级规则决定，后续同维度规则不应继续叠加”。

示例：

```text
priority 100: relevance blocking rule 命中
priority 10: relevance 普通 rule 即使可命中，也跳过
```

输出必须记录：

- `blocked_dimensions`
- `skipped_rules`
- blocking rule 自身在 `applied_rules` 中带 `blocked = true`

## 6. Override 语义

override_group 用于表达互斥规则组。

同一 override_group 中：

- 只允许最高 priority 的规则参与评估；
- 低 priority 规则跳过；
- 跳过原因记录为 `lower_priority`；
- 若未来存在同 priority 冲突，应记录为 `overridden` 或进入配置校验增强。

输出必须记录：

- `override_applied_rules`
- `skipped_rules`

## 7. Explainability 输出

`applied_rules` 增加：

- `priority`
- `blocked`
- `skipped_reason`

`skipped_rules` 记录：

- `rule_id`
- `rule_type`
- `field`
- `operator`
- `dimension`
- `priority`
- `override_group`
- `skipped_reason`

允许的 skipped_reason：

- `blocked_rule`
- `overridden`
- `lower_priority`
- `invalid_field`
- `invalid_operator`

## 8. Execution Lifecycle

v0.3 pipeline：

```text
Lead
-> Feature Extraction
-> Config Validation
-> Execution Context Init
-> Rule Precedence Evaluation
-> Dimension Scoring
-> Outcome Policy Mapping
-> Explanation
```

当前 outcome policy mapping 仍为占位输出，不写 grade / priority。

## 9. Replay Semantics

Replay 的目标是复现历史评分。

Replay 必须尽量保持：

- 相同 `execution_id`；
- 相同 `idempotency_key`；
- 相同 `config_version_id`；
- 相同 `config_checksum`；
- 相同 `engine_version`；
- 相同 `lead` input summary；
- 相同 outcome policy version。

当前本地实现允许调用方传入 `execution_id` 与 `idempotency_key`，并在 `run_mode = replay` 时保留它们。

未来若接入数据库，必须保存足够的 config snapshot、checksum 和 execution context，才能保证历史评分可复现。

## 10. 验收标准

- execution context 字段完整；
- blocking rule 命中后同维度停止计分；
- override_group 中低优先级规则被跳过；
- applied_rules 和 skipped_rules 可解释；
- replay 可保留相同 execution_id 与 idempotency_key；
- v0.2 配置不包含 precedence 字段时仍可运行。

## 11. 风险

- priority 设置不清晰会导致业务人员难以解释评分；
- blocking rule 过多可能隐藏其他有效信号；
- override_group 设计过宽会丢失细粒度评分；
- replay 若缺少 checksum 或 engine_version，将无法证明结果一致。

## 12. 回滚原则

当前 v0.3 仅为本地评分内核追加能力。若需要回滚，可继续使用不带 `priority`、`blocking`、`override_group` 的 v0.2 配置语义；生产系统不受影响。

## 13. 下一步入口

下一步应只做本地测试与设计审查。未经用户明确批准，不进入 SQL、migration、n8n、Docker、服务器或 Git 操作。
