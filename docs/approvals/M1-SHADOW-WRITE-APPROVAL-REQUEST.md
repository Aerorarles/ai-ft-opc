# M1 Single Lead Shadow Write Approval Request

版本：v1.2
日期：2026-07-16
状态：`EXPIRED_UNSELECTED_REQUEST — NOT APPROVABLE`

## 结论

2026-07-15 生成的请求未绑定真实 `lead_id`/`tenant_id`，且已被新的严格请求 schema 取代。原 request ID、trace ID、幂等键、scope hash 和有效期不得批准、恢复或复用。

本地 no-review writer 已完成加固，但本文件不授权：

- 读取真实 Lead 记录；
- writer role、权限授予或 adapter 启用；
- 任何数据库写入；
- Review Queue、Intake、n8n、Docker、服务器或外联。

## 下一审批门

先单独批准最多 3 条候选的最小字段只读筛选。获得实时合格候选后，使用 `scripts/shadow-write/build-request.ps1` 生成全新请求。新请求必须绑定：

- `tenant_id=local` 与一个精确 Lead UUID；
- candidate evidence hash 与 input snapshot hash；
- config artifact SHA-256、runtime config checksum、engine/outcome 锚点；
- writer package SHA-256；
- 精确六表 allowlist、逐表限制和总计最多 10 行；
- approval identity/time、scope hash、expiry 与 rollback owner。

新请求仍需用户再次明确批准，不能由本文件推断。
