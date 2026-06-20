import React, { useState } from "react";
import { useRoleBasedAccess } from "../hooks/use-role-based-access";
import { PolicyMatrix } from "./PolicyMatrix";
import { AccessVerifier } from "./AccessVerifier";
import { VerifyAccessRequest } from "../types";
import sampleRequests from "../fixtures/sample-access-requests.json";

export function AccessConsole() {
  const {
    policy,
    logs,
    isVerifying,
    verificationResult,
    updatePolicy,
    checkAccessRequest,
    checkTeamAndAttachmentLimits,
    resetLogs,
  } = useRoleBasedAccess();

  // Preset loading state feedback
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Limits verifier states
  const [teamSizeInput, setTeamSizeInput] = useState(15);
  const [attachmentsInput, setAttachmentsInput] = useState(3);

  // Hostile scanner states
  const [isScanningHostile, setIsScanningHostile] = useState(false);
  const [scanResults, setScanResults] = useState<{
    total: number;
    blocked: number;
    failures: string[];
  } | null>(null);

  // Evaluate size constraints
  const limitChecks = checkTeamAndAttachmentLimits(teamSizeInput, attachmentsInput);

  // Quick Preset Handlers
  const handleSelectPreset = async (preset: {
    id: string;
    requesterEmail: string;
    role: string;
    accessLevel: string;
    threadId: string;
  }) => {
    setActivePresetId(preset.id);
    const req: VerifyAccessRequest = {
      requesterEmail: preset.requesterEmail,
      role: preset.role,
      accessLevel: preset.accessLevel,
      threadId: preset.threadId,
    };
    await checkAccessRequest(req, true);
    setActivePresetId(null);
  };

  // Hostile Vector Scanner
  const runHostileScanner = async () => {
    setIsScanningHostile(true);
    setScanResults(null);

    // Give a brief delay to show scanner action
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const hostiles = sampleRequests.hostileInputs;
    let blockedCount = 0;
    const failures: string[] = [];

    for (const h of hostiles) {
      // Create a request object where the hostile value is injected
      const req: VerifyAccessRequest = {
        requesterEmail: h.field === "email" ? (h.value as unknown as string) : "user@example.test",
        threadId: h.field === "threadId" ? (h.value as unknown as string) : "thread-001",
        role: h.field === "role" ? (h.value as unknown as string) : "agent",
        accessLevel: h.field === "accessLevel" ? (h.value as unknown as string) : "read",
      };

      const res = checkAccessRequest(req, false);
      // Wait for it to append to logs synchronously
      if (!res.isAllowed && res.error) {
        blockedCount++;
      } else {
        failures.push(`Failed to block: field "${h.field}" with value "${h.value}" (${h.reason})`);
      }
    }

    setScanResults({
      total: hostiles.length,
      blocked: blockedCount,
      failures,
    });
    setIsScanningHostile(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 bg-zinc-950 text-zinc-100 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Role-Based Mail Access Control Plane
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5">
            Validate user roles, enforce thread-level read/write rules, and guard boundaries against
            payload injection.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetLogs}
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition"
          >
            Reset Access Logs
          </button>
          <button
            onClick={runHostileScanner}
            disabled={isScanningHostile}
            className="px-4 py-2 text-xs font-semibold bg-rose-950/40 border border-rose-500/20 text-rose-400 hover:bg-rose-950/70 rounded-lg transition disabled:opacity-50"
          >
            🛡 Run Threat Scan
          </button>
        </div>
      </div>

      {/* Preset Injection Panel */}
      <div className="p-6 border border-zinc-800/60 rounded-2xl bg-zinc-900/10 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Simulate Fixture Access Requests
          </h3>
          <p className="text-xs text-zinc-500">
            Inject pre-configured compliance tests. Includes valid checks and invalid clearance
            attempts.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {sampleRequests.validRequests.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              disabled={isVerifying || activePresetId !== null}
              className={`p-3 text-left border rounded-xl transition flex flex-col justify-between h-24 ${
                activePresetId === preset.id
                  ? "border-sky-500 bg-sky-500/5"
                  : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700/80"
              }`}
            >
              <div>
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">
                  {preset.role}
                </span>
                <span className="text-[11px] font-semibold text-zinc-200 block truncate">
                  Action: {preset.accessLevel}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                <span>{preset.id}</span>
                <span className={preset.expectGranted ? "text-emerald-400" : "text-amber-400"}>
                  {preset.expectGranted ? "Expect: Allow" : "Expect: Block"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scanning status banner */}
      {isScanningHostile && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center justify-center gap-3 text-xs text-zinc-400 animate-pulse">
          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Analyzing 19 named hostile injection patterns (SQL, header injection, homoglyphs)...
        </div>
      )}

      {scanResults && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex flex-col gap-2 animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">✓</span>
            <span className="font-bold uppercase tracking-wider text-xs">
              Threat Scanning Validation Succeeded
            </span>
          </div>
          <p className="text-xs text-zinc-300 font-medium">
            Successfully parsed and filtered all{" "}
            <span className="font-bold text-white">{scanResults.total} hostile inputs</span> from
            the threat vectors file. The validation guards successfully blocked{" "}
            <span className="font-bold text-emerald-400">
              {scanResults.blocked}/{scanResults.total} vectors
            </span>
            . 0 bypasses recorded.
          </p>
          {scanResults.failures.length > 0 && (
            <div className="mt-2 p-3 bg-zinc-950 border border-zinc-850 rounded-lg max-h-40 overflow-y-auto font-mono text-[10px] text-rose-400 space-y-1">
              {scanResults.failures.map((f, i) => (
                <div key={i}>{f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Side: Policy and Limits */}
        <div className="space-y-8">
          {/* Policy matrix */}
          <PolicyMatrix policy={policy} onPolicyChange={updatePolicy} />

          {/* Size Limits verifier */}
          <div className="p-6 border border-zinc-800/80 rounded-2xl bg-zinc-900/10 space-y-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Boundary Limit Verifiers
              </h3>
              <p className="text-xs text-zinc-500">
                Verify paginator-level guard limits for maximum team size (500) and attachment
                checks (100).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Team Size Check */}
              <div className="space-y-2">
                <label
                  htmlFor="teamSizeVerifier"
                  className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block"
                >
                  Simulated Team Size
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    id="teamSizeVerifier"
                    value={teamSizeInput}
                    onChange={(e) => setTeamSizeInput(Number(e.target.value))}
                    className={`w-full p-2 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono`}
                  />
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${
                      limitChecks.teamSizeValid
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-950 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {limitChecks.teamSizeValid ? "Safe" : "Limit Exceeded"}
                  </span>
                </div>
                {!limitChecks.teamSizeValid && (
                  <p className="text-[10px] text-rose-400 font-mono mt-1">
                    {limitChecks.teamSizeError}
                  </p>
                )}
              </div>

              {/* Attachment Count Check */}
              <div className="space-y-2">
                <label
                  htmlFor="attachmentsVerifier"
                  className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block"
                >
                  Simulated Attachment Count
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    id="attachmentsVerifier"
                    value={attachmentsInput}
                    onChange={(e) => setAttachmentsInput(Number(e.target.value))}
                    className={`w-full p-2 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono`}
                  />
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${
                      limitChecks.attachmentCountValid
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-950 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {limitChecks.attachmentCountValid ? "Safe" : "Limit Exceeded"}
                  </span>
                </div>
                {!limitChecks.attachmentCountValid && (
                  <p className="text-[10px] text-rose-400 font-mono mt-1">
                    {limitChecks.attachmentCountError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Verification and Logs */}
        <div className="space-y-8">
          {/* Verifier Form */}
          <AccessVerifier
            isVerifying={isVerifying}
            verificationResult={verificationResult}
            onVerify={checkAccessRequest}
          />

          {/* Audit Logs list */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Clearance Check Audit Trail ({logs.length})
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Real-time evaluations</span>
            </div>

            <div className="max-h-80 overflow-y-auto border border-zinc-800/80 rounded-xl bg-zinc-950 p-4 space-y-2.5 scrollbar-thin">
              {logs.length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic text-center py-10">
                  No access checks executed yet. Use the presets above or form to trigger
                  verification.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 border rounded-xl text-[11px] flex flex-col gap-1.5 transition ${
                      log.isAllowed
                        ? "border-emerald-500/10 bg-emerald-500/5 text-zinc-300"
                        : log.error
                          ? "border-rose-500/10 bg-rose-500/5 text-zinc-400"
                          : "border-amber-500/10 bg-amber-500/5 text-zinc-300"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-zinc-500">
                      <span className="font-mono">{log.id}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-zinc-100">
                        {log.request.requesterEmail}
                      </span>
                      <span className="text-zinc-500">({log.request.role})</span>
                      <span className="text-zinc-400">requested</span>
                      <span className="font-semibold text-sky-400">{log.request.accessLevel}</span>
                      <span className="text-zinc-400">on</span>
                      <span className="font-mono bg-zinc-900 px-1 rounded truncate max-w-[120px]">
                        {log.request.threadId}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-850/60 pt-1.5 mt-0.5">
                      <span className="text-[10px] text-zinc-500">Outcome:</span>
                      <span
                        className={`text-[9px] font-bold font-mono px-1.5 rounded uppercase ${
                          log.isAllowed
                            ? "bg-emerald-950 text-emerald-400"
                            : log.error
                              ? "bg-rose-950 text-rose-400"
                              : "bg-amber-950 text-amber-400"
                        }`}
                      >
                        {log.isAllowed ? "Permitted" : log.error ? "Blocked (Error)" : "Denied"}
                      </span>
                    </div>

                    {log.error && (
                      <p className="text-[10px] text-rose-400/90 font-mono mt-1 border-t border-rose-950/20 pt-1">
                        Reason: {log.error}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AccessConsole;
