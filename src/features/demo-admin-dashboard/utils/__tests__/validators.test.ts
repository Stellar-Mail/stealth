import { validateDemoDataset } from '../validators';
import { DemoDataValidationError, formatValidationErrors } from '../validation-errors';

describe('Demo Dataset Validators', () => {
  it('should accept a valid demo dataset', () => {
    const validData = {
      version: '1.0.0',
      emails: [
        {
          id: 'msg_001',
          subject: 'Test Email',
          sender: 'demo@stellar-mail.fake',
          body: 'Hello world'
        }
      ]
    };

    expect(() => validateDemoDataset(validData)).not.toThrow();
    const result = validateDemoDataset(validData);
    expect(result.version).toBe('1.0.0');
  });

  it('should reject malformed structures and aggregate errors', () => {
    const invalidData = {
      version: '1', // Invalid semver
      emails: [
        {
          id: '', // Empty ID
          subject: 123, // Should be string
          sender: 'not-an-email', // No @ symbol
          // missing body
        }
      ]
    };

    try {
      validateDemoDataset(invalidData);
      fail('Should have thrown DemoDataValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(DemoDataValidationError);
      const e = error as DemoDataValidationError;
      
      expect(e.issues).toContain("Missing or invalid 'version' (expected semantic version string like '1.0.0').");
      expect(e.issues).toContain("Email at index 0 has missing or invalid 'id'.");
      expect(e.issues).toContain("Email at index 0 has missing or invalid 'subject'.");
      expect(e.issues).toContain("Email at index 0 has missing or invalid 'sender' email address.");
      expect(e.issues).toContain("Email at index 0 has missing or invalid 'body'.");
    }
  });

  it('should format errors correctly', () => {
    const issues = ['Error 1', 'Error 2'];
    const formatted = formatValidationErrors(issues);
    expect(formatted).toBe('Validation failed with 2 issue(s):\n  1. Error 1\n  2. Error 2');
  });
});
