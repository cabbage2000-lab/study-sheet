# 发布指南

1. 在新检出目录执行 `npm ci`、`npm run typecheck`、`npm test`、`npm run test:browser`。
2. 执行 `npm run samples`，检查三科学生版与答案 PDF；执行 `npm run examples` 更新 README 展示。
3. 核对 `package.json`、锁文件版本、CHANGELOG 和宿主兼容性记录。对未完成的宿主验证如实说明。
4. 提交代码并确认 GitHub Actions 通过，然后推送与包版本一致的标签，例如 `v1.0.0`。
5. Release 工作流会重新运行检查，在 GitHub 创建草稿 Release，附源码技能 ZIP 和完整样张压缩包。检查附件与说明后发布草稿。

技能 ZIP 不包含 `node_modules`、用户资料或凭据；解压后的 `study-sheet/` 中包含技能入口、脚本、模板、许可和锁文件，仍需要运行 `npm ci`。样张压缩包由公开 fixtures 生成，包含离线 HTML、PDF、答案册和布局报告。

`output/samples/` 始终只有一套可用结果。更新通过同目录暂存、排他锁、旧目录备份和失败恢复完成，不承诺进程被强制终止时的跨平台文件系统事务。异常终止后若残留 `samples.lock` 或 `.samples-next-*`，确认没有生成进程运行，先检查并恢复其中的 `previous/`，再清理残留后重试。
