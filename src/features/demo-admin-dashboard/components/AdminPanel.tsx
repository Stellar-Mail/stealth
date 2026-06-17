// src/features/demo-admin-dashboard/components/AdminPanel.tsx
export function AdminPanel({
  title,
  description,
  children,
  className = '',
  footer,
}: AdminPanelProps) {
  return (
    <div className={`border bg-card rounded-xl shadow-sm overflow-hidden ${className}`}>
      {(title || description) && (
        <div className="border-b px-6 py-4">
          {title && <h3 className="text-xl font-medium">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}

      <div className="p-6">{children}</div>

      {footer && (
        <div className="border-t px-6 py-4 bg-muted/50">{footer}</div>
      )}
    </div>
  );
}
