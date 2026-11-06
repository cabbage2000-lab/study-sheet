# 英语默写

- `task:zh-en`：题面仅展示 `chinese`，答案来自 `english`。
- `task:en-zh`：题面仅展示 `english`，答案来自 `chinese`。
- 每题同时存两种语言，方便保留教材对应关系；缺失的一侧由模型结合上下文补齐并核对。没有教材上下文时说明采用常见释义；有多个合理目标词时先解决歧义。
- 保留大小写、词形、短语中的空格与标点，不把复数或过去式自动改成词根。
- 小学生英文书写可设 `lineStyle:four-line`；默认 `line`。长短语增加 `workspaceMm` 或减少 `columns`，不缩小到不可写。
- 只生成纸面提示，不生成语音。若用户说“听写”但给出中文/英文书面方向，以其指定的方向执行；真正需要音频播放时说明本 skill 的纸面边界。
- 双向练习用两个 section，分别设置题型。随机顺序由模型明确重排 JSON，不能更改词与译文的对应关系。

例：
```json
{"task":"zh-en","lineStyle":"four-line","items":[{"english":"pencil","chinese":"铅笔"}]}
```
