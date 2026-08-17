# Task Extractor — Usage Guide

Practical examples and usage patterns for the Task Extractor tool.

## Table of Contents

- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "msg-001",
  subject: "Project kickoff",
  body: "Please review the proposal and send feedback by Friday.",
  receivedAt: "2026-07-03T10:00:00.000Z",
});

if (outcome.status === "ok") {
  console.log(`Found ${outcome.result.tasks.length} tasks`);
  outcome.result.tasks.forEach((task) => {
    console.log(`- ${task.text} (${task.confidence} confidence)`);
  });
} else {
  console.error(`Error: ${outcome.message}`);
}
```

## Basic Usage

### Extracting from Email Body

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "email-12345",
  subject: "Weekly tasks",
  body: `
    Hi team,
    
    Before next Monday:
    - [ ] Update the project roadmap
    - [ ] Schedule Q3 planning meeting
    - Review the budget proposal
    
    Please send your availability by Friday.
  `,
  receivedAt: "2026-07-01T09:00:00.000Z",
});

if (outcome.status === "ok") {
  // outcome.result.tasks contains:
  // - "Update the project roadmap" (checkbox, high confidence)
  // - "Schedule Q3 planning meeting" (checkbox, high confidence)
  // - "send your availability by Friday" (request-phrase, high confidence)
  // Note: "Review the budget proposal" is NOT extracted (no trigger word at start)
}
```

### Using Options

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks(
  {
    messageId: "msg-002",
    subject: "Action items",
    body: "Please review, approve, and send the contract.",
  },
  {
    maxTasks: 5, // Limit to 5 tasks
    minConfidence: "high", // Only high-confidence tasks
  },
);
```

### Handling Errors

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "msg-003",
  subject: "",
  body: "", // Empty content
});

if (outcome.status === "error") {
  console.error(`Error code: ${outcome.code}`);
  console.error(`Message: ${outcome.message}`);

  outcome.issues.forEach((issue) => {
    console.error(`- ${issue.field}: ${issue.message}`);
  });
}
```

## Advanced Usage

### Working with Priorities

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "msg-004",
  body: `
    URGENT: Please fix the production bug ASAP.
    Please update the wiki when you get a chance.
    Please review the PR.
  `,
});

if (outcome.status === "ok") {
  const highPriority = outcome.result.tasks.filter((t) => t.priority === "high");
  const lowPriority = outcome.result.tasks.filter((t) => t.priority === "low");
  const normal = outcome.result.tasks.filter((t) => t.priority === "normal");

  console.log(`High priority: ${highPriority.length}`);
  console.log(`Normal: ${normal.length}`);
  console.log(`Low priority: ${lowPriority.length}`);
}
```

### Working with Due Dates

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks({
  messageId: "msg-005",
  body: `
    - [ ] Submit report by 2026-07-15
    - [ ] Review deck by tomorrow
    - [ ] Send notes by Friday
  `,
  receivedAt: "2026-07-10T10:00:00.000Z",
});

if (outcome.status === "ok") {
  outcome.result.tasks.forEach((task) => {
    if (task.dueAtHint) {
      console.log(`${task.text} — Due: ${task.dueAtHint}`);
    } else if (task.dueTextHint) {
      console.log(`${task.text} — Due: ${task.dueTextHint} (not resolved)`);
    }
  });

  // Output:
  // Submit report — Due: 2026-07-15
  // Review deck — Due: 2026-07-11 (tomorrow resolved)
  // Send notes — Due: friday (not resolved)
}
```

### Filtering by Confidence

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

// Extract all tasks
const allTasks = safeExtractTasks({
  messageId: "msg-006",
  body: `
    - [ ] High confidence checkbox
    - Review medium confidence bullet
    Send low confidence imperative
  `,
});

// Extract only high-confidence tasks
const highConfOnly = safeExtractTasks(
  {
    messageId: "msg-006",
    body: `
      - [ ] High confidence checkbox
      - Review medium confidence bullet
      Send low confidence imperative
    `,
  },
  { minConfidence: "high" },
);

if (allTasks.status === "ok" && highConfOnly.status === "ok") {
  console.log(`All tasks: ${allTasks.result.tasks.length}`);
  console.log(`High confidence only: ${highConfOnly.result.tasks.length}`);
}
```

### Analyzing Statistics

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

const outcome = safeExtractTasks(
  {
    messageId: "msg-007",
    body: `
      Please review the document.
      Please review the document.
      Please send the notes.
      Please book the room.
      Please call the client.
    `,
  },
  { maxTasks: 3 },
);

if (outcome.status === "ok") {
  const { stats } = outcome.result;

  console.log(`Lines processed: ${stats.lineCount}`);
  console.log(`Candidates found: ${stats.candidateCount}`);
  console.log(`Tasks extracted: ${stats.extractedCount}`);
  console.log(`Truncated: ${stats.truncated}`);

  // Output:
  // Lines processed: 5
  // Candidates found: 5
  // Tasks extracted: 3
  // Truncated: true
  // Note: One duplicate was removed, then truncated to 3
}
```

### Using Pre-Validated Input

If you've already validated input, use the pure engine directly:

```typescript
import { extractTasks } from "tools/v2/individual/task-extractor";
import type { TaskExtractionInput } from "tools/v2/individual/task-extractor";

// Only use this if you're certain input is valid and sanitized
const input: TaskExtractionInput = {
  messageId: "msg-008",
  subject: "Tasks",
  body: "Please review the document.",
};

// Pure engine - no validation, no error wrapping
const result = extractTasks(input);

// result.tasks is always an array (might be empty)
console.log(`Found ${result.tasks.length} tasks`);
```

## Real-World Examples

### API Handler

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

export async function handleExtractTasksRequest(req: Request): Promise<Response> {
  const payload = await req.json();

  const outcome = safeExtractTasks(payload);

  if (outcome.status === "error") {
    return new Response(
      JSON.stringify({
        error: outcome.code,
        message: outcome.message,
        issues: outcome.issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify(outcome.result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### Message Queue Consumer

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  from: string;
  receivedAt: string;
}

async function processEmailQueue(messages: EmailMessage[]) {
  for (const email of messages) {
    const outcome = safeExtractTasks({
      messageId: email.id,
      subject: email.subject,
      body: email.body,
      senderAddress: email.from,
      receivedAt: email.receivedAt,
      language: "en",
    });

    if (outcome.status === "ok") {
      const { tasks } = outcome.result;

      if (tasks.length > 0) {
        await saveTasksToDatabase(email.id, tasks);
        await sendNotification(email.from, tasks.length);
      }
    } else {
      console.error(`Failed to extract tasks from ${email.id}: ${outcome.message}`);
    }
  }
}
```

### Task Dashboard

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

interface TaskSummary {
  total: number;
  byPriority: { high: number; normal: number; low: number };
  byConfidence: { high: number; medium: number; low: number };
  withDueDates: number;
}

function summarizeTasks(messageId: string, body: string): TaskSummary | null {
  const outcome = safeExtractTasks({
    messageId,
    subject: "",
    body,
    receivedAt: new Date().toISOString(),
  });

  if (outcome.status === "error") {
    return null;
  }

  const { tasks } = outcome.result;

  return {
    total: tasks.length,
    byPriority: {
      high: tasks.filter((t) => t.priority === "high").length,
      normal: tasks.filter((t) => t.priority === "normal").length,
      low: tasks.filter((t) => t.priority === "low").length,
    },
    byConfidence: {
      high: tasks.filter((t) => t.confidence === "high").length,
      medium: tasks.filter((t) => t.confidence === "medium").length,
      low: tasks.filter((t) => t.confidence === "low").length,
    },
    withDueDates: tasks.filter((t) => t.dueAtHint || t.dueTextHint).length,
  };
}
```

### Batch Processing

```typescript
import { safeExtractTasks } from "tools/v2/individual/task-extractor";

interface EmailBatch {
  messages: Array<{
    id: string;
    subject: string;
    body: string;
    receivedAt: string;
  }>;
}

async function processBatch(batch: EmailBatch) {
  const results = batch.messages.map((msg) => {
    const outcome = safeExtractTasks({
      messageId: msg.id,
      subject: msg.subject,
      body: msg.body,
      receivedAt: msg.receivedAt,
    });

    return {
      messageId: msg.id,
      success: outcome.status === "ok",
      taskCount: outcome.status === "ok" ? outcome.result.tasks.length : 0,
      error: outcome.status === "error" ? outcome.code : null,
    };
  });

  const successful = results.filter((r) => r.success).length;
  const totalTasks = results.reduce((sum, r) => sum + r.taskCount, 0);

  console.log(`Processed ${batch.messages.length} messages`);
  console.log(`Successful: ${successful}`);
  console.log(`Total tasks: ${totalTasks}`);

  return results;
}
```

## Best Practices

### 1. Always Use the Safe Entry Point for Untrusted Input

```typescript
// ✅ GOOD: Use safeExtractTasks for external/user input
const outcome = safeExtractTasks(userInput);

// ❌ BAD: Don't use extractTasks directly for untrusted input
const result = extractTasks(userInput); // Might throw or produce undefined behavior
```

### 2. Check Status Before Accessing Results

```typescript
// ✅ GOOD: Check status discriminator
if (outcome.status === "ok") {
  processTask(outcome.result.tasks);
} else {
  handleError(outcome.code, outcome.message);
}

// ❌ BAD: Don't assume success
const tasks = outcome.result.tasks; // Type error if status is "error"
```

### 3. Provide receivedAt for Relative Dates

```typescript
// ✅ GOOD: Provide receivedAt to resolve "today", "tomorrow"
safeExtractTasks({
  messageId: "msg-001",
  body: "Please submit by tomorrow",
  receivedAt: new Date().toISOString(),
});

// ⚠️ LIMITED: Without receivedAt, relative dates stay as text
safeExtractTasks({
  messageId: "msg-001",
  body: "Please submit by tomorrow",
  // "tomorrow" will be in dueTextHint, not dueAtHint
});
```

### 4. Use Options to Tune Results

```typescript
// For high-precision use cases
safeExtractTasks(input, { minConfidence: "high" });

// For comprehensive extraction
safeExtractTasks(input, { minConfidence: "low", maxTasks: 50 });

// For previews/summaries
safeExtractTasks(input, { maxTasks: 3, minConfidence: "medium" });
```

### 5. Handle Empty Task Lists Gracefully

```typescript
const outcome = safeExtractTasks(input);

if (outcome.status === "ok") {
  if (outcome.result.tasks.length === 0) {
    console.log("No tasks found in this message");
  } else {
    processTasks(outcome.result.tasks);
  }
}
```

### 6. Don't Rely on stats.lineCount for Business Logic

```typescript
// ⚠️ AVOID: lineCount is for diagnostics, not business rules
if (outcome.result.stats.lineCount > 100) {
  // Don't make decisions based on line count
}

// ✅ GOOD: Use extracted task count
if (outcome.result.tasks.length > 10) {
  console.log("This message has many tasks");
}
```

## Troubleshooting

### No Tasks Extracted

**Problem**: `outcome.result.tasks` is empty even though text looks like tasks.

**Solutions**:

1. Check if text starts with trigger patterns (checkbox, "please", action verb)
2. Verify text isn't mid-sentence: "The team will review" (won't match)
3. Check confidence level: Low-confidence tasks might be filtered
4. Look at `stats.candidateCount`: If 0, no patterns matched

### Relative Dates Not Resolving

**Problem**: "tomorrow" stays as `dueTextHint` instead of resolving to a date.

**Solution**: Provide `receivedAt` in ISO 8601 format:

```typescript
safeExtractTasks({
  messageId: "msg",
  body: "Please finish by tomorrow",
  receivedAt: "2026-07-10T10:00:00.000Z", // Required for resolution
});
```

### "empty-content" Error

**Problem**: Getting `empty-content` error even with text present.

**Solutions**:

1. Check if text contains only whitespace or control characters
2. Verify both subject and body aren't empty
3. Run through sanitization to see what remains

### Task Text Truncated

**Problem**: Long task descriptions are cut off.

**Explanation**: Task text is limited to 200 characters and cut at word boundaries. This is intentional to prevent extremely long task descriptions.

**Solution**: Keep task descriptions concise in source content, or parse long text separately.

### Unexpected Priority

**Problem**: Tasks marked as "high" priority unexpectedly.

**Explanation**: Priority detection looks at both task text and context line. Words like "urgent", "asap", "critical" anywhere on the line trigger high priority.

**Solution**: Review the `contextLine` or split urgent tasks to separate lines.

### Language Not Supported

**Problem**: Getting `unsupported-language` error.

**Explanation**: Only English (`en` or `en-*`) is supported.

**Solution**: Remove `language` field or set to `"en"` or `"en-US"`, etc.

### Input Too Large

**Problem**: Getting `input-too-large` error.

**Explanation**: Limits are enforced to prevent abuse:

- messageId: 256 chars
- subject: 500 chars
- body: 50,000 chars or 10,000 words

**Solution**: Truncate or chunk input before extraction, or increase limits in `guards.ts` if appropriate.

---

For more details, see:

- [contract.md](./contract.md) — Full API reference
- [TESTING.md](./TESTING.md) — Testing guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
