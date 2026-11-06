import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSkill, skillDestination, skillFiles } from '../scripts/install.ts';

test('host destinations and installed resources preserve portable skill structure', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-install-')); t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'); await mkdir(source);
  for (const file of skillFiles) await writeFile(join(source, file), file === 'package.json' ? '{"name":"study-sheet"}' : file);
  for (const [host, directory] of [['codex', '.agents'], ['claude', '.claude'], ['workbuddy', '.codebuddy']]) {
    const target = skillDestination(host, root); assert.equal(target, join(root, directory, 'skills/study-sheet'));
    await installSkill(target, false, source);
    assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), 'SKILL.md');
    await assert.rejects(installSkill(target, false, source), /目标已存在/);
    await writeFile(join(source, 'SKILL.md'), 'updated'); await installSkill(target, true, source);
    assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), 'updated');
    await writeFile(join(source, 'SKILL.md'), 'SKILL.md');
  }
  assert.throws(() => skillDestination('unknown'), /host 必须/);
  await assert.rejects(installSkill(source, true, source), /源码目录/);
});
