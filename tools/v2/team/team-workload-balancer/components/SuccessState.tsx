import React from 'react';
import './SuccessState.css';

/**
 * Success state component (optional – can be used for actions after successful operations).
 */
export const SuccessState: React.FC<{ message: string }> = ({ message }) => (
  <section className="success-state" aria-live="polite" role="status">
    <p className="success-state__message">{message}</p>
  </section>
);
