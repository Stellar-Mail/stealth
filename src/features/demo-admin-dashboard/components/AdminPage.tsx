// src/features/demo-admin-dashboard/components/AdminPage.tsx
import { AdminToolbar } from './AdminToolbar';

export function AdminPage({ title, children, toolbar }: AdminDashboardProps) {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1">
              Demo Admin Dashboard — Isolated from production flows
            </p>
          </div>
          {toolbar && <AdminToolbar>{toolbar}</AdminToolbar>}
        </div>

        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}
