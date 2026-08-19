import { z } from "zod";

import { senderRuleSchema } from "@/server/api/domain";

export const contactListQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const contactMergeSchema = z.object({
  keepContactId: z.string().trim().min(1),
  mergeContactIds: z.array(z.string().trim().min(1)).min(1),
});

export const importCommitRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  trust: senderRuleSchema.optional(),
  source: z.enum(["csv", "vcard"]).optional(),
});

export const importCommitSchema = z.object({
  rows: z.array(importCommitRowSchema).min(1).max(1000),
  applyTrust: z.boolean().default(false),
});

export const importPreviewSchema = z.object({
  format: z.enum(["csv", "vcard"]),
  content: z
    .string()
    .min(1)
    .max(512 * 1024),
});
