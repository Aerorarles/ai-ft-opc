# M1 Local No-review Shadow Writer Hardening Review

版本：v1.0
日期：2026-07-16
结论：`PASS_LOCAL_ONLY — READY_FOR_READONLY_CANDIDATE_APPROVAL`

## 架构审查

- 符合 Human-in-Control、Database as Source of Truth 和 v0.1 Production Fact 保护。
- writer 只接受注入 client 与严格审批对象，不读取或管理 credentials。
- 不复用会创建 Review Queue 的 Phase 2 write 分支。
- 不修改 schema、`public.leads`、v0.1 Trigger/函数、n8n 或评分配置。

## 写入范围

仅允许未来获批事务写入：idempotency claim、Shadow Run、Result、Diff、最多 5 条 Explanation、Audit，共最多 10 行。SQL 为固定表名和参数化值；不存在任意 SQL/表名入口。

## 后续最小权限矩阵（仅设计，不授予）

| 身份 | 最小能力 | 明确禁止 |
|---|---|---|
| `aiopc_readonly` | 候选所需 Lead 字段的只读表达式；Shadow Result/幂等存在性只读；最多返回 3 条摘要 | INSERT/UPDATE/DELETE/DDL、完整 contact/raw_data 输出 |
| 临时 writer | 精确 Lead 最小评分字段只读；六张批准表 INSERT；写后精确只读验证 | `public.leads` 写入、Review/Intake 写入、DDL、GRANT、角色管理 |

是否以列权限、受控 view 或管理员提供的只读入口实现，必须在下一权限审批中明确；本工作包不创建 view、role 或 GRANT。

## 停止与回滚

批准缺失/过期、tenant/Lead/hash/version/scope 漂移、候选不合格、幂等异常、行数超限、敏感字段、v0.1 变化或 SQL 异常均停止。事务内失败自动 rollback；提交后异常只能申请独立回滚，不自动清理历史。

## 当前批准状态

没有有效 Shadow Write 请求，没有 writer 权限，也没有数据库写入授权。下一门仅为最多 3 条候选的最小字段只读批准。
