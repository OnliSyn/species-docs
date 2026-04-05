import type { SpeciesSimState, AskToMoveRequest } from '../state.js';

/**
 * Create an AskToMove request that pauses the pipeline.
 * Returns a promise that resolves to true (approved) or false (timeout/cancelled).
 */
export function createAskToMove(
  state: SpeciesSimState,
  eventId: string,
  onliId: string,
  quantity: number,
  timeoutSeconds: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const requestId = `atm-${eventId}`;
    const expiresAt = Date.now() + timeoutSeconds * 1000;

    const timeoutHandle = setTimeout(() => {
      const pending = state.pendingAskToMove.get(requestId);
      if (pending) {
        state.pendingAskToMove.delete(requestId);
        resolve(false);
      }
    }, timeoutSeconds * 1000);

    const request: AskToMoveRequest = {
      requestId,
      onliId,
      quantity,
      eventId,
      expiresAt,
      timeoutHandle,
      resolve,
    };

    state.pendingAskToMove.set(requestId, request);
  });
}

/**
 * Approve a pending AskToMove request. Resumes the pipeline.
 */
export function approveAskToMove(
  state: SpeciesSimState,
  eventId: string,
): { success: boolean; error?: string } {
  const requestId = `atm-${eventId}`;
  const pending = state.pendingAskToMove.get(requestId);

  if (!pending) {
    return { success: false, error: `No pending AskToMove for eventId ${eventId}` };
  }

  if (pending.timeoutHandle) {
    clearTimeout(pending.timeoutHandle);
  }

  state.pendingAskToMove.delete(requestId);

  if (pending.resolve) {
    pending.resolve(true);
  }

  return { success: true };
}

/**
 * Clean up all pending AskToMove requests (used on reset).
 */
export function clearAllAskToMove(state: SpeciesSimState): void {
  for (const [, pending] of state.pendingAskToMove) {
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    if (pending.resolve) {
      pending.resolve(false);
    }
  }
  state.pendingAskToMove.clear();
}
