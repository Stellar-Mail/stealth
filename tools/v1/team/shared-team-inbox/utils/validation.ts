export interface RawSharedMessage {
  id: unknown;
  teamId: unknown;
  sender: unknown;
  subject: unknown;
  body: unknown;
  timestamp: unknown;
  attachments?: unknown;
}

export interface ValidatedSharedMessage {
  id: string;
  teamId: string;
  sender: string;
  subject: string;
  body: string;
  timestamp: number;
  attachments: Array<{
    id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
  }>;
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const MAX_SUBJECT_LENGTH = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Asserts structural and boundary safety for incoming shared team inbox messages.
 */
export function validateSharedMessage(input: unknown): { isValid: boolean; data?: ValidatedSharedMessage; error?: string } {
  if (!input || typeof input !== 'object') {
    return { isValid: false, error: 'Input must be a non-null object' };
  }

  const raw = input as RawSharedMessage;

  if (typeof raw.id !== 'string' || raw.id.trim() === '') {
    return { isValid: false, error: 'Invalid or missing message ID' };
  }

  if (typeof raw.teamId !== 'string' || raw.teamId.trim() === '') {
    return { isValid: false, error: 'Invalid or missing team ID' };
  }

  if (typeof raw.sender !== 'string' || (!EMAIL_REGEX.test(raw.sender) && !raw.sender.startsWith('G'))) {
    return { isValid: false, error: 'Invalid sender format (must be valid email or Stellar public key)' };
  }

  const subject = typeof raw.subject === 'string' ? raw.subject.slice(0, MAX_SUBJECT_LENGTH) : '(No Subject)';

  if (typeof raw.body !== 'string') {
    return { isValid: false, error: 'Message body must be a string' };
  }

  if (Buffer.byteLength(raw.body, 'utf8') > MAX_BODY_BYTES) {
    return { isValid: false, error: `Body size exceeds maximum threshold of ${MAX_BODY_BYTES} bytes` };
  }

  const timestamp = typeof raw.timestamp === 'number' && !isNaN(raw.timestamp) ? raw.timestamp : Date.now();

  const attachments: ValidatedSharedMessage['attachments'] = [];
  if (Array.isArray(raw.attachments)) {
    for (const att of raw.attachments) {
      if (att && typeof att === 'object') {
        const a = att as Record<string, unknown>;
        if (typeof a.id === 'string' && typeof a.filename === 'string' && typeof a.sizeBytes === 'number') {
          attachments.push({
            id: a.id,
            filename: String(a.filename).slice(0, 255),
            sizeBytes: Math.max(0, a.sizeBytes),
            mimeType: typeof a.mimeType === 'string' ? a.mimeType : 'application/octet-stream',
          });
        }
      }
    }
  }

  return {
    isValid: true,
    data: {
      id: raw.id,
      teamId: raw.teamId,
      sender: raw.sender,
      subject,
      body: raw.body,
      timestamp,
      attachments,
    },
  };
}
