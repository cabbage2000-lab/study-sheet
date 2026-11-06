import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { generate } from '../scripts/generate.ts';
import { launchBrowser } from '../scripts/browser.ts';

const base = resolve('.test-output');
await mkdir(base, { recursive: true });
const temp = await mkdtemp(join(base, 'browser-'));
async function fixture(name: string, source: unknown, answers = true) {
  const input = join(temp, `${name}.json`); await writeFile(input, JSON.stringify(source));
  const out = join(temp, name); const reports = await generate({ input, out, answers });
  return { out, reports };
}
async function titleOffsets(page: import('playwright').Page): Promise<number[]> {
  return page.locator('.sheet-title').evaluateAll(titles => titles.flatMap(title => {
    const range = document.createRange(); range.selectNodeContents(title);
    const paper = title.closest('.paper')!.getBoundingClientRect();
    return Array.from(range.getClientRects()).filter(rect => rect.width > 0).map(rect => Math.abs((rect.left + rect.right - paper.left - paper.right) / 2));
  }));
}
test('English one-page PDF is A4, answers isolated, print/desktop/mobile work offline', { timeout: 120000 }, async () => {
  const secret = 'secretEnglishAnswer';
  const { out, reports } = await fixture('english', { version: 1, title: '英语练习', sections: [{ task: 'zh-en', lineStyle: 'line', items: Array.from({ length: 16 }, (_, i) => ({ english: `${secret}${i}`, chinese: `词义 ${i + 1}` })) }] });
  assert.equal(reports.student.pages, 1); assert.ok(reports.student.pretextMeasurements > 0);
  const content = await readFile(join(out, 'worksheet.html'), 'utf8'); assert.ok(!content.includes(secret));
  assert.ok((await readFile(join(out, 'answers.html'), 'utf8')).includes(secret));
  const pdf = await PDFDocument.load(await readFile(join(out, 'worksheet.pdf')));
  assert.equal(pdf.getPageCount(), reports.student.pages);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.276) < 1); assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 1);
  const browser = await launchBrowser(); const page = await browser.newPage();
  try {
    let external = 0;
    await page.route(/^https?:/, route => { external++; return route.abort(); });
    await page.goto(pathToFileURL(join(out, 'worksheet.html')).href); await page.waitForFunction(() => document.documentElement.dataset.ready);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `viewport ${width} overflow`);
      await page.screenshot({ path: join(temp, `english-${width}.png`), fullPage: true });
    }
    await page.locator('#collapse').click(); assert.equal(await page.locator('#collapse').getAttribute('aria-expanded'), 'false');
    await page.locator('#print').focus(); assert.equal(await page.evaluate(() => document.activeElement?.id), 'print');
    await page.evaluate(() => { window.print = () => { document.body.dataset.printCalled = 'true'; }; });
    await page.locator('#print').click(); assert.equal(await page.locator('body').getAttribute('data-print-called'), 'true');
    assert.equal(external, 0);
  } finally { await browser.close(); }
});
test('multiple pages preserve order, fractions and every question with no clipping', { timeout: 120000 }, async () => {
  const { out, reports } = await fixture('many', { version: 1, title: '计算错题重做', sections: [{ task: 'steps', items: Array.from({ length: 45 }, (_, i) => ({ id: `math-${i}`, expression: `${i}+1/3`, prompt: `\\(${i} + \\frac{1}{3}\\)`, workspaceMm: 48 })) }] });
  assert.ok(reports.student.pages > 1);
  const pdf = await PDFDocument.load(await readFile(join(out, 'worksheet.pdf'))); assert.equal(pdf.getPageCount(), reports.student.pages);
  const browser = await launchBrowser(); const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(join(out, 'worksheet.html')).href); await page.waitForFunction(() => document.documentElement.dataset.ready);
    assert.deepEqual(await page.locator('.question:not([data-continuation])').evaluateAll(nodes => nodes.map(n => Number((n as HTMLElement).dataset.number))), Array.from({ length: 45 }, (_, i) => i + 1));
    assert.equal(await page.locator('.katex').count(), 45);
    await page.screenshot({ path: join(temp, 'math.png'), fullPage: true });
  } finally { await browser.close(); }
});
test('same-subject sections share page, mixed subjects start new pages, pinyin never exposes target words', { timeout: 120000 }, async () => {
  const { out, reports } = await fixture('mixed', { version: 1, title: '综合练习', sections: [
    { task: 'pinyin', items: [{ word: '绿色', pinyin: 'lǜ sè' }, { word: '银行', pinyin: 'yín háng' }] },
    { task: 'copy', repeats: 2, items: [{ word: '认真' }] },
    { task: 'en-zh', items: [{ english: 'friend', chinese: '朋友' }] }
  ] });
  assert.equal(reports.student.pages, 2);
  const html = await readFile(join(out, 'worksheet.html'), 'utf8'); assert.ok(!html.includes('绿色')); assert.ok(!html.includes('银行')); assert.ok(!html.includes('朋友'));
  const browser = await launchBrowser(); const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(join(out, 'worksheet.html')).href); await page.waitForFunction(() => document.documentElement.dataset.ready);
    assert.equal(await page.locator('.task-pinyin .hanzi-cell').count(), 4);
    assert.equal(await page.locator('.task-copy .hanzi-cell').count(), 6);
    await page.screenshot({ path: join(temp, 'chinese.png'), fullPage: true });
  } finally { await browser.close(); }
});
test('oversize question continues with stable numbering and full writing space', { timeout: 120000 }, async () => {
  const { out, reports } = await fixture('long', { version: 1, title: '长题练习', sections: [{ task: 'word-problem', items: [{ prompt: '一项活动分为若干步骤。\n'.repeat(35) + '请写出你的计算过程。', workspaceMm: 300 }] }] }, false);
  assert.ok(reports.student.pages > 1);
  const browser = await launchBrowser(); const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(join(out, 'worksheet.html')).href); await page.waitForFunction(() => document.documentElement.dataset.ready);
    assert.equal(await page.locator('.workspace-line').count(), 38);
    assert.equal(await page.locator('.prompt').count(), 36);
    assert.ok(await page.locator('[data-continuation]').count() > 0);
    const nums = await page.locator('.question').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.number)); assert.ok(nums.every(n => n === '1'));
  } finally { await browser.close(); }
});

test('titles are centered and one- to three-digit numbers align with their prompts', { timeout: 120000 }, async () => {
  const { out } = await fixture('alignment', { version: 1, title: '题目对齐检查', sections: [
    { task: 'oral', items: Array.from({ length: 100 }, (_, i) => ({ expression: `${i}+1` })) },
    { task: 'pinyin', items: [{ word: '春天', pinyin: 'chūn tiān' }] },
    { task: 'copy', items: [{ word: '认真' }] }
  ] }, false);
  const browser = await launchBrowser(); const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(join(out, 'worksheet.html')).href); await page.waitForFunction(() => document.documentElement.dataset.ready);
    await page.emulateMedia({ media: 'print' });
    const geometry = await page.evaluate(() => {
      const questions = Array.from(document.querySelectorAll<HTMLElement>('.question:not([data-continuation])')).map(question => {
        const label = question.querySelector('.question-label')!.getBoundingClientRect();
        const content = question.querySelector('.prompt,.pinyin,.copy-label')!.getBoundingClientRect();
        return { number: Number(question.dataset.number), labelRight: label.right - question.getBoundingClientRect().left, gap: content.left - label.right, centerDifference: Math.abs((label.top + label.bottom - content.top - content.bottom) / 2) };
      });
      return { questions };
    });
    const offsets = await titleOffsets(page);
    assert.ok(offsets.length > 0 && offsets.every(offset => offset < 1), 'title text must be centered on the paper');
    const mutation = await page.addStyleTag({ content: '.sheet-title { text-align: left !important; }' });
    assert.ok((await titleOffsets(page)).some(offset => offset > 10), 'the check must detect left-aligned title text');
    await mutation.evaluate(node => node.parentNode!.removeChild(node));
    assert.ok((await titleOffsets(page)).every(offset => offset < 1), 'restored title must pass');
    for (const number of [1, 10, 100, 101, 102]) {
      const question = geometry.questions.find(q => q.number === number)!;
      assert.ok(question.gap >= 2, `question ${number}: number overlaps prompt`);
      assert.ok(question.centerDifference < 1, `question ${number}: number and prompt are not aligned`);
      assert.ok(Math.abs(question.labelRight - geometry.questions[0].labelRight) < 1, `question ${number}: number column is not aligned`);
    }
    await page.screenshot({ path: join(temp, 'alignment.png'), fullPage: true });
  } finally { await browser.close(); }
});
