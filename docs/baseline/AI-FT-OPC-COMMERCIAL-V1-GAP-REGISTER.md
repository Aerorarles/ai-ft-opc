# AI FT-OPC Commercial v1.0 Gap Register

版本：M0-WP01 v1.0
日期：2026-07-11
状态：基线差距登记
适用范围：Commercial v1.0 方向 A（Sell-side / Export Growth）
禁止事项：不授权 production migration、数据库写入、n8n 激活或受控外联以外的真实触达。

| Capability | Current State | Existing Asset | Gap | Risk | Dependency | Target Milestone | Priority |
|---|---|---|---|---|---|---|---|
| Lead Source Intake | PARTIAL | 本地 ingestion、Phase 1 API、历史 n8n intake/search 文件 | 缺少持久化 intake run/source item、来源可追溯性与受控 adapter | 重复/污染输入 | M1 persistence、P3.1 | M1-M2 | P0 |
| Candidate Management | PARTIAL | 历史 candidate triage/promotion 事实、Phase 1 records | 缺正式 Candidate domain model、列表/状态/审计 | 绕过 Review→Promote | M1 data model | M1-M3 | P0 |
| Dedup | LOCAL_WORKING | domain/name heuristic | 缺跨运行实体解析、人工合并和审计 | 误合并/漏合并 | intake persistence | M1-M2 | P1 |
| Enrichment | PRODUCTION_VERIFIED | Lead Enrichment v0.1.7 已封存事实 | 缺受控运行注册、证据/失败审计与产品化接入 | 站点访问阻断、隐私/质量 | M2 controlled workflow | M2 | P1 |
| Scoring | PARTIAL | v0.1 production fact；v0.2-v0.7 local engine | v0.2 shadow persistence、versioned outcome policy 生产接入、差异治理 | 覆盖 v0.1 或不可重放 | M1 shadow/audit | M1-M2 | P0 |
| Review | PARTIAL | memory review queue、Phase 2 API/workbench | 缺持久化、RBAC、审批记录、SLA | 未授权 promote/outreach | M1 review/audit, M3 UI | M1-M3 | P0 |
| Formal Lead | PARTIAL | 历史 Candidate→Review→Promote→leads 事实 | 本地 MVP 未接入正式 promote contract | 生产边界被绕过 | existing v0.1 governance | M2-M3 | P0 |
| Dashboard | PARTIAL | static workbench、Phase 2 API facade | 缺生产 API、认证、运营指标、审计页 | 误以为原型是后台 | M1 data, M3 UI | M3 | P1 |
| Audit | PARTIAL | scoring trace/replay、orchestration events、本地 review history | 缺不可变持久化审计、跨模块 correlation | 无法追责/重放 | M1 audit/idempotency | M1-M2 | P0 |
| CRM Export | MISSING | 仅 Phase 3 设计 | 缺 export job、字段策略、审批、交付记录 | 客户数据泄漏 | M3 data/API | M3-M4 | P1 |
| Email Draft | MISSING | Phase 3 设计 | 缺草稿模型、模板/证据边界、人审 | 不当生成或泄漏 | M3-M5 | M4-M5 | P2 |
| Controlled Email Outreach | MISSING | 安全原则与审批设计 | 缺 approval、dispatch、rate limit、delivery audit | 真实客户/合规风险 | M5 approval/suppression | M5 | P0 gate |
| Suppression | MISSING | Phase 3 设计 | 缺 suppression records、check 与审计 | 违规重复触达 | M5 | M5 | P0 gate |

## 结论

Commercial v1.0 的最大缺口不在本地算法，而在受控生产数据基础：持久化、审计、幂等、权限审批、受控工作流和正式产品界面。M1 应先解决这些 P0 基础，不能直接跳到自动外联。

## 验收标准

每项 Commercial v1.0 必须能力有当前状态、资产、风险、依赖、目标 Milestone 和优先级；当前本地功能不被夸大为生产能力。

## 风险

如果跳过 M1 数据与审计基础，M2-M5 将无法可靠证明 v0.1 未被破坏、shadow 是否可追溯、审核是否有效。

## 回滚原则

M1-M5 均需保持独立 gate；失败时回到最近的可验证本地/只读状态，不修改历史 v0.1 事实。

## 下一步入口

执行 `docs/work-packages/M1-PRODUCTION-DATA-FOUNDATION-PLAN.md` 中经用户批准的单一 Work Package。
