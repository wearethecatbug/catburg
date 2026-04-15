import { spawn } from 'node:child_process';

const cliArgs = process.argv.slice(2);
const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'pnpm', 'exec', 'next', 'build', ...cliArgs]
  : ['exec', 'next', 'build', ...cliArgs];

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});


