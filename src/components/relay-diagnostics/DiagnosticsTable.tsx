import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DeliveryEntry {
  id: string;
  timestamp: string;
  recipientDomain: string;
  outcome: "delivered" | "retried" | "rejected" | "dead_letter";
  failureReason?: "network_timeout" | "policy_rejection" | "dns_failure" | null;
  retryCount: number;
}

const outcomeStyles: Record<DeliveryEntry["outcome"], string> = {
  delivered: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200",
  retried: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  dead_letter: "border-rose-500/30 bg-rose-500/10 text-rose-200 font-semibold",
};

const outcomeLabels: Record<DeliveryEntry["outcome"], string> = {
  delivered: "Delivered",
  retried: "Retried",
  rejected: "Rejected",
  dead_letter: "Dead letter",
};

function formatFailureReason(reason: DeliveryEntry["failureReason"]) {
  switch (reason) {
    case "network_timeout":
      return "Network timeout";
    case "policy_rejection":
      return "Recipient policy";
    case "dns_failure":
      return "DNS failure";
    default:
      return "—";
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toISOString();
}

export function DiagnosticsTable({ entries }: { entries: DeliveryEntry[] }) {
  return (
    <Card className="border-[#1e2430] bg-[#13161b] shadow-none">
      <CardHeader className="border-b border-[#1e2430] px-5 py-4">
        <CardTitle className="text-sm font-medium text-slate-200">Delivery diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[#1e2430] text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Timestamp</th>
                <th className="px-5 py-3 font-medium">Recipient domain</th>
                <th className="px-5 py-3 font-medium">Outcome</th>
                <th className="px-5 py-3 font-medium">Failure reason</th>
                <th className="px-5 py-3 font-medium">Retries</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No delivery records yet
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#1e2430]/60 last:border-0">
                    <td className="px-5 py-4 font-mono text-slate-200">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-5 py-4 text-slate-200">{entry.recipientDomain}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em]",
                          outcomeStyles[entry.outcome],
                        )}
                      >
                        {outcomeLabels[entry.outcome]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      {formatFailureReason(entry.failureReason ?? null)}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">{entry.retryCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
