# M1 Closeout Progress

版本：v1.0
日期：2026-07-16
状态：`REQUEST_APPROVAL — CANDIDATE_READ_PERMISSION`

## 收尾目标

M1 不再新增 Shadow 架构。仅固定可复现代码基线、通过候选只读权限门、通过精确单 Lead writer/write 门，并在一次成功验证后立即转入 M2。

## 已完成

- 创建 `codex/m1-closeout-shadow-write` 分支并保留既有用户工作树；
- 锁定 `pg=8.22.0`，实现固定 endpoint/role 的真实 client adapter；
- request schema 将 `aiopc_shadow_writer_m1` 纳入 scope hash；
- adapter 拒绝密码、连接串、任意 SQL、任意表名、角色漂移和自动重试；
- 新增 adapter 安全测试，现有 writer fake-client 与 typecheck 通过；
- 生成第一道列级只读权限审批请求。

## Frozen Artifact Hashes

- reproducible baseline commit：`b7997a4`（`codex/m1-closeout-shadow-write`）；
- writer execution package SHA-256：`ac68274a306ba39f89d13393c7c41f60b107fba3704688fb89405f82dbd93559`；
- scoring config artifact SHA-256：`6b27a3b216ed74e03f12de20cb1529dae6c45890fddd290fc3ff02b4135f1825`；
- runtime config checksum：`926d3074d0aa4dd34049b2e38df34a3949c2fcac4fc45c91f22f23dc384adfd4`。

## 未执行

- 未执行 GRANT/REVOKE；
- 未重新运行候选业务查询；
- 未生成新的精确 Shadow Write 请求；
- 未创建或启用 writer role；
- 未执行数据库写入、n8n、Docker、服务器或外联操作。

## 下一步

Owner 审批 `M1-CANDIDATE-READ-PERMISSION v1.0` 后，由数据库管理员执行精确列级 GRANT；随后运行最多 3 条候选筛选、生成 4 小时有效请求并立即撤销候选权限。
