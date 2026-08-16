import { useEffect, useRef, useState } from "react";

import { validateUsernameCandidate } from "./username";

export type UsernameAvailabilityState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "checking" }
  | { status: "available"; username: string }
  | { status: "taken"; username: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 400;

/**
 * Live availability lookup for a candidate username, mirroring the shape of
 * {@link import("../compose/usePostageQuote").usePostageQuote}: debounced,
 * abort-on-change, and non-throwing (failures surface as `{ status: "error" }`
 * rather than an exception, so callers can show a non-blocking message).
 *
 * Client-side format/reserved-word validation runs first via
 * {@link validateUsernameCandidate} — the exact same rules the server
 * enforces — so obviously invalid input never triggers a network request.
 */
export function useUsernameAvailability(raw: string): UsernameAvailabilityState {
  const [state, setState] = useState<UsernameAvailabilityState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setState({ status: "idle" });
      return;
    }

    const validation = validateUsernameCandidate(trimmed);
    if (!validation.valid) {
      setState({ status: "invalid", message: validation.issues[0]?.message ?? "Invalid username" });
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ status: "checking" });

      try {
        const response = await fetch(
          `/api/v1/identity/usernames/${encodeURIComponent(validation.canonical)}/availability`,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setState({
            status: "error",
            message: body?.error?.message ?? `HTTP ${response.status}`,
          });
          return;
        }

        const body = (await response.json()) as {
          data: { username: string; available: boolean };
        };
        setState(
          body.data.available
            ? { status: "available", username: body.data.username }
            : { status: "taken", username: body.data.username },
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to check availability";
        setState({ status: "error", message });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [raw]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return state;
}
