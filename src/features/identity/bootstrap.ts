import { z } from "zod";

export const bootstrapBranchSchema = z.enum([
  "loading",
  "active",
  "onboarding",
  "suspended",
  "unauthorized",
  "outage",
  "maintenance",
]);

export type BootstrapBranch = z.infer<typeof bootstrapBranchSchema>;

export const bootstrapWalletSchema = z.object({
  connected: z.boolean(),
  address: z.string().nullable(),
  signerType: z.enum(["external", "managed"]),
  capabilities: z.array(z.string()),
  network: z.string(),
  balanceXlm: z.string(),
});

export const bootstrapPolicySchema = z.object({
  allowUnknown: z.boolean(),
  requireVerified: z.boolean(),
  requireReceipt: z.boolean(),
  minimumPostage: z.string(),
});

export const bootstrapProvisioningSchema = z.object({
  status: z.string(),
  currentStep: z.string().optional(),
  error: z.string().optional(),
});

export const bootstrapOnboardingSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
  step: z.string().nullable(),
  displayName: z.string(),
  recoveryAcknowledged: z.boolean(),
  unknownSenderRule: z.string(),
  minimumPostage: z.string(),
  receiptOnDelivery: z.boolean(),
  updatedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const bootstrapUserSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  accountStatus: z.string(),
  createdAt: z.string(),
});

export const bootstrapSessionSchema = z.object({
  sessionId: z.string(),
  expiresAt: z.string(),
});

export const bootstrapHealthSchema = z.object({
  ready: z.boolean(),
  status: z.enum(["ok", "degraded", "outage", "maintenance"]),
  dependencies: z.record(z.string(), z.string()),
});

export const bootstrapBetaControlsSchema = z.object({
  killSwitches: z.array(
    z.object({
      capability: z.string(),
      enabled: z.boolean(),
      source: z.string().optional(),
    }),
  ),
  featureFlags: z.record(z.string(), z.boolean()),
});

export const bootstrapDataSchema = z.object({
  user: bootstrapUserSchema,
  session: bootstrapSessionSchema,
  address: z.string().nullable(),
  provisioning: bootstrapProvisioningSchema.nullable(),
  onboarding: bootstrapOnboardingSchema.nullable().optional(),
  policy: bootstrapPolicySchema.nullable(),
  wallet: bootstrapWalletSchema,
  health: bootstrapHealthSchema,
  syncCursor: z.string(),
  featureFlags: z.record(z.string(), z.boolean()),
  betaControls: bootstrapBetaControlsSchema.optional(),
  branch: bootstrapBranchSchema,
});

export type BootstrapData = z.infer<typeof bootstrapDataSchema>;

export interface BootstrapError {
  code: "unauthorized" | "offline" | "timeout" | "rate_limited" | "server_error" | "network_error";
  message: string;
  retryable: boolean;
}

export interface BootstrapState {
  data: BootstrapData | null;
  branch: BootstrapBranch;
  isLoading: boolean;
  error: BootstrapError | null;
  timestamp: number | null;
}

let cachedState: BootstrapState | null = null;
let inFlightPromise: Promise<BootstrapState> | null = null;

const SYNC_CHANNEL_NAME = "stealth_bootstrap_sync";
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "BOOTSTRAP_UPDATED" && event.data?.state) {
        cachedState = event.data.state;
      } else if (event.data?.type === "BOOTSTRAP_CLEAR") {
        cachedState = null;
      }
    };
  } catch {
    broadcastChannel = null;
  }
}

export function getCachedBootstrap(): BootstrapState | null {
  return cachedState;
}

export function clearBootstrapCache(): void {
  cachedState = null;
  inFlightPromise = null;
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "BOOTSTRAP_CLEAR" });
    } catch (_err) {
      // Ignore broadcast channel post errors
    }
  }
}

function getDemoState(): BootstrapState {
  return {
    data: {
      user: {
        userId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        username: "demo_user",
        displayName: "Demo User",
        email: "demo@stealth.mail",
        accountStatus: "active",
        createdAt: new Date().toISOString(),
      },
      session: {
        sessionId: "sess_demo_default",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      provisioning: null,
      policy: {
        allowUnknown: true,
        requireVerified: false,
        requireReceipt: false,
        minimumPostage: "0",
      },
      wallet: {
        connected: true,
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        signerType: "managed",
        capabilities: ["sign", "send", "read"],
        network: "testnet",
        balanceXlm: "100.0000000",
      },
      health: {
        ready: true,
        status: "ok",
        dependencies: { bindings: "ok", storage: "ok", coordinator: "ok" },
      },
      syncCursor: `sync_${Date.now()}`,
      featureFlags: {
        betaStateMachines: true,
        sorobanPostage: true,
        liveMailboxSync: true,
      },
      betaControls: {
        killSwitches: [],
        featureFlags: {},
      },
      branch: "active",
    },
    branch: "active",
    isLoading: false,
    error: null,
    timestamp: Date.now(),
  };
}

/**
 * Returns true when the cached bootstrap session is expired or will expire
 * within the next 60 seconds, signalling that a re-fetch is needed even if
 * the TTL has not elapsed.
 */
function isSessionStale(data: BootstrapData | null): boolean {
  if (!data?.session?.expiresAt) return false;
  return Date.now() >= new Date(data.session.expiresAt).getTime() - 60_000;
}

export async function fetchBootstrap(options?: {
  bypassCache?: boolean;
  timeoutMs?: number;
}): Promise<BootstrapState> {
  const { bypassCache = false, timeoutMs = 10000 } = options ?? {};

  if (
    !bypassCache &&
    cachedState &&
    Date.now() - (cachedState.timestamp ?? 0) < 30000 &&
    !isSessionStale(cachedState.data)
  ) {
    return cachedState;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async (): Promise<BootstrapState> => {
    if (
      !import.meta.env.PROD &&
      typeof window !== "undefined" &&
      window.localStorage?.getItem("STEALTH_DEMO_BYPASS_FETCH") === "true"
    ) {
      const demo = getDemoState();
      cachedState = demo;
      return demo;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const errorState: BootstrapState = {
          data: null,
          branch: "outage",
          isLoading: false,
          error: {
            code: "offline",
            message: "You appear to be offline. Check your network connection.",
            retryable: true,
          },
          timestamp: Date.now(),
        };
        cachedState = errorState;
        return errorState;
      }

      const response = await fetch("/api/v1/bootstrap", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401) {
        const unauthState: BootstrapState = {
          data: null,
          branch: "unauthorized",
          isLoading: false,
          error: {
            code: "unauthorized",
            message: "Your session has expired. Please sign in again.",
            retryable: false,
          },
          timestamp: Date.now(),
        };
        cachedState = unauthState;
        return unauthState;
      }

      if (response.status === 429) {
        const rateLimitState: BootstrapState = {
          data: cachedState?.data ?? null,
          branch: "outage",
          isLoading: false,
          error: {
            code: "rate_limited",
            message: "Too many startup requests. Please wait a moment before retrying.",
            retryable: true,
          },
          timestamp: Date.now(),
        };
        return rateLimitState;
      }

      if (!response.ok) {
        const serverErrorState: BootstrapState = {
          data: null,
          branch: "outage",
          isLoading: false,
          error: {
            code: "server_error",
            message: `Server returned error (${response.status}). Please try again.`,
            retryable: true,
          },
          timestamp: Date.now(),
        };
        cachedState = serverErrorState;
        return serverErrorState;
      }

      const payload = (await response.json()) as { data?: BootstrapData };
      if (!payload.data) {
        throw new Error("Invalid bootstrap payload response");
      }

      const parsed = bootstrapDataSchema.parse(payload.data);

      const successState: BootstrapState = {
        data: parsed,
        branch: parsed.branch,
        isLoading: false,
        error: null,
        timestamp: Date.now(),
      };

      cachedState = successState;
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: "BOOTSTRAP_UPDATED", state: successState });
        } catch (_err) {
          // Ignore broadcast channel post errors
        }
      }
      return successState;
    } catch (cause) {
      clearTimeout(timer);
      const isAbort =
        (cause instanceof Error && cause.name === "AbortError") ||
        (cause !== null &&
          typeof cause === "object" &&
          "name" in cause &&
          cause.name === "AbortError");
      const errorState: BootstrapState = {
        data: null,
        branch: isAbort ? "outage" : "outage",
        isLoading: false,
        error: {
          code: isAbort ? "timeout" : "network_error",
          message: isAbort
            ? "Startup connection timed out. Please retry."
            : cause instanceof Error
              ? cause.message
              : "Failed to connect to bootstrap service.",
          retryable: true,
        },
        timestamp: Date.now(),
      };
      cachedState = errorState;
      return errorState;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}
