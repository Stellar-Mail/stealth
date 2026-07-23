import { detectDeadlines } from '../services/detector';
import { sanitizeEmailInput, MAX_EMAIL_BODY_LENGTH } from '../security/guards';

describe('Deadline Detector Hardening (#482)', () => {
  it('truncates oversized input exceeding maximum length', () => {
    const hugeInput = 'a'.repeat(MAX_EMAIL_BODY_LENGTH + 1000);
    const sanitized = sanitizeEmailInput(hugeInput);
    expect(sanitized.length).toBe(MAX_EMAIL_BODY_LENGTH);
  });

  it('strips malicious script tags from email body', () => {
    const maliciousInput = 'Please complete task by Friday <script>alert("xss")</script>';
    const sanitized = sanitizeEmailInput(maliciousInput);
    expect(sanitized).not.toContain('<script>');
  });

  it('skips non-temporal emails quickly without running heavy matchers', () => {
    const emails = [
      { id: '1', body: 'Just wanted to say hello and see how you are doing.' },
      { id: '2', body: 'Project report is due on Friday afternoon.' }
    ];

    const results = detectDeadlines(emails);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].emailId).toBe('2');
  });
});

