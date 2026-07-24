export type TeamDigestItem = {
  id: string;
  author: string;
  subject: string;
  project?: string;
  tags?: string[];
  createdAt: string;
  isActionItem?: boolean;
  summary?: string;
};

export type TeamDigestSummary = {
  totalItems: number;
  authors: Record<string, number>;
  projects: Record<string, number>;
  tags: Record<string, number>;
  actionItems: TeamDigestItem[];
  topSubjects: string[];
  generatedAt: string;
};

function countValues<T extends string>(items: readonly T[] | undefined): Record<T, number> {
  return (items ?? []).reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

export function generateTeamDigest(
  items: TeamDigestItem[],
  options?: { topSubjectLimit?: number },
): TeamDigestSummary {
  const topSubjectLimit = options?.topSubjectLimit ?? 5;
  const authors = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.author] = (acc[item.author] ?? 0) + 1;
    return acc;
  }, {});

  const projects = items.reduce<Record<string, number>>((acc, item) => {
    if (!item.project) return acc;
    acc[item.project] = (acc[item.project] ?? 0) + 1;
    return acc;
  }, {});

  const tags = items.reduce<Record<string, number>>((acc, item) => {
    (item.tags ?? []).forEach((tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
    });
    return acc;
  }, {});

  const subjectCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.subject] = (acc[item.subject] ?? 0) + 1;
    return acc;
  }, {});

  const topSubjects = Object.entries(subjectCounts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, topSubjectLimit)
    .map(([subject]) => subject);

  const actionItems = items.filter((item) => item.isActionItem ?? false);

  const generatedAt = new Date().toISOString();

  return {
    totalItems: items.length,
    authors,
    projects,
    tags,
    actionItems,
    topSubjects,
    generatedAt,
  };
}
