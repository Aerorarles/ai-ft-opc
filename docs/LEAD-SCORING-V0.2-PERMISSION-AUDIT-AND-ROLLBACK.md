# Lead Scoring v0.2 权限、审计与回滚设计

版本：v0.2-beta-design-r2
日期：2026-07-01
状态：权限与审计草案，供人工审核
适用范围：未来评分配置、outcome policy 草稿、审批、激活、回滚、预览和审计流程
禁止事项：不得实施权限表、不得写 SQL、不得修改数据库、Trigger、n8n、Docker、服务器或 Git。

## 1. 角色草案

- owner：平台或租户最高负责人，可最终批准高风险配置和回滚；
- platform_admin：平台管理员，管理跨租户平台配置和系统级审计；
- tenant_admin：租户管理员，管理本租户配置、审批流程和用户授权；
- rule_editor：规则编辑者，可创建和修改 draft，不可批准、激活或回滚；
- reviewer：审核者，可审核、驳回或按授权批准；
- operator：运营人员，可执行 preview、查看 shadow 结果和提交人工复核；
- viewer：只读用户，仅查看已批准配置、快照和报表摘要。

## 2. 权限矩阵草案

| 角色 | draft | review | approve | activate | rollback | preview |
| --- | --- | --- | --- | --- | --- | --- |
| owner | 创建/编辑/查看 | 可提交/查看 | 可批准 | 可激活 | 可回滚 | 可预览 |
| platform_admin | 平台范围可管理 | 可审核 | 可批准平台配置 | 可激活平台配置 | 可回滚平台配置 | 可预览 |
| tenant_admin | 租户范围可管理 | 可审核 | 可批准租户配置 | 可激活租户配置 | 可回滚租户配置 | 可预览 |
| rule_editor | 可创建/编辑 | 可提交 | 不可批准 | 不可激活 | 不可回滚 | 可预览 |
| reviewer | 只读 | 可审核/驳回 | 可按授权批准 | 不可激活 | 不可回滚 | 可预览 |
| operator | 不可编辑 | 可查看 | 不可批准 | 不可激活 | 不可回滚 | 可预览 |
| viewer | 只读 | 只读 | 不可批准 | 不可激活 | 不可回滚 | 只读预览结果 |

实际权限应叠加 tenant、organization、data_scope 和审批策略。

## 3. 状态机

主状态机：

```text
draft -> validation_failed / review_requested -> approved -> active -> archived
```

补充状态：

- rejected：审核拒绝，保留原因，可复制为新 draft；
- withdrawn：提交人撤回，保留记录；
- superseded：被新 active version 替代，历史仍保留；
- rollback_requested：回滚申请，需审批；
- rollback_completed：回滚完成，只切换 active 指针。

## 4. 配置变更审计字段

每次变更应记录：

- 修改人；
- 审批人；
- 修改时间；
- 审批时间；
- 旧值摘要；
- 新值摘要；
- 影响范围；
- 配置版本；
- outcome policy version；
- config checksum；
- engine version；
- 变更原因；
- 校验结果；
- 回滚记录；
- tenant_id；
- organization_id；
- user_id。

摘要必须脱敏，不保存 HTML、headers、cookies、stack、原始响应体、API Key、credentials。

## 5. 回滚原则

- 仅切换 active config version 指针；
- 仅切换 active outcome policy version 指针；
- 不修改历史版本；
- 不删除既有评分快照；
- 不删除审批记录；
- 不删除审计日志；
- 不重写历史解释；
- v0.1 生产评分可作为最终安全回退。

回滚也必须产生审计记录，记录回滚人、时间、原因、旧 active version、新 active version、旧 outcome policy、新 outcome policy 和影响范围。

## 6. 未来重评分策略

### 6.1 preview-only

只对人工选择的 Lead 生成预览，不写正式评分字段。

### 6.2 shadow-run

对受控样本生成 v0.2 独立评分和差异报告，不写 `leads.score`、`grade`、`priority`。

### 6.3 approved batch re-score

仅在用户明确批准、配置已审批、影响范围已评估、回滚方案已确认后，才允许设计小批量重评分。

当前禁止自动全量重评分。

## 7. Outcome Policy 审批要求

Outcome policy 与 scoring config 同样需要 draft、review、approve、activate、rollback 流程。

发布后的 policy 不可直接编辑，只能复制为新 draft。不同租户可以有不同 policy，但必须记录 tenant_id、organization_id、policy version 和 checksum。

## 8. 验收标准

- 覆盖 owner、platform_admin、tenant_admin、rule_editor、reviewer、operator、viewer；
- 明确 draft、review、approve、activate、rollback、preview 权限；
- 明确状态机和 rejected、withdrawn、superseded；
- 明确 outcome policy 同样需要审批；
- 明确审计字段包含 config checksum、engine version、outcome policy version；
- 明确当前禁止自动全量重评分。

## 9. 风险

- 编辑者和审批者不分离会引入误配置风险；
- active version 或 active policy 可直接编辑会破坏审计；
- 批量重评分未经审批会污染生产结果；
- 回滚如果删除快照，会丢失差异分析证据。

## 10. 回滚原则

当前阶段只产生设计文档，不产生系统状态变更。未来实施后，回滚必须通过版本指针切换完成，并保留全部历史记录。

## 11. 下一步入口

进入 `LEAD-SCORING-V0.2-SHADOW-ROLLOUT-PLAN.md` 审核 shadow rollout 步骤、验收和边界。
