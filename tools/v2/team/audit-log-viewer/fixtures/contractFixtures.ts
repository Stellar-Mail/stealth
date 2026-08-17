import type { GetEntryInput, ListEntriesInput } from "../types";

// --- Success cases ---------------------------------------------------------

export const VALID_LIST_INPUT: ListEntriesInput = {
  filters: { severity: "warning" },
  limit: 10,
  offset: 0,
};

export const VALID_GET_ENTRY_INPUT: GetEntryInput = {
  entryId: "log_001",
};

// --- Failure cases -----------------------------------------------------------

export const INVALID_LIMIT_LIST_INPUT: ListEntriesInput = {
  limit: -5,
};

export const OVERSIZED_LIMIT_LIST_INPUT: ListEntriesInput = {
  limit: 500, // exceeds MAX_PAGE_SIZE
};

export const INVALID_DATE_RANGE_LIST_INPUT: ListEntriesInput = {
  filters: { from: "2026-06-18T00:00:00Z", to: "2026-06-01T00:00:00Z" }, // from after to
};

export const MISSING_ENTRY_ID_INPUT = { entryId: "" } as GetEntryInput;

export const UNKNOWN_ENTRY_ID_INPUT: GetEntryInput = {
  entryId: "log_does_not_exist",
};
