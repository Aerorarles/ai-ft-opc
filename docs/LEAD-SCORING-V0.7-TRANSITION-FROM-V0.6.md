# Lead Scoring v0.6 to v0.7 Transition

版本：v0.7-transition
日期：2026-07-01
状态：过渡说明，已完成本地 API facade 与 SaaS 产品化设计
适用范围：v0.6 replay control plane 到 v0.7 SaaS productization layer
禁止事项：不接数据库、不写 migration、不部署 server、不接 n8n、不调用外部 API、不读取 secrets。

## 1. v0.6 定位

v0.6 是 replay control plane：

- source routing；
- snapshot / event_store / memory；
- consistency arbitration；
- deterministic replay metadata。

## 2. v0.7 定位

v0.7 是 SaaS productization layer：

- API service facade；
- multi-tenant config isolation；
- run_mode：live / shadow / preview；
- API response contract；
- admin rule layer concept；
- SaaS architecture boundary。

## 3. 本次新增内容

- `scoreLeadAPI()`；
- 多租户配置注册表模型；
- shadow mode 不保存 snapshot；
- preview mode 不写 event store；
- API response 包含 replay metadata；
- 管理规则层概念文档；
- 系统分层边界文档。

## 4. 未改变内容

- 未修改 scoring algorithm；
- 未连接 PostgreSQL；
- 未创建 migration；
- 未接 n8n；
- 未启动 server；
- 未调用外部 API；
- 未读取 secrets。

## 5. 验收标准

- API 层可调用 engine；
- replay metadata 出现在 API response；
- 多租户配置隔离有测试；
- shadow / preview 模式有测试；
- 原有 v0.2-v0.6 测试仍通过。

## 6. 风险

- API facade 不是完整 HTTP 服务；
- 当前 tenant config registry 是本地模拟；
- fake event store 不代表真实数据库事务；
- v0.7 仍不是生产部署方案。

## 7. 回滚原则

不使用 `scoreLeadAPI()` 即可回到 v0.6 内核能力。engine、replay、event sourcing 仍可独立运行。

## 8. 下一步入口

v0.8 应进入 Production Architecture Design，但仍必须先审查，不得直接实施数据库、n8n、Docker、server 或 Git 操作。
