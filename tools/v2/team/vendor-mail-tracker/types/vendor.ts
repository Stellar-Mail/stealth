// Vendor entity types and profiles

export interface Vendor {
  id: string;
  name: string;
  email: string;
  domain?: string;
  category?: VendorCategory;
  status: VendorStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum VendorCategory {
  EMAIL_SERVICE = "email-service",
  COMMUNICATION = "communication",
  BUSINESS = "business",
  MARKETPLACE = "marketplace",
  OTHER = "other",
}

export enum VendorStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
  PENDING_VERIFICATION = "pending-verification",
}

export interface VendorProfile {
  vendorId: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  trustedLevel: TrustLevel;
  customFields?: Record<string, unknown>;
}

export enum TrustLevel {
  UNKNOWN = "unknown",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  VERIFIED = "verified",
}

export interface VendorFilter {
  status?: VendorStatus[];
  category?: VendorCategory[];
  trustLevel?: TrustLevel[];
  search?: string;
}
