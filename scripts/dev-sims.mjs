import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function startProcess(name, command, args, cwd) {
  const proc = spawn(command, args, {
    cwd: cwd || ROOT,
    stdio: 'pipe',
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
  });
  proc.stdout.on('data', (d) => console.log(`[${name}] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => console.error(`[${name}] ${d.toString().trim()}`));
  proc.on('exit', (code) => console.log(`[${name}] exited (${code})`));
  return proc;
}

const procs = [];

console.log('Starting sim servers only...\n');

// 1. MarketSB sim (port 4001)
procs.push(startProcess('marketsb', 'npx', ['tsx', 'src/index.ts'], join(ROOT, 'packages/marketsb-sim')));

// 2. Species sim (port 4002) — wait 2s for MarketSB to be ready
setTimeout(() => {
  procs.push(startProcess('species', 'npx', ['tsx', 'src/index.ts'], join(ROOT, 'packages/species-sim')));
}, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down sims...');
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
});
