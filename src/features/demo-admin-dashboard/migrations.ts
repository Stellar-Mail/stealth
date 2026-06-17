export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate(data: any): any;
}

export interface MigrationResult {
  success: boolean;
  originalVersion: number;
  targetVersion: number;
  data: any;
  stepsApplied: string[];
  error?: string;
}

/**
 * Migration from V1 to V2:
 * Converts old `trusted` boolean on emails to `senderPolicy` ("allow" | "block").
 */
export const migrationV1toV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  migrate(data: any): any {
    if (!data || !Array.isArray(data.emails)) return data;

    const migratedEmails = data.emails.map((email: any) => {
      if (email.senderPolicy !== undefined) return email;

      const newEmail = { ...email };
      if (typeof email.trusted === "boolean") {
        newEmail.senderPolicy = email.trusted ? "allow" : "block";
        delete newEmail.trusted;
      } else {
        newEmail.senderPolicy = "allow"; // Default policy
      }
      return newEmail;
    });

    return {
      ...data,
      version: 2,
      emails: migratedEmails,
    };
  },
};

/**
 * Migration from V2 to V3:
 * Ensures all email events have an `endTime` and a valid `date`.
 */
export const migrationV2toV3: Migration = {
  fromVersion: 2,
  toVersion: 3,
  migrate(data: any): any {
    if (!data || !Array.isArray(data.emails)) return data;

    const migratedEmails = data.emails.map((email: any) => {
      if (!email.event) return email;

      const updatedEvent = { ...email.event };

      // Ensure date exists on the event, fallback to a default if missing
      if (!updatedEvent.date) {
        updatedEvent.date = "2026-06-13";
      }

      // Ensure endTime exists, otherwise calculate 1 hour after time
      if (!updatedEvent.endTime) {
        const timeStr = updatedEvent.time || "09:00 AM";
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (match) {
          let hour = Number(match[1]);
          const minutes = match[2];
          if (match[3]?.toUpperCase() === "PM" && hour < 12) hour += 12;
          if (match[3]?.toUpperCase() === "AM" && hour === 12) hour = 0;
          const endHour = (hour + 1) % 24;
          updatedEvent.endTime = `${String(endHour).padStart(2, "0")}:${minutes}`;
        } else {
          updatedEvent.endTime = "10:00";
        }
      }

      // Ensure calendar field exists
      if (!updatedEvent.calendar) {
        updatedEvent.calendar = "personal";
      }

      return {
        ...email,
        event: updatedEvent,
      };
    });

    return {
      ...data,
      version: 3,
      emails: migratedEmails,
    };
  },
};

const registeredMigrations: Migration[] = [migrationV1toV2, migrationV2toV3];

export function runMigrations(data: any, targetVersion: number): MigrationResult {
  const originalVersion = typeof data?.version === "number" ? data.version : 1;
  let currentVersion = originalVersion;
  let currentData = JSON.parse(JSON.stringify(data)); // deep clone
  const stepsApplied: string[] = [];

  if (currentVersion > targetVersion) {
    return {
      success: false,
      originalVersion,
      targetVersion,
      data,
      stepsApplied,
      error: `Downgrades are not supported (source version ${originalVersion} is greater than target version ${targetVersion})`,
    };
  }

  while (currentVersion < targetVersion) {
    const migration = registeredMigrations.find(
      (m) => m.fromVersion === currentVersion && m.toVersion === currentVersion + 1,
    );

    if (!migration) {
      return {
        success: false,
        originalVersion,
        targetVersion,
        data: currentData,
        stepsApplied,
        error: `Missing migration path from version ${currentVersion} to ${currentVersion + 1}`,
      };
    }

    try {
      currentData = migration.migrate(currentData);
      currentVersion = migration.toVersion;
      stepsApplied.push(`Migrated V${migration.fromVersion} to V${migration.toVersion}`);
    } catch (err: any) {
      return {
        success: false,
        originalVersion,
        targetVersion,
        data: currentData,
        stepsApplied,
        error: `Failed to migrate from version ${migration.fromVersion} to ${migration.toVersion}: ${err?.message || err}`,
      };
    }
  }

  return {
    success: true,
    originalVersion,
    targetVersion,
    data: currentData,
    stepsApplied,
  };
}
