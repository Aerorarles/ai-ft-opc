# Codex Continuation Protocol

版本：M0.5-WP04 v1.0
状态：PASSED
适用范围：每次 Codex 启动、恢复或接续 AI FT-OPC Work Package 时的本地控制流程。
禁止事项：本协议不授予生产数据库、migration、n8n、Docker、服务器、真实外联、secret 或 main branch merge 权限。

## 启动顺序

1. 读取最新 master architecture。
2. 读取 `.project-control/PROJECT-CONTROL.yaml`。
3. 读取当前 Milestone、Work Package、Next Action、Execution Policy 与 Approval Gates。
4. 读取 Current Status。
5. 仅读取当前 Work Package 所需的非敏感代码、文档与测试文件。
6. 检查工作树和远程状态；Git 写操作前必须验证专用分支、精确暂存范围和停止条件。

## 执行循环

```text
Inspect
→ confirm allowed scope
→ implement only that scope
→ run local non-production validation
→ fix only in-scope failures
→ self review
→ update progress/current control state
→ exact-file Git delivery only when approved
→ wait at the next approval or review gate
```

## 必须停止的条件

- 需要读取 secret、credential、token、cookie、`.env` 或数据卷。
- 需要生产数据库写入、migration、服务器、Docker、n8n 激活、付费 API 或真实外联。
- 当前 Work Package 不明确、范围扩大、架构冲突、Git 冲突、远程分叉、权限异常或未解决的测试失败。
- 需要直接 push main、force push、自动 merge、共享分支 rebase 或远程历史重写。

## 完成要求

- 记录实际修改、验证结果、已知限制、风险、回滚方式和下一动作。
- 仅在 Project Control 与 Current Status 一致时标记 Work Package 完成。
- 人工 review、main branch merge、M1 或任何 Approval Gate 前必须等待明确批准。

## 验收标准

新的 Agent 可仅通过 master architecture、Project Control、Current Status 与当前 Work Package 判断是否可继续、必须停止或需要批准。

## 风险

本协议是行为约束，不是操作系统级权限隔离；工具权限仍须遵守用户指令和实际环境限制。

## 回滚原则

协议修订通过新的受审计文档和工作分支提交完成，不改写历史控制记录。

## 下一步入口

M0.5 Gate Review。
