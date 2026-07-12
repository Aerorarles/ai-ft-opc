# M1-WP07 Migration Draft Review Design

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：M1 数据持久化的 SQL 草案静态审查，不包含数据库连接或执行。
禁止事项：不得执行任何 SQL、不得连接数据库、不得修改 `public.leads` 的 v0.1 正式评分字段、不得修改评分函数/trigger、不得激活 n8n 或操作 Docker/服务器。

## 本次审查对象

- `DRAFT-005-lead-scoring-v0.2-shadow-mode.sql`：Shadow run/result/diff/explanation 草案；
- `DRAFT-006-phase2-review-queue.sql`：Review queue/decision 草案；
- `DRAFT-007-m1-intake-audit-idempotency.sql`：本 WP 新增的 Intake、统一幂等声明和最小 Audit event 草案。

三份文件均为审查材料，不是可直接上线的 migration 序列。未来正式迁移必须先合并字段定义、命名、依赖、约束和回滚策略，不能不经复审地按文件顺序执行。

## DRAFT-007 设计结论

- Intake 以 run/source item/candidate 三层存储脱敏摘要，候选固定为 `pending_review`；
- 统一幂等表按 `tenant_id + operation_type + idempotency_key` 唯一，生产 adapter 必须在同一事务中声明并完成对应业务写入；
- Audit 表按 tenant/trace/sequence 建立唯一约束，replay 仅审计已存事件，不重新执行 Intake、Scoring、Review 或 Agent；
- 草案不保存原始 payload、完整联系信息、HTML、headers、cookies、stack、response、credentials、secrets 或备注原文；
- 草案不触碰 `public.leads`、v0.1 score/grade/priority、评分函数或 trigger。

## 已发现的整合风险

1. DRAFT-005/006 是早期独立草案，尚未完全包含后续 M1 契约中的 tenant、organization、actor、idempotency 和版本锚点字段。正式 migration 前必须统一字段模型。
2. 现有草案使用 `uuid_generate_v4()`；实际数据库扩展状态未知，执行前必须只读预检，不能假设扩展存在。
3. DRAFT-005/006 的外键与 `public.leads` 事实表有关；表、主键类型与现有约束必须在执行前核验，不能从代码仓库推断生产 schema。
4. Audit payload 的敏感字段禁止目前由应用层递归校验；若未来需要数据库层强制，必须单独审查 JSONB 校验策略、性能与误报风险。
5. 跨表幂等只有在同一事务、唯一约束和冲突处理策略同时实施时才成立；本 WP 不实施该 adapter。

## 执行前预检与验收门槛

正式实施前，必须获得单独用户批准，并完成：

1. 目标数据库版本、schema、扩展、权限和现有对象的只读预检；
2. 三份 DRAFT 的统一化审查，消除重复表、字段漂移和约束冲突；
3. 精确影响范围、锁表风险、事务时长、索引创建策略和备份确认；
4. 逐表回滚草案、保留审计历史的决策与验证步骤；
5. 单独、隔离的验证环境；确认不修改 v0.1 评分事实；
6. 人工批准后才可执行一次受控 migration。

## 验收标准

- DRAFT-007 具有 draft 标记、事务边界、表/索引/唯一约束与敏感字段边界；
- 静态测试确认没有 `public.leads` 修改、trigger、函数或破坏性语句；
- 现有 Phase 2 和 M1 本地测试继续通过；
- 审查包列明假设、风险、预检、回滚与批准门槛。

## 回滚原则

本 WP 未执行数据库写入，因此无需数据回滚。未来任何生产回滚必须单独设计，且不得在此草案中隐含或自动执行。

## 下一步入口

本 WP 完成后等待 PR、CI、第二层审查和用户批准。M1 退出门槛或任何真实数据库实施均需新的明确授权。
