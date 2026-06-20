// Test fixtures and mock data builders
// Use these to create consistent test data

import type {
  Vendor,
  VendorCategory,
  VendorStatus,
  CommunicationRecord,
  CommunicationType,
  CommunicationStatus,
  VendorMetrics,
} from "../types";

/**
 * Create a mock vendor with sensible defaults
 */
export function createMockVendor(overrides?: Partial<Vendor>): Vendor {
  const id = overrides?.id || `vendor-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: overrides?.name || "Mock Vendor",
    email: overrides?.email || `vendor-${id}@example.com`,
    domain: overrides?.domain || "example.com",
    category: overrides?.category || VendorCategory.EMAIL_SERVICE,
    status: overrides?.status || VendorStatus.ACTIVE,
    metadata: overrides?.metadata,
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
  };
}

/**
 * Create multiple mock vendors
 */
export function createMockVendors(count: number, overrides?: Partial<Vendor>): Vendor[] {
  return Array.from({ length: count }, (_, i) =>
    createMockVendor({
      ...overrides,
      name: `Mock Vendor ${i + 1}`,
    }),
  );
}

/**
 * Create a mock communication record
 */
export function createMockCommunicationRecord(
  overrides?: Partial<CommunicationRecord>,
): CommunicationRecord {
  const id = overrides?.id || `record-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    vendorId: overrides?.vendorId || `vendor-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: overrides?.timestamp || new Date(),
    type: overrides?.type || CommunicationType.EMAIL,
    subject: overrides?.subject || "Test Subject",
    preview: overrides?.preview || "Test preview text...",
    status: overrides?.status || CommunicationStatus.RECEIVED,
    metadata: overrides?.metadata,
  };
}

/**
 * Create multiple mock communication records
 */
export function createMockCommunicationRecords(
  count: number,
  vendorId?: string,
  overrides?: Partial<CommunicationRecord>,
): CommunicationRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockCommunicationRecord({
      ...overrides,
      vendorId: vendorId || overrides?.vendorId,
      subject: `Test Subject ${i + 1}`,
    }),
  );
}

/**
 * Create a mock vendor metrics record
 */
export function createMockVendorMetrics(overrides?: Partial<VendorMetrics>): VendorMetrics {
  return {
    vendorId: overrides?.vendorId || `vendor-${Math.random().toString(36).substr(2, 9)}`,
    totalInteractions: overrides?.totalInteractions || 42,
    engagementScore: overrides?.engagementScore || 75,
    communicationFrequency: overrides?.communicationFrequency || 3.2,
    lastInteraction: overrides?.lastInteraction || new Date(),
    trend: overrides?.trend || "stable",
    metadata: overrides?.metadata,
  };
}

/**
 * Create a complete test dataset
 */
export function createMockDataset() {
  const vendors = createMockVendors(5);
  const records = vendors.flatMap((vendor) => createMockCommunicationRecords(3, vendor.id));
  const metrics = vendors.map((vendor) => createMockVendorMetrics({ vendorId: vendor.id }));

  return { vendors, records, metrics };
}
