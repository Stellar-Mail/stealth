# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: policy-editing.spec.ts >> policy editing >> switches to Inbox control tab and changes unknown-sender policy
- Location: tests\e2e\policy-editing.spec.ts:17:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Settings' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Settings' })

```

```yaml
- text: "Demo Mode: Showing placeholder data."
- complementary:
  - text: STEALTH mail protocol
  - button "Toggle sidebar"
  - button "Compose Ctrl+N"
  - navigation:
    - list:
      - listitem:
        - button "All Mail 16"
      - listitem:
        - button "Inbox 9"
      - listitem:
        - button "Priority 1"
      - listitem:
        - button "Snoozed 1"
      - listitem:
        - button "Starred 3"
      - listitem:
        - button "Drafts 1"
      - listitem:
        - button "Sent 1"
    - text: Protocol
    - list:
      - listitem:
        - button "Verified 1"
      - listitem:
        - button "Pending Proof 1"
      - listitem:
        - button "Requests 3"
      - listitem:
        - button "Encrypted 1"
    - text: Delivery
    - list:
      - listitem:
        - button "Receipts 1"
      - listitem:
        - button "Outbox 1"
      - listitem:
        - button "Scheduled 1"
    - text: Storage
    - list:
      - listitem:
        - button "Archive 1"
      - listitem:
        - button "Spam 1"
      - listitem:
        - button "Trash 1"
    - text: Folders
    - button
    - list:
      - listitem:
        - button "Clients"
      - listitem:
        - button "Investors"
      - listitem:
        - button "Personal"
  - text: EN Uthaimin kryputh@stealth.me
- separator
- banner:
  - textbox "Search messages, people, proofs, attachments..."
  - button "K"
  - button "Proofs": "2"
  - button "Later": "5"
  - button "Files": "9"
  - button "Filter"
  - button "Notifications"
  - button "Import contacts"
  - button "Help": "?"
  - button "Proof Inspector": I
  - button "Settings": ","
  - button "Personal"
- heading "Inbox" [level=2]
- paragraph: 9 conversations
- button "all"
- button "unread"
- button "flagged"
- listbox:
  - listitem:
    - checkbox "Select all visible messages"
    - button "Select all"
    - text: 9 conversations Ctrl/⌘+A · Esc
  - listitem:
    - 'checkbox "Select Lina Park: Q2 brand system - final direction"'
    - button "Lina Park Lina Park Verified 9:42 AM Q2 brand system - final direction":
      - img "Lina Park"
      - text: Lina Park Verified 9:42 AM Q2 brand system - final direction
  - listitem:
    - 'checkbox "Select TOKEN2049 Abu Dhabi: TOKEN2049 Abu Dhabi - founder pass ready"'
    - button "TOKEN2049 Abu Dhabi TOKEN2049 Abu Dhabi Verified 9:18 AM TOKEN2049 Abu Dhabi - founder pass ready":
      - img "TOKEN2049 Abu Dhabi"
      - text: TOKEN2049 Abu Dhabi Verified 9:18 AM TOKEN2049 Abu Dhabi - founder pass ready
  - listitem:
    - 'checkbox "Select Relay Node 07: Your relay verification code"'
    - button "Relay Node 07 Relay Node 07 Unknown 8:57 AM Your relay verification code":
      - img "Relay Node 07"
      - text: Relay Node 07 Unknown 8:57 AM Your relay verification code
  - listitem:
    - 'checkbox "Select Uthaimin Lawal: Investor update and postage policy"'
    - button "Uthaimin Lawal Uthaimin Lawal Unknown 8:23 AM Investor update and postage policy":
      - img "Uthaimin Lawal"
      - text: Uthaimin Lawal Unknown 8:23 AM Investor update and postage policy
  - listitem:
    - 'checkbox "Select Unknown Sender: Message request awaiting approval"'
    - button "Unknown Sender Unknown Sender Paid 7:48 AM Message request awaiting approval":
      - img "Unknown Sender"
      - text: Unknown Sender Paid 7:48 AM Message request awaiting approval
    - button "Review sender"
  - listitem:
    - 'checkbox "Select Stellar Fund: Grant application review"'
    - button "Stellar Fund Stellar Fund Verified Yesterday Grant application review":
      - img "Stellar Fund"
      - text: Stellar Fund Verified Yesterday Grant application review
    - button "Review sender"
  - listitem:
    - 'checkbox "Select Anonymous Trader: OTC offer for STEALTH tokens"'
    - button "Anonymous Trader Anonymous Trader Paid Yesterday OTC offer for STEALTH tokens":
      - img "Anonymous Trader"
      - text: Anonymous Trader Paid Yesterday OTC offer for STEALTH tokens
    - button "Review sender"
  - listitem:
    - 'checkbox "Select Nadia Reyes: Encrypted payload test"'
    - button "Nadia Reyes Nadia Reyes Verified Yesterday Encrypted payload test":
      - img "Nadia Reyes"
      - text: Nadia Reyes Verified Yesterday Encrypted payload test
  - listitem:
    - 'checkbox "Select Stealth Security: Your sign-in passkey"'
    - button "Stealth Security Stealth Security Unknown Just now Your sign-in passkey":
      - img "Stealth Security"
      - text: Stealth Security Unknown Just now Your sign-in passkey
- separator
- text: LP Lina Park Verified lina*vantage.studio
- button "Reply"
- button
- button
- button "Z"
- button "E"
- button "Move to trash"
- button "Unstar"
- article:
  - paragraph: Conversation
  - heading "Q2 brand system - final direction" [level=1]
  - text: Design Priority Stellar identity verified 01c7...9a9
  - button "Inspect provenance"
  - button "Copy proof"
  - text: Read receipt sent
  - paragraph: Hey,
  - paragraph: Sharing the refined exploration for the new identity. The monochrome system feels strongest across product surfaces. I've attached the latest spec sheet and the motion principles deck.
  - paragraph: Let me know your thoughts before Friday's review.
  - paragraph: Lina
  - text: 4 attachments vantage-identity-v3.pdf 4.2 MB brand-moodboard.png 1.8 MB release-notes.txt 1.2 KB motion-principles.key 12.1 MB
- separator
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures";
  2  | 
  3  | test.describe("policy editing", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.addInitScript(() => {
  6  |       localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
  7  |     });
  8  |     await page.goto("/");
  9  |   });
  10 | 
  11 |   async function openSettings(page: Parameters<typeof test>[1]) {
  12 |     // Settings button is an IconBtn labelled "Settings" in the topbar
  13 |     await page.getByRole("button", { name: "Settings" }).click();
> 14 |     await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
     |                                                                   ^ Error: expect(locator).toBeVisible() failed
  15 |   }
  16 | 
  17 |   test("switches to Inbox control tab and changes unknown-sender policy", async ({ page }) => {
  18 |     await openSettings(page);
  19 | 
  20 |     // Navigate to the Inbox control tab
  21 |     await page.getByRole("button", { name: "Inbox control" }).click();
  22 | 
  23 |     // Verify the section heading
  24 |     await expect(page.getByText("Inbox control", { exact: true })).toBeVisible();
  25 | 
  26 |     // Select "Verified only" policy
  27 |     await page.getByRole("button", { name: "Verified only" }).click();
  28 | 
  29 |     // Save
  30 |     await page.getByRole("button", { name: "Save changes" }).click();
  31 | 
  32 |     // Toast confirms save
  33 |     await expect(page.getByText(/Settings saved/i)).toBeVisible();
  34 |   });
  35 | 
  36 |   test("updates minimum postage value and saves", async ({ page }) => {
  37 |     await openSettings(page);
  38 |     await page.getByRole("button", { name: "Inbox control" }).click();
  39 | 
  40 |     // Minimum postage input
  41 |     const postageInput = page.getByRole("textbox").filter({ hasText: /^0/ }).first();
  42 |     // Use the input near the XLM label
  43 |     await page.locator('input[inputmode="decimal"]').last().fill("0.001");
  44 | 
  45 |     await page.getByRole("button", { name: "Save changes" }).click();
  46 |     await expect(page.getByText(/Settings saved/i)).toBeVisible();
  47 |   });
  48 | });
  49 | 
```