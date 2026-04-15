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

console.log('Starting Onli Synth dev environment...\n');

// 1. MarketSB sim (port 3101)
procs.push(startProcess('marketsb', 'npx', ['tsx', 'src/index.ts'], join(ROOT, 'packages/marketsb-sim')));

// 2. Species sim (port 3102) — wait 2s for MarketSB to be ready
setTimeout(() => {
  procs.push(startProcess('species', 'npx', ['tsx', 'src/index.ts'], join(ROOT, 'packages/species-sim')));
}, 2000);

// 3. Chat server (port 3100)
setTimeout(() => {
  procs.push(startProcess('chat', 'node', ['server.mjs'], ROOT));
}, 1000);

// 4. Vite dev server (port 3200 — keep all npm/dev processes in 3000–4000)
setTimeout(() => {
  procs.push(startProcess('vite', 'npx', ['vite', '--port', '3200', '--host'], ROOT));
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
});
