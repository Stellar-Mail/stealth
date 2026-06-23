import React from 'react';
import './EmptyState.css';

/**
 * Empty state component shown when there are no workload items.
 * Includes a focusable button to add a new item (placeholder action).
 */
export const EmptyState: React.FC = () => (
  <section className="empty-state" aria-live="polite" role="region">
    <p className="empty-state__text">No workload items to display.</p>
    <button className="empty-state__action" onClick={() => alert('Add new item placeholder')}>Add Item</button>
  </section>
);
