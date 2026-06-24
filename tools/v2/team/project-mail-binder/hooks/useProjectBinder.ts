import * as React from "react";
import { Project, ProjectMailBinding } from "../implementation.md";
import { ProjectBinderService } from "../services/projectBinderService";
import type { Email } from "@/components/mail/data";

const initialMockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Soroban Bridge Integration",
    description: "Tracking Smart Contract event bindings and postage claims verification.",
    stellarAddress: "GCCD3IDSLG2KCE2K3C7IOPQZ2772JDMXOXP23DSEJ4KSDIOPP2",
    stellarAssetCode: "XLM",
    members: ["lina*vantage.studio", "marcus*northwind.io"],
    rules: [
      { id: "rule-1", type: "subject", pattern: "Soroban|Contract", isActive: true },
      { id: "rule-2", type: "sender", pattern: "receipts*stealth.network", isActive: true },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "proj-2",
    name: "Vantage Q2 Rebranding",
    description: "Collaboration on Q2 brand directions and monochrome aesthetic components.",
    stellarAddress: "GBA2H7I6J4S7JOPL23DOP12IOP235HJDKSOPP234DSIOP27J",
    stellarAssetCode: "VNTG",
    members: ["lina*vantage.studio", "nadia*atlas.dev"],
    rules: [{ id: "rule-3", type: "subject", pattern: "Q2 brand|Vantage", isActive: true }],
    createdAt: new Date().toISOString(),
  },
];

/**
 * useProjectBinder - React hook to handle Project Mail Binder state.
 * Employs ProjectBinderService internally with memoized state triggers.
 */
export function useProjectBinder(allEmails: Email[] = []) {
  // Use in-memory service reference
  const serviceRef = React.useRef<ProjectBinderService | null>(null);

  // Initialize service on mount
  if (!serviceRef.current) {
    serviceRef.current = new ProjectBinderService(initialMockProjects);
  }

  const service = serviceRef.current;

  // React states reflecting local business data
  const [projects, setProjects] = React.useState<Project[]>(service.getProjects());
  const [bindingsCounter, setBindingsCounter] = React.useState(0);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | undefined>(undefined);

  // Auto-bind emails once on mount or when emails change
  React.useEffect(() => {
    if (allEmails.length > 0) {
      service.autoBindEmails(allEmails);
      setBindingsCounter((prev) => prev + 1);
    }
  }, [allEmails]);

  // Actions
  const handleCreateProject = React.useCallback(
    (name: string, description: string = "", stellarAddress?: string) => {
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        name,
        description,
        stellarAddress,
        members: [],
        rules: [],
        createdAt: new Date().toISOString(),
      };
      service.createProject(newProj);
      setProjects(service.getProjects());
    },
    [service],
  );

  const handleBindEmail = React.useCallback(
    (emailId: string, projectId: string) => {
      service.bindEmail(emailId, projectId);
      setBindingsCounter((prev) => prev + 1);
    },
    [service],
  );

  const handleUnbindEmail = React.useCallback(
    (emailId: string, projectId: string) => {
      service.unbindEmail(emailId, projectId);
      setBindingsCounter((prev) => prev + 1);
    },
    [service],
  );

  // Queries
  const getBoundEmailsForProject = React.useCallback(
    (projectId: string): Email[] => {
      const boundIds = service.getEmailsForProject(projectId);
      const boundSet = new Set(boundIds);
      return allEmails.filter((e) => boundSet.has(e.id));
    },
    [service, allEmails, bindingsCounter],
  );

  const getProjectsForEmail = React.useCallback(
    (emailId: string): Project[] => {
      const pids = service.getProjectsForEmail(emailId);
      return projects.filter((p) => pids.includes(p.id));
    },
    [service, projects, bindingsCounter],
  );

  const getMailCountForProject = React.useCallback(
    (projectId: string): number => {
      return service.getEmailsForProject(projectId).length;
    },
    [service, bindingsCounter],
  );

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    createProject: handleCreateProject,
    bindEmail: handleBindEmail,
    unbindEmail: handleUnbindEmail,
    getBoundEmailsForProject,
    getProjectsForEmail,
    getMailCountForProject,
  };
}
