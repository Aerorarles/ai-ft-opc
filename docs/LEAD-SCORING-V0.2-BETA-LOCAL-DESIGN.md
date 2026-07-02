# Lead Scoring v0.2-beta 本地设计说明

## 1. 当前范围

本版本仅覆盖本地评分内核与 JSON 配置：

- `scoring-engine/src` 中的纯 TypeScript/Node 评分逻辑；
- `scoring-config/v1.json` 中的评分权重与规则；
- 本地配置校验、评分预览、命中规则解释和测试用例。

本版本不连接数据库、不执行 migration、不接 n8n、不接管理后台、不调用外部 API，也不写回任何业务表。

## 2. 与现有生产事实的关系

当前 AI FT-OPC 项目中，v0.1 评分仍是现有生产事实来源。v0.2-beta 仅作为本地 shadow-ready 评分内核，用于验证配置化评分、规则解释和人工审核流程。

v0.2-beta 不可写回 `leads.score`、`grade`、`priority` 或任何生产评分字段。任何数据库接入前，都必须经过单独设计、SQL 审查和用户明确批准。

## 3. 配置版本

评分配置由 JSON 文件承载，当前示例为：

- `scoring-config/v1.json`
- `scoring-config/v1-invalid.json`

配置必须包含：

- `version`
- `metadata.name`
- `weights`
- `rules`

评分引擎通过 `loadConfig(configJson)` 加载配置，并返回：

- `config`
- `validation_errors`
- `validation_warnings`
- `is_valid`

如果存在 `validation_errors`，评分被阻断，`total_score` 返回 `null`。

## 4. 校验与解释

配置校验在未来数据库接入前承担以下作用：

- 阻止缺失字段、非法 operator、未知 field、重复 rule id、负权重等配置进入正式评分；
- 防止未知配置字段静默生效；
- 保证规则、权重和维度变更可审查；
- 为人工审批提供明确错误列表。

评分解释输出包括：

- 总分；
- 分维度 breakdown；
- 命中规则；
- 每条命中规则的字段、operator、预期值、脱敏后的实际值摘要、delta、权重和维度；
- 脱敏 input summary。

实际值摘要不得输出完整邮箱、电话号码、HTML、headers、cookies、response、stack 或任何 secrets。

## 5. 评分预览

`previewLeadScore(lead, configJson)` 用于本地预览：

- 配置版本；
- 配置元信息；
- 配置是否有效；
- 校验错误与 warning；
- 评分结果；
- delta 汇总；
- 固定模板生成的中文摘要。

预览摘要不调用 LLM，不连接外部服务，仅由本地规则命中结果生成。

## 6. 人工审批作用

在进入数据库、n8n 或管理后台之前，人工审批必须确认：

- 配置版本是否正确；
- 权重是否符合当前业务目标；
- 规则是否可解释、可回滚；
- 评分结果是否仅作为 shadow 输出；
- 是否存在对真实客户触达或业务状态的间接影响。

## 7. 后续数据库接入要求

下一阶段如果设计数据库表、Trigger、管理后台或 n8n 回写流程，必须单独审查：

- SQL 文件；
- 影响范围；
- 回滚方案；
- 权限与审计；
- 与现有 v0.1 评分事实来源的关系；
- 是否允许 shadow compare；
- 是否允许写回正式字段。

未经用户明确批准，不得执行数据库写入、migration、Docker、服务器命令、n8n 发布或 Git 写操作。
