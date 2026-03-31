import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const nextDir = resolve(appDir, '.next');
const cliArgs = process.argv.slice(2);

rmSync(nextDir, { recursive: true, force: true });

const child = spawn(
  'pnpm',
  ['exec', 'next', 'build', ...cliArgs],
  {
    cwd: appDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_OPTIONS: '',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

