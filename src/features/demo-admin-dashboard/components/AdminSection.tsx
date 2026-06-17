// src/features/demo-admin-dashboard/components/AdminSection.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function AdminSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: AdminSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-xl bg-card">
      <button
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/50 transition-colors"
        disabled={!collapsible}
      >
        <h4 className="font-medium">{title}</h4>
        {collapsible && (
          isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {(!collapsible || isOpen) && (
        <div className="px-6 pb-6 border-t pt-4">{children}</div>
      )}
    </div>
  );
}
