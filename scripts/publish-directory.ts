import { lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

// Build beside the destination. Failed builds leave the last good result intact.
export async function publishDirectory(destination: string, build: (staging: string) => Promise<void>, replace = true): Promise<void> {
  const target = resolve(destination); const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const lock = `${target}.lock`;
  await mkdir(lock); // Fail on concurrent writers; never remove another writer's lock.
  let transaction: string | undefined; let preserve = false;
  try {
    const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return undefined; });
    if (existing && (!replace || !existing.isDirectory() || existing.isSymbolicLink())) throw new Error(`目标已存在或不是普通目录：${target}`);
    transaction = await mkdtemp(join(parent, `.${basename(target)}-next-`));
    const candidate = join(transaction, 'candidate'); const previous = join(transaction, 'previous');
    await mkdir(candidate); await build(candidate);
    if (existing) await rename(target, previous);
    try { await rename(candidate, target); }
    catch (error) {
      if (existing) {
        try { await rename(previous, target); }
        catch (restoreError) { preserve = true; throw new AggregateError([error, restoreError], `恢复失败，旧结果保留在 ${previous}`); }
      }
      throw error;
    }
  } finally {
    if (transaction && !preserve) await rm(transaction, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
