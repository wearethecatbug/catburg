import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const nextDir = resolve(appDir, '.next');
const cliArgs = process.argv.slice(2);
const hasExplicitPort = cliArgs.includes('--port') || cliArgs.some((arg) => arg.startsWith('--port='));

rmSync(nextDir, { recursive: true, force: true });

const child = spawn(
  'pnpm',
  [
    'exec',
    'next',
    'dev',
    '--turbopack',
    ...(hasExplicitPort ? [] : ['--port', '3003']),
    ...cliArgs,
  ],
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

