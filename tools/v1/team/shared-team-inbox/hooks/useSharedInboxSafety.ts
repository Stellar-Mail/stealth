import { useMemo } from 'react';
import { validateSharedMessage, ValidatedSharedMessage } from '../utils/validation';
import { sanitizeMessageBody } from '../utils/sanitization';
import { paginateInboxMessages, truncateLargeBody, PaginatedResult } from '../utils/performance';

export interface UseSharedInboxSafetyOptions {
  rawMessages: unknown[];
  page?: number;
  pageSize?: number;
}

export function useSharedInboxSafety({ rawMessages, page = 1, pageSize = 50 }: UseSharedInboxSafetyOptions) {
  return useMemo(() => {
    const validMessages: ValidatedSharedMessage[] = [];
    const rejectedCount = { value: 0 };

    if (Array.isArray(rawMessages)) {
      for (const raw of rawMessages) {
        const validation = validateSharedMessage(raw);
        if (validation.isValid && validation.data) {
          const sanitizedBody = sanitizeMessageBody(validation.data.body);
          const { text: truncatedBody } = truncateLargeBody(sanitizedBody);

          validMessages.push({
            ...validation.data,
            body: truncatedBody,
          });
        } else {
          rejectedCount.value += 1;
        }
      }
    }

    const paginated: PaginatedResult<ValidatedSharedMessage> = paginateInboxMessages(validMessages, page, pageSize);

    return {
      messages: paginated.items,
      hasMore: paginated.hasMore,
      totalCount: paginated.totalCount,
      rejectedCount: rejectedCount.value,
      page: paginated.page,
    };
  }, [rawMessages, page, pageSize]);
}
