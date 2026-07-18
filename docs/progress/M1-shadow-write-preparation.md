# M1 Single Lead Shadow Write Preparation Progress

版本：v1.4
日期：2026-07-16
状态：`BLOCKED_READONLY_PERMISSION_DENIED`

## 已完成

- Shadow Skill 的 PostgreSQL 入口已统一调用 `resolve-pgpass.ps1`。
- resolver 使用 Windows API 获取 ApplicationData，只返回路径；入口以 dot-source 在当前 PowerShell 进程设置 `PGPASSFILE`。
- `psql` 保持 `-X -w -v ON_ERROR_STOP=1`，禁止交互式密码回退。
- 认证失败已划分为约定的 pgpass、密码不匹配和一般连接失败类别。
- 本地静态与 live 安全测试已验证同进程路径解析、元数据检查、日志脱敏、`aiopc_readonly / aiopc` 身份和只读 SQL 防护。
- `.codex/config.toml` 已保留全部普通环境继承，同时排除 key、secret、token 与 `PGPASSWORD`。
- Shadow Writer、请求 schema、最多 3 条候选筛选及本地回滚测试仍保持不变。

## 未执行

- 已建立 `aiopc_readonly` 只读会话并确认 `transaction_read_only=on`。
- 候选查询因合规检查所需表缺少 SELECT 权限而返回 `READONLY_PERMISSION_DENIED`，未读取真实 Lead 摘要。
- 未生成新的可审批 Shadow Write 请求。
- 未启用 writer role，未执行 Shadow Write、Review Queue、n8n、Docker、服务器或外联操作。
- 未修改 `public.leads` 或 v0.1 评分事实。

## 下一步

pgpass 已完成自动定位与 live 验证，不需要用户再次设置 `PGPASSFILE`。下一步需要数据库管理员为 `aiopc_readonly` 补齐候选合规查询所需的最小 SELECT 权限；随后重跑最多 3 条候选筛选。只有实时合格候选产生后，状态才能进入 `REQUEST_APPROVAL`。
