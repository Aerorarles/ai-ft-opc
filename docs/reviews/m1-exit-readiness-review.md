# M1 Exit Readiness Review

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：M1 Production Data Foundation 的本地交付收口与受控实施准入审查。
禁止事项：本审查不授权数据库连接、只读预检、SQL 执行、migration 执行、生产写入、n8n 激活、Docker/服务器操作或真实外联。

## 已确认完成的本地交付

| Work Package | 交付 | 合并证据 |
| --- | --- | --- |
| M1-WP01 | Production Persistence Contract | PR #3 |
| M1-WP02 | Intake Persistence memory contract | PR #4 |
| M1-WP03 | Shadow Scoring Persistence memory contract | PR #5 |
| M1-WP04 | Review Queue Persistence memory contract | PR #6 |
| M1-WP05 | Cross-module Audit Foundation | PR #7 |
| M1-WP06 | Idempotency and audit-only replay safety | PR #8 |
| M1-WP07 | DRAFT migration review package | PR #9 |

上述交付证明本地行为契约、脱敏边界、trace、幂等、人工审核和 SQL 草案审查已具备。它们不证明生产数据库 schema 已存在，也不等价于生产持久化已经实施。

## M1 Exit Gate 评估

| Exit 条件 | 结论 | 证据或缺口 |
| --- | --- | --- |
| Traceability | 本地满足 | Intake/Shadow/Review/Audit 的 trace 与摘要契约已覆盖 |
| Idempotency | 本地满足 | tenant-scoped key、终态保护、audit-only replay 已有测试 |
| v0.1 保护 | 本地满足 | Shadow 与静态 SQL 检查不修改 `public.leads` 官方评分事实 |
| 受控生产持久化 | 未满足 | 无获批数据库预检、无统一正式 migration、无生产 adapter 实施 |
| 生产回滚可操作性 | 未满足 | 尚无基于真实 schema、数据量和备份策略的获批回滚方案 |

**结论：M1 不能标记为 PASSED。** 当前应保持 `IN_PROGRESS`，等待单独批准的受控生产持久化步骤。

## 唯一建议的下一步批准包

如要推进，用户需要单独批准一个“数据库只读预检”工作包，且批准范围必须限于：

1. 指定数据库的只读 schema、extension、表、约束、索引与权限核对；
2. 不读取 secrets、不读取业务客户数据、不执行任何写入；
3. 输出 DRAFT-005/006/007 的统一正式 migration 建议、影响范围与精确回滚草案；
4. 预检完成后再次等待独立的 migration execution 批准。

数据库只读预检不等于 migration execution，也不授权 production write、n8n 激活或真实外联。

## 已知风险

- 现有 DRAFT-005/006/007 不能直接视为已部署 schema；
- `uuid_generate_v4()`、外键目标、表命名和 tenant/RBAC 设计必须以实际只读预检为准；
- 生产执行前需要评估锁表、索引、事务时长、备份、审计保留和失败回滚；
- 未经批准不得通过代码或本地 memory 模型推断生产数据库事实。

## 验收标准

- 项目控制、Current Status 与 M1 实际状态一致；
- 明确记录本地完成项与生产缺口；
- 明确区分数据库预检批准与 migration execution 批准；
- 不包含任何数据库连接、SQL 执行或生产副作用。

## 回滚原则

本审查仅新增文档和控制记录；回滚只需撤销该文档提交，不涉及生产数据或 schema。

## 下一步入口

等待用户明确决定：保持 M1 停止，或仅批准受限数据库只读预检。M2 规划或实施不得自动开始。
