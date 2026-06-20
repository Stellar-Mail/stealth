import React from 'react';
import './LoadingState.css';

/**
 * Loading state component with a subtle animated spinner.
 * Uses only local CSS, no external design system.
 */
export const LoadingState: React.FC = () => (
  <section className="loading-state" aria-live="polite" aria-label="Loading">
    <div className="spinner" role="status" />
    <p className="loading-state__text">Loading workload data…</p>
  </section>
);
