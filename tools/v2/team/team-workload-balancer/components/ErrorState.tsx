import React from 'react';
import './ErrorState.css';

/**
 * Error state component displayed when data fails to load.
 * Provides a retry button that focuses automatically for keyboard users.
 */
export const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <section className="error-state" aria-live="assertive" role="alert">
    <p className="error-state__message">{message}</p>
    <button className="error-state__retry" onClick={() => window.location.reload()}>Retry</button>
  </section>
);
