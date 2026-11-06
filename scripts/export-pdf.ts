import type { Browser } from 'playwright';
import { pathToFileURL } from 'node:url';
export interface LayoutReport { pages: number; questions: number; fontPt: number; pretextMeasurements: number; warnings: string[] }
export async function exportPdf(browser: Browser, htmlPath: string, pdfPath?: string): Promise<LayoutReport> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.ready || document.documentElement.dataset.error, { timeout: 60000 });
    const error = await page.evaluate(() => document.documentElement.dataset.error);
    if (error) throw new Error(error);
    await page.emulateMedia({ media: 'print' });
    const issues = await page.evaluate(() => {
      const issues: string[] = [];
      for (const [i, paper] of Array.from(document.querySelectorAll<HTMLElement>('.paper')).entries()) {
        const body = paper.querySelector<HTMLElement>('.sheet-body')!; const rect = body.getBoundingClientRect();
        if (body.scrollHeight > body.clientHeight + 2) issues.push(`第 ${i + 1} 页内容高度溢出`);
        for (const q of paper.querySelectorAll<HTMLElement>('.question')) {
          const r = q.getBoundingClientRect();
          if (r.bottom > rect.bottom + 1 || r.right > rect.right + 1 || r.left < rect.left - 1) issues.push(`题 ${q.dataset.number} 超出页面正文区`);
          if (q.scrollWidth > q.clientWidth + 1) issues.push(`题 ${q.dataset.number} 横向溢出`);
        }
      }
      return issues;
    });
    if (issues.length) throw new Error(issues.join('\n'));
    const report = await page.evaluate(() => (window as any).__worksheetReport as LayoutReport);
    if (pdfPath) await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true });
    return report;
  } finally { await page.close(); }
}
