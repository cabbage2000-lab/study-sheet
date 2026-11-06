import { cp, readFile, lstat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publishDirectory } from './publish-directory.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const skillFiles = ['SKILL.md', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'agents', 'assets', 'references', 'scripts', 'tests', 'docs'];
export function skillDestination(host: string, project?: string): string {
  const directories: Record<string, string> = { codex: '.agents', claude: '.claude', workbuddy: project ? '.codebuddy' : '.workbuddy' };
  if (!directories[host]) throw new Error('host 必须是 codex、claude 或 workbuddy');
  return resolve(project || homedir(), directories[host], 'skills/study-sheet');
}
export async function installSkill(destination: string, update = false, source = root): Promise<void> {
  const target = resolve(destination); const origin = resolve(source);
  const sourceFromTarget = relative(target, origin);
  if (sourceFromTarget === '' || (!sourceFromTarget.startsWith('..') && !isAbsolute(sourceFromTarget))) throw new Error('不能覆盖源码目录或其父目录');
  const exists = await lstat(target).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return undefined; });
  if (exists && update) {
    const metadata = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    if (metadata.name !== 'study-sheet') throw new Error('目标不是 study-sheet 安装，拒绝更新');
  }
  await publishDirectory(target, async staging => {
    for (const file of skillFiles) await cp(join(origin, file), join(staging, file), { recursive: true, errorOnExist: true, force: false });
  }, update);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); let host = ''; let project: string | undefined; let update = false;
  try {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--update') update = true;
      else if (args[i] === '--host' || args[i] === '--project') {
        const flag = args[i]; const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少参数`);
        if (flag === '--host') host = value; else project = value;
      } else throw new Error(`未知参数：${args[i]}`);
    }
    const target = skillDestination(host, project); await installSkill(target, update);
    console.log(`已${update ? '更新' : '安装'}技能：${target}\n下一步：npm --prefix ${JSON.stringify(target)} ci\n生成的练习请放在安装目录以外，更新会替换整个技能目录。`);
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
