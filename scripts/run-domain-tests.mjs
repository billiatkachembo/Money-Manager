import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, '.tmp-tests');
const tsconfigPath = path.join(rootDir, 'tsconfig.domain-tests.json');
const tscPath = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
const compiledTestsDir = path.join(outDir, 'tests', 'domain');

rmSync(outDir, { recursive: true, force: true });

execFileSync(process.execPath, [tscPath, '--project', tsconfigPath], {
  cwd: rootDir,
  stdio: 'inherit',
});

const testFiles = [];

function collectTests(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectTests(fullPath);
      continue;
    }

    if (entry.endsWith('.test.js')) {
      testFiles.push(fullPath);
    }
  }
}

collectTests(compiledTestsDir);

if (testFiles.length === 0) {
  throw new Error(`No compiled domain tests found in ${compiledTestsDir}`);
}

execFileSync(process.execPath, ['--test', ...testFiles], {
  cwd: rootDir,
  stdio: 'inherit',
});
