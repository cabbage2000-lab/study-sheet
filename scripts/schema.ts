import { calculate, solve } from './arithmetic.ts';
export type Subject = 'english' | 'math' | 'chinese';
export type Task = 'zh-en' | 'en-zh' | 'oral' | 'vertical' | 'steps' | 'word-problem' | 'pinyin' | 'copy';
export interface Item {
  id: string; english?: string; chinese?: string; word?: string; pinyin?: string;
  prompt?: string; expression?: string; answer?: string; answerVerified?: boolean;
  source?: string; review?: 'confirmed' | 'pending'; workspaceMm?: number;
}
export interface Section {
  subject: Subject; task: Task; title?: string; instructions?: string; columns?: 1 | 2 | 3;
  lineStyle?: 'line' | 'four-line'; repeats?: number; items: Item[];
}
export interface Worksheet {
  version: 1; title: string; grade?: string; date?: string;
  layout: { marginMm: number; fontPt: number; minFontPt: number; cellMm: number; gapMm: number };
  sections: Section[];
}
export interface PublicItem { id: string; number: number; prompt: string; pinyin?: string; cells?: number; workspaceMm: number }
export interface PublicSection { subject: Subject; task: Task | 'answers'; title: string; instructions: string; columns: number; lineStyle: 'line' | 'four-line'; repeats: number; items: PublicItem[] }
export interface PublicSheet { title: string; grade: string; date: string; layout: Worksheet['layout']; sections: PublicSection[]; kind: 'student' | 'answers' }
const taskSubjects: Record<Task, Subject> = { 'zh-en': 'english', 'en-zh': 'english', oral: 'math', vertical: 'math', steps: 'math', 'word-problem': 'math', pinyin: 'chinese', copy: 'chinese' };
const titles: Record<Task, string> = { 'zh-en': '看中文写英文', 'en-zh': '看英文写中文', oral: '口算练习', vertical: '列竖式计算', steps: '脱式计算', 'word-problem': '解决问题', pinyin: '看拼音写词语', copy: '词语抄写' };
function fail(path: string, message: string): never { throw new Error(`${path}：${message}`); }
function obj(v: unknown, path: string): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(path, '应为对象'); return v as Record<string, unknown>; }
function str(v: unknown, path: string, required = false): string | undefined {
  if (v === undefined && !required) return undefined;
  if (typeof v !== 'string' || (required && !v.trim())) fail(path, '应为非空文本');
  if (v.length > 30000) fail(path, '文本过长'); return v.trim();
}
function num(v: unknown, fallback: number, min: number, max: number, path: string): number {
  if (v === undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path, `应在 ${min}–${max} 之间`); return v;
}
export function normalize(input: unknown): Worksheet {
  const root = obj(input, 'worksheet'); if (root.version !== 1) fail('version', '当前只支持 1');
  const l = obj(root.layout ?? {}, 'layout');
  const fontPt = num(l.fontPt, 14, 12, 20, 'fontPt');
  const layout = { marginMm: num(l.marginMm, 14, 10, 25, 'marginMm'), fontPt,
    minFontPt: num(l.minFontPt, 12, 12, fontPt, 'minFontPt'), cellMm: num(l.cellMm, 11, 10, 16, 'cellMm'), gapMm: num(l.gapMm, 4, 3, 10, 'gapMm') };
  if (!Array.isArray(root.sections) || !root.sections.length) fail('sections', '至少一个学科分组');
  const ids = new Set<string>(); let total = 0;
  const sections = root.sections.map((raw, si): Section => {
    const path = `sections[${si}]`; const s = obj(raw, path); const task = str(s.task, `${path}.task`, true) as Task;
    if (!Object.hasOwn(taskSubjects, task)) fail(path, `不支持的题型 ${task}`);
    const subject = taskSubjects[task];
    if (s.subject !== undefined && s.subject !== subject) fail(path, '学科与题型不一致');
    const columns = num(s.columns, task === 'oral' ? 3 : task === 'word-problem' || task === 'copy' ? 1 : 2, 1, 3, `${path}.columns`);
    if (!Number.isInteger(columns)) fail(path, '列数必须是整数');
    if (s.lineStyle !== undefined && !['line', 'four-line'].includes(String(s.lineStyle))) fail(path, 'lineStyle 必须为 line 或 four-line');
    const repeats = num(s.repeats, 3, 1, 10, `${path}.repeats`); if (!Number.isInteger(repeats)) fail(path, '抄写次数必须为整数');
    if (!Array.isArray(s.items) || !s.items.length) fail(path, 'items 不能为空');
    const items = s.items.map((rawItem, ii): Item => {
      const ip = `${path}.items[${ii}]`; const it = obj(rawItem, ip); const id = str(it.id, `${ip}.id`) || `s${si + 1}-q${ii + 1}`;
      if (ids.has(id)) fail(ip, 'id 重复'); ids.add(id); total++;
      if (it.review === 'pending') fail(ip, '原题含待确认内容，确认后才能生成正式练习纸');
      if (it.review !== undefined && it.review !== 'confirmed') fail(ip, 'review 必须为 confirmed 或 pending');
      const item: Item = { id, review: 'confirmed' };
      for (const key of ['english', 'chinese', 'word', 'pinyin', 'prompt', 'expression', 'answer', 'source'] as const) {
        const value = str(it[key], `${ip}.${key}`); if (value !== undefined) item[key] = value;
      }
      if (it.answerVerified !== undefined && typeof it.answerVerified !== 'boolean') fail(ip, 'answerVerified 应为布尔值');
      item.answerVerified = it.answerVerified === true;
      if (it.workspaceMm !== undefined) item.workspaceMm = num(it.workspaceMm, 30, 10, 450, `${ip}.workspaceMm`);
      if (subject === 'english' && (!item.english || !item.chinese)) fail(ip, '英语题需要 english 与 chinese');
      if (subject === 'chinese') {
        if (!item.word || !/^[\p{Script=Han}]+$/u.test(item.word)) fail(ip, 'word 应只包含汉字，请拆开词语或句子的标点');
        if (task === 'pinyin') {
          if (!item.pinyin || /[\p{Script=Han}]/u.test(item.pinyin)) fail(ip, '需要已核对的拼音，不能含答案汉字');
          if (item.pinyin.trim().split(/\s+/).length !== Array.from(item.word).length) fail(ip, '拼音音节数应与汉字数相同，以空格分隔音节');
        }
      }
      if (subject === 'math') {
        if (!item.prompt && !item.expression) fail(ip, '数学题需要 prompt 或 expression');
        if (item.expression) {
          let computed: string;
          try { computed = solve(item.expression); } catch (e) { fail(ip, `算式无法校验：${(e as Error).message}`); }
          if (item.answer) {
            let a; let b; try { a = calculate(item.answer); b = calculate(computed); } catch { fail(ip, 'expression 对应的答案必须是可校验的数值或分数'); }
            if (a.n !== b.n || a.d !== b.d) fail(ip, `答案与精确计算不一致，应为 ${computed}`);
          }
          item.answer = computed; item.answerVerified = true;
        }
      }
      return item;
    });
    return { subject, task, title: str(s.title, `${path}.title`), instructions: str(s.instructions, `${path}.instructions`),
      columns: columns as 1 | 2 | 3, lineStyle: (s.lineStyle ?? 'line') as 'line' | 'four-line', repeats, items };
  });
  if (total > 500) fail('items', '单次最多 500 题，请分批生成');
  return { version: 1, title: str(root.title, 'title', true)!, grade: str(root.grade, 'grade'), date: str(root.date, 'date'), layout, sections };
}
/** Allowlist projection: student HTML must never embed private answer/source fields. */
export function project(sheet: Worksheet, kind: 'student' | 'answers'): PublicSheet {
  let number = 0;
  const sections: PublicSection[] = sheet.sections.map(s => ({
    subject: s.subject, task: kind === 'answers' ? 'answers' : s.task,
    title: `${s.title || titles[s.task]}${kind === 'answers' ? ' · 参考答案' : ''}`,
    instructions: kind === 'answers' ? '' : s.instructions || (s.task === 'copy' ? `每个词语抄写 ${s.repeats} 遍。` : ''),
    columns: kind === 'answers' ? 2 : s.columns!, lineStyle: s.lineStyle!, repeats: s.repeats!,
    items: s.items.map(it => {
      number++;
      if (kind === 'answers') {
        let answer = '';
        if (s.subject === 'english') answer = s.task === 'zh-en' ? it.english! : it.chinese!;
        if (s.subject === 'chinese') answer = it.word!;
        if (s.subject === 'math') {
          if (!it.answer || !it.answerVerified) throw new Error(`${it.id} 缺少已核对的答案；先核对，或不加 --answers`);
          answer = it.answer;
        }
        return { id: it.id, number, prompt: answer, workspaceMm: 0 };
      }
      if (s.subject === 'english') return { id: it.id, number, prompt: s.task === 'zh-en' ? it.chinese! : it.english!, workspaceMm: it.workspaceMm ?? (s.lineStyle === 'four-line' ? 16 : 12) };
      if (s.subject === 'chinese') return { id: it.id, number, prompt: s.task === 'copy' ? it.word! : '', pinyin: s.task === 'pinyin' ? it.pinyin! : undefined, cells: Array.from(it.word!).length, workspaceMm: 0 };
      return { id: it.id, number, prompt: it.prompt || `${it.expression!.replace(/[=＝]\s*$/, '')} =`, workspaceMm: it.workspaceMm ?? ({ oral: 12, vertical: 48, steps: 56, 'word-problem': 64 } as Partial<Record<Task, number>>)[s.task]! };
    })
  }));
  return { title: sheet.title + (kind === 'answers' ? ' · 答案册' : ''), grade: sheet.grade || '', date: sheet.date || '', layout: sheet.layout, sections, kind };
}
