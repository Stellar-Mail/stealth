import { z } from "zod";
import { searchQuerySchema, searchResponseSchema } from "@/server/api/domain";

export const searchRouteQuerySchema = searchQuerySchema;
export type SearchRouteQuery = z.infer<typeof searchRouteQuerySchema>;

export const searchRouteResponseSchema = searchResponseSchema;
export type SearchRouteResponse = z.infer<typeof searchRouteResponseSchema>;
