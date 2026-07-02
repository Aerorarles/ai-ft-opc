# AI FT-OPC 项目上下文目录

本目录用于给 ChatGPT、Codex、Claude Code、OpenClaw 和未来 MCP Agent 提供固定顺序的项目上下文入口。

## 文件说明

- `AGENT-START-HERE.md`：每次任务首先阅读，提供当前状态和安全红线。
- `AI-FT-OPC-project-handover.md`：项目交接、环境、历史、已完成工作和操作规则。
- `AI-FT-OPC-architecture-roadmap.md`：主体架构、双向 Buyer-Supplier 路线、社交媒体信号层、企业核验层、产品化路线。

## 阅读顺序

所有 Agent 必须按以下顺序阅读：

1. `AGENT-START-HERE.md`
2. `AI-FT-OPC-project-handover.md`
3. `AI-FT-OPC-architecture-roadmap.md`
4. 本次任务涉及的 workflow、SQL、docs 或 migration

## 冲突处理

两份完整权威文档发生冲突时，以更新时间更晚、且经用户明确确认的内容为准。

## 更新规则

文档更新必须保留更新时间和修改摘要。不得把密钥、凭据、密码或客户敏感数据写入这些文档。
