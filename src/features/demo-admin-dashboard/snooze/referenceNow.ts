/**
 * Fixed demo clock.
 *
 * Snooze presets and previews are computed relative to this instant so the demo
 * data, fixtures, and tests stay deterministic regardless of the real date.
 * Parsed as local time (no trailing `Z`) so presets land at sensible local hours.
 */
export const DEMO_REFERENCE_NOW = "2026-06-16T09:00:00";

export function getDemoNow(): Date {
  return new Date(DEMO_REFERENCE_NOW);
}
