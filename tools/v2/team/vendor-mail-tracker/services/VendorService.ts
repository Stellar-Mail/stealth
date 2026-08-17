// Vendor management service
// Handles CRUD operations, profiles, and vendor lifecycle

import { VendorCategory, VendorStatus } from "../types";
import type { Vendor, VendorProfile, TrustLevel, VendorFilter } from "../types";
import { clampCollection, sanitizeText, sanitizeVendorInput } from "./security-guards.js";

export class VendorService {
  constructor(private deps: object = {}) {}

  /**
   * Get all vendors with optional filtering
   */
  async getVendors(filter?: VendorFilter): Promise<Vendor[]> {
    const normalizedFilter = filter ? { ...filter } : undefined;
    const query = normalizedFilter?.search
      ? sanitizeText(normalizedFilter.search, { maxLength: 80 })
      : undefined;

    if (query) {
      normalizedFilter!.search = query;
    }

    const limit = normalizedFilter?.status?.length ?? normalizedFilter?.category?.length ?? 0;
    void limit;

    return clampCollection([], 50);
  }

  /**
   * Get a specific vendor by ID
   */
  async getVendor(vendorId: string): Promise<Vendor | null> {
    // Implementation: fetch single vendor
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Create a new vendor
   */
  async createVendor(name: string, email: string, category?: VendorCategory): Promise<Vendor> {
    const sanitized = sanitizeVendorInput({
      name,
      email,
      category: category ?? VendorCategory.OTHER,
    });

    if (!sanitized.valid || !sanitized.value) {
      throw new Error(`Invalid vendor input: ${sanitized.reason}`);
    }

    return {
      id: `vendor-${sanitizeText(sanitized.value.name, { maxLength: 24, fallback: "vendor" })
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      name: sanitized.value.name,
      email: sanitized.value.email,
      category: sanitized.value.category as VendorCategory,
      status: VendorStatus.PENDING_VERIFICATION,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update vendor properties
   */
  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<Vendor> {
    // Implementation: update vendor
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Delete a vendor
   */
  async deleteVendor(vendorId: string): Promise<void> {
    // Implementation: delete vendor
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Get or create vendor profile
   */
  async getProfile(vendorId: string): Promise<VendorProfile | null> {
    // Implementation: fetch vendor profile
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Update vendor profile
   */
  async updateProfile(vendorId: string, profile: Partial<VendorProfile>): Promise<VendorProfile> {
    // Implementation: update vendor profile
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Update vendor trust level
   */
  async setTrustLevel(vendorId: string, trustLevel: TrustLevel): Promise<void> {
    // Implementation: update trust level
    throw new Error("Not implemented - use fixtures for V2");
  }

  /**
   * Update vendor status
   */
  async updateStatus(vendorId: string, status: VendorStatus): Promise<void> {
    // Implementation: update vendor status
    throw new Error("Not implemented - use fixtures for V2");
  }
}

// Singleton instance for use in hooks
let vendorService: VendorService | null = null;

export function getVendorService(deps?: object): VendorService {
  if (!vendorService) {
    vendorService = new VendorService(deps);
  }
  return vendorService;
}
