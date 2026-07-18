# M1 pgpass Authentication Entry Hardening Progress

日期：2026-07-16
状态：`IMPLEMENTED_AND_LIVE_VERIFIED`

## 实施结果

- 新增统一入口 `.agents/skills/ai-ft-opc-shadow-write/scripts/resolve-pgpass.ps1`。
- 使用 Windows `Environment.GetFolderPath(ApplicationData)` 构造 `postgresql\pgpass.conf` 路径。
- 只检查存在性、普通文件类型和非零长度；不读取内容、不输出路径或哈希、不复制文件、不搜索密码、不读取 `.env`。
- resolver 只返回完整路径；preflight 与候选入口通过 dot-source 在当前 PowerShell 进程取得路径并设置 `PGPASSFILE`。
- `PGPASSFILE` 设置后由同一进程立即进入数据库核心脚本，且所有 `psql` 调用继续使用 `-X -w -v ON_ERROR_STOP=1`。
- Skill 文档已明确本地运行边界；Codex Cloud 不得使用本机 pgpass。

## 验证

- PowerShell AST：通过。
- `npm.cmd run test:m1-shadow-pgpass`：静态与元数据安全测试通过。
- `npm.cmd run test:m1-shadow-pgpass:live`：本机用户上下文只读认证测试通过。
- `npm.cmd run typecheck`：通过。
- resolver 本地运行：通过，只返回 pgpass 完整路径，不输出内容。
- endpoint readiness：`127.0.0.1:15432` 正常接受连接，无需重新创建 tunnel。
- Windows identity：`DESKTOP-UHKDHRM\Jklee`。
- PostgreSQL client：`C:\Program Files\PostgreSQL\16\bin\psql.exe`，PostgreSQL 16.14。
- 只读身份连接：`aiopc_readonly / aiopc / transaction_read_only=on`，成功并回滚。

## 安全结果

- 数据库写入：0。
- `public.leads` 修改：否。
- Shadow Writer 启用：否。
- Shadow Write：未执行。
- 候选查询已到达数据库，但因候选合规检查所需表缺少只读权限而返回 `READONLY_PERMISSION_DENIED`。
- 当前不能生成候选绑定请求，因此尚未进入 `REQUEST_APPROVAL`。
