# AI FT-OPC Agent Start Here

<!-- 2026-07-16: M1 进入两道门止损收尾；pgpass/只读身份已通过，当前等待候选列级 SELECT 权限批准。 -->

## 1. 必读顺序

1. [AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md](AI-FT-OPC-MASTER-ARCHITECTURE-COMMERCIAL-ROADMAP-v1.0-LATEST.md)
2. [AI-FT-OPC-CURRENT-STATUS.md](../project-status/AI-FT-OPC-CURRENT-STATUS.md)
3. `.project-control/CURRENT-WORK-PACKAGE.yaml`
4. `.project-control/NEXT-ACTION.yaml`
5. 当前任务涉及的 progress、review、workflow、SQL 或 migration

冲突时遵循：用户最新明确指令 → 最新 Master Architecture → 当前 Project Control/Execution Report → 历史文档。

## 2. 当前状态

- Milestone：`M1 — Production Data Foundation / IN_PROGRESS`。
- Work Package：`M1-CANDIDATE-READ-PERMISSION-GATE / REQUEST_APPROVAL`。
- M1 Release Candidate 已执行一次；11 个 M1 表已完成元数据验证，migration 临时权限已回收。
- 本地 no-review writer、固定 pg 8.x client adapter、严格请求 schema、hash/role 绑定、行数限制与 fake-client 测试已完成。
- 旧 `UNSELECTED` 请求已失效，不能批准或复用。

## 3. 当前最高优先级

pgpass 与 READ ONLY identity preflight 已通过。当前只允许请求 Owner 批准 `M1-CANDIDATE-READ-PERMISSION v1.0` 的精确列级 GRANT/REVOKE；未经批准不得授予权限或运行候选业务查询。

筛选前不得创建新请求；筛选后只为一个精确 Lead 和 `tenant_id=local` 生成新请求。该请求仍不是写入批准。

## 4. 不可破坏的不变量

- `public.leads` 与 v0.1 `score / grade / priority` 不得改变。
- Shadow grade/priority diff 为 `not_evaluated`。
- 单次最多 1 个 tenant、1 个 Lead、6 张 Shadow/Audit 表、10 行。
- 不创建 Review Queue 或 Intake 数据。
- 不读取/展示 `.env`、`pgpass`、密码、token、credentials、Cookie、备份或完整联系信息。

## 5. 未经独立批准不得执行

- 真实 Lead 业务字段读取；
- writer role、GRANT/REVOKE/LOGIN 或 adapter 启用；
- 任何数据库写入、migration、清理或回滚；
- n8n、Docker、服务器、付费 API、真实外联；
- Git merge、rebase、reset 或 force push；本次收尾计划仅授权精确分支 commit、push 与 Draft PR。

## 6. 验收与停止条件

只读候选阶段仅输出允许的候选摘要与 hash，最多 3 条。权限不足、对象/版本/hash 漂移、候选不合格、出现敏感字段或范围扩大时立即停止。任何未来写入必须重新获得绑定精确目标、版本、writer hash、六表范围、10 行上限和回滚负责人的批准。
