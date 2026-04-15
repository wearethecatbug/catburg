import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const quotedArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg));
const child = spawn(`pnpm exec next dev --turbopack ${quotedArgs.join(' ')}`.trim(), {
  stdio: 'inherit',
  shell: true,
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


