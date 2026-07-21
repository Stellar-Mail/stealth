import type { JSX } from "react";

export function EmailToneRewriterLoading(): JSX.Element {
  return (
    <section className="etr-card" aria-label="Rewriting email tone" aria-busy="true" role="status">
      <h2>Rewriting your draft…</h2>
      <p>Keeping factual details in place while preparing a reviewable version.</p>
    </section>
  );
}
