import type { SpeciesSimState, MatchResult, MatchFill } from '../state.js';

let matchCounter = 0;

export function resetMatchCounter(): void {
  matchCounter = 0;
}

/**
 * Market-first matching: check active listings first, then Treasury fallback.
 * For buy: match against active sell listings, remainder from treasury.
 * For sell: creates a listing (handled outside matching).
 * For transfer: no matching needed.
 */
export function matchOrder(
  state: SpeciesSimState,
  intent: 'buy' | 'sell' | 'transfer',
  quantity: number,
  buyerOnliId?: string,
): MatchResult {
  if (intent === 'transfer') {
    // Transfers don't go through matching — direct P2P vault movement
    return { fills: [], totalMatched: 0 };
  }

  if (intent === 'sell') {
    // Sell orders create listings, no matching against existing ones
    return { fills: [], totalMatched: 0 };
  }

  // Buy intent: market-first matching
  const fills: MatchFill[] = [];
  let remaining = quantity;

  // Sort listings by creation time (oldest first — FIFO)
  // Exclude buyer's own listings — you can't buy your own assets
  const activeListings = Array.from(state.listings.values())
    .filter((l) => l.status === 'active' && l.remainingQuantity > 0 && l.sellerOnliId !== buyerOnliId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const listing of activeListings) {
    if (remaining <= 0) break;

    const fillQty = Math.min(remaining, listing.remainingQuantity);
    matchCounter++;

    fills.push({
      matchId: `match-${String(matchCounter).padStart(3, '0')}`,
      counterparty: listing.sellerOnliId,
      listingId: listing.listingId,
      quantity: fillQty,
    });

    // Update listing
    listing.remainingQuantity -= fillQty;
    if (listing.remainingQuantity === 0) {
      listing.status = 'filled';
    }

    remaining -= fillQty;
  }

  // Treasury fallback for remainder
  if (remaining > 0) {
    matchCounter++;
    fills.push({
      matchId: `match-${String(matchCounter).padStart(3, '0')}`,
      counterparty: 'treasury',
      quantity: remaining,
    });
    remaining = 0;
  }

  return {
    fills,
    totalMatched: quantity - remaining,
  };
}
