# 第三方组件与字体

本项目原创源码采用 [MIT](LICENSE)。第三方组件及字体遵循各自许可，项目许可证不替代其条款。

| 组件 | 用途 | 许可证与来源 |
| --- | --- | --- |
| Noto Sans SC | 捆绑中文字体 | SIL OFL 1.1；[许可全文](assets/fonts/OFL.txt)，[Google Fonts 源码](https://github.com/google/fonts/tree/main/ofl/notosanssc) |
| KaTeX | 公式排版与字体 | MIT；[源码及许可](https://github.com/KaTeX/KaTeX) |
| @chenglou/pretext | 文本尺寸预估 | MIT；[源码及许可](https://github.com/chenglou/pretext) |
| esbuild | 浏览器脚本打包 | MIT；[源码及许可](https://github.com/evanw/esbuild) |
| Playwright | 浏览器布局验证与 PDF 导出 | Apache-2.0；[源码及许可](https://github.com/microsoft/playwright) |

精确依赖版本由 `package-lock.json` 固定。通过 npm 安装的包包含各自许可；生成器在离线 HTML 中附带中文字体、KaTeX 和 Pretext 的许可文本。浏览器由用户另行安装。开发及测试依赖的许可见对应 npm 包。

PrintFit 仅作为产品思路参考，不作为运行依赖；实现说明见 [references/implementation.md](references/implementation.md)。
