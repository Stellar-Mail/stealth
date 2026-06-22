import * as React from "react";
import { FolderGit2 } from "lucide-react";

export interface ProjectBadgeProps {
  projectName: string;
  projectColor?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * ProjectBadge - Renders a premium, micro-animated badge indicating
 * the project binding of a given email thread.
 *
 * Design Aesthetics: Subtle gradients, Outfit/Inter typography, and smooth scale transitions.
 */
export const ProjectBadge: React.FC<ProjectBadgeProps> = ({
  projectName,
  projectColor = "from-indigo-500/10 to-purple-500/10 text-indigo-400 border-indigo-500/20",
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-gradient-to-r transition-all duration-300 ease-out cursor-pointer hover:scale-105 active:scale-95 select-none ${projectColor} ${className}`}
    >
      <FolderGit2 className="w-3 h-3" />
      <span className="tracking-wide">{projectName}</span>
    </div>
  );
};
