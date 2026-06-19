# Schedule Send Test Plan

## Goals

- Verify schedule review behavior before any future mail queue integration.
- Validate timezone and daylight-saving handling.
- Confirm user intent before queue mutation or send behavior.
- Keep implementation and documentation inside the V1 individual tool folder.

## Automated Cases

1. Future one-time schedule
   - Given a draft, recipients, timezone, and future local time.
   - Expect `ready-for-confirmation` with a normalized UTC timestamp.

2. Past-time rejection
   - Given a local scheduled time earlier than the current clock.
   - Expect a blocking warning and no `ready-for-confirmation` status.

3. Timezone display
   - Given `Pacific/Auckland` and a future local time.
   - Expect the timezone label and UTC conversion to be visible in the model.

4. Daylight-saving ambiguous time
   - Given a time that repeats during DST fallback.
   - Expect an ambiguity warning and manual review requirement.

5. Missing recipients
   - Given a draft without recipients.
   - Expect a blocking warning before confirmation.

6. Multiple recipients
   - Given to, cc, and bcc values.
   - Expect all recipient groups to be counted and reviewable.

7. Cancel scheduled draft
   - Given an existing schedule record.
   - Expect cancel action to move status to `cancelled` without sending.

8. Edit scheduled time
   - Given an existing schedule record and a new valid time.
   - Expect updated local and UTC times plus a new confirmation requirement.

## Manual Review Checklist

- Confirm the UI never sends or queues an email on page load.
- Confirm confirm/edit/cancel controls are keyboard reachable.
- Confirm warning copy includes the selected timezone.
- Confirm recipient details are visible before confirmation.
- Confirm fixtures do not contain real customer email addresses.

## Regression Expectations

- Adding recurrence requires at least one daily, weekly, and invalid recurrence
  fixture.
- Adding a queue integration requires tests for queue success, queue failure,
  retry, and cancellation race behavior.
- Any future Gmail/SMTP integration must keep explicit confirmation before send.
