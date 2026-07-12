# M1-WP07 Migration Draft Review Pack

<!-- 2026-07-12: PR #9 GitHub Actions CI PASSED. Second-layer review and explicit user approval remain required before any database preflight or execution. -->

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：M1 SQL 草案、影响范围、预检与回滚审查。
禁止事项：不执行 SQL、不连接数据库、不创建真实表、不修改 v0.1 评分函数或 trigger、不激活 n8n、不操作 Docker/服务器、不进行真实外联。

## 变更清单

- 新增 `DRAFT-007-m1-intake-audit-idempotency.sql`；
- 新增静态 SQL 草案测试；
- 新增 M1-WP07 设计文档与进度记录；
- 更新项目控制面，记录 M1-WP06 已由用户合并、M1-WP07 已批准执行。

## 静态审查重点

- 不修改 `public.leads`，不写入 v0.1 `score`、`grade`、`priority`；
- 不包含 trigger、函数或破坏性 SQL；
- Intake、Idempotency、Audit 均带 tenant/trace/唯一约束；
- 所有可保存内容为摘要，不含联系信息原文、raw payload 或运行时敏感响应；
- SQL 仅作为 DRAFT，未连接、未执行、未导入任何数据库。

## 风险与待确认事项

- 无法从仓库确认生产数据库扩展、表定义、权限、数据量、锁表窗口或历史数据；
- DRAFT-005/006 与 DRAFT-007 必须在执行前统一为一套正式迁移设计；
- `M1-WP01-PRODUCTION-PERSISTENCE-CONTRACT-DESIGN.md` 未在预期路径找到，需在正式 SQL 评审前确认权威来源；
- 未来回滚必须单独提出，明确审计保留与外键依赖，不能使用自动或破坏性方式。

## 本地验收

- 运行 `test:m1-migration-draft` 进行文本级安全检查；
- 运行 M1 回归、Phase 2 回归与 `typecheck`；
- 审查 `git diff --check` 和暂存文件清单；
- GitHub Actions CI 通过后仍需第二层审查与用户批准。

## 下一步入口

M1-WP07 完成后，不自动执行 migration。任何数据库连接、预检、执行、回滚、n8n 接入或生产变更均需新的明确批准。
