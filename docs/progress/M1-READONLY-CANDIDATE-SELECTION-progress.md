# M1 Read-only Candidate Selection Progress

版本：v1.2
日期：2026-07-16
状态：`BLOCKED_READONLY_PERMISSION_DENIED`

## 已获批准范围

仅使用 `aiopc_readonly` 和 `READ ONLY` transaction，读取最多 3 条候选摘要；不输出完整联系方式、notes 或 `raw_data`，不执行任何数据库写入。

## 本次执行结果

- Skill 的 pgpass 认证入口已改为通过 Windows ApplicationData API 自动定位，并在同一 PowerShell 进程设置 `PGPASSFILE` 后调用 `psql`。
- resolver 仅检查目标路径存在、属于普通文件且长度大于 0；未读取、输出、哈希、复制或搜索文件内容。
- `pg_isready`：`127.0.0.1:15432` 接受连接，无需重建 tunnel。
- `psql -X -w -v ON_ERROR_STOP=1 / aiopc_readonly`：认证成功，`current_user=aiopc_readonly`、`current_database=aiopc`、`transaction_read_only=on`。
- 未回退到交互式密码输入。
- 只读数据库会话：成功建立并回滚。
- 候选 SQL：已提交到数据库解析/权限检查阶段，返回 `READONLY_PERMISSION_DENIED`，未返回业务行。
- Lead 业务记录读取：0 条。
- 数据库写入：0 行。

## 阻断与下一步

pgpass 与同进程认证已验证成功，无需修改 pgpass 或手工设置 `PGPASSFILE`。当前只读角色缺少候选合规检查所需表的 SELECT 权限。由于不能跳过 Shadow Result/幂等范围排除检查，也没有自动授权权限，候选筛选停止且未生成请求。需单独授予已批准候选筛选所需的最小只读表权限后重跑。
