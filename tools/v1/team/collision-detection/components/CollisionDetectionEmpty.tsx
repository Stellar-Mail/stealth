import type { JSX } from "react";

export function CollisionDetectionEmpty(): JSX.Element {
  return (
    <section
      aria-label="No collision scan performed"
      role="region"
      style={{
        border: "1px dashed #ccc",
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        color: "#666",
      }}
    >
      <p id="collision-empty-desc">
        Run a collision scan to check for duplicate responses across your team.
      </p>
    </section>
  );
}
