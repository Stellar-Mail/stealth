import * as React from "react";
import { FolderPlus, Check, Plus } from "lucide-react";
import { Project } from "../implementation.md";

export interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectIds: string[];
  onBind: (projectId: string) => void;
  onUnbind: (projectId: string) => void;
  onCreateProject?: (name: string) => void;
  className?: string;
}

/**
 * ProjectSelector - Allows binding/unbinding an email thread to one or more projects.
 * Adheres to isolated V2 layout rules: uses local state and styling.
 */
export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectIds,
  onBind,
  onUnbind,
  onCreateProject,
  className = "",
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");

  const toggleProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      onUnbind(projectId);
    } else {
      onBind(projectId);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim() && onCreateProject) {
      onCreateProject(newProjectName.trim());
      setNewProjectName("");
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 active:scale-95 transition-all duration-200"
      >
        <FolderPlus className="w-3.5 h-3.5" />
        <span>Bind Project</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Select Projects
            </div>

            <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-zinc-500 text-center italic">
                  No projects configured
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150 ${
                        isSelected
                          ? "bg-indigo-600/10 text-indigo-400 font-medium"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      }`}
                    >
                      <span className="truncate">{project.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })
              )}
            </div>

            {onCreateProject && (
              <form
                onSubmit={handleCreate}
                className="mt-2 pt-2 border-t border-zinc-900 flex gap-1"
              >
                <input
                  type="text"
                  placeholder="New project..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors duration-150"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
};
