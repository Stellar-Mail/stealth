export interface VerifyAccessRequest {
  requesterEmail: string;
  role: string;
  accessLevel: string;
  threadId: string;
}

export interface AccessCheckLog {
  id: string;
  request: VerifyAccessRequest;
  isAllowed: boolean;
  error?: string;
  timestamp: string;
}

export interface AccessPolicy {
  [role: string]: string[];
}

export interface LimitVerificationResult {
  teamSizeValid: boolean;
  teamSizeError?: string;
  attachmentCountValid: boolean;
  attachmentCountError?: string;
}
