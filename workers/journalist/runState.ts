/**
 * Per-run carrier shared between the Source and the Sink. The public ports can't
 * pass the run's chosen entities from discovery through to persistence, so the
 * Source records the union of the signal's entities here and the Sink reads them
 * to populate `posts.entities` (the anti-repetition feed). Reset at the start of
 * each run so a long-lived worker process never leaks entities across runs.
 */
export interface RunState {
  /** All entities seen in the current run's discovery signal (agencies + occupations). */
  signalEntities: string[];
}

const state: RunState = { signalEntities: [] };

export function resetRunState(): void {
  state.signalEntities = [];
}

export function recordSignalEntities(entities: string[]): void {
  state.signalEntities = [...new Set([...state.signalEntities, ...entities])];
}

export function getSignalEntities(): string[] {
  return [...state.signalEntities];
}
