# AI FT-OPC — M0.5 Autonomous Delivery Foundation

> **Milestone ID**: M0.5
> **Name**: Autonomous Delivery Foundation
> **Version**: v1.0
> **Date**: 2026-07-11
> **Status**: IN_PROGRESS
> **Parent Roadmap**: `AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md`

---

# 1. Milestone Goal

建立 AI FT-OPC 的持续项目推进基础设施，使项目从：

```text
User
→ ChatGPT
→ 手工复制指令给 Codex
→ Codex 执行
→ 用户截图
→ ChatGPT 判断下一步
```

升级为：

```text
Project Control Files
        ↓
Codex Continuous Execution
        ↓
Test / Self Review
        ↓
Progress + Current Status
        ↓
GitHub Branch / PR / CI
        ↓
ChatGPT Architecture Review
        ↓
Next Work Package
```

最终目标：

```text
低风险本地开发
= Codex 可连续推进

高风险操作
= 必须进入 Approval Gate

项目事实
= 由 GitHub + Project Control Files 记录

用户
= 主要处理商业决策与高风险审批
```

---

# 2. M0.5 Scope

M0.5 只建立“项目持续交付控制层”。

本阶段不实现：

```text
Production Database Migration
Production DB Write
Server Deployment
Docker / Portainer Change
Production n8n Activation
Real Outreach
Paid Data Query
```

---

# 3. Target Architecture

```text
┌────────────────────────────────────────────┐
│ Human Approval                             │
│ Owner / Business Decision / High Risk Gate │
└───────────────────┬────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ Project Control Plane                      │
│ Milestone / WP / Policy / Approval / Next  │
└───────────────────┬────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ Codex Execution Loop                       │
│ Inspect → Implement → Test → Fix → Report  │
└───────────────────┬────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ GitHub Delivery Layer                      │
│ Branch / Commit / PR / CI / Review         │
└───────────────────┬────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ Project State                              │
│ Current Status / Progress / Approval Queue │
└────────────────────────────────────────────┘
```

---

# 4. Work Packages

## M0.5-WP01 — Project Control Plane

### Objective

建立机器可读、Agent 可持续读取的项目控制文件。

### Deliverables

```text
.project-control/
├── PROJECT-CONTROL.yaml
├── CURRENT-MILESTONE.yaml
├── CURRENT-WORK-PACKAGE.yaml
├── NEXT-ACTION.yaml
├── EXECUTION-POLICY.yaml
├── APPROVAL-GATES.yaml
└── README.md
```

同时更新：

```text
docs/project-status/AI-FT-OPC-CURRENT-STATUS.md
AGENT-START-HERE.md
```

### Exit Criteria

```text
Codex 可仅通过项目文件判断：
当前 Milestone
当前 Work Package
允许执行什么
禁止执行什么
下一步是什么
何时必须停止
```

---

## M0.5-WP02 — Restricted Git Automation

### Objective

允许 Codex 在受限条件下使用 Git 作为项目状态同步层。

### Allowed Model

```text
create work branch
→ exact-file stage
→ commit
→ push work branch
→ open PR
```

### Forbidden

```text
direct push main
force push
merge PR
delete protected branch
rebase shared branch
reset remote history
```

### Exit Criteria

```text
Codex 可以在工作分支持续提交
main 保持受保护
所有变更可审查
```

---

## M0.5-WP03 — GitHub Actions CI

### Objective

将本地测试升级为 PR 自动验证。

### Initial CI

```text
typecheck
phase1:test
phase2:test
test:scoring
test:orchestration
test:orchestration-scoring
```

### Exit Criteria

```text
PR 自动执行测试
失败可见
通过状态可作为下一步 Gate
```

---

## M0.5-WP04 — Codex Continuation Protocol

### Objective

定义 Codex 每次启动时的统一行为。

### Loop

```text
Read Master Architecture
→ Read Project Control
→ Read Current Status
→ Read Active WP
→ Inspect Repository
→ Execute Allowed Scope
→ Run Tests
→ Fix Allowed Failures
→ Self Review
→ Update Progress
→ Update Next Action
```

### Stop Conditions

```text
approval_required
scope_expansion_required
architecture_conflict
secret_required
production_access_required
unresolved_test_failure
git_conflict
```

---

## M0.5-WP05 — Automated Continuation Entry Point

### Objective

为 Codex App / Codex CLI / Codex Cloud / future runner 提供统一入口。

建议入口：

```text
scripts/project-control/
├── validate-project-control.*
├── show-next-action.*
└── validate-safe-state.*
```

脚本必须：

```text
只读取项目控制文件
验证状态一致性
不自动执行高风险动作
```

---

## M0.5-WP06 — Progress & Approval Reporting

### Objective

统一状态与审批报告。

### Deliverables

```text
docs/progress/
docs/approvals/
docs/project-status/
```

Approval Request 必须包含：

```text
Action
Why Needed
Affected Scope
Risk
Rollback
Exact Approval Required
```

---

# 5. Project State Machine

## Work Package Status

```text
NOT_STARTED
READY
IN_PROGRESS
BLOCKED
READY_FOR_REVIEW
PASSED
FAILED
```

## Milestone Status

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
READY_FOR_GATE
PASSED
```

## Next Action Type

```text
EXECUTE_WORK_PACKAGE
RUN_TESTS
FIX_ALLOWED_FAILURE
REQUEST_APPROVAL
WAIT_FOR_REVIEW
ADVANCE_WORK_PACKAGE
ADVANCE_MILESTONE
STOP
```

---

# 6. Approval Gates

Codex 必须停止并请求批准：

```text
production_database_write
migration_execution
server_change
docker_change
production_n8n_activation
real_outreach
paid_api_usage
permission_expansion
secret_access
destructive_git_operation
main_branch_merge
```

---

# 7. M0.5 Exit Gate

M0.5 完成必须满足：

```text
[ ] Project Control Files 存在并通过一致性检查
[ ] Codex 能从仓库状态判断下一步
[ ] 受限 Git 工作流已建立
[ ] CI 可自动验证核心测试
[ ] Codex Continuation Protocol 已固定
[ ] Progress / Approval Report 模板已建立
[ ] 至少完成一次从 WP → Test → Progress → Next Action 的闭环演练
```

---

# 8. After M0.5

通过 M0.5 Gate 后：

```text
M1 — Production Data Foundation
```

M1 的低风险本地开发可以进入持续执行模式。

生产 migration 等高风险操作继续进入 Approval Gate。

---

# 9. Current Position

```text
M0 Architecture Freeze          PASSED / BASELINE COMPLETE
M0.5 Autonomous Delivery        READY_FOR_GATE
M0.5-WP01 Project Control Plane PASSED
M0.5-WP02 Restricted Git Automation PASSED
M0.5-WP03 GitHub Actions CI PASSED — PR #2 CI passed
M0.5-WP04 Codex Continuation Protocol PASSED
M0.5-WP05 Automated Continuation Entry Point PASSED
M0.5-WP06 Progress & Approval Reporting PASSED
M1 Production Data Foundation   NOT_STARTED
```
