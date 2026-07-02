# Lead Scoring v0.7 System Architecture

版本：v0.7-draft
日期：2026-07-01
状态：SaaS 产品化系统边界设计，本地实现 API facade
适用范围：API Layer、Scoring Engine、Execution Context、Event Sourcing、Replay Control Plane、Persistence Layer、未来 n8n 边界
禁止事项：不部署 server，不接数据库，不接 n8n，不写 migration，不调用外部 API，不读取 secrets。

## 1. 系统分层

```text
API Layer
-> Scoring Engine Layer
-> Execution Context Layer
-> Event Sourcing Layer
-> Replay Control Plane
-> Persistence Layer (logical)
-> Future n8n Integration Boundary
```

## 2. API Layer

职责：

- 接收 tenant_id、lead、config_version_id、run_mode；
- 做租户配置隔离；
- 生成 request_trace_id / idempotency_key；
- 调用 scoring engine；
- 返回 productized response；
- 不计算规则。

当前实现：`scoreLeadAPI()` 本地函数，不启动 HTTP 服务。

## 3. Scoring Engine Layer

职责：

- feature extraction；
- config validation；
- rule evaluation；
- score breakdown；
- explainability；
- event emission。

明确：scoring engine ≠ API service。

## 4. Execution Context Layer

职责：

- execution_id；
- tenant_id；
- config checksum；
- engine version；
- run_mode；
- idempotency key；
- request trace。

Execution context 是 runtime backbone，但不负责 API 鉴权或数据库查询。

## 5. Event Sourcing Layer

职责：

- 记录 FeatureExtractionEvent；
- 记录 RuleEvaluationEvent / RuleSkippedEvent；
- 记录 BlockingEvent / OverrideEvent；
- 记录 DimensionScoreUpdateEvent；
- 记录 FinalScoreEvent。

Event stream 是 replay 的事实基础。

## 6. Replay Control Plane

职责：

- 选择 snapshot / event_store / memory；
- 做 consistency arbitration；
- 输出 source_used、selection_reason、inconsistency_type。

明确：replay ≠ API logic。

## 7. Persistence Layer

职责：

- append event；
- get events；
- save snapshot；
- get snapshot；
- mark replay consistency。

当前仅有 interface 和 stub，不连接真实数据库。

明确：API service ≠ event store。

## 8. Future n8n Integration Boundary

n8n 未来只能作为 orchestration caller：

- 调用 API；
- 传递明确 tenant_id 与 run_mode；
- 不计算 scoring rules；
- 不直接写 event store；
- 不绕过 API 权限；
- 不直接修改 production score。

明确：n8n ≠ scoring logic。

## 9. 验收标准

- API service 与 engine 分离；
- engine 与 replay source decision 解耦；
- replay control plane 独立；
- persistence 仍为逻辑接口；
- n8n 只有边界定义，无实现接入。

## 10. 风险

- API 层若直接实现 scoring，会产生双重逻辑；
- n8n 若直接写库，会绕过审计；
- persistence 若泄漏到 engine，会破坏可测试性；
- replay 若被 API 简化，会降低审计可信度。

## 11. 回滚原则

当前仅新增 API facade 和文档。若发现边界不清，可停止使用 API layer，保留 engine/replay 内核。

## 12. 下一步入口

下一步进入 v0.8 Production Architecture Design：PostgreSQL full schema、queue、cache、observability、deployment boundary。实施前必须获得用户批准。
