import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  UserMinus,
  UserCheck,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersControl,
});

interface UserRecord {
  userId: string;
  address: string;
  email: string;
  username: string;
  status: "active" | "suspended" | "pending";
  createdAt: string;
  updatedAt: string;
}

function AdminUsersControl() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mutation states
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationAction, setMutationAction] = useState<
    "suspend" | "reactivate" | "provision" | null
  >(null);

  const adminAddress = "GADMIN777777777777777777777777777777777777777777777777777777";

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setUser(null);

      const res = await fetch(
        `/api/v1/admin/users/lookup?identifier=${encodeURIComponent(identifier.trim())}`,
        {
          headers: { "x-stealth-address": adminAddress },
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "User lookup failed");

      setUser(json.data.user);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMutation = async (action: "suspend" | "reactivate" | "provision") => {
    if (!user) return;
    if (!reason.trim()) {
      alert("A mutation reason must be provided.");
      return;
    }

    try {
      setMutating(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      let url = "";
      if (action === "suspend") url = `/api/v1/admin/users/${user.userId}/suspend`;
      if (action === "reactivate") url = `/api/v1/admin/users/${user.userId}/reactivate`;
      if (action === "provision") url = `/api/v1/admin/users/${user.userId}/provision/retry`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-stealth-address": adminAddress,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || `Failed to ${action} user`);

      setSuccessMsg(
        `User action "${action}" completed successfully. Support ID: ${json.data.supportId || "N/A"}`,
      );
      setReason("");
      setMutationAction(null);

      // Reload lookup
      const reloadRes = await fetch(
        `/api/v1/admin/users/lookup?identifier=${encodeURIComponent(user.userId)}`,
        {
          headers: { "x-stealth-address": adminAddress },
        },
      );
      if (reloadRes.ok) {
        const reloadJson = await reloadRes.json();
        setUser(reloadJson.data.user);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User lookup & Operations</h2>
        <p className="text-neutral-400 text-sm">
          Query users by exact email, address, or ID and enforce safety controls.
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lookup Bar */}
      <form onSubmit={handleLookup} className="flex gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by exact ID, email, Stellar address, or username..."
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-purple-500 transition-all"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? "Searching..." : "Lookup"}
        </button>
      </form>

      {/* User Info View */}
      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Details Box */}
          <div className="lg:col-span-2 border border-neutral-800 bg-neutral-900/10 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-neutral-100">@{user.username}</h3>
                <span className="font-mono text-xs text-neutral-500 select-all">{user.userId}</span>
              </div>
              <div>
                {user.status === "active" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                ) : user.status === "suspended" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                    Suspended
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Pending
                  </span>
                )}
              </div>
            </div>

            <hr className="border-neutral-800" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <div className="text-neutral-500 mb-1">Stellar Address</div>
                <div className="text-neutral-300 break-all select-all">{user.address}</div>
              </div>
              <div>
                <div className="text-neutral-500 mb-1">Email (Masked)</div>
                <div className="text-neutral-300">{user.email}</div>
              </div>
              <div>
                <div className="text-neutral-500 mb-1">Registered At</div>
                <div className="text-neutral-300">{new Date(user.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-neutral-500 mb-1">Last Updated</div>
                <div className="text-neutral-300">{new Date(user.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Action Operations Console */}
          <div className="border border-neutral-800 bg-neutral-900/10 rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-md flex items-center gap-2">
              <ShieldAlert className="size-4 text-purple-400" />
              <span>Operations Console</span>
            </h3>

            {mutationAction ? (
              <div className="space-y-4">
                <div className="text-xs font-medium text-neutral-300 capitalize">
                  Action: {mutationAction} Account
                </div>
                <textarea
                  placeholder="Provide audit reason (mandatory)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
                  rows={4}
                  required
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMutation(mutationAction)}
                    disabled={mutating}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {mutating ? "Processing..." : "Confirm Action"}
                  </button>
                  <button
                    onClick={() => {
                      setMutationAction(null);
                      setReason("");
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {user.status === "active" ? (
                  <button
                    onClick={() => setMutationAction("suspend")}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserMinus className="size-4" />
                    <span>Suspend Account</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setMutationAction("reactivate")}
                    className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserCheck className="size-4" />
                    <span>Reactivate Account</span>
                  </button>
                )}

                <button
                  onClick={() => setMutationAction("provision")}
                  className="w-full py-2.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCcw className="size-4" />
                  <span>Retry Provisioning</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
