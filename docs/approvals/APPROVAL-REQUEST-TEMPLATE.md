# AI FT-OPC Approval Request Template

版本：M0.5-WP01 v1.0
状态：模板
适用范围：高风险或外部副作用动作的人工审批
禁止事项：审批请求中不得写入 API key、password、token、cookie、credential、连接串或原始敏感客户数据。

## Approval ID

`<unique-approval-id>`

## Action

`<approval-gate-id and exact action>`

## Reason

`<why this action is required now>`

## Affected Scope

`<exact files, records, workflow, environment, or bounded target scope>`

## Risk

`<risk level and concrete failure modes>`

## Evidence

`<review links, test results, precheck summary, and applicable policy/version>`

## Exact Command / Change

```text
<exact command or concise, reviewable change description>
```

## Rollback

`<reversible action, stop criteria, and recovery owner; state Not Applicable only when technically true>`

## Requested Approval

`<approver role, decision requested, expiration or execution window>`

## Status

`DRAFT | PENDING | APPROVED | REJECTED | EXPIRED | EXECUTED | ROLLED_BACK`

## 验收标准

审批记录能清楚说明动作、边界、风险、证据、审批人与回滚路径。

## 风险

模板本身不构成执行授权；只有指定审批人明确批准后，才可按批准范围执行。

## 回滚原则

审批状态变化与实际操作结果应被记录；如范围变化，必须创建新的审批请求。

## 下一步入口

将已批准的请求关联到当前 Work Package 的进度报告和审计记录。
