# Lead Scoring v0.2 Shadow Rollout 计划

版本：v0.2-beta-design-r2
日期：2026-07-01
状态：shadow rollout 草案，禁止直接实施
适用范围：从本地评分内核到未来 shadow mode、数据库设计审查、n8n 接入申请的阶段计划
禁止事项：不得执行 migration、数据库写入、Trigger 修改、n8n 导入/发布/激活、Docker/服务器操作、Git 写操作或外部 API 调用。

## 1. 当前阶段：local-only

当前只允许本地评分内核、JSON 配置、配置校验、评分预览、解释输出和文档设计。

当前不得：

- 写回 `leads.score`；
- 写回 `grade`；
- 写回 `priority`；
- 修改 v0.1 评分 Trigger；
- 自动重评分；
- 让 n8n 调用 v0.2 写库；
- 触达真实客户。

## 2. 下一阶段：数据库设计审查，但不实施

下一阶段可做：

- 设计概念数据模型；
- 设计字段字典；
- 设计权限、审计、回滚；
- 设计 shadow snapshot；
- 设计 outcome policy 存储草案；
- 设计最小只读预览路径。

下一阶段仍不得执行 SQL、migration 或数据库连接写入。

## 3. 后续 shadow mode

shadow mode 的目标是让 v0.2 生成独立评分结果和差异报告，但不写正式字段。

必须保持：

```text
v0.1 -> 正式生产 score / grade / priority
v0.2 -> shadow score / explanation / outcome preview / diff report
```

v0.2 shadow 输出不得覆盖 v0.1 生产评分。

## 4. 与 v0.1 的差异比较指标

差异报告至少包含：

- 总分差异；
- 等级差异；
- 优先级差异；
- 命中规则差异；
- 无效配置阻断次数；
- 分维度差异；
- risk delta 差异；
- 需要人工复核的样本数量。

## 5. 版本化差异比较要求

v0.1 与 v0.2 的 grade / priority 对比必须基于 versioned outcome policy。

差异报告必须记录：

- `config_version`
- `config_checksum`
- `engine_version`
- `outcome_policy_version`
- `outcome_policy_checksum`

如果无法确定 outcome policy，则只允许输出 score diff，不得输出 grade diff 或 priority diff。

## 6. 人工复核阈值

建议人工复核条件：

- 总分差异超过预设阈值；
- v0.1 与 v0.2 等级不一致；
- v0.1 与 v0.2 优先级不一致；
- risk 规则命中但 v0.1 未体现；
- 配置校验出现 validation errors；
- outcome policy 缺失或 checksum 不匹配；
- 规则命中解释为空但分数非零；
- actual value summary 显示字段缺失或异常。

具体阈值应由用户在进入 shadow-run 前确认。

## 7. 何时可进入数据库 migration 设计

仅当以下条件满足时，才可申请进入数据库 migration 设计：

- 本地配置校验和测试全部通过；
- 本设计包经用户确认；
- 数据模型草案经用户确认；
- 评分结果策略草案经用户确认；
- 权限与审计边界经用户确认；
- 明确只做 shadow snapshot，不写正式评分；
- 提供 SQL 草案、影响范围和回滚方案；
- 用户明确批准进入 SQL 草案审查。

当前阶段不是执行，下一阶段也只是 SQL 草案审查。

## 8. 何时可申请修改 Trigger

只有在以下条件全部满足后，才可申请讨论 Trigger 修改：

- shadow mode 已稳定运行；
- v0.2 与 v0.1 差异已复盘；
- outcome policy 已版本化并通过审批；
- 用户确认 v0.2 可替代或补充 v0.1；
- 已提供完整 migration、回滚和停用方案；
- 已明确是否保留 v0.1 作为 fallback；
- 用户明确批准。

当前阶段不得修改 Trigger。

## 9. 何时才允许 n8n 接入

n8n 接入必须晚于数据库设计审查和本地预览稳定。

允许申请 n8n 接入的前置条件：

- v0.2 只做 preview 或 shadow-run；
- 不写正式 `leads.score`、`grade`、`priority`；
- 工作流默认 inactive；
- JSON 不含 credentials；
- 节点设计完成静态审查；
- 逐节点局部验证；
- 用户明确批准导入。

n8n 不负责评分规则计算，只负责调用稳定评分能力和编排审核流程。

## 10. 阶段计划

### 10.1 阶段 A：本地设计与审查

影响范围：docs、scoring-engine、scoring-config。
验收标准：本地测试通过，设计包完成，用户确认。
回滚方式：删除或修订本地文档与配置，不影响生产。

### 10.2 阶段 B：数据库设计审查

影响范围：仅 SQL 草案和数据模型审查。
验收标准：SQL 草案、影响范围、回滚方案经用户确认。
回滚方式：不执行 SQL 即无生产影响。

### 10.3 阶段 C：shadow snapshot 存储

影响范围：新增 shadow 结果存储，不写正式评分字段。
验收标准：单条 Lead shadow run 成功，快照脱敏，v0.1 不受影响。
回滚方式：停用 shadow 写入路径，保留历史快照或按批准归档。

### 10.4 阶段 D：差异报告

影响范围：生成 v0.1 与 v0.2 对比报告。
验收标准：差异指标完整，记录 config/outcome/engine 版本，人工复核列表可解释。
回滚方式：停用报告任务，不影响正式评分。

### 10.5 阶段 E：受控小批量 shadow-run

影响范围：受控样本，不写正式评分。
验收标准：阻断无效配置，结果可解释，人工复核通过。
回滚方式：停止任务，不删除历史审计。

## 11. 验收标准

- 明确当前 local-only；
- 明确下一阶段只做数据库设计审查；
- 明确 shadow mode 不写正式评分；
- 明确 grade / priority diff 必须基于 versioned outcome policy；
- 明确无法确定 policy 时不得输出 grade / priority diff；
- 明确 migration、Trigger、n8n 的申请条件；
- 每阶段包含影响范围、验收标准和回滚方式。

## 12. 风险

- 过早写正式评分会污染 v0.1 生产事实；
- 未记录 config checksum / engine version / outcome policy version 会导致差异不可重放；
- 无差异报告就替换评分会失去可解释性；
- n8n 过早接入可能绕过配置审批；
- 全量重评分风险高，当前禁止。

## 13. 回滚原则

任何阶段都必须能回退到 v0.1 生产评分事实来源。shadow 结果不得成为唯一事实来源。

## 14. 下一步入口

进入 `docs/reviews/lead-scoring-v0.2-beta-design-review-pack.md` 汇总本次设计包，等待用户人工审核。
