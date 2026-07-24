import { useState, useCallback, useMemo } from "react";
import { createAccessService } from "../services/access.service";
import { VerifyAccessRequest, AccessCheckLog, AccessPolicy } from "../types";

export function useRoleBasedAccess() {
  const [service] = useState(() => createAccessService());
  const [policy, setPolicy] = useState<AccessPolicy>(() => service.getPolicy());
  const [logs, setLogs] = useState<AccessCheckLog[]>(() => service.getLogs());

  // Loading, success, error simulator states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: "idle" | "granted" | "denied" | "invalid";
    message?: string;
    field?: string;
  }>({ status: "idle" });

  const syncState = useCallback(() => {
    setPolicy({ ...service.getPolicy() });
    setLogs([...service.getLogs()]);
  }, [service]);

  const updatePolicy = useCallback(
    (role: string, accessLevels: string[]) => {
      service.updatePolicy(role, accessLevels);
      syncState();
    },
    [service, syncState],
  );

  const checkAccessRequest = useCallback(
    async (req: VerifyAccessRequest, simulateDelay = false) => {
      setIsVerifying(true);
      setVerificationResult({ status: "idle" });

      if (simulateDelay) {
        // Mock checking network/latency check
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const res = service.checkRequest(req);
      syncState();
      setIsVerifying(false);

      if (res.isAllowed) {
        setVerificationResult({
          status: "granted",
          message: `Access GRANTED: Requester holding "${req.role}" role has permission to execute "${req.accessLevel}" on thread "${req.threadId}".`,
        });
      } else if (res.error) {
        setVerificationResult({
          status: "invalid",
          message: `Validation Error: ${res.error}`,
          field: res.field,
        });
      } else {
        setVerificationResult({
          status: "denied",
          message: `Access DENIED: Requester holding "${req.role}" role does NOT have permission to execute "${req.accessLevel}" on thread "${req.threadId}".`,
        });
      }

      return res;
    },
    [service, syncState],
  );

  const checkTeamAndAttachmentLimits = useCallback(
    (teamSize: number, attachmentCount: number) => {
      return service.checkLimits(teamSize, attachmentCount);
    },
    [service],
  );

  const resetLogs = useCallback(() => {
    service.clearLogs();
    setLogs([]);
    setVerificationResult({ status: "idle" });
  }, [service]);

  return {
    policy,
    logs,
    isVerifying,
    verificationResult,
    updatePolicy,
    checkAccessRequest,
    checkTeamAndAttachmentLimits,
    resetLogs,
  };
}
export default useRoleBasedAccess;
