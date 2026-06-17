// src/features/demo-admin-dashboard/components/AdminToolbar.tsx
export function AdminToolbar({ children, actions }: AdminToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4">{children}</div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
