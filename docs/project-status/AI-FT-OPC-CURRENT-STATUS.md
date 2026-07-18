# AI FT-OPC Current Status

版本：M1 Closeout v1.0
日期：2026-07-16
状态：`REQUEST_APPROVAL — M1-CANDIDATE-READ-PERMISSION-GATE`

## Current Milestone

`M1 — Production Data Foundation / IN_PROGRESS`

M1 Release Candidate 已受控执行并完成元数据复核：11 个 M1 表存在，约束与索引通过检查，`public.leads` 的 v0.1 Trigger 与正式评分事实未改变；migration 临时权限已回收。

M1 现已进入止损收尾，只允许两道数据库门：候选列级只读权限，以及绑定精确 Lead 的单次 writer/write 权限。成功一次后立即关闭 M1 并转入 M2，不再扩展 Shadow 架构。

## Current Work Package

`M1-CANDIDATE-READ-PERMISSION-GATE / REQUEST_APPROVAL`

- pgpass 同进程认证已通过：`aiopc_readonly / aiopc / transaction_read_only=on`；
- 候选查询因缺少所需列级 SELECT 权限返回 `READONLY_PERMISSION_DENIED`；
- 精确 GRANT/REVOKE 请求见 `docs/approvals/M1-CANDIDATE-READ-PERMISSION-APPROVAL-REQUEST.md`；
- Owner 尚未批准权限扩展，Skill 不自动执行 GRANT。

## Reproducible Baseline

- 分支：`codex/m1-closeout-shadow-write`；
- `pg=8.22.0` 已显式锁定；
- 真实 adapter 固定 `127.0.0.1:15432 / aiopc / aiopc_shadow_writer_m1`；
- request schema 绑定 writer role、writer/config/candidate/input/scope hash；
- adapter 拒绝密码、连接串、任意 SQL、任意表名和重试；
- Draft PR `#12` 已创建；分支已推送但未合并。

## Invariants

- v0.1 `score / grade / priority` 仍是生产评分事实；
- 锚点：`tenant_id=local`、`config_version=v1`、`engine_version=0.6`、outcome policy=`not-configured`；
- 单次最多 1 tenant、1 Lead、6 张 Shadow/Audit 表、10 行；
- 不创建 Review Queue，不修改 `public.leads`，不启用 n8n/Docker/服务器或外联。

## Next Gate

Owner 精确批准 M1 Candidate Read Permission v1.0 后，由数据库管理员执行列级 GRANT；Skill 随后筛选最多 3 条候选、生成 4 小时有效的精确请求并立即撤销候选权限。该批准不包含 writer 或数据库写入。

## Latest Verification

- `npm.cmd run test:m1-shadow-client`：PASS；
- `npm.cmd run test:m1-shadow-writer`：PASS；
- `npm.cmd run typecheck`：PASS；
- 数据库写入：0；真实 Lead 摘要读取：0。
