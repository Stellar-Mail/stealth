/**
 * Performance constraint helpers for the Meeting Assignment Tool.
 */

const MAX_ASSIGNEES_PER_MEETING = 50;

/**
 * Enforces strict limits on payload sizes to prevent DoS via massive arrays.
 * @param assignees The list of assignees.
 * @throws Error if limits are exceeded.
 */
export function enforceAssigneeLimits(assignees: string[]): void {
  if (assignees.length > MAX_ASSIGNEES_PER_MEETING) {
    throw new Error(
      `Performance Guard: Exceeded maximum allowed assignees (${MAX_ASSIGNEES_PER_MEETING}). Provided: ${assignees.length}`,
    );
  }
}

/**
 * Chunks a large array into smaller batches to avoid blocking the event loop.
 * @param items Array of items to chunk.
 * @param batchSize The size of each chunk.
 * @returns Array of chunked arrays.
 */
export function chunkAssignees<T>(items: T[], batchSize: number = 20): T[][] {
  if (!items || items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
}
