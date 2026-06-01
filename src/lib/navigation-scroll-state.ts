/** Set on popstate / history traverse before the route updates. */
let pendingHistoryTraversal = false;

export function markPendingHistoryTraversal() {
  pendingHistoryTraversal = true;
}

export function consumePendingHistoryTraversal(): boolean {
  if (!pendingHistoryTraversal) return false;
  pendingHistoryTraversal = false;
  return true;
}
