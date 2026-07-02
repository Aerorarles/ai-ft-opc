# Lead Scoring v0.7 API Contract

版本：v0.7-draft
日期：2026-07-01
状态：本地 API contract 草案，未启动服务器
适用范围：未来 SaaS Scoring API 的请求、响应、幂等、重试、shadow / preview 行为
禁止事项：不启动 server，不连接数据库，不接 n8n，不调用外部 API，不读取 secrets，不执行 Git 操作。

## 1. API Endpoint

```text
POST /score-lead
```

当前仅实现本地函数 `scoreLeadAPI()`，不启动 HTTP 服务。

## 2. Request

```json
{
  "lead": {},
  "tenant_id": "tenant-001",
  "config_version_id": "v1",
  "run_mode": "preview",
  "request_trace_id": "trace-001",
  "idempotency_key": "optional-idempotency-key"
}
```

字段说明：

- `lead`：待评分 Lead，必须由调用方保证不含 HTML、headers、cookies、secrets；
- `tenant_id`：租户隔离边界；
- `config_version_id`：该 tenant 可访问的配置版本；
- `run_mode`：`live` / `shadow` / `preview`；
- `request_trace_id`：链路追踪；
- `idempotency_key`：可选；缺省时由本地 API facade 基于请求摘要生成。

## 3. Response

```json
{
  "execution_id": "api-...",
  "total_score": 21,
  "breakdown": {},
  "applied_rules": [],
  "explanation": {},
  "replay_metadata": {}
}
```

必须返回：

- `execution_id`
- `total_score`
- `breakdown`
- `applied_rules`
- `explanation`
- `replay_metadata`
- `consistency_result`

## 4. Idempotency Key Behavior

同一 tenant、同一 idempotency key、同一 config version 的重复请求应返回同一 execution 结果。

设计目标：

- retry safe；
- 不重复写 event；
- 不重复生成 snapshot；
- 响应稳定。

未来持久化时应使用唯一约束保护 idempotency；当前本地测试使用 fake event store 模拟。

## 5. Retry Safety

客户端可以安全重试以下情况：

- 网络超时；
- API gateway 5xx；
- 调用方未收到响应。

重试必须携带相同 idempotency key。若不携带，系统只能尽量基于请求摘要生成稳定 key，但生产 API 不应依赖隐式 key。

## 6. Deterministic Response Guarantee

在相同条件下：

- same tenant；
- same config version；
- same config checksum；
- same engine version；
- same lead input summary；
- same run mode；
- same idempotency key；

API 应返回相同 score、breakdown、applied_rules、explanation 和 replay metadata。

## 7. Shadow Mode

`run_mode = shadow`：

- 不写 production score；
- 不保存 snapshot；
- 仍生成 event + trace；
- 可用于 replay 和一致性审计；
- 不影响 v0.1 生产评分事实来源。

## 8. Preview Mode

`run_mode = preview`：

- 不写 event store；
- 不保存 snapshot；
- 只返回 computed result；
- 适合管理后台规则预览；
- 不应进入生产评分事实链。

## 9. Live Mode

`run_mode = live`：

- 可写 event store；
- 可保存 snapshot；
- 必须有 idempotency protection；
- 当前本地实现仍不连接真实数据库。

## 10. Replay Metadata

响应必须包含：

- source_used；
- selection_reason；
- snapshot_used；
- is_consistent；
- inconsistency_type；
- recomputed_total_score；
- final_score_event_total；
- run_mode；
- tenant_id；
- config_version_id。

## 11. 验收标准

- API facade 可返回完整评分结果；
- shadow 不保存 snapshot；
- preview 不写 event store；
- response 包含 replay consistency；
- tenant config 访问受限；
- 不启动真实 server。

## 12. 风险

- 生产环境缺少显式 idempotency key 会增加重复执行风险；
- preview 被误用为 live 会丢失审计事件；
- shadow 结果被写回生产字段会破坏安全边界。

## 13. 回滚原则

当前只新增本地 API facade。若需要回滚，可不使用 `scoreLeadAPI()`，继续直接调用 scoring engine。

## 14. 下一步入口

进入真实 HTTP API、鉴权、数据库持久化或 n8n 接入前，必须进行 v0.8 production architecture design 并获得用户批准。
