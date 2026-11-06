# 任务 JSON 协议（version 1）

模型先理解自然语言及素材，再写此协议；CLI 不直接解析自然语言。

```json
{
  "version": 1,
  "title": "本周学习巩固",
  "grade": "小学三年级",
  "date": "",
  "layout": { "marginMm": 14, "fontPt": 14, "minFontPt": 12, "cellMm": 11, "gapMm": 4 },
  "sections": [
    {
      "subject": "english",
      "task": "zh-en",
      "title": "单词默写",
      "instructions": "根据中文写英文。",
      "columns": 2,
      "lineStyle": "four-line",
      "items": [{ "id": "e1", "english": "apple", "chinese": "苹果", "review": "confirmed" }]
    },
    { "task": "vertical", "items": [{ "expression": "248 × 36", "workspaceMm": 48 }] },
    { "task": "pinyin", "items": [{ "word": "春天", "pinyin": "chūn tiān" }] }
  ]
}
```

## 顶层

- `version:1`、非空 `title`、非空 `sections` 必填。
- `grade`、`date` 为可选文本；没有日期时显示填写横线。
- `layout` 可省略。边距 10–25mm；正文字号 12–20pt；最小字号 12pt 至 fontPt；汉字格 10–16mm；题间距 3–10mm。字号只在上下限内按 0.5pt 尝试，书写区不随之缩小。

## 分组

`task` 必填，决定学科：

- english：`zh-en`、`en-zh`。
- math：`oral`、`vertical`、`steps`、`word-problem`。
- chinese：`pinyin`、`copy`。

`subject` 可以省略，由 task 确定；提供时必须一致。可选 `title`、`instructions`。`columns` 为 1/2/3：口算默认 3，应用题和抄写默认 1，其他默认 2；太宽时自动减少列数。`lineStyle` 为 `line` 或 `four-line`，英语使用。`repeats` 是抄写次数，默认 3，1–10 整数。

同科各分组按顺序共享剩余空间；学科变化时起新页。题号全卷连续。需要保持原题号可把原号写入题面，而不要破坏全卷唯一编号。

## 题目

| 字段 | 规则 |
|---|---|
| id | 可选，全卷唯一；省略时自动生成。使用不含答案的中性编号 |
| english / chinese | 英语题都需要，分别为英文词/短语和本次教学释义 |
| word | 语文题必填，只包含汉字 |
| pinyin | 看拼音题必填，空格分隔音节，数量匹配汉字 |
| prompt | 数学题面；可含换行和 `\\(…\\)` 公式，普通文本不会作为 HTML 执行 |
| expression | 可选可计算算式；与 prompt 的数学含义必须一致；没有 prompt 时直接显示算式 |
| workspaceMm | 可选书写高度，10–450mm；数学按 8mm 行、英语按书写行向上取整 |
| answer | 可选参考答案；有 expression 时自动计算并校验显式答案 |
| answerVerified | 非算式数学答案经独立核对后设 true，生成答案册需要 |
| source | 可选原题出处/转录来源，保存在工作 JSON，不进入学生 HTML |
| review | confirmed 或 pending；pending 会阻止正式生成 |

单次最多 500 题，超出时按用户要求分批。学生 HTML 使用字段白名单，只包含可见题面与排版信息；英语目标词、拼音题目标词和数学参考答案保留在工作 JSON 与独立答案册。

注意：普通 prompt 与说明不会自动删除答案。模型应在写入 JSON 前去掉旧作答、答案提示和解析；禁止在标题、id、说明中藏入答案。

## CLI 与输出

```bash
npm run generate -- --input /path/task.json --out /path/new-output
npm run generate -- --input /path/task.json --out /path/new-output-with-answers --answers
npm run generate -- --input /path/task.json --out /path/new-html-output --html-only
```

输出：`worksheet.json`（内部工作数据）、`worksheet.html`、`worksheet.pdf`、`report.json`。添加 `--answers` 时另有 `answers.html` 与 `answers.pdf`。HTML-only 不输出 PDF 或布局校验报告。

`report.json` 包含学生/答案册页数、题数、Pretext 测量次数、续页提示。默认字号字段只表示配置上限，个别分组可能使用更小但不低于下限的字号。

目标目录存在同名任务文件时拒绝写入。若浏览器/PDF 失败，HTML 与工作 JSON 可能已生成；修复后使用新目录重试，报告实际成功的文件，不将部分成功当全部完成。
