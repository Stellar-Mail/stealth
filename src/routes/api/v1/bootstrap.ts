import { createFileRoute } from "@tanstack/react-router";

import { parseSessionCookie } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { toPublicSession, toPublicUser } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { checkApiReadiness } from "@/server/api/health";
import { getOnboardingDraft } from "@/server/api/onboarding-service";
import { getMailboxPolicy } from "@/server/api/policy-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { resolveActiveSigner } from "@/server/api/wallet-link-service";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";
import { BETA_CAPABILITIES } from "@/server/api/beta-controls/types";

export const Route = createFileRoute("/api/v1/bootstrap")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          await initBetaControlService();
          const sessionId = parseSessionCookie(request.headers.get("cookie"));

          if (!sessionId) {
            throw new ApiError(401, "unauthorized", "No active session cookie found");
          }

          const sessionRecord = await apiContext.repository.getSession(sessionId);
          if (!sessionRecord) {
            throw new ApiError(401, "unauthorized", "Session is invalid or expired");
          }

          const userRecord = await apiContext.repository.getUserById(sessionRecord.userId);
          if (!userRecord) {
            throw new ApiError(401, "unauthorized", "Associated user account not found");
          }

          const owner = userRecord.userId;

          const [policyResult, signerResult, provisioningRecord, onboardingDraft, readiness] =
            await Promise.all([
              getMailboxPolicy(apiContext.repository, owner).catch(() => null),
              resolveActiveSigner(apiContext.repository, owner).catch(() => null),
              apiContext.repository.getProvisioningRecord?.(owner).catch(() => null),
              getOnboardingDraft(apiContext.repository, owner).catch(() => null),
              checkApiReadiness({ getContext: async () => apiContext, timeoutMs: 50 }).catch(
                () => ({
                  ready: false,
                  dependencies: {
                    bindings: "unavailable",
                    storage: "unavailable",
                    coordinator: "unavailable",
                  },
                  timeoutMs: 50,
                }),
              ),
            ]);

          const user = {
            ...toPublicUser(userRecord),
            accountStatus: userRecord.status,
            displayName: userRecord.username,
          };
          const session = toPublicSession(sessionRecord);

          type BootstrapBranch =
            | "active"
            | "onboarding"
            | "suspended"
            | "unauthorized"
            | "outage"
            | "maintenance";
          let branch: BootstrapBranch = "active";

          if (!readiness.ready) {
            branch = "outage";
          } else if (user.status === "suspended" || user.status === "deactivated") {
            branch = "suspended";
          } else if (user.status === "pending_verification") {
            branch = "onboarding";
          } else {
            branch = "active";
          }

          const syncCursor = `sync_${Date.now()}`;

          return apiSuccess(request, {
            user,
            session,
            address: user.userId,
            provisioning: provisioningRecord
              ? {
                  status: provisioningRecord.status,
                  currentStep: provisioningRecord.currentStep,
                  error: (provisioningRecord as any).failure?.message ?? undefined,
                }
              : null,
            onboarding: onboardingDraft
              ? {
                  status: onboardingDraft.status,
                  step: onboardingDraft.step,
                  displayName: onboardingDraft.displayName,
                  recoveryAcknowledged: onboardingDraft.recoveryAcknowledged,
                  unknownSenderRule: onboardingDraft.unknownSenderRule,
                  minimumPostage: onboardingDraft.minimumPostage,
                  receiptOnDelivery: onboardingDraft.receiptOnDelivery,
                  updatedAt: onboardingDraft.updatedAt,
                  completedAt: onboardingDraft.completedAt,
                }
              : {
                  status: "not_started",
                  step: null,
                  displayName: "",
                  recoveryAcknowledged: false,
                  unknownSenderRule: "",
                  minimumPostage: "",
                  receiptOnDelivery: false,
                  updatedAt: null,
                  completedAt: null,
                },
            policy: policyResult
              ? {
                  allowUnknown: policyResult.policy.allowUnknown,
                  requireVerified: policyResult.policy.requireVerified,
                  requireReceipt: false,
                  minimumPostage: policyResult.policy.minimumPostage,
                }
              : null,
            wallet: {
              connected: signerResult !== null,
              address: signerResult?.address ?? user.userId,
              signerType: signerResult?.signerType ?? "managed",
              capabilities: signerResult?.capabilities ?? ["sign", "send", "read"],
              network: "testnet",
              balanceXlm: "100.0000000",
            },
            health: {
              ready: readiness.ready,
              status: readiness.ready ? "ok" : "outage",
              dependencies: readiness.dependencies,
            },
            syncCursor,
            featureFlags: {
              betaStateMachines: true,
              sorobanPostage: true,
              liveMailboxSync: true,
            },
            betaControls: {
              killSwitches: await Promise.all(
                BETA_CAPABILITIES.map(async (capability) => {
                  const evaluation = await getBetaControlService().evaluateKillSwitch(capability);
                  return { capability, enabled: evaluation.enabled, source: evaluation.source };
                }),
              ),
              featureFlags: await (async () => {
                const betaService = getBetaControlService();
                const flags = await betaService.listFlags();
                const evaluated: Record<string, boolean> = {};
                for (const flag of flags) {
                  const evaluation = await betaService.isFeatureEnabled(flag.key, {
                    account: owner,
                  });
                  evaluated[flag.key] = evaluation.enabled;
                }
                return evaluated;
              })(),
            },
            branch,
          });
        }),
    },
  },
});
