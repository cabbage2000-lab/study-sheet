import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { normalize, project, type PublicSheet } from './schema.ts';
import { launchBrowser } from './browser.ts';
import { exportPdf, type LayoutReport } from './export-pdf.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let resources: Promise<{ css: string; js: string }> | undefined;
async function loadResources(): Promise<{ css: string; js: string }> {
  if (!resources) resources = (async () => {
    const font = await readFile(join(root, 'assets/fonts/NotoSansSC.woff2'));
    let mathCss = await readFile(join(root, 'node_modules/katex/dist/katex.min.css'), 'utf8');
    const urls = [...new Set(mathCss.match(/url\([^)]+\)/g) || [])];
    for (const token of urls) {
      const path = token.slice(4, -1).replace(/["']/g, '');
      const content = await readFile(join(root, 'node_modules/katex/dist', path));
      const mime = path.endsWith('woff2') ? 'font/woff2' : path.endsWith('woff') ? 'font/woff' : 'font/ttf';
      mathCss = mathCss.split(token).join(`url(data:${mime};base64,${content.toString('base64')})`);
    }
    const notices = await Promise.all(['assets/fonts/OFL.txt', 'node_modules/katex/LICENSE', 'node_modules/@chenglou/pretext/LICENSE'].map(path => readFile(join(root, path), 'utf8')));
    const css = '/* Third-party licenses\n' + notices.join('\n\n').replace(/\*\//g, '* /') + '\n*/\n' + `@font-face{font-family:'Study Sans';src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-display:block}\n` + mathCss + '\n' + await readFile(join(root, 'assets/print.css'), 'utf8');
    const bundled = await build({ entryPoints: [join(root, 'assets/templates/worksheet.ts')], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', minify: true, legalComments: 'inline' });
    return { css, js: bundled.outputFiles[0].text };
  })();
  return resources;
}
async function html(data: PublicSheet): Promise<string> {
  const { css, js } = await loadResources();
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.title)}</title><style>${css}</style></head><body>
<aside class="sidebar"><div class="brand"><span class="brand-text"><span class="brand-mark">▤</span> 学习任务纸</span><button id="collapse" aria-label="折叠侧栏" aria-expanded="true">☰</button></div><nav aria-label="页面导航"><p class="nav-label">任务页面</p><div class="page-nav"></div></nav><div class="sidebar-note">A4 · 保留手写空间<br>打印建议：实际大小 / 100%<br>关闭浏览器附加页眉和页脚</div></aside>
<main><div class="topbar"><h1>${escape(data.title)}</h1><div class="actions"><button id="print" class="primary" disabled>打印 / 另存为 PDF</button></div></div><p class="status" role="status">正在加载字体并排版…</p><div class="preview"><div class="pages"></div></div></main>
<script type="application/json" id="sheet-data">${json}</script><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}
export interface GenerateOptions { input: string; out: string; answers?: boolean; htmlOnly?: boolean }
export async function generate(options: GenerateOptions): Promise<Record<string, LayoutReport>> {
  const source = JSON.parse(await readFile(resolve(options.input), 'utf8'));
  const worksheet = normalize(source);
  // Check all requested content before writing artifacts.
  const student = project(worksheet, 'student'); const answers = options.answers ? project(worksheet, 'answers') : undefined;
  const out = resolve(options.out); await mkdir(out, { recursive: true });
  const existing = await readdir(out);
  if (existing.some(n => ['worksheet.json', 'worksheet.html', 'worksheet.pdf', 'answers.html', 'answers.pdf', 'report.json'].includes(n))) throw new Error('输出目录已有任务文件，请选择新目录，避免覆盖旧练习或保留过期答案。');
  await writeFile(join(out, 'worksheet.json'), JSON.stringify(worksheet, null, 2) + '\n');
  await writeFile(join(out, 'worksheet.html'), await html(student));
  if (answers) await writeFile(join(out, 'answers.html'), await html(answers));
  if (options.htmlOnly) { console.log(`已生成可打印 HTML：${join(out, 'worksheet.html')}（未进行浏览器/PDF 校验）`); return {}; }
  let browser;
  try { browser = await launchBrowser(); }
  catch (error) { throw new Error(`可打印 HTML 已保留在 ${out}，但 PDF 未生成。请安装 Chrome 或运行 npx playwright install chromium，或设置 STUDY_SHEET_CHROME。原错误：${(error as Error).message}`); }
  const reports: Record<string, LayoutReport> = {};
  try {
    reports.student = await exportPdf(browser, join(out, 'worksheet.html'), join(out, 'worksheet.pdf'));
    if (answers) reports.answers = await exportPdf(browser, join(out, 'answers.html'), join(out, 'answers.pdf'));
    await writeFile(join(out, 'report.json'), JSON.stringify(reports, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(`已生成 ${reports.student.questions} 题 / ${reports.student.pages} 页：${out}`);
  return reports;
}
function args(argv: string[]): GenerateOptions {
  const result: GenerateOptions = { input: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--input' || flag === '--out') { const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少参数`); result[flag === '--input' ? 'input' : 'out'] = value; }
    else if (flag === '--answers') result.answers = true;
    else if (flag === '--html-only') result.htmlOnly = true;
    else throw new Error(`未知参数 ${flag}`);
  }
  if (!result.input || !result.out) throw new Error('用法：npm run generate -- --input <任务.json> --out <新输出目录> [--answers] [--html-only]');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  generate(args(process.argv.slice(2))).catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
