export interface SampleEmail {
  label: string;
  raw: string;
  expectedContactCount: number;
}

export const SAMPLE_EMAILS: SampleEmail[] = [
  {
    label: "single-contact-header",
    raw: `From: "Alice Johnson" <alice@example.com>
To: bob@example.com
Subject: Meeting Tomorrow

Hi Bob,

Looking forward to our meeting tomorrow.

Best,

--
Alice Johnson
Acme Corp
(555) 123-4567
alice@example.com`,
    expectedContactCount: 1,
  },
  {
    label: "multiple-contacts-body",
    raw: `From: "Carol Smith" <carol@example.com>
To: dave@example.com
Subject: Team Update

Hi Dave,

Please coordinate with Eve Wilson (eve@example.com) and Frank Brown (frank@example.net) about the project timeline.

Also, Gina Martinez from Initech (gina@initech.com) will join the next sprint.

Best,

--
Carol Smith
(555) 987-6543
carol@example.com`,
    expectedContactCount: 4,
  },
  {
    label: "no-contacts",
    raw: `From: No Reply
To: subscriber
Subject: Monthly Digest

Here is your monthly digest of articles.
Read more at our website.

Thank you,
The Team`,
    expectedContactCount: 0,
  },
  {
    label: "malformed-header",
    raw: `From: incomplete-address
To: user@example.com
Subject: Missing Details

Hello,

This message has a malformed From header.

Regards,
Sender`,
    expectedContactCount: 0,
  },
  {
    label: "duplicate-contacts",
    raw: `From: "Henry Lee" <henry@example.com>
To: user@example.com
Subject: Follow Up

Hi,

As discussed, Henry Lee (henry@example.com) will handle the design work.

Also, reach out to henry@example.com for the assets.

Best,

--
Henry Lee
Design Studio
henry@example.com`,
    expectedContactCount: 1,
  },
  {
    label: "phone-and-org-in-signature",
    raw: `From: "Iris Chen" <iris@acmecorp.com>
To: user@example.com
Subject: Proposal

Dear User,

Please find the proposal attached.

Warm regards,

--
Iris Chen
Senior Engineer, Acme Corp
+1 (555) 333-2222
iris@acmecorp.com`,
    expectedContactCount: 1,
  },
];
