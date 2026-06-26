import React from "react";

interface ProjectCardProps {
  title: string;
  description: string;
  status: "active" | "completed" | "pending";
  onSelect?: () => void;
}

/**
 * ProjectCard displays details about a project.
 * Uses semantic theme tokens:
 * - Card surface: bg-surface-card
 * - Text: text-foreground / text-muted-foreground
 * - Status tags: brand / success / warning colors mapped to semantic classes
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({
  title,
  description,
  status,
  onSelect,
}) => {
  const statusColors = {
    active: "bg-success-bg text-success border border-success-border",
    completed: "bg-brand/10 text-brand border border-brand/20",
    pending: "bg-warning-bg text-warning border border-warning-border",
  };

  return (
    <div
      onClick={onSelect}
      className="p-5 rounded-lg bg-surface-card border border-border hover:border-brand-hover shadow-elegant transition-all duration-200 cursor-pointer flex flex-col gap-2"
    >
      <div className="flex justify-between items-start">
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
    </div>
  );
};
