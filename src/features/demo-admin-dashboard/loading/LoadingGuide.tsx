/**
 * LoadingGuide — visual fixture for all four loading-state views.
 *
 * Use this component during development to inspect skeletons, progress bars,
 * and status labels without running any real flows. All state is fake and
 * deterministic — safe for public repository review.
 *
 * Render in isolation (Storybook, a dev route, or a quick test page) by
 * mounting <LoadingGuide /> with no props.
 */

import { ImportLoadingView } from "./states";
import { ValidationLoadingView } from "./states";
import { PreviewLoadingView } from "./states";
import { PublishLoadingView } from "./states";

// ---------------------------------------------------------------------------
// Fake fixture states — deterministic, no live data
// ---------------------------------------------------------------------------

const IMPORT_FIXTURE = {
  status: "loading" as const,
  totalRecords: 40,
  processedRecords: 14,
};

const VALIDATION_FIXTURE = {
  status: "loading" as const,
  totalRecords: 40,
  passCount: 12,
  failCount: 2,
};

const PREVIEW_FIXTURE = {
  status: "loading" as const,
  section: "inbox" as const,
  progress: 60,
};

const PUBLISH_FIXTURE = {
  status: "loading" as const,
  progress: 30,
  label: "Writing demo records…",
  mockTxId: "mock-tx-0000dead0000beef",
};

// ---------------------------------------------------------------------------
// Guide component
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4 space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LoadingGuide() {
  return (
    <div className="max-w-xl mx-auto space-y-6 p-6">
      <h1 className="text-lg font-semibold">Demo Admin Dashboard — Loading States</h1>
      <p className="text-sm text-muted-foreground">
        Fixture preview of all four flow skeletons. No real data or network calls.
      </p>

      <Section title="Import">
        <ImportLoadingView state={IMPORT_FIXTURE} />
      </Section>

      <Section title="Validation">
        <ValidationLoadingView state={VALIDATION_FIXTURE} />
      </Section>

      <Section title="Preview">
        <PreviewLoadingView state={PREVIEW_FIXTURE} />
      </Section>

      <Section title="Publish (mock)">
        <PublishLoadingView state={PUBLISH_FIXTURE} />
      </Section>
    </div>
  );
}
