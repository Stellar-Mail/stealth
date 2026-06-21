import { useCallback, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import type { DateRange, ResponseTimeService } from "../types";
import { useResponseTimes } from "../hooks/use-response-times";
import { DateRangePicker } from "./date-range-picker";
import { ResponseTimeMetrics } from "./response-time-metrics";
import { ResponseTimeList } from "./response-time-list";

function getDefaultDateRange(): DateRange {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    start: thirtyDaysAgo.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

interface ResponseTimeTrackerProps {
  service?: ResponseTimeService;
}

export function ResponseTimeTracker({ service }: ResponseTimeTrackerProps) {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const { entries, metrics, teamMembers, retry } = useResponseTimes(service);

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range);
      retry(range);
    },
    [retry],
  );

  const handleRefresh = useCallback(() => {
    retry(dateRange);
  }, [retry, dateRange]);

  return (
    <div className="mx-auto max-w-4xl" role="region" aria-label="Response Time Tracker">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-foreground">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Response Time Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Monitor team reply speed and SLA compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          <button
            onClick={handleRefresh}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border/30 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Refresh response time data"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <ResponseTimeMetrics state={metrics} />
      <ResponseTimeList state={entries} teamMembers={teamMembers} onRetry={() => handleRefresh()} />
    </div>
  );
}
