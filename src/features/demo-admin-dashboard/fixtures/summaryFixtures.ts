import type { DemoDataset } from "../types/dataset";

export const validDatasetFixture: DemoDataset = {
  id: "valid-v1",
  name: "Perfect Demo",
  description: "A dataset with no validation issues.",
  messages: [
    {
      id: "msg-001",
      threadId: "t-001",
      subject: "Welcome",
      snippet: "Safe snippet",
      body: "Safe body",
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
  senders: [
    {
      address: "admin@stealth.demo",
      name: "Admin",
      isTrusted: true,
    },
  ],
};

export const invalidDatasetFixture: DemoDataset = {
  id: "invalid-v1",
  name: "Broken Demo",
  description: "A dataset with multiple validation issues.",
  messages: [
    {
      id: "msg-bad-001",
      threadId: "t-bad",
      subject: "", // Empty subject
      snippet: "Bad message",
      body: "This message has issues.",
      sender: {
        address: "realuser@gmail.com", // Unsafe sender domain
        name: "Real User",
        isTrusted: false,
      },
      recipients: ["someone@yahoo.com"], // Unsafe recipient domain
      date: "2024-01-01T10:00:00Z",
      isRead: false,
      isStarred: true,
      labels: [],
      attachments: [
        {
          id: "att-1",
          filename: "malware.exe",
          contentType: "application/octet-stream",
          sizeBytes: 1024 * 1024,
          url: "http://unsafe.com/file",
        },
      ],
    },
  ],
  senders: [
    {
      address: "noname@example.com",
      // Missing name
      isTrusted: false,
    },
  ],
};
