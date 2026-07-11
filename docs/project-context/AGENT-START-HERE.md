# AI FT-OPC Agent Start Here

## 1. 必读顺序

1. [AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md](AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md)
2. [AI-FT-OPC-CURRENT-STATUS.md](../project-status/AI-FT-OPC-CURRENT-STATUS.md)
3. 当前 Milestone / Work Package 文件
4. 仅在需要历史实现细节时，再读取 project handover、architecture roadmap、master memory、Phase 3 设计及本次任务涉及的 workflow / SQL / docs / migration

最新 master architecture 是当前最高主体架构约束；历史文件用于已发生事实、专项设计和验收记录，不得取代最新 master architecture。

## 2. 当前项目状态

- 当前 Milestone：M0.5 — Autonomous Delivery Foundation。
- 当前 Work Package：M0.5-WP03 — GitHub Actions CI（IN_PROGRESS：PR #2 等待 CI）。
- 已确认资产：Lead Agent v0.1 生产事实、Lead Enrichment v0.1.7 已封存事实、Phase 1 + Phase 2 本地 MVP、v0.2-v0.7 scoring engine、本地 orchestration runtime、Phase 3 安全架构设计。
- 当前允许：受限本地文档与项目控制面工作、已批准范围内的本地代码/测试工作、后续经批准的 M1 设计与草案准备。
- 未经批准不得做：数据库 migration 或写入、Docker/服务器操作、n8n 发布或激活、批量 Enrichment、真实客户触达、Git 写操作、付费数据源真实查询。

## 3. 当前最高优先级

M0.5-WP03 GitHub Actions CI：PR #2 已创建，CI workflow 已完成本地验证并等待远程 GitHub Actions 检查。禁止直接 push main、force push、自动 merge、共享分支 rebase、远程历史重写、生产服务/数据库/n8n 配置变更；在 CI 通过前不得开始 WP04。

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
