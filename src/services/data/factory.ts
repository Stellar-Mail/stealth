/**
 * Factory for creating and managing data adapters.
 * Provides singleton instance and adapter switching for testing.
 */

import { DeterministicAdapter, OfflineFirstAdapter } from "./adapters";
import type { DataAdapter } from "./repositories";

type AdapterType = "deterministic" | "offline-first";

let currentAdapterType: AdapterType = "offline-first";
let singletonInstance: DataAdapter | null = null;

/**
 * Create a new adapter instance of the given type.
 */
export function createAdapter(type: AdapterType): DataAdapter {
  switch (type) {
    case "deterministic":
      return new DeterministicAdapter();
    case "offline-first":
      return new OfflineFirstAdapter();
    default:
      console.warn(`Unknown adapter type: ${type}, using offline-first`);
      return new OfflineFirstAdapter();
  }
}

/**
 * Get the singleton adapter instance.
 * Initializes if not already created.
 */
export async function getAdapterInstance(): Promise<DataAdapter> {
  if (singletonInstance === null) {
    singletonInstance = createAdapter(currentAdapterType);
    await singletonInstance.initialize();
  }
  return singletonInstance;
}

/**
 * Switch to a different adapter type.
 * Useful for testing or runtime configuration changes.
 */
export async function switchAdapter(type: AdapterType): Promise<DataAdapter> {
  currentAdapterType = type;
  singletonInstance = createAdapter(type);
  await singletonInstance.initialize();
  return singletonInstance;
}

/**
 * Reset the current adapter.
 * Clears all data and reinitializes.
 */
export async function resetAdapter(): Promise<void> {
  if (singletonInstance) {
    await singletonInstance.clear();
    singletonInstance = null;
    await getAdapterInstance();
  }
}

/**
 * Get the current adapter type name.
 */
export function getCurrentAdapterType(): AdapterType {
  return currentAdapterType;
}

/**
 * Get the name/description of the current adapter.
 */
export async function getCurrentAdapterName(): Promise<string> {
  const adapter = await getAdapterInstance();
  return adapter.getName();
}
