import { copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishDirectory } from './publish-directory.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await publishDirectory(resolve(root, 'docs/examples'), async staging => {
  for (const subject of ['english', 'math', 'chinese']) {
    await copyFile(resolve(root, `output/samples/${subject}/worksheet.pdf`), resolve(staging, `${subject}.pdf`));
    await copyFile(resolve(root, `output/samples/${subject}/preview.png`), resolve(staging, `${subject}.png`));
  }
  await copyFile(resolve(root, 'output/samples/manifest.json'), resolve(staging, 'manifest.json'));
});
console.log('已更新 docs/examples 中的三科 PDF 和第一页预览。');
