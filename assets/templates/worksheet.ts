import { prepare, layout } from '@chenglou/pretext';
import katex from 'katex';
import type { PublicItem, PublicSection, PublicSheet } from '../../scripts/schema.ts';
const mm = 96 / 25.4;
const data: PublicSheet = JSON.parse(document.querySelector('#sheet-data')!.textContent!);
const papers: HTMLElement[] = [];
const pageRoot = document.querySelector<HTMLElement>('.pages')!;
const measurement = document.createElement('div'); measurement.className = 'measurement'; document.body.append(measurement);
const el = (tag: string, cls = '', value?: string): HTMLElement => { const n = document.createElement(tag); n.className = cls; if (value !== undefined) n.textContent = value; return n; };
interface Report { pages: number; questions: number; fontPt: number; pretextMeasurements: number; warnings: string[] }
let measurements = 0;
const warnings = new Set<string>();
function richText(text: string, parent: HTMLElement): void {
  const pieces = text.split(/(\\\([\s\S]*?\\\))/g);
  for (const piece of pieces) {
    if (piece.startsWith('\\(') && piece.endsWith('\\)')) {
      const span = el('span', 'formula');
      katex.render(piece.slice(2, -2), span, { throwOnError: true, trust: false, strict: 'error', output: 'html', maxExpand: 1000 }); parent.append(span);
    } else parent.append(document.createTextNode(piece));
  }
}
// Never split a formula. Long prose is split at whitespace/punctuation where possible.
function paragraphs(text: string, width: number, fontPt: number, estimatedHeight: number): string[] {
  if (estimatedHeight < 65 * mm) return text.split('\n').filter(Boolean);
  const font = `${fontPt * 96 / 72}px \"Study Sans\"`;
  const tokens = text.match(/\\\([\s\S]*?\\\)|[^\n]{1}|\n/g) ?? [];
  const result: string[] = []; let current = '';
  for (const token of tokens) {
    if (token === '\n') { if (current) result.push(current); current = ''; continue; }
    current += token;
    if (current.length >= 80 && (/[。！？；，,.!?;\s]$/.test(token) || current.length >= 240)) {
      const estimate = layout(prepare(current, font), width, fontPt * 96 / 72 * 1.65); measurements++;
      if (estimate.height >= 45 * mm) { result.push(current); current = ''; }
    }
  }
  if (current) result.push(current); return result;
}
function cells(count: number, word?: string): HTMLElement {
  const g = el('div', 'grid-group');
  for (let n = 0; n < count; n++) { const c = el('span', 'hanzi-cell'); if (word) c.append(el('span', '', Array.from(word)[n])); g.append(c); }
  return g;
}
function question(item: PublicItem, s: PublicSection, width: number, fontPt: number): HTMLElement {
  const q = el('article', `question task-${s.task}`); q.dataset.id = item.id; q.dataset.number = String(item.number);
  q.append(el('div', 'question-label', `${item.number}.`));
  if (item.prompt) {
    const font = `${fontPt * 96 / 72}px "Study Sans"`;
    const textWidth = width - (fontPt * 96 / 72 * 2.4 + 3 * mm);
    const measured = layout(prepare(item.prompt.replace(/\\\(|\\\)/g, ''), font), textWidth, fontPt * 96 / 72 * 1.65);
    measurements++; q.dataset.estimatedTextHeight = String(measured.height);
    for (const paragraph of paragraphs(item.prompt, textWidth, fontPt, measured.height)) { const p = el('p', 'prompt'); richText(paragraph, p); q.append(p); }
  }
  if (s.task === 'answers') return q;
  if (s.subject === 'english') {
    const rows = Math.max(1, Math.ceil(item.workspaceMm / (s.lineStyle === 'four-line' ? 18 : 14)));
    for (let n = 0; n < rows; n++) {
      if (s.lineStyle === 'four-line') {
        const grid = el('div', 'four-line'); for (let i = 0; i < 4; i++) { const line = el('i'); line.style.setProperty('--line', String(i)); grid.append(line); } q.append(grid);
      } else q.append(el('div', 'answer-line'));
    }
  } else if (s.task === 'pinyin') {
    q.append(el('div', 'pinyin', item.pinyin)); q.append(cells(item.cells!));
  } else if (s.task === 'copy') {
    // prompt is the deliberate visible model word for this task only.
    q.querySelectorAll('.prompt').forEach(n => n.remove());
    q.append(el('div', 'copy-label', '范字')); q.append(cells(item.cells!, item.prompt));
    const copies = el('div', 'copy-label', `练习 · ${s.repeats} 遍`); q.append(copies);
    for (let i = 0; i < s.repeats; i++) q.append(cells(item.cells!));
  } else {
    const rows = Math.max(1, Math.ceil(item.workspaceMm / 8));
    for (let n = 0; n < rows; n++) q.append(el('div', s.task === 'vertical' ? 'workspace-blank' : 'workspace-line'));
  }
  return q;
}
function sectionHeading(s: PublicSection): HTMLElement {
  const heading = el('div', `section-heading${s.instructions ? ' with-instructions' : ''}`);
  heading.append(el('h3', 'section-title', s.title));
  if (s.instructions) heading.append(el('p', 'instructions', s.instructions));
  return heading;
}
function makePage(s: PublicSection, fontPt: number, target: HTMLElement): HTMLElement {
  const paper = el('section', 'paper');
  paper.style.setProperty('--margin', `${data.layout.marginMm}mm`);
  paper.style.setProperty('--font', `${fontPt}pt`); paper.style.setProperty('--gap', `${data.layout.gapMm}mm`); paper.style.setProperty('--cell', `${data.layout.cellMm}mm`);
  const header = el('header', 'sheet-header'); header.append(el('h2', 'sheet-title', data.title));
  const meta = el('div', 'sheet-meta');
  meta.append(el('span', '', '姓名：____________'), el('span', '', data.grade ? `年级：${data.grade}` : '班级：____________'), el('span', '', `日期：${data.date || '____________'}`));
  header.append(meta, sectionHeading(s));
  paper.append(header, el('div', 'sheet-body'));
  const footer = el('footer', 'sheet-footer'); footer.append(el('span', '', data.kind === 'answers' ? '参考答案 · 请与题号对应' : '认真审题，书写工整。'), el('span', 'page-number', '第 1 页 / 共 1 页'));
  paper.append(footer); target.append(paper); return paper;
}
function boxHeight(node: HTMLElement): number { return node.getBoundingClientRect().height; }
function bodyFits(body: HTMLElement): boolean {
  const last = body.lastElementChild; return !last || last.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom - 1;
}
function horizontalFits(q: HTMLElement): boolean {
  if (q.scrollWidth > q.clientWidth + 1) return false;
  return Array.from(q.querySelectorAll<HTMLElement>('.formula,.grid-group,.prompt,.pinyin')).every(n => n.scrollWidth <= q.clientWidth + 1);
}
function row(columns: number): HTMLElement { const r = el('div', 'row'); r.style.setProperty('--columns', String(columns)); return r; }
function sectionLayout(s: PublicSection, fontPt: number, columns: number, target: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = []; let page = makePage(s, fontPt, target); result.push(page);
  let body = page.querySelector<HTMLElement>('.sheet-body')!;
  if (body.clientHeight < 80 * mm) throw new Error('标题或说明过长，请缩短标题并将题目内容移到题干。');
  const width = (body.clientWidth - (columns - 1) * data.layout.gapMm * mm) / columns;
  let currentRow = row(columns); body.append(currentRow);
  const next = (): void => { page = makePage(s, fontPt, target); result.push(page); body = page.querySelector<HTMLElement>('.sheet-body')!; currentRow = row(columns); body.append(currentRow); };
  for (const item of s.items) {
    const q = question(item, s, width, fontPt);
    if (currentRow.children.length === columns) { currentRow = row(columns); body.append(currentRow); }
    currentRow.append(q);
    if (!horizontalFits(q)) throw new Error(`题 ${item.number} 横向放不下；减少列数、分行公式或拆开过长词组。`);
    if (bodyFits(body)) continue;
    q.remove(); if (!currentRow.children.length) currentRow.remove();
    if (body.children.length) next();
    else { currentRow = row(columns); body.append(currentRow); }
    currentRow.append(q);
    if (bodyFits(body)) continue;
    // Oversize questions get their own full-width continuation pages, split only between content blocks.
    q.remove(); currentRow.remove();
    const full = question(item, s, body.clientWidth, fontPt);
    currentRow = row(1); body.append(currentRow);
    let fragment = el('article', `question task-${s.task}`); fragment.dataset.id = item.id; fragment.dataset.number = String(item.number);
    const label = `${item.number}.`; fragment.append(el('div', 'question-label', label)); currentRow.append(fragment);
    const chunks = Array.from(full.children).slice(1);
    let continuation = 0;
    for (const chunk of chunks) {
      fragment.append(chunk);
      if (!horizontalFits(fragment)) throw new Error(`题 ${item.number} 的公式或词组超过单页宽度，请分行。`);
      if (!bodyFits(body)) {
        chunk.remove();
        if (fragment.children.length <= 1) throw new Error(`题 ${item.number} 的单个内容块超过一页，请按题意拆分。`);
        next(); currentRow.style.setProperty('--columns', '1');
        fragment = el('article', `question task-${s.task}`); fragment.dataset.id = item.id; fragment.dataset.number = String(item.number); fragment.dataset.continuation = String(++continuation);
        fragment.append(el('div', 'question-label', `${label}（接上页）`)); currentRow.append(fragment); fragment.append(chunk);
        if (!bodyFits(body)) throw new Error(`题 ${item.number} 的单个内容块超过一页，请按题意拆分。`);
      }
    }
    warnings.add(`题 ${item.number} 需要续页，已在内容块之间分页。`);
    currentRow = row(columns); body.append(currentRow);
  }
  result.forEach(p => p.querySelectorAll('.row:empty').forEach(r => r.remove()));
  return result;
}
async function render(): Promise<void> {
  await Promise.all(Array.from(document.fonts).map(font => font.load())); await document.fonts.ready;
  let previousSubject = '';
  for (const s of data.sections) {
    let best: { pages: number; font: number; columns: number } | undefined; let lastError: Error | undefined;
    // Preserve requested/default columns unless the row is too wide. Largest readable font wins ties.
    for (let columns = s.columns; columns >= 1; columns--) {
      let success = false;
      for (let font = data.layout.fontPt; font >= data.layout.minFontPt; font -= .5) {
        measurement.replaceChildren();
        try {
          const candidate = sectionLayout(s, font, columns, measurement);
          if (!best || candidate.length < best.pages) best = { pages: candidate.length, font, columns };
          success = true;
          if (candidate.length === 1) break;
        } catch (error) { lastError = error as Error; }
      }
      if (success) break;
    }
    if (!best) throw lastError || new Error('无法排版');
    measurement.replaceChildren();
    const laidOut = sectionLayout(s, best.font, best.columns, measurement);
    // Reuse remaining space for the next section of the same subject. Keep its heading with the first row.
    let destination = previousSubject === s.subject ? papers.at(-1) : undefined;
    let sectionStarted = false;
    for (const source of laidOut) {
      const rows = Array.from(source.querySelector<HTMLElement>('.sheet-body')!.children) as HTMLElement[];
      for (const nextRow of rows) {
        nextRow.style.fontSize = `${best.font}pt`;
        let subheading: HTMLElement | undefined;
        if (destination) {
          const body = destination.querySelector<HTMLElement>('.sheet-body')!;
          if (!sectionStarted) {
            subheading = sectionHeading(s); subheading.classList.add('section-break'); body.append(subheading);
          }
          body.append(nextRow);
          if (!bodyFits(body)) { nextRow.remove(); subheading?.remove(); destination = undefined; }
        }
        if (!destination) {
          destination = makePage(s, best.font, measurement);
          destination.querySelector('.sheet-body')!.append(nextRow);
          const frame = el('div', 'paper-frame'); frame.id = `page-${papers.length + 1}`;
          frame.append(destination); pageRoot.append(frame); papers.push(destination);
        }
        sectionStarted = true;
      }
    }
    previousSubject = s.subject;
  }
  measurement.remove();
  const nav = document.querySelector('.page-nav')!;
  papers.forEach((paper, i) => {
    paper.querySelector('.page-number')!.textContent = `第 ${i + 1} 页 / 共 ${papers.length} 页`;
    const link = el('a', '', `${i + 1} · ${paper.querySelector('.section-title')!.textContent}`); link.setAttribute('href', `#page-${i + 1}`); nav.append(link);
  });
  const report: Report = { pages: papers.length, questions: data.sections.reduce((n, s) => n + s.items.length, 0), fontPt: data.layout.fontPt, pretextMeasurements: measurements, warnings: [...warnings] };
  (window as any).__worksheetReport = report;
  document.querySelector('.status')!.textContent = `${report.questions} 题 · ${report.pages} 页 · A4 · ${data.kind === 'answers' ? '参考答案' : '学生练习纸'}${warnings.size ? ' · 含续页题目' : ''}`;
  fitPreview();
  document.querySelector<HTMLButtonElement>('#print')!.disabled = false;
  document.documentElement.dataset.ready = 'true';
}
function fitPreview(): void {
  const host = document.querySelector<HTMLElement>('.preview')!;
  const padding = parseFloat(getComputedStyle(host).paddingLeft) + parseFloat(getComputedStyle(host).paddingRight);
  const scale = Math.min(1, (host.clientWidth - padding - 2) / (210 * mm));
  for (const paper of papers) { paper.style.transform = `scale(${scale})`; const frame = paper.parentElement!; frame.style.width = `${210 * mm * scale}px`; frame.style.height = `${297 * mm * scale}px`; }
}
document.querySelector('#print')!.addEventListener('click', () => window.print());
document.querySelector('#collapse')!.addEventListener('click', () => { const collapsed = document.body.classList.toggle('collapsed'); document.querySelector('#collapse')!.setAttribute('aria-expanded', String(!collapsed)); fitPreview(); });
window.addEventListener('resize', fitPreview);
render().catch(error => { measurement.remove(); document.documentElement.dataset.error = String(error.message || error); const message = document.querySelector('.status')!; message.classList.add('error'); message.textContent = `无法完成排版：${error.message || error}`; });
