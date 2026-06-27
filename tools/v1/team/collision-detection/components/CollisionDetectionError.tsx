import type { JSX } from "react";

export interface CollisionDetectionErrorProps {
  code: string;
  message: string;
  onRetry?: () => void;
}

export function CollisionDetectionError({
  code,
  message,
  onRetry,
}: CollisionDetectionErrorProps): JSX.Element {
  return (
    <section
      aria-label="Collision scan error"
      role="alert"
      style={{
        border: "1px solid #e74c3c",
        borderRadius: 8,
        padding: "1.5rem",
        backgroundColor: "#fdf0ef",
      }}
    >
      <p style={{ color: "#c0392b", fontWeight: 600, marginTop: 0 }}>
        Unable to complete collision scan
      </p>
      <p style={{ color: "#555", margin: "0.5rem 0" }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry collision scan"
          style={{
            padding: "0.4rem 1rem",
            border: "1px solid #c0392b",
            borderRadius: 4,
            backgroundColor: "#fff",
            color: "#c0392b",
            cursor: "pointer",
          }}
        >
          Retry Scan
        </button>
      )}
    </section>
  );
}
