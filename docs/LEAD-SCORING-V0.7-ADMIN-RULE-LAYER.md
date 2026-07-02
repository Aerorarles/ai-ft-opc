# Lead Scoring v0.7 Admin Rule Layer

版本：v0.7-draft
日期：2026-07-01
状态：管理规则层概念设计，不实现 UI
适用范围：rule editor、draft lifecycle、publish / activate / rollback、tenant-specific rule sets、approval workflow
禁止事项：不实现前端 UI，不写数据库，不创建 migration，不接 n8n，不读取 secrets。

## 1. Rule Editor Concept

Rule editor 是未来管理后台能力，用于编辑 scoring config draft。它不是 scoring engine 的一部分，也不直接写 active 配置。

职责：

- 创建 draft；
- 编辑规则；
- 运行 preview；
- 查看 validation errors；
- 提交 review；
- 查看影响范围。

## 2. Rule Draft Lifecycle

建议状态：

```text
draft -> validation_failed / review_requested -> approved -> active -> archived
```

补充状态：

- rejected；
- withdrawn；
- superseded；
- rollback_requested。

## 3. Publish / Activate / Rollback Model

规则发布原则：

- draft 可编辑；
- approved version 不可直接编辑；
- active version 只能通过指针切换；
- rollback 只切回旧 active version；
- 不删除历史版本；
- 不覆盖已有评分快照。

## 4. Tenant-Specific Rule Sets

每个 tenant 拥有独立 rule set：

- tenant A 的规则不可被 tenant B 调用；
- rule id 只要求 tenant 内唯一；
- config checksum 必须按 tenant config 计算；
- preview / shadow / live 都必须限定 tenant。

## 5. Approval Workflow Integration

审批流程只做概念预留：

- rule_editor 创建 draft；
- reviewer 审查规则；
- tenant_admin 或 owner approve；
- platform_admin 可紧急 archive；
- 所有动作写 audit log。

当前不实现审批系统，不接 n8n，不写数据库。

## 6. 验收标准

- 管理层与 engine 分离；
- draft 与 active 边界清楚；
- rollback 不修改历史版本；
- tenant-specific rule sets 明确；
- 不包含 UI 实现或 SQL。

## 7. 风险

- 允许直接编辑 active config 会破坏 replay；
- 缺少审批会导致规则变更不可控；
- 跨 tenant rule reuse 若无隔离会造成数据泄漏。

## 8. 回滚原则

当前仅为概念文档。未来实施时，回滚应切换 active version 指针，不修改历史配置。

## 9. 下一步入口

下一步可进入 v0.8 的 admin UI schema 与权限模型设计。实施前必须获得用户批准。
