import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { toFederationAddress, toStealthAddress } from "../federation";
import { useUsernameAvailability } from "../useUsernameAvailability";

export interface ReservedUsername {
  username: string;
  ownerAddress: string;
  stealthAddress: string;
  federationAddress: string;
  createdAt: string;
}

type ReserveState =
  | { status: "idle" }
  | { status: "reserving" }
  | { status: "reserved"; record: ReservedUsername }
  | { status: "error"; message: string };

type Props = {
  /** Stellar G-address of the connected wallet; reservation is scoped to this actor. */
  walletAddress: string;
  onReserved?: (record: ReservedUsername) => void;
};

/**
 * Lets a visitor type a candidate handle, see live availability feedback,
 * and reserve `username@stealth.me` for their connected wallet.
 *
 * Talks to the real `GET/POST /api/v1/identity/usernames` endpoints — no
 * mock data path. Validation (length, charset, reserved words, confusables)
 * runs client-side first via the same rules the server enforces
 * (`src/features/identity/username.ts`), so the network round-trip only ever
 * happens for a candidate that could actually be reserved.
 */
export function UsernameReservationForm({ walletAddress, onReserved }: Props) {
  const [raw, setRaw] = useState("");
  const availability = useUsernameAvailability(raw);
  const [reserveState, setReserveState] = useState<ReserveState>({ status: "idle" });

  const canReserve = availability.status === "available" && reserveState.status !== "reserving";

  async function handleReserve() {
    if (availability.status !== "available") return;

    setReserveState({ status: "reserving" });
    try {
      const response = await fetch("/api/v1/identity/usernames", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stealth-address": walletAddress,
          "x-idempotency-key": `reserve-${availability.username}-${walletAddress}`,
        },
        body: JSON.stringify({ username: availability.username }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setReserveState({
          status: "error",
          message: body?.error?.message ?? `HTTP ${response.status}`,
        });
        return;
      }

      const record = body.data as ReservedUsername;
      setReserveState({ status: "reserved", record });
      onReserved?.(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reserve username";
      setReserveState({ status: "error", message });
    }
  }

  if (reserveState.status === "reserved") {
    const { record } = reserveState;
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 space-y-2"
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">Username reserved</p>
        </div>
        <p className="font-mono text-xs text-foreground break-all">
          {toStealthAddress(record.username)}
        </p>
        <p className="text-xs text-muted-foreground break-all">
          Federation address: {toFederationAddress(record.username)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="stealth-username" className="text-sm font-medium text-foreground">
        Choose your Stealth username
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id="stealth-username"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setReserveState({ status: "idle" });
            }}
            placeholder="alice"
            aria-describedby="stealth-username-status"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">@stealth.me</span>
      </div>

      <div id="stealth-username-status" aria-live="polite" className="min-h-[1.25rem] text-xs">
        {availability.status === "checking" && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Checking availability…
          </span>
        )}
        {availability.status === "invalid" && (
          <span className="text-amber-300">{availability.message}</span>
        )}
        {availability.status === "available" && (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {availability.username}@stealth.me is available
          </span>
        )}
        {availability.status === "taken" && (
          <span className="inline-flex items-center gap-1.5 text-red-300">
            <XCircle className="h-3 w-3" aria-hidden="true" />
            {availability.username}@stealth.me is already taken
          </span>
        )}
        {availability.status === "error" && (
          <span className="text-red-300">{availability.message}</span>
        )}
      </div>

      {reserveState.status === "error" && (
        <p role="alert" className="text-xs text-red-300">
          {reserveState.message}
        </p>
      )}

      <Button
        type="button"
        onClick={handleReserve}
        disabled={!canReserve}
        aria-busy={reserveState.status === "reserving"}
        className={cn("w-full")}
      >
        {reserveState.status === "reserving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reserving…
          </>
        ) : (
          "Reserve username"
        )}
      </Button>
    </div>
  );
}
