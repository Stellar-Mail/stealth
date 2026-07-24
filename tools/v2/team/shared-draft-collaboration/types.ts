export type DraftId = string;

export type SharedDraftData = {
  id: DraftId;
  title: string;
  subject: string;
  lastModified: string;
  collaborators: number;
  isActive: boolean;
};

export type CreateDraftInput = {
  title: string;
  subject?: string;
  collaborators?: number;
};

export type UpdateDraftInput = {
  id: DraftId;
  title?: string;
  subject?: string;
  collaborators?: number;
};

export type DraftFilter = {
  isActive?: boolean;
  search?: string | null;
};

export type DraftMetrics = {
  total: number;
  active: number;
  inactive: number;
  totalCollaborators: number;
};

export type ServiceConfig = {
  delayMs: number;
};
