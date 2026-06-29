import * as React from "react";
import { FolderGit2, Users, Coins } from "lucide-react";
import { Project } from "../types";

export interface ProjectListProps {
  projects: Project[];
  getMailCountForProject: (projectId: string) => number;
  onSelectProject?: (projectId: string) => void;
  selectedProjectId?: string;
  className?: string;
}

/**
 * ProjectList - Displays the project dashboard widget for teams.
 * Renders lists of configured projects, members, and indicators for associated Stellar escrow assets.
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  getMailCountForProject,
  onSelectProject,
  selectedProjectId,
  className = "",
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Projects ({projects.length})
        </h3>
      </div>

      <div className="grid gap-2">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            No projects linked to this workspace.
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            const mailCount = getMailCountForProject(project.id);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject?.(project.id)}
                className={`group flex flex-col p-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-br from-indigo-950/20 to-purple-950/20 border-indigo-500/30 shadow-md"
                    : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:text-zinc-300"
                      }`}
                    >
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                        {project.name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  {mailCount > 0 && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        isSelected
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800"
                      }`}
                    >
                      {mailCount}
                    </span>
                  )}
                </div>

                {/* Metadata Row */}
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-zinc-900 text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-zinc-600" />
                    <span>{project.members.length} members</span>
                  </div>

                  {project.stellarAddress && (
                    <div className="flex items-center gap-1 font-mono text-[9px] text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10">
                      <Coins className="w-2.5 h-2.5" />
                      <span>
                        {project.stellarAddress.slice(0, 4)}...{project.stellarAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
