/**
 * One command for local UI: ensure MarketSB + Species sims are up, then `next dev`.
 * Use: npm run dev:local
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function simHealthy(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitSim(port, label, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    if (await simHealthy(port)) {
      console.log(`[dev:local] ${label} ready on :${port}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`[dev:local] timed out waiting for ${label} on :${port}`);
}

const msbUp = await simHealthy(3101);
const specUp = await simHealthy(3102);
let simsProc = null;

if (!msbUp || !specUp) {
  if (msbUp !== specUp) {
    console.warn(
      '[dev:local] Only one sim is up; starting dev-sims (may fail if the other port is stuck). Prefer stopping stray processes on 3101/3102 first.',
    );
  }
  console.log('[dev:local] Starting sims (node scripts/dev-sims.mjs)…');
  simsProc = spawn('node', ['scripts/dev-sims.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  simsProc.on('error', (err) => {
    console.error('[dev:local] failed to spawn dev-sims:', err);
    process.exit(1);
  });
  await waitSim(3101, 'MarketSB');
  await waitSim(3102, 'Species');
} else {
  console.log('[dev:local] Sims already healthy on :3101 and :3102 — skipping dev-sims spawn.');
}

console.log('[dev:local] Starting Next.js on http://127.0.0.1:3000 …');
const next = spawn('npm', ['run', 'dev'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env },
});

function shutdown(code) {
  if (simsProc && !simsProc.killed) {
    try {
      simsProc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(code ?? 0);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

next.on('exit', (code, signal) => {
  if (signal) shutdown(130);
  else shutdown(code ?? 0);
});

next.on('error', (err) => {
  console.error('[dev:local] next dev failed to spawn:', err);
  shutdown(1);
});
