import { DealLeadTrackerInput } from "./contract";

export const successFixture: DealLeadTrackerInput = {
  emailId: "msg_12345",
  senderAddress: "sales@example.com",
  recipientAddress: "inbox@company.com",
  subject: "New enterprise deal inquiry",
  contentBody: "Hi, we are interested in a new deal for 500 licenses.",
  receivedAt: new Date("2026-07-18T10:00:00Z"),
};

export const failureFixtureMissingInput: Partial<DealLeadTrackerInput> = {
  emailId: "msg_12346",
  // missing senderAddress and contentBody to trigger validation failure
};

export const dealLeadFixtures = {
  success: successFixture,
  failure: failureFixtureMissingInput,
};
