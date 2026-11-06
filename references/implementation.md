# 实现与依赖来源

此 skill 参考 PrintFit 的产品思路：Pretext 预估文本尺寸、浏览器 DOM 复核与 A4 打印。实现独立，不从原项目运行时加载文件，也不修改原项目。练习纸保留毫米制书写空间；字号下限 12pt，超过容量就分页。

- `scripts/schema.ts`：输入校验与学生/答案字段投影。
- `scripts/arithmetic.ts`：BigInt 有理数四则运算，不运行用户代码。
- `assets/templates/worksheet.ts`：Pretext 测量、题型渲染、实际布局分页与预览交互。
- `assets/print.css`：A4 打印规则、书写格、符合用户浅色界面偏好的预览外壳。
- `scripts/generate.ts`：打包字体/脚本、输出离线 HTML，调用 PDF 导出。
- `scripts/export-pdf.ts`：打印媒体下检查溢出后导出 PDF。
- `scripts/browser.ts`：使用已有 Chrome 或 Playwright Chromium。

参考官方资料：
- Pretext：https://github.com/chenglou/pretext （本项目固定 1.0.0）
- Playwright Page PDF：https://playwright.dev/docs/api/class-page#page-pdf
- KaTeX API：https://katex.org/docs/api
- Noto Sans SC：https://github.com/google/fonts/tree/main/ofl/notosanssc

字体来自 Google Fonts 的 Noto Sans SC，使用 SIL Open Font License；许可位于 `assets/fonts/OFL.txt`。输出 HTML 内置字体，无需在线字体服务。KaTeX 自带字体和样式同样嵌入。依赖版本由 `package-lock.json` 固定。

测量策略：Pretext 提供题干高度预估，复杂公式/格子/最终页边界以浏览器实际尺寸为准。首版优先保证输出正确，候选字号通过浏览器试排比较页数；不声称纯 Canvas 排版，也不承诺 PrintFit README 中的性能数据。

当前限制：不做 OCR 服务、自动拼音算法、符号代数证明、图形题绘制、语音听写、在线题库或学习记录数据库。自然语言识别和学科内容校对由宿主模型完成。HTML 预览可打印，不提供网页题目编辑器。
