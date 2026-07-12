# M1 Restricted Database Read-only Preflight Report

<!-- 2026-07-12: PR #11 GitHub Actions CI PASSED. No database connection was attempted; the client-entry prerequisite remains unresolved. -->

版本：v1.0
日期：2026-07-12
状态：BLOCKED
适用范围：已获用户批准的 PostgreSQL 只读 schema 预检准备。
禁止事项：不读取 `.env`、credentials、API Key、Cookie 或数据卷；不读取业务客户记录；不执行任何写入、migration、DDL/DML、n8n、Docker、服务器或真实外联操作。

## 批准范围

允许的目标仅为数据库元数据：版本、extension、schema、表、列、约束、索引和当前角色权限。预检不读取业务表记录，不输出连接参数或凭据，不执行任何写入。

## 实际检查结果

在当前 Windows 工作树中已确认：

- `psql` 不在可用命令路径；
- `pg_isready` 不在可用命令路径；
- 常见本地 PostgreSQL 客户端安装目录未发现可用客户端；
- 项目非敏感路径中未发现可直接复用的只读元数据预检脚本；
- 未读取 `configs/.env` 或任何凭据来源；
- 因此未尝试数据库连接、端口探测、认证或 SQL 查询。

## 结论

预检被安全阻断。当前不能通过猜测 host、port、database、user 或密码来继续，也不能使用 Docker 作为替代连接路径。

## 最小人工解除条件

请由环境管理员完成以下任一项，而不要在聊天或仓库中提供密钥：

1. 在运行 Codex 的环境中安装并暴露 PostgreSQL 客户端，使 `psql` 可用；或
2. 提供一个已配置的、只读且不暴露凭据的客户端启动入口；或
3. 指定一个受控终端环境，其中只读客户端和认证已由管理员配置。

恢复后，Codex 只会执行已批准的元数据查询，并输出：对象清单、DRAFT-005/006/007 对齐差异、migration 影响范围、预检结论和回滚建议。迁移执行仍需再次单独批准。

## 风险与回滚

本次没有数据库副作用。风险仅是因为缺少真实 schema 元数据，当前 DRAFT 不能提升为正式 migration。回滚不适用。

## 下一步入口

等待人工提供已批准的只读客户端入口；在此之前保持 STOP，不进入数据库连接、M2 或 migration execution。
