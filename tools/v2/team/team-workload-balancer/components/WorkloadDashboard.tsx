import React from 'react';
import { useWorkload } from '../hooks/useWorkload';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { WorkloadItem } from './WorkloadItem';
import './WorkloadDashboard.css';

/**
 * Main dashboard component for the Team Workload Balancer.
 * It handles loading, error, empty, and success states.
 * The UI is self‑contained and does not rely on the shared design system.
 */
export const WorkloadDashboard: React.FC = () => {
  const { data, isLoading, isError, isSuccess } = useWorkload();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Failed to load workload data." />;
  if (isSuccess && (!data || data.length === 0)) return <EmptyState />;

  return (
    <section className="dashboard" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="dashboard__title">
        Team Workload Dashboard
      </h2>
      <ul className="dashboard__list" role="list">
        {data!.map((item) => (
          <li key={item.id} role="listitem">
            <WorkloadItem item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
};
