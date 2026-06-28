# 部署说明

本文档记录 `ai-ft-opc` 当前已知部署约定。当前项目以 Docker Compose 为本地编排基础，依赖 PostgreSQL、Redis、Qdrant 和 n8n。

## 当前已知部署形态

- 本地开发环境通过 Docker Compose 管理服务。
- PostgreSQL、Redis、Qdrant 和 n8n 作为核心运行依赖。
- GitHub 用于保存代码和文档，但真实 n8n 工作流与 credentials 尚未完整导出到 Git。

## 部署前检查

部署或启动前应由人工确认：

- `.env` 和 `configs/` 中的敏感配置没有被提交或泄露。
- n8n credentials 没有导出到公开仓库。
- 数据库连接目标明确，避免误连生产库。
- Docker volumes 不会被删除、重建或覆盖。
- 当前 Git 分支、变更内容和远端目标已经人工确认。

## 禁止操作

- 绝不暴露 `configs/`、`.env`、n8n credentials、API key、token 或 cookie。
- 绝不删除 Docker volumes。
- 绝不运行破坏性 SQL。
- 绝不自动联系真实 leads。
- 绝不在没有用户明确批准的情况下 push 到 GitHub。

## n8n 注意事项

真实 n8n 工作流和 credentials 尚未完整导出到 Git。因此：

- 不能假设仓库中的文件等同于完整 n8n 运行状态。
- 不能根据文档自动覆盖 n8n 中的现有工作流。
- 任何导入、导出、启用、禁用或凭据更新都需要人工确认。

## 推荐发布流程

1. 在本地或隔离环境中审查变更。
2. 检查是否涉及密钥、环境变量、数据库迁移或外部触达。
3. 对数据库变更先做备份和只读审查。
4. 对 n8n 工作流先导出备份，再进行人工确认。
5. 经用户明确批准后，才允许推送到 GitHub 或部署到共享环境。

## 回滚原则

- 优先通过 Git 回滚代码和文档变更。
- 数据库回滚必须使用经过审查的迁移脚本，不能直接运行破坏性 SQL。
- n8n 回滚应使用事先导出的工作流备份，并由人工确认 credentials 绑定。
