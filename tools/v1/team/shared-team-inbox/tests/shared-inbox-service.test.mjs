import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  MESSAGE_STATUSES,
  SharedInboxError,
  createSharedInboxService,
  normalizeMessage,
} from "../index.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-shared-inbox.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("normalizes valid shared inbox messages", async () => {
  const fixture = await loadFixture();
  const message = normalizeMessage(fixture.messages[0]);

  assert.equal(message.id, "msg-001");
  assert.equal(message.status, "unassigned");
  assert.equal(message.assignee, null);
  assert.deepEqual(message.comments, []);
  assert.deepEqual(message.replies, []);
});

test("rejects malformed message fixtures", async () => {
  const fixture = await loadFixture();

  for (const invalidMessage of fixture.invalidMessages) {
    assert.throws(() => normalizeMessage(invalidMessage), SharedInboxError);
  }
});

test("ingests messages and skips duplicate delivery proofs", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });

  const first = service.ingestMessage(fixture.messages[0]);
  const duplicate = service.ingestMessage(fixture.duplicateMessage);

  assert.equal(first.status, "stored");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.message.id, "msg-001");
  assert.equal(service.listMessages().messages.length, 1);
});

test("lists messages newest first and filters by status", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });

  for (const message of fixture.messages) {
    service.ingestMessage(message);
  }

  const all = service.listMessages().messages;
  assert.deepEqual(
    all.map((message) => message.id),
    ["msg-002", "msg-001"],
  );

  service.claimMessage("msg-001", "alice@example.test");
  assert.deepEqual(
    service.listMessages({ status: "claimed" }).messages.map((message) => message.id),
    ["msg-001"],
  );
});

test("claims and releases messages for team members", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  const claimed = service.claimMessage("msg-001", "alice@example.test", "Taking this one");
  assert.equal(claimed.status, "claimed");
  assert.equal(claimed.assignee, "alice@example.test");

  const released = service.releaseMessage("msg-001", "alice@example.test");
  assert.equal(released.status, "unassigned");
  assert.equal(released.assignee, null);
});

test("rejects actors outside the team roster", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  assert.throws(
    () => service.claimMessage("msg-001", "outsider@example.test"),
    SharedInboxError,
  );
});

test("enforces documented status transitions", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  assert.throws(
    () => service.updateStatus("msg-001", "alice@example.test", "resolved"),
    SharedInboxError,
  );

  service.claimMessage("msg-001", "alice@example.test");
  const inProgress = service.updateStatus("msg-001", "alice@example.test", "in-progress");
  assert.equal(inProgress.status, "in-progress");
});

test("adds internal comments as team-only records", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  const comment = service.addInternalComment("msg-001", "bob@example.test", "Known issue.");
  assert.equal(comment.author, "bob@example.test");
  assert.equal(comment.visibility, "team-only");
  assert.equal(comment.deleted, false);

  assert.throws(() => service.addInternalComment("msg-001", "bob@example.test", ""), SharedInboxError);
});

test("sends local reply records only after claim", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  assert.throws(
    () => service.sendReply("msg-001", "alice@example.test", "Thanks for writing in."),
    SharedInboxError,
  );

  service.claimMessage("msg-001", "alice@example.test");
  const reply = service.sendReply("msg-001", "alice@example.test", "Thanks for writing in.");
  assert.equal(reply.from, "support@example.test");
  assert.equal(reply.to, "customer.one@example.test");
  assert.equal(service.listMessages({ status: "resolved" }).messages.length, 1);
});

test("state snapshots are cloned", async () => {
  const fixture = await loadFixture();
  const service = createSharedInboxService({ teamMembers: fixture.teamMembers });
  service.ingestMessage(fixture.messages[0]);

  const snapshot = service.getState();
  snapshot.messages[0].subject = "mutated";

  assert.equal(service.getState().messages[0].subject, "Login help");
});

test("exports expected status values", () => {
  assert.deepEqual(MESSAGE_STATUSES, [
    "unassigned",
    "claimed",
    "in-progress",
    "awaiting-reply",
    "resolved",
  ]);
});
