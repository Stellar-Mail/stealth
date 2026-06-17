# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calendar.spec.ts >> calendar linking >> calendar workspace closes on close button click
- Location: tests\e2e\calendar.spec.ts:47:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Add to calendar/i })

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
                - button "TOKEN2049 Abu Dhabi TOKEN2049 Abu Dhabi Verified 9:18 AM TOKEN2049 Abu Dhabi - founder pass ready" [active] [ref=e297]:
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
                - button "Unknown Sender Unknown Sender Paid 7:48 AM Message request awaiting approval" [ref=e353]:
                  - img "Unknown Sender" [ref=e355]
                  - generic [ref=e357]:
                    - generic [ref=e358]:
                      - generic [ref=e359]:
                        - generic [ref=e360]: Unknown Sender
                        - generic [ref=e362]:
                          - img [ref=e363]
                          - generic [ref=e366]: Paid
                      - generic [ref=e367]: 7:48 AM
                    - generic [ref=e368]: Message request awaiting approval
              - button "Review sender" [ref=e370]:
                - img [ref=e371]
                - generic [ref=e374]: Review sender
            - listitem [ref=e375]:
              - generic [ref=e376]:
                - 'checkbox "Select Stellar Fund: Grant application review" [ref=e377]'
                - button "Stellar Fund Stellar Fund Verified Yesterday Grant application review" [ref=e378]:
                  - img "Stellar Fund" [ref=e380]
                  - generic [ref=e382]:
                    - generic [ref=e383]:
                      - generic [ref=e384]:
                        - generic [ref=e385]: Stellar Fund
                        - generic [ref=e387]:
                          - img [ref=e388]
                          - generic [ref=e391]: Verified
                      - generic [ref=e392]: Yesterday
                    - generic [ref=e393]: Grant application review
              - button "Review sender" [ref=e395]:
                - img [ref=e396]
                - generic [ref=e399]: Review sender
            - listitem [ref=e400]:
              - generic [ref=e401]:
                - 'checkbox "Select Anonymous Trader: OTC offer for STEALTH tokens" [ref=e402]'
                - button "Anonymous Trader Anonymous Trader Paid Yesterday OTC offer for STEALTH tokens" [ref=e403]:
                  - img "Anonymous Trader" [ref=e405]
                  - generic [ref=e407]:
                    - generic [ref=e408]:
                      - generic [ref=e409]:
                        - generic [ref=e410]: Anonymous Trader
                        - generic [ref=e412]:
                          - img [ref=e413]
                          - generic [ref=e416]: Paid
                      - generic [ref=e417]: Yesterday
                    - generic [ref=e418]: OTC offer for STEALTH tokens
              - button "Review sender" [ref=e420]:
                - img [ref=e421]
                - generic [ref=e424]: Review sender
            - listitem [ref=e425]:
              - generic [ref=e426]:
                - 'checkbox "Select Nadia Reyes: Encrypted payload test" [ref=e427]'
                - button "Nadia Reyes Nadia Reyes Verified Yesterday Encrypted payload test" [ref=e428]:
                  - img "Nadia Reyes" [ref=e430]
                  - generic [ref=e431]:
                    - generic [ref=e432]:
                      - generic [ref=e433]:
                        - generic [ref=e434]: Nadia Reyes
                        - generic [ref=e436]:
                          - img [ref=e437]
                          - generic [ref=e440]: Verified
                      - generic [ref=e441]: Yesterday
                    - generic [ref=e442]: Encrypted payload test
            - listitem [ref=e443]:
              - generic [ref=e444]:
                - 'checkbox "Select Stealth Security: Your sign-in passkey" [ref=e445]'
                - button "Stealth Security Stealth Security Unknown Just now Your sign-in passkey" [ref=e446]:
                  - img "Stealth Security" [ref=e448]
                  - generic [ref=e450]:
                    - generic [ref=e451]:
                      - generic [ref=e452]:
                        - generic [ref=e453]: Stealth Security
                        - generic [ref=e455]:
                          - img [ref=e456]
                          - generic [ref=e459]: Unknown
                      - generic [ref=e460]: Just now
                    - generic [ref=e461]: Your sign-in passkey
        - separator [ref=e462]:
          - img [ref=e464]
        - generic [ref=e474]:
          - generic [ref=e475]:
            - generic [ref=e477]:
              - generic [ref=e478]: LP
              - generic [ref=e479]:
                - generic [ref=e480]:
                  - generic [ref=e481]: Lina Park
                  - generic [ref=e483]:
                    - img [ref=e484]
                    - text: Verified
                - generic [ref=e487]: lina*vantage.studio
            - generic [ref=e488]:
              - button "Reply" [ref=e490]:
                - img [ref=e491]
                - generic [ref=e494]: Reply
              - button [ref=e495]:
                - img [ref=e496]
              - button [ref=e500]:
                - img [ref=e501]
            - generic [ref=e504]:
              - button "Z" [ref=e505]:
                - img [ref=e506]
                - generic [ref=e509]: Z
              - button "E" [ref=e510]:
                - img [ref=e511]
                - generic [ref=e514]: E
              - button "Move to trash" [ref=e515]:
                - img [ref=e516]
              - button "Unstar" [ref=e519]:
                - img [ref=e520]
          - article [ref=e523]:
            - generic [ref=e525]:
              - paragraph [ref=e526]: Conversation
              - heading "Q2 brand system - final direction" [level=1] [ref=e527]
              - generic [ref=e528]:
                - generic [ref=e529]: Design
                - generic [ref=e530]: Priority
            - generic [ref=e531]:
              - img [ref=e532]
              - generic [ref=e535]: Stellar identity verified
              - generic [ref=e536]: 01c7...9a9
              - generic [ref=e537]:
                - button "Inspect provenance" [ref=e538]
                - button "Copy proof" [ref=e539]
            - generic [ref=e540]:
              - img [ref=e541]
              - generic [ref=e544]: Read receipt sent
            - generic [ref=e545]:
              - paragraph [ref=e546]: Hey,
              - paragraph [ref=e547]: Sharing the refined exploration for the new identity. The monochrome system feels strongest across product surfaces. I've attached the latest spec sheet and the motion principles deck.
              - paragraph [ref=e548]: Let me know your thoughts before Friday's review.
              - paragraph [ref=e549]: Lina
            - generic [ref=e550]:
              - generic [ref=e551]:
                - img [ref=e552]
                - text: 4 attachments
              - generic [ref=e554]:
                - generic [ref=e555] [cursor=pointer]:
                  - img [ref=e557]
                  - generic [ref=e560]:
                    - generic [ref=e561]: vantage-identity-v3.pdf
                    - generic [ref=e562]: 4.2 MB
                - generic [ref=e563] [cursor=pointer]:
                  - img [ref=e565]
                  - generic [ref=e569]:
                    - generic [ref=e570]: brand-moodboard.png
                    - generic [ref=e571]: 1.8 MB
                - generic [ref=e572] [cursor=pointer]:
                  - img [ref=e574]
                  - generic [ref=e577]:
                    - generic [ref=e578]: release-notes.txt
                    - generic [ref=e579]: 1.2 KB
                - generic [ref=e580] [cursor=pointer]:
                  - img [ref=e582]
                  - generic [ref=e585]:
                    - generic [ref=e586]: motion-principles.key
                    - generic [ref=e587]: 12.1 MB
        - separator [ref=e589]:
          - img [ref=e591]
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures";
  2  | 
  3  | test.describe("calendar linking", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.addInitScript(() => {
  6  |       localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
  7  |     });
  8  |     await page.goto("/");
  9  |   });
  10 | 
  11 |   async function openToken2049EventMail(page: Parameters<typeof test>[1]) {
  12 |     await page
  13 |       .getByRole("button", {
  14 |         name: /TOKEN2049 Abu Dhabi.*TOKEN2049 Abu Dhabi - founder pass ready/,
  15 |       })
  16 |       .click();
  17 |   }
  18 | 
  19 |   test("adds a calendar event from a mail with an event attachment", async ({ page }) => {
  20 |     await openToken2049EventMail(page);
  21 | 
  22 |     // The EventMailCard should render with the event title
  23 |     await expect(page.getByText("TOKEN2049 Abu Dhabi")).toBeVisible();
  24 | 
  25 |     // Add to calendar
  26 |     await page.getByRole("button", { name: /Add to calendar/i }).click();
  27 | 
  28 |     // Toast confirms the event was added
  29 |     await expect(page.getByText(/added to your calendar/i)).toBeVisible();
  30 |   });
  31 | 
  32 |   test("opens the calendar workspace from the sidebar calendar button", async ({ page }) => {
  33 |     // The right panel has an "Open calendar" or calendar section
  34 |     // Alternatively open via the event mail card's "Open calendar" action
  35 |     await openToken2049EventMail(page);
  36 | 
  37 |     // Add event first so it exists in calendar state
  38 |     await page.getByRole("button", { name: /Add to calendar/i }).click();
  39 | 
  40 |     // Then open the calendar workspace
  41 |     await page.getByRole("button", { name: /Open calendar/i }).click();
  42 | 
  43 |     // CalendarWorkspace dialog/modal should appear
  44 |     await expect(page.getByText("TOKEN2049 Abu Dhabi")).toBeVisible();
  45 |   });
  46 | 
  47 |   test("calendar workspace closes on close button click", async ({ page }) => {
  48 |     // Open via right panel create event button – requires an email selected first
  49 |     await openToken2049EventMail(page);
> 50 |     await page.getByRole("button", { name: /Add to calendar/i }).click();
     |                                                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  51 |     await page.getByRole("button", { name: /Open calendar/i }).click();
  52 | 
  53 |     // Dismiss the calendar workspace
  54 |     await page.getByRole("button", { name: /close/i }).first().click();
  55 | 
  56 |     // The CalendarWorkspace modal should no longer be visible
  57 |     // Check that calendar-specific heading is gone
  58 |     await expect(page.getByText("TOKEN2049 Abu Dhabi - founder pass ready")).toBeVisible();
  59 |   });
  60 | });
  61 | 
```