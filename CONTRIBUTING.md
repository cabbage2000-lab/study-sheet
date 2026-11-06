# 参与开发

使用 Node.js 22.6 或以上版本，在仓库根目录运行：

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run test:browser
```

Linux 首次安装浏览器时可能需要 `npx playwright install --with-deps chromium`。已有 Chrome 可自动使用，也可通过 `STUDY_SHEET_CHROME` 指定可执行文件。

TypeScript 使用 ES modules、两空格缩进、单引号和分号。变更题型、分页、答案投影时，补充对应行为测试；排版变更还需检查实际 PDF。

`npm run samples` 更新唯一的 `output/samples/`，完成所有三科生成及页数、A4 校验后才替换旧样张。`npm run examples` 将其中的三科学生版 PDF 和第一页预览更新到 `docs/examples/`，用于 README 展示。只有来自 `tests/fixtures/` 的公开演示材料允许作为文档样张提交；学生资料、`output/`、`.test-output/`、`node_modules/` 和本地配置不入库。

提交说明应描述具体行为变化。PR 附验证命令及结果；可见排版变化附样张。不要仅修改断言阈值使失败测试通过。修改标题检查时，左对齐负例必须仍然失败。

发布流程见 [发布指南](docs/releasing.md)。
