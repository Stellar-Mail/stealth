import { ValidatedSharedMessage } from './validation';

const DEFAULT_PAGE_SIZE = 50;
const PREVIEW_CHAR_LIMIT = 100000; // 100KB character threshold

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  totalCount: number;
  page: number;
}

/**
 * Enforces strict pagination boundaries on large inbox datasets.
 */
export function paginateInboxMessages(
  messages: ValidatedSharedMessage[],
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): PaginatedResult<ValidatedSharedMessage> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), DEFAULT_PAGE_SIZE);

  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;

  const slicedItems = messages.slice(startIndex, endIndex);

  return {
    items: slicedItems,
    hasMore: endIndex < messages.length,
    totalCount: messages.length,
    page: safePage,
  };
}

/**
 * Truncates oversized message body texts to prevent main thread rendering lockups.
 */
export function truncateLargeBody(body: string, limit: number = PREVIEW_CHAR_LIMIT): { text: string; isTruncated: boolean } {
  if (body.length <= limit) {
    return { text: body, isTruncated: false };
  }

  return {
    text: body.slice(0, limit) + '\n\n[Content truncated for performance size limit]',
    isTruncated: true,
  };
}
