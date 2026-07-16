# M1 Restricted Database Read-only Preflight Report

<!-- 2026-07-12: PR #11 GitHub Actions CI PASSED. No database connection was attempted; the client-entry prerequisite remains unresolved. -->

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：已获用户批准的 PostgreSQL 只读 schema 预检准备。
禁止事项：不读取 `.env`、credentials、API Key、Cookie 或数据卷；不读取业务客户记录；不执行任何写入、migration、DDL/DML、n8n、Docker、服务器或真实外联操作。

## 批准范围

允许的目标仅为数据库元数据：版本、extension、schema、表、列、约束、索引和当前角色权限。预检不读取业务表记录，不输出连接参数或凭据，不执行任何写入。

## 客户端验证结果

在当前 Windows 工作树中已确认：

- `psql` 可用，版本为 PostgreSQL 18.4；
- `pg_isready` 可用，版本为 PostgreSQL 18.4；
- 未读取 `configs/.env` 或任何凭据来源；
- 因此未尝试数据库连接、端口探测、认证或 SQL 查询。

## 结论

客户端安装阻塞已解除。当前仍不能通过猜测 host、port、database、user 或密码来继续，也不能使用 Docker 作为替代连接路径。数据库访问必须等待新的、边界明确的只读批准。

## 后续批准条件

详见 `m1-database-readonly-access-approval-request.md`。批准后，Codex 只会执行已批准的元数据查询，并输出：对象清单、DRAFT-005/006/007 对齐差异、migration 影响范围、预检结论和回滚建议。迁移执行仍需再次单独批准。

## 风险与回滚

本次没有数据库副作用。风险仅是因为缺少真实 schema 元数据，当前 DRAFT 不能提升为正式 migration。回滚不适用。

## 下一步入口

等待人工提供已批准的只读客户端入口；在此之前保持 STOP，不进入数据库连接、M2 或 migration execution。
