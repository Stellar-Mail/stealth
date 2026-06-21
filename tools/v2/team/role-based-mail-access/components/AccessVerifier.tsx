import React, { useState } from "react";
import { VerifyAccessRequest } from "../types";
import { LIMITS } from "../guards/access-guards.mjs";

interface AccessVerifierProps {
  isVerifying: boolean;
  verificationResult: {
    status: "idle" | "granted" | "denied" | "invalid";
    message?: string;
    field?: string;
  };
  onVerify: (req: VerifyAccessRequest, simulateDelay: boolean) => Promise<unknown>;
}

export function AccessVerifier({ isVerifying, verificationResult, onVerify }: AccessVerifierProps) {
  const [email, setEmail] = useState("alice@example.test");
  const [threadId, setThreadId] = useState("thread-support-001");
  const [role, setRole] = useState("manager");
  const [accessLevel, setAccessLevel] = useState("assign");
  const [simulateDelay, setSimulateDelay] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(
      {
        requesterEmail: email,
        threadId,
        role,
        accessLevel,
      },
      simulateDelay,
    );
  };

  return (
    <div className="p-6 border border-zinc-800/80 rounded-2xl bg-zinc-900/20 backdrop-blur-md space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Verify Access Request
        </h3>
        <p className="text-xs text-zinc-500">
          Run input credentials and thread targets through the access validation guard pipeline.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Email input */}
          <div className="space-y-1">
            <label
              htmlFor="requesterEmail"
              className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
            >
              Requester Email Address
            </label>
            <input
              type="text"
              id="requesterEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-2.5 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none transition ${
                verificationResult.field === "email"
                  ? "border-rose-500/50 focus:border-rose-500"
                  : "border-zinc-800 focus:border-zinc-700"
              }`}
              placeholder="e.g., user@example.test"
              required
            />
            {verificationResult.field === "email" && (
              <p className="text-[10px] text-rose-400 font-medium font-mono">
                {verificationResult.message}
              </p>
            )}
          </div>

          {/* Thread ID Input */}
          <div className="space-y-1">
            <label
              htmlFor="threadId"
              className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
            >
              Target Thread ID
            </label>
            <input
              type="text"
              id="threadId"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className={`w-full p-2.5 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none transition ${
                verificationResult.field === "threadId"
                  ? "border-rose-500/50 focus:border-rose-500"
                  : "border-zinc-800 focus:border-zinc-700"
              }`}
              placeholder="e.g., thread-support-001"
              required
            />
            {verificationResult.field === "threadId" && (
              <p className="text-[10px] text-rose-400 font-medium font-mono">
                {verificationResult.message}
              </p>
            )}
          </div>

          {/* Role selector */}
          <div className="space-y-1">
            <label
              htmlFor="roleSelect"
              className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
            >
              Assigned Role
            </label>
            <select
              id="roleSelect"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={`w-full p-2.5 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none transition ${
                verificationResult.field === "role"
                  ? "border-rose-500/50 focus:border-rose-500"
                  : "border-zinc-800 focus:border-zinc-700"
              }`}
            >
              {LIMITS.ALLOWED_ROLES.map((r) => (
                <option key={r} value={r} className="bg-zinc-950 capitalize">
                  {r}
                </option>
              ))}
            </select>
            {verificationResult.field === "role" && (
              <p className="text-[10px] text-rose-400 font-medium font-mono">
                {verificationResult.message}
              </p>
            )}
          </div>

          {/* Access Level selector */}
          <div className="space-y-1">
            <label
              htmlFor="levelSelect"
              className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
            >
              Requested Access Level
            </label>
            <select
              id="levelSelect"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              className={`w-full p-2.5 bg-zinc-950 border rounded-lg text-xs text-zinc-200 focus:outline-none transition ${
                verificationResult.field === "accessLevel"
                  ? "border-rose-500/50 focus:border-rose-500"
                  : "border-zinc-800 focus:border-zinc-700"
              }`}
            >
              {LIMITS.ALLOWED_ACCESS_LEVELS.map((level) => (
                <option key={level} value={level} className="bg-zinc-950 capitalize">
                  {level}
                </option>
              ))}
            </select>
            {verificationResult.field === "accessLevel" && (
              <p className="text-[10px] text-rose-400 font-medium font-mono">
                {verificationResult.message}
              </p>
            )}
          </div>
        </div>

        {/* Loading simulation checkbox & Submit button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-zinc-850/60 mt-4">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={simulateDelay}
              onChange={(e) => setSimulateDelay(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-800 text-sky-600 bg-zinc-950 focus:ring-1 focus:ring-sky-500 transition cursor-pointer"
            />
            Simulate asynchronous verification (800ms delay)
          </label>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition shadow-lg shadow-sky-600/10 cursor-pointer"
          >
            {isVerifying ? "Verifying Access..." : "Execute Verification"}
          </button>
        </div>
      </form>

      {/* Result feedback panels */}
      {isVerifying && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center justify-center gap-3 text-xs text-zinc-400 animate-pulse"
        >
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          Evaluating credentials against security policies...
        </div>
      )}

      {!isVerifying && verificationResult.status !== "idle" && (
        <div
          role="alert"
          aria-live="assertive"
          className={`p-4 border rounded-xl text-xs font-semibold flex flex-col gap-1 transition-all ${
            verificationResult.status === "granted"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : verificationResult.status === "denied"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {verificationResult.status === "granted"
                ? "✓"
                : verificationResult.status === "denied"
                  ? "✕"
                  : "⚠"}
            </span>
            <span className="uppercase tracking-wider text-[10px]">
              {verificationResult.status === "granted"
                ? "Access Authorization Succeeded"
                : verificationResult.status === "denied"
                  ? "Access Authorization Denied"
                  : "Validation Guards Triggered"}
            </span>
          </div>
          {/* Don't show redundant duplicate warning text if field warning handles it */}
          {!verificationResult.field && (
            <p className="mt-1 font-medium">{verificationResult.message}</p>
          )}
          {verificationResult.field && (
            <p className="mt-1 font-medium">
              Requested field{" "}
              <span className="font-mono text-rose-300">"{verificationResult.field}"</span> failed
              boundary rules: {verificationResult.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default AccessVerifier;
