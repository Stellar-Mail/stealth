export type ChangelogCategory = "ui" | "api" | "protocol" | "security";

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  category: ChangelogCategory;
  title: string;
  description: string;
  link?: { label: string; href: string };
}
