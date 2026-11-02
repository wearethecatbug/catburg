const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const testFiles = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => path.join(__dirname, name));

if (testFiles.length === 0) {
  throw new Error('No timer test files were discovered.');
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
