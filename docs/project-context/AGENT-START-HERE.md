# AI FT-OPC Agent Start Here

## 1. 必读顺序

1. 本文件
2. AI-FT-OPC-project-handover.md
3. AI-FT-OPC-architecture-roadmap.md
4. 本次任务涉及的 workflow / SQL / docs / migration

## 2. 当前项目状态

- 当前阶段：Lead Agent v0.1 已稳定闭环、Git 归档、服务器同步完成。
- 当前允许：v0.2 架构设计、数据模型草案、评分配置化设计、权限与审计设计、管理后台 MVP 信息架构、Safe Change Skill 设计、MCP 最小权限规划。
- 当前未经批准不得做：数据库 migration、数据库写入、Docker/服务器操作、n8n 发布或激活、批量 Enrichment、真实客户触达、Git commit/push/pull、付费数据源真实查询。

## 3. 当前最高优先级

Lead Scoring v0.2 的架构设计：
- 评分配置化；
- 关键词、国家、行业、权重规则；
- 配置表；
- 权限与审计；
- 变更影响与回滚；
- 管理后台 MVP 边界。

## 4. 核心架构

ChatGPT：战略、架构、风险、验收；
Codex：本地受限开发、静态审查、受限 Git；
n8n：稳定业务流程执行；
PostgreSQL：业务事实、状态、评分、审计；
人工：审批、商业判断、客户关系、所有真实外部行为。

## 5. 硬性安全边界

- 不读取或提交配置环境文件、密钥、凭据或密码。
- 未经明确批准，不运行数据库写入、migration、Docker、服务器命令、n8n 发布、Git 写操作。
- 不自动邮件、WhatsApp、LinkedIn、表单提交、报价或任何真实客户触达。
- 数据库变更必须先给 SQL、影响范围、回滚建议，并等待批准。
- n8n 必须遵循：设计 → 静态审查 → inactive 导入 → 局部验证 → 回写前审查 → 单条验证 → 导出 JSON → 去除凭据 → Git 归档。
- Git 只能精确暂存指定文件；禁止 git add .、git add -A、git commit -a、force push。
- 出现冲突、远程分叉、工作树不干净或权限不确定时停止并报告。

## 6. 当前已封存版本

Lead Enrichment v0.1.7：

workflows/n8n/lead-enrichment-v0.1.7-single-lead-test-contact-candidate-quality-hardening.json

历史污染修正脚本：

scripts/manual/fix-smurfit-westrock-enrichment-v0.1.7-history.sql

归档提交：

ba0afb87e7daffdfb3f9e0f6ba5a8e9f59b9db39

## 7. 新 Agent 的标准启动动作

阅读完成后，先输出：
1. 当前项目阶段；
2. 本次任务是否符合主体架构；
3. 影响范围；
4. 风险；
5. 是否需要用户明确批准；
6. 验收标准与回滚方式。

未完成上述确认前，不得进行写操作。

## 8. 更新规则

每完成一个项目里程碑，只更新：
- 当前阶段；
- 已完成 / 已归档内容；
- 当前 P0；
- 当前允许与禁止事项；
- 下一阶段入口。

完整历史与长期路线保留在另外两份权威文档中。
