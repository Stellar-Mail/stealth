import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatusCardProps {
  label: string;
  value: string;
  unit?: string;
  status: "healthy" | "degraded" | "failing" | "empty";
}

const barStyles: Record<StatusCardProps["status"], string> = {
  healthy: "bg-indigo-500 motion-safe:animate-[pulse_3.5s_ease-in-out_infinite]",
  degraded: "bg-amber-500 motion-safe:animate-[pulse_4.5s_ease-in-out_infinite]",
  failing: "bg-rose-500 motion-safe:animate-[pulse_1.5s_ease-in-out_infinite]",
  empty: "bg-slate-600",
};

export function StatusCard({ label, value, unit, status }: StatusCardProps) {
  return (
    <Card className={cn("border-[#1e2430] bg-[#13161b] shadow-none", "overflow-hidden rounded-xl")}>
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
          <div className="flex min-w-0 items-baseline gap-2 text-2xl font-semibold leading-none text-slate-100">
            <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
            {unit ? (
              <span className="ml-2 align-baseline text-sm font-normal text-slate-500">{unit}</span>
            ) : null}
            <span className="sr-only">Status: {status}</span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "mt-auto h-1 rounded-full",
            barStyles[status],
            "motion-reduce:animate-none",
            status === "empty" ? "opacity-60" : "opacity-90",
          )}
        />
      </div>
    </Card>
  );
}
