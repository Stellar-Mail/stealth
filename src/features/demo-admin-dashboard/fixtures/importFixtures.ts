export const validImportJson = JSON.stringify({
  id: "import-v1",
  name: "Imported Demo",
  description: "Dataset imported via JSON.",
  messages: [
    {
      id: "msg-001",
      threadId: "t-001",
      subject: "Hello from Import",
      snippet: "Imported snippet",
      body: "Imported body",
      sender: {
        address: "admin@stealth.demo",
        name: "Admin",
        isTrusted: true,
      },
      recipients: ["user@example.com"],
      date: "2024-01-01T10:00:00Z",
      isRead: true,
      isStarred: false,
      labels: ["inbox"],
      attachments: [],
    },
  ],
});

export const invalidImportJson = JSON.stringify({
  id: "import-bad",
  name: "", // Too short
  messages: [
    {
      id: "msg-001",
      // Missing subject
      sender: {
        address: "unsafe@external.com", // Unsafe domain
        isTrusted: true,
      },
      recipients: [], // Empty recipients
      date: "not-a-date", // Invalid date
    },
  ],
});

export const malformedJson = "{ invalid: json }";
