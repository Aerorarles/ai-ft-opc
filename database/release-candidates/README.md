# Database Release Candidates

此目录存放人工审查后的 SQL Release Candidate，不是自动 migration 发现路径。

- 文件只能在获得单独数据库执行批准后，由指定迁移执行角色显式执行。
- 不得将本目录中的 SQL 加入自动扫描或启动脚本。
- 每次执行必须记录已批准的文件 SHA-256、执行窗口、备份确认与执行后元数据复核结果。
- `database/migrations/DRAFT-005`、`DRAFT-006`、`DRAFT-007` 保留为历史审查输入，不得自动执行。
