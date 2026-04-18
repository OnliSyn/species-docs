import { test, expect, type APIRequestContext } from '@playwright/test';
import { resetLocalSims } from './helpers/trade-journey';

const MARKETSB = process.env.PLAYWRIGHT_MARKETSB_URL ?? 'http://localhost:3101';
const SPECIES = process.env.PLAYWRIGHT_SPECIES_URL ?? 'http://localhost:3102';
const USDC_SCALE = 1_000_000n;

const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
);

type CanonSnapshot = {
  circulation: number;
  assurancePosted: bigint;
};

function eventId(name: string): string {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson(
  request: APIRequestContext,
  url: string,
  body: unknown,
): Promise<unknown> {
  const res = await request.post(url, { data: body });
  expect(res.ok(), `${url} HTTP ${res.status()}`).toBeTruthy();
  return res.json();
}

async function getJson(request: APIRequestContext, url: string): Promise<unknown> {
  const res = await request.get(url);
  expect(res.ok(), `${url} HTTP ${res.status()}`).toBeTruthy();
  return res.json();
}

async function simulateDeposit(
  request: APIRequestContext,
  userRef: string,
  amountBaseUnits: bigint,
): Promise<void> {
  await postJson(request, `${MARKETSB}/sim/simulate-deposit`, {
    vaId: `va-funding-${userRef}`,
    amount: Number(amountBaseUnits),
  });
}

async function getCanonSnapshot(request: APIRequestContext): Promise<CanonSnapshot> {
  const [speciesState, assuranceVa] = await Promise.all([
    getJson(request, `${SPECIES}/sim/state`) as Promise<any>,
    getJson(request, `${MARKETSB}/api/v1/virtual-accounts/assurance-global`) as Promise<any>,
  ]);

  const circulation = Number(speciesState.circulation ?? 0);
  const postedRaw = assuranceVa.balance?.posted ?? assuranceVa.posted ?? 0;
  return {
    circulation,
    assurancePosted: BigInt(postedRaw),
  };
}

async function getSpeciesEventEntries(
  request: APIRequestContext,
  evt: string,
): Promise<Array<any>> {
  return (await getJson(request, `${SPECIES}/oracle/events/${evt}/entries`)) as Array<any>;
}

async function waitForEventCompletion(
  request: APIRequestContext,
  evt: string,
  opts: { autoApproveAskToMove?: boolean } = {},
): Promise<any> {
  let approved = false;
  for (let i = 0; i < 180; i++) {
    const status = (await getJson(request, `${SPECIES}/marketplace/v1/events/${evt}/status`)) as any;
    if (status.currentStage === 'ask_to_move.pending' && opts.autoApproveAskToMove && !approved) {
      await postJson(request, `${SPECIES}/sim/approve/${evt}`, {});
      approved = true;
    }
    if (status.status === 'completed') {
      return getJson(request, `${SPECIES}/marketplace/v1/events/${evt}/receipt`);
    }
    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(
        `event ${evt} ${status.status} at ${status.currentStage}: ${status.error ?? 'unknown'}`,
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`event ${evt} timed out`);
}

async function submitEvent(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`${SPECIES}/marketplace/v1/eventRequest`, { data: body });
  expect(res.status(), `eventRequest ${JSON.stringify(body)}`).toBe(202);
}

async function issueToUser(
  request: APIRequestContext,
  userRef: string,
  qty: number,
): Promise<{ evt: string; receipt: any }> {
  await simulateDeposit(request, userRef, 20_000n * USDC_SCALE);
  const evt = eventId(`issuance-${userRef}`);
  await submitEvent(request, {
    eventId: evt,
    intent: 'buy',
    quantity: qty,
    paymentSource: { vaId: `va-funding-${userRef}` },
    idempotencyKey: `idem-${evt}`,
  });
  const receipt = await waitForEventCompletion(request, evt);
  return { evt, receipt };
}

test.describe.configure({ timeout: 300_000 });

test.describe('Canon transitions (Playwright API E2E)', () => {
  test.skip(
    !isLocalBase,
    'Requires local sims (uses /sim/reset and direct species/marketsb local endpoints)',
  );

  test.beforeEach(async () => {
    await resetLocalSims();
  });

  test('ISSUANCE: Δcirculation=+Q and Δassurance=+$1×Q', async ({ request }) => {
    const before = await getCanonSnapshot(request);
    const q = 7;
    const { evt, receipt } = await issueToUser(request, 'user-001', q);
    const after = await getCanonSnapshot(request);

    expect(after.circulation - before.circulation).toBe(q);
    expect(after.assurancePosted - before.assurancePosted).toBe(BigInt(q) * USDC_SCALE);
    expect(receipt.oracleRefs?.fundingOracle).toBeTruthy();
    expect(receipt.oracleRefs?.assetOracle).toBeTruthy();

    const entries = await getSpeciesEventEntries(request, evt);
    expect(entries.some((e) => e.type === 'change_owner' && e.from === 'treasury' && e.to === 'onli-user-001' && e.count === q)).toBe(true);
  });

  test('SELL_MARKET_LISTING: Δcirculation=0 and Δassurance=0', async ({ request }) => {
    await issueToUser(request, 'user-001', 8);

    const before = await getCanonSnapshot(request);
    const q = 3;
    const evt = eventId('sell-list');
    await submitEvent(request, {
      eventId: evt,
      intent: 'sell',
      quantity: q,
      paymentSource: { vaId: 'va-funding-user-001' },
      listingConfig: { autoAuthorize: true },
      idempotencyKey: `idem-${evt}`,
    });
    const receipt = await waitForEventCompletion(request, evt);
    const after = await getCanonSnapshot(request);

    expect(after.circulation - before.circulation).toBe(0);
    expect(after.assurancePosted - before.assurancePosted).toBe(0n);
    expect(receipt.matches?.[0]?.listingId).toBeTruthy();

    const entries = await getSpeciesEventEntries(request, evt);
    expect(entries.some((e) => e.type === 'ask_to_move' && e.from === 'onli-user-001' && e.to === 'sellerLocker' && e.count === q)).toBe(true);
  });

  test('BUY_MARKET_EXECUTION: Δcirculation=0 and Δassurance=0', async ({ request }) => {
    await issueToUser(request, 'user-001', 5);
    const sellEvt = eventId('sell-for-buy-market');
    await submitEvent(request, {
      eventId: sellEvt,
      intent: 'sell',
      quantity: 4,
      paymentSource: { vaId: 'va-funding-user-001' },
      listingConfig: { autoAuthorize: true },
      idempotencyKey: `idem-${sellEvt}`,
    });
    await waitForEventCompletion(request, sellEvt);

    await simulateDeposit(request, 'user-456', 20_000n * USDC_SCALE);
    const before = await getCanonSnapshot(request);
    const q = 2;
    const evt = eventId('buy-market');
    await submitEvent(request, {
      eventId: evt,
      intent: 'buy',
      quantity: q,
      paymentSource: { vaId: 'va-funding-user-456' },
      idempotencyKey: `idem-${evt}`,
    });
    const receipt = await waitForEventCompletion(request, evt);
    const after = await getCanonSnapshot(request);

    expect(after.circulation - before.circulation).toBe(0);
    expect(after.assurancePosted - before.assurancePosted).toBe(0n);
    expect(receipt.matches?.some((m: any) => m.counterparty !== 'treasury')).toBe(true);

    const entries = await getSpeciesEventEntries(request, evt);
    expect(entries.some((e) => e.type === 'change_owner' && e.from === 'sellerLocker' && e.to === 'onli-user-456' && e.count === q)).toBe(true);
  });

  test('TRANSFER_EXECUTION: AskToMove + ChangeOwner, Δcirculation=0 and Δassurance=0', async ({
    request,
  }) => {
    await issueToUser(request, 'user-001', 6);

    const before = await getCanonSnapshot(request);
    const q = 4;
    const evt = eventId('transfer');
    await submitEvent(request, {
      eventId: evt,
      intent: 'transfer',
      quantity: q,
      paymentSource: { vaId: 'va-funding-user-001' },
      recipient: { onliId: 'onli-user-789' },
      idempotencyKey: `idem-${evt}`,
    });
    const receipt = await waitForEventCompletion(request, evt, { autoApproveAskToMove: true });
    const after = await getCanonSnapshot(request);

    expect(after.circulation - before.circulation).toBe(0);
    expect(after.assurancePosted - before.assurancePosted).toBe(0n);
    expect(receipt.oracleRefs?.assetOracle).toBeTruthy();

    const entries = await getSpeciesEventEntries(request, evt);
    expect(entries.some((e) => e.type === 'ask_to_move' && e.from === 'onli-user-001' && e.to === 'locker:onli-user-001' && e.count === q)).toBe(true);
    expect(entries.some((e) => e.type === 'change_owner' && e.from === 'locker:onli-user-001' && e.to === 'onli-user-789' && e.count === q)).toBe(true);
  });

  test('REDEMPTION: Δcirculation=-Q and Δassurance=-$1×Q', async ({ request }) => {
    await issueToUser(request, 'user-001', 9);

    const before = await getCanonSnapshot(request);
    const q = 5;
    const evt = eventId('redeem');
    await submitEvent(request, {
      eventId: evt,
      intent: 'redeem',
      quantity: q,
      paymentSource: { vaId: 'va-funding-user-001' },
      idempotencyKey: `idem-${evt}`,
    });
    const receipt = await waitForEventCompletion(request, evt);
    const after = await getCanonSnapshot(request);

    expect(after.circulation - before.circulation).toBe(-q);
    expect(after.assurancePosted - before.assurancePosted).toBe(-BigInt(q) * USDC_SCALE);
    expect(receipt.oracleRefs?.fundingOracle).toBeTruthy();
    expect(receipt.oracleRefs?.assetOracle).toBeTruthy();

    const entries = await getSpeciesEventEntries(request, evt);
    expect(entries.some((e) => e.type === 'ask_to_move' && e.from === 'onli-user-001' && e.to === 'sellerLocker' && e.count === q)).toBe(true);
    expect(entries.some((e) => e.type === 'change_owner' && e.from === 'sellerLocker' && e.to === 'marketMaker' && e.count === q)).toBe(true);
  });
});
