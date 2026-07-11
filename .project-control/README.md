# AI FT-OPC Project Control Plane

版本：M0.5-WP01 v1.0
状态：本地项目控制层，等待第二层审查
适用范围：Codex、ChatGPT 与未来受控 Agent 的项目状态读取和执行决策
禁止事项：不保存 secret，不替代业务数据库，不作为生产配置，不授予任何外部系统权限。

`.project-control/` 是机器可读的项目状态层。它回答当前 Milestone、当前 Work Package、下一动作、可执行范围、禁止范围与审批 Gate，从而避免 Agent 依据过期文档自行扩大权限。

这些文件：

- 不是业务数据库；业务事实仍属于经过批准的 PostgreSQL 数据层。
- 不是生产配置；不得放入数据库连接、API key、password、token、cookie、credential 或环境变量。
- 不替代用户明确批准；任何高风险动作仍必须经过 `APPROVAL-GATES.yaml` 对应的人工 Gate。
- 不触发业务逻辑、n8n、Docker、服务器、数据库或 Git 写操作。

读取顺序：先读项目根 `PROJECT-CONTROL.yaml`，再读当前 Milestone、Work Package、Next Action、Execution Policy 与 Approval Gates。若与最新 master architecture 冲突，用户最新明确指令优先，其次是最新 master architecture。

## 验收标准

控制文件可由本地 YAML parser 读取，交叉引用一致，且只表达项目控制状态。

## 风险

控制面是文件级状态，不是并发锁或生产审计系统。多 Agent 并行修改前仍需要人工协调与 Git 审查。

## 回滚原则

只通过新的受审计文档修订改变控制状态；不删除历史项目事实。

## 下一步入口

M0.5-WP01 完成后等待第二层审查；不得自行开始 M0.5-WP02。
