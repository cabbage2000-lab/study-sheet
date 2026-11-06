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

test('metadata is centered and section titles share the instruction baseline without clipping', { timeout: 120000 }, async () => {
  const longInstructions = '请按照题目顺序完成，写完后检查字母占格和词义。'.repeat(8) + '\n完成后再次检查。';
  const longSectionTitle = '需要完整保留的较长题型标题'.repeat(5);
  const { out } = await fixture('header', { version: 1, title: '英语词汇综合巩固练习'.repeat(4), grade: '小学三年级', date: '2026-11-06', sections: [
    { task: 'zh-en', title: '看中文写英文', instructions: '根据中文写出英文，注意字母占格。', items: [{ english: 'apple', chinese: '苹果' }] },
    { task: 'zh-en', title: '长说明', instructions: longInstructions, items: [{ english: 'school', chinese: '学校' }] },
    { task: 'zh-en', title: longSectionTitle, instructions: '每个单词写一遍。', items: [{ english: 'friend', chinese: '朋友' }] },
    { task: 'en-zh', title: '词义回顾', items: [{ english: 'library', chinese: '图书馆' }] }
  ] });
  const browser = await launchBrowser(); const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const geometry = () => page.evaluate(() => {
    const metadata = Array.from(document.querySelectorAll('.sheet-meta')).map(meta => {
      const rects = Array.from(meta.children).map(field => { const range = document.createRange(); range.selectNodeContents(field); return range.getBoundingClientRect(); });
      const paper = meta.closest('.paper')!.getBoundingClientRect();
      return Math.abs((Math.min(...rects.map(r => r.left)) + Math.max(...rects.map(r => r.right)) - paper.left - paper.right) / 2);
    });
    const headings = Array.from(document.querySelectorAll<HTMLElement>('.section-heading.with-instructions')).map(heading => {
      const title = heading.querySelector<HTMLElement>('.section-title')!; const instructions = heading.querySelector<HTMLElement>('.instructions')!;
      const baselines = [title, instructions].map(node => {
        const marker = document.createElement('span'); marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;border:0;vertical-align:baseline';
        node.prepend(marker); const top = marker.getBoundingClientRect().top; marker.remove(); return top;
      });
      const titleBox = title.getBoundingClientRect(); const instructionBox = instructions.getBoundingClientRect();
      return { title: title.textContent, gap: instructionBox.left - titleBox.right, baselineDifference: Math.abs(baselines[0] - baselines[1]), lines: instructionBox.height / parseFloat(getComputedStyle(instructions).lineHeight) };
    });
    const clipped = Array.from(document.querySelectorAll<HTMLElement>('.sheet-header,.sheet-meta,.section-heading,.section-title,.instructions')).filter(node => {
      const bounds = node.getBoundingClientRect(); const paper = node.closest('.paper')!; const paperBox = paper.getBoundingClientRect(); const style = getComputedStyle(paper);
      return node.scrollWidth > node.clientWidth + 1 || bounds.left < paperBox.left + parseFloat(style.paddingLeft) - 1 || bounds.right > paperBox.right - parseFloat(style.paddingRight) + 1;
    }).length;
    return { metadata, headings, clipped };
  });
  try {
    for (const kind of ['worksheet', 'answers']) {
      await page.emulateMedia({ media: 'screen' });
      await page.goto(pathToFileURL(join(out, `${kind}.html`)).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready || document.documentElement.dataset.error);
      assert.equal(await page.locator('html').getAttribute('data-error'), null, `${kind}: layout succeeds before printing`);
      await page.emulateMedia({ media: 'print' });
      const measured = await geometry();
      assert.ok(measured.metadata.length > 0 && measured.metadata.every(offset => offset < 1), `${kind}: actual metadata text is centered`);
      assert.ok((await titleOffsets(page)).every(offset => offset < 1), `${kind}: wrapped title text is centered`);
      assert.equal(measured.clipped, 0, `${kind}: header content fits the printable width`);
      assert.equal(await page.locator('.question:not([data-continuation])').count(), 4);
      if (kind === 'worksheet') {
        assert.ok(await page.locator('.section-break.with-instructions').count() > 0, 'the same layout is used for mid-page sections');
        assert.ok(measured.headings.every(h => h.gap >= 2 && h.baselineDifference < 1), 'titles and instructions align on the first baseline');
        assert.ok(measured.headings.find(h => h.title === '看中文写英文')!.lines < 1.1, 'short instructions stay on the title row');
        assert.ok(measured.headings.find(h => h.title === '长说明')!.lines > 2, 'long instructions wrap in their own column');
        assert.ok(measured.headings.some(h => h.title === longSectionTitle), 'long headings remain complete');
        assert.ok((await page.locator('.instructions').allTextContents()).includes(longInstructions), 'line breaks and instruction text are preserved');
        const leftAligned = await page.addStyleTag({ content: '.sheet-meta { justify-content:flex-start!important; }' });
        assert.ok((await geometry()).metadata.some(offset => offset > 10), 'the check detects left-aligned metadata');
        await leftAligned.evaluate(node => node.parentNode!.removeChild(node));
        const stacked = await page.addStyleTag({ content: '.section-heading { display:block!important; }' });
        assert.ok((await geometry()).headings[0].baselineDifference > 10, 'the check detects stacked headings and instructions');
        await stacked.evaluate(node => node.parentNode!.removeChild(node));
      }
      await page.locator('.paper').first().screenshot({ path: join(temp, `header-${kind}.png`) });
    }
  } finally { await browser.close(); }
});
