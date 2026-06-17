// src/features/demo-admin-dashboard/fixtures.ts
export const demoUsers = [
  { id: 1, name: 'Alice Demo', email: 'alice@demo.stealth', role: 'Admin' },
  { id: 2, name: 'Bob Tester', email: 'bob@demo.stealth', role: 'Moderator' },
] as const;

export const demoStats = {
  totalUsers: 1248,
  activeNodes: 87,
  pendingApprovals: 12,
};
