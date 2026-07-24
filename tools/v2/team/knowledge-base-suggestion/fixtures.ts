/**
 * fixtures.ts — Knowledge Base Suggestion (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { KbArticle, KbCorpusFilter, SuggestionConfig } from "./types";
import { RankingStrategy } from "./types";

/** A small deterministic KB corpus with rich metadata for scoring and filtering. */
export const KB_ARTICLES: KbArticle[] = [
  {
    id: "kb-onboarding",
    title: "Team Onboarding Checklist",
    tags: ["onboarding", "getting-started", "team"],
    summary: "Steps for ramping new team members.",
    content:
      "This comprehensive guide covers the full team onboarding process including workspace setup, tool access provisioning, mentor assignment, and first-week goals. Follow each step to ensure a smooth ramp-up for new hires.",
    category: "human-resources",
    locale: "en",
    access: "public",
    product: "internal-tools",
    team: "people-ops",
    author: "hr-team",
    updatedAt: "2026-06-15T10:00:00Z",
    revision: "v3",
    deprecated: false,
    relatedArticleIds: ["kb-security", "kb-billing"],
    viewCount: 15420,
    rating: 4.5,
    keywordFrequencies: {
      onboarding: 15,
      checklist: 8,
      team: 12,
      setup: 6,
    },
  },
  {
    id: "kb-billing",
    title: "Billing and Invoices FAQ",
    tags: ["billing", "invoices", "finance"],
    summary: "How to read invoices and handle disputes.",
    content:
      "Frequently asked questions about billing cycles, invoice generation, payment methods, dispute resolution, and refund requests. For team-specific billing questions, contact the finance team directly.",
    category: "finance",
    locale: "en",
    access: "team",
    product: "billing-system",
    team: "finance",
    author: "finance-team",
    updatedAt: "2026-07-01T08:30:00Z",
    revision: "v5",
    deprecated: false,
    relatedArticleIds: ["kb-onboarding"],
    viewCount: 28900,
    rating: 4.2,
    keywordFrequencies: {
      billing: 20,
      invoice: 15,
      payment: 10,
      dispute: 5,
    },
  },
  {
    id: "kb-security",
    title: "Security Incident Response",
    tags: ["security", "incident", "runbook"],
    summary: "What to do during a security incident.",
    content:
      "Step-by-step runbook for identifying, reporting, containing, and recovering from security incidents. Includes contact information for the security team and escalation procedures.",
    category: "security",
    locale: "en",
    access: "public",
    product: "security",
    team: "security-team",
    author: "sec-team",
    updatedAt: "2026-07-10T14:00:00Z",
    revision: "v2",
    deprecated: false,
    relatedArticleIds: ["kb-onboarding"],
    viewCount: 8700,
    rating: 4.8,
    keywordFrequencies: {
      security: 25,
      incident: 18,
      response: 12,
      runbook: 8,
    },
  },
  {
    id: "kb-dev-workflow",
    title: "Developer Workflow Guide",
    tags: ["development", "workflow", "git"],
    summary: "Standard development workflow for the team.",
    content:
      "Guide covering the standard Git workflow, code review process, CI/CD pipeline, and deployment procedures. Includes branch naming conventions and commit message format.",
    category: "engineering",
    locale: "en",
    access: "public",
    product: "developer-tools",
    team: "engineering",
    author: "eng-lead",
    updatedAt: "2026-06-20T11:00:00Z",
    revision: "v4",
    deprecated: false,
    relatedArticleIds: [],
    viewCount: 22300,
    rating: 4.6,
    keywordFrequencies: {
      development: 10,
      workflow: 14,
      git: 8,
      deployment: 6,
    },
  },
  {
    id: "kb-fr-onboarding",
    title: "Guide d'intégration pour les nouveaux",
    tags: ["onboarding", "integration", "equipe"],
    summary: "Étapes pour intégrer les nouveaux membres de l'équipe.",
    content:
      "Ce guide couvre l'ensemble du processus d'intégration des nouveaux membres de l'équipe, y compris la configuration de l'espace de travail, l'attribution des accès aux outils, l'affectation d'un mentor et les objectifs de la première semaine.",
    category: "human-resources",
    locale: "fr",
    access: "public",
    product: "internal-tools",
    team: "people-ops",
    author: "hr-team",
    updatedAt: "2026-05-10T09:00:00Z",
    revision: "v2",
    deprecated: false,
    relatedArticleIds: [],
    viewCount: 3400,
    rating: 4.1,
    keywordFrequencies: {
      intégration: 12,
      nouveau: 8,
      equipe: 10,
    },
  },
  {
    id: "kb-api-docs",
    title: "Internal API Documentation",
    tags: ["api", "development", "documentation"],
    summary: "Complete API reference for internal services.",
    content:
      "Comprehensive documentation for all internal REST and GraphQL APIs, including authentication, endpoint references, request/response schemas, error codes, and usage examples.",
    category: "engineering",
    locale: "en",
    access: "public",
    product: "developer-tools",
    team: "engineering",
    author: "api-team",
    updatedAt: "2026-07-15T16:00:00Z",
    revision: "v6",
    deprecated: false,
    relatedArticleIds: ["kb-dev-workflow"],
    viewCount: 31200,
    rating: 4.3,
    keywordFrequencies: {
      api: 30,
      documentation: 15,
      endpoint: 20,
      authentication: 8,
    },
  },
  {
    id: "kb-deprecated-tool",
    title: "Legacy Reporting Tool (Deprecated)",
    tags: ["reporting", "legacy", "deprecated"],
    summary: "Legacy reporting tool documentation (no longer maintained).",
    content:
      "This documentation is for the legacy reporting tool which has been replaced by the new Analytics Dashboard. Do not use this tool for new reports.",
    category: "analytics",
    locale: "en",
    access: "team",
    product: "analytics",
    team: "data-team",
    author: "data-team",
    updatedAt: "2025-12-01T12:00:00Z",
    revision: "v1",
    deprecated: true,
    relatedArticleIds: [],
    viewCount: 1200,
    rating: 3.0,
    keywordFrequencies: {
      reporting: 8,
      legacy: 5,
    },
  },
];

/** A filter that limits to public articles. */
export function publicFilter(article: KbArticle): boolean {
  return article.access === "public";
}
Object.defineProperty(publicFilter, "name", { value: "public-access" });

/** A filter that limits to English articles. */
export function enLocaleFilter(article: KbArticle): boolean {
  return article.locale === "en";
}
Object.defineProperty(enLocaleFilter, "name", { value: "en-locale" });

/** A filter that excludes deprecated articles. */
export function excludeDeprecatedFilter(article: KbArticle): boolean {
  return article.deprecated !== true;
}
Object.defineProperty(excludeDeprecatedFilter, "name", { value: "exclude-deprecated" });

/** A filter that limits to a specific team. */
export function teamFilter(team: string): KbCorpusFilter {
  const filter = (article: KbArticle) => article.team === team;
  Object.defineProperty(filter, "name", { value: `team-${team}` });
  return filter as KbCorpusFilter;
}

/** A filter that limits to a specific product. */
export function productFilter(product: string): KbCorpusFilter {
  const filter = (article: KbArticle) => article.product === product;
  Object.defineProperty(filter, "name", { value: `product-${product}` });
  return filter as KbCorpusFilter;
}

/** A filter that limits to articles with a minimum rating. */
export function minRatingFilter(minRating: number): KbCorpusFilter {
  const filter = (article: KbArticle) => (article.rating ?? 0) >= minRating;
  Object.defineProperty(filter, "name", { value: `min-rating-${minRating}` });
  return filter as KbCorpusFilter;
}

/** A large corpus for benchmarking (200 articles generated from patterns). */
export function generateLargeCorpus(size: number = 200): KbArticle[] {
  const categories = [
    "engineering",
    "finance",
    "security",
    "human-resources",
    "analytics",
    "operations",
  ];
  const accesses = ["public", "team", "restricted"];
  const locales = ["en", "fr", "de", "es", "ja"];
  const teams = [
    "engineering",
    "finance",
    "security-team",
    "people-ops",
    "data-team",
    "operations",
  ];
  const baseArticles = KB_ARTICLES;

  const corpus: KbArticle[] = [];

  for (let i = 0; i < size; i++) {
    const base = baseArticles[i % baseArticles.length];
    const category = categories[i % categories.length];
    const access = accesses[i % accesses.length];
    const locale = locales[i % locales.length];
    const team = teams[i % teams.length];

    corpus.push({
      ...base,
      id: `kb-generated-${i}`,
      title: `${base.title} (Variant ${i})`,
      tags: base.tags.map((t) => `${t}-${i % 3}`),
      summary: `Generated variant ${i} of ${base.title}`,
      content: `${base.content} Generated variant ${i} with additional content for testing purposes.`,
      category,
      locale,
      access,
      team,
      viewCount: Math.floor(Math.random() * 50000),
      rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 - 5.0
      updatedAt: new Date(
        Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      deprecated: Math.random() < 0.1, // 10% deprecated
    });
  }

  return corpus;
}

/** Sample configuration for weighted scoring tests. */
export const tagWeightedConfig: SuggestionConfig = {
  strategy: RankingStrategy.TagWeighted,
  tagWeight: 3,
  titleWeight: 1,
};

/** Sample configuration for content-weighted scoring tests. */
export const contentWeightedConfig: SuggestionConfig = {
  strategy: RankingStrategy.ContentWeighted,
  contentWeight: 2,
  titleWeight: 2,
};

/** Sample configuration for popularity-boosted scoring tests. */
export const popularityBoostedConfig: SuggestionConfig = {
  strategy: RankingStrategy.PopularityBoosted,
  popularityWeight: 1,
};

/** Sample configuration for balanced scoring tests. */
export const balancedConfig: SuggestionConfig = {
  strategy: RankingStrategy.Balanced,
  tagWeight: 2,
  titleWeight: 1,
  contentWeight: 0.5,
  popularityWeight: 0.3,
  recencyWeight: 0.2,
};
