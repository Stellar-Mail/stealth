// Custom error type for demo data validation
export class DemoDataValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super('Demo dataset validation failed');
    this.name = 'DemoDataValidationError';
    this.issues = issues;
  }
}

// Error formatter to make logs readable in the admin UI
export function formatValidationErrors(issues: string[]): string {
  if (issues.length === 0) return 'No validation errors.';
  
  const header = `Validation failed with ${issues.length} issue(s):\n`;
  const formattedIssues = issues.map((issue, index) => `  ${index + 1}. ${issue}`).join('\n');
  
  return header + formattedIssues;
}
