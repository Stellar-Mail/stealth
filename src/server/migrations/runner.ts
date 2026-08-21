import {
  applyBackward,
  applyForward,
  checksumValue,
  fingerprintKey,
  readEnvelope,
} from "./envelope";
import type {
  FamilyReport,
  IdentityRecordFamily,
  IntegrityIssue,
  MigrationCommand,
  MigrationReport,
  MigrationRunOptions,
  MigrationStorage,
} from "./types";

// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — identity migration engine.
//
// The engine is a pure module over a `MigrationStorage` surface, so the exact
// same code runs:
//   1. as unit tests against `InMemoryMigrationStorage`,
//   2. against local Cloudflare emulation (Miniflare / workerd) via the
//      migration worker, and
//   3. inside a Durable Object when an operator runs the CLI commands.
//
// Contract:
//   - Restartable: a successful command leaves every record at the target
//     version, so re-running it reports 0 changed and 0 failures.
//   - Exact counts: reports `changed`/`skipped`/`failed` per family.
//   - No sensitive payloads: records and full index keys are never echoed;
//     failures reference the family and a redacted key fingerprint only.
// ---------------------------------------------------------------------------

function registryChecksum(families: readonly IdentityRecordFamily[]): string {
  return checksumValue(
    families.map(({ name, keyPrefix, currentVersion }) => ({ name, keyPrefix, currentVersion })),
  );
}

function baseReport(command: MigrationCommand, families: readonly IdentityRecordFamily[]) {
  return {
    command,
    generatedAt: new Date().toISOString(),
    families: families.map<FamilyReport>((family) => ({
      family: family.name,
      keyPrefix: family.keyPrefix,
      totalKeys: 0,
      forwardPending: 0,
      changed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      issues: [],
    })),
    ok: true,
    registryChecksum: registryChecksum(families),
  };
}

function failReport(
  report: MigrationReport,
  families: readonly IdentityRecordFamily[],
  message: string,
  failureKind: "precondition_failed" | "rollback_blocked" | "compatibility_failed",
): MigrationReport {
  report.ok = false;
  report.failureKind = failureKind;
  report.preconditions = [message];
  for (const family of families) {
    const familyReport = report.families.find((item) => item.family === family.name)!;
    familyReport.failed += 1;
    familyReport.errors.push(message);
  }
  return report;
}

async function checksumKeys(storage: MigrationStorage, keys: string[]): Promise<string> {
  const values: Array<[string, unknown]> = [];
  for (const key of [...keys].sort()) {
    const value = await storage.get(key);
    values.push([key, value] as [string, unknown]);
  }
  return checksumValue(values);
}

async function preflight(
  storage: MigrationStorage,
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions,
  command: "forward" | "rollback",
): Promise<string | null> {
  const expected = options.expectedRegistryChecksum;
  const actual = registryChecksum(families);
  if (expected && expected !== actual)
    return "migration registry checksum does not match reviewed manifest";
  if (options.approval !== "approved")
    return "operator approval is required for mutating migrations";

  for (const family of families) {
    const failures = (await family.preconditions?.(storage)) ?? [];
    if (failures.length) return `${family.name}: ${failures.join(", ")}`;
    const keys = await storage.listKeys(family.keyPrefix);
    for (const key of keys) {
      const raw = await storage.get(key);
      if (raw === null || raw === undefined)
        return `${family.name}: missing value for ${fingerprintKey(key)}`;
      const { version } = readEnvelope(raw);
      if (version > family.currentVersion) {
        return `${family.name}: incompatible schema version ${version} for ${fingerprintKey(key)}`;
      }
      if (command === "forward" && version < family.currentVersion && !applyForward(family, raw)) {
        return `${family.name}: missing forward migration step for ${fingerprintKey(key)}`;
      }
      if (
        command === "rollback" &&
        version > (options.targetVersion ?? 0) &&
        !applyBackward(family, raw, options.targetVersion ?? 0)
      ) {
        return `${family.name}: rollback blocked: missing backward migration step for ${fingerprintKey(key)}`;
      }
    }
  }
  return null;
}

export async function dryRun(
  storage: MigrationStorage,
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions = {},
): Promise<MigrationReport> {
  const report = baseReport("dry-run", families);
  for (const family of families) {
    const familyReport = report.families.find((f) => f.family === family.name)!;
    const keys = await storage.listKeys(family.keyPrefix);
    familyReport.totalKeys = keys.length;
    for (const key of keys) {
      const raw = await storage.get(key);
      if (raw === null || raw === undefined) {
        familyReport.failed += 1;
        familyReport.errors.push(`missing value for ${fingerprintKey(key)}`);
        report.ok = false;
        continue;
      }
      const { version } = readEnvelope(raw);
      if (version > family.currentVersion) {
        familyReport.failed += 1;
        familyReport.errors.push(
          `unsupported schema version ${version} for ${fingerprintKey(key)}`,
        );
        report.ok = false;
        continue;
      }
      if (version < family.currentVersion) familyReport.forwardPending += 1;
    }
  }
  return report;
}

export async function forward(
  storage: MigrationStorage,
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions = {},
): Promise<MigrationReport> {
  const report = baseReport("forward", families);
  const preflightError = await preflight(storage, families, options, "forward");
  if (preflightError) return failReport(report, families, preflightError, "precondition_failed");
  for (const family of families) {
    const familyReport = report.families.find((f) => f.family === family.name)!;
    const keys = await storage.listKeys(family.keyPrefix);
    familyReport.totalKeys = keys.length;
    familyReport.beforeChecksum = await checksumKeys(storage, keys);
    const start = options.resumeAfter ? keys.indexOf(options.resumeAfter) + 1 : 0;
    const batchKeys = keys.slice(start, options.batchSize ? start + options.batchSize : undefined);
    familyReport.resumed = start > 0;
    for (const key of batchKeys) {
      const raw = await storage.get(key);
      if (raw === null || raw === undefined) {
        familyReport.failed += 1;
        familyReport.errors.push(`missing value for ${fingerprintKey(key)}`);
        report.ok = false;
        continue;
      }
      const { version } = readEnvelope(raw);
      if (version > family.currentVersion) {
        familyReport.failed += 1;
        familyReport.errors.push(
          `unsupported schema version ${version} for ${fingerprintKey(key)}`,
        );
        report.ok = false;
        continue;
      }
      if (version === family.currentVersion) {
        familyReport.skipped += 1;
        continue;
      }
      const migrated = applyForward(family, raw);
      if (!migrated) {
        familyReport.failed += 1;
        familyReport.errors.push(`missing forward migration step for ${fingerprintKey(key)}`);
        report.ok = false;
        continue;
      }
      await storage.put(key, migrated.record);
      familyReport.changed += 1;
    }
    if (batchKeys.length < keys.length - start) familyReport.nextCursor = batchKeys.at(-1);
    familyReport.afterChecksum = await checksumKeys(storage, keys);
  }
  return report;
}

export async function rollback(
  storage: MigrationStorage,
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions = {},
): Promise<MigrationReport> {
  const targetVersion = options.targetVersion;
  if (!targetVersion || targetVersion < 1) {
    const report = baseReport("rollback", families);
    report.ok = false;
    for (const family of report.families) {
      family.errors.push("rollback requires a positive --target-version");
    }
    return report;
  }

  const report = baseReport("rollback", families);
  const preflightError = await preflight(storage, families, options, "rollback");
  if (preflightError) return failReport(report, families, preflightError, "rollback_blocked");
  for (const family of families) {
    const familyReport = report.families.find((f) => f.family === family.name)!;
    const keys = await storage.listKeys(family.keyPrefix);
    familyReport.totalKeys = keys.length;
    familyReport.beforeChecksum = await checksumKeys(storage, keys);
    const start = options.resumeAfter ? keys.indexOf(options.resumeAfter) + 1 : 0;
    const batchKeys = keys.slice(start, options.batchSize ? start + options.batchSize : undefined);
    familyReport.resumed = start > 0;
    for (const key of batchKeys) {
      const raw = await storage.get(key);
      if (raw === null || raw === undefined) {
        familyReport.failed += 1;
        familyReport.errors.push(`missing value for ${fingerprintKey(key)}`);
        report.ok = false;
        continue;
      }
      const { version } = readEnvelope(raw);
      if (version <= targetVersion) {
        familyReport.skipped += 1;
        continue;
      }
      const reverted = applyBackward(family, raw, targetVersion);
      if (!reverted) {
        familyReport.failed += 1;
        familyReport.errors.push(
          `missing backward migration step to v${targetVersion} for ${fingerprintKey(key)}`,
        );
        report.ok = false;
        continue;
      }
      await storage.put(key, reverted.record);
      familyReport.changed += 1;
    }
    if (batchKeys.length < keys.length - start) familyReport.nextCursor = batchKeys.at(-1);
    familyReport.afterChecksum = await checksumKeys(storage, keys);
  }
  return report;
}

export async function integrityCheck(
  storage: MigrationStorage,
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions = {},
): Promise<MigrationReport> {
  const report = baseReport("integrity-check", families);
  for (const family of families) {
    const familyReport = report.families.find((f) => f.family === family.name)!;
    const keys = await storage.listKeys(family.keyPrefix);
    familyReport.totalKeys = keys.length;

    const issues = await checkFamilyIntegrity(storage, family, keys);
    familyReport.issues = issues;
    familyReport.failed = issues.length;
    if (issues.length > 0) report.ok = false;
  }
  return report;
}

async function checkFamilyIntegrity(
  storage: MigrationStorage,
  family: IdentityRecordFamily,
  keys: string[],
): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  for (const key of keys) {
    const raw = await storage.get(key);
    if (raw === null || raw === undefined) {
      issues.push({ kind: "corrupt_envelope", key: fingerprintKey(key) });
      continue;
    }
    const { version, payload } = readEnvelope(raw);
    if (version > family.currentVersion) {
      issues.push({ kind: "unsupported_version", key: fingerprintKey(key) });
      continue;
    }
    if (version < family.currentVersion) {
      // Not a corruption — a forward migration is pending. Reported by dry-run.
      continue;
    }
    const parsed = family.schema.safeParse(payload);
    if (!parsed.success) {
      issues.push({ kind: "invalid_record", key: fingerprintKey(key) });
      continue;
    }

    // Forward index verification: every canonical record must have its
    // secondary indexes present and pointing back at it.
    const canonicalId = key.slice(family.keyPrefix.length);
    for (const resolver of family.indexResolvers ?? []) {
      const indexValue = resolver.resolve(payload);
      if (indexValue === null) continue;
      const indexKey = `${resolver.prefix}${indexValue}`;
      const owner = await storage.get(indexKey);
      if (owner === null || owner === undefined) {
        issues.push({ kind: "missing_index", key: fingerprintKey(indexKey) });
      } else if (owner !== canonicalId) {
        issues.push({ kind: "index_mismatch", key: fingerprintKey(indexKey) });
      }
    }

    // Family-specific integrity hooks (e.g. username -> user back-reference).
    if (family.checkRecord) {
      const issue = await family.checkRecord(payload, key, storage);
      if (issue) issues.push(issue);
    }
  }

  // Index back-references: every secondary index must point at a live record.
  for (const indexPrefix of family.indexPrefixes) {
    const indexKeys = await storage.listKeys(indexPrefix);
    for (const indexKey of indexKeys) {
      const target = await storage.get(indexKey);
      if (typeof target !== "string") {
        issues.push({ kind: "dangling_index", key: fingerprintKey(indexKey) });
        continue;
      }
      const canonicalKey = `${family.keyPrefix}${target}`;
      const canonical = await storage.get(canonicalKey);
      if (canonical === null || canonical === undefined) {
        issues.push({ kind: "dangling_index", key: fingerprintKey(indexKey) });
      }
    }
  }

  return issues;
}
