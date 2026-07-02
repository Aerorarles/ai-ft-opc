# Phase 2 Local Workbench

本目录是 AI FT-OPC Phase 2 的静态本地工作台原型。

## 当前定位

- 仅用于本地 MVP 演示。
- 默认不连接生产数据库。
- 默认不启动 HTTP server。
- 不包含自动邮件、WhatsApp、LinkedIn、表单提交、报价或任何真实客户触达。

## 使用方式

1. 先运行本地 Phase 2 demo 或测试确认内存链路可用。
2. 如需人工查看静态页面，必须由用户明确批准后再启动本地 HTTP server。
3. 页面只调用 `/api/*` 本地端点，展示脱敏 Lead 摘要、shadow diff、decision 与 review queue。

## 安全边界

- 不展示完整 email、phone、raw_data、HTML、headers、cookies、stack、response、credentials 或 secrets。
- 不修改 `public.leads` 正式评分字段。
- 不替代 n8n、PostgreSQL 或生产管理后台。
