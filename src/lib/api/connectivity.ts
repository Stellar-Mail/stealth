// ---------------------------------------------------------------------------
// BETA-071 (Issue #1978) — connectivity + visibility helpers for safe sync.
// ---------------------------------------------------------------------------

export interface ConnectivitySnapshot {
  online: boolean;
  visible: boolean;
}

export function readNavigatorOnline(nav?: { onLine?: boolean } | null): boolean {
  if (!nav || typeof nav.onLine !== "boolean") return true;
  return nav.onLine;
}

export function readDocumentVisible(doc?: { visibilityState?: string } | null): boolean {
  if (!doc || typeof doc.visibilityState !== "string") return true;
  return doc.visibilityState !== "hidden";
}

export function shouldPauseSync(online: boolean, visible: boolean): boolean {
  return !online || !visible;
}

/** Resume queries after a paused interval. Never used to replay mutations. */
export function shouldResumeSync(wasPaused: boolean, isPaused: boolean): boolean {
  return wasPaused && !isPaused;
}

export function connectivitySnapshot(
  nav?: { onLine?: boolean } | null,
  doc?: { visibilityState?: string } | null,
): ConnectivitySnapshot {
  return {
    online: readNavigatorOnline(nav),
    visible: readDocumentVisible(doc),
  };
}
