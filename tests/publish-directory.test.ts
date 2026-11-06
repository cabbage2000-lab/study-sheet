import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishDirectory } from '../scripts/publish-directory.ts';

test('sample updates replace only the sample set and remove stale artifacts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-publish-')); t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'samples'); await mkdir(target);
  await writeFile(join(target, 'old.pdf'), 'old'); await writeFile(join(root, 'student.json'), 'keep');
  await publishDirectory(target, async dir => { await writeFile(join(dir, 'new.pdf'), 'new'); });
  assert.deepEqual(await readdir(target), ['new.pdf']);
  assert.equal(await readFile(join(root, 'student.json'), 'utf8'), 'keep');
  assert.deepEqual((await readdir(root)).sort(), ['samples', 'student.json']);
});

test('failed rendering or promotion keeps the previous sample set', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-publish-')); t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'samples'); await mkdir(target); await writeFile(join(target, 'old.pdf'), 'old');
  await assert.rejects(publishDirectory(target, async dir => { await writeFile(join(dir, 'partial.html'), 'partial'); throw new Error('render failed'); }), /render failed/);
  assert.equal(await readFile(join(target, 'old.pdf'), 'utf8'), 'old');
  await assert.rejects(publishDirectory(target, async dir => { await rm(dir, { recursive: true }); }), /ENOENT/);
  assert.equal(await readFile(join(target, 'old.pdf'), 'utf8'), 'old');
  assert.deepEqual(await readdir(root), ['samples']);
});

test('concurrent updates and symlink targets are rejected', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-publish-')); t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'samples'); await mkdir(`${target}.lock`);
  await assert.rejects(publishDirectory(target, async () => {}), /EEXIST/);
  assert.deepEqual(await readdir(root), ['samples.lock']);
  await rm(`${target}.lock`, { recursive: true });
  const other = join(root, 'other'); await mkdir(other); await writeFile(join(other, 'keep'), 'keep');
  await symlink(other, target, 'dir');
  await assert.rejects(publishDirectory(target, async () => {}), /普通目录/);
  assert.equal(await readFile(join(other, 'keep'), 'utf8'), 'keep');
});
