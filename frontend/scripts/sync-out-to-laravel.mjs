import { cp, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(frontendRoot, '..');
const outDir = resolve(frontendRoot, 'out');
const laravelPublicDir = resolve(repoRoot, 'backend', 'public');
const preservedEntries = new Set(['.htaccess', 'index.php', 'storage']);

const clearDirectory = async (targetDir, keep) => {
  const entries = await readdir(targetDir, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    if (keep.has(entry.name)) {
      return;
    }

    const absolutePath = resolve(targetDir, entry.name);
    await rm(absolutePath, { force: true, recursive: true });
  }));
};

const ensureDirectory = async (targetDir) => {
  await mkdir(targetDir, { recursive: true });
};

const copyExport = async (sourceDir, targetDir) => {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = resolve(sourceDir, entry.name);
    const targetPath = resolve(targetDir, entry.name);
    const stats = await lstat(sourcePath);

    if (stats.isDirectory()) {
      await cp(sourcePath, targetPath, { force: true, recursive: true });
      return;
    }

    if (stats.isSymbolicLink()) {
      return;
    }

    await cp(sourcePath, targetPath, { force: true });
  }));
};

const main = async () => {
  await ensureDirectory(laravelPublicDir);
  await clearDirectory(laravelPublicDir, preservedEntries);
  await copyExport(outDir, laravelPublicDir);

  process.stdout.write(`Synced ${outDir} to ${laravelPublicDir}\n`);
};

await main();
