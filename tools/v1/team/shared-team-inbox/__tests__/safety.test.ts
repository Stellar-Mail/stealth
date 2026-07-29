import { validateSharedMessage } from '../utils/validation';
import { sanitizeMessageBody, sanitizeFilename } from '../utils/sanitization';
import { paginateInboxMessages, truncateLargeBody } from '../utils/performance';

describe('Shared Team Inbox Safety & Constraints (#447)', () => {
  describe('Input Validation', () => {
    it('rejects null or non-object inputs', () => {
      expect(validateSharedMessage(null).isValid).toBe(false);
      expect(validateSharedMessage('string').isValid).toBe(false);
    });

    it('rejects missing teamId or sender', () => {
      const invalid = { id: 'msg-1', body: 'hello' };
      expect(validateSharedMessage(invalid).isValid).toBe(false);
    });

    it('accepts valid raw message', () => {
      const validRaw = {
        id: 'msg-101',
        teamId: 'team-alpha',
        sender: 'alice@stellar.org',
        subject: 'Weekly Digest',
        body: 'Hello Team!',
        timestamp: 1785110000,
      };
      const result = validateSharedMessage(validRaw);
      expect(result.isValid).toBe(true);
      expect(result.data?.subject).toBe('Weekly Digest');
    });
  });

  describe('Sanitizer Utility', () => {
    it('strips inline script tags', () => {
      const hostile = 'Hello <script>alert("xss")</script> World';
      expect(sanitizeMessageBody(hostile)).toBe('Hello [REDACTED SCRIPT] World');
    });

    it('strips event handlers and javascript URIs', () => {
      const hostile = '<a href="javascript:alert(1)" onclick="steal()">Click me</a>';
      const sanitized = sanitizeMessageBody(hostile);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('javascript:');
    });

    it('sanitizes malicious filenames', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('.._.._.._etc_passwd');
    });
  });

  describe('Performance Safeguards', () => {
    it('enforces maximum pagination bounds of 50 items', () => {
      const dummyList = Array.from({ length: 120 }, (_, i) => ({
        id: `msg-${i}`,
        teamId: 'team-1',
        sender: 'test@example.com',
        subject: `Subj ${i}`,
        body: 'Body',
        timestamp: Date.now(),
        attachments: [],
      }));

      const page1 = paginateInboxMessages(dummyList, 1, 100); // requested 100
      expect(page1.items.length).toBe(50); // bounded to max 50
      expect(page1.hasMore).toBe(true);
    });

    it('truncates bodies exceeding character limits', () => {
      const hugeBody = 'A'.repeat(150000);
      const { text, isTruncated } = truncateLargeBody(hugeBody, 100000);
      expect(isTruncated).toBe(true);
      expect(text).toContain('[Content truncated for performance size limit]');
    });
  });
});
