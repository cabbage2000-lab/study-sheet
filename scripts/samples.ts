import { generate } from './generate.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { launchBrowser } from './browser.ts';
import { publishDirectory } from './publish-directory.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'output/samples');
await publishDirectory(target, async staging => {
  for (const subject of ['english', 'math', 'chinese']) {
    const out = resolve(staging, subject);
    const reports = await generate({ input: resolve(root, `tests/fixtures/${subject}.json`), out, answers: true });
    for (const [kind, name] of [['student', 'worksheet'], ['answers', 'answers']] as const) {
      const pdf = await PDFDocument.load(await readFile(resolve(out, `${name}.pdf`)));
      if (pdf.getPageCount() !== reports[kind].pages) throw new Error(`${subject}/${name} 页数与报告不一致`);
      for (const page of pdf.getPages()) {
        if (Math.abs(page.getWidth() - 595.276) > 1 || Math.abs(page.getHeight() - 841.89) > 1) throw new Error(`${subject}/${name} 不是 A4`);
      }
    }
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
      await page.goto(pathToFileURL(resolve(out, 'worksheet.html')).href);
      await page.waitForFunction(() => document.documentElement.dataset.ready);
      await page.emulateMedia({ media: 'print' });
      await page.locator('.paper').first().screenshot({ path: resolve(out, 'preview.png') });
    } finally { await browser.close(); }
  }
  await writeFile(resolve(staging, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), subjects: ['english', 'math', 'chinese'], source: 'tests/fixtures' }, null, 2) + '\n');
});
console.log(`样张已验证并更新：${target}`);
