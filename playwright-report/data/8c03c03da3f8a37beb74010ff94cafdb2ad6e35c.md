# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sender-approval.spec.ts >> sender approval >> approves an unknown sender from the requests folder
- Location: tests\e2e\sender-approval.spec.ts:20:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Allow sender' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic: "Demo Mode: Showing placeholder data."
  - generic [ref=e3]:
    - complementary [ref=e6]:
      - generic [ref=e7]:
        - img [ref=e9]
        - generic [ref=e12]:
          - generic [ref=e13]: STEALTH
          - generic [ref=e14]: mail protocol
        - button "Toggle sidebar" [ref=e15]:
          - img [ref=e16]
      - button "Compose Ctrl+N" [ref=e19]:
        - img [ref=e20]
        - generic [ref=e23]: Compose
        - generic [ref=e24]: Ctrl+N
      - navigation [ref=e25]:
        - list [ref=e27]:
          - listitem [ref=e28]:
            - button "All Mail 16" [ref=e29]:
              - img [ref=e30]
              - generic [ref=e33]: All Mail
              - generic [ref=e34]: "16"
          - listitem [ref=e35]:
            - button "Inbox 9" [ref=e36]:
              - img [ref=e38]
              - generic [ref=e41]: Inbox
              - generic [ref=e42]: "9"
          - listitem [ref=e43]:
            - button "Priority 1" [ref=e44]:
              - img [ref=e45]
              - generic [ref=e48]: Priority
              - generic [ref=e49]: "1"
          - listitem [ref=e50]:
            - button "Snoozed 1" [ref=e51]:
              - img [ref=e52]
              - generic [ref=e55]: Snoozed
              - generic [ref=e56]: "1"
          - listitem [ref=e57]:
            - button "Starred 3" [ref=e58]:
              - img [ref=e59]
              - generic [ref=e61]: Starred
              - generic [ref=e62]: "3"
          - listitem [ref=e63]:
            - button "Drafts 1" [ref=e64]:
              - img [ref=e65]
              - generic [ref=e68]: Drafts
              - generic [ref=e69]: "1"
          - listitem [ref=e70]:
            - button "Sent 1" [ref=e71]:
              - img [ref=e72]
              - generic [ref=e75]: Sent
              - generic [ref=e76]: "1"
        - generic [ref=e77]:
          - generic [ref=e78]: Protocol
          - list [ref=e79]:
            - listitem [ref=e80]:
              - button "Verified 1" [ref=e81]:
                - img [ref=e82]
                - generic [ref=e85]: Verified
                - generic [ref=e86]: "1"
            - listitem [ref=e87]:
              - button "Pending Proof 1" [ref=e88]:
                - img [ref=e89]
                - generic [ref=e92]: Pending Proof
                - generic [ref=e93]: "1"
            - listitem [ref=e94]:
              - button "Requests 3" [ref=e95]:
                - img [ref=e96]
                - generic [ref=e101]: Requests
                - generic [ref=e102]: "3"
            - listitem [ref=e103]:
              - button "Encrypted 1" [ref=e104]:
                - img [ref=e105]
                - generic [ref=e108]: Encrypted
                - generic [ref=e109]: "1"
        - generic [ref=e110]:
          - generic [ref=e111]: Delivery
          - list [ref=e112]:
            - listitem [ref=e113]:
              - button "Receipts 1" [ref=e114]:
                - img [ref=e115]
                - generic [ref=e117]: Receipts
                - generic [ref=e118]: "1"
            - listitem [ref=e119]:
              - button "Outbox 1" [ref=e120]:
                - img [ref=e121]
                - generic [ref=e123]: Outbox
                - generic [ref=e124]: "1"
            - listitem [ref=e125]:
              - button "Scheduled 1" [ref=e126]:
                - img [ref=e127]
                - generic [ref=e131]: Scheduled
                - generic [ref=e132]: "1"
        - generic [ref=e133]:
          - generic [ref=e134]: Storage
          - list [ref=e135]:
            - listitem [ref=e136]:
              - button "Archive 1" [ref=e137]:
                - img [ref=e138]
                - generic [ref=e141]: Archive
                - generic [ref=e142]: "1"
            - listitem [ref=e143]:
              - button "Spam 1" [ref=e144]:
                - img [ref=e145]
                - generic [ref=e147]: Spam
                - generic [ref=e148]: "1"
            - listitem [ref=e149]:
              - button "Trash 1" [ref=e150]:
                - img [ref=e151]
                - generic [ref=e154]: Trash
                - generic [ref=e155]: "1"
        - generic [ref=e156]:
          - generic [ref=e157]: Folders
          - button [ref=e158]:
            - img [ref=e159]
        - list [ref=e160]:
          - listitem [ref=e161]:
            - button "Clients" [ref=e162]:
              - img [ref=e163]
              - generic [ref=e166]: Clients
          - listitem [ref=e167]:
            - button "Investors" [ref=e168]:
              - img [ref=e169]
              - generic [ref=e172]: Investors
          - listitem [ref=e173]:
            - button "Personal" [ref=e174]:
              - img [ref=e175]
              - generic [ref=e178]: Personal
      - generic [ref=e179]:
        - generic [ref=e181]: EN
        - generic [ref=e182]:
          - generic [ref=e183]: Uthaimin
          - generic [ref=e184]: kryputh@stealth.me
    - separator [ref=e186]:
      - img [ref=e188]
    - generic [ref=e197]:
      - banner [ref=e198]:
        - generic [ref=e199]:
          - img
          - textbox "Search messages, people, proofs, attachments..." [ref=e200]
          - button "K" [ref=e201]:
            - img [ref=e202]
            - text: K
        - generic [ref=e204]:
          - button "Proofs" [ref=e205]:
            - img [ref=e206]
            - generic [ref=e209]: "2"
          - button "Later" [ref=e210]:
            - img [ref=e211]
            - generic [ref=e214]: "5"
          - button "Files" [ref=e215]:
            - img [ref=e216]
            - generic [ref=e218]: "9"
        - generic [ref=e219]:
          - button "Filter" [ref=e221]:
            - img [ref=e222]
          - button "Notifications" [ref=e225]:
            - img [ref=e227]
          - button "Import contacts" [ref=e231]:
            - img [ref=e232]
          - button "Help" [ref=e236]:
            - img [ref=e237]
            - generic [ref=e240]: "?"
          - button "Proof Inspector" [ref=e241]:
            - img [ref=e242]
            - generic [ref=e245]: I
          - button "Settings" [ref=e246]:
            - img [ref=e247]
            - generic [ref=e250]: ","
          - button "Personal" [ref=e253]:
            - generic [ref=e255]: Personal
      - generic [ref=e257]:
        - generic [ref=e260]:
          - generic [ref=e261]:
            - generic [ref=e262]:
              - heading "Inbox" [level=2] [ref=e263]
              - paragraph [ref=e264]: 9 conversations
            - generic [ref=e265]:
              - button "all" [ref=e266]
              - button "unread" [ref=e267]
              - button "flagged" [ref=e268]
          - listbox [ref=e269]:
            - listitem [ref=e270]:
              - generic [ref=e271]:
                - checkbox "Select all visible messages" [ref=e272]
                - button "Select all" [ref=e273]
                - generic [ref=e274]: 9 conversations
                - generic [ref=e275]: Ctrl/⌘+A · Esc
            - listitem [ref=e276]:
              - generic [ref=e277]:
                - 'checkbox "Select Lina Park: Q2 brand system - final direction" [ref=e278]'
                - button "Lina Park Lina Park Verified 9:42 AM Q2 brand system - final direction" [ref=e279]:
                  - img "Lina Park" [ref=e281]
                  - generic [ref=e282]:
                    - generic [ref=e283]:
                      - generic [ref=e284]:
                        - generic [ref=e285]: Lina Park
                        - generic [ref=e287]:
                          - img [ref=e288]
                          - generic [ref=e291]: Verified
                      - generic [ref=e292]: 9:42 AM
                    - generic [ref=e293]: Q2 brand system - final direction
            - listitem [ref=e294]:
              - generic [ref=e295]:
                - 'checkbox "Select TOKEN2049 Abu Dhabi: TOKEN2049 Abu Dhabi - founder pass ready" [ref=e296]'
                - button "TOKEN2049 Abu Dhabi TOKEN2049 Abu Dhabi Verified 9:18 AM TOKEN2049 Abu Dhabi - founder pass ready" [ref=e297]:
                  - img "TOKEN2049 Abu Dhabi" [ref=e299]
                  - generic [ref=e301]:
                    - generic [ref=e302]:
                      - generic [ref=e303]:
                        - generic [ref=e304]: TOKEN2049 Abu Dhabi
                        - generic [ref=e306]:
                          - img [ref=e307]
                          - generic [ref=e310]: Verified
                      - generic [ref=e311]: 9:18 AM
                    - generic [ref=e312]: TOKEN2049 Abu Dhabi - founder pass ready
            - listitem [ref=e313]:
              - generic [ref=e314]:
                - 'checkbox "Select Relay Node 07: Your relay verification code" [ref=e315]'
                - button "Relay Node 07 Relay Node 07 Unknown 8:57 AM Your relay verification code" [ref=e316]:
                  - img "Relay Node 07" [ref=e318]
                  - generic [ref=e320]:
                    - generic [ref=e321]:
                      - generic [ref=e322]:
                        - generic [ref=e323]: Relay Node 07
                        - generic [ref=e325]:
                          - img [ref=e326]
                          - generic [ref=e329]: Unknown
                      - generic [ref=e330]: 8:57 AM
                    - generic [ref=e331]: Your relay verification code
            - listitem [ref=e332]:
              - generic [ref=e333]:
                - 'checkbox "Select Uthaimin Lawal: Investor update and postage policy" [ref=e334]'
                - button "Uthaimin Lawal Uthaimin Lawal Unknown 8:23 AM Investor update and postage policy" [ref=e335]:
                  - img "Uthaimin Lawal" [ref=e337]
                  - generic [ref=e338]:
                    - generic [ref=e339]:
                      - generic [ref=e340]:
                        - generic [ref=e341]: Uthaimin Lawal
                        - generic [ref=e343]:
                          - img [ref=e344]
                          - generic [ref=e347]: Unknown
                      - generic [ref=e348]: 8:23 AM
                    - generic [ref=e349]: Investor update and postage policy
            - listitem [ref=e350]:
              - generic [ref=e351]:
                - 'checkbox "Select Unknown Sender: Message request awaiting approval" [ref=e352]'
                - button "Unknown Sender Unknown Sender Paid 7:48 AM Message request awaiting approval" [active] [ref=e353]:
                  - img "Unknown Sender" [ref=e355]
                  - generic [ref=e356]:
                    - generic [ref=e357]:
                      - generic [ref=e358]:
                        - generic [ref=e359]: Unknown Sender
                        - generic [ref=e361]:
                          - img [ref=e362]
                          - generic [ref=e365]: Paid
                      - generic [ref=e366]: 7:48 AM
                    - generic [ref=e367]: Message request awaiting approval
              - button "Review sender" [ref=e369]:
                - img [ref=e370]
                - generic [ref=e373]: Review sender
            - listitem [ref=e374]:
              - generic [ref=e375]:
                - 'checkbox "Select Stellar Fund: Grant application review" [ref=e376]'
                - button "Stellar Fund Stellar Fund Verified Yesterday Grant application review" [ref=e377]:
                  - img "Stellar Fund" [ref=e379]
                  - generic [ref=e381]:
                    - generic [ref=e382]:
                      - generic [ref=e383]:
                        - generic [ref=e384]: Stellar Fund
                        - generic [ref=e386]:
                          - img [ref=e387]
                          - generic [ref=e390]: Verified
                      - generic [ref=e391]: Yesterday
                    - generic [ref=e392]: Grant application review
              - button "Review sender" [ref=e394]:
                - img [ref=e395]
                - generic [ref=e398]: Review sender
            - listitem [ref=e399]:
              - generic [ref=e400]:
                - 'checkbox "Select Anonymous Trader: OTC offer for STEALTH tokens" [ref=e401]'
                - button "Anonymous Trader Anonymous Trader Paid Yesterday OTC offer for STEALTH tokens" [ref=e402]:
                  - img "Anonymous Trader" [ref=e404]
                  - generic [ref=e406]:
                    - generic [ref=e407]:
                      - generic [ref=e408]:
                        - generic [ref=e409]: Anonymous Trader
                        - generic [ref=e411]:
                          - img [ref=e412]
                          - generic [ref=e415]: Paid
                      - generic [ref=e416]: Yesterday
                    - generic [ref=e417]: OTC offer for STEALTH tokens
              - button "Review sender" [ref=e419]:
                - img [ref=e420]
                - generic [ref=e423]: Review sender
            - listitem [ref=e424]:
              - generic [ref=e425]:
                - 'checkbox "Select Nadia Reyes: Encrypted payload test" [ref=e426]'
                - button "Nadia Reyes Nadia Reyes Verified Yesterday Encrypted payload test" [ref=e427]:
                  - img "Nadia Reyes" [ref=e429]
                  - generic [ref=e430]:
                    - generic [ref=e431]:
                      - generic [ref=e432]:
                        - generic [ref=e433]: Nadia Reyes
                        - generic [ref=e435]:
                          - img [ref=e436]
                          - generic [ref=e439]: Verified
                      - generic [ref=e440]: Yesterday
                    - generic [ref=e441]: Encrypted payload test
            - listitem [ref=e442]:
              - generic [ref=e443]:
                - 'checkbox "Select Stealth Security: Your sign-in passkey" [ref=e444]'
                - button "Stealth Security Stealth Security Unknown Just now Your sign-in passkey" [ref=e445]:
                  - img "Stealth Security" [ref=e447]
                  - generic [ref=e449]:
                    - generic [ref=e450]:
                      - generic [ref=e451]:
                        - generic [ref=e452]: Stealth Security
                        - generic [ref=e454]:
                          - img [ref=e455]
                          - generic [ref=e458]: Unknown
                      - generic [ref=e459]: Just now
                    - generic [ref=e460]: Your sign-in passkey
        - separator [ref=e461]:
          - img [ref=e463]
        - generic [ref=e473]:
          - generic [ref=e474]:
            - generic [ref=e476]:
              - generic [ref=e477]: US
              - generic [ref=e478]:
                - generic [ref=e479]:
                  - generic [ref=e480]: Unknown Sender
                  - generic [ref=e482]:
                    - img [ref=e483]
                    - text: Paid
                - generic [ref=e486]: GCKN...N4XQ
            - generic [ref=e487]:
              - button "Reply" [ref=e489]:
                - img [ref=e490]
                - generic [ref=e493]: Reply
              - button [ref=e494]:
                - img [ref=e495]
              - button [ref=e499]:
                - img [ref=e500]
            - generic [ref=e503]:
              - button "Z" [ref=e504]:
                - img [ref=e505]
                - generic [ref=e508]: Z
              - button "E" [ref=e509]:
                - img [ref=e510]
                - generic [ref=e513]: E
              - button "Move to trash" [ref=e514]:
                - img [ref=e515]
              - button "Star" [ref=e518]:
                - img [ref=e519]
          - article [ref=e522]:
            - generic [ref=e524]:
              - paragraph [ref=e525]: Conversation
              - heading "Message request awaiting approval" [level=1] [ref=e526]
              - generic [ref=e527]:
                - generic [ref=e528]: Request
                - generic [ref=e529]: Paid
            - generic [ref=e530]:
              - img [ref=e531]
              - generic [ref=e534]: Proof verification pending
              - generic [ref=e535]: 05c7...ea9
              - generic [ref=e536]:
                - button "Inspect provenance" [ref=e537]
                - button "Copy proof" [ref=e538]
            - generic [ref=e539]:
              - paragraph [ref=e540]: Decide who can mail you
              - paragraph [ref=e541]: Unknown Sender (GCKN...N4XQ) paid postage, but is not in your trusted sender list. Review how to allow, verify, or block them before anything changes.
              - button "Review sender" [ref=e543]:
                - img [ref=e544]
                - text: Review sender
            - generic [ref=e547]:
              - paragraph [ref=e548]: This sender paid postage but is not in your trusted contacts yet.
              - paragraph [ref=e549]: Approve the request to decrypt future messages automatically, or reject it to keep the address quarantined.
        - separator [ref=e551]:
          - img [ref=e553]
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures";
  2  | 
  3  | test.describe("sender approval", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.addInitScript(() => {
  6  |       localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
  7  |     });
  8  |     await page.goto("/");
  9  |   });
  10 | 
  11 |   async function openUnknownSenderRequest(page: Parameters<typeof test>[1]) {
  12 |     await page.getByRole("button", { name: /^Requests\b/ }).click();
  13 |     await page
  14 |       .getByRole("button", {
  15 |         name: /Unknown Sender.*Message request awaiting approval/,
  16 |       })
  17 |       .click();
  18 |   }
  19 | 
  20 |   test("approves an unknown sender from the requests folder", async ({ page }) => {
  21 |     await openUnknownSenderRequest(page);
  22 | 
  23 |     // The SenderRequest widget should be visible
  24 |     await expect(page.getByText("Decide who can mail you")).toBeVisible();
  25 | 
  26 |     // Approve the sender
> 27 |     await page.getByRole("button", { name: "Allow sender" }).click();
     |                                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  28 | 
  29 |     // Toast confirms approval
  30 |     await expect(page.getByText(/can now mail you/i)).toBeVisible();
  31 |   });
  32 | 
  33 |   test("blocks an unknown sender and queues postage refund", async ({ page }) => {
  34 |     await openUnknownSenderRequest(page);
  35 | 
  36 |     await expect(page.getByText("Decide who can mail you")).toBeVisible();
  37 | 
  38 |     await page.getByRole("button", { name: "Block and refund" }).click();
  39 | 
  40 |     await expect(page.getByText(/blocked and postage marked for refund/i)).toBeVisible();
  41 |   });
  42 | });
  43 | 
```