# 宿主兼容性与验证

安装器将同一份技能及资源复制到相应宿主目录，不需要 API 密钥。执行依赖 Node.js、npm 和浏览器；图片识别取决于宿主能力。当前交付是本地技能目录安装，不包含插件市场或 WorkBuddy 专家上架。

| 宿主 | 用户级目录 | 项目级目录 |
| --- | --- | --- |
| Codex | `~/.agents/skills/study-sheet` | `.agents/skills/study-sheet` |
| Claude Code | `~/.claude/skills/study-sheet` | `.claude/skills/study-sheet` |
| WorkBuddy | `~/.workbuddy/skills/study-sheet` | `.codebuddy/skills/study-sheet` |

Codex 按[当前官方文档](https://developers.openai.com/codex/skills)使用 `.agents/skills`；已有 `~/.codex/skills` 安装请先迁移或卸载，避免重复发现。Claude Code 路径依据[官方技能文档](https://code.claude.com/docs/en/skills)。WorkBuddy 项目级配置依据[官方项目说明](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)；用户级 `.workbuddy` 方式沿用本地参考项目，尚需宿主实测确认。

## 验收方法

1. 在空项目中通过 `npm run install:skill -- --host <宿主> --project <项目目录>` 安装，并在技能目录执行 `npm ci`。
2. 新建宿主会话，确认发现的技能路径指向该安装目录。
3. 提示：“用 study-sheet 将 apple 苹果、school 学校做成英语默写纸，中文写英文，生成 PDF 和独立答案册。”
4. 检查 2 题、A4、学生版不含目标词、答案册内容正确；保存宿主版本、日志和产物检查结果。
5. 再试一次图像或 PDF 素材；宿主无法读取时应明确说明，不能编造转录。文本生成通过不能替代多模态验证。

## 1.0.0 宿主与基础验证记录

记录日期：2026-11-06。生成器、目录安装测试与实际宿主执行分别记录；未执行的项目不标为通过。

| 项目 | 状态 |
| --- | --- |
| 三种项目级安装目录 | 安装器测试通过，并完成真实资源复制；不等同于宿主会话验收 |
| macOS 干净目录安装及完整测试 | Node.js 24.13.0；独立 npm ci、类型检查、11 项单测、5 项浏览器测试与三科样张生成全部通过 |
| Linux GitHub Actions | Node.js 22，安装、类型检查、11 项单测、5 项浏览器测试全部通过；[运行记录](https://github.com/cabbage2000-lab/study-sheet/actions/runs/42202835676) |
| Codex CLI 0.167.0 | 项目技能发现、文本输入、HTML/PDF、答案册与页面检查通过；首次 Chrome 沙箱启动失败，经授权重试成功 |
| Claude Code 2.1.318 | 项目技能发现、文本输入、HTML/PDF、答案册通过；宿主检查 HTML 截图，PDF 另经本次发布流程独立核验 |
| WorkBuddy 5.9.3 | 应用已安装；用户确认先发布并标注待验证，待人工会话验收 |

测试记录会随发布验证更新。当前不声明 Windows 或三个宿主的图片识别均已通过。

## 1.0.1 页头排版回归

本轮改变页头与分组标题布局，未改变宿主安装方式。macOS 类型检查、11 项单测和 6 项浏览器测试通过，三科学生版 PDF 与答案册已重新生成并检查。新增测试覆盖填写信息居中、题型与说明同排、长文本换行及错误样式负例。Linux 的同一组检查和发布附件生成由 [Release 工作流](https://github.com/cabbage2000-lab/study-sheet/actions/workflows/release.yml)执行。宿主会话实测仍沿用上表记录；WorkBuddy 继续待人工验证。
