import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-contact-emails.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("sample contact extraction fixture follows the local review contract", async () => {
  const fixture = await loadFixture();

  assert.equal(fixture.tool, "contact-extractor");
  assert.equal(fixture.version, 1);
  assert.ok(Array.isArray(fixture.sourceRequests), "sourceRequests must be an array");
  assert.ok(fixture.sourceRequests.length >= 3, "fixture should include success and error cases");

  const stateSet = new Set(fixture.uiStates);
  for (const state of ["empty", "loading", "error", "success"]) {
    assert.ok(stateSet.has(state), `fixture must document ${state} UI state`);
  }

  const accessibilitySet = new Set(fixture.accessibilityChecks);
  for (const check of [
    "visible-label-for-email-text",
    "aria-live-status-region",
    "role-alert-for-errors",
    "labelled-contact-checkboxes",
    "visible-focus-styles",
    "keyboard-accessible-buttons",
  ]) {
    assert.ok(accessibilitySet.has(check), `fixture must document ${check}`);
  }

  for (const request of fixture.sourceRequests) {
    assert.ok(request.id, "request needs an id");
    assert.ok(request.sourceLabel, `${request.id} needs a sourceLabel`);
    assert.ok(typeof request.subject === "string", `${request.id} subject must be a string`);
    assert.ok(typeof request.from === "string", `${request.id} from must be a string`);
    assert.ok(typeof request.body === "string", `${request.id} body must be a string`);

    if (request.expectedContacts) {
      assert.ok(
        Array.isArray(request.expectedContacts),
        `${request.id} expectedContacts must be an array`,
      );
      assert.ok(request.expectedContacts.length > 0, `${request.id} should include expected contacts`);

      for (const contact of request.expectedContacts) {
        assert.ok(contact.displayName, `${request.id} contact needs a displayName`);
        assert.match(contact.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, `${request.id} contact email must be valid`);
        assert.ok(contact.organization, `${request.id} contact should include organization context`);
      }
    }

    if (request.expectedError) {
      assert.equal(
        request.expectedError,
        "No contact details were found in the supplied email text.",
        `${request.id} should use the documented no-contact error`,
      );
    }
  }
});
