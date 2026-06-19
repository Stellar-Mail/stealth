/**
 * Types for the Campaign Quick Fix feature.
 */
export interface CampaignRecord {
  id: string;
  name: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
}

export interface QuickFixResult {
  original: CampaignRecord;
  fixed: CampaignRecord;
  appliedFixes: string[];
}

/**
 * Fixes missing or empty tags by assigning a default 'untagged' label.
 */
export const fixMissingTags = (record: CampaignRecord): CampaignRecord => {
  if (!record.tags || record.tags.length === 0) {
    return { ...record, tags: ["untagged"] };
  }
  return record;
};

/**
 * Fixes duplicate names across a batch of campaigns by appending an incrementing counter.
 */
export const fixDuplicateNames = (records: CampaignRecord[]): CampaignRecord[] => {
  const seen = new Set<string>();
  return records.map((record) => {
    let newName = record.name;
    let counter = 1;
    while (seen.has(newName)) {
      newName = `${record.name} (${counter})`;
      counter++;
    }
    seen.add(newName);
    return record.name === newName ? record : { ...record, name: newName };
  });
};

/**
 * Fixes invalid date strings and ensures the start date is not after the end date.
 */
export const fixInvalidDates = (record: CampaignRecord): CampaignRecord => {
  const fixed = { ...record };
  let changed = false;

  const isValidDate = (d: string) => !isNaN(Date.parse(d));

  if (record.startDate && !isValidDate(record.startDate)) {
    fixed.startDate = "2023-01-01T00:00:00.000Z"; // Deterministic fallback
    changed = true;
  }

  if (record.endDate && !isValidDate(record.endDate)) {
    fixed.endDate = "2023-12-31T23:59:59.999Z"; // Deterministic fallback
    changed = true;
  }

  if (
    fixed.startDate &&
    fixed.endDate &&
    isValidDate(fixed.startDate) &&
    isValidDate(fixed.endDate)
  ) {
    if (new Date(fixed.startDate) > new Date(fixed.endDate)) {
      fixed.endDate = fixed.startDate;
      changed = true;
    }
  }

  return changed ? fixed : record;
};

/**
 * Applies all quick fixes to a batch of campaign records and reports the changes.
 * Returns the original and fixed records to support UI previews and reversible actions (undo).
 */
export const applyQuickFixes = (records: CampaignRecord[]): QuickFixResult[] => {
  const nameFixedRecords = fixDuplicateNames(records);

  return nameFixedRecords.map((nameFixedRecord, index) => {
    const original = records[index];
    const appliedFixes: string[] = [];
    let current = nameFixedRecord;

    if (original.name !== current.name) {
      appliedFixes.push("fixDuplicateNames");
    }

    const afterTags = fixMissingTags(current);
    if (afterTags !== current) {
      current = afterTags;
      appliedFixes.push("fixMissingTags");
    }

    const afterDates = fixInvalidDates(current);
    if (afterDates !== current) {
      current = afterDates;
      appliedFixes.push("fixInvalidDates");
    }

    return {
      original,
      fixed: current,
      appliedFixes,
    };
  });
};
