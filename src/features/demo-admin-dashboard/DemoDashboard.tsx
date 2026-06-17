// src/features/demo-admin-dashboard/DemoDashboard.tsx
import React from "react";
import { DemoUser, DemoItem } from "./types";

// Simple mock data
const mockUsers: DemoUser[] = [
  { id: "1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "2", name: "Bob", email: "bob@example.com", role: "editor" },
];

const mockItems: DemoItem[] = [
  { id: "a", title: "Feature A", description: "Description of feature A" },
  { id: "b", title: "Feature B", description: "Description of feature B" },
];

export default function DemoDashboard() {
  return (
    <section style={{ padding: "1rem", background: "var(--bg)" }}>
      <h2>Demo Users</h2>
      <ul>
        {mockUsers.map((u) => (
          <li key={u.id}>
            {u.name} ({u.email}) – {u.role}
          </li>
        ))}
      </ul>
      <h2>Demo Items</h2>
      <ul>
        {mockItems.map((it) => (
          <li key={it.id}>
            <strong>{it.title}</strong>: {it.description}
          </li>
        ))}
      </ul>
    </section>
  );
}
