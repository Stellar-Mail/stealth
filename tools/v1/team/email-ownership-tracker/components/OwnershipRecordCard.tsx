interface OwnershipRecord {
  threadId: string;
  currentOwner: string | null;
  state: string;
  handoffCount: number;
  firstEvent: string;
  lastEvent: string;
}

interface OwnershipRecordCardProps {
  record: OwnershipRecord;
}

export function OwnershipRecordCard({ record }: OwnershipRecordCardProps) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Thread {record.threadId}</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Current owner:
            <span className="ml-1 font-medium text-foreground">
              {record.currentOwner ?? "Unassigned"}
            </span>
          </p>
        </div>

        <span className="rounded-md bg-muted px-3 py-1 text-sm font-medium text-foreground">
          {record.state}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Handoffs</dt>
          <dd className="font-medium text-foreground">{record.handoffCount}</dd>
        </div>

        <div>
          <dt className="text-muted-foreground">First Event</dt>
          <dd className="font-medium text-foreground">{record.firstEvent}</dd>
        </div>

        <div>
          <dt className="text-muted-foreground">Last Event</dt>
          <dd className="font-medium text-foreground">{record.lastEvent}</dd>
        </div>
      </dl>
    </article>
  );
}

export type { OwnershipRecordCardProps };
