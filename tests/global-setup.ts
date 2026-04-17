/**
 * Vitest global setup: start MarketSB + Species sims when VITEST_MANAGE_SIMS=1.
 * Reuses already-healthy sims (does not kill external processes).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const MSB_HEALTH = 'http://127.0.0.1:3101/health';
const SP_HEALTH = 'http://127.0.0.1:3102/health';

const PATH_PREFIX = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}`;

function withSimPath(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: PATH_PREFIX };
}

async function healthOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await healthOk(url)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`[vitest global-setup] Timed out waiting for ${url}`);
}

function logChild(name: string, proc: ChildProcess): void {
  proc.stdout?.on('data', (d: Buffer) => {
    const s = d.toString().trim();
    if (s) console.log(`[${name}] ${s}`);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    const s = d.toString().trim();
    if (s) console.error(`[${name}] ${s}`);
  });
  proc.on('exit', (code, sig) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited code=${code} signal=${sig ?? ''}`);
    }
  });
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (process.env.VITEST_MANAGE_SIMS !== '1') {
    return async () => {};
  }

  const msbAlready = await healthOk(MSB_HEALTH);
  const spAlready = await healthOk(SP_HEALTH);

  if (msbAlready && spAlready) {
    console.log('[vitest global-setup] Sims already healthy on :3101 / :3102 (reusing)');
    return async () => {};
  }

  const started: { msb?: ChildProcess; sp?: ChildProcess } = {};

  if (!msbAlready) {
    console.log('[vitest global-setup] Starting MarketSB sim on :3101...');
    started.msb = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: path.join(ROOT, 'packages/marketsb-sim'),
      env: { ...withSimPath(), MARKETSB_SIM_PORT: '3101' },
      stdio: 'pipe',
    });
    logChild('marketsb-sim', started.msb);
    await waitHealth(MSB_HEALTH, 90_000);
  }

  if (!spAlready) {
    console.log('[vitest global-setup] Starting Species sim on :3102...');
    started.sp = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: path.join(ROOT, 'packages/species-sim'),
      env: {
        ...withSimPath(),
        PORT: '3102',
        MARKETSB_URL: 'http://127.0.0.1:3101/api/v1',
      },
      stdio: 'pipe',
    });
    logChild('species-sim', started.sp);
    await waitHealth(SP_HEALTH, 90_000);
  }

  console.log('[vitest global-setup] Sims are ready');

  return async () => {
    if (started.sp) {
      started.sp.kill('SIGTERM');
      await new Promise<void>((r) => {
        started.sp!.on('exit', () => r());
        setTimeout(r, 3000);
      });
    }
    if (started.msb) {
      started.msb.kill('SIGTERM');
      await new Promise<void>((r) => {
        started.msb!.on('exit', () => r());
        setTimeout(r, 3000);
      });
    }
  };
}
