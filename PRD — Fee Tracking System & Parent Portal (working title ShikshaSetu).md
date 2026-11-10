# PRD — Fee Tracking System & Parent Portal (working title: ShikshaSetu)

Nov 9, 2026 · @Vedit Agrawal

This PRD turns the Option 2 client brief analysis (Company A, Jaipur: 4 centres, 2,600 students) into build-ready requirements after re-checking its arithmetic, laws and technology choices. Its sums and legal dates largely hold; eight points do not and are corrected in section 1. The original client brief was not attached, so its facts are taken as quoted in the analysis.

## 1. Validation summary

Fourteen items in the analysis were wrong, stale, incomplete or internally inconsistent; this PRD resolves each one. Everything else I re-checked held up (list under the table).

| # | The analysis says | What I found | PRD decision |
| --- | --- | --- | --- |
| 1 | Dropout risk for STU-0587 is 94/100 (36 + 35 + 23) | The analysis's own formulas give 32 + 28 + 19 = 79. The sub-scores 36, 35 and 23 cannot be produced by the stated rules. 79 is still HIGH. | Canonical expected score is 79; test TC-05 asserts 79 (section 7.5). |
| 2 | The MoE 2024 guidelines are the statutory refund rule | They are model guidelines for States; the Ministry itself says +2 level coaching is best regulated by States ([PTI report](https://www.udayavani.com/english-news/no-intake-of-students-below-16-years-no-misleading-promises-guidelines-for-coaching-centres)). The binding law for Jaipur is the [Rajasthan Act 2025](https://prsindia.org/files/bills_acts/acts_states/rajasthan/2025/Act16of2025RJ.pdf): s.13(4) pro-rata refund within ten days, hostel and mess included. Assent was 23 Sep 2025, but s.1(3) starts it only on a gazette notification, and I found none. | Build to Act and guidelines together. Counsel confirms commencement (decision D-01). |
| 3 | NEET plan is 3 instalments of ₹40,000 | Act s.6(2)(d) requires parents be offered at least four equal instalments. | Every batch must carry a plan of four or more equal instalments. The 3 x ₹40,000 plan stays only as the client's sample row (FR-LED-02). |
| 4 | Refund also applies to part-payers (Cases B and C) | The guideline text covers a student who has "paid for the course in full". Act s.13(4) refunds "from out of the fees deposited earlier for the remaining period". Extending this to instalment payers is a reasonable reading, not stated text. | Keep the formula; record it as assumption A-05 for counsel to confirm. |
| 5 | Receipt for ₹30,000 shows CGST 2,288.14 and SGST 2,288.13 | An intra-state supply carries central and state tax at equal rates, and invoice tools compute both on one taxable value, so a one-paisa gap is likely to be rejected. Same for ₹40,000. | Compute each tax as round(G x 9/118) and put the rounding paisa in the taxable value: ₹30,000 = 25,423.72 + 2,288.14 + 2,288.14 (section 7.2). CA to confirm. |
| 6 | Next.js 15 with React 19 | Next.js 15's two-year support window ended on 21 Oct 2026; Next.js 16 is the supported line ([policy summary](https://endoflife.ai/article-nextjs-15-eol)). Prisma 6 gets security patches only until 19 Nov 2026 ([Prisma](https://www.prisma.io/docs/orm/release-status)). | Target Next.js 16, React 19.2, Prisma 7. |
| 7 | Gemini 2.5 Flash or gpt-4o-mini drafts counsellor scripts | Gemini 2.5 Flash had a published Developer API shutdown date of 16 Oct 2026, already past ([retirement notice](https://aiweekly.co/alerts/google-retires-gemini-20-flash-001-replace-with-25-flash)). | No model name in code. Provider and model come from config behind an adapter; the deterministic template is the default path. |
| 8 | Deploy on Vercel | The Hobby plan is non-commercial only, and cron runs at most once a day ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). | Hobby is fine for the demo. Production needs a paid plan or another host. A daily cron is enough for day-based reminders. |
| 9 | Per-student virtual UPI IDs cut unmatched transfers by over 95% | Razorpay creates virtual UPI IDs in live mode only ([Razorpay docs](https://razorpay.com/docs/payments/smart-collect/va-vpa-qr/dashboard/create)). I found no source for 95%. | Keep as a Phase 2 item with no numeric promise. |
| 10 | Receipt numbers like RCP-2026-00412, sequential | GST series must be consecutive, unique per financial year and at most 16 characters (Rule 46). A plain database sequence leaves gaps when a transaction rolls back. | Format RCP/26-27/000412 (16 characters), allocated gaplessly inside the payment transaction (FR-RCP-02). |
| 11 | Demo logins use +91 98290 xxxxx phones and @jaipurcoaching.example.in | Numbers in live ranges and an ordinary subdomain can belong to real parties, which the analysis itself lists as a fatal mistake. | Use clearly synthetic values on a reserved name (@demo.example) and skip the phone-format check in demo mode. |
| 12 | Ageing buckets, instalment states, refund clock and reminder stop rules | Buckets are given three ways (Current/1-30/31-60/over 60; 1-15/16-30/31-60/over 60; Upcoming/1-30/...). Text and schema disagree on instalment states. The schema starts the refund clock on the request date, the formula on the exit date. Reminders stop on any payment, including partial, leaving a part-payer's balance unchased. | One canonical set each, in section 7. |
| 13 | 11 tables claimed as full, with append-only audit | No audit log, fee head (tuition, hostel, mess), receipt counter, settings table, flag-suppression date, OTP store or second parent. Money is stored twice (paise and DECIMAL). | Added in section 10; paise only. |
| 14 | Product name ShikshaSetu | Several Indian government apps already use "Shiksha Setu" (for example Haryana's 2018 college app and Assam's school system). | Working title only; run a trademark search before launch. |

**Confirmed as stated.** The commercial arithmetic (₹31.20 crore billed, ₹62.40 lakh leakage, ₹16.80 lakh staff cost, ₹79.20 lakh total, 13.2x). The sample rows resolving to 2 Nov 2026 (23 days overdue, due in 13 days). Refund Cases A to D. DPDP Rules notified 13 Nov 2025, core duties from 13 May 2027, consent-manager Rule 4 from 13 Nov 2026 ([SCC Online](https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/)). Rule 10 verification routes. Fourth Schedule Part A item 3 (educational institutions) and Part B item 6 (age confirmation) ([DPDP wiki](https://dpdp.myndsolution.com/wiki/rules/schedule-4-classes-of-data-fiduciaries-in-respect-of-whom-provisions-of/)). Penalty ceilings of ₹250, 200, 200 and 50 crore ([DPDPA Schedule](https://dpdpa.com/theschedule.html)). SAC 999293 at 18% for commercial coaching ([Gujarat AAR 2026](https://www.taxscan.in/top-stories/academic-coaching-for-students-taxable-at-18gst-aarclarifies-scope-of-educational-institution-under-notification-read-order-1446273)). The Tally XML envelope structure ([Tally help](https://help.tallysolutions.com/xml-interface/)). 360x800 as India's most common mobile resolution, 18.49% in June 2026 ([StatCounter](https://gs.statcounter.com/screen-resolution-stats/mobile/india)).

## 2. Problem and business case

**The problem.** Company A runs four centres in Jaipur with 2,600 students and 140 staff. Fee due dates live in separate Excel sheets per centre. Parents cannot see what they owe without phoning or visiting. Accounts staff chase instalments by phone, often late and unevenly. Bank transfers arrive with no student reference and sit unmatched. Nobody sees the early signs of a student drifting away until the next instalment is already missed.

**Who is hurt.**

| Person | Pain today | What the product changes |
| --- | --- | --- |
| Parent | Cannot tell what is due, by when, or whether the last payment was received | One card shows amount due, due date and a pay button, in English or Hindi, within five seconds |
| Accounts executive | Spends half the day on calls; reconciles transfers by hand across four sheets | One ledger, automatic reminders that stop when money lands, a queue for payments that cannot be matched |
| Counsellor | Hears about a struggling student after the fact | A ranked list of students at risk, with a call task to act on |
| Director | Sees collection figures weeks late and per centre | One view of dues, ageing and cash across all four centres |

**The numbers in the brief.** All figures below were recomputed and agree with the brief.

| Item | Working | Result |
| --- | --- | --- |
| Annual billing | 2,600 x ₹1,20,000 | ₹31.20 crore |
| Fees never collected (2%) | 0.02 x ₹31.20 crore | ₹62.40 lakh a year |
| Value over 60 days late (12%) | 0.12 x ₹31.20 crore | ₹3.744 crore; target is 6% |
| Staff time on chasing | 8 staff x 50% x ₹4.20 lakh | ₹16.80 lakh a year (4 full-time equivalents) |
| Recoverable per year | 62.40 + 16.80 | ₹79.20 lakh |
| Project budget |  | ₹6.00 lakh over six weeks |
| Return multiple | 79.20 / 6.00 | 13.2x; payback in about 28 days |

**Why the 13.2x should not be quoted to the client unqualified.** It assumes the product recovers every rupee of leakage and frees every hour of chasing time in year one. It also counts gross benefit against build cost and leaves out running cost. Net of the ₹6 lakh budget the multiple is 12.2x, not 13.2x. The 12% over-60-day figure is a delay in receiving cash, not a loss, so halving it frees about ₹1.87 crore of working capital but adds nothing to the ₹79.20 lakh. The table below shows what the same arithmetic gives under cautious recovery rates. The recovery rates are my assumptions, not client data (see A-02).

| Case | Share of leakage recovered | Share of chasing time freed | Annual benefit | Multiple of ₹6 lakh |
| --- | --- | --- | --- | --- |
| Cautious | 25% | 40% | ₹22.32 lakh | 3.7x |
| Expected | 50% | 60% | ₹41.28 lakh | 6.9x |
| Brief | 100% | 100% | ₹79.20 lakh | 13.2x |

Running cost is small. As an illustration, 2,600 families x 4 instalments x 3 reminders is 31,200 WhatsApp messages a year. At the published utility rate of about ₹0.115 to ₹0.145 a message, that is under ₹5,000 a year (assumption A-03). Hosting, SMS and the payment gateway fee are extra; they are listed in section 9.3 and still need pricing.

**Business case in one line.** Even the cautious case repays the build budget more than three times in year one, so the case does not depend on the brief's optimistic figures.

## 3. Goals, non-goals and success metrics

**Goals.** Each goal maps to a client outcome in the brief.

| ID | Goal | Why it matters |
| --- | --- | --- |
| G-1 | A parent sees amount due, due date and a pay button without scrolling, in English or Hindi | The client's five-second comprehension rule |
| G-2 | One fee ledger across all four centres, with instalment status and ageing computed from one definition | Ends per-centre Excel sheets |
| G-3 | A payment stops that instalment's reminders in the same database transaction that records it | The client's core hard part |
| G-4 | A payment that cannot be matched to a student is held in a queue and changes no balance | Removes manual reconciliation errors |
| G-5 | Receipts and refunds follow the Rajasthan Act, GST rules and the MoE guidelines | Legal exposure on fees is personal for the director |
| G-6 | Counsellors get a short, explained list of students at risk, and the AI never acts on a fee or contacts a parent | Human-in-the-loop boundary |
| G-7 | Accounts can export a day's receipts to Tally in one click | Removes double entry |

**Non-goals for the core build.** These are deliberately left out so the core can be finished and tested.

- Parent-side payment collection in live mode. The core build uses a test-mode payment link; live collection is Phase 2.
- Live WhatsApp and SMS sending. The core build writes the message to an outbox and shows it in the admin screen; a gateway adapter is Phase 2.
- Fee-structure authoring, admissions, timetables, hostel management and staff payroll.
- A native mobile app. The parent portal is a mobile-first web app.
- Any automated fee action, discount, suspension or parent message triggered by the risk score.
- Real-time bank feeds. Unmatched payments arrive through the webhook or a CSV import.

**Success metrics.** Two groups: what the client will see after rollout, and what the build must prove before it ships.

| Metric | Baseline | Target | How measured |
| --- | --- | --- | --- |
| Value over 60 days late | 12% of instalment value | 6% within two terms (client's own target) | Ageing report, section 7.3 |
| Parent time to find dues | Phone call or centre visit | Under 5 seconds on a 360x800 phone | Moderated test with five parents; stopwatch from login to dues card |
| Staff time spent chasing | 4 full-time equivalents | At least 40% lower (assumption A-02) | Time survey before and after, 8 accounts staff |
| Reminders sent after payment | Not tracked | Zero | Query: reminders sent after their instalment was paid in full |
| Unmatched payments cleared in 2 working days | Not tracked | 90% (assumption) | Queue age report |
| Refunds settled within 10 days of exit | Not tracked | 100% | Refund SLA report |
| Receipt numbering | Not tracked | No gaps, no duplicates | Daily check of the receipt series |

**Build acceptance gates.** The build is shippable only when all of the following hold: every functional requirement in section 6 has a passing test; the worked examples in section 7 reproduce exactly; no screen has a dead button; each role sees only what the access matrix in section 4 allows; and the AI path degrades safely when the model is unavailable (section 11).

## 4. Users, roles and access matrix

**Four roles.** Each user has exactly one role. A role is checked on the server for every request; hiding a button in the screen is never the control.

| Role | Who | Scope of data | Signs in with |
| --- | --- | --- | --- |
| PARENT | Parent or guardian of one or more enrolled students | Only the students linked to that parent's verified phone number | Mobile number and six-digit OTP |
| ACCOUNTS\_EXEC | Accounts staff at a centre | The centre or centres assigned to that user | Staff login with OTP on the registered number |
| COUNSELLOR | Academic counsellor | Students in the assigned centres; no payment amounts, only days overdue and instalment status | Staff login with OTP |
| DIRECTOR | Founder-director | All four centres, read access to everything, approval of refunds | Staff login with OTP |

The brief shows ACCOUNTS\_EXEC as seeing all four centres. I scope it by assignment instead, with a seed user assigned to all four so the demo still shows the multi-centre view. That keeps one centre's clerk from reading another centre's parents' data, which the DPDP duty of reasonable security supports (section 8).

**Access matrix.** "Own" means the signed-in parent's linked students only; "Centre" means assigned centres only.

| Capability | PARENT | ACCOUNTS\_EXEC | COUNSELLOR | DIRECTOR |
| --- | --- | --- | --- | --- |
| View dues card and instalment list | Own | Centre | Days overdue only | All |
| Start a test payment | Own | No | No | No |
| View and download receipts | Own | Centre | No | All |
| Record offline payment (cash, cheque) | No | Centre | No | No |
| Resolve unmatched payment | No | Centre | No | All, read only |
| Run reminders and see the outbox | No | Centre | No | All, read only |
| Raise a refund request | No | Centre | No | No |
| Approve a refund | No | No | No | Yes |
| View attendance and test scores | Own | Centre | Centre | All |
| Upload attendance and test CSV | No | Centre | Centre | No |
| View risk flags and call tasks | No | No | Centre | All |
| Close a call task, mark a flag false | No | No | Centre | No |
| Export Tally vouchers | No | Centre | No | All |
| Change system settings and thresholds | No | No | No | Yes |
| Read the audit log | No | No | No | Yes |
| Withdraw consent, request data correction or erasure | Own | Log on behalf | No | No |

**Rules that follow from the matrix.**

- The person who raises a refund cannot approve it. A raise-and-approve pair is a segregation-of-duties control, and it gives the Director a single place to see every refund before money moves.
- A parent who changes phone number must re-verify with an OTP on the new number before any data is shown; an old session ends.
- A student can have two linked parents. Either can view and pay; consent is recorded per parent (section 8).
- Every role-denied request returns 403 and writes an audit row. The demo role switcher is available only when the environment flag `DEMO_MODE` is on and is absent from a production build.
- No role can edit or delete a receipt or an audit row. Corrections are made by a credit note or a new entry that points back to the original.

## 5. Scope and release plan

**Core build: seven screens.** This is the slice the brief asks a solo engineer to finish end to end in seven days. It uses test-mode payments and an outbox in place of live messaging.

| # | Screen and route | Role | What it must do |
| --- | --- | --- | --- |
| 1 | Sign-in, `/login` | All | Parent and staff OTP sign-in; consent step for parents; demo bar only when `DEMO_MODE` is on |
| 2 | Parent home, `/parent/dashboard` | PARENT | Dues card above the fold; ledger, receipts, attendance and scores below |
| 3 | Test checkout, `/parent/pay/[id]` | PARENT | Pay the full balance or a part amount; show the receipt and the reminders that stopped |
| 4 | Dues dashboard, `/admin/dashboard` | ACCOUNTS\_EXEC, DIRECTOR | Filter by centre, batch and ageing bucket; four summary cards; CSV upload; Tally export |
| 5 | Student ledger and unmatched queue, `/admin/students/[id]` | ACCOUNTS\_EXEC | Full ledger for one student; match or reject an unmatched payment |
| 6 | Reminder outbox, `/admin/reminders` | ACCOUNTS\_EXEC | Queued, sent and suppressed reminders; each suppressed one links to the receipt that stopped it |
| 7 | Refunds and risk queue, `/admin/refunds` | ACCOUNTS\_EXEC, COUNSELLOR, DIRECTOR | Refund calculator, approval and ten-day countdown; counsellor call tasks with factor breakdown and a false-flag button |

**Release plan.** The brief budgets six weeks. The core build is the first week. The other weeks harden it for a real pilot. Legal dates set the order.

| Release | Contents | Gate to move on |
| --- | --- | --- |
| R0, core build (week 1) | The seven screens, seeded data, automated tests, deployed demo | All build acceptance gates in section 3 |
| R1, pilot-ready (weeks 2 to 3) | Real SMS OTP on a DLT-registered sender; parent identity and consent capture; audit log; gapless receipt series; per-centre access; backups; Tally import tried in a real Tally Prime by the client's accountant | Accountant confirms the Tally file imports and balances; security checks in section 11 pass |
| R2, one-centre pilot (weeks 4 to 5) | One centre's fee data imported from its Excel sheet and run in parallel with it; live WhatsApp utility templates; live payment gateway | Two full reminder cycles with zero reminders after payment; ledger totals agree with the Excel sheet |
| R3, all centres (week 6) | Remaining three centres; staff training; Hindi copy reviewed by a native reader | Counsel's written view on D-01 and D-02 in section 13 |
| Phase 2, after launch | Per-student virtual UPI IDs; bank statement import; scholarship and sibling discounts; age verification through a government identity provider | Each is a separate decision with its own cost |

**Legal dates that shape the plan.**

- The consent-manager rule of the DPDP Rules applies from 13 November 2026. The product does not need to be a consent manager, but its consent record should be shaped so one can be connected later.
- The core DPDP duties (notice, consent, security, breach reporting, erasure, children's data) apply from 13 May 2027. R1 and R2 must be live with the consent flow before the existing student base is processed under the new rules.
- The Rajasthan Act's start date depends on a gazette notice I could not find. The product is built to the Act's rules from day one (section 8), so a late notice costs nothing and an early one needs no rework.

**Deferred, with reason.**

| Deferred item | Reason |
| --- | --- |
| Virtual UPI IDs per student | Razorpay creates them in live mode only, so they cannot be tested in the build |
| Two-way WhatsApp conversations | Needs a messaging provider contract and template approval; one-way utility reminders carry the value |
| Automatic bank feed | Depends on the client's bank; CSV import covers it first |
| Fee-plan authoring screen | Fee plans are seeded; changing them is a data task for the first pilot |
| Native mobile app | A mobile-first web page covers 360 pixel phones without an app store |

## 6. Functional requirements

Each requirement has an ID, a testable criterion and a priority. **M** is needed for the core build (R0). **S** is needed before the pilot (R1 or R2). **C** is optional. Domain rules the criteria rely on, such as status, ageing, GST and refund formulas, are defined once in section 7.

### 6.1 Sign-in and sessions

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-AUTH-01 | Sign-in is by mobile number and a six-digit OTP | OTP expires after 5 minutes; five wrong tries lock the number for 15 minutes; at most five OTPs per number per hour; OTPs are stored hashed | M |
| FR-AUTH-02 | An unregistered number gets the same reply as a registered one | Response text and timing do not reveal whether the number exists | M |
| FR-AUTH-03 | Sessions use a signed, HTTP-only, secure cookie | Parent session 14 days; staff session 8 hours; role and centre scope are read from the server on every request | M |
| FR-AUTH-04 | A parent sees only the students linked to the verified number | Requesting another student's id returns 403 and writes an audit row | M |
| FR-AUTH-05 | Changing a registered phone number needs a new OTP on the new number | Old sessions end at once; the change is audited | S |
| FR-AUTH-06 | In demo mode the OTP may be shown on screen | The on-screen OTP and the role switcher exist only when `DEMO_MODE=true`; a production build contains neither | M |

### 6.2 Consent and data rights

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-CNS-01 | Before any child data is shown, the parent reads a notice in English and Hindi and gives consent | A record stores parent, student, notice version, language, timestamp and the choice; without it the portal shows only the consent screen | M |
| FR-CNS-02 | The signing-in number is tied to an adult guardian record captured at admission | Guardian record holds name, relationship and an identity reference type with the last four digits only; no full identity number is stored | M |
| FR-CNS-03 | A parent can withdraw consent as easily as giving it | One tap in settings; withdrawal stops reminders and optional processing at once, and the audit log records it; records the law requires the centre to keep stay | S |
| FR-CNS-04 | A parent can ask for correction or erasure | The request becomes a task for accounts with a due date; the parent sees its status | S |
| FR-CNS-05 | Each of two linked parents consents separately | Withdrawal by one does not remove the other's access | S |

### 6.3 Fee ledger

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-LED-01 | All money is stored as integer paise | No float or decimal column holds an amount; display uses Indian grouping, for example ₹1,20,000 | M |
| FR-LED-02 | Every batch offers at least one plan of four or more equal instalments | A plan is equal to the paisa except the last instalment, which takes the remainder; saving a batch with no such plan is blocked. The client's sample plan of three instalments of ₹40,000 may stay as an extra option | M |
| FR-LED-03 | Instalment status is computed from paid amount, scheduled amount, due date and the as-of date | Output matches the table in section 7.1 for all test rows | M |
| FR-LED-04 | Ageing buckets are computed by one function | The four buckets in section 7.3 add up to the total overdue balance | M |
| FR-LED-05 | Dates are IST calendar dates | A payment at 23:50 IST on the due date counts as on time | M |
| FR-LED-06 | The as-of clock can be the demo anchor (2 Nov 2026) or the live date | A banner shows when the anchor is active; reminders never send in anchor mode | M |
| FR-LED-07 | Each instalment is split by fee head: tuition, hostel, mess | Refunds and receipts read the split; notes and study material are never a charged head | M |
| FR-LED-08 | A scholarship or discount is recorded as part of the net fee | Net fee, not list fee, drives instalments and refunds | S |
| FR-LED-09 | Ledger entries are append-only | A correction is a reversing entry that points to the original; no update or delete path exists | M |
| FR-LED-10 | Concurrent writes to one instalment do not lose updates | A version column is checked on write; a conflict retries and then fails visibly | M |

### 6.4 Payments and the webhook

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-PAY-01 | A parent can pay the full balance or a part amount | Part amount is at least the minimum in settings (default ₹500) and at most the balance; checked on the server | M |
| FR-PAY-02 | The webhook verifies the gateway signature over the raw request body | An invalid signature returns 400 and changes nothing | M |
| FR-PAY-03 | Replays are safe | A repeated gateway payment id returns 200 and credits nothing; a unique database constraint enforces it | M |
| FR-PAY-04 | One serializable transaction records the payment, updates the instalment, issues the receipt and handles reminders | Any failure rolls back all four; a serialization conflict retries up to three times | M |
| FR-PAY-05 | A payment matches when it carries a valid student and instalment reference | Otherwise it goes to the unmatched queue with a reason code and no balance changes | M |
| FR-PAY-06 | Reason codes for the queue: NO\_REFERENCE, UNKNOWN\_STUDENT, CANCELLED\_INSTALMENT, NO\_OPEN\_DUES | Each queue row shows amount, payer name, bank reference, remarks and date received | M |
| FR-PAY-07 | Accounts can resolve a queued payment to a student and instalment, or reject it with a reason | Resolution issues the receipt then; both outcomes are audited; a rejected payment is flagged for return to the payer | M |
| FR-PAY-08 | A payment larger than the balance is applied to the next open instalment by due date | If no open instalment remains, the excess is held in the queue as NO\_OPEN\_DUES | S |
| FR-PAY-09 | Accounts can record cash, cheque or bank transfer received at the counter | Mode and reference are required; cash of ₹2,00,000 or more from one person in a day is blocked (see section 8) | S |

### 6.5 Receipts and credit notes

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-RCP-01 | Every payment gets a receipt in English and Hindi, printable on A4 and on a phone | Shows centre legal name, GSTIN, address, student, parent, batch, course period, fee head, taxable value, CGST, SGST, total, mode, date and number | M |
| FR-RCP-02 | Receipt numbers are gapless and unique within a financial year and GSTIN | Format `RCP/26-27/000412` (16 characters); the number is taken inside the payment transaction, so a rollback leaves no gap | M |
| FR-RCP-03 | GST is split so that CGST equals SGST and the three parts add to the total | Method in section 7.2; test TC-02 | M |
| FR-RCP-04 | A receipt cannot be edited or deleted | Corrections are made by credit note | M |
| FR-RCP-05 | A refund produces a credit note in its own gapless series | Format `CN/26-27/000012`; reverses tax on the refunded amount; links to the receipt it reduces | M |
| FR-RCP-06 | Receipt and credit-note records are kept for at least 72 months | Retention is stored as a setting; erasure requests do not remove these | S |

### 6.6 Reminders

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-REM-01 | Each instalment gets five reminders on due date minus 7, on the due date, and plus 3, 7 and 15 days | Created when the instalment is created; reminders whose date has passed are not back-filled | M |
| FR-REM-02 | Messages go in the parent's chosen language, Hindi by default | Template is chosen from `preferred_lang`; both templates exist for every reminder | M |
| FR-REM-03 | A message shows the balance at send time, not at queue time | Amount is read when the message is built | M |
| FR-REM-04 | When a payment brings the balance to zero, every queued reminder for that instalment becomes SUPPRESSED\_BY\_PAYMENT in the same transaction | Row stores the time and the payment id; TC-04 | M |
| FR-REM-05 | A part payment does not suppress later reminders; it starts a 24-hour quiet period | No reminder is sent within 24 hours after any payment; later ones carry the new balance | M |
| FR-REM-06 | After the plus-15-day reminder, an unpaid instalment becomes a call task for accounts | No further automatic message; the task shows balance and days overdue | S |
| FR-REM-07 | Sending runs once a day at 10:00 IST and only from a live clock | Re-running the job the same day sends nothing twice | M |
| FR-REM-08 | The outbox shows QUEUED, SENT, FAILED and SUPPRESSED\_BY\_PAYMENT | Each suppressed row links to the receipt that stopped it | M |
| FR-REM-09 | Core build writes messages to the outbox; live sending uses a provider adapter | The same code path runs in both; the provider is chosen by configuration | M |

### 6.7 Refunds

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-REF-01 | Accounts can raise a refund for a student who is leaving | Needs withdrawal date, reason and the date the written request was received | M |
| FR-REF-02 | The amount is computed per fee head on a daily pro-rata basis | Formula and worked cases in section 7.4; Cases A to D must reproduce exactly | M |
| FR-REF-03 | Unpaid future instalments are cancelled when the refund is approved | Status becomes CANCELLED\_ON\_REFUND; their queued reminders are suppressed | M |
| FR-REF-04 | The Director approves; the person who raised it cannot | An attempt to self-approve returns 403 | M |
| FR-REF-05 | A ten-day clock starts on the date the written request is received | Badge shows days left and turns red at 3 days; overdue refunds appear on the Director's dashboard | M |
| FR-REF-06 | When consumed fee exceeds fee paid, the refund is zero and no demand is created | The shortfall is shown to the Director for a decision; nothing is charged automatically | M |
| FR-REF-07 | Settlement records the refund date, mode and bank reference | Closes the SLA clock and issues the credit note | M |

### 6.8 Attendance, scores and risk

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-RSK-01 | Accounts or counsellors can upload attendance and test scores as CSV | Rows are validated; bad rows are listed with line number and reason and nothing is half-imported | M |
| FR-RSK-02 | A deterministic score from 0 to 100 is computed from fees, attendance and test trend | Formula in section 7.5; STU-0587 scores 79 (TC-05) | M |
| FR-RSK-03 | A score of 50 or more creates one call task for the counsellor; 70 or more is HIGH | Thresholds live in settings; one open task per student at a time | M |
| FR-RSK-04 | The scorer reads fees, attendance and scores and writes only the flag table | Its database role has no write access to anything else; a test attempts and fails to write elsewhere | M |
| FR-RSK-05 | The scorer never sends a message or changes a fee | No code path from the scorer to the reminder service or the ledger | M |
| FR-RSK-06 | A counsellor can mark a flag false with a reason and the student is not flagged again for 14 days | Reasons: approved medical leave, family event, score entry correction; counsellor and time are logged | M |
| FR-RSK-07 | A model drafts a three-point call guide in English and Hindi | Four-second timeout; on any failure the template guide is used; the scan never crashes (section 9) | S |
| FR-RSK-08 | Every flag shows why | Three factor bars with points and the raw inputs behind them | M |

### 6.9 Dashboards, export and audit

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-ADM-01 | The dues dashboard filters by centre, batch and ageing bucket | Four summary cards: total due, overdue, over 60 days, collected this month; all agree with the table | M |
| FR-ADM-02 | The student ledger shows plan, discount, instalments, payments and receipts | Matches the sum of ledger entries | M |
| FR-ADM-03 | The Tally export covers a date range of receipts and credit notes | Output is a Tally XML file and a CSV; each voucher debits and credits the same total; ledger names come from settings | M |
| FR-ADM-04 | Exports are repeatable without duplicates | Each voucher has a stable id; importing the same file twice creates no second voucher | S |
| FR-ADM-05 | Every export is logged | Who, when, range, count and total | S |
| FR-AUD-01 | Sign-in, role denials, payments, resolutions, refunds, exports, flag changes, consent and settings changes write an audit row | Row holds actor, role, action, target, before and after, time and request id | M |
| FR-AUD-02 | The audit log is append-only | The application database role cannot update or delete audit rows | M |

### 6.10 Language and screens

| ID | Requirement | Acceptance criterion | Pri |
| --- | --- | --- | --- |
| FR-UI-01 | A visible EN and Hindi toggle on every screen | All labels, statuses, receipts and messages exist in both; no layout shift on switching | M |
| FR-UI-02 | The dues card fits above the fold on 360 by 800 | Shows balance, due date with status, and a full-width pay button without scrolling | M |
| FR-UI-03 | Every button does something | A crawl clicks each control; none is dead | M |
| FR-UI-04 | Each screen has loading, empty and error states | Verified by the browser tests in section 11 | M |
| FR-UI-05 | Interface meets WCAG 2.2 AA contrast and targets of at least 44 pixels | Automated accessibility check passes on all seven screens | S |

## 7. Domain rules with worked examples

These are the definitions the tests check. Where the brief gave one rule three ways, this section picks one. Every figure was recomputed in code.

### 7.1 Instalment status

For one instalment, let A be the scheduled amount, P the matched payments to date, and d the as-of date minus the due date in whole days (positive means late). The balance is B = max(0, A − P).

| Condition | Status | English label | Hindi label |
| --- | --- | --- | --- |
| Cancelled by a refund | CANCELLED\_ON\_REFUND | Cancelled | रद्द |
| P ≥ A | PAID | Paid | चुकाया गया |
| P = 0 and d ≤ 0 | UPCOMING | Due in \|d\| days (d = 0: Due today) | देय \|d\| दिन में (आज देय) |
| 0 < P < A and d ≤ 0 | PART\_PAID\_UPCOMING | Part paid, due in \|d\| days | आंशिक भुगतान, \|d\| दिन में देय |
| P = 0 and d > 0 | OVERDUE | d days overdue | d दिन अतिदेय |
| 0 < P < A and d > 0 | PART\_PAID\_OVERDUE | Part paid, d days overdue | आंशिक भुगतान, d दिन अतिदेय |

Status is computed when read. Only the cancelled state is stored. The brief's five-way list and its schema disagreed, so this six-state table replaces both.

**Worked rows on the demo date, 2 November 2026.**

| Student | Due date | A | P | d | Status | Balance |
| --- | --- | --- | --- | --- | --- | --- |
| STU-0412 | 10 Oct 2026 | ₹30,000 | ₹30,000 | 23 | PAID | ₹0 |
| STU-0587 | 10 Oct 2026 | ₹30,000 | ₹15,000 | 23 | PART\_PAID\_OVERDUE | ₹15,000 |
| STU-0219 | 15 Nov 2026 | ₹40,000 | ₹0 | −13 | UPCOMING, due in 13 days | ₹40,000 |

### 7.2 GST on a receipt

Tuition and coaching fees are treated as inclusive of 18% GST, SAC 999293, split into 9% central and 9% state tax because the supply is within Rajasthan. The brief rounded each part separately, which left central tax one paisa different from state tax on ₹30,000 and ₹40,000. This PRD rounds the tax once and puts any odd paisa into the taxable value, so the two taxes are always equal. All arithmetic is on integer paise.

```latex
T = \operatorname{round}_{\text{half up}}\!\left(\frac{9\,G}{118}\right), \qquad \text{CGST} = \text{SGST} = T, \qquad \text{Taxable} = G - 2T
```

In integer paise, T = ⌊(18 · G + 118) / 236⌋. Never use floating-point rounding: Python's `round` on floats gave 3,050.84 where half-up gives 3,050.85.

| Gross paid | Taxable value | CGST | SGST | Sum |
| --- | --- | --- | --- | --- |
| ₹15,000 | ₹12,711.86 | ₹1,144.07 | ₹1,144.07 | ₹15,000.00 |
| ₹30,000 | ₹25,423.72 | ₹2,288.14 | ₹2,288.14 | ₹30,000.00 |
| ₹33,333 | ₹28,248.30 | ₹2,542.35 | ₹2,542.35 | ₹33,333.00 |
| ₹40,000 | ₹33,898.30 | ₹3,050.85 | ₹3,050.85 | ₹40,000.00 |
| ₹1,20,000 | ₹1,01,694.92 | ₹9,152.54 | ₹9,152.54 | ₹1,20,000.00 |

A part payment is its own taxable receipt, so a student who pays ₹30,000 in two halves gets two receipts whose taxes are rounded separately. Their sum can differ from the tax on ₹30,000 by a paisa; that is expected and is not an error. A chartered accountant should confirm the document type (tax invoice or receipt voucher for an advance) before launch (assumption A-04).

### 7.3 Ageing

Only instalments with a balance above zero are aged. Let d be days late as in 7.1.

| Bucket | Rule | STU-0587 example |
| --- | --- | --- |
| Not yet due | d ≤ 0 |  |
| 1 to 30 days | 1 ≤ d ≤ 30 | d = 23, ₹15,000 falls here |
| 31 to 60 days | 31 ≤ d ≤ 60 |  |
| Over 60 days | d ≥ 61 |  |

Boundary tests: d = 30 is in the first overdue bucket, d = 31 and d = 60 in the second, d = 61 in the last. The four buckets add up to the total open balance.

Two different numbers get called "over 60 days", so the dashboard names both. **Outstanding over 60 days** is the open balance in the last bucket today. The client's **late-60 share** is the value of instalments settled or still open more than 60 days after their due date, divided by the value of instalments that fell due in the term. The 12% to 6% target is a late-60 share and is reported per term.

### 7.4 Pro-rata refund

For each fee head h (tuition, hostel, mess), let N be the net fee for the year, Paid the amount paid so far, T the course days for that head (360 in the seed data), and e the days elapsed from the later of batch start and enrolment date to the withdrawal date, kept between 0 and T.

```latex
\text{Consumed}_h = \operatorname{round}_{\text{half up}}\!\left(N_h \cdot \frac{e}{T}\right), \qquad \text{Refund}_h = \max\!\left(0,\ \text{Paid}_h - \text{Consumed}_h\right)
```

```latex
\text{Refund} = \sum_h \text{Refund}_h, \qquad \text{Deadline} = \text{Date request received} + 10 \text{ calendar days}
```

The floor at zero is applied per head. A student who has used up the hostel fee does not have the shortfall taken out of a tuition refund; this reading favours the student and is assumption A-06.

**Worked cases.** Net tuition is ₹1,20,000 and T = 360 in each.

| Case | Paid | e | Consumed | Refund | What else happens |
| --- | --- | --- | --- | --- | --- |
| A, full payer leaves mid-course | ₹1,20,000 | 180 | ₹60,000 | ₹60,000 |  |
| B, instalment payer | ₹90,000 | 216 | ₹72,000 | ₹18,000 | Instalment 4 (₹30,000) cancelled |
| C, part payer (STU-0587) | ₹75,000 | 216 | ₹72,000 | ₹3,000 | ₹15,000 balance and instalment 4 cancelled |
| D, leaves before the batch starts | ₹30,000 | 0 | ₹0 | ₹30,000 | Later instalments cancelled |
| E, used more than paid | ₹60,000 | 216 | ₹72,000 | ₹0 | ₹12,000 shortfall shown to the Director, not charged |
| F, two heads | Tuition ₹90,000, hostel ₹30,000 (hostel net ₹60,000) | 216 | ₹72,000 and ₹36,000 | ₹18,000 + ₹0 = ₹18,000 | Hostel shortfall ₹6,000 not netted off |

**Trap to avoid in the demo.** The brief's Cases B and C use 216 elapsed days. With a batch starting 1 April 2026, 216 days is 3 November 2026, not the demo date. On 2 November e is 215, so Case C gives ₹3,333.33 and Case B gives ₹18,333.33. The tests pass e as an input and a second test uses the dates, so neither can drift unseen.

The ten days run from the day the written request is received, so a request received on 3 November 2026 must be paid by 13 November 2026. The brief's formula started the clock at the exit date and its schema at the request date; the earlier one is the safer reading and is used for both (decision D-04). As a design target, the Director approves within three days so seven remain for payment.

### 7.5 Dropout-risk score

The score R has three parts, rounded half up to whole points.

```latex
R = F + A + S, \qquad F = \operatorname{round}\!\left(35 \cdot \min\!\left(1, \tfrac{d}{30}\right)\right) + 5\,[0 < P < A]
```

```latex
A = \begin{cases} 0 & a \ge 80 \\ 25 & a \le 65 \\ \operatorname{round}\!\left(25 \cdot \tfrac{80 - a}{15}\right) & \text{otherwise} \end{cases} \; + \; 10\,[a_{\text{prev}} - a > 10], \qquad S = \operatorname{round}\!\left(25 \cdot \min\!\left(1, \tfrac{\max(0,\ s_{T1} - s_{T3})}{25}\right)\right)
```

Here d is days overdue on the worst open instalment, a is this month's attendance percent, a\_prev is last month's, and s\_T1 and s\_T3 are the oldest and latest of the last three test percentiles. The maximum is 40 + 35 + 25 = 100. A score from 50 to 69 is MEDIUM and 70 or more is HIGH; 50 or more creates a call task.

**Worked example, STU-0587.** Overdue 23 days on a part-paid instalment; attendance 69% after 88%; test percentile 78 falling to 59.

| Part | Working | Points |
| --- | --- | --- |
| Fees | round(35 × 23/30) = 27, plus 5 for part payment | 32 |
| Attendance | round(25 × 11/15) = 18, plus 10 for a 19-point drop | 28 |
| Tests | round(25 × 19/25) = 19 | 19 |
| **Total** |  | **79, HIGH** |

The brief reported 36, 35 and 23, total 94. Its own formulas cannot produce those parts, so 79 is the expected value in test TC-05. The brief also names a 75% attendance benchmark in one place and 80% in the formula; the formula's 80% is used and the value sits in settings.

## 8. Compliance requirements

I am not a lawyer or a chartered accountant. This section turns the rules I could find into product controls and marks which ones need a professional's sign-off. **Basis** says how well I could confirm the rule: *primary* means I read the legal text or an official source; *secondary* means a reputable summary; *open* means I could not confirm it.

### 8.1 Rajasthan Coaching Centres (Control and Regulation) Act, 2025

This is the binding state law for Jaipur. The brief did not mention it. The [Act text](https://prsindia.org/files/bills_acts/acts_states/rajasthan/2025/Act16of2025RJ.pdf) is the source for the sections below; the Hindi part of my copy was partly garbled, so each section number should be checked against the gazette copy.

| Provision | What it requires | Product control | Basis |
| --- | --- | --- | --- |
| s.6(2)(d) | Parents offered at least four equal instalments | FR-LED-02 blocks a batch with no such plan | primary |
| s.13(1) | Official receipt for every fee paid | FR-RCP-01 to FR-RCP-04 | primary |
| s.13(4) | Pro-rata refund of fees for the remaining period within ten days, hostel and mess included | FR-REF-02 to FR-REF-07; section 7.4 | primary |
| s.13(5) | No fee increase during the course | A fee plan cannot be edited after enrolment; a change needs a new plan and a Director-approved exception that is audited | primary |
| s.7(4) | Registration for each branch | Each centre stores its registration number, which is printed on its receipts (design choice) | primary |
| s.19 | Penalties for breach | Reported to the Director through the SLA and plan checks | primary |
| s.1(3) | Act starts on a date the State notifies | I found no commencement notification as of 9 November 2026; counsel to confirm (D-01) | open |

### 8.2 Ministry of Education guidelines, 2024

These are model guidelines for States, not a central statute, and the Ministry has said regulation of coaching for older students is for States ([PTI report](https://www.udayavani.com/english-news/no-intake-of-students-below-16-years-no-misleading-promises-guidelines-for-coaching-centres)). The product follows them because they match the Rajasthan Act on refunds and add rules on fair fees. I could not open the official PDF from the Ministry's site, so the guideline text rests on secondary sources.

| Guideline | Product control | Basis |
| --- | --- | --- |
| Refund of the unused period's fee, hostel and mess included, within ten days | Section 7.4 | secondary |
| No separate charge for notes or study material | FR-LED-07 allows no such fee head | secondary |
| Courses and fees must be clear and published | Fee plan and receipt show course period and fee head | secondary |
| No intake below 16 years | Admission is outside this product; enrolment date of birth is stored and checked against the batch (assumption A-07) | secondary |

### 8.3 Digital Personal Data Protection Act, 2023 and Rules, 2025

Students under 18 are children under the Act, so almost every record here is a child's data. The Rules were notified on 13 November 2025. The consent-manager rule applies from 13 November 2026 and the main duties from 13 May 2027 ([SCC Online summary](https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/)). The product treats the later date as its deadline.

| Duty | Source | Product control | Basis |
| --- | --- | --- | --- |
| Notice before consent, in plain language, with a way to withdraw | s.5, s.6 | FR-CNS-01, FR-CNS-03; notice in English and Hindi | primary |
| Verifiable consent of a parent before processing a child's data | s.9(1), Rule 10 | FR-CNS-01, FR-CNS-02: the OTP number is tied to an adult guardian record from admission | primary |
| No processing likely to harm a child; no tracking or behavioural monitoring of children | s.9(2), s.9(3) | See the risk-scoring note below | primary |
| Reasonable security safeguards: encryption, access control, access logs, backups | s.8(5), Rule 6 | Sections 4, 9; FR-AUD-01, FR-AUD-02 | primary |
| Tell the Board and affected parents of a breach | s.8(6), Rule 7 | Breach runbook in section 9 | primary |
| Erase data when the purpose ends or consent is withdrawn, unless law requires keeping it | s.8(7) | Retention settings; tax records kept 72 months | primary |
| Publish a contact for questions and run a grievance process | s.8(9), s.8(10) | A contact and grievance link in the parent portal footer | primary |
| Rights to access, correct, erase and nominate someone | s.11 to s.14 | FR-CNS-03, FR-CNS-04 | primary |
| Penalties up to ₹250 crore for security failure, ₹200 crore for breach notification or child-data failure, ₹50 crore for other breaches | Schedule | Drives the priority of the controls above | primary ([DPDPA Schedule](https://dpdpa.com/theschedule.html)) |

**Risk scoring and children's data.** The Fourth Schedule lets educational institutions track or monitor children only as far as needed for educational activities or safety. Whether a commercial coaching centre counts as an educational institution under that entry is open, and a fee-delay factor in a dropout score is a commercial purpose, not an educational one. My reading is that the risk score is the feature most likely to fall foul of s.9(3). The controls are: counsellor task only, never an action on the child or the fee; a settings switch `RISK_SCORING_ENABLED` that is on in the demo and **off in production until counsel decides (D-02)**; the fee factor can be turned off separately; and the parent notice names the feature. This is my reading and not legal advice.

### 8.4 GST and tax

| Rule | Product control | Basis |
| --- | --- | --- |
| Commercial coaching is taxed at 18% under SAC 999293; the educational-institution exemption does not cover it ([Gujarat advance ruling, 2026](https://www.taxscan.in/top-stories/academic-coaching-for-students-taxable-at-18gst-aarclarifies-scope-of-educational-institution-under-notification-read-order-1446273)) | Section 7.2 | secondary |
| Invoice serial number: consecutive, unique in the financial year, at most 16 characters (Rule 46) | FR-RCP-02 | primary |
| Central and state tax are equal for a supply within the state | FR-RCP-03 | primary |
| A credit note when tax is reduced after supply (s.34) | FR-RCP-05 | primary |
| Keep records at least 72 months (s.36) | FR-RCP-06 | primary |
| Cash of ₹2 lakh or more from one person in a day, or for one event, is barred; the penalty equals the amount received. The rule was s.269ST of the 1961 Act and continues in the Income-tax Act 2025 from 1 April 2026 ([summary](https://www.bajajfinserv.in/investments/269st-of-income-tax-act)); sources give the new section as 186 or 221, so a chartered accountant should confirm it | FR-PAY-09 blocks it | secondary |
| Whether the document is a tax invoice or an advance receipt voucher | Chartered accountant to confirm before launch (A-04) | open |

### 8.5 Messaging

| Rule | Product control | Basis |
| --- | --- | --- |
| SMS to Indian numbers needs a registered sender, header and approved template on a DLT platform under TRAI rules | R1 task: register the entity, header and five Hindi and five English templates | secondary |
| WhatsApp business messages need an approved template and the user's opt-in; payment reminders fit the utility category at about ₹0.115 to ₹0.145 a message | Opt-in captured in the consent flow; templates submitted in R2 | secondary |
| A parent who withdraws consent stops receiving messages | FR-CNS-03 | primary |

### 8.6 What each decision needs from a professional

| Decision | Who | Question |
| --- | --- | --- |
| D-01 | Counsel | Is the Rajasthan Act in force, and from when? |
| D-02 | Counsel | May the risk score run, and with which factors, under s.9(3) and the Fourth Schedule? |
| A-04 | Chartered accountant | Tax invoice or receipt voucher; which GSTIN covers which centre |
| A-05 | Counsel | Does the refund right extend to instalment payers as in Cases B and C? |

## 9. Non-functional requirements, architecture and verified technology

### 9.1 Non-functional requirements

The numbers are design targets I chose for a 2,600-student institute; they are not measurements.

| Area | Requirement | How it is checked |
| --- | --- | --- |
| Speed | Parent dues card is usable within 2.5 seconds on a mid-range Android phone on 4G; the card needs one data call | Lighthouse run on a throttled profile; five-parent stopwatch test |
| Payload | First parent screen under 170 KB of JavaScript, compressed; Devanagari font subset and preloaded | Build report |
| Webhook | 95% of payment webhooks finish in under one second; a failed one is retried by the gateway and stays safe to replay | Load test of 50 webhooks in parallel with duplicates |
| Scale | Comfortable at 2,600 students, about 600 sessions in the hour after a reminder run, four centres | Load test at twice that |
| Availability | 99.5% during 8:00 to 22:00 IST | Uptime monitor |
| Backup | Daily backups, at most 24 hours of data lost and 4 hours to restore; a restore is tried every quarter | Restore drill record |
| Security | Section 9.6 | Security checks in section 11 |
| Privacy | Section 8.3; no names or phone numbers leave the system except to the messaging provider | Data-flow review |
| Accessibility | WCAG 2.2 AA contrast, 44-pixel touch targets, readable at 200% zoom | Automated and manual check |
| Language | Every user-facing string exists in English and Hindi; dates, numbers and rupees use Indian formats | String-coverage test fails on a missing key |
| Devices | Android Chrome from two years back, iOS Safari, desktop Chrome, Edge; 360 by 800 first (18.49% of Indian mobile screens in June 2026, per [StatCounter](https://gs.statcounter.com/screen-resolution-stats/mobile/india)) | Playwright on three viewports |
| Observability | Structured logs with a request id, no personal data in logs; alerts on failed webhooks, failed reminder runs and queue age | Alert test |
| Time | All business dates are IST calendar dates; the server clock is UTC | Tests at 23:50 and 00:10 IST |

### 9.2 Architecture

One Next.js application serves the screens and the API. One Postgres database holds the ledger. The scheduled jobs in section 9.5 run beside it. External services are reached only through adapters so each can be swapped or switched off.

&#91;embedded content: system context · app, database, three jobs, external services\]

External services sit on the left and only talk to the application. The database on the right is the single place state lives.

Boundaries that matter:

- The payment webhook is the only way money enters the ledger, apart from an accounts executive's own entry. It is verified, idempotent and transactional (FR-PAY-02 to FR-PAY-04).
- The risk scanner connects with a database role that can read fees, attendance and scores and write only the flag table (FR-RSK-04).
- The application's database role cannot update or delete audit rows or receipts (FR-AUD-02, FR-RCP-04).
- The messaging adapter is the only code that can contact a parent. The risk scanner has no path to it (FR-RSK-05).

### 9.3 Technology, checked against current support

The brief chose versions that were current when it was written. I checked each against its vendor's support policy as of 9 November 2026.

| Layer | Brief | PRD choice | Reason |
| --- | --- | --- | --- |
| Framework | Next.js 15, React 19 | Next.js 16, React 19.2 | Version 15 left its support window on 21 Oct 2026 ([policy summary](https://endoflife.ai/article-nextjs-15-eol)) |
| ORM | Prisma | Prisma 7, which needs Node 20.19 or later and ES modules | Version 6 gets security fixes only until 19 Nov 2026 ([Prisma release status](https://www.prisma.io/docs/orm/release-status)) |
| Runtime | Not stated | Node 22 or 24 LTS | Prisma 7 floor is 20.19; both are supported lines |
| Database | PostgreSQL 16 | PostgreSQL 16 or later on a managed host in the Mumbai region | Close to users; serializable transactions needed for FR-PAY-04 |
| Tests | Vitest, Playwright | Same | Fast unit tests; browser tests on three viewports |
| Styling | Tailwind, shadcn | Same | No issue found |
| Model | Gemini 2.5 Flash or gpt-4o-mini | A provider and model read from configuration | Gemini 2.5 Flash had a Developer API shutdown date of 16 Oct 2026 ([retirement notice](https://aiweekly.co/alerts/google-retires-gemini-20-flash-001-replace-with-25-flash)); names change faster than code should |
| Hosting | Vercel | Vercel Hobby for the demo; a paid Vercel plan or another host for production | Hobby is for non-commercial use and runs cron at most once a day ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)) |
| Payments | Razorpay-style test checkout | Razorpay test mode now; live in R2 | Virtual UPI IDs per student exist in live mode only ([Razorpay docs](https://razorpay.com/docs/payments/smart-collect/va-vpa-qr/dashboard/create)) |
| Accounting | Tally XML or CSV | Tally Prime XML, with CSV fallback | XML import can fail without a visible error, so R1 requires a real import by the accountant ([Tally help](https://help.tallysolutions.com/xml-interface/)) |

Prices for hosting, database, SMS and the gateway change often and I did not verify them; they are an R1 task before the client commits to a budget. The one cost I did verify is the WhatsApp utility message, at about ₹0.115 to ₹0.145.

### 9.4 The AI path and its guardrails

The deterministic score is the product. The model only drafts wording for the counsellor, and the draft is never required.

- The model receives factor values and days overdue, with no name, phone or address. The counsellor sees the name from the database, not from the model.
- Output must pass a schema check: three points in English and three in Hindi, each under a set length. A failed check uses the template.
- A four-second timeout, a missing key, a retired model or any error uses the template guide, and the scan still completes.
- The model has no tools and no database access. A test confirms that a model reply containing instructions changes nothing.
- A setting switches the model off; the template path is then the only path.

### 9.5 Scheduled jobs

| Job | When | Idempotence |
| --- | --- | --- |
| Reminder run | 10:00 IST daily | A reminder row moves from QUEUED to SENT once; a rerun finds nothing to send |
| Risk scan | 06:00 IST daily and on demand from the dashboard | One open task per student; a dismissed flag is held for 14 days |
| Unmatched-queue ageing alert | 09:00 IST daily | Alerts on items older than two working days |
| Refund SLA alert | 09:00 IST daily | Alerts at three days left and at breach |

A daily schedule is enough because every reminder is set in whole days.

### 9.6 Security and breach response

- Passwords are not used. OTP, session and role rules are in section 6.1.
- Data is encrypted in transit, and the database and backups are encrypted at rest by the host.
- Secrets (gateway secret, webhook secret, model key, messaging key) are environment variables, never in the repository, with a separate set for demo and production.
- Rate limits apply to OTP, payment creation and CSV upload. Uploaded files are size-limited and parsed as data, never executed.
- Every list and detail query is filtered by the role and centre scope on the server. A test signs in as each role and tries every other role's routes.
- Dependency and secret scans run on every change.

**If personal data may have been exposed.**

1. Contain: revoke sessions and rotate keys.
2. Assess: what, whose, how many, since when, from the audit log.
3. Tell the Data Protection Board without delay, and send the detailed report within the time the Rules set (72 hours under Rule 7; check the current text).
4. Tell each affected parent without delay, in English and Hindi, with what happened and what to do.
5. Record the event, the decision and the fix, and review the control that failed.

### 9.7 Environments and demo mode

| Environment | Data | Clock | Messaging and payments |
| --- | --- | --- | --- |
| Demo | Invented students; names, phones and emails on reserved or obviously synthetic values | Anchor date 2 Nov 2026, with a live-clock switch | Outbox only; test-mode checkout |
| Staging | A copy of one centre's structure with scrambled personal data | Live | Provider sandboxes |
| Production | Real data | Live; no anchor switch exists in the build | Live provider and gateway |

## 10. Data model changes

The brief's schema has 11 tables. All 11 stay, with changes below, and 17 are added, giving 28. The schema was missing things its own text relies on: an audit log, a receipt counter, a fee-head split, a settings table, a second parent, sessions and OTP storage. It also stored money twice, as integer paise and as a decimal.

**Rule for money.** Every amount is a 64-bit integer count of paise. No decimal or float amount column exists. Rates are stored as integer basis points.

### 10.1 Existing tables, changed

| Table | Change | Reason |
| --- | --- | --- |
| centres | Add `registration_no`; make `gstin` required | Act s.7(4); receipts need the GSTIN |
| batches | Rename `total_days` to `course_days`; drop `instalment_count` and `base_fee_paise` (moved to plans and fees) | A batch can offer several plans |
| users | Drop `email`, `password` and `centre_id`; add `phone_verified_at`, `is_active`; staff sign in by OTP | Centre scope moves to `user_centres`; no passwords to leak |
| students | Drop `parent_user_id`, `gross_fee_paise`, `discount_paise`, `net_fee_paise`, `hostel_fee_paise`; keep `dob` and `is_minor` | Parents move to `guardians`; fees move to `student_fees` |
| dpdp\_consents | One row per parent, purpose and notice version; add `notice_version`; `withdrawn_at` is never cleared | Per-parent consent (FR-CNS-05); history preserved |
| instalments | Drop stored `status` and the DUE\_SOON state; keep `amount_due_paise`, add `plan_line_id`, `cancelled_at`, `refund_id`; `amount_paid_paise` is a cached sum with a check against allocations | Status is computed (section 7.1) |
| payments | Amount in paise only; add `mode`, `reason_code`, `payer_name`, `remarks`, `received_on`, `recorded_by`, `reverses_payment_id`; drop `receipt_no` and the tax columns | Tax and numbers move to `receipts`; reversals instead of edits |
| reminders | Add `suppress_reason`, `provider_message_id`, `error`, `sent_at`, `template_code`; unique on instalment and trigger type | Auditable outbox; no duplicate reminders |
| refund\_requests | Replace `request_date` and `days_attended` with `received_on` and `days_elapsed`; add `raised_by`, `settled_on`, `settlement_mode`, `bank_reference`, `shortfall_paise`, `credit_note_id`; check that `approved_by` differs from `raised_by` | Section 7.4; FR-REF-04 |
| academic\_metrics | Unique on student, period and test; add `upload_id` | Re-uploading a file does not duplicate rows |
| dropout\_flags | Add `inputs_json`, `model_name`, `template_used`, `suppressed_until`, `closed_by`, `closed_at` | Explainability; 14-day hold; FR-RSK-06 |

### 10.2 New tables

| Table | Key columns | Purpose |
| --- | --- | --- |
| user\_centres | `user_id`, `centre_id` | Centre scope for staff |
| guardians | `student_id`, `user_id`, `name`, `relationship`, `id_ref_type`, `id_last4`, `verified_at`, `is_primary` | Up to two parents per student; no full identity number |
| student\_fees | `student_id`, `head` (TUITION, HOSTEL, MESS), `gross_paise`, `discount_paise`, `net_paise` | Net fee per head for refunds |
| fee\_plans | `batch_id`, `name`, `instalment_count` | A batch needs one plan with four or more equal instalments |
| fee\_plan\_lines | `plan_id`, `seq`, `due_date`, `weight_bp` | Due dates and shares; the last line takes the paise remainder |
| instalment\_heads | `instalment_id`, `head`, `amount_due_paise` | Split of each instalment by fee head |
| payment\_allocations | `payment_id`, `instalment_id`, `head`, `amount_paise` | What each payment paid; source of paid-per-head |
| receipts | `payment_id`, `gstin`, `fy`, `kind` (RECEIPT, CREDIT\_NOTE), `number`, `gross_paise`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `snapshot_json`, `refund_id`, `original_receipt_id` | One immutable document per payment or refund; unique on GSTIN, year, kind and number |
| receipt\_counters | `gstin`, `fy`, `kind`, `last_no` | Gapless numbering under a row lock inside the payment transaction |
| refund\_lines | `refund_id`, `head`, `net_paise`, `paid_paise`, `consumed_paise`, `refund_paise` | Per-head calculation record |
| csv\_uploads | `uploaded_by`, `file_hash`, `rows_ok`, `rows_rejected`, `status` | Traceable imports; same file twice is refused |
| audit\_log | `at`, `actor_user_id`, `role`, `action`, `target_type`, `target_id`, `before_json`, `after_json`, `request_id` | Section 6.9; insert-only grant |
| system\_settings | `key`, `value`, `updated_by`, `updated_at` | Thresholds and switches (below) |
| otp\_challenges | `phone_hash`, `code_hash`, `expires_at`, `attempts`, `consumed_at` | OTP storage, hashed |
| sessions | `user_id`, `issued_at`, `expires_at`, `revoked_at` | Lets a phone change end old sessions |
| data\_requests | `student_id`, `parent_user_id`, `type` (CORRECTION, ERASURE), `status`, `due_on` | FR-CNS-04 |
| tally\_exports | `exported_by`, `from_date`, `to_date`, `voucher_count`, `total_paise` | FR-ADM-05 |

**Settings keys.** `MIN_PART_PAYMENT_PAISE`, `RISK_TASK_THRESHOLD` (50), `RISK_HIGH_THRESHOLD` (70), `ATTENDANCE_BENCHMARK` (80), `FALSE_FLAG_HOLD_DAYS` (14), `REMINDER_QUIET_HOURS` (24), `REFUND_SLA_DAYS` (10), `RECORD_RETENTION_MONTHS` (72), `CASH_LIMIT_PAISE` (20000000), `RISK_SCORING_ENABLED` and `MODEL_ENABLED`. Every change writes an audit row. `DEMO_MODE` is not a setting: it is a build-time environment flag, so a production build cannot turn it on from the database.

### 10.3 Constraints and indexes

- Unique: `payments.gateway_payment_id`; `receipts(gstin, fy, kind, number)`; `reminders(instalment_id, trigger_type)`; `students.student_code`; `users.phone`.
- Checks: amounts are non-negative except reversal rows; allocations of a payment sum to its amount; an instalment's paid amount equals the sum of its allocations; CGST equals SGST on every receipt and the three parts sum to the gross.
- The application role is granted insert only on `audit_log`, `receipts` and `payments`; it cannot update or delete them. The risk scanner role is granted select on fees, attendance and scores, and insert and update on `dropout_flags` only.
- Indexes: `instalments(due_date) where balance > 0` for ageing; `payments(match_status, received_on)` for the queue; `reminders(state, scheduled_for)` for the daily run.

### 10.4 Seed data for the demo

- Four centres, four batches and the three sample students from the brief, with the client's names and the due dates and amounts in section 7.1.
- At least 40 more students spread over the four centres, so every ageing bucket, filter and queue has something in it: students in each of the four buckets, one unmatched payment, one refund with three days left, one refund already settled, one HIGH flag, one flag dismissed within its 14-day hold.
- Other students, parents and staff use obviously synthetic values: names such as "Demo Student 004", phone numbers in a pattern that cannot be dialled, and email addresses on `demo.example`, a reserved name that cannot belong to anyone. Phone-format checks are skipped in demo mode only.
- Seeds are produced by a script from a fixed random seed, so a rebuild gives the same data.

## 11. Test and acceptance plan

TC-01 to TC-05 are the brief's own tests, corrected where section 1 found an error. TC-06 onward close gaps. Automated tests use Vitest for logic and database behaviour and Playwright for screens, at 360 by 800, tablet and desktop widths.

### 11.1 Automated tests

| ID | Test | Expected result | Covers |
| --- | --- | --- | --- |
| TC-01 | Status of the three sample rows on 2 Nov 2026, plus d = 0 and d = 1 | STU-0412 PAID, ₹0; STU-0587 part paid, 23 days overdue, ₹15,000; STU-0219 due in 13 days, ₹40,000; d = 0 reads "Due today" | FR-LED-03 |
| TC-02 | GST split for ₹15,000, ₹30,000, ₹40,000, ₹1,20,000 and ₹33,333; then every gross from 1 paise to ₹1,000 | CGST equals SGST; the three parts sum to gross; ₹30,000 gives 25,423.72 + 2,288.14 + 2,288.14 | FR-RCP-03 |
| TC-03 | Refund Cases A to F with e as input | ₹60,000; ₹18,000; ₹3,000; ₹30,000; ₹0 with ₹12,000 shortfall; ₹18,000 with hostel ₹0 | FR-REF-02, FR-REF-06 |
| TC-03b | Refund from dates | Request received 3 Nov 2026 gives e = 216 and deadline 13 Nov 2026; on the demo clock (2 Nov) Case C gives ₹3,333.33 | FR-REF-05 |
| TC-04 | Pay STU-0587's remaining ₹15,000 through the webhook | Payment recorded, receipt issued, instalment PAID, every queued reminder SUPPRESSED\_BY\_PAYMENT with the payment id, all in one transaction | FR-PAY-04, FR-REM-04 |
| TC-04b | Webhook safety | Same payment id twice returns 200 and credits once; bad signature returns 400 and changes nothing; a fault injected before commit leaves ledger, receipt and reminders unchanged | FR-PAY-02, FR-PAY-03 |
| TC-05 | Risk score for STU-0587 | 79, HIGH; boundaries: 49 makes no task, 50 makes one; attendance 80 gives 0 and 65 gives 25; overdue 30 and 45 days both give 35 | FR-RSK-02, FR-RSK-03 |
| TC-06 | Ageing buckets | d = 30 in 1 to 30; 31 and 60 in 31 to 60; 61 in over 60; buckets add to the open balance | FR-LED-04 |
| TC-07 | Reminders | Part payment does not suppress; nothing sends within 24 hours of a payment; a later message shows the new balance; a rerun the same day sends nothing; anchor mode sends nothing | FR-REM-03, FR-REM-05, FR-REM-07 |
| TC-08 | Unmatched queue | No reference queues with a reason and no balance change; resolving issues a receipt; rejecting is audited; a payment on a cancelled instalment queues as CANCELLED\_INSTALMENT | FR-PAY-05 to FR-PAY-07 |
| TC-09 | Receipt numbering | 50 payments in parallel give numbers 1 to 50 with no gap or duplicate; a rolled-back payment leaves no gap | FR-RCP-02 |
| TC-10 | Access control | Every role against every route and API follows the matrix in section 4; a parent asking for another student's id gets 403 | FR-AUTH-04 |
| TC-11 | AI guardrails | Model offline, timed out, returning bad shape, or returning instructions: the template is used, the scan completes, nothing else changes; the scanner role fails when it tries to write to instalments or reminders | FR-RSK-04, FR-RSK-05, FR-RSK-07 |
| TC-12 | Refund workflow | Self-approval returns 403; approval cancels unpaid instalments and suppresses their reminders; countdown shows days left | FR-REF-03 to FR-REF-05 |
| TC-13 | Fee plans | A batch without a plan of four or more equal instalments cannot be saved; instalments are equal to the paisa except the last | FR-LED-02 |
| TC-14 | Consent | No child data before consent; withdrawal stops reminders; two parents consent separately | FR-CNS-01, FR-CNS-03, FR-CNS-05 |
| TC-15 | Tally file | XML is well formed; each voucher's debits equal its credits; vouchers have stable ids; a second export of the same range adds no new vouchers | FR-ADM-03, FR-ADM-04 |
| TC-16 | Cash limit | A cash entry of ₹2,00,000 or more from one person in a day is refused; ₹1,99,999 passes | FR-PAY-09 |
| TC-17 | Language and layout | Every string exists in both languages; no layout shift on toggle; the dues card is above the fold at 360 by 800 | FR-UI-01, FR-UI-02 |
| TC-18 | Audit | Update and delete on audit, receipt and payment rows fail at the database; every audited action writes a row | FR-AUD-01, FR-AUD-02 |
| TC-19 | CSV upload | Bad rows are listed by line and nothing is half imported; the same file twice is refused | FR-RSK-01 |
| TC-20 | Time zone | A payment at 23:50 IST counts for that day; at 00:10 IST for the next | FR-LED-05 |
| TC-21 | No dead buttons | A crawl clicks every control on all seven screens as each role; none does nothing | FR-UI-03 |
| TC-22 | Accessibility | Automated check passes on all seven screens | FR-UI-05 |
| TC-23 | Production build | No demo bar, no on-screen OTP and no clock switch in a production build | FR-AUTH-06 |

### 11.2 Checks that need people

| Check | Who | Pass condition | Release |
| --- | --- | --- | --- |
| Tally import | Client's accountant, in real Tally Prime | File imports with no exceptions; totals match the receipts | R1 |
| Five-second test | Five parents on their own phones | Each finds amount, date and pay button in under five seconds | R1 |
| Hindi review | A native reader who is not the author | Every screen, receipt and message approved | R1 |
| Restore drill | Engineer | A backup restores into a clean database within four hours and totals match | R1 |
| Parallel run | Accounts staff at one centre | Two reminder cycles with zero reminders after payment; ledger totals match the Excel sheet | R2 |
| Legal decisions | Counsel and chartered accountant | D-01, D-02, A-04 and A-05 answered in writing | R3 |

### 11.3 Demo walk-through for a reviewer

1. Sign in as the STU-0587 parent. The dues card shows ₹15,000, 10 Oct 2026 and part paid, 23 days overdue, with a pay button. Toggle to Hindi.
2. Pay ₹15,000 in the test checkout. The receipt appears and the page says which reminders stopped.
3. Sign in as accounts. Open the reminder outbox and follow a suppressed reminder to the receipt that stopped it.
4. Open the unmatched queue, match the sample transfer to a student, and see the receipt issued.
5. Raise a refund for a student; sign in as the Director and approve it; see the credit note and the ten-day clock.
6. Sign in as the counsellor. Open the HIGH flag, read the factor bars, switch the model offline and run a scan, then mark a flag false.

Each step is also a Playwright test, so the walk-through cannot drift from what the tests prove.

## 12. Risks

Likelihood and impact are my judgement on a High, Medium, Low scale. They are for ordering the work, not for forecasting.

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| K-01 | A payment is credited twice or lost, so the ledger is wrong | Medium | High | Signed webhook, unique gateway id, one serializable transaction, fault-injection test (TC-04b) | Engineer |
| K-02 | Risk scoring breaches the DPDP rule on tracking children | Medium | High | Switch off in production until counsel decides; counsellor task only; fee factor can be turned off (D-02) | Director, counsel |
| K-03 | The Rajasthan Act starts earlier than expected and the product is not ready | Medium | High | Built to the Act from the first release (section 8.1) | Engineer |
| K-04 | Tally import fails without any visible error | Medium | Medium | Accountant imports a real file before release; stable voucher ids; CSV fallback (R1 gate) | Engineer, accountant |
| K-05 | Six weeks and ₹6 lakh are not enough for R0 to R3 | High | Medium | Core build first; if time runs short, cut in this order: virtual UPI IDs, live WhatsApp (keep SMS), second-centre rollout | Engineer, Director |
| K-06 | SMS or WhatsApp template approval takes longer than the plan | Medium | Medium | Apply for DLT registration and templates in week one; the outbox works without them | Engineer |
| K-07 | Parents share a phone, or two parents and several children use one number | High | Medium | Many-to-many guardian links; OTP goes only to the registered number; each guardian consents separately | Engineer |
| K-08 | Hindi wording is stiff or wrong on a receipt or reminder | Medium | Medium | Native reader signs off before R2 (section 11.2) | Director |
| K-09 | The model provider retires or changes the model | High | Low | Name in configuration; template path always works (section 9.4) | Engineer |
| K-10 | Existing Excel fee data is messy and the import is wrong | High | High | Validated import with a rejected-rows report; one-centre parallel run before rollout | Accounts |
| K-11 | Staff keep using Excel and phone calls | Medium | High | Parallel run with a cut-over date; the dashboard replaces the weekly Excel report | Director |
| K-12 | Tax treatment of receipts is wrong | Low | High | Accountant confirms document type and GSTIN mapping before R2 (A-04) | Accountant |
| K-13 | Instalment payers are not covered by the refund right, so refunds in Cases B and C are over-generous | Low | Medium | Counsel's view on A-05; the rule is a setting that can narrow it | Counsel |
| K-14 | The name ShikshaSetu conflicts with existing marks | Medium | Low | Trademark search; the name is a label in one config file (D-05) | Director |
| K-15 | Demo hosting is used for real data | Low | High | Hobby plan and demo data only; production build has no demo switches (TC-23) | Engineer |
| K-16 | The client expects the brief's 13.2x return | Medium | Medium | Share the cautious and expected cases from section 2 with the client | Engineer |
| K-17 | A data breach exposes children's records | Low | High | Section 9.6 controls and breach steps; centre-scoped access; no full identity numbers stored | Engineer, Director |

## 13. Assumptions and open decisions

### 13.1 Assumptions

An assumption is something I relied on without being able to confirm it. If it is wrong, the last column says what changes.

| ID | Assumption | Who confirms | If wrong |
| --- | --- | --- | --- |
| A-01 | The original client brief is as the analysis quotes it. I did not see the brief itself, only the analysis document | Director | Figures and sample rows in sections 2 and 7 may differ |
| A-02 | The product recovers 25% to 50% of leakage and frees 40% to 60% of chasing time in year one | Director, after the pilot | The return multiples in section 2 move; the cautious case is still above 3x |
| A-03 | Three reminders a family per instalment are actually sent, over four instalments, at the published utility rate | Engineer, from the first reminder run | Running cost changes by a few thousand rupees |
| A-04 | Each receipt is a tax invoice or advance receipt that fits the CGST rules, and one GSTIN covers all four centres or each centre has its own | Chartered accountant | Document title, numbering series and receipt layout change |
| A-05 | The refund right covers instalment payers as well as full payers (Cases B and C) | Counsel | Cases B and C change; the rule is a setting |
| A-06 | The refund is floored at zero per fee head, with no netting between heads | Counsel | Case F gives a smaller refund |
| A-07 | Date of birth is enough to check the batch's age rule, and the check is a warning, not a block | Director | Admission process, outside this product, owns the rule |
| A-08 | Staff sign in by OTP on a registered number rather than email and password | Director | A password flow is added; nothing else changes |
| A-09 | Each batch has a standard course length of 360 days, with the same length for hostel and mess | Accounts | Course days become a per-head setting |
| A-10 | The ten-day clock counts calendar days, including holidays | Counsel | Section 7.4 deadline changes |

### 13.2 Open decisions

| ID | Decision | Options | Recommendation | Owner | Needed by |
| --- | --- | --- | --- | --- | --- |
| D-01 | Is the Rajasthan Coaching Centres Act in force, and from when? | In force now; starts on a later notice; not yet notified | Build to it either way; ask counsel to read the gazette | Counsel | Before R3 |
| D-02 | May the dropout score run in production under s.9(3) and the Fourth Schedule? | On with all factors; on with attendance and tests only; off | On with attendance and tests only until counsel decides, which removes the commercial fee factor | Counsel, Director | Before R2 |
| D-03 | What should a part payment do to reminders? | Suppress as the brief says; keep going with a 24-hour quiet period | Keep going with a quiet period, so a part payer's balance is still chased (FR-REM-05) | Director | Before R1 |
| D-04 | When does the refund clock start? | Request date; exit date; last attended day | Request date, the earliest of the three (section 7.4) | Counsel | Before R2 |
| D-05 | Product name | ShikshaSetu; another name | Treat as a working title; run a trademark search | Director | Before launch |
| D-06 | Production hosting | A paid Vercel plan; another host | Decide with the price check in R1 | Engineer, Director | Week 2 |
| D-07 | May a Director-approved fee change happen during a course? | Never; with approval and audit | With approval and audit, because the Act bars increases but a reduction or a correction may be needed | Counsel, Director | Before R2 |

### 13.3 What I could not verify

- **Rajasthan Act commencement.** I found the Act and its assent date but no notification bringing it into force.
- **Rajasthan Act wording in Hindi.** Part of the text I could read was garbled; each section number should be checked against the gazette copy.
- **MoE guidelines, official text.** I could not open the Ministry's own PDF. The guideline content rests on press and secondary summaries.
- **New section number for the cash-receipt limit.** Sources disagree between section 186 and section 221 of the Income-tax Act 2025.
- **Prices.** Hosting, database, SMS and gateway fees were not checked, apart from the WhatsApp utility rate.
- **Rule 7 breach timing and the Fourth Schedule entry for educational institutions.** I relied on summaries of the Rules; the text should be read before the breach runbook is signed off.

## 14. Sources

All web sources were checked as of 9 November 2026. Where a source is a summary rather than the legal text, the table says so.

| Source | Used for | Type |
| --- | --- | --- |
| Client brief analysis (the uploaded document) | Product scope, sample data, formulas, commercial figures | Input document |
| [Rajasthan Coaching Centres (Control and Regulation) Act, 2025](https://prsindia.org/files/bills_acts/acts_states/rajasthan/2025/Act16of2025RJ.pdf) | s.6(2)(d), s.7(4), s.13, s.19, s.1(3) | Legal text |
| [PTI report on the MoE 2024 guidelines](https://www.udayavani.com/english-news/no-intake-of-students-below-16-years-no-misleading-promises-guidelines-for-coaching-centres) | Guideline content; States' role | News |
| [SCC Online on the DPDP Rules, 2025](https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/) | Notification and commencement dates | Legal commentary |
| [DPDP Rules wiki, Fourth Schedule](https://dpdp.myndsolution.com/wiki/rules/schedule-4-classes-of-data-fiduciaries-in-respect-of-whom-provisions-of/) | Educational-institution and age-confirmation entries | Secondary |
| [DPDP Act Schedule](https://dpdpa.com/theschedule.html) | Penalty ceilings | Secondary |
| [Gujarat advance ruling on coaching, Taxscan](https://www.taxscan.in/top-stories/academic-coaching-for-students-taxable-at-18gst-aarclarifies-scope-of-educational-institution-under-notification-read-order-1446273) | 18% GST on commercial coaching | News on a ruling |
| [Cash receipt limit, Bajaj Finserv](https://www.bajajfinserv.in/investments/269st-of-income-tax-act) and [Section 186 note, EBizFiling](https://ebizfiling.com/blog/section-186-of-the-income-tax-act/) | ₹2 lakh cash rule and its move into the 2025 Act | Secondary |
| [Cash limits from April 2026, Incorpx](https://www.incorpx.io/blog/cash-transaction-limits-small-business-2026) | Alternative section number (221) | Secondary |
| [Next.js 15 end of life](https://endoflife.ai/article-nextjs-15-eol) | Support window | Secondary |
| [Prisma release status](https://www.prisma.io/docs/orm/release-status) | Prisma 6 and 7 support | Vendor |
| [Gemini retirement notice](https://aiweekly.co/alerts/google-retires-gemini-20-flash-001-replace-with-25-flash) | Model shutdown date | Secondary |
| [Vercel cron and plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Hobby plan limits | Vendor |
| [Razorpay virtual UPI IDs](https://razorpay.com/docs/payments/smart-collect/va-vpa-qr/dashboard/create) | Live-mode only | Vendor |
| [Tally XML interface](https://help.tallysolutions.com/xml-interface/) | Import format | Vendor |
| [StatCounter, India mobile screen sizes](https://gs.statcounter.com/screen-resolution-stats/mobile/india) | 360 by 800 share | Statistics |

The arithmetic in sections 2 and 7 was recomputed in code with integer paise and half-up rounding; the script and its output are available on request.
