# Technical Design Document: ShikshaSetu Fee Tracking System and Parent Portal

Nov 9, 2026 · @Vedit Agrawal  
**GitHub Repository**: [https://github.com/BugHunterX2101/ShikshaSetu](https://github.com/BugHunterX2101/ShikshaSetu)

## 1. Purpose, scope and reading guide

This document says how to build the product described in the [PRD](https://claude.ai/artifact/UPeKgcYpMvgYaLg64KD1RD): which components exist, how they talk, what each stores, and how each rule is enforced in code and in the database. It was checked by building a reference implementation of the money, status, tax, refund and risk logic and the database layer, and running 61 tests against it on a real PostgreSQL 16 server. Section 2 lists what ran and what did not.

**In scope.** Everything in PRD sections 4 to 11: the seven core screens, the ledger, the payment webhook, receipts and credit notes, reminders, refunds, the risk scan and its AI adapter, sign-in and consent, the Tally export, security, deployment and tests.

**Out of scope.** The deferred items in PRD section 5 (live WhatsApp, virtual UPI IDs, bank feeds, fee-plan authoring, a native app). Legal and tax conclusions stay with counsel and the accountant (PRD sections 8 and 13).

**How to read it.**

| If you are | Start at |
| --- | --- |
| Building the money path | Sections 6, 7, 8, 10 |
| Building screens | Sections 12, 13, 14 |
| Reviewing risk and compliance | Sections 2, 11, 12, 16 |
| Running the system | Sections 17, 18 |
| Checking coverage | Section 19 |

**Conventions.** FR, TC, A and D identifiers are the PRD's. A design decision this document makes is written DD-nn and is listed in section 2; where one differs from the PRD it says so. Money is integer paise (`bigint` in code and `bigint` columns in the database). Business dates are IST calendar dates held as `YYYY-MM-DD` strings. Percentages are integer hundredths of a percent, so 69.00% is 6900. Code blocks marked as run were executed; other blocks are the intended shape.

## 2. Verification summary and design decisions

Building the money path found six problems that reading the PRD did not, and each one changed the design. All 61 tests now pass.

### 2.1 What was run

The reference code is 1,432 lines (domain logic, database layer, SQL and tests), written in TypeScript and checked with `tsc` 5.9.3 in strict mode with no errors. The tests ran on PostgreSQL 16.15 with three real database roles.

| Check | Result |
| --- | --- |
| Domain logic: status, ageing, GST, refund Cases A to F, risk, plans, allocation, dates, receipt numbers | 34 tests pass. Includes a loop over every gross amount from 1 paisa to ₹1,000 (100,000 values): CGST equals SGST, the three parts sum to the gross, and the result matches an independent integer formula |
| Webhook signature and Tally voucher XML | 6 tests pass: exact-body signature accepted, re-serialised body and wrong secret rejected; every voucher balances to zero; ids are stable |
| Schema: 28 tables, checks, triggers, grants | Loads cleanly; 6 schema tests (table count, generated net fee, plan weights, CGST and paid checks, paid equals allocations, one open flag and one active consent) and 2 role tests pass (section 6) |
| Payment transaction | Part payment keeps reminders; the last ₹15,000 suppresses all five at once; duplicate and 10 parallel duplicates credit once; faults injected at four stages leave nothing changed and no receipt-number gap |
| Concurrency | 200 payments in parallel: 200 succeeded, serials 1 to 200 with no gap, 872 ms |
| Refund Case C end to end | Raise, self-approval refused by the database, approve, settle, credit note `CN/26-27/000001` in its own series |
| Time zones | All 61 tests pass with the process time zone set to UTC, Asia/Calcutta and America/Los\_Angeles |
| Package versions | Queried from the npm registry on 9 Nov 2026 (section 4) |
| Razorpay webhook rules | Header, algorithm, raw-body rule and event-id header confirmed in [Razorpay's docs](https://razorpay.com/docs/webhooks/validate-test/) |
| Tally receipt voucher shape | Confirmed against [Tally's help samples](https://help.tallysolutions.com/scenario-2/) |

### 2.2 What was not verified

- **Prisma.** Its schema engine downloads a binary from `binaries.prisma.sh`, which this workspace blocked (403), so the Prisma schema was neither generated nor validated here. The money path was tested through `pg`, the driver Prisma's own Postgres adapter uses. Section 4 sets a first CI step for it.
- **The web application.** Next.js routes, screens and the browser tests were designed, not built.
- **Real systems.** A live payment gateway, a real Tally Prime import, a messaging provider, and the Hindi copy.
- **Device performance.** The speed targets in PRD section 9.1 were not measured.
- **TypeScript 7.** It is the current `latest`; I tested only 5.9.3 (section 4).

### 2.3 Design decisions

The first six were forced by running the code; the rest are choices.

| ID | Decision | Differs from PRD or brief | Evidence |
| --- | --- | --- | --- |
| DD-01 | The payment transaction runs at READ COMMITTED with explicit row locks, not SERIALIZABLE; retries are limited to 3 in production (the reference default of 8 was used for the experiment) | PRD FR-PAY-04 said one serializable transaction | Under SERIALIZABLE, 19 of 50 parallel payments failed after eight retries because every receipt updates one counter row. Under READ COMMITTED all 200 succeeded and numbers stayed gapless |
| DD-02 | `payments` allows updates to resolution columns only (`match_status`, `student_id`, `instalment_id`, `reason_code`, `unallocated_paise`, `remarks`), by column-level grant plus a trigger on the money fields | PRD 10.3 said insert only | A queued payment must change state when accounts resolves it |
| DD-03 | DATE columns are read as `YYYY-MM-DD` strings and `int8` as `bigint`, set once at start-up | Not stated | The Node process ran in IST. A DATE read as a JS Date is local midnight, which `toISOString` turns into the previous day. Case C refunded ₹2,666.67 instead of ₹3,000 until fixed |
| DD-04 | Attendance and scores are integers in hundredths of a percent (`attendance_bp`, `score_bp`) | Brief used DECIMAL(5,2) | Keeps the risk formula in integer arithmetic |
| DD-05 | `payments.unallocated_paise` holds an overpayment that no open instalment can take | PRD 10.1 did not list it | Needed for FR-PAY-08; the queue shows rows where it is above zero |
| DD-06 | Instalments are locked in one fixed order (due date, then sequence) before the target is paid first | Not stated | Two payments for one student that lock in different orders can deadlock |
| DD-07 | The reminder run sends one reminder per instalment per run, looking back one day | PRD 6.6 | A failed run would otherwise send the plus-3 and plus-7 reminders together |
| DD-08 | A credit note names the student's latest receipt as its original and lists the others in its snapshot | PRD 6.5 | Refunds can span several receipts; the accountant must confirm (open item O-02). The reference snapshot does not yet list the others |
| DD-09 | The money path is plain SQL in one module; Prisma serves reads and simple writes | PRD 9.3 named Prisma only | Explicit locks, `ON CONFLICT` and column grants are clearer in SQL, and the money path was tested that way |
| DD-10 | Webhook idempotency key is the gateway payment id; only the captured event creates a payment | Not stated | Razorpay's page says events can arrive out of order, so the authorized event must not be assumed first |
| DD-11 | A `payment_orders` table binds each gateway order to a student, instalment and amount, created by our server | Not in the PRD data model or the 28-table reference schema | Browser-set notes can be changed by the payer; matching must rest on data the server wrote (section 13.4) |
| DD-12 | Plain numbered SQL files are the migration source of truth; Prisma's schema is introspected from the database | PRD 9.3 named Prisma | Triggers, column grants and partial indexes cannot be written in a Prisma schema (section 17.3) |

## 3. Architecture

The system is one PostgreSQL database, one web application and one worker, deployed together. The database enforces the money rules, so a bug in application code cannot corrupt receipts or the audit trail.

### 3.1 Shape of the system

A modular monolith fits a one-engineer build and 2,600 students. Splitting into services would add network failure modes to the payment path without any load that justifies them.

| Part | Responsibility | Runs as |
| --- | --- | --- |
| Web application | Staff screens, parent portal, API routes, webhook endpoint | Next.js 16 server process |
| Scheduled jobs | Daily reminder run, risk scan, queue and refund alerts, Tally export | The same code, called as job routes by the host's scheduler, or by one long-running Node process (section 17.2) |
| PostgreSQL 16 | All state, constraints, triggers, receipt counters, audit log | Managed instance in the Mumbai region |
| Payment gateway | Collects money, calls the webhook | External (Razorpay) |
| Messaging provider | Delivers reminders and receipts | External; provider not chosen (open item O-04) |
| AI adapter | Optional call-guide drafts for risk flags; never decides anything | In-process module behind an interface |
| Tally | Receives a generated XML file; no live link | Accountant imports by hand |

### 3.2 Request paths

There are three, and they have different failure rules.

1. **Money in.** The gateway posts to the webhook. The handler verifies the signature on the raw body, then runs one database transaction that stores the payment, allocates it, issues the receipt and updates reminders. It answers 200 only after commit. A failure rolls everything back and the gateway retries (section 8).
2. **Staff and parent reads and writes.** Server-rendered pages and API routes call domain functions, which call the database. Every write goes through a function that records an audit row in the same transaction.
3. **Scheduled work.** The worker wakes on a schedule, reads live balances at send time and writes its results. A missed run is caught up on the next one (section 9).

### 3.3 Trust boundaries and database roles

Three database roles are created in `sql/000_roles.sql`, and `sql/003_grants.sql` limits each one.

| Role | Used by | May do | May not do |
| --- | --- | --- | --- |
| `app_rw` | Web application and worker | Read and write operational tables; insert into `audit_log`, `receipts`, `payment_allocations` | Update or delete those three tables; change money columns of `payments` |
| `risk_scanner` | Risk scan job | Select on fee, attendance and score tables; insert and update `dropout_flags` | Write anywhere else |
| Owner | Migrations only | Change schema | Not used at run time |

Append-only is enforced twice: `REVOKE` removes the privilege, and a trigger raises an error if anything else reaches an update or delete. Two role tests confirm the scanner cannot touch fee tables and the application cannot rewrite the audit log.

### 3.4 Time, money and identifiers

- Money is an integer number of paise in `bigint`. No floating point appears anywhere in the fee path.
- Percentages are integers in hundredths of a percent (DD-04).
- Business dates are IST calendar dates held as `YYYY-MM-DD` strings (DD-03). Timestamps are stored in UTC and converted by adding 330 minutes only when a business date is needed.
- Receipt and credit-note numbers come from one counter row per GSTIN, financial year and kind, updated inside the payment transaction, so a rolled-back payment never burns a number.

### 3.5 Why not the alternatives

| Alternative | Reason rejected |
| --- | --- |
| Microservices or a queue between webhook and ledger | The webhook must answer only after the ledger commits; a queue adds a window where money is taken but not recorded |
| Serializable transactions for all payments | Measured: 19 of 50 parallel payments failed on the receipt counter (DD-01) |
| Application-level audit logging only | A bug or a mistaken script could rewrite history; the database must refuse |
| Live Tally integration | Unverified here, and the brief only needs a file the accountant can import (section 15) |

## 4. Technology stack

The stack is TypeScript end to end on PostgreSQL 16. Versions below were read from the npm registry on 9 November 2026, and the reference code was run on Node 22.23.4.

### 4.1 Versions

| Package | Version to pin | Note |
| --- | --- | --- |
| Node.js | 22 LTS (22.12 or later) | Satisfies Next.js (20.9 or later) and Prisma 7 (20.19, 22.12 or 24 and later) |
| TypeScript | 5.9.3 | `latest` is 7.0.2, but only 5.9.3 was tested; 6.0.3 also exists. Move up only after the type-check and tests pass |
| Next.js | 16.4.5 | App Router |
| React and React DOM | 19.3.1 |  |
| Prisma client and adapter | 7.10.1 | The Prisma CLI `latest` tag points to 8.0.0-rc.33, a release candidate; do not use it |
| pg (node-postgres) | 8.23.1 | Money path (DD-09) |
| zod | 4.6.7 | Input validation at every boundary |
| Tailwind CSS | 4.3.5 |  |
| jose | 6.2.16 | Signing and verifying session tokens |
| fast-xml-parser | 5.12.0 | Tests of the Tally XML |
| Vitest | 5.1.0 | 4.1.12 also exists; 5.1.0 was the version run here |
| Playwright | @playwright/test 1.65.0 | Browser tests (designed, not run) |
| PostgreSQL | 16 (tested on 16.15) |  |

### 4.2 Prisma and the support window

Prisma 6 support ends on 19 November 2026, ten days from now, so the build starts on Prisma 7. Prisma documents 18 months of support for version 7 after version 8 is generally available, and version 8 is still a release candidate. Pinning 7.10.1 is therefore safe for the life of this project.

Prisma could not be validated here: its schema engine downloads a binary from `binaries.prisma.sh`, and the workspace network returned 403. The first CI job must therefore run `prisma db pull` against the migrated database, compare the result with `prisma/schema.prisma`, and run `prisma validate`. Until that passes, treat the Prisma schema as unverified.

### 4.3 Where each tool is used

| Layer | Tool | Reason |
| --- | --- | --- |
| Payment, refund, reminder and receipt writes | `pg` with explicit SQL | Row locks, `ON CONFLICT` and column grants are exact in SQL, and this is the code that was tested (DD-09) |
| Reads, lists, simple CRUD | Prisma | Type-safe queries for screens |
| Business rules | Pure TypeScript functions in `src/domain` | No database or clock inside them, so tests are exact |
| Validation | zod | One schema per API route and per webhook payload |
| Sessions | jose | Signed, expiring tokens |

### 4.4 Configuration of the database driver

`configurePg()` runs once at start-up and sets two type parsers: DATE (type id 1082) returns the string as stored, and `int8` (type id 20) returns a `bigint`. Without the first, the IST server turns a date into the previous day (DD-03). Without the second, any amount above 2^53 paise would lose precision, and node-postgres would otherwise return `bigint` columns as strings.

```ts
import pg from 'pg';
export function configurePg() {
  pg.types.setTypeParser(1082, (v: string) => v);       // DATE -> 'YYYY-MM-DD'
  pg.types.setTypeParser(20, (v: string) => BigInt(v)); // int8 -> bigint
}
```

### 4.5 Dependencies not adopted

- TypeScript 7 and the Prisma 8 release candidate, for the reasons above.
- A message queue or cache. Nothing in 2,600 students and a daily batch needs one; Postgres row locks and a table of due reminders are enough.
- A decimal or money library. Integer paise and one `divRound` function cover every calculation in the PRD.

## 5. Repository and module layout

**Source Code Repository**: [https://github.com/BugHunterX2101/ShikshaSetu](https://github.com/BugHunterX2101/ShikshaSetu)

Business rules sit in pure functions that import nothing from the database or the framework. That is why the 34 domain tests run in milliseconds and can be exact.

### 5.1 Layout

Files marked built exist in the reference code and were tested. Files marked planned are specified in this document but were not written.

```text
src/domain/        built    pure rules: money, dates, status, ageing, gst, refund,
                            risk, receiptNo, webhook, tally, index (11 files, 241 lines)
src/db/            built    pg.ts, tx.ts, payments.ts, reminders.ts, refunds.ts
sql/               built    000_roles, 001_schema, 002_integrity, 003_grants
tests/             built    domain, integration-pure, db, experiment
prisma/            stub     schema.prisma (not validated, section 4.2)
app/               planned  Next.js routes: staff, parent portal, API, webhook
worker/            planned  scheduler entry point calling src/db/reminders.ts and risk scan
src/ai/            planned  risk-explanation adapter (section 11)
```

### 5.2 Dependency rule

Dependencies point one way: `app` and `worker` call `src/db`, and `src/db` calls `src/domain`. `src/domain` imports only other domain files and Node's `crypto`. A lint rule in CI should fail the build if a domain file imports `pg`, `prisma`, `next` or reads the system clock.

### 5.3 Domain module contract

Every function is deterministic. Dates and the current time are arguments, never read from the clock.

| File | Exports | Used by |
| --- | --- | --- |
| `money.ts` | `divRound`, `paiseFromRupees`, `formatINR`, `equalInstalments`, `allocateProportional` | Plan creation, payment allocation, every screen |
| `dates.ts` | `daysBetween`, `addDays`, `maxDate`, `istDate`, `financialYear` | Status, ageing, refund deadline, receipt series |
| `status.ts` | `instalmentView` | Student and parent screens, reminders |
| `ageing.ts` | `bucketOf`, `ageingTotals` | Accounts dashboard |
| `gst.ts` | `splitGst` | Receipts, credit notes, Tally voucher |
| `refund.ts` | `computeRefund` | Refund screen and settlement |
| `risk.ts` | `riskScore` | Risk scan |
| `receiptNo.ts` | `formatDocNumber` | Payment and refund transactions |
| `webhook.ts` | `verifyWebhookSignature` | Webhook route |
| `tally.ts` | `receiptVoucherXml`, `voucherGuid` | Export job |

### 5.4 Database module contract

| File | Exports | Notes |
| --- | --- | --- |
| `pg.ts` | `configurePg` | Call once before any query |
| `tx.ts` | `withTx(pool, fn, options)` | READ COMMITTED by default; retries on error codes 40001 and 40P01, up to `maxAttempts` |
| `payments.ts` | `recordPayment`, `resolveUnmatched`, `rejectUnmatched`, `issueDoc`, `gstinOf` | The webhook transaction (section 8) |
| `reminders.ts` | `createReminders`, `reminderRun` | Section 9 |
| `refunds.ts` | `raiseRefund`, `approveRefund`, `settleRefund` | Section 10 |

### 5.5 Conventions

- One transaction per business action; the audit row is written in that transaction.
- Errors that the user can fix are returned as typed results; unexpected errors are thrown and roll back.
- No function outside `src/db` runs SQL.
- Tests carry the requirement they cover in their name (for example `TC-09`), so section 19 can be checked by searching the test files.

## 6. Data design

The schema has 28 tables in `sql/001_schema.sql`. It carries the money rules as constraints, so a wrong row is refused by the database no matter which code wrote it.

### 6.1 Tables by area

| Area | Tables |
| --- | --- |
| Organisation and people | `centres`, `batches`, `users`, `user_centres`, `students`, `guardians` |
| Fees | `student_fees`, `fee_plans`, `fee_plan_lines`, `instalments`, `instalment_heads` |
| Money | `payments`, `payment_allocations`, `receipt_counters`, `receipts` |
| Refunds | `refund_requests`, `refund_lines` |
| Reminders | `reminders` |
| Academic data and risk | `csv_uploads`, `academic_metrics`, `dropout_flags` |
| Consent, access and audit | `dpdp_consents`, `data_requests`, `audit_log`, `system_settings`, `otp_challenges`, `sessions` |
| Export | `tally_exports` |

### 6.2 Main relationships

| From | To | Meaning |
| --- | --- | --- |
| `student_fees` (one per student and head) | `students` | Gross, discount and a generated net per head (TUITION, HOSTEL, MESS) |
| `instalments` | `students`, `fee_plan_lines` | One row per due date; `unique (student_id, seq_no)` |
| `instalment_heads` | `instalments` | How each instalment splits across heads |
| `payments` | `students`, `instalments` | Both optional: an unmatched payment has neither |
| `payment_allocations` | `payments`, `instalments` | Which head of which instalment each rupee went to |
| `receipts` | `payments` | One receipt per payment, enforced by a partial unique index |
| `receipts` (credit note) | `refund_requests`, `receipts` | A credit note names its refund and its original receipt |
| `reminders` | `instalments` | `unique (instalment_id, trigger_type)`: five types, one row each |
| `dropout_flags` | `students` | At most one open flag per student |

### 6.3 Rules the database enforces

| Rule | How |
| --- | --- |
| Net fee is gross minus discount and never negative | `net_paise` is a generated column; check `discount_paise <= gross_paise` |
| Plan weights add to 10000 and match the line count | Deferred constraint trigger `fee_plan_lines_weights`, checked at commit so lines can be inserted one by one |
| An instalment's paid amount equals the sum of its allocations | Deferred triggers `alloc_matches_paid` and `paid_matches_alloc` |
| Paid never exceeds due | Check on `instalments` |
| CGST equals SGST, and the three parts sum to the gross | Two checks on `receipts` |
| One receipt per payment | Partial unique index `receipts_one_per_payment` |
| Receipt numbers are unique and at most 16 characters | `unique (gstin, fy, kind, number)` and a length check |
| An approver cannot be the raiser | `check (approved_by is null or approved_by <> raised_by)` on `refund_requests` |
| A settled refund has a date and a bank reference | Check on `refund_requests` |
| A cancelled instalment points to a refund | `check (cancelled_at is null or refund_id is not null)` |
| A queued payment has a reason | `check (match_status <> 'UNMATCHED_QUEUE' or reason_code is not null)` |
| A risk score equals the sum of its three factors | `check (risk_score = fee_factor + attendance_factor + test_factor)` |
| One open call task per student; one active consent per student, parent and purpose | Partial unique indexes `one_open_flag_per_student` and `one_active_consent` |
| A reminder marked sent has a time; a suppressed one has a time and a reason | Checks on `reminders` |
| Gateway ids are unique | `unique` on `gateway_payment_id` and on `gateway_event_id` |

The payment-sum trigger is the main safeguard against a double credit. If the cached `amount_paid_paise` ever disagrees with the allocation rows, the commit fails.

### 6.4 Append-only tables

`audit_log`, `receipts` and `payment_allocations` allow no update or delete. Privileges are revoked from `app_rw`, and the triggers `forbid_change` backstop the revoke for any other path, including `TRUNCATE` on the audit log. A reversal is a new row, never an edit.

`payments` is different (DD-02). The application may change only `match_status`, `student_id`, `instalment_id`, `reason_code`, `unallocated_paise` and `remarks`, which is what resolving a queued payment needs. The trigger `guard_payments` rejects any change to the amount, mode, gateway ids, dates or the reversal link, and any delete.

```sql
grant update (match_status, student_id, instalment_id,
              reason_code, unallocated_paise, remarks) on payments to app_rw;
```

### 6.5 Indexes

| Index | Serves |
| --- | --- |
| `instalments_open_due` on `due_date`, only rows with a balance and not cancelled | Reminder run, overdue list, ageing |
| `payments_queue` on `(match_status, received_on)` | Unmatched queue |
| `reminders_run` on `(state, scheduled_for)` | Daily reminder run |
| `payment_allocations (instalment_id)` and `(payment_id)` | Paid-sum check and receipt build |
| `otp_challenges (phone_hash, created_at)` | OTP rate limit |

At 2,600 students and a handful of instalments each, these tables stay small; no partitioning is needed.

### 6.6 Data kept small on purpose

- A guardian record holds an ID type and its last four characters only, never a full ID number (`id_last4`).
- OTP records store hashes of the phone number and the code, not the values.
- The risk table stores each factor separately, so a score can always be explained and checked.
- Instalment status is computed from amounts and dates (section 7.3). Only the cancelled state is stored, through `cancelled_at`.

### 6.7 Roles and grants

| Role | Select | Insert | Update | Delete |
| --- | --- | --- | --- | --- |
| `app_rw` | All tables | All tables | All except `audit_log`, `receipts`, `payment_allocations`; on `payments` only the six resolution columns | All except `audit_log`, `receipts`, `payment_allocations`, `payments` |
| `risk_scanner` | `students`, `batches`, `instalments`, `instalment_heads`, `student_fees`, `academic_metrics`, `payments`, `dpdp_consents`, `system_settings` | `dropout_flags` | `dropout_flags` | None |

The scanner reads `dpdp_consents` so it can skip students whose parent has not agreed to risk scoring.

## 7. Domain engine

Every rule in PRD section 7 is a pure function in `src/domain`, and each has a test with the PRD's own worked numbers. All 34 domain tests pass.

### 7.1 Integer arithmetic

Amounts are `bigint` paise. One helper does all rounding, so every screen, receipt and report rounds the same way.

```ts
/** Round-half-up integer division for non-negative n and positive d. */
export function divRound(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError('divisor must be positive');
  if (n < 0n) throw new RangeError('numerator must be non-negative');
  return (2n * n + d) / (2n * d);
}
```

`paiseFromRupees` accepts at most two decimals and rejects anything else. `formatINR` prints Indian digit grouping (₹1,20,000 and ₹12,34,567.50). `equalInstalments(total, n)` gives equal instalments with the last one taking the remainder, so the parts always add up to the total. `allocateProportional(amount, weights)` splits by largest remainder and sums exactly to the amount.

### 7.2 GST on a receipt

Fees are tax-inclusive at 18% (SAC 999293). With gross G and T as each half of the tax:

```latex
T = \operatorname{round}_{\text{half-up}}\!\left(\frac{9G}{118}\right) = \left\lfloor \frac{18G + 118}{236} \right\rfloor,\qquad \text{taxable} = G - 2T
```

CGST and SGST are always equal, and any odd paisa goes to the taxable value. The brief's method of rounding the taxable value and one tax separately is not symmetric: it gives unequal CGST and SGST on ₹30,000 and on ₹40,000. The test confirms both.

| Gross | Taxable | CGST | SGST |
| --- | --- | --- | --- |
| ₹15,000 | ₹12,711.86 | ₹1,144.07 | ₹1,144.07 |
| ₹30,000 | ₹25,423.72 | ₹2,288.14 | ₹2,288.14 |
| ₹33,333 | ₹28,248.30 | ₹2,542.35 | ₹2,542.35 |
| ₹40,000 | ₹33,898.30 | ₹3,050.85 | ₹3,050.85 |
| ₹1,20,000 | ₹1,01,694.92 | ₹9,152.54 | ₹9,152.54 |

A loop over every gross from 1 paisa to ₹1,000 (100,000 values) found no case where CGST differed from SGST, the three parts failed to sum to the gross, taxable went negative, or the result differed from the closed formula above.

### 7.3 Instalment status

Status is computed from the amounts, the due date and the date being viewed. Only the cancelled state is stored (`cancelled_at`). Let d be the as-of date minus the due date, so a positive d means late, and n the number of days until due.

| State | Condition | English label | Hindi label |
| --- | --- | --- | --- |
| `CANCELLED_ON_REFUND` | Cancelled by a refund; checked first | Cancelled | रद्द |
| `PAID` | Paid is at least the amount due (an overpayment still shows zero balance) | Paid | चुकाया गया |
| `UPCOMING` | d is 0 or less, nothing paid | Due in n days, or Due today | n दिन में देय, or आज देय |
| `PART_PAID_UPCOMING` | d is 0 or less, some paid | Part paid, due in n days | आंशिक भुगतान, then the same |
| `OVERDUE` | d is 1 or more, nothing paid | d days overdue | d दिन अतिदेय |
| `PART_PAID_OVERDUE` | d is 1 or more, some paid | Part paid, d days overdue | आंशिक भुगतान, then the same |

On the demo date, 2 November 2026: STU-0412 shows `PAID`; STU-0587 (₹30,000 due, ₹15,000 paid, due 10 October) shows `PART_PAID_OVERDUE`, 23 days late, balance ₹15,000; STU-0219 (₹40,000 due 15 November) shows `UPCOMING`, due in 13 days.

### 7.4 Ageing

Only instalments with a balance are aged. The buckets are `NOT_DUE` (d is 0 or less), `D1_30`, `D31_60` and `D61_PLUS`. The test checks the boundaries at 0, 1, 30, 31, 60 and 61 days and that the buckets sum to the open balance.

### 7.5 Refund

For each head h with net fee N, course length T days, and e days elapsed (clamped between 0 and T):

```latex
\text{Consumed}_h = \operatorname{round}_{\text{half-up}}\!\left(\frac{N_h \cdot e}{T_h}\right),\qquad \text{Refund}_h = \max\bigl(0,\ \text{Paid}_h - \text{Consumed}_h\bigr)
```

The clock starts on the later of the batch start and the enrolment date. Each head is floored at zero on its own, with no netting between heads. A shortfall is reported and never charged. The deadline is the date the request was received plus 10 days.

| Case | Paid | Elapsed | Consumed | Refund | Shortfall |
| --- | --- | --- | --- | --- | --- |
| A: full payer, tuition ₹1,20,000 | ₹1,20,000 | 180 | ₹60,000 | ₹60,000 | none |
| B | ₹90,000 | 216 | ₹72,000 | ₹18,000 | none |
| C | ₹75,000 | 216 | ₹72,000 | ₹3,000 | none |
| D | ₹30,000 | 0 | ₹0 | ₹30,000 | none |
| E | ₹60,000 | 216 | ₹72,000 | ₹0 | ₹12,000 |
| F: tuition ₹1,20,000 and hostel ₹60,000 | ₹90,000 and ₹30,000 | 216 | ₹72,000 and ₹36,000 | ₹18,000 | ₹6,000 (hostel) |

Cases A to E use a tuition fee of ₹1,20,000 over 360 days. Day 216 after 1 April 2026 is 3 November 2026, which gives a deadline of 13 November. Running Case C on the demo clock date, 2 November, gives 215 days, consumed ₹71,666.67 and a refund of ₹3,333.33. A loop over elapsed days 0 to 360 and five paid amounts confirmed that refund plus the lesser of paid and consumed always equals paid, and a refund is never negative.

### 7.6 Dropout risk score

The score is the sum of three integer factors. Percentages are held in hundredths (6900 means 69.00%), the benchmark is 80% and the floor is 65%. In the formulas, d is the worst overdue days, a is the attendance percentage, and the test term uses the oldest and latest of the last three tests.

```latex
F = \operatorname{round}\!\left(\frac{35\cdot\min(d,30)}{30}\right) + 5\,[\text{part paid}]
```

```latex
A = \begin{cases} 0 & a \ge 80 \\ 25 & a \le 65 \\ \operatorname{round}\!\left(\frac{25\,(80-a)}{15}\right) & \text{otherwise} \end{cases} \;+\; 10\,[\text{drop} > 10\text{ points}]
```

```latex
S = \operatorname{round}\!\left(\min\bigl(\max(0,\ t_{old}-t_{new}),\ 25\bigr)\right)
```

A task is created at 50 or more, and the flag is HIGH at 70 or more. The factor ranges are 0 to 40 for fees, 0 to 35 for attendance and 0 to 25 for tests, so the total never exceeds 100; the table `dropout_flags` has a check for each.

STU-0587 (23 days overdue, part paid; attendance 69%, down from 88%; tests 78% then 59%) scores 32 + 28 + 19 = 79, which is HIGH. The brief's figure of 94 cannot be reproduced from its own inputs, so this design uses the formula's value. Tests cover the thresholds on both sides (49 and 50, 69 and 70), a drop of exactly 10 points not counting, a score that rises with overdue days, and a total that never leaves 0 to 100.

### 7.7 Plans and allocation

A fee plan is a list of due dates with weights that sum to 10000. A plan of four equal instalments on ₹1,20,000 gives four of ₹30,000. An odd total such as 10,001 paise over four gives 2,500, 2,500, 2,500 and 2,501. Every payment is split across heads by largest remainder in proportion to what each head still owes, so the pieces add to the payment exactly (tested with 1, 2, 99, 1,000,001 and 3,000,000 paise against weights 120, 60 and 20).

### 7.8 Dates and document numbers

Dates are validated as real calendar dates: `2026-02-30` is rejected. `istDate` converts an instant to its IST calendar date by adding 330 minutes, so 23:50 IST on 2 November and 00:10 IST on 3 November land on the right days. The financial year runs April to March, so 31 March 2027 is `26-27` and 1 April 2027 is `27-28`.

Receipt numbers look like `RCP/26-27/000412` and credit notes like `CN/26-27/000012`. Each is 16 characters or fewer, as GST Rule 46 requires, and the serial is limited to 999,999 per series.

## 8. Payment processing

A payment either fully lands (payment, allocations, receipt, reminder changes, audit row) or leaves no trace. The code is `recordPayment` in `src/db/payments.ts`, and TC-04, TC-08 and TC-09 test it against a real PostgreSQL 16.

### 8.1 Steps in one transaction

The webhook route verifies the signature first (section 13). Everything below runs inside one `BEGIN` and `COMMIT`.

| Step | What happens | Why |
| --- | --- | --- |
| 1 | Decide whether the payment can be matched: it needs both a student and an instalment, the instalment must belong to the student, and it must not be cancelled | Reason codes `NO_REFERENCE`, `UNKNOWN_STUDENT`, `CANCELLED_INSTALMENT` |
| 2 | Insert the payment with `ON CONFLICT (gateway_payment_id) DO NOTHING`; if no row came back, return `DUPLICATE` | A retry or a second delivery credits nothing |
| 3 | If step 1 found a reason, store the payment as `UNMATCHED_QUEUE`, write an audit row and stop | No balance changes, nothing is guessed |
| 4 | Lock the student's open instalments in order of due date, then sequence | One fixed lock order, so two payments cannot deadlock (DD-06) |
| 5 | Pay the target instalment first, then later ones in date order; within an instalment, split across heads in proportion to what each head still owes | Spill-over for overpayments; rupee-exact split |
| 6 | Update each instalment with `where version = $expected`; if no row changes, raise 40001 | Guards against a lost update |
| 7 | Take the next serial for the centre's GSTIN, financial year and kind; insert the receipt with the GST split | Gapless numbers (section 8.3) |
| 8 | For instalments that became fully paid, mark their queued reminders `SUPPRESSED_BY_PAYMENT` with reason `PAID_IN_FULL` | A part payment leaves reminders running |
| 9 | Record any amount no instalment could take in `unallocated_paise`; write the audit row | Overpayment excess is visible, not lost (DD-05) |

If there are no open dues at all, the payment is stored as `UNMATCHED_QUEUE` with reason `NO_OPEN_DUES` and its full amount unallocated.

### 8.2 Key statements

```sql
-- step 2: idempotent insert
insert into payments(...) values (...)
  on conflict (gateway_payment_id) do nothing returning id;

-- step 4: lock in a fixed order
select id, due_date, amount_due_paise, amount_paid_paise, version
  from instalments
 where student_id = $1 and cancelled_at is null and amount_paid_paise < amount_due_paise
 order by due_date, seq_no for update;

-- step 6: optimistic check
update instalments set amount_paid_paise = amount_paid_paise + $1, version = version + 1
 where id = $2 and version = $3;

-- step 7: gapless serial inside the same transaction
insert into receipt_counters(gstin, fy, kind, last_no) values ($1,$2,$3,1)
  on conflict (gstin, fy, kind) do update set last_no = receipt_counters.last_no + 1
  returning last_no;
```

### 8.3 Isolation level: measured

The PRD asked for SERIALIZABLE. Every receipt updates one counter row, so under SERIALIZABLE concurrent payments conflict constantly. The same workload was run both ways.

| Setting | Workload | Result |
| --- | --- | --- |
| READ COMMITTED with row locks | 200 payments at once | 200 succeeded; serials 1 to 200, no gap or duplicate; 872 ms |
| READ COMMITTED with row locks | 50 payments at once (TC-09) | Serials 1 to 50, no gap or duplicate; about 314 ms |
| SERIALIZABLE | 50 payments at once, 8 attempts each | 31 succeeded, 19 failed with a serialization error; the serials that did commit were still contiguous |

READ COMMITTED makes concurrent payments queue on the counter row instead of failing. Correctness comes from the locks, the version check and the deferred database triggers, not from the isolation level (DD-01). `withTx` retries only on 40001 and 40P01, so a rare conflict is retried and anything else rolls back and is thrown. FR-PAY-04 allows up to three retries; the reference default is eight because the SERIALIZABLE experiment needed it, so production should pass `maxAttempts: 3`.

### 8.4 What the tests show

| Behaviour | Result |
| --- | --- |
| STU-0587 pays ₹15,000 against a ₹30,000 instalment | ₹15,000 allocated, receipt issued, all five reminders still queued |
| STU-0587 pays the final ₹15,000 | Instalment becomes `PAID`; all five reminders suppressed in the same commit with the paying payment's id; receipt `RCP/26-27/000004` is ₹15,000 = ₹12,711.86 + ₹1,144.07 + ₹1,144.07 (three earlier receipts had taken 1 to 3) |
| Same gateway payment id delivered again | `DUPLICATE`; credited once |
| Same id delivered 10 times in parallel | One `MATCHED`, nine `DUPLICATE`; credited once, one receipt |
| Failure injected after the payment insert, after allocations, after the receipt, and after the reminder update | No payment row, no allocation, no receipt, reminders unchanged, counter unchanged; the next payment gets the number the failed one would have taken |
| ₹45,000 paid against a ₹30,000 instalment | ₹30,000 to the target and ₹15,000 spills into the next instalment |
| ₹35,000 paid when only ₹30,000 is still open | ₹30,000 allocated and receipted; ₹5,000 stored in `unallocated_paise` |
| Any payment when nothing is open | Queued as `NO_OPEN_DUES` |
| Payment with no reference | Queued as `NO_REFERENCE`; no balance changes and no receipt number used |
| Payment naming a student that does not exist | Queued as `UNKNOWN_STUDENT` |
| Accounts resolves a queued payment | Receipt issued, status `RESOLVED`; resolving it again fails with "not in queue" |
| Accounts rejects a queued payment | Status `REJECTED`; both actions leave audit rows |

### 8.5 Outcomes returned to the caller

| Outcome | Meaning | Webhook response |
| --- | --- | --- |
| `MATCHED` | Allocated and receipted; includes receipt number, allocated and unallocated amounts, and the instalments paid in full | 200 |
| `QUEUED` | Stored for accounts, with a reason | 200 |
| `DUPLICATE` | Already processed | 200 |
| Exception | Rolled back | 500, so the gateway retries |

### 8.6 Known limits

- A refund that cancels an instalment between step 1 and step 4 is handled by skipping cancelled rows, so the money goes to the next open instalment and the named target is not paid first. This race was not tested.
- A reversal (a negative payment) and a bank-transfer import are in the schema (`reverses_payment_id`, `mode`) but have no code in the reference build.
- The receipt's issue date is the payment's received date (an IST calendar date), not the date the transaction ran.
- The matching rule uses the student and instalment ids the gateway returns. How those ids reach the gateway order is in section 13.4.

## 9. Reminders

Reminders chase the balance that is owed now, never one that was true last week. The code is `createReminders` and `reminderRun` in `src/db/reminders.ts`, tested by TC-07.

### 9.1 Creating reminders

When an instalment is created, five reminder rows are inserted, one per trigger. A trigger whose date is already past is skipped, so a late enrolment does not send old reminders.

| Trigger | Sent on |
| --- | --- |
| `T_MINUS_7` | 7 days before the due date |
| `T_ZERO` | The due date |
| `T_PLUS_3` | 3 days after |
| `T_PLUS_7` | 7 days after |
| `T_PLUS_15` | 15 days after |

The table has `unique (instalment_id, trigger_type)`, and the insert uses `ON CONFLICT DO NOTHING`, so creating reminders twice is safe. Each row records its channel (`WHATSAPP` or `SMS`), the parent's language and a template code such as `fee_t_zero_hi`.

### 9.2 The daily run

The worker starts the run at 10:00 IST. For each run:

1. If the clock is `DEMO`, send nothing. The demo date is for showing screens and must never message a real parent.
2. Lock queued reminders scheduled for today or yesterday. The one-day look-back catches a run that failed yesterday.
3. Take at most one reminder per instalment, the latest scheduled. A parent whose run was missed does not receive the plus-3 and plus-7 messages together (DD-07).
4. Compute the instalment's live status. If it is `PAID` or cancelled, suppress every queued reminder for it (reason `PAID_IN_FULL` or `REFUND`) and send nothing.
5. If any payment was allocated to the instalment in the last 24 hours, skip it and leave the reminder queued, so a parent who has just paid is not chased.
6. Otherwise build the message from the live balance and status, mark the row `SENT` with `sent_at`, and return it for delivery.

The message uses the balance at send time. Part-paying ₹15,000 of ₹30,000 changes the next reminder from ₹30,000 to ₹15,000.

```text
hi: शुल्क शेष ₹15,000 — आंशिक भुगतान, 23 दिन अतिदेय
en: Fee balance ₹15,000 — Part paid, 23 days overdue
```

### 9.3 What the test shows

| Check | Result |
| --- | --- |
| Run with the demo clock | Nothing sent |
| Live run on 3 October | Messages go out, each showing ₹30,000 |
| Second live run five minutes later | The same reminder is not sent again |
| ₹15,000 part payment | No reminder suppressed; all five stay queued |
| Run on the due date, within 24 hours of that payment | Skipped and counted as quiet; the due-date reminder stays queued |
| Run 25 hours after the payment | Sent with ₹15,000 and the Hindi text |

### 9.4 Gaps the reference build leaves

These are specified here and were not built or tested.

- **Consent.** The run must also send only where the primary guardian has an active `WHATSAPP_REMINDERS` consent, and suppress with reason `CONSENT_WITHDRAWN` when consent is withdrawn (the column allows it). The reference run does not read consent.
- **Delivery failure.** The reference marks a row `SENT` before delivery. In production the worker should send after the commit, then record the provider message id, or set `FAILED` with the error and retry on the next run inside the one-day window.
- **Stale rows.** A queued reminder older than the look-back window is never picked up. A nightly step should move such rows to `FAILED` with the error `MISSED`, so the dashboard does not show them as pending.
- **Call task after the last reminder.** FR-REM-06 turns an unpaid instalment into a call task for accounts after the plus-15-day reminder, with no further automatic message. The reference has no code for it; it needs a step in the run that creates the task once per instalment.
- **Template approval.** WhatsApp business messages need provider-approved templates. The text above shows the content; the delivery module sends the template code and the values (balance, status, instalment date).
- **Provider.** No messaging provider is chosen (open item O-04). SMS is the fallback channel the schema already supports.

## 10. Refunds

A refund moves through three steps, and each one is a single transaction: raise, approve, settle. The code is `raiseRefund`, `approveRefund` and `settleRefund` in `src/db/refunds.ts`, tested end to end by TC-12 on Case C.

### 10.1 States

| Status | Set by | Database rule |
| --- | --- | --- |
| `DRAFT` | Raise (accounts) | `sla_due_date` is on or after `received_on` |
| `APPROVED` | Approve (Director) | Needs `approved_by`, and `approved_by` must differ from `raised_by` |
| `SETTLED` | Settle (accounts) | Needs `settled_on` and `bank_reference` |
| `REJECTED` | Reject | Status exists; the reference build has no code for it |

### 10.2 Raise

The transaction reads the student's fee heads and what has actually been allocated to each head, then calls `computeRefund` (section 7.5). It stores the request with its elapsed days, deadline, refundable amount and shortfall, one `refund_lines` row per head (net, paid, consumed, refund), and an audit row. Nothing about the student or the instalments changes yet.

In the test, Case C is raised on 3 November with ₹75,000 paid. It gives 216 days elapsed, a refund of ₹3,000 and a deadline of 13 November.

### 10.3 Approve

Only a request in `DRAFT` can be approved, and the row is locked while it is read. Then, in one transaction:

1. The request becomes `APPROVED`. The database check rejects the update if the approver is the person who raised it. The test confirms that the accounts user cannot approve their own request.
2. Every instalment of the student that is not cancelled and still has a balance is cancelled, with the refund id recorded.
3. Queued reminders on those instalments are suppressed with reason `REFUND`.
4. The student becomes `WITHDRAWN` with the withdrawal date.
5. An audit row is written.

Money already paid stays on the ledger: an instalment that was part paid keeps its paid amount after it is cancelled. In the test, two instalments were cancelled, ten reminders were suppressed (five on each), and a later payment aimed at a cancelled instalment was queued with the reason `CANCELLED_INSTALMENT`.

### 10.4 Settle

Only an approved request can be settled. The transaction records the payout date, mode and bank reference, and issues a credit note from its own counter (kind `CREDIT_NOTE`), so receipt numbers are not disturbed. The credit note splits the refund with the same GST function as a receipt.

| Check | Result |
| --- | --- |
| Credit note number (tested) | `CN/26-27/000001` |
| Receipt counter after settlement (tested) | Still 3; credit notes do not use it |
| Credit note for ₹3,000 (tested) | Taxable ₹2,542.38, CGST ₹228.81, SGST ₹228.81 |
| Refund of zero (by the code, not tested) | Settles with no credit note |

The credit note names the student's most recent receipt as its original (DD-08); the other receipts are not listed on it. Whether that is acceptable, and how hostel and mess fees are taxed, is an open question for the accountant (O-02).

### 10.5 Gaps the reference build leaves

- **Role check.** The database stops an approver being the raiser, but it does not check that the approver is a Director. The API must enforce the role (section 12), and a trigger that reads `users.role` for `approved_by` is a cheap second guard worth adding.
- **Stale amount.** The refund is computed when raised and not recomputed on approval. If a payment arrives between the two, the amount is out of date. Approval should recompute from current allocations and refuse if the result differs.
- **State name.** Reminders suppressed by a refund use the state `SUPPRESSED_BY_PAYMENT` with reason `REFUND`; the reason is what distinguishes them. A rename of the state would be clearer but changes the schema checks.
- **Reject and reversal.** Rejection, and returning a refund to a gateway, are not built.

## 11. Dropout risk scan and the AI adapter

The score and the call task come from the formula in section 7.6. An AI model, if one is used at all, only drafts the wording of a call guide and cannot change a number. The formula is built and tested; the scan job and the adapter are designed here and not built.

### 11.1 The scan job

The scan runs at 06:00 IST every day and on demand from the dashboard (PRD 9.5), as the `risk_scanner` database role. That role can read fee, attendance and score data and write only `dropout_flags` (section 6.7).

| Input to `riskScore` | Taken from |
| --- | --- |
| `worstOverdueDays` | The largest days-late among the student's open instalments, using the status rules in section 7.3 |
| `partPaid` | The most overdue instalment has some payment against it |
| `attendanceBp`, `prevAttendanceBp` | The two most recent periods in `academic_metrics` |
| `testOldBp`, `testNewBp` | Oldest and latest of the student's last three tests |
| Benchmark, task threshold, high threshold | `system_settings`, defaulting to 80%, 50 and 70 |

For each active student with an active `RISK_SCORING` consent:

1. Compute the score and its three factors.
2. If the score is 50 or more and the student has no open flag and is not inside a `suppressed_until` window, insert a flag with status `OPEN_CALL_TASK`.
3. If an open flag exists, update its score, factors and inputs. Do not close it automatically; counsellors close tasks.
4. Store the exact inputs in `inputs_json`, so the number can be reproduced later.

The partial unique index `one_open_flag_per_student` makes a second open flag impossible even if two scans overlap.

### 11.2 Counsellor actions

| Action | Rule |
| --- | --- |
| Mark contacted | `task_status` becomes `CONTACTED` |
| Mark as false positive | Needs a reason (`APPROVED_MEDICAL_LEAVE`, `FAMILY_EVENT` or `SCORE_ENTRY_CORRECTION`), the counsellor, and a `suppressed_until` date 14 days ahead (FR-RSK-06); the check on `dropout_flags` rejects the update without them |

Every action writes an audit row.

### 11.3 The AI adapter

The model drafts a three-point call guide in English and in Hindi for the counsellor (FR-RSK-07). It is optional: the template guide is always available. The adapter is one function behind an interface, so a model can be swapped or switched off without touching the scan.

```ts
interface GuideInput { factors: { fee: number; attendance: number; test: number }; total: number; daysOverdue: number; severity: string }
interface Guide { pointsEn: [string, string, string]; pointsHi: [string, string, string]; modelName: string | null; templateUsed: boolean }
callGuide(input: GuideInput): Promise<Guide>   // never throws; falls back to the template guide
```

- **The score is stored first.** The flag row is committed with its numbers before the adapter is called, so a model failure cannot lose or alter a flag.
- **Only de-identified numbers leave the system.** The prompt holds the three factors, the total and the days overdue. It holds no name, phone number, address or student code; the counsellor sees the name from the database, not from the model.
- **Output must pass a schema check.** Three points in English and three in Hindi, each under a set length (default 160 characters). Anything else uses the template.
- **Template fallback.** A four-second timeout, a missing key, a retired model, a failed check or any error uses the template guide, and the scan still completes. A setting in `system_settings` switches the model off, leaving the template as the only path.
- **The model has no tools and no database access.** Its reply is parsed as plain text against the schema and never executed, so a reply containing instructions changes nothing (TC-11).
- **Storage.** The three points go into `rationale_en` and `rationale_hi`; the row records `template_used` and `model_name`.

The provider and model name are read from configuration, because model names are retired faster than code changes: the PRD notes that the Gemini 2.5 Flash Developer API had a shutdown date of 16 October 2026. No provider is chosen (open item O-05). Sending any student-related data to an outside provider needs a line in the privacy notice (section 12.4).

### 11.4 Known differences from the brief

The brief's example score of 94 for STU-0587 cannot be reproduced from its stated inputs; the formula gives 79 (32 + 28 + 19), still HIGH. Because the factors are stored separately, a counsellor can always see why a score is what it is.

## 12. Identity, authorisation and consent

Every check runs on the server, and what a person may see is read from the database on each request, never from the token. This section is designed to PRD sections 4, 6.1, 6.2 and 8.3. It is not built in the reference code, apart from the database parts: the tables, the hash columns, the append-only audit log and the role grants.

### 12.1 Sign-in with a one-time code

Parents and staff both sign in with a mobile number and a six-digit code. There are no passwords (PRD 9.6). The limits below are the PRD's (FR-AUTH-01, FR-AUTH-02).

| Rule | Design |
| --- | --- |
| Code | Six digits from `crypto.randomInt`, never `Math.random` |
| Storage | `code_hash` is an HMAC-SHA256 of the phone number and code under a server secret, and `phone_hash` is an HMAC of the number. A plain hash of six digits could be reversed in a second |
| Lifetime | 5 minutes (`expires_at`); one use (`consumed_at`) |
| Wrong tries | Each wrong code adds one to `attempts`; at 5 the number is locked for 15 minutes |
| Issue limit | At most 5 codes per number per hour, counted from `otp_challenges (phone_hash, created_at)` |
| Unknown number | Same reply and the same code path as a known number: a challenge row is created and the same hashing runs, and only the message send is skipped. Neither the text nor the timing shows whether the number exists |
| Demo mode | The on-screen code and the role switcher exist only when `DEMO_MODE` is true, and the production build is compiled without them (FR-AUTH-06, TC-23) |

The lock is applied while any challenge created in the last 15 minutes has 5 failed attempts. That ends up to 15 minutes after the challenge was made, a little sooner than 15 minutes after the fifth wrong try. If the exact period matters, add a `locked_until` column.

### 12.2 Sessions

- After a correct code the server inserts a `sessions` row (`issued_at`, `expires_at`) and sets a cookie holding a token signed with `jose`. The token carries only the session id and its expiry.
- The cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
- A parent session lasts 14 days and a staff session 8 hours (FR-AUTH-03).
- On every request the server reads the session row (not revoked, not expired), the user (`is_active`) and the user's centres. Role and scope come from those rows, so removing a centre or deactivating a user takes effect on the next request.
- Changing a registered number needs a new code on the new number; all the user's sessions are then revoked (`revoked_at`) and the change is audited (FR-AUTH-05).
- State-changing routes accept only `POST` with a matching origin. The webhook is the exception and is protected by its signature instead.

### 12.3 Authorisation

One function decides every request. A route names a capability, and the function returns allow or deny from the user's role and the target's student and centre. A denial returns 403 and writes an audit row (PRD section 4, FR-AUTH-04).

| Capability | Parent | Accounts | Counsellor | Director |
| --- | --- | --- | --- | --- |
| `dues.view` | Own | Centre | Days overdue and status only | All |
| `payment.start` | Own | No | No | No |
| `receipt.view` | Own | Centre | No | All |
| `payment.record_offline` | No | Centre | No | No |
| `payment.resolve` | No | Centre | No | All, read only |
| `reminders.view` | No | Centre | No | All, read only |
| `refund.raise` | No | Centre | No | No |
| `refund.approve` | No | No | No | Yes |
| `academic.view` | Own | Centre | Centre | All |
| `academic.upload` | No | Centre | Centre | No |
| `risk.view` | No | No | Centre | All |
| `risk.close` | No | No | Centre | No |
| `tally.export` | No | Centre | No | All |
| `settings.change` | No | No | No | Yes |
| `audit.read` | No | No | No | Yes |
| `consent.manage` | Own | Log on behalf | No | No |

"Own" means students linked to the signed-in parent through a verified `guardians` row. "Centre" means the centres in `user_centres`. A counsellor's dues response is a separate, narrower shape that has no amounts in it, so there is no field to leak. A single test walks every role against every capability and route and compares the result with this table (TC-10); the table lives in code as data so the test and the guard cannot disagree.

### 12.4 Consent and data rights

| Item | Design |
| --- | --- |
| Before any child data | The portal shows only the consent screen until the parent has an active `CORE_EDUCATION_FEES` consent (FR-CNS-01). The notice is shown in English and Hindi, and the row stores parent, student, notice version, language shown, time and the choice |
| Link to an adult | The signing-in number belongs to a `guardians` row made at admission, with the identity type and last four characters only (FR-CNS-02) |
| Purposes | `CORE_EDUCATION_FEES`, `WHATSAPP_REMINDERS`, `RISK_SCORING`, each recorded separately |
| Two parents | Each parent consents on their own; one parent's withdrawal leaves the other's access in place, and `one_active_consent` allows one active row per student, parent and purpose (FR-CNS-05) |
| Withdrawal | One tap in settings sets `withdrawn_at`. In the same transaction, queued reminders for that student are suppressed with reason `CONSENT_WITHDRAWN`, and an audit row is written (FR-CNS-03) |
| Correction or erasure | Creates a `data_requests` row with a due date and shows its status to the parent. Erasure never removes receipts or credit notes, which are kept for at least 72 months (FR-CNS-04, FR-RCP-06) |
| Footer | A contact and a grievance link on every parent screen (PRD 8.3) |

The PRD flags that the risk score may not be allowed for children's data under the DPDP Act (open question D-02 for counsel). The design therefore ships the scan behind a setting that is off until counsel has answered. The consent purpose and the scanner's consent check are in place for when it is switched on.

### 12.5 Audit

Sign-in, every role denial, payments, resolutions, refunds, exports, flag changes, consent changes and settings changes each write an `audit_log` row with actor, role, action, target, before, after, time and request id (FR-AUD-01). The table is append-only at the database (section 6.4), and the log carries no OTP codes or full phone numbers.

## 13. API contracts

The web application exposes JSON routes under `/api`, validated with zod at the edge. The money-moving routes call the tested functions in `src/db`. The route layer is designed here and not built; the webhook rules are checked against the gateway's documentation.

### 13.1 Conventions

| Topic | Rule |
| --- | --- |
| Amounts | Integer paise as a string in JSON (`"1500000"`), so no client rounds or loses precision above 2^53. Screens format them with `formatINR` |
| Dates | `YYYY-MM-DD` IST calendar dates; timestamps are ISO 8601 in UTC |
| Errors | `{ "error": { "code": "REFUND_SELF_APPROVAL", "messageEn": "...", "messageHi": "...", "requestId": "..." } }` |
| Status codes | 400 invalid input or bad webhook signature; 401 no session; 403 denied by role or scope (audited); 404 unknown id inside the caller's scope; 409 version conflict after retries; 422 business rule (cash limit, part payment below the minimum); 429 rate limit |
| Request id | Generated per request, written to the audit row and the structured log, and returned in a header |
| Concurrency | Writes to an instalment use the `version` column; a conflict retries and then returns 409 (FR-LED-10) |
| Language | Every error and status has English and Hindi text, chosen by the user's `preferred_lang` |

### 13.2 Routes

| Method and path | Capability | What it does |
| --- | --- | --- |
| `POST /api/auth/otp/request` | none | Issue a code (section 12.1); same reply for any number |
| `POST /api/auth/otp/verify` | none | Check the code, create a session and cookie |
| `POST /api/auth/logout` | any | Revoke the session |
| `GET /api/me/dues` | `dues.view` | Everything the parent's dues card needs in one call: students, instalments with status and balance, the next due date |
| `POST /api/pay/orders` | `payment.start` | Create a gateway order for an instalment and an amount (13.4) |
| `GET /api/receipts/:id` | `receipt.view` | Receipt as HTML or PDF, English or Hindi |
| `POST /api/consent` | `consent.manage` | Record a consent choice for a purpose |
| `POST /api/consent/:id/withdraw` | `consent.manage` | Withdraw; suppresses queued reminders |
| `POST /api/data-requests` | `consent.manage` | Open a correction or erasure request |
| `GET /api/dues` | `dues.view` | Staff dues table, filtered by centre, batch and ageing bucket |
| `GET /api/students/:id/ledger` | `dues.view` | Plan, discount, instalments, payments, receipts |
| `POST /api/payments/offline` | `payment.record_offline` | Cash, cheque or bank transfer; mode and reference required; refuses cash of ₹2,00,000 or more from one person in a day |
| `GET /api/payments/queue` | `payment.resolve` | Unmatched payments, and matched payments with an unallocated amount |
| `POST /api/payments/:id/resolve` | `payment.resolve` | Resolve a queued payment to a student and instalment (`resolveUnmatched`) |
| `POST /api/payments/:id/reject` | `payment.resolve` | Reject with a reason (`rejectUnmatched`) |
| `GET /api/reminders` | `reminders.view` | The outbox with state and, for suppressed rows, the receipt that stopped them |
| `POST /api/refunds` | `refund.raise` | Compute and raise (`raiseRefund`) |
| `POST /api/refunds/:id/approve` | `refund.approve` | Approve (`approveRefund`); 403 if the caller raised it |
| `POST /api/refunds/:id/settle` | `payment.resolve` | Record payout and issue the credit note (`settleRefund`) |
| `POST /api/uploads/attendance`, `/tests` | `academic.upload` | CSV; all rows or none |
| `GET /api/risk/flags` | `risk.view` | Flags with the three factors and their raw inputs |
| `POST /api/risk/flags/:id/contacted`, `/false` | `risk.close` | Close a task, or mark false with a reason |
| `POST /api/exports/tally` | `tally.export` | Generate Tally XML and CSV for a date range |
| `GET /api/audit` | `audit.read` | Read the log |
| `PUT /api/settings/:key` | `settings.change` | Change a setting; audited with before and after |
| `POST /api/webhooks/razorpay` | signature | Gateway events (13.3) |
| `POST /api/jobs/:name` | job secret | Scheduled work (section 17) |

The refund settlement route uses the accounts capability `payment.resolve` because the PRD's matrix gives accounts staff both queue and settlement work and has no separate settlement row; confirm this with the client.

### 13.3 The payment webhook

The route is `POST /api/webhooks/razorpay`. Steps:

1. Read the raw body with `await req.text()`. Do not call `req.json()` first, because a re-serialised body no longer matches the signature.
2. Check the `X-Razorpay-Signature` header with `verifyWebhookSignature(body, signature, secret)`, which computes an HMAC-SHA256 of the raw body under the webhook secret and compares in constant time. On failure return 400 and change nothing (FR-PAY-02).
3. Parse the body with zod. If the event is not `payment.captured`, return 200 without doing anything.
4. Build a `PaymentEvent` and call `recordPayment` (section 8). Return 200 for `MATCHED`, `QUEUED` and `DUPLICATE`; let an exception return 500 so the gateway retries.

| Field of the event | Used as |
| --- | --- |
| Header `x-razorpay-event-id` | `eventId` (unique per event) |
| `payload.payment.entity.id` | `gatewayPaymentId`, the idempotency key |
| `payload.payment.entity.amount` | `amount`, in paise (the gateway's sample shows 70000 for ₹700) |
| `payload.payment.entity.order_id` | Looked up in our own order table to find the student and instalment |
| `payload.payment.entity.created_at` | Unix seconds; converted with `istDate` to `receivedOn` |

The signature header, the HMAC-SHA256 over the raw body, the unique event-id header, and the warnings that an event can be delivered more than once and out of order are all stated on [Razorpay's webhook validation page](https://razorpay.com/docs/webhooks/validate-test/). The field names above match the sample payloads on [Razorpay's payment events page](https://razorpay.com/docs/webhooks/payments/). Neither page states the retry schedule or which status code the gateway expects, so returning 200 on success and 500 on failure is an assumption to confirm in the sandbox (O-06).

Only `payment.captured` creates a payment (DD-10). A `payment.authorized` event is ignored, because an authorised payment can still fail to capture and the two events can arrive in either order.

### 13.4 Binding a payment to a student

A payment is matched only through data our server created. The route `POST /api/pay/orders` checks the caller's scope and the amount (at least the minimum in settings, default ₹500, and at most the balance; FR-PAY-01), creates the gateway order, and stores the order id with the student, the instalment and the amount in a `payment_orders` table. The webhook looks the order id up in that table.

Identifiers that the browser can set, such as the notes in the checkout options, are not trusted for matching, because the payer could change them. A payment whose order id is missing or unknown goes to the queue as `NO_REFERENCE`, as does a bank transfer with no usable reference.

The `payment_orders` table is a design addition that is not in the 28-table reference schema (DD-11). It holds `order_id` (unique), `student_id`, `instalment_id`, `amount_paise`, `created_by` and `created_at`, and it is insert-only for the application role.

### 13.5 Idempotence and safe retries

- A repeated gateway payment id returns 200 and credits nothing, enforced by the unique constraint (FR-PAY-03).
- `POST /api/pay/orders` accepts an `Idempotency-Key` header, so a double tap creates one order.
- Job routes are safe to call twice: the reminder run claims each row once, and a rerun the same day sends nothing.

## 14. Frontend design

The screens are server-rendered Next.js pages that read through the same functions the API uses, with small client components only where a screen needs interaction. The frontend is designed here and not built; the rules below come from PRD sections 5, 6.10 and 9.1.

### 14.1 Screens and routes

| # | Route | Role | Data and main parts |
| --- | --- | --- | --- |
| 1 | `/login` | All | Phone, code, then the consent step for parents; the demo bar only when `DEMO_MODE` is on |
| 2 | `/parent/dashboard` | Parent | Dues card first; then ledger, receipts, attendance and scores |
| 3 | `/parent/pay/[id]` | Parent | Full or part amount, checkout, then the receipt and the reminders it stopped |
| 4 | `/admin/dashboard` | Accounts, Director | Four summary cards, table filtered by centre, batch and ageing bucket, CSV upload, Tally export |
| 5 | `/admin/students/[id]` | Accounts | One student's full ledger and the unmatched queue actions |
| 6 | `/admin/reminders` | Accounts | Outbox: queued, sent, failed, suppressed; each suppressed row links to its receipt |
| 7 | `/admin/refunds` | Accounts, Counsellor, Director | Refund calculator, approval, ten-day countdown; counsellor call tasks with factor bars and a false-flag button |

A route that a role may not open returns 403 from the same authorisation function as the API (section 12.3); hiding a link is never the control.

### 14.2 The dues card

The first parent screen has one job: show what is owed and let the parent pay. On a 360 by 800 phone, without scrolling, it shows the balance, the next due date with its status text, and a full-width pay button (FR-UI-02). The status text comes from `instalmentView`, in the parent's language. The card needs one data call, `GET /api/me/dues`, which on the server is a direct function call during rendering.

Targets are at least 44 pixels high, and text stays readable at 200% zoom (FR-UI-05).

### 14.3 Language

- A visible EN and Hindi toggle sits on every screen (FR-UI-01). The choice is stored on the user (`preferred_lang`) and in a cookie before sign-in.
- Strings live in one dictionary per language. A test fails the build when a key is missing from either one (TC-17).
- Rupee amounts and dates use Indian formats (`formatINR`, for example ₹1,20,000) in both languages.
- To avoid layout shift on toggling, labels sit in boxes whose height does not depend on the script, and the Devanagari font is subset and preloaded so the page never swaps fonts after load.
- Receipts print in the language chosen when they were issued and can be reprinted in the other.

### 14.4 Performance budget

These are the PRD's design targets, not measurements (PRD 9.1):

| Target | Value |
| --- | --- |
| Parent dues card usable | Within 2.5 seconds on a mid-range Android phone on 4G |
| First parent screen JavaScript | Under 170 KB compressed |
| Data calls for the dues card | One |

Pages render on the server, the parent bundle imports no admin code, and no charting or date library is loaded on the first screen. The build report is checked in CI against the 170 KB limit.

### 14.5 States and quality gates

| Gate | How it is built | Test |
| --- | --- | --- |
| Loading, empty and error on every screen | Each route has a loading file, an error file and an empty-state component (FR-UI-04) | Playwright visits each state |
| No dead buttons | Every control has a handler or a link | A crawl clicks every control on all seven screens as each role (TC-21) |
| Accessibility | WCAG 2.2 AA contrast, 44-pixel targets | An automated check on all seven screens (TC-22); the package is chosen at build time and was not verified here |
| No demo features in production | The demo bar, on-screen code and clock switch are compiled out when `DEMO_MODE` is false | A build check searches the production bundle for them (TC-23) |
| Clock banner | A banner shows whenever the 2 November 2026 anchor is active (FR-LED-06) | Screenshot test |
| Viewports | 360 by 800, tablet and desktop | Playwright projects |

### 14.6 Receipts

A receipt is an HTML page with a print stylesheet for A4 and a narrow layout for phones. It shows the centre's legal name, GSTIN, registration number and address, the student, parent, batch, course period, fee head, taxable value, CGST, SGST, total, mode, date and number (FR-RCP-01). It is built from the receipt row and its stored `snapshot_json`, never recomputed, so it cannot change after issue.

The reference build writes a minimal snapshot (student id, centre code and the amount taken from each instalment). Production must also store, at issue time, the names, batch, course period, per-head amounts and the centre's legal name, registration number and address, so a later edit to any of them cannot alter an old receipt. Generating a PDF file on the server is not specified; the browser's print-to-PDF covers the PRD.

## 15. Tally export

Accounts exports receipts as a Tally XML file that its accountant imports by hand. The receipt vouchers are built and tested; credit-note vouchers, the CSV and the real import are not.

### 15.1 Voucher shape

Each receipt becomes one `Receipt` voucher. The bank or clearing ledger is debited, and the fee, CGST and SGST ledgers are credited. Tally's sign rule is that a debited ledger is marked `ISDEEMEDPOSITIVE` Yes with a negative amount, a credited ledger is marked No with a positive amount, and the voucher adds up to zero. This matches the samples in [Tally's help](https://help.tallysolutions.com/scenario-2/). This is the XML the code produced for receipt `RCP/26-27/000412` of ₹15,000 (indented here for reading; the file has no extra whitespace):

```xml
<VOUCHER VCHTYPE="Receipt" ACTION="Create" GUID="9be2ee29-1ee1-bbc7-e4b4-f6b50435b098">
  <DATE>20261102</DATE>
  <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
  <VOUCHERNUMBER>RCP/26-27/000412</VOUCHERNUMBER>
  <NARRATION>Fee STU-0587 UPI</NARRATION>
  <ALLLEDGERENTRIES.LIST><LEDGERNAME>Razorpay Clearing</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-15000.00</AMOUNT></ALLLEDGERENTRIES.LIST>
  <ALLLEDGERENTRIES.LIST><LEDGERNAME>Coaching Fees</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>12711.86</AMOUNT></ALLLEDGERENTRIES.LIST>
  <ALLLEDGERENTRIES.LIST><LEDGERNAME>Output CGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>1144.07</AMOUNT></ALLLEDGERENTRIES.LIST>
  <ALLLEDGERENTRIES.LIST><LEDGERNAME>Output SGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>1144.07</AMOUNT></ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

### 15.2 Rules in the code

| Rule | Implementation |
| --- | --- |
| Amounts keep two decimals and are built from integer paise, never from floats | `amt()` formats paise as `12711.86` |
| Dates are `YYYYMMDD` | `dateIso` with the hyphens removed |
| A voucher that does not balance is refused | `receiptVoucherXml` throws if taxable, CGST and SGST do not add to the gross |
| Each voucher has a stable id | `voucherGuid(centreCode, number)` is a SHA-256 of the centre code and receipt number, shaped like a GUID, so the same receipt always gets the same id |
| Special characters in ledger names are escaped | `&`, `<`, `>`, quotes |

### 15.3 What the tests show (TC-15)

The XML is well formed. Every voucher's entries add to zero, the first entry is the negative, deemed-positive bank line, and the voucher type and action are as above. Amounts print with two decimals. The same receipt gives the same id, and the same receipt number at a different centre gives a different one.

### 15.4 Gaps and specification for the rest

- **Credit notes.** PRD FR-ADM-03 covers credit notes too. They are the mirror image of a receipt: the fee, CGST and SGST ledgers are debited and the bank ledger credited, with the credit note's own number. The voucher type name and sign handling for Tally's credit note have not been checked against Tally's samples and must be, before building.
- **CSV.** A CSV with date, voucher number, centre, student code, mode, gross, taxable, CGST, SGST and type, as the fallback (PRD 9.3).
- **Ledger names from settings.** The ledgers (`company`, `bank`, `fees`, `cgst`, `sgst`) are read from `system_settings`, with the bank ledger chosen by payment mode (clearing account for gateway payments, cash for cash), as the PRD asks that names come from settings. The reference takes one bank ledger.
- **Repeat exports.** Exporting the same range again produces the same ids. Every export is logged in `tally_exports` with who, when, range, count and total (FR-ADM-05).
- **Whether Tally ignores a duplicate id on re-import is not verified.** The PRD itself says XML import can fail without a visible error, so release R1 requires the client's accountant to import a real file in Tally Prime and confirm that it imports without exceptions and that the totals match the receipts (open item O-07).
- **Hostel and mess.** The reference books every receipt to one fee ledger. Whether hostel and mess need separate ledgers or a different GST treatment is a question for the accountant (A-04).

## 16. Security and threat model

Most of the system holds children's data and money, so the controls that matter most are the ones the database enforces. The table lists each threat, the control, and whether the reference code tests it (Tested) or it is specified here (Designed).

### 16.1 Threats and controls

| Threat | Control | Status |
| --- | --- | --- |
| Forged payment webhook | HMAC-SHA256 over the raw body with the webhook secret, compared in constant time; mismatch returns 400 and changes nothing | Signature check Tested; route Designed |
| Replayed or duplicated webhook | `gateway_payment_id` is unique and the insert is `ON CONFLICT DO NOTHING`; 10 parallel duplicates credit once | Tested |
| Payer redirects money to another student | Matching uses only the server-created order table, never browser-supplied notes (section 13.4) | Designed |
| A parent reads another student's data | Every query is filtered by the verified guardian link; a foreign id returns 403 and writes an audit row | Designed (TC-10) |
| A clerk reads another centre's data | Centre scope from `user_centres` on every list and detail query | Designed (TC-10) |
| OTP guessing and number enumeration | Keyed hash, 5 minutes, 5 tries then 15-minute lock, 5 codes an hour, identical reply for unknown numbers | Designed |
| Session theft or fixation | `HttpOnly`, `Secure`, `SameSite=Lax` cookie; session row checked on each request; revoked on phone change | Designed |
| CSRF on state-changing routes | `POST` only, origin check, `SameSite=Lax` | Designed |
| Insider edits a receipt or the audit log | `REVOKE` for the application role and `forbid_change` triggers, which also stop the table owner | Tested (TC-18) |
| Insider alters an amount on a payment | Column grants and `guard_payments` trigger | Tested (TC-18) |
| Double credit under concurrent payments | Row locks, version check and the deferred paid-equals-allocations trigger | Tested (TC-09, 200 parallel) |
| Receipt number gap or duplicate | Counter updated inside the payment transaction; unique constraints | Tested |
| Refund raised and approved by one person | Database check `approved_by <> raised_by`; the role check is in the API | Check Tested; role Designed |
| Risk scanner or model changes fees or messages | Scanner role has write access to `dropout_flags` only; the model has no tools or database access and its reply is parsed, never executed | Role Tested; model Designed (TC-11) |
| SQL injection | Every statement in `src/db` uses numbered parameters. The only interpolated text is the isolation level, taken from a fixed two-value type | Tested by review |
| Malicious CSV upload | Size limit, parsed as data, all rows or none, file hash unique so a repeat is refused | Designed (TC-19) |
| Formula injection in exported CSV | Cells that begin with `=`, `+`, `-` or `@` are prefixed so a spreadsheet does not run them | Designed |
| XML injection in the Tally file | Every text value is escaped | Tested |
| Script injection through payer names or remarks | Output is escaped by default and no raw HTML is rendered from stored text | Designed |
| Personal data in logs | Structured logs carry the request id and ids only; no names, phone numbers or codes | Designed |
| Demo features reaching production | Demo bar, on-screen code and clock switch compiled out; the reminder run refuses the `DEMO` clock | Run refusal Tested; build Designed (TC-23) |
| Leaked secrets | Gateway, webhook, model and messaging keys are environment variables, separate for demo and production, never in the repository | Designed |
| Vulnerable dependencies | Dependency and secret scans on every change | Designed |

### 16.2 Rate limits

Limits apply to code requests, order creation and CSV upload (PRD 9.6). The code limit is the 5 an hour per number in section 12.1. Order creation and uploads are limited per user and per minute, with values set in `system_settings`.

### 16.3 Data at rest and in transit

Traffic is HTTPS only. The database and its backups are encrypted at rest by the host (PRD 9.6). Guardian identity numbers are never stored in full, only a type and the last four characters. OTP and phone values are stored as keyed hashes.

### 16.4 Breach response

The runbook is PRD section 9.6: contain (revoke sessions, rotate keys), assess from the audit log (what, whose, how many, since when), tell the Data Protection Board and the affected parents without delay, then record and review. The PRD cites 72 hours under Rule 7 of the DPDP Rules for the detailed report and says to check the current text; this design does not restate the deadline as settled.

To support the assessment step, this design adds one thing beyond the PRD's audit list (FR-AUD-01): a row for each staff read of a student's personal record, with the request id, so the log can say whose data a compromised account touched. It adds volume, so it is limited to detail pages and exports, not list screens.

## 17. Deployment and operations

The demo can run on a free host, but production needs a host that can run scheduled jobs reliably and a database in the Mumbai region. The PRD's environment, backup and alert rules (PRD 9.1, 9.5, 9.7) are turned into a concrete pipeline here. Nothing in this section was deployed.

### 17.1 Environments

| Environment | Data | Clock | Messaging and payments |
| --- | --- | --- | --- |
| Demo | Invented students with synthetic names and phone numbers | Anchor date 2 November 2026, with a switch to the live date | Outbox only; test-mode checkout |
| Staging | One centre's structure with scrambled personal data | Live | Provider sandboxes |
| Production | Real data | Live; the build has no anchor switch | Live provider and gateway |

The demo may run on Vercel Hobby, which the PRD notes is for non-commercial use and runs scheduled jobs at most once a day. Production uses a paid Vercel plan or another host, with PostgreSQL 16 or later on a managed service in the Mumbai region (PRD 9.3).

### 17.2 Scheduled jobs

Jobs are HTTP routes under `/api/jobs/:name`, called by the host's scheduler with a secret in a header, so the same code runs on any host. This replaces the separate worker process of section 3.1 on serverless hosts; on a host with long-running processes the same functions can be started by a scheduler inside one worker.

| Job | When (IST) | Idempotence |
| --- | --- | --- |
| Risk scan | 06:00 daily and on demand | One open task per student; a dismissed flag is held for 14 days |
| Unmatched-queue ageing alert | 09:00 daily | Alerts on items older than two working days |
| Refund SLA alert | 09:00 daily | Alerts at three days left and at breach |
| Reminder run | 10:00 daily | A reminder moves from `QUEUED` to `SENT` once; a rerun sends nothing |

Schedulers that use UTC need the times converted: 06:00 IST is 00:30 UTC, 09:00 IST is 03:30 UTC and 10:00 IST is 04:30 UTC. A missed run is caught by the one-day look-back in the reminder run; the other jobs are safe to run late.

### 17.3 Database and migrations

- **SQL files are the source of truth** (DD-12). The triggers, column grants and partial indexes in `002_integrity.sql` and `003_grants.sql` cannot be written in a Prisma schema, so migrations are plain numbered SQL files applied in order with the owner role, and Prisma's schema is produced from the database with `prisma db pull` (section 4.2).
- **Three connection strings.** The application uses `app_rw`, the scan job uses `risk_scanner`, and only the migration step uses the owner. The owner credential is not present in the running application.
- **Passwords in `000_roles.sql` are for the local test cluster.** Production roles are created with generated secrets outside the repository.
- **Backups.** Daily, with at most 24 hours of data lost and 4 hours to restore (PRD 9.1), and a restore tried every quarter with a written drill record.

### 17.4 Configuration

| Name | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_SCANNER` | The two run-time roles |
| `DATABASE_URL_OWNER` | Migrations only |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Gateway orders and webhook check |
| `SESSION_SECRET`, `OTP_PEPPER` | Cookie token signing; keyed hashes for codes and numbers |
| `MESSAGING_PROVIDER`, its key | Reminder delivery adapter |
| `MODEL_PROVIDER`, `MODEL_NAME`, its key | Optional call-guide model |
| `JOB_SECRET` | Authenticates the scheduler |
| `DEMO_MODE` | Compiles the demo features in or out |

Secrets are environment variables, with separate sets for demo and production. The server clock is UTC (PRD 9.1), and the code does not depend on it: the full reference suite of 61 tests passed with the process time zone set to `UTC`, `Asia/Calcutta` and `America/Los_Angeles`.

### 17.5 Continuous integration

Every change runs these steps, in order, and fails on the first problem.

1. `tsc --noEmit` in strict mode.
2. A check that no file in `src/domain` imports a database, framework or clock module.
3. Start PostgreSQL 16, apply the four SQL files, and run `vitest` (the 61 tests, plus the new ones for each built route).
4. `prisma db pull` against that database, compare with `prisma/schema.prisma`, then `prisma validate`. This is the step the reference build could not run.
5. Dependency and secret scans.
6. Production build, then the bundle checks: first parent screen under 170 KB compressed, and no demo-only code (TC-23).
7. Playwright at 360 by 800, tablet and desktop widths, as each role, including the dead-button crawl and the accessibility check.

### 17.6 Monitoring and alerts

Logs are structured with a request id and carry no personal data. Alerts fire on a failed webhook (any 5xx, or a signature failure above a small threshold), a failed reminder run, and queue age (items older than two working days). The availability target is 99.5% between 08:00 and 22:00 IST, watched by an uptime monitor (PRD 9.1).

### 17.7 Release order

The PRD's release plan decides what goes live when: the core build first, then real OTP on a registered sender, consent capture, per-centre access and a real Tally import in R1; one centre run in parallel with its Excel sheet and live gateway and templates in R2; all centres after Hindi copy review and counsel's view on D-01 and D-02 in R3.

## 18. Test architecture

Tests sit in four layers, and the lower two already exist. The 61 tests that exist all pass against a real PostgreSQL 16.15, and they passed with the process time zone set to UTC, Asia/Calcutta and America/Los\_Angeles.

### 18.1 Layers

| Layer | Tool | What it proves | State |
| --- | --- | --- | --- |
| Domain | Vitest, no database | Every rule in section 7 against the PRD's worked numbers and properties | Built: 34 tests |
| Pure integration | Vitest | Webhook signature, Tally XML | Built: 6 tests |
| Database | Vitest and a real PostgreSQL 16 | Constraints, triggers, grants, the payment, reminder and refund transactions, concurrency, fault injection | Built: 19 tests, plus 2 in the isolation experiment |
| Route | Vitest calling route handlers | Status codes, role matrix, zod validation, webhook route | Designed |
| Browser | Playwright, three viewports | Screens, states, dead-button crawl, accessibility, production build | Designed |
| People | Named people, real systems | Checks in 18.4 | Specified by the PRD |

### 18.2 How the database tests work

- `beforeAll` drops the public schema, then applies `000_roles.sql`, `001_schema.sql`, `002_integrity.sql` and `003_grants.sql` in order, so every run starts from the files in the repository.
- Three connection pools are opened, as the owner, as `app_rw` and as `risk_scanner`. Tests that prove a permission is missing use the restricted pool and expect `permission denied`.
- Each test makes its own centre with its own GSTIN, so receipt counters never interfere across tests.
- Faults are injected by a `failAfter` hook in `recordPayment` at four named points, and the test then checks that nothing changed and that the next receipt number has no gap.
- Time is passed in as an argument. Nothing in the tests waits for a real clock except the 24-hour rule, which passes a later `now` instead of sleeping.

The local cluster in the reference run listened on a unix socket in `/tmp`. In CI use a PostgreSQL 16 service container and point the three pools at it.

### 18.3 Coverage of the PRD's test cases

| Test case | Subject | Covered by | State |
| --- | --- | --- | --- |
| TC-01 | Instalment status on 2 November and at d of 0 and 1 | `domain.test.ts` | Passing |
| TC-02 | GST split, then every gross to ₹1,000 | `domain.test.ts` | Passing |
| TC-03, 03b | Refund Cases A to F, and from dates | `domain.test.ts` | Passing |
| TC-04 | STU-0587 final ₹15,000 through the transaction | `db.test.ts` | Passing |
| TC-04b | Replay, injected fault, bad signature | Replay and faults in `db.test.ts`; signature function in `integration-pure.test.ts` | Passing; the 400 response needs the route test |
| TC-05 | Risk score and boundaries | `domain.test.ts` | Passing |
| TC-06 | Ageing buckets | `domain.test.ts` | Passing |
| TC-07 | Reminders | `db.test.ts` | Passing |
| TC-08 | Unmatched queue | `db.test.ts`; the cancelled-instalment case is in the TC-12 test | Passing |
| TC-09 | 50 parallel receipts, rollback leaves no gap | `db.test.ts` (and 200 in the experiment) | Passing |
| TC-10 | Access control matrix | None yet | Designed |
| TC-11 | AI guardrails | None yet; the scanner-role half is in the TC-18 test | Partly passing |
| TC-12 | Refund workflow | `db.test.ts`; self-approval is refused by the database, the 403 needs the route test; the countdown is a screen check | Partly passing |
| TC-13 | Plans and allocation | `domain.test.ts`; the rule that a batch needs a plan of four or more equal instalments is not yet enforced anywhere | Partly passing |
| TC-14 | Consent | None yet; the one-active-consent index is in a schema test | Designed |
| TC-15 | Tally file | `integration-pure.test.ts`; "second export adds nothing" rests on stable ids only | Partly passing |
| TC-16 | Cash limit | None yet | Designed |
| TC-17 | Language and layout | None yet | Designed |
| TC-18 | Audit, grants | `db.test.ts` | Passing |
| TC-19 | CSV upload | None yet; the unique file hash is in the schema | Designed |
| TC-20 | Time zone | `domain.test.ts` | Passing |
| TC-21 to TC-23 | Dead buttons, accessibility, production build | None yet | Designed |

Of the PRD's 25 test cases (TC-01 to TC-23, plus TC-03b and TC-04b), 12 pass in full, 5 are partly covered (TC-04b, TC-11, TC-12, TC-13, TC-15), and 8 are specified and not yet built (TC-10, TC-14, TC-16, TC-17, TC-19, TC-21, TC-22, TC-23).

### 18.4 Checks that need people

| Check | Who | Pass condition | Release |
| --- | --- | --- | --- |
| Tally import | The client's accountant, in real Tally Prime | Imports with no exceptions; totals match the receipts | R1 |
| Five-second test | Five parents on their own phones | Each finds the amount, date and pay button in under five seconds | R1 |
| Hindi review | A native reader who is not the author | Every screen, receipt and message approved | R1 |
| Restore drill | The engineer | A backup restores into a clean database within four hours and totals match | R1 |
| Parallel run | Accounts staff at one centre | Two reminder cycles with zero reminders after payment; ledger totals match the Excel sheet | R2 |

### 18.5 Load and speed checks

The PRD asks that 95% of webhooks finish in under one second and that a load test of 50 webhooks in parallel with duplicates passes. The reference measured only database time on one local machine: 50 payments in about 314 ms and 200 in 872 ms in total. Per-request latency and the full route were not measured, so the one-second target is untested. The load test at twice the scale (about 1,200 sessions in the hour after a reminder run) is also not run.

## 19. Traceability matrix

Each of the PRD's 72 functional requirements maps to a section of this document, to the code or schema that implements it, and to a test. Of the 72, 28 are built and tested, 18 are partly built or partly tested, and 26 are designed only.

State means: **Built** has code or schema in the reference build and a passing test; **Partly** has some of that but a stated piece missing; **Designed** is specified here and has no code yet.

### 19.1 Sign-in, consent and data rights

| Requirement | Design | Code or schema | Test | State |
| --- | --- | --- | --- | --- |
| FR-AUTH-01 OTP rules | 12.1 | `otp_challenges` | none yet | Designed |
| FR-AUTH-02 Same reply for unknown numbers | 12.1 | none | none yet | Designed |
| FR-AUTH-03 Signed cookie, 14 days and 8 hours | 12.2 | `sessions` | none yet | Designed |
| FR-AUTH-04 Parent sees only linked students | 12.3 | `guardians` | TC-10 | Designed |
| FR-AUTH-05 Phone change revokes sessions | 12.2 | `sessions.revoked_at` | none yet | Designed |
| FR-AUTH-06 Demo features only in demo mode | 12.1, 14.5 | `clock` guard in `reminderRun` | TC-23 | Designed |
| FR-CNS-01 Consent before child data | 12.4 | `dpdp_consents` | TC-14 | Designed |
| FR-CNS-02 Guardian record, last four digits only | 6.6 | `guardians.id_last4` check | none that tries a bad value | Partly |
| FR-CNS-03 Withdrawal stops reminders | 12.4 | `suppress_reason` allows `CONSENT_WITHDRAWN` | TC-14 | Designed |
| FR-CNS-04 Correction or erasure request | 12.4 | `data_requests` | none yet | Designed |
| FR-CNS-05 Separate consent per parent | 12.4 | `one_active_consent` | Schema test | Partly |

### 19.2 Fee ledger

| Requirement | Design | Code or schema | Test | State |
| --- | --- | --- | --- | --- |
| FR-LED-01 Integer paise | 3.4, 7.1 | `bigint` columns, `money.ts` | TC-13, INR formatting | Built |
| FR-LED-02 Four or more equal instalments | 7.7 | `equalInstalments`; no rule blocks a batch without such a plan | TC-13 | Partly |
| FR-LED-03 Instalment status | 7.3 | `status.ts` | TC-01 | Built |
| FR-LED-04 Ageing | 7.4 | `ageing.ts` | TC-06 | Built |
| FR-LED-05 IST dates | 3.4, 7.8 | `dates.ts`, `pg.ts` | TC-20 | Built |
| FR-LED-06 Demo anchor, never sends | 9.2, 14.5 | `reminderRun` refuses `DEMO` | TC-07; banner not built | Partly |
| FR-LED-07 Split by fee head | 6.1, 8.1 | `instalment_heads`, `allocate` | Single-head payments only | Partly |
| FR-LED-08 Discount in net fee | 6.3 | `student_fees.net_paise` generated | Schema test | Built |
| FR-LED-09 Append-only ledger | 6.4 | Triggers and grants (with DD-02) | TC-18 | Built |
| FR-LED-10 Version check on write | 8.1 | `instalments.version` | Retry path not tested directly | Partly |

### 19.3 Payments, receipts and refunds

| Requirement | Design | Code or schema | Test | State |
| --- | --- | --- | --- | --- |
| FR-PAY-01 Full or part payment limits | 13.4 | none | none yet | Designed |
| FR-PAY-02 Webhook signature | 13.3 | `webhook.ts` | TC-04b function; route not built | Partly |
| FR-PAY-03 Replay safe | 8.1 | `ON CONFLICT`, unique id | TC-04b | Built |
| FR-PAY-04 One transaction | 8.1, 8.3 | `recordPayment` (DD-01) | TC-04, TC-09 | Built |
| FR-PAY-05 Match or queue | 8.1 | `recordPayment` | TC-08 | Built |
| FR-PAY-06 Reason codes, queue columns | 6.3, 8.1 | `payments` | TC-08; queue screen not built | Partly |
| FR-PAY-07 Resolve or reject | 8.4 | `resolveUnmatched`, `rejectUnmatched` | TC-08 | Built |
| FR-PAY-08 Overpayment | 8.1, 8.4 | `allocate`, `unallocated_paise` (DD-05) | TC-04 | Built |
| FR-PAY-09 Cash limit | 13.2 | none | TC-16 | Designed |
| FR-RCP-01 Receipt contents | 14.6 | `receipts.snapshot_json` | none yet | Designed |
| FR-RCP-02 Gapless numbers | 3.4, 8.1 | `issueDoc`, `receipt_counters` | TC-09 | Built |
| FR-RCP-03 GST split | 7.2 | `gst.ts` | TC-02 | Built |
| FR-RCP-04 Receipts cannot change | 6.4 | Triggers and grants | TC-18 | Built |
| FR-RCP-05 Credit note | 10.4 | `settleRefund` | TC-12 | Built |
| FR-RCP-06 Keep 72 months | 12.4 | none | none yet | Designed |
| FR-REF-01 Raise a refund | 10.2 | `raiseRefund` | TC-12 | Built |
| FR-REF-02 Per-head pro rata | 7.5 | `computeRefund` | TC-03 | Built |
| FR-REF-03 Cancel unpaid instalments | 10.3 | `approveRefund` | TC-12 | Built |
| FR-REF-04 Raiser cannot approve | 10.3, 10.5 | Database check | TC-12 (database refusal; 403 and role check not built) | Partly |
| FR-REF-05 Ten-day clock | 7.5, 10.2 | `computeRefund` deadline | TC-03b; badge not built | Partly |
| FR-REF-06 Shortfall is not charged | 7.5 | `shortfall_paise` | TC-03 Case E | Built |
| FR-REF-07 Settlement | 10.4 | `settleRefund` | TC-12 | Built |

### 19.4 Reminders, risk and administration

| Requirement | Design | Code or schema | Test | State |
| --- | --- | --- | --- | --- |
| FR-REM-01 Five reminders | 9.1 | `createReminders` | TC-07 | Built |
| FR-REM-02 Language and templates | 9.1 | `template_code`, `lang` | Hindi text asserted; templates not stored | Partly |
| FR-REM-03 Balance at send time | 9.2 | `reminderRun` | TC-07 | Built |
| FR-REM-04 Suppress on full payment | 8.1 | `applyMatched` | TC-04 | Built |
| FR-REM-05 24-hour quiet period | 9.2 | `reminderRun` | TC-07 | Built |
| FR-REM-06 Call task after plus-15 | 9.4 | none | none yet | Designed |
| FR-REM-07 Daily, live clock only | 9.2, 17.2 | `reminderRun` | TC-07 | Built |
| FR-REM-08 Outbox states | 13.2, 14.1 | `reminders.state` | none yet | Designed |
| FR-REM-09 Provider adapter | 9.4 | none | none yet | Designed |
| FR-RSK-01 CSV upload | 13.2, 16.1 | `csv_uploads` | TC-19 | Designed |
| FR-RSK-02 Score | 7.6 | `risk.ts` | TC-05 | Built |
| FR-RSK-03 Task at 50, HIGH at 70 | 7.6, 11.1 | `risk.ts`, `one_open_flag_per_student` | TC-05; scan job not built | Partly |
| FR-RSK-04 Scanner writes only flags | 3.3, 6.7 | `risk_scanner` role | TC-18 | Built |
| FR-RSK-05 Scanner cannot message or change fees | 3.3, 11.1 | Role grants | TC-18 (role only) | Partly |
| FR-RSK-06 False flag, 14 days | 11.2 | Check on `dropout_flags` | none yet | Partly |
| FR-RSK-07 Model call guide | 11.3 | none | TC-11 | Designed |
| FR-RSK-08 Flag shows why | 11.1 | Factor columns, `inputs_json` | none yet | Partly |
| FR-ADM-01 Dues dashboard | 14.1 | none | none yet | Designed |
| FR-ADM-02 Student ledger | 14.1 | none | none yet | Designed |
| FR-ADM-03 Tally export | 15 | `tally.ts` (receipts only) | TC-15 | Partly |
| FR-ADM-04 Repeatable export | 15.2 | `voucherGuid` | TC-15 | Partly |
| FR-ADM-05 Export log | 15.4 | `tally_exports` | none yet | Designed |
| FR-AUD-01 Audit rows | 12.5 | `audit` in payment, refund and queue code | Some asserted | Partly |
| FR-AUD-02 Append-only audit | 6.4 | Revoke and triggers | TC-18 | Built |
| FR-UI-01 Language toggle | 14.3 | none | TC-17 | Designed |
| FR-UI-02 Dues card above the fold | 14.2 | none | TC-17 | Designed |
| FR-UI-03 No dead buttons | 14.5 | none | TC-21 | Designed |
| FR-UI-04 Loading, empty, error | 14.5 | none | Playwright | Designed |
| FR-UI-05 Accessibility | 14.5 | none | TC-22 | Designed |

### 19.5 Where the build differs from the PRD

The design decisions DD-01 to DD-12 in section 2.3 list every place where this design changes or adds to the PRD. The three that change a stated requirement are DD-01 (isolation level for FR-PAY-04), DD-02 (`payments` is not insert-only, against the PRD's data-model note) and DD-04 (percentages stored as integers).

## 20. Risks, open items and what was not verified

Three lists follow: engineering risks with their mitigations, open items that someone must close, and the things that were not checked.

### 20.1 Engineering risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| One counter row per GSTIN, year and kind serialises payments of that centre | A slow transaction delays the next payment of the same centre | The measured cost is about 4 ms per payment at 200 in parallel. Set `lock_timeout` and `statement_timeout` on the application role so a stuck transaction fails instead of waiting |
| The Prisma schema or its engine misbehaves | Reads and simple writes fail | The money path does not use Prisma (DD-09). Run `prisma db pull` and `validate` in CI (section 17.5) |
| A refund is approved on a stale amount | Wrong refund | Recompute on approval and refuse if it differs (section 10.5) |
| A refund cancels an instalment while its payment is in flight | Money lands on a later instalment | Handled by skipping cancelled rows; the race is untested (section 8.6) |
| Fee plans edited after enrolment | Breaks the Rajasthan Act's rule against raising fees mid-course (PRD 8.1, s.13(5)) | Not enforced yet. Add a trigger that refuses changes to `fee_plan_lines` and to the amounts of an enrolled student's instalments, with a Director-approved audited exception |
| A batch saved without a plan of four or more equal instalments | Breaks s.6(2)(d) and FR-LED-02 | Not enforced yet. Check at batch save and add a deferred database check |
| Gateway outage or delayed webhook | Parent paid, balance still shows due | The gateway retries; the unmatched queue and a reconciliation view cover gaps. A daily comparison of gateway captures with our payments is a worthwhile addition |
| A vendor retires a model, host plan or package version | Feature stops | Providers and model names are configuration; versions are pinned (section 4) |
| Receipts written before the snapshot is extended | Early receipts lack fields the PRD requires | Extend the snapshot before the first real receipt (section 14.6) |
| Legal position on risk scoring is unsettled | The scan may not be lawful for children's data | Ship it off by default until counsel answers D-02 (section 12.4) |
| Hosts differ in time zone | A date shifts by a day | The code does not read the process time zone; the suite passed under UTC, IST and US Pacific |

### 20.2 Open items

| ID | Item | Owner |
| --- | --- | --- |
| O-01 | Run and pass `prisma db pull` and `prisma validate` against the migrated database | Engineer, first CI job |
| O-02 | Credit note names only the latest receipt; hostel and mess GST treatment is not modelled (A-04) | Chartered accountant |
| O-03 | Section number of the cash-receipt limit in the Income-tax Act 2025 (sources say 186 or 221); the control itself is FR-PAY-09 | Chartered accountant |
| O-04 | Choose a messaging provider; register the sender, header and templates for SMS, and templates for WhatsApp | Client and engineer |
| O-05 | Choose a model provider for the call guide, or ship with templates only | Client |
| O-06 | Confirm in the gateway sandbox which status code and retry schedule the webhook should expect, and which timestamp to use as the payment time | Engineer |
| O-07 | Import a real receipt file, and a credit-note file once built, in Tally Prime; confirm duplicate-id behaviour | Client's accountant (R1) |
| O-08 | Check TypeScript 7 with Next.js 16, Prisma 7 and Vitest 5 before upgrading from 5.9.3 | Engineer |
| O-09 | Native review of every Hindi screen, receipt and message | Native reader (R1) |
| O-10 | Counsel: D-01 (is the Rajasthan Act in force), D-02 (may the risk score run) and A-05 (do instalment payers get the refund right) | Counsel |

### 20.3 What was not verified

- **Prisma.** The schema engine could not be downloaded in this workspace (403), so the Prisma schema was never generated or validated.
- **The application layer.** Routes, screens, the auth flow, the scan job, the adapter and every Playwright test are designed, not built.
- **External systems.** A live gateway, a messaging provider, a real Tally Prime import and a real model were not used. Webhook rules were checked against the gateway's documentation only.
- **PostgreSQL versions.** Only 16.15 was run. The PRD allows 16 or later; test 17 and 18 before choosing a managed service on them.
- **Connection pooling.** The tests used a plain pool of 25. Behaviour behind a transaction-mode pooler was not tried.
- **Performance.** The one-second webhook target, the 2.5-second dues card and the 170 KB budget were not measured, and the load test was not run.
- **Operations.** Backups, restore drill, alerts and the host's scheduler were not set up.
- **Hindi text.** The labels in the reference code are mine and have not been reviewed by a native reader.
- **Some design claims about vendors.** Prices for hosting, the database, SMS and the gateway were not checked, as the PRD also says.

## 21. Sources

| Source | Used for |
| --- | --- |
| PRD, ShikshaSetu (https://claude.ai/artifact/UPeKgcYpMvgYaLg64KD1RD) | Every requirement, test case, role, rule and worked number this document traces to |
| [Razorpay: validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/) | Signature header, HMAC-SHA256 over the raw body, unique event-id header, duplicate and out-of-order delivery (sections 8, 13) |
| [Razorpay: payment webhook events](https://razorpay.com/docs/webhooks/payments/) | `payment.captured` payload fields: payment id, amount in paise, order id (section 13.3) |
| [Tally help: voucher import samples](https://help.tallysolutions.com/scenario-2/) | Receipt voucher shape, ledger entry signs, date format (section 15) |
| npm registry, queried on 9 November 2026 | Package versions in section 4.1 |
| Prisma release status, as cited in PRD 9.3 | Prisma 6 security-fix end date of 19 November 2026; Prisma 7 support after Prisma 8 (section 4.2). I could not re-open the page on the last pass, so these dates rest on the earlier read and the PRD |
| Reference implementation: `src`, `sql` and `tests` in the work folder (1,432 lines, 61 tests) | Every measured result quoted in sections 2, 7, 8, 9, 10, 15 and 18 |
