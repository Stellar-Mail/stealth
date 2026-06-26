import React from "react";
import { useTheme } from "../contexts/ThemeContext";

interface RoleSwitcherProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
}

/**
 * RoleSwitcher component allows switching between user roles.
 * Refactored to use semantic design tokens:
 * - Uses `bg-surface-card` instead of inline hex `bg-[#1a1612]`
 * - Uses `text-muted-foreground` instead of inline hex `text-[#8b7d6b]`
 * - Uses `bg-brand` for active states instead of inline brand colors
 */
export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, onRoleChange }) => {
  const { theme } = useTheme();

  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border shadow-elegant">
      <h3 className="text-sm font-semibold text-foreground mb-3">Active Role</h3>
      <div className="flex gap-2">
        {["Admin", "Editor", "Viewer"].map((role) => {
          const isActive = currentRole === role;
          return (
            <button
              key={role}
              onClick={() => onRoleChange(role)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {role}
            </button>
          );
        })}
      </div>
    </div>
  );
};
